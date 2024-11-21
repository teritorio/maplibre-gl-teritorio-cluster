import type { FitBoundsOptions, GeoJSONSource, LngLatLike, MapSourceDataEvent } from 'maplibre-gl'
import bbox from '@turf/bbox'
import { featureCollection } from '@turf/helpers'
import { Marker, Point } from 'maplibre-gl'
import { getFeatureId } from './utils/get-feature-id'
import {
  clusterRenderDefault,
  markerRenderDefault,
  pinMarkerRenderDefault,
  unfoldedClusterRenderSmart,
} from './utils/helpers'

type UnfoldedCluster = (
  (
    parent: HTMLDivElement,
    items: GeoJSON.Feature[],
    markerSize: number,
    renderMarker: (feature: GeoJSON.Feature) => HTMLDivElement,
    clickHandler: (e: Event, feature: GeoJSON.Feature) => void
  ) => void
)
type ClusterRender = (
  (
    element: HTMLDivElement,
    props: NonNullable<GeoJSON.GeoJsonProperties>
  ) => void
)
type MarkerRender = (
  (
    element: HTMLDivElement,
    feature: GeoJSON.Feature,
    markerSize: number
  ) => void
)
type PinMarkerRender = (
  (
    coords: LngLatLike,
    offset: Point
  ) => Marker
)
interface FeatureInClusterMatch { clusterId: string, feature: GeoJSON.Feature }
type FeatureMatch = FeatureInClusterMatch | GeoJSON.Feature

const UnfoldedClusterClass = 'teritorio-unfolded-cluster'

export class TeritorioCluster extends EventTarget {
  map: maplibregl.Map
  clusterLeaves: Map<string, GeoJSON.Feature[]>
  clusterMaxZoom: number
  clusterMinZoom: number
  clusterRender?: ClusterRender
  featuresMap: Map<string, GeoJSON.Feature>
  fitBoundsOptions: FitBoundsOptions
  initialFeature?: GeoJSON.Feature
  markerRender?: MarkerRender
  markerSize: number
  markersOnScreen: Map<string, Marker>
  pinMarker: Marker | null
  pinMarkerRender?: PinMarkerRender
  selectedClusterId: string | null
  selectedFeatureId: string | null
  sourceId: string
  ticking: boolean
  unfoldedClusterRender?: UnfoldedCluster
  unfoldedClusterMaxLeaves: number

  constructor(
    map: maplibregl.Map,
    sourceId: string,
    options?: {
      clusterMaxZoom?: number
      clusterMinZoom?: number
      clusterRenderFn?: ClusterRender
      fitBoundsOptions?: FitBoundsOptions
      initialFeature?: GeoJSON.Feature
      markerRenderFn?: MarkerRender
      markerSize?: number
      unfoldedClusterRenderFn?: UnfoldedCluster
      unfoldedClusterMaxLeaves?: number
      pinMarkerRenderFn?: PinMarkerRender
    },
  ) {
    super()

    this.map = map
    this.clusterLeaves = new Map<string, GeoJSON.Feature[]>()
    this.clusterMaxZoom = options?.clusterMaxZoom || 17
    this.clusterMinZoom = options?.clusterMinZoom || 0
    this.clusterRender = options?.clusterRenderFn
    this.featuresMap = new Map<string, GeoJSON.Feature>()
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
    this.ticking = false
    this.unfoldedClusterRender = options?.unfoldedClusterRenderFn
    this.unfoldedClusterMaxLeaves = options?.unfoldedClusterMaxLeaves || 7

    // after the GeoJSON data is loaded, update markers on the screen and do so on every map move/moveend
    map.on('data', (e: MapSourceDataEvent) => {
      if (e.sourceId !== this.sourceId || !e.isSourceLoaded || e.sourceDataType === 'metadata')
        return

      this.#render()
    })

    map.on('moveend', this.#render)
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

  setSelectedFeature = (feature: GeoJSON.Feature): void => {
    const id = getFeatureId(feature)
    const match = this.#findFeature(id)

    if (!match) {
      if (feature.geometry.type !== 'Point') {
        console.error(`Feature ${id} is not of type 'Point', and is not supported.`)
        return
      }

      // Sets a Pin Marker on a specific coordinates which isn't related to any feature from data source
      this.resetSelectedFeature()
      this.selectedFeatureId = id
      this.#renderPinMarker(feature.geometry.coordinates as LngLatLike)

      return
    }

    this.resetSelectedFeature()
    this.selectedFeatureId = id

    if ('type' in match && match.type === 'Feature' && match.geometry.type === 'Point') {
      this.#renderPinMarker(match.geometry.coordinates as LngLatLike)

      return
    }

    if ('feature' in match && match.feature.geometry.type === 'Point') {
      const cluster = this.markersOnScreen.get(match.clusterId)

      if (!cluster) {
        console.error(`Cluster with ID ${match.clusterId} not found.`)
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

    return new Point(x - clusterXCenter + (width / 2), y - clusterYCenter + (height / 2))
  }

  #featureClickHandler = (e: Event, feature: GeoJSON.Feature): void => {
    e.stopPropagation()

    if (!(e.currentTarget instanceof HTMLElement) || this.selectedFeatureId === getFeatureId(feature))
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
      const match = value.find(feature => getFeatureId(feature) === id)

      if (match) {
        return { clusterId: key, feature: match }
      }
    }
  }

  #fitBoundsToClusterLeaves = (features: GeoJSON.Feature[]): void => {
    const bounds = bbox(featureCollection(features))

    this.map.fitBounds(bounds as [number, number, number, number], this.fitBoundsOptions)
  }

  #getClusterCenter = (cluster: HTMLElement): { clusterXCenter: number, clusterYCenter: number } => {
    const { left, right, top, bottom } = cluster.getBoundingClientRect()

    return { clusterXCenter: (left + right) / 2, clusterYCenter: (top + bottom) / 2 }
  }

  #isFeatureInCluster = (clusterId: string, featureId: string): boolean => {
    try {
      const cluster = this.clusterLeaves.get(clusterId)
      if (!cluster || !Array.isArray(cluster)) {
        console.error(`Cluster with ID ${clusterId} not found or is not an array.`)
        return false
      }

      const featureIndex = cluster.findIndex((feature) => {
        try {
          return getFeatureId(feature) === featureId
        }
        catch (error) {
          console.error(`Error getting feature ID for feature:`, feature, error)
          return false
        }
      })

      return featureIndex > -1
    }
    catch (error) {
      console.error(`Error checking if feature ${featureId} is in cluster ${clusterId}:`, error)
      return false
    }
  }

  #render = (): void => {
    if (!this.ticking)
      requestAnimationFrame(this.#updateMarkers)

    this.ticking = true
  }

  #renderCluster = (id: string, props: NonNullable<GeoJSON.GeoJsonProperties>): HTMLDivElement => {
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

  #renderMarker = (feature: GeoJSON.Feature): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = getFeatureId(feature)

    !this.markerRender
      ? markerRenderDefault(element, this.markerSize)
      : this.markerRender(element, feature, this.markerSize)

    return element
  }

  #renderPinMarker = (coords: LngLatLike, offset: Point = new Point(0, 0)): void => {
    this.pinMarker = !this.pinMarkerRender
      ? pinMarkerRenderDefault(coords, offset)
      : this.pinMarkerRender(coords, offset)

    this.pinMarker.addTo(this.map)
  }

  #renderUnfoldedCluster = (id: string, leaves: GeoJSON.Feature[]): HTMLDivElement => {
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

  #updateMarkers = async (): Promise<void> => {
    const newMarkers = new Map<string, Marker>()
    const features = this.map.querySourceFeatures(this.sourceId)
    const maxZoomLimit = this.map.getZoom() >= this.clusterMaxZoom
    const minZoomLimit = this.map.getZoom() >= this.clusterMinZoom

    this.clusterLeaves.clear()
    this.featuresMap.clear()

    for (const feature of features) {
      const id = getFeatureId(feature)

      // Transform to Map in order to have unique features
      this.featuresMap.set(id, feature)

      // Get cluster's leaves
      if (feature.properties.cluster) {
        const source = this.map.getSource(this.sourceId) as GeoJSONSource
        const leaves = await source.getClusterLeaves(Number.parseInt(id), feature.properties.point_count, 0) as GeoJSON.Feature[]
        this.clusterLeaves.set(id, leaves)
      }
    }

    this.featuresMap.forEach((feature) => {
      const coords = feature.geometry.type === 'Point' ? feature.geometry.coordinates as LngLatLike : undefined
      const id = getFeatureId(feature)

      if (!coords) {
        console.error(`Feature ${id} is not Geometry.Point, thus not supported yet.`)
        return
      }

      let marker = this.markersOnScreen.get(id)
      const props = feature.properties

      if (props?.cluster) {
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

          marker = new Marker({ element }).setLngLat(coords).addTo(this.map)

          // If selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if (this.pinMarker && this.selectedFeatureId && this.#isFeatureInCluster(id, this.selectedFeatureId)) {
            this.selectedClusterId = id
            this.#resetPinMarker()
            this.#renderPinMarkerInCluster(element, coords)
          }

          // If initialFeature is part of this new cluster
          // We position the Pin marker on it
          if (this.initialFeature && this.#isFeatureInCluster(id, getFeatureId(this.initialFeature))) {
            this.selectedClusterId = id
            this.selectedFeatureId = getFeatureId(this.initialFeature)
            this.#renderPinMarkerInCluster(element, coords)
            this.initialFeature = undefined
          }
        }
      }
      else {
        if (!marker) {
          const element = this.#renderMarker(feature)

          marker = new Marker({ element }).setLngLat(coords).addTo(this.map)
          element.addEventListener('click', (e: Event) => this.#featureClickHandler(e, feature))

          // Keep Pin Marker on top
          if (this.pinMarker && this.selectedFeatureId === id) {
            this.#resetPinMarker()
            this.#renderPinMarker(coords)
          }

          // If initialFeature is this new marker
          // We position the Pin marker on it
          if (this.initialFeature && (getFeatureId(this.initialFeature) === id)) {
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

    this.markersOnScreen = newMarkers
    this.ticking = false
  }
}
