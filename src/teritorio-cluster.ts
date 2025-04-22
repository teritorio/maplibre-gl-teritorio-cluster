import type { FitBoundsOptions, GeoJSONFeature, GeoJSONSource, LngLatLike, MapGeoJSONFeature, Map as MapGL, MapSourceDataEvent, Marker, Point } from 'maplibre-gl'
import bbox from '@turf/bbox'
import { featureCollection } from '@turf/helpers'
import maplibre from 'maplibre-gl'
import {
  clusterRenderDefault,
  markerRenderDefault,
  pinMarkerRenderDefault,
  unfoldedClusterRenderSmart,
} from './utils/helpers'

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
    feature: GeoJSONFeature,
    markerSize: number
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

const UnfoldedClusterClass = 'teritorio-unfolded-cluster'

export class TeritorioCluster extends EventTarget {
  map: MapGL
  clusterLeaves: Map<string, MapGeoJSONFeature[]>
  clusterMaxZoom: number
  clusterMinZoom: number
  clusterRender?: ClusterRender
  featuresMap: Map<string, GeoJSONFeature>
  fitBoundsOptions: FitBoundsOptions
  initialFeature?: MapGeoJSONFeature
  markerRender?: MarkerRender
  markerSize: number
  markersOnScreen: Map<string, Marker>
  pinMarker: Marker | null
  pinMarkerRender?: PinMarkerRender
  selectedClusterId: string | null
  selectedFeatureId: string | null
  sourceId: string
  unfoldedClusterRender?: UnfoldedCluster
  unfoldedClusterMaxLeaves: number
  source?: GeoJSONSource
  #abortExec: number = 0

  constructor(
    map: MapGL,
    sourceId: string,
    options?: {
      clusterMaxZoom?: number
      clusterMinZoom?: number
      clusterRenderFn?: ClusterRender
      fitBoundsOptions?: FitBoundsOptions
      initialFeature?: MapGeoJSONFeature
      markerRenderFn?: MarkerRender
      markerSize?: number
      unfoldedClusterRenderFn?: UnfoldedCluster
      unfoldedClusterMaxLeaves?: number
      pinMarkerRenderFn?: PinMarkerRender
    },
  ) {
    super()

    this.map = map
    this.clusterLeaves = new Map<string, MapGeoJSONFeature[]>()
    this.clusterMaxZoom = options?.clusterMaxZoom || 17
    this.clusterMinZoom = options?.clusterMinZoom || 0
    this.clusterRender = options?.clusterRenderFn
    this.featuresMap = new Map<string, GeoJSONFeature>()
    this.fitBoundsOptions = options?.fitBoundsOptions || { padding: 20 }
    this.initialFeature = options?.initialFeature
    this.markerRender = options?.markerRenderFn
    this.markerSize = options?.markerSize || 24
    this.markersOnScreen = new Map<string, Marker>()
    this.pinMarker = null
    this.pinMarkerRender = options?.pinMarkerRenderFn
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.sourceId = sourceId
    this.unfoldedClusterRender = options?.unfoldedClusterRenderFn
    this.unfoldedClusterMaxLeaves = options?.unfoldedClusterMaxLeaves || 7

    // After the GeoJSON data is loaded, update markers on the screen and do so on every map moveend
    map.on('sourcedata', (ev: MapSourceDataEvent) => {
      if (ev.isSourceLoaded && ev.sourceId === this.sourceId && ev.sourceDataType !== 'metadata') {
        this.#abortExec++
        this.source = this.map.getSource(this.sourceId) as GeoJSONSource
        this.#updateMarkers(this.#abortExec)
      }
    })

    map.on('moveend', () => {
      this.#abortExec++
      this.#updateMarkers(this.#abortExec)
    })
  }

  //
  // Public methods
  //

  resetSelectedFeature = (): void => {
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.#resetPinMarker()
  }

  setBoundsOptions = (options: FitBoundsOptions): void => {
    this.fitBoundsOptions = options
  }

  setSelectedFeature = (feature: GeoJSONFeature): void => {
    const id = this.#getFeatureId(feature)
    const match = this.#findFeature(id)

    if (!match) {
      if (feature.geometry.type !== 'Point') {
        console.error(`Feature ${id} is not Geometry.Point, thus not supported yet.`)
        return
      }

      // Sets a Pin Marker on a specific coordinates which isn't related to any feature from data source
      this.resetSelectedFeature()
      this.selectedFeatureId = id
      this.#renderPinMarker(new maplibre.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]))

      return
    }

    this.resetSelectedFeature()
    this.selectedFeatureId = id

    if ('type' in match && match.type === 'Feature' && match.geometry.type === 'Point') {
      const coords = match.geometry.coordinates

      this.#renderPinMarker(new maplibre.LngLat(coords[0], coords[1]))
    }
    else if ('feature' in match && match.feature.geometry.type === 'Point') {
      const cluster = this.markersOnScreen.get(match.clusterId)

      if (!cluster) {
        console.error(`Cluster ${match.clusterId} not found.`)
        return
      }

      this.selectedClusterId = match.clusterId
      this.#renderPinMarkerInCluster(cluster.getElement(), cluster.getLngLat())
    }
  }

  //
  // Private methods
  //

  #calculatePinMarkerOffset = (cluster: HTMLElement, marker: HTMLElement): Point => {
    const { clusterXCenter, clusterYCenter } = this.#getClusterCenter(cluster)
    const { x, y, height, width } = marker.getBoundingClientRect()

    return new maplibre.Point(x - clusterXCenter + (width / 2), y - clusterYCenter + (height / 2))
  }

  #featureClickHandler = (e: Event, feature: GeoJSONFeature): void => {
    e.stopPropagation()

    if (!(e.currentTarget instanceof HTMLElement) || this.selectedFeatureId === this.#getFeatureId(feature))
      return

    this.setSelectedFeature(feature)

    this.dispatchEvent(new CustomEvent('feature-click', {
      detail: {
        selectedFeature: feature,
      },
    }))
  }

  #findFeature = (id: string): FeatureMatch | undefined => {
    return this.featuresMap.get(id) ?? this.#findClusterizedFeature(id)
  }

  #findClusterizedFeature = (id: string): FeatureInClusterMatch | undefined => {
    const iterator = this.clusterLeaves.entries()

    for (const [key, value] of iterator) {
      const match = value.find(feature => this.#getFeatureId(feature) === id)

      if (match) {
        return { clusterId: key, feature: match }
      }
    }
  }

  #fitBoundsToClusterLeaves = (features: MapGeoJSONFeature[]): void => {
    const bounds = bbox(featureCollection(features))

    this.map.fitBounds(bounds as [number, number, number, number], this.fitBoundsOptions)
  }

  #getClusterCenter = (cluster: HTMLElement): { clusterXCenter: number, clusterYCenter: number } => {
    const { left, right, top, bottom } = cluster.getBoundingClientRect()

    return { clusterXCenter: (left + right) / 2, clusterYCenter: (top + bottom) / 2 }
  }

  #getFeatureId = (feature: GeoJSONFeature): string => {
    if (feature.properties.cluster)
      return feature.id!.toString()

    // Vido support: shouldn't be part of this plugin
    let metadata: { [key: string]: any } | undefined = feature.properties.metadata

    if (typeof metadata === 'string')
      metadata = JSON.parse(metadata)

    return (metadata?.id.toString() || feature.properties.id.toString()) as string
  }

  #isFeatureInCluster = (clusterId: string, featureId: string): boolean => {
    if (!this.clusterLeaves.has(clusterId)) {
      console.error(`Cluster ${clusterId} not found.`)
      return false
    }

    return this.clusterLeaves.get(clusterId)!.findIndex(feature => this.#getFeatureId(feature) === featureId) > -1
  }

  #renderCluster = (id: string, props: MapGeoJSONFeature['properties']): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = id

    !this.clusterRender
      ? clusterRenderDefault(element, props)
      : this.clusterRender(element, props)

    element.addEventListener('click', (e: Event) => {
      e.stopPropagation()

      if (!(e.currentTarget instanceof HTMLElement))
        return

      // Fit map to cluster leaves bounding box
      const leaves = this.clusterLeaves.get(e.currentTarget.id)

      if (leaves)
        this.#fitBoundsToClusterLeaves(leaves)
    })

    return element
  }

  #renderMarker = (feature: GeoJSONFeature): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = this.#getFeatureId(feature)

    !this.markerRender
      ? markerRenderDefault(element, this.markerSize)
      : this.markerRender(element, feature, this.markerSize)

    return element
  }

  #renderPinMarker = (coords: LngLatLike, offset: Point = new maplibre.Point(0, 0)): void => {
    this.pinMarker = !this.pinMarkerRender
      ? pinMarkerRenderDefault(coords, offset)
      : this.pinMarkerRender(coords, offset)

    this.pinMarker.addTo(this.map)
  }

  #renderUnfoldedCluster = (id: string, leaves: MapGeoJSONFeature[]): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = id
    element.classList.add(UnfoldedClusterClass)

    !this.unfoldedClusterRender
      ? unfoldedClusterRenderSmart(element, leaves, this.markerSize, this.#renderMarker, this.#featureClickHandler)
      : this.unfoldedClusterRender(element, leaves, this.markerSize, this.#renderMarker, this.#featureClickHandler)

    return element
  }

  #resetPinMarker = (): void => {
    this.pinMarker?.remove()
    this.pinMarker = null
  }

  #renderPinMarkerInCluster = (cluster: HTMLElement, coords: LngLatLike): void => {
    const isUnfoldedCluster = cluster.classList.contains(UnfoldedClusterClass)

    if (!isUnfoldedCluster) {
      this.#renderPinMarker(coords)
    }
    else {
      // Get selected feature DOM element position within cluster
      const selectedFeatureHTML = Array.from(cluster.children).find(el => el.id === this.selectedFeatureId) as HTMLElement

      if (!selectedFeatureHTML)
        throw new Error('Selected feature HTML marker was not found !')

      this.#renderPinMarker(coords, this.#calculatePinMarkerOffset(cluster, selectedFeatureHTML))
    }
  }

  #updateMarkers = async (updateNb: number): Promise<void> => {
    if (this.#abortExec !== updateNb)
      return

    const newMarkers = new Map<string, Marker>()
    const features = this.map.querySourceFeatures(this.sourceId)
    const maxZoomLimit = this.map.getZoom() >= this.clusterMaxZoom
    const minZoomLimit = this.map.getZoom() >= this.clusterMinZoom

    this.clusterLeaves.clear()
    this.featuresMap.clear()

    for (const feature of features) {
      if (this.#abortExec !== updateNb)
        return

      const id = this.#getFeatureId(feature)

      // Transform to Map in order to have unique features
      this.featuresMap.set(id, feature)

      // Get cluster's leaves
      if (feature.properties.cluster) {
        try {
          const leaves = await this.source?.getClusterLeaves(Number.parseInt(id), feature.properties.point_count, 0) as MapGeoJSONFeature[]

          if (this.#abortExec !== updateNb)
            return

          this.clusterLeaves.set(id, leaves)
        }
        catch (error) {
          console.warn('Error while getClusterLeaves: ', error)
          return
        }
      }
    }

    this.featuresMap.forEach((feature) => {
      const coords = feature.geometry.type === 'Point' ? new maplibre.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]) : undefined
      const id = this.#getFeatureId(feature)

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
          (marker && maxZoomLimit && !marker.getElement().classList.contains(UnfoldedClusterClass))
          || (marker && !maxZoomLimit && marker.getElement().classList.contains(UnfoldedClusterClass) && this.markersOnScreen.has(id))
          || (marker && minZoomLimit && !marker.getElement().classList.contains(UnfoldedClusterClass))
          || (marker && !minZoomLimit && marker.getElement().classList.contains(UnfoldedClusterClass) && this.markersOnScreen.has(id))
        ) {
          marker = undefined
          this.markersOnScreen.get(id)?.remove()
          this.markersOnScreen.delete(id)
        }

        if (!marker) {
          let element: HTMLDivElement | undefined

          if (minZoomLimit && ((leaves.length <= this.unfoldedClusterMaxLeaves) || maxZoomLimit))
            element = this.#renderUnfoldedCluster(id, leaves)
          else
            element = this.#renderCluster(id, props)

          marker = new maplibre.Marker({ element }).setLngLat(coords).addTo(this.map)

          // If selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if (this.pinMarker && this.selectedFeatureId && this.#isFeatureInCluster(id, this.selectedFeatureId)) {
            this.selectedClusterId = id
            this.#resetPinMarker()
            this.#renderPinMarkerInCluster(element, coords)
          }

          // If initialFeature is part of this new cluster
          // We position the Pin marker on it
          if (this.initialFeature && this.#isFeatureInCluster(id, this.#getFeatureId(this.initialFeature))) {
            this.selectedClusterId = id
            this.selectedFeatureId = this.#getFeatureId(this.initialFeature)
            this.#renderPinMarkerInCluster(element, coords)
            this.initialFeature = undefined
          }
        }
      }
      else {
        if (!marker) {
          const element = this.#renderMarker(feature)

          marker = new maplibre.Marker({ element }).setLngLat(coords).addTo(this.map)
          element.addEventListener('click', (e: Event) => this.#featureClickHandler(e, feature))

          // Keep Pin Marker on top
          if (this.pinMarker && this.selectedFeatureId === id) {
            this.#resetPinMarker()
            this.#renderPinMarker(coords)
          }

          // If initialFeature is this new marker
          // We position the Pin marker on it
          if (this.initialFeature && (this.#getFeatureId(this.initialFeature) === id)) {
            this.selectedFeatureId = id
            this.#renderPinMarker(coords)
            this.initialFeature = undefined
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

    if (this.initialFeature && !this.selectedFeatureId && !this.pinMarker) {
      const id = this.#getFeatureId(this.initialFeature)
      const coords = this.initialFeature.geometry.type === 'Point'
        ? new maplibre.LngLat(this.initialFeature.geometry.coordinates[0], this.initialFeature.geometry.coordinates[1])
        : undefined

      if (!coords) {
        console.error(`Coordinates not found for feature id : ${id}`)
        return
      }

      this.selectedFeatureId = id
      this.#renderPinMarker(coords)
      this.initialFeature = undefined
    }

    this.markersOnScreen = newMarkers
  }
}
