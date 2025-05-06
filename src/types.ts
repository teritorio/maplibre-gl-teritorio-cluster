import type {
  FitBoundsOptions,
  GeoJSONFeature,
  LngLatLike,
  MapGeoJSONFeature,
  Marker,
  Point,
} from 'maplibre-gl'

export type UnfoldedCluster = (
  parent: HTMLDivElement,
  items: MapGeoJSONFeature[],
  markerSize: number,
  renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement,
  clickHandler: (e: Event, feature: MapGeoJSONFeature) => void
) => void

export type ClusterRender = (
  element: HTMLDivElement,
  props: MapGeoJSONFeature['properties']
) => void

export type MarkerRender = (
  element: HTMLDivElement,
  markerSize: number,
  feature?: GeoJSONFeature
) => void

export type PinMarkerRender = (
  coords: LngLatLike,
  offset: Point
) => Marker

export interface FeatureInClusterMatch {
  clusterId: string
  feature: GeoJSONFeature
}

export type FeatureMatch = FeatureInClusterMatch | GeoJSONFeature

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
