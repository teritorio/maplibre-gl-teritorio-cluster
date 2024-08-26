import type { GeoJSONSource, LngLatLike, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl'
import { Marker, Point } from 'maplibre-gl'
import {
  displayPinMarkerDefault,
  displayUnclusterInCircle,
  displayUnclusterDefault,
  displayMarkerDefault,
  displayClusterDefault
} from './utils/helpers';

type UnClusterMode = 'default' | 'circle'
type ClusterMode = 'default' | ((element: HTMLDivElement, props: MapGeoJSONFeature['properties'], size?: number) => void)
type MarkerMode = 'default' | ((element: HTMLDivElement, feature: MapGeoJSONFeature, size?: number) => void)
type PinMarkerMode = 'default' | ((coords: LngLatLike, offset: Point) => Marker)

export class UnCluster extends EventTarget {
  map: maplibregl.Map
  clusterLeaves: Map<string, MapGeoJSONFeature[]>
  clusterMaxZoom: number
  clusterMode: ClusterMode
  clusterSize: number
  markers: { [key: string]: Marker }
  markerMode: MarkerMode
  markersOnScreen: { [key: string]: Marker }
  markerSize: number
  pinMarker: Marker | null
  pinMarkerMode: PinMarkerMode
  selectedClusterId: string | null
  selectedFeatureId: string | null
  sourceId: string
  ticking: boolean
  unClusterMode: UnClusterMode

  constructor(
    map: maplibregl.Map,
    source: string,
    options: {
      clusterMaxZoom?: number,
      clusterMode?: ClusterMode,
      clusterSize?: number
      markerMode?: MarkerMode,
      markerSize?: number,
      unClusterMode?: UnClusterMode,
      pinMarkerMode?: PinMarkerMode
    }
  ) {
    super()

    this.map = map
    this.clusterLeaves = new Map<string, MapGeoJSONFeature[]>()
    this.clusterMaxZoom = options.clusterMaxZoom || 17
    this.clusterMode = options.clusterMode || 'default'
    this.clusterSize = options.clusterSize || 38
    this.markers = {}
    this.markerMode = options.markerMode || 'default'
    this.markersOnScreen = {}
    this.markerSize = options.markerSize || 24
    this.pinMarker = null
    this.pinMarkerMode = options.pinMarkerMode || 'default'
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.sourceId = source
    this.ticking = false
    this.unClusterMode = options.unClusterMode || 'default'

    this.map.on('click', this.onClick)
  }

  onClick = (e: MapMouseEvent) => {
    console.log('click', e)
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.pinMarker?.remove()
    this.pinMarker = null
  }

  render = () => {
    if (!this.ticking)
      requestAnimationFrame(this.updateMarkers)

    this.ticking = true
  }

  renderPinMarker = (coords: LngLatLike, offset: Point = new Point(0, 0)) => {
    if (this.pinMarkerMode === 'default')
      return displayPinMarkerDefault(coords, offset)
    else
      return this.pinMarkerMode(coords, offset)
  }

  renderMarker = (feature: MapGeoJSONFeature) => {
    const element = document.createElement('div')
    element.id = this.getFeatureId(feature)

    if (this.markerMode === 'default')
      displayMarkerDefault(element, this.markerSize)
    else
      this.markerMode(element, feature, this.markerSize)

    return element
  }

  renderUncluster = (id: string, leaves: MapGeoJSONFeature[]) => {
    const element = document.createElement('div')
    element.id = id
    element.classList.add('uncluster')

    switch (this.unClusterMode) {
      case 'circle':
        displayUnclusterInCircle(element, leaves, this.markerSize, this.renderMarker, this.featureClickHandler)
        break
      default:
        displayUnclusterDefault(element, leaves, this.renderMarker, this.featureClickHandler)
        break
    }

    return element
  }

  renderCluster = (props: MapGeoJSONFeature['properties']) => {
    const element = document.createElement('div')

    if (this.clusterMode === 'default')
      displayClusterDefault(element, props, this.clusterSize)
    else
      this.clusterMode(element, props)

    return element;
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

        if (
          (marker && maxZoomLimit && !marker.getElement().classList.contains('uncluster'))
          ||
          (marker && !maxZoomLimit && marker.getElement().classList.contains('uncluster') && this.markersOnScreen[id])
        ) {
          marker = undefined
          delete this.markers[id]
          this.markersOnScreen[id].remove();
          delete this.markersOnScreen[id]
        }

        if (!marker) {
          let element: HTMLDivElement
          const leaves = this.clusterLeaves.get(id)

          if (leaves && ((leaves.length <= 5) || maxZoomLimit)) {
            element = this.renderUncluster(id, leaves)
          } else {
            // Create default HTML Cluster
            element = this.renderCluster(props)
          }
          marker = this.markers[id] = new Marker({ element }).setLngLat(coords)
        }

        newMarkers[id] = marker

        if (!this.markersOnScreen[id]) {
          marker.addTo(this.map);

          // If selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if ((this.pinMarker && this.selectedClusterId && this.selectedFeatureId) && (id === this.selectedClusterId)) {
            const featureIndex = this.clusterLeaves.get(id)!.findIndex(f => f.properties?.id === this.selectedFeatureId)

            if (featureIndex > -1) {
              // Clear outdated Pin marker
              this.pinMarker.remove()

              // Get selected feature DOM element position within cluster
              const { x: clusterX, y: clusterY } = marker._pos
              const selectedFeatureHTML = Array.from(marker.getElement().children).find(el => el.id === this.selectedFeatureId)

              if (!selectedFeatureHTML)
                throw new Error('Selected feature HTML marker was not found !')

              const { x, y, height, width } = selectedFeatureHTML.getBoundingClientRect()
              const offset = new Point(x - clusterX + (width / 2), y - clusterY + (height / 2))

              this.pinMarker = this.renderPinMarker(marker.getLngLat(), offset).addTo(this.map)
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
        }
      }
    })

    // for every marker we've added previously, remove those that are no longer visible
    for (const id in this.markersOnScreen) {
      if (!newMarkers[id]) {
        this.markersOnScreen[id].remove();

        // If the removed cluster had a selected feature in it.
        // We display the Pin marker on it's new position
        if ((this.pinMarker && this.selectedClusterId && this.selectedFeatureId) && (id === this.selectedClusterId || id === this.selectedFeatureId)) {
          let coords: LngLatLike | undefined
          let offset: Point | undefined
          const selectedFeature = featuresMap.get(this.selectedFeatureId)

          // Clear outdated Pin marker
          this.pinMarker.remove()

          // If selected feature is in a cluster
          if (!selectedFeature) {
            const iterator = this.clusterLeaves.entries()
            let result = iterator.next();

            while (!result.done) {
              const [clusterId, leaves] = result.value
              const featureIndex = leaves.findIndex(f => f.properties?.id === this.selectedFeatureId)

              if (featureIndex > -1) {
                this.selectedClusterId = clusterId.toString()

                // Get selected feature DOM element position within cluster
                const selectedClusterHTML = newMarkers[this.selectedClusterId]
                const { x: clusterX, y: clusterY } = selectedClusterHTML._pos
                coords = selectedClusterHTML.getLngLat()

                const selectedFeatureHTML = selectedClusterHTML.getElement().children[featureIndex]

                if (selectedFeatureHTML) {
                  const { x, y, height, width } = selectedFeatureHTML.getBoundingClientRect()
                  offset = new Point(x - clusterX + (width / 2), y - clusterY + (height / 2))
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

      // Keeps Pin Marker over cluster / single markers
      if (this.pinMarker && this.selectedClusterId && this.selectedFeatureId) {
        this.pinMarker.remove()
        this.pinMarker.addTo(this.map)
      }
    }

    this.markersOnScreen = newMarkers;
    this.ticking = false
  }

  featureClickHandler = (e: Event, feature: MapGeoJSONFeature) => {
    e.stopPropagation()
    const id = this.getFeatureId(feature)
    const clickedEl = e.currentTarget as HTMLDivElement
    const markerOnScreen = this.markersOnScreen[id]
    const clusterId = clickedEl.parentElement?.id

    // Remove existing pin marker if clicked feature is different
    if (this.pinMarker && this.selectedFeatureId) {
      if (this.selectedFeatureId === clickedEl.id)
        return

      this.pinMarker.remove()
      this.pinMarker = null
    }

    // If element is within Uncluster
    if (!markerOnScreen && clusterId) {
      this.selectedClusterId = clusterId

      const { x: clusterX, y: clusterY } = this.markersOnScreen[clusterId]._pos
      const { x, y, height, width } = clickedEl.getBoundingClientRect()
      const offset = new Point(x - clusterX + (width / 2), y - clusterY + (height / 2))

      this.pinMarker = this.renderPinMarker(this.markersOnScreen[clusterId].getLngLat(), offset).addTo(this.map)
    } else {
      this.pinMarker = this.renderPinMarker(markerOnScreen.getLngLat()).addTo(this.map)
    }

    this.selectedFeatureId = clickedEl.id

    const event = new CustomEvent("teritorioClick", {
      detail: {
        selectedFeature: feature,
      }
    })

    this.dispatchEvent(event)
  }
}