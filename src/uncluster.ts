import type { GeoJSONSource, LngLatLike, MapGeoJSONFeature } from 'maplibre-gl'
import { Marker, Point } from 'maplibre-gl'
import { createMarker } from './utils/helpers';
import { createUnclusterHTML } from './utils/clusters';

export class UnCluster extends EventTarget {  
  map: maplibregl.Map
  
  #clusterLeaves: Map<string, MapGeoJSONFeature[]>
  #clusterMaxZoom: number
  #markers: { [key: string]: Marker }
  #markersOnScreen: { [key: string]: Marker }
  #pinMarker: Marker | null
  #selectedClusterId: string | null
  #selectedFeatureId: string | null
  #sourceId: string
  #ticking: boolean
  #renderDefaultClusterHTML: (props: MapGeoJSONFeature['properties']) => HTMLDivElement
  #renderDefaultMarkerHTML: (feature: MapGeoJSONFeature) => HTMLDivElement

  constructor(
    map: maplibregl.Map,
    source: string,
    options: { clusterMaxZoom: number } = { clusterMaxZoom: 17 },
    renderDefaultClusterHTML: (props: MapGeoJSONFeature['properties']) => HTMLDivElement,
    renderDefaultMarkerHTML: (feature: MapGeoJSONFeature) => HTMLDivElement
  ) {
    super()

    this.map = map

    this.#clusterLeaves = new Map<string, MapGeoJSONFeature[]>()
    this.#clusterMaxZoom = options.clusterMaxZoom,
    this.#markers = {}
    this.#markersOnScreen = {}
    this.#pinMarker = null
    this.#selectedClusterId = null
    this.#selectedFeatureId = null
    this.#sourceId = source
    this.#ticking = false
    this.#renderDefaultClusterHTML = renderDefaultClusterHTML
    this.#renderDefaultMarkerHTML = renderDefaultMarkerHTML
  }

  render = () => {
    if (!this.#ticking)
      requestAnimationFrame(this.#updateMarkers)

    this.#ticking = true
  }

  #getFeatureId = (feature: MapGeoJSONFeature) => {
    if (feature.properties.cluster)
      return feature.id

    // Vido support: shouldn't be part of this plugin
    let metadata: { [key: string]: any } | undefined = feature.properties.metadata

    if (typeof metadata === 'string')
      metadata = JSON.parse(metadata)

    return metadata?.id || feature.properties.id
  }

  #updateMarkers = async () => {
    const newMarkers: { [key: string]: Marker } = {}
    const features = this.map.querySourceFeatures(this.#sourceId)
    const featuresMap = new Map<string, MapGeoJSONFeature>()
    const maxZoomLimit = this.map.getZoom() >= this.#clusterMaxZoom

    this.#clusterLeaves.clear()

    for (const feature of features) {
      const id = this.#getFeatureId(feature)

      // Transform to Map in order to have unique features
      featuresMap.set(id, feature)

      // Get cluster's leaves
      if (feature.properties.cluster) {
        const source = this.map.getSource(this.#sourceId) as GeoJSONSource
        const leaves = await source.getClusterLeaves(id as number, feature.properties.point_count, 0) as MapGeoJSONFeature[]
        this.#clusterLeaves.set(id as string, leaves)
      }
    }

    featuresMap.forEach(feature => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates as LngLatLike
      const props = feature.properties;

      if (props.cluster) {
        const id = props.cluster_id;
        let marker: Marker | undefined = this.#markers[id];

        if (
          (marker && maxZoomLimit && !marker.getElement().classList.contains('uncluster'))
          ||
          (marker && !maxZoomLimit && marker.getElement().classList.contains('uncluster') && this.#markersOnScreen[id])
        ) {
          marker = undefined
          delete this.#markers[id]
          this.#markersOnScreen[id].remove();
          delete this.#markersOnScreen[id]
        }

        if (!marker) {
          let element: HTMLDivElement
          const leaves = this.#clusterLeaves.get(id)

          if (leaves && ((leaves.length <= 5) || maxZoomLimit)) {
            element = createUnclusterHTML(id)

            // Create Uncluster HTML leaves
            leaves.forEach(feature => {
              const featureHTML = this.#renderDefaultMarkerHTML(feature)

              featureHTML.addEventListener('click', (e: Event) => this.#featureClickHandler(e, feature))
              element.append(featureHTML)
            })
          } else {
            // Create default HTML Cluster
            element = this.#renderDefaultClusterHTML(props)
          }
          marker = this.#markers[id] = createMarker(coords, undefined, { element })
        }
        
        newMarkers[id] = marker

        if (!this.#markersOnScreen[id]) {
          marker.addTo(this.map);

          // If selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if ((this.#pinMarker && this.#selectedClusterId && this.#selectedFeatureId) && (id == this.#selectedClusterId)) {
            const featureIndex = this.#clusterLeaves.get(id)!.findIndex(f => f.properties?.id == this.#selectedFeatureId)

            if (featureIndex >= -1) {
              // Clear outdated Pin marker
              this.#pinMarker.remove()

              // Get selected feature DOM element position within cluster
              const { x: clusterX } = marker._pos
              const selectedFeatureHTML = Array.from(marker.getElement().children).find(el => el.id === this.#selectedFeatureId)

              if (!selectedFeatureHTML)
                throw new Error('Selected feature HTML marker was not found !')

              const { x, width } = selectedFeatureHTML.getBoundingClientRect()
              const offset = new Point(x - clusterX + (width / 2), 0)

              this.#pinMarker = createMarker(marker.getLngLat(), offset).addTo(this.map)
            }
          }
        }
      } else {
        const id = this.#getFeatureId(feature)
        let marker = this.#markers[id];

        if (!marker) {
          var element = this.#renderDefaultMarkerHTML(feature)

          marker = this.#markers[id] = createMarker(coords, undefined, { element })
          marker.getElement().addEventListener('click', (e: Event) => this.#featureClickHandler(e, feature))
        }

        newMarkers[id] = marker

        if (!this.#markersOnScreen[id]) {
          marker.addTo(this.map);
        }
      }
    })

    // for every marker we've added previously, remove those that are no longer visible
    for (const id in this.#markersOnScreen) {
      if (!newMarkers[id]) {
        this.#markersOnScreen[id].remove();

        // If the removed cluster had a selected feature in it.
        // We display the Pin marker on it's new position
        if ((this.#pinMarker && this.#selectedClusterId && this.#selectedFeatureId) && (id == this.#selectedClusterId)) {
          let coords: LngLatLike | undefined
          let offset: Point | undefined
          const selectedFeature = featuresMap.get(this.#selectedFeatureId)

          // Clear outdated Pin marker
          this.#pinMarker.remove()

          // If selected feature is in a cluster
          if (!selectedFeature) {
            const iterator = this.#clusterLeaves.entries()
            let result = iterator.next();

            while (!result.done) {
              const [clusterId, leaves] = result.value
              const featureIndex = leaves.findIndex(f => f.properties?.id == this.#selectedFeatureId)

              if (featureIndex > -1) {
                this.#selectedClusterId = clusterId

                // Get selected feature DOM element position within cluster
                const selectedClusterHTML = newMarkers[this.#selectedClusterId]
                const { x: clusterX } = selectedClusterHTML._pos
                coords = selectedClusterHTML.getLngLat()

                const selectedFeatureHTML = selectedClusterHTML.getElement().children[featureIndex]

                if (selectedFeatureHTML) {
                  const { x, width } = selectedFeatureHTML.getBoundingClientRect()
                  offset = new Point(x - clusterX + (width / 2), 0)
                }

                break
              }

              result = iterator.next()
            }
          } else {
            coords = (selectedFeature.geometry as GeoJSON.Point).coordinates as LngLatLike
          }

          if (coords)
            this.#pinMarker = createMarker(coords, offset).addTo(this.map)
        }
      }
    }

    this.#markersOnScreen = newMarkers;
    this.#ticking = false
  }

  #featureClickHandler = (e: Event, feature: MapGeoJSONFeature) => {
    const id = this.#getFeatureId(feature)
    const clickedEl = e.target as HTMLDivElement
    const markerOnScreen = this.#markersOnScreen[id]
    const clusterId = clickedEl.parentElement?.id

    // Remove existing pin marker if clicked feature is different
    if ((this.#pinMarker && this.#selectedFeatureId) && this.#selectedFeatureId !== clickedEl.id) {
      this.#pinMarker.remove()
      this.#pinMarker = null
    }

    // If element is within Uncluster
    if (!markerOnScreen && clusterId) {
      this.#selectedClusterId = clusterId
     
      const { x: clusterX } = this.#markersOnScreen[clusterId]._pos
      const { x, width } = clickedEl.getBoundingClientRect()
      const offset = new Point(x - clusterX + (width / 2), 0)

      this.#pinMarker = createMarker(this.#markersOnScreen[clusterId].getLngLat(), offset).addTo(this.map)
    } else {
      this.#pinMarker = createMarker(markerOnScreen.getLngLat()).addTo(this.map)
    }

    this.#selectedFeatureId = clickedEl.id
    
    this.dispatchEvent(new CustomEvent('click', { detail: { pinMarker: this.#pinMarker, markerId: this.#selectedFeatureId }}))
  }
}