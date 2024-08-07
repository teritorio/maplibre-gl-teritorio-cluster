import type { GeoJSONSource, LngLatLike, MapGeoJSONFeature } from 'maplibre-gl'
import { Marker } from 'maplibre-gl'
import { createPinMarker } from './utils/helpers';
import { createDonutChart, createUncluster } from './utils/clusters';

export class UnCluster {
  #clusterLeaves: Map<string, GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[]>
  #map: maplibregl.Map
  #markers: { [key: string]: Marker }
  #markersOnScreen: { [key: string]: Marker }
  #pinMarker: Marker | null
  #selectedClusterId: string | null
  #selectedFeatureId: string | null
  #sourceId: string
  #ticking: boolean

  constructor(map: maplibregl.Map, source: string) {
    this.#clusterLeaves = new Map<string, GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>[]>()
    this.#map = map
    this.#markers = {}
    this.#markersOnScreen = {}
    this.#pinMarker = null
    this.#selectedClusterId = null
    this.#selectedFeatureId = null
    this.#sourceId = source
    this.#ticking = false
  }

  render = () => {
    if (!this.#ticking)
      requestAnimationFrame(this.#updateMarkers)

    this.#ticking = true
  }

  #updateMarkers = async () => {
    const newMarkers: { [key: string]: Marker } = {}
    const features = this.#map.querySourceFeatures(this.#sourceId)
    const featuresMap = new Map<string, MapGeoJSONFeature>()

    this.#clusterLeaves.clear()

    for (const feature of features) {
      // Transform to Map in order to have unique features
      featuresMap.set(feature.id || feature.properties.id, feature)

      // Get cluster's leaves
      if (feature.id) {
        const source = this.#map.getSource(this.#sourceId) as GeoJSONSource
        const leaves = await source.getClusterLeaves(feature.id as number, feature.properties.point_count, 0)
        this.#clusterLeaves.set(feature.id as string, leaves)
      }
    }

    featuresMap.forEach(feature => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates as LngLatLike
      const props = feature.properties;

      if (props.cluster) {
        const id = props.cluster_id;
        let marker = this.#markers[id];

        if (!marker) {
          let element: HTMLDivElement
          const leaves = this.#clusterLeaves.get(id)

          if (leaves && leaves.length <= 5) {
            element = createUncluster(leaves, (e: Event) => this.#featureClickHandler(e, coords, props))
          } else {
            element = createDonutChart(props);
          }

          marker = this.#markers[id] = new Marker({ element }).setLngLat(coords)
        }

        newMarkers[id] = marker

        if (!this.#markersOnScreen[id]) {
          marker.addTo(this.#map);


          // If the previously selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if ((this.#pinMarker && this.#selectedClusterId && this.#selectedFeatureId) && (id == this.#selectedClusterId)) {
            const featureIndex = this.#clusterLeaves.get(id)!.findIndex(f => f.properties?.id == this.#selectedFeatureId)

            if (featureIndex >= -1) {
              // Clear outdated Pin marker
              this.#pinMarker.remove()

              // Get selected feature DOM element position within cluster
              let offset: number = 0
              const { x: clusterX } = marker._pos
              const selectedFeatureHTML = Array.from(marker.getElement().children).find(el => el.id === this.#selectedFeatureId)

              if(selectedFeatureHTML) {
                const { x, width } = selectedFeatureHTML.getBoundingClientRect()
                offset = x - clusterX + (width / 2)
              }

              this.#pinMarker = createPinMarker(marker.getLngLat(), offset).addTo(this.#map)
            }
          }
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
          let coords: LngLatLike
          let offset: number = 0
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
                
                if(selectedFeatureHTML) {
                  const { x, width } = selectedFeatureHTML.getBoundingClientRect()
                  offset = x - clusterX + (width / 2)
                }

                break
              }

              result = iterator.next()
            }
          } else
            coords = (selectedFeature.geometry as GeoJSON.Point).coordinates as LngLatLike

          this.#pinMarker = createPinMarker(coords!, offset).addTo(this.#map)
        }
      }
    }

    this.#markersOnScreen = newMarkers;
    this.#ticking = false
  }

  #featureClickHandler = (e: Event, coords: LngLatLike, props: MapGeoJSONFeature['properties']) => {
    const clickedEl = e.target as HTMLDivElement
    const markerOnScreen = this.#markersOnScreen[props.cluster_id]

    if (!markerOnScreen)
      throw new Error("Marker clicked is not on screen anymore ...")

    // Remove existing pin marker if clicked feature is different
    if ((this.#pinMarker && this.#selectedFeatureId) && this.#selectedFeatureId !== clickedEl.id) {
      this.#pinMarker.remove()
      this.#pinMarker = null
    }

    this.#selectedClusterId = props.cluster_id
    this.#selectedFeatureId = clickedEl.id
    const { x: clusterX } = markerOnScreen._pos
    const { x, width } = clickedEl.getBoundingClientRect()
    const offset = x - clusterX + (width / 2)

    this.#pinMarker = createPinMarker(coords, offset).addTo(this.#map)
  }
}