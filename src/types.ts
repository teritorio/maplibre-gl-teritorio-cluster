import type {
  FitBoundsOptions,
  GeoJSONFeature,
  LngLatLike,
  MapGeoJSONFeature,
  Marker,
  Point,
} from 'maplibre-gl'

/**
 * Defines a function to unfold clusters on the map.
 *
 * @param parent The parent HTML div element to which the cluster content will be appended.
 * @param items An array of GeoJSON features representing the cluster items.
 * @param markerSize The size of the marker to be used in the rendering.
 * @param renderMarker A function that renders a marker for each feature in the cluster.
 * @param clickHandler A function that handles click events on each feature in the cluster.
 */
export type UnfoldedCluster = (
  parent: HTMLDivElement,
  items: MapGeoJSONFeature[],
  markerSize: number,
  renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement,
  clickHandler: (e: Event, feature: MapGeoJSONFeature) => void
) => void

/**
 * Defines a function to render the cluster itself.
 *
 * @param element The HTML div element where the cluster will be rendered.
 * @param props The properties of the GeoJSON feature.
 */
export type ClusterRender = (
  element: HTMLDivElement,
  props: MapGeoJSONFeature['properties']
) => void

/**
 * Defines a function to render a marker based on a GeoJSON feature.
 *
 * @param element The HTML div element where the marker will be rendered.
 * @param markerSize The size of the marker.
 * @param feature Optional GeoJSON feature in order to display some of it's properties.
 */
export type MarkerRender = (
  element: HTMLDivElement,
  markerSize: number,
  feature?: GeoJSONFeature
) => void

/**
 * Defines a function to render a pin marker at specific coordinates.
 *
 * @param coords The coordinates (LngLatLike) where the pin should be placed.
 * @param offset The offset applied to the pin position.
 *
 * @returns A Marker object representing the pin on the map.
 */
export type PinMarkerRender = (
  coords: LngLatLike,
  offset: Point
) => Marker

/**
 * Defines a match object for a feature in a cluster.
 *
 * @param clusterId The unique identifier for the cluster.
 * @param feature The GeoJSON feature associated with this match.
 */
export interface FeatureInClusterMatch {
  clusterId: string
  feature: GeoJSONFeature
}

/**
 * Defines a union type for a feature match, which could either be a feature from a cluster
 * or just a regular GeoJSON feature.
 */
export type FeatureMatch = FeatureInClusterMatch | GeoJSONFeature

/**
 * Options for TeritorioCluster instance.
 *
 * @param clusterMaxZoom The maximum zoom level at which clusters will be rendered.
 * @param clusterMinZoom The minimum zoom level at which clusters will be rendered.
 * @param clusterRender Function to render the cluster.
 * @param fitBoundsOptions Options for fitting the map bounds based on the cluster.
 * @param initialFeature The initial feature to display (optional).
 * @param markerRender Function to render markers for features.
 * @param markerSize Size of the marker to be used.
 * @param unfoldedClusterRender Function to render the unfolded cluster.
 * @param unfoldedClusterMaxLeaves Maximum number of leaves to be shown in the unfolded cluster.
 * @param pinMarkerRender Function to render the pin markers.
 */
export interface TeritorioClusterOptions {
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
