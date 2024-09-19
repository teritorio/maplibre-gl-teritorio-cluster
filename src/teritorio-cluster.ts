import type { GeoJSONSource, LngLatLike, MapGeoJSONFeature } from 'maplibre-gl'
import { Marker, Point } from 'maplibre-gl'
import {
  clusterRenderDefault,
  markerRenderDefault,
  pinMarkerRenderDefault,
  unfoldedClusterRenderSmart
} from './utils/helpers';

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
  clusterRender?: ClusterRender
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
    source: string,
    options?: {
      clusterMaxZoom?: number,
      clusterRenderFn?: ClusterRender,
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
    this.clusterRender = options?.clusterRenderFn
    this.initialFeature = options?.initialFeature
    this.markers = {}
    this.markerRender = options?.markerRenderFn
    this.markerSize = options?.markerSize || 24
    this.markersOnScreen = {}
    this.pinMarker = null
    this.pinMarkerRender = options?.pinMarkerRenderFn
    this.selectedClusterId = null
    this.selectedFeatureId = null
    this.sourceId = source
    this.ticking = false
    this.unfoldedClusterRender = options?.unfoldedClusterRenderFn
    this.unfoldedClusterMaxLeaves = options?.unfoldedClusterMaxLeaves || 7

    // after the GeoJSON data is loaded, update markers on the screen and do so on every map move/moveend
    map.on('data', (e: any) => {
      if (e.sourceId !== this.sourceId || !e.isSourceLoaded)
        return

      map.on('move', this.render);
      map.on('moveend', this.render);

      this.render()
    });

    this.map.on('click', () => {
      this.selectedClusterId = null
      this.selectedFeatureId = null
      this.pinMarker?.remove()
      this.pinMarker = null
    })
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

  renderCluster = (props: MapGeoJSONFeature['properties']) => {
    const element = document.createElement('div')

    !this.clusterRender
      ? clusterRenderDefault(element, props)
      : this.clusterRender(element, props)

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
        const leaves = this.clusterLeaves.get(id)

        if(!leaves)
          throw new Error('Cluster has no leaves')

        if (
          (marker && maxZoomLimit && !marker.getElement().classList.contains(UnfoldedClusterClass))
          ||
          (marker && !maxZoomLimit && marker.getElement().classList.contains(UnfoldedClusterClass) && this.markersOnScreen[id])
        ) {
          marker = undefined
          delete this.markers[id]
          this.markersOnScreen[id].remove();
          delete this.markersOnScreen[id]
        }

        if (!marker) {
          let element: HTMLDivElement

          if (leaves && ((leaves.length <= this.unfoldedClusterMaxLeaves) || maxZoomLimit)) {
            element = this.renderUnfoldedCluster(id, leaves)
          } else {
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
            const featureIndex = this.clusterLeaves.get(id)!.findIndex(f => this.getFeatureId(f) === this.selectedFeatureId)

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

          // If initialFeature is part of this new cluster
          // We position the Pin marker on it
          if(this.initialFeature) {
            const featureId = this.getFeatureId(this.initialFeature)
            const featureIndex = leaves.findIndex(f => this.getFeatureId(f) === featureId)
            
            if(featureIndex > -1) {
              const isUnfoldedCluster = marker.getElement().classList.contains(UnfoldedClusterClass)
              
              this.selectedClusterId = id
              this.selectedFeatureId = this.getFeatureId(this.initialFeature)

              if(!isUnfoldedCluster) {
                this.pinMarker = this.renderPinMarker(marker.getLngLat()).addTo(this.map)
              } else {
                const { x: clusterX, y: clusterY } = marker._pos
                const selectedFeatureHTML = Array.from(marker.getElement().children).find(el => el.id === this.selectedFeatureId)

                if (!selectedFeatureHTML)
                  throw new Error('Selected feature HTML marker was not found !')
  
                const { x, y, height, width } = selectedFeatureHTML.getBoundingClientRect()
                const offset = new Point(x - clusterX + (width / 2), y - clusterY + (height / 2))
  
                this.pinMarker = this.renderPinMarker(marker.getLngLat(), offset).addTo(this.map)
              }

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
          if(this.initialFeature && (this.getFeatureId(this.initialFeature) === id)) {
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

          // Clear outdated Pin marker
          this.pinMarker.remove()

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

    // If element is within Unfolded Cluster
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

    const event = new CustomEvent("click", {
      detail: {
        selectedFeature: feature,
      }
    })

    this.dispatchEvent(event)
  }
}