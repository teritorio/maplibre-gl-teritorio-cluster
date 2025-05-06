import type { CustomLayerInterface, FitBoundsOptions, GeoJSONFeature, GeoJSONSource, LngLatLike, MapGeoJSONFeature, Map as MapGL, MapSourceDataEvent, Marker, Point } from 'maplibre-gl'
import bbox from '@turf/bbox'
import { featureCollection } from '@turf/helpers'
import maplibre from 'maplibre-gl'
import { deepMerge } from './utils/deep-merge'
import { clusterRenderDefault, markerRenderDefault, pinMarkerRenderDefault, unfoldedClusterRenderSmart } from './utils/helpers'

type UnfoldedCluster = (
  (
    parent: HTMLDivElement,
    items: MapGeoJSONFeature[],
    markerSize: number,
    renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement,
    clickHandler: (e: Event, feature: MapGeoJSONFeature) => void
  ) => void
)
type ClusterRender = (
  (
    element: HTMLDivElement,
    props: MapGeoJSONFeature['properties']
  ) => void
)
type MarkerRender = (
  (
    element: HTMLDivElement,
    markerSize: number,
    feature?: GeoJSONFeature
  ) => void
)
type PinMarkerRender = (
  (
    coords: LngLatLike,
    offset: Point
  ) => Marker
)
interface FeatureInClusterMatch { clusterId: string, feature: GeoJSONFeature }
type FeatureMatch = FeatureInClusterMatch | GeoJSONFeature

interface TeritorioClusterOptions {
  clusterMaxZoom: number
  clusterMinZoom: number
  clusterRender: ClusterRender
  fitBoundsOptions: FitBoundsOptions
  initialFeature: MapGeoJSONFeature | undefined
  markerRender: MarkerRender
  markerSize: number
  unfoldedClusterRender: UnfoldedCluster
  unfoldedClusterMaxLeaves: number
  pinMarkerRender: PinMarkerRender
}

export class TeritorioCluster extends EventTarget implements CustomLayerInterface {
  public id: string
  public type: 'custom' = 'custom' as const

  private UNFOLDED_CLASS = 'teritorio-unfolded-cluster'
  private defaultOptions: TeritorioClusterOptions = {
    clusterMaxZoom: 17,
    clusterMinZoom: 0,
    clusterRender: clusterRenderDefault,
    fitBoundsOptions: { padding: 20 },
    initialFeature: undefined,
    markerRender: markerRenderDefault,
    markerSize: 24,
    unfoldedClusterRender: unfoldedClusterRenderSmart,
    unfoldedClusterMaxLeaves: 7,
    pinMarkerRender: pinMarkerRenderDefault,
  } satisfies TeritorioClusterOptions

  // Class fields
  private map: MapGL | null = null
  private sourceId: string
  private source: GeoJSONSource | null = null
  private opts: Required<TeritorioClusterOptions>

  // Cluster-related state
  private clusterLeaves = new Map<string, MapGeoJSONFeature[]>()
  private featuresMap = new Map<string, GeoJSONFeature>()
  private markersOnScreen = new Map<string, Marker>()

  // UI state
  private pinMarker: Marker | null = null
  private selectedClusterId: string | null = null
  private selectedFeatureId: string | null = null
  private abortExec: number = 0

  constructor(
    id: string,
    sourceId: string,
    options?: Partial<TeritorioClusterOptions>,
  ) {
    super()

    this.id = id
    this.sourceId = sourceId
    this.opts = deepMerge(this.defaultOptions, options || {})
  }

  onAdd = (map: MapGL): void => {
    this.map = map

    this.setSource()

    // Add transparent layer to enable source data
    this.map.addLayer({
      id: `${this.id}-hidden`,
      type: 'circle',
      source: this.sourceId,
      paint: {
        'circle-color': 'transparent',
      },
    })

    this.map.on('sourcedata', this.onSourceData)

    this.map.on('moveend', this.onMoveEnd)
  }

  public onRemove = (): void => {
    if (!this.map)
      return

    this.map.off('sourcedata', this.onSourceData)
    this.map.off('moveend', this.onMoveEnd)
    this.markersOnScreen.forEach(marker => marker.remove())
    this.resetPinMarker()
  }

  private onSourceData = (ev: MapSourceDataEvent): void => {
    if (ev.isSourceLoaded && ev.sourceId === this.sourceId && ev.sourceDataType !== 'metadata') {
      this.abortExec++
      this.renderCustom(this.abortExec)
    }
  }

  private onMoveEnd = (): void => {
    this.abortExec++
    this.renderCustom(this.abortExec)
  }

  private renderCustom = async (currentExec: number): Promise<void> => {
    if (!this.shouldRender(currentExec))
      return

    const features = this.map!.querySourceFeatures(this.sourceId)
    this.clearRenderState()

    const newMarkers = new Map<string, Marker>()
    const maxZoomLimit = this.map!.getZoom() >= this.opts.clusterMaxZoom
    const minZoomLimit = this.map!.getZoom() >= this.opts.clusterMinZoom

    this.clusterLeaves.clear()
    this.featuresMap.clear()

    for (const feature of features) {
      if (this.abortExec !== currentExec)
        return

      const id = this.getFeatureId(feature)
      this.featuresMap.set(id, feature)

      if (this.isClusterFeature(feature)) {
        const success = await this.loadClusterLeaves(id, feature)

        if (this.abortExec !== currentExec)
          return

        if (!success)
          return
      }
    }

    this.featuresMap.forEach((feature) => {
      const coords = feature.geometry.type === 'Point' ? new maplibre.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]) : undefined
      const id = this.getFeatureId(feature)

      if (!coords) {
        console.error(`Feature ${id} is not Geometry.Point, thus not supported yet.`)
        return
      }

      let marker = this.markersOnScreen.get(id)
      const props = feature.properties

      if (props.cluster) {
        const leaves = this.clusterLeaves.get(id)

        if (!leaves) {
          console.error(`Cluster ${id} has no leaves`)
          return
        }

        if (
          (marker && maxZoomLimit && !marker.getElement().classList.contains(this.UNFOLDED_CLASS))
          || (marker && !maxZoomLimit && marker.getElement().classList.contains(this.UNFOLDED_CLASS) && this.markersOnScreen.has(id))
          || (marker && minZoomLimit && !marker.getElement().classList.contains(this.UNFOLDED_CLASS))
          || (marker && !minZoomLimit && marker.getElement().classList.contains(this.UNFOLDED_CLASS) && this.markersOnScreen.has(id))
        ) {
          marker = undefined
          this.markersOnScreen.get(id)?.remove()
          this.markersOnScreen.delete(id)
        }

        if (!marker) {
          let element: HTMLDivElement | undefined

          if (minZoomLimit && ((leaves.length <= this.opts.unfoldedClusterMaxLeaves) || maxZoomLimit))
            element = this.renderUnfoldedCluster(id, leaves)
          else
            element = this.renderCluster(id, props)

          marker = new maplibre.Marker({ element }).setLngLat(coords).addTo(this.map!)

          // If selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if (this.pinMarker && this.selectedFeatureId && this.isFeatureInCluster(id, this.selectedFeatureId)) {
            this.selectedClusterId = id
            this.resetPinMarker()
            this.renderPinMarkerInCluster(element, coords)
          }

          // If initialFeature is part of this new cluster
          // We position the Pin marker on it
          if (this.opts.initialFeature && this.isFeatureInCluster(id, this.getFeatureId(this.opts.initialFeature))) {
            this.selectedClusterId = id
            this.selectedFeatureId = this.getFeatureId(this.opts.initialFeature)
            this.renderPinMarkerInCluster(element, coords)
            this.opts.initialFeature = undefined
          }
        }
      }
      else {
        if (!marker) {
          const element = this.renderMarker(feature)

          marker = new maplibre.Marker({ element }).setLngLat(coords).addTo(this.map!)
          element.addEventListener('click', (e: Event) => this.featureClickHandler(e, feature))

          // Keep Pin Marker on top
          if (this.pinMarker && this.selectedFeatureId === id) {
            this.resetPinMarker()
            this.renderPinMarker(coords)
          }

          // If initialFeature is this new marker
          // We position the Pin marker on it
          if (this.opts.initialFeature && (this.getFeatureId(this.opts.initialFeature) === id)) {
            this.selectedFeatureId = id
            this.renderPinMarker(coords)
            this.opts.initialFeature = undefined
          }
        }
      }

      newMarkers.set(id, marker)
    })

    // for every marker we've added previously, remove those that are no longer visible
    for (const [id, marker] of this.markersOnScreen.entries()) {
      if (!newMarkers.has(id))
        marker.remove()
    }

    if (this.opts.initialFeature && !this.selectedFeatureId && !this.pinMarker) {
      const id = this.getFeatureId(this.opts.initialFeature)
      const coords = this.opts.initialFeature.geometry.type === 'Point'
        ? new maplibre.LngLat(this.opts.initialFeature.geometry.coordinates[0], this.opts.initialFeature.geometry.coordinates[1])
        : undefined

      if (!coords) {
        console.error(`Coordinates not found for feature id : ${id}`)
        return
      }

      this.selectedFeatureId = id
      this.renderPinMarker(coords)
      this.opts.initialFeature = undefined
    }

    this.markersOnScreen = newMarkers
  }

  render = (): void => {
    //
  }

  public resetSelectedFeature = (): void => {
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.resetPinMarker()
  }

  public setSelectedFeature = (feature: GeoJSONFeature): void => {
    const id = this.getFeatureId(feature)
    const match = this.findFeature(id)

    if (!match) {
      if (feature.geometry.type !== 'Point') {
        console.error(`Feature ${id} is not Geometry.Point, thus not supported yet.`)
        return
      }

      // Sets a Pin Marker on a specific coordinates which isn't related to any feature from data source
      this.resetSelectedFeature()
      this.selectedFeatureId = id
      this.renderPinMarker(new maplibre.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]))

      return
    }

    this.resetSelectedFeature()
    this.selectedFeatureId = id

    if ('type' in match && match.type === 'Feature' && match.geometry.type === 'Point') {
      const coords = match.geometry.coordinates

      this.renderPinMarker(new maplibre.LngLat(coords[0], coords[1]))
    }
    else if ('feature' in match && match.feature.geometry.type === 'Point') {
      const cluster = this.markersOnScreen.get(match.clusterId)

      if (!cluster) {
        console.error(`Cluster ${match.clusterId} not found.`)
        return
      }

      this.selectedClusterId = match.clusterId
      this.renderPinMarkerInCluster(cluster.getElement(), cluster.getLngLat())
    }
  }

  private renderUnfoldedCluster = (id: string, leaves: MapGeoJSONFeature[]): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = id
    element.classList.add(this.UNFOLDED_CLASS)

    this.opts.unfoldedClusterRender(
      element,
      leaves,
      this.opts.markerSize,
      this.renderMarker,
      this.featureClickHandler,
    )

    return element
  }

  private fitBoundsToClusterLeaves = (features: MapGeoJSONFeature[]): void => {
    const bounds = bbox(featureCollection(features))

    this.map!.fitBounds(bounds as [number, number, number, number], this.opts.fitBoundsOptions)
  }

  private renderCluster = (id: string, props: MapGeoJSONFeature['properties']): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = id

    this.opts.clusterRender(element, props)

    element.addEventListener('click', (e: Event) => {
      e.stopPropagation()

      if (!(e.currentTarget instanceof HTMLElement))
        return

      // Fit map to cluster leaves bounding box
      const leaves = this.clusterLeaves.get(e.currentTarget.id)

      if (leaves)
        this.fitBoundsToClusterLeaves(leaves)
    })

    return element
  }

  private isFeatureInCluster = (clusterId: string, featureId: string): boolean => {
    if (!this.clusterLeaves.has(clusterId)) {
      console.error(`Cluster ${clusterId} not found.`)
      return false
    }

    return this.clusterLeaves.get(clusterId)!.findIndex(feature => this.getFeatureId(feature) === featureId) > -1
  }

  private getClusterCenter = (cluster: HTMLElement): { clusterXCenter: number, clusterYCenter: number } => {
    const { left, right, top, bottom } = cluster.getBoundingClientRect()

    return { clusterXCenter: (left + right) / 2, clusterYCenter: (top + bottom) / 2 }
  }

  private calculatePinMarkerOffset = (cluster: HTMLElement, marker: HTMLElement): Point => {
    const { clusterXCenter, clusterYCenter } = this.getClusterCenter(cluster)
    const { x, y, height, width } = marker.getBoundingClientRect()

    return new maplibre.Point(x - clusterXCenter + (width / 2), y - clusterYCenter + (height / 2))
  }

  private renderPinMarkerInCluster = (cluster: HTMLElement, coords: LngLatLike): void => {
    const isUnfoldedCluster = cluster.classList.contains(this.UNFOLDED_CLASS)

    if (!isUnfoldedCluster) {
      this.renderPinMarker(coords)
    }
    else {
      // Get selected feature DOM element position within cluster
      const selectedFeatureHTML = Array.from(cluster.children).find(el => el.id === this.selectedFeatureId) as HTMLElement

      if (!selectedFeatureHTML)
        throw new Error('Selected feature HTML marker was not found !')

      this.renderPinMarker(coords, this.calculatePinMarkerOffset(cluster, selectedFeatureHTML))
    }
  }

  private renderMarker = (feature: GeoJSONFeature): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = this.getFeatureId(feature)

    this.opts.markerRender(element, this.opts.markerSize, feature)

    return element
  }

  private findFeature = (id: string): FeatureMatch | undefined => {
    return this.featuresMap.get(id) ?? this.findClusterizedFeature(id)
  }

  private findClusterizedFeature = (id: string): FeatureInClusterMatch | undefined => {
    const iterator = this.clusterLeaves.entries()

    for (const [key, value] of iterator) {
      const match = value.find(feature => this.getFeatureId(feature) === id)

      if (match) {
        return { clusterId: key, feature: match }
      }
    }
  }

  private featureClickHandler = (e: Event, feature: GeoJSONFeature): void => {
    e.stopPropagation()

    if (!(e.currentTarget instanceof HTMLElement) || this.selectedFeatureId === this.getFeatureId(feature))
      return

    this.setSelectedFeature(feature)

    this.dispatchEvent(new CustomEvent('feature-click', {
      detail: {
        selectedFeature: feature,
      },
    }))
  }

  private resetPinMarker = (): void => {
    if (!this.pinMarker)
      return

    this.pinMarker.remove()
    this.pinMarker = null
  }

  private renderPinMarker = (coords: LngLatLike, offset: Point = new maplibre.Point(0, 0)): void => {
    this.pinMarker = this.opts.pinMarkerRender(coords, offset)
    this.pinMarker.addTo(this.map!)
  }

  private loadClusterLeaves = async (id: string, feature: GeoJSONFeature): Promise<boolean> => {
    try {
      const leaves = await this.source!.getClusterLeaves(
        Number.parseInt(id),
        feature.properties!.point_count,
        0,
      ) as MapGeoJSONFeature[]

      this.clusterLeaves.set(id, leaves)
      return true
    }
    catch (error) {
      console.warn('Error while getClusterLeaves: ', error)
      return false
    }
  }

  private shouldRender = (currentExec: number): boolean => {
    return !!this.map
      && this.map.isSourceLoaded(this.sourceId)
      && !!this.source
      && this.abortExec === currentExec
  }

  private clearRenderState = (): void => {
    this.clusterLeaves.clear()
    this.featuresMap.clear()
  }

  private isClusterFeature = (feature: GeoJSONFeature): boolean => {
    return Boolean(feature.properties?.cluster)
  }

  private getFeatureId = (feature: GeoJSONFeature): string => {
    if (feature.properties.cluster) {
      if (!feature.id)
        throw new Error('Cluster feature is missing "id".')
      return feature.id.toString()
    }

    // Vido support: shouldn't be part of this plugin
    let metadata = feature.properties.metadata

    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata)
      }
      catch {
        metadata = undefined
      }
    }

    return (metadata?.id ?? feature.properties?.id).toString()
  }

  private setSource = (): void => {
    if (!this.map)
      return

    const source = this.map.getSource(this.sourceId)

    if (!source)
      throw new Error(`Source ${this.sourceId} is missing.`)

    if (source.type !== 'geojson')
      throw new Error(`Source ${this.sourceId} is not a GeoJSON.`)

    this.source = source as GeoJSONSource
  }
}
