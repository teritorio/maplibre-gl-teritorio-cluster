import type { FitBoundsOptions, GeoJSONSource, LngLatLike, MapGeoJSONFeature } from 'maplibre-gl'
import { Marker, Point } from 'maplibre-gl'
import {
  clusterRenderDefault,
  markerRenderDefault,
  pinMarkerRenderDefault,
  unfoldedClusterRenderSmart
} from './utils/helpers';
import bbox from '@turf/bbox'
import { featureCollection } from '@turf/helpers'

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
    feature: MapGeoJSONFeature,
    markerSize: number
  ) => void
)
type PinMarkerRender = (
  (
    coords: LngLatLike,
    offset: Point
  ) => Marker
)

const UnfoldedClusterClass = 'teritorio-unfolded-cluster'

export class TeritorioCluster extends EventTarget {
  map: maplibregl.Map
  clusterLeaves: Map<string, MapGeoJSONFeature[]>
  clusterMaxZoom: number
  clusterMinZoom: number
  clusterRender?: ClusterRender
  fitBoundsOptions: FitBoundsOptions
  initialFeature?: MapGeoJSONFeature
  markers: { [key: string]: Marker }
  markerRender?: MarkerRender
  markerSize: number
  markersOnScreen: { [key: string]: Marker }
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
      clusterMaxZoom?: number,
      clusterMinZoom?: number,
      clusterRenderFn?: ClusterRender,
      fitBoundsOptions?: FitBoundsOptions,
      initialFeature?: MapGeoJSONFeature,
      markerRenderFn?: MarkerRender,
      markerSize?: number
      unfoldedClusterRenderFn?: UnfoldedCluster,
      unfoldedClusterMaxLeaves?: number,
      pinMarkerRenderFn?: PinMarkerRender
    }
  ) {
    super()

    this.map = map
    this.clusterLeaves = new Map<string, MapGeoJSONFeature[]>()
    this.clusterMaxZoom = options?.clusterMaxZoom || 17
    this.clusterMinZoom = options?.clusterMinZoom || 0
    this.clusterRender = options?.clusterRenderFn
    this.fitBoundsOptions = options?.fitBoundsOptions || { padding: 20 }
    this.initialFeature = options?.initialFeature
    this.markers = {}
    this.markerRender = options?.markerRenderFn
    this.markerSize = options?.markerSize || 24
    this.markersOnScreen = {}
    this.pinMarker = null
    this.pinMarkerRender = options?.pinMarkerRenderFn
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.sourceId = sourceId
    this.ticking = false
    this.unfoldedClusterRender = options?.unfoldedClusterRenderFn
    this.unfoldedClusterMaxLeaves = options?.unfoldedClusterMaxLeaves || 7

    // after the GeoJSON data is loaded, update markers on the screen and do so on every map move/moveend
    map.on('data', (e: any) => {
      if (e.sourceId !== this.sourceId || !e.isSourceLoaded)
        return

      map.on('move', () => {
        if (e.isSourceLoaded && e.sourceDataType !== 'metadata')
          this.render()
      });

      map.on('moveend', () => {
        if (e.isSourceLoaded && e.sourceDataType !== 'metadata')
          this.render()
      });

      if (e.isSourceLoaded && e.sourceDataType !== 'metadata')
        this.render()
    });
  }

  render = () => {
    if (!this.ticking)
      requestAnimationFrame(this.updateMarkers)

    this.ticking = true
  }

  renderPinMarker = (coords: LngLatLike, offset: Point = new Point(0, 0)) => {
    return !this.pinMarkerRender
      ? pinMarkerRenderDefault(coords, offset)
      : this.pinMarkerRender(coords, offset)
  }

  renderMarker = (feature: MapGeoJSONFeature) => {
    const element = document.createElement('div')
    element.id = this.getFeatureId(feature)

    !this.markerRender
      ? markerRenderDefault(element, this.markerSize)
      : this.markerRender(element, feature, this.markerSize)

    return element
  }

  renderUnfoldedCluster = (id: string, leaves: MapGeoJSONFeature[]) => {
    const element = document.createElement('div')
    element.id = id
    element.classList.add(UnfoldedClusterClass)

    !this.unfoldedClusterRender
      ? unfoldedClusterRenderSmart(element, leaves, this.markerSize, this.renderMarker, this.featureClickHandler)
      : this.unfoldedClusterRender(element, leaves, this.markerSize, this.renderMarker, this.featureClickHandler)

    return element
  }

  renderCluster = (id: string, props: MapGeoJSONFeature['properties']) => {
    const element = document.createElement('div')
    element.id = id

    !this.clusterRender
      ? clusterRenderDefault(element, props)
      : this.clusterRender(element, props)

    element.addEventListener('click', (e: Event) => {
      if (!(e.currentTarget instanceof HTMLElement))
        return

      // Fit map to cluster leaves bounding box
      this._fitBoundsToClusterLeaves(this.clusterLeaves.get(e.currentTarget.id))
    })

    return element;
  }

  resetSelectedFeature = () => {
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.resetPinMarker()
  }

  resetPinMarker = () => {
    this.pinMarker?.remove()
    this.pinMarker = null
  }

  getFeatureId = (feature: MapGeoJSONFeature): string => {
    if (feature.properties.cluster)
      return feature.id!.toString()

    // Vido support: shouldn't be part of this plugin
    let metadata: { [key: string]: any } | undefined = feature.properties.metadata

    if (typeof metadata === 'string')
      metadata = JSON.parse(metadata)

    return (metadata?.id.toString() || feature.properties.id.toString()) as string
  }

  updateMarkers = async () => {
    const newMarkers: { [key: string]: Marker } = {}
    const features = this.map.querySourceFeatures(this.sourceId)
    const featuresMap = new Map<string, MapGeoJSONFeature>()
    const maxZoomLimit = this.map.getZoom() >= this.clusterMaxZoom
    const minZoomLimit = this.map.getZoom() >= this.clusterMinZoom

    this.clusterLeaves.clear()

    for (const feature of features) {
      const id = this.getFeatureId(feature)

      // Transform to Map in order to have unique features
      featuresMap.set(id, feature)

      // Get cluster's leaves
      if (feature.properties.cluster) {
        const source = this.map.getSource(this.sourceId) as GeoJSONSource
        const leaves = await source.getClusterLeaves(Number.parseInt(id), feature.properties.point_count, 0) as MapGeoJSONFeature[]
        this.clusterLeaves.set(id, leaves)
      }
    }

    featuresMap.forEach(feature => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates as LngLatLike
      const props = feature.properties;

      if (props.cluster) {
        const id = props.cluster_id.toString()
        let marker: Marker | undefined = this.markers[id];
        const leaves = this.clusterLeaves.get(id)

        if (!leaves)
          throw new Error('Cluster has no leaves')

        if (
          (marker && maxZoomLimit && !marker.getElement().classList.contains(UnfoldedClusterClass))
          ||
          (marker && !maxZoomLimit && marker.getElement().classList.contains(UnfoldedClusterClass) && this.markersOnScreen[id])
          ||
          (marker && minZoomLimit && !marker.getElement().classList.contains(UnfoldedClusterClass))
          ||
          (marker && !minZoomLimit && marker.getElement().classList.contains(UnfoldedClusterClass) && this.markersOnScreen[id])
        ) {
          marker = undefined
          delete this.markers[id]
          this.markersOnScreen[id]?.remove();
          delete this.markersOnScreen[id]
        }

        if (!marker) {
          let element: HTMLDivElement

          if (leaves && minZoomLimit && ((leaves.length <= this.unfoldedClusterMaxLeaves) || maxZoomLimit)) {
            element = this.renderUnfoldedCluster(id, leaves)
          } else {
            element = this.renderCluster(id, props)
          }

          marker = this.markers[id] = new Marker({ element }).setLngLat(coords)
        }

        newMarkers[id] = marker

        if (!this.markersOnScreen[id]) {
          const clusterHTML = marker.getElement()

          marker.addTo(this.map);

          // If selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if ((this.pinMarker && this.selectedClusterId && this.selectedFeatureId) && (id === this.selectedClusterId)) {
            const featureIndex = this.clusterLeaves.get(id)!.findIndex(f => this.getFeatureId(f) === this.selectedFeatureId)

            if (featureIndex > -1) {
              this.resetPinMarker()
              this._setPinMarker(clusterHTML, marker.getLngLat())
            }
          }

          // If initialFeature is part of this new cluster
          // We position the Pin marker on it
          if (this.initialFeature) {
            const featureId = this.getFeatureId(this.initialFeature)
            const featureIndex = leaves.findIndex(f => this.getFeatureId(f) === featureId)

            if (featureIndex > -1) {
              this.selectedClusterId = id
              this.selectedFeatureId = this.getFeatureId(this.initialFeature)

              this._setPinMarker(clusterHTML, marker.getLngLat())

              this.initialFeature = undefined
            }
          }
        }
      } else {
        const id = this.getFeatureId(feature)
        let marker = this.markers[id];

        if (!marker) {
          var element = this.renderMarker(feature)

          marker = this.markers[id] = new Marker({ element }).setLngLat(coords)
          marker.getElement().addEventListener('click', (e: Event) => this.featureClickHandler(e, feature))
        }

        newMarkers[id] = marker

        if (!this.markersOnScreen[id]) {
          marker.addTo(this.map);

          // If initialFeature is this new marker
          // We position the Pin marker on it
          if (this.initialFeature && (this.getFeatureId(this.initialFeature) === id)) {
            this.selectedFeatureId = id
            this.pinMarker = this.renderPinMarker(marker.getLngLat()).addTo(this.map)
            this.initialFeature = undefined
          }
        }
      }
    })

    // for every marker we've added previously, remove those that are no longer visible
    for (const id in this.markersOnScreen) {
      if (!newMarkers[id]) {
        this.markersOnScreen[id].remove();

        // If the removed cluster had a selected feature in it.
        // We display the Pin marker on it's new position
        if ((this.pinMarker && this.selectedFeatureId) && (id === this.selectedClusterId || id === this.selectedFeatureId)) {
          let coords: LngLatLike | undefined
          let offset: Point | undefined
          const selectedFeature = featuresMap.get(this.selectedFeatureId)

          this.resetPinMarker()

          // If selected feature is in a cluster
          if (!selectedFeature) {
            const iterator = this.clusterLeaves.entries()
            let result = iterator.next();

            while (!result.done) {
              const [clusterId, leaves] = result.value
              const featureIndex = leaves.findIndex(f => this.getFeatureId(f) === this.selectedFeatureId)

              if (featureIndex > -1) {
                this.selectedClusterId = clusterId.toString()

                // Get selected feature DOM element position within cluster
                const cluster = newMarkers[this.selectedClusterId]
                const clusterHTML = cluster.getElement()
                coords = cluster.getLngLat()
                const selectedFeatureHTML = clusterHTML.children[featureIndex] as HTMLElement

                if (selectedFeatureHTML) {
                  offset = this._calculatePinMarkerOffset(clusterHTML, selectedFeatureHTML)
                }

                break
              }

              result = iterator.next()
            }
          } else {
            coords = (selectedFeature.geometry as GeoJSON.Point).coordinates as LngLatLike
          }

          if (coords)
            this.pinMarker = this.renderPinMarker(coords, offset).addTo(this.map)
        }
      }
    }

    this.markersOnScreen = newMarkers;
    this.ticking = false
  }

  featureClickHandler = (e: Event, feature: MapGeoJSONFeature) => {
    e.stopPropagation()

    if (!(e.currentTarget instanceof HTMLElement))
      return

    if (this.selectedFeatureId === e.currentTarget.id)
      return

    const clickedEl = e.currentTarget
    const id = clickedEl.id

    if (this.selectedFeatureId === id)
      return

    this.resetPinMarker()

    if (this.markersOnScreen[id]) {
      this.pinMarker = this.renderPinMarker(this.markersOnScreen[id].getLngLat()).addTo(this.map)
    } else {
      const cluster = this.markersOnScreen[clickedEl.parentElement!.id]
      const clusterHTML = cluster.getElement()

      this.selectedClusterId = clusterHTML.id
      this.pinMarker = this.renderPinMarker(
        cluster.getLngLat(),
        this._calculatePinMarkerOffset(clusterHTML, clickedEl)
      ).addTo(this.map)
    }

    this.selectedFeatureId = id

    const event = new CustomEvent("click", {
      detail: {
        selectedFeature: feature,
      }
    })

    this.dispatchEvent(event)
  }

  _getClusterCenter = (cluster: HTMLElement) => {
    const { left, right, top, bottom } = cluster.getBoundingClientRect()
    return { clusterXCenter: (left + right) / 2, clusterYCenter: (top + bottom) / 2 }
  }

  _calculatePinMarkerOffset = (cluster: HTMLElement, marker: HTMLElement) => {
    const { clusterXCenter, clusterYCenter } = this._getClusterCenter(cluster)
    const { x, y, height, width } = marker.getBoundingClientRect()
    return new Point(x - clusterXCenter + (width / 2), y - clusterYCenter + (height / 2))
  }

  _fitBoundsToClusterLeaves(features?: MapGeoJSONFeature[]) {
    if(!features)
      throw new Error('This cluster has no leaves !')

    const bounds = bbox(featureCollection(features))

    this.map.fitBounds(bounds as [number, number, number, number], this.fitBoundsOptions)
  }

  _setPinMarker = (cluster: HTMLElement, coords: LngLatLike) => {
    const isUnfoldedCluster = cluster.classList.contains(UnfoldedClusterClass)

    if (!isUnfoldedCluster) {
      this.pinMarker = this.renderPinMarker(coords).addTo(this.map)
    } else {
      // Get selected feature DOM element position within cluster
      const selectedFeatureHTML = Array.from(cluster.children).find(el => el.id === this.selectedFeatureId) as HTMLElement

      if (!selectedFeatureHTML)
        throw new Error('Selected feature HTML marker was not found !')

      this.pinMarker = this.renderPinMarker(
        coords,
        this._calculatePinMarkerOffset(cluster, selectedFeatureHTML)
      ).addTo(this.map)
    }
  }
}