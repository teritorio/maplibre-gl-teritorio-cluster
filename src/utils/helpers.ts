import type { LngLatLike, MapGeoJSONFeature, Marker, Point } from 'maplibre-gl'
import maplibre from 'maplibre-gl'
import { buildCss } from './index'

/**
 * Renders an unfolded cluster in a circular shape.
 *
 * The items are positioned on a circle with a calculated radius and angle.
 * Each feature is represented by a marker, and a click event is added to each.
 *
 * @param parent The parent HTML div element where the unfolded cluster will be appended.
 * @param items An array of GeoJSON features to be displayed in the unfolded cluster.
 * @param markerSize The size of each marker.
 * @param renderMarker A function to render a marker for each feature.
 * @param clickHandler A function to handle click events on each feature.
 */
export function unfoldedClusterRenderCircle(parent: HTMLDivElement, items: MapGeoJSONFeature[], markerSize: number, renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement, clickHandler: (e: Event, feature: MapGeoJSONFeature) => void): void {
  const radius = (markerSize / 2) / Math.sin(Math.PI / items.length)
  const angle = 360 / items.length
  let rot = 0

  buildCss(parent, {
    height: `${radius * 2}px`,
    width: `${radius * 2}px`,
  })

  // Position items on circle
  items.forEach((feature) => {
    const featureHTML = renderMarker(feature)

    buildCss(featureHTML, {
      position: 'absolute',
      left: `calc(50% - ${markerSize / 2}px)`,
      top: `calc(50% - ${markerSize / 2}px)`,
      transform: `rotate(${rot * 1}deg) translate(${radius}px) rotate(${rot * -1}deg)`,
    })

    rot += angle

    featureHTML.addEventListener('click', (e: Event) => clickHandler(e, feature))
    parent.append(featureHTML)
  })
}

/**
 * Renders an unfolded cluster in a hexagonal grid shape.
 *
 * The items are positioned in a hexagonal pattern.
 * Each feature is represented by a marker, and a click event is added to each.
 *
 * @param parent The parent HTML div element where the unfolded cluster will be appended.
 * @param items An array of GeoJSON features to be displayed in the unfolded cluster.
 * @param markerSize The size of each marker.
 * @param renderMarker A function to render a marker for each feature.
 * @param clickHandler A function to handle click events on each feature.
 */
export function unfoldedClusterRenderHexaGrid(parent: HTMLDivElement, items: MapGeoJSONFeature[], markerSize: number, renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement, clickHandler: (e: Event, feature: MapGeoJSONFeature) => void): void {
  const radius = (markerSize / 2) / Math.sin(Math.PI / items.length)

  buildCss(parent, {
    height: `${radius * 2}px`,
    width: `${radius * 2}px`,
  })

  // Function inspired from https://stackoverflow.com/questions/2142431/algorithm-for-creating-cells-by-spiral-on-the-hexagonal-field
  function getHexPosition(i: number): { x: number, y: number } {
    let x = 0
    let y = 0

    if (i === 0)
      return { x, y }

    const layer = Math.round(Math.sqrt(i / 3.0))
    const firstIdxInLayer = 3 * layer * (layer - 1) + 1
    const side = Math.floor((i - firstIdxInLayer) / layer)
    const idx = (i - firstIdxInLayer) % layer

    x = layer * Math.cos((side - 1) * Math.PI / 3) + (idx + 1) * Math.cos((side + 1) * Math.PI / 3)
    y = -layer * Math.sin((side - 1) * Math.PI / 3) - (idx + 1) * Math.sin((side + 1) * Math.PI / 3)

    return { x, y }
  }

  // Position items on hexa-grid
  items.forEach((feature, index) => {
    const featureHTML = renderMarker(feature)

    const { x, y } = getHexPosition(index)
    buildCss(featureHTML, {
      position: 'absolute',
      left: `calc(50% - ${markerSize / 2}px)`,
      top: `calc(50% - ${markerSize / 2}px)`,
      transform: `translate(${x * markerSize}px, ${y * markerSize}px)`,
    })

    featureHTML.addEventListener('click', (e: Event) => clickHandler(e, feature))
    parent.append(featureHTML)
  })
}

/**
 * Renders an unfolded cluster in a smart shape based on the number of items.
 *
 * If the number of items is less than or equal to 5, the items will be rendered in a circular shape.
 * Otherwise, they will be rendered in a hexagonal grid shape.
 *
 * @param parent The parent HTML div element where the unfolded cluster will be appended.
 * @param items An array of GeoJSON features to be displayed in the unfolded cluster.
 * @param markerSize The size of each marker.
 * @param renderMarker A function to render a marker for each feature.
 * @param clickHandler A function to handle click events on each feature.
 */
export function unfoldedClusterRenderSmart(parent: HTMLDivElement, items: MapGeoJSONFeature[], markerSize: number, renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement, clickHandler: (e: Event, feature: MapGeoJSONFeature) => void): void {
  if (items.length <= 5) {
    unfoldedClusterRenderCircle(parent, items, markerSize, renderMarker, clickHandler)
  }
  else {
    unfoldedClusterRenderHexaGrid(parent, items, markerSize, renderMarker, clickHandler)
  }
}

/**
 * Renders an unfolded cluster in a grid shape.
 *
 * Positions the items in a flexible, wrap-around layout with a gap between items.
 * Each feature is represented by a marker, and a click event is added to each feature.
 *
 * @param parent The parent HTML div element where the unfolded cluster will be appended.
 * @param items An array of GeoJSON features to be displayed in the unfolded cluster.
 * @param _markerSize The size of each marker.
 * @param renderMarker A function to render a marker for each feature.
 * @param clickHandler A function to handle click events on each feature.
 */
export function unfoldedClusterRenderGrid(parent: HTMLDivElement, items: MapGeoJSONFeature[], _markerSize: number, renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement, clickHandler: (e: Event, feature: MapGeoJSONFeature) => void): void {
  buildCss(parent, {
    'display': 'flex',
    'gap': '2px',
    'flex-wrap': 'wrap',
    'max-width': '150px',
    'cursor': 'pointer',
  })

  // Create Unfolded Cluster HTML leaves
  items.forEach((feature) => {
    const featureHTML = renderMarker(feature)

    featureHTML.addEventListener('click', (e: Event) => clickHandler(e, feature))
    parent.append(featureHTML)
  })
}

/**
 * Renders the default styles for a cluster.
 *
 * The cluster is styled with a circular red background, white text, and centered content.
 *
 * @param element The HTML div element representing the cluster.
 * @param props The properties of the GeoJSON feature associated with the cluster.
 */
export function clusterRenderDefault(element: HTMLDivElement, props: MapGeoJSONFeature['properties']): void {
  element.innerHTML = props.point_count

  buildCss(element, {
    'background-color': 'red',
    'border-radius': '100%',
    'justify-content': 'center',
    'align-items': 'center',
    'display': 'flex',
    'color': 'white',
    'width': '38px',
    'height': '38px',
    'cursor': 'pointer',
  })
}

/**
 * Renders the default styles for a single marker.
 *
 * The marker is styled with a blue background, white text, and centered content.
 *
 * @param element The HTML div element representing the marker.
 * @param markerSize The size of the marker.
 */
export function markerRenderDefault(element: HTMLDivElement, markerSize: number): void {
  buildCss(element, {
    'background-color': 'blue',
    'border-radius': '100%',
    'justify-content': 'center',
    'align-items': 'center',
    'display': 'flex',
    'color': 'white',
    'width': `${markerSize}px`,
    'height': `${markerSize}px`,
    'cursor': 'pointer',
  })
}

/**
 * Renders a pin marker at specified coordinates.
 *
 * The pin marker is positioned based on the provided coordinates and offset.
 *
 * @param coords The coordinates (LngLatLike) where the pin marker should be placed.
 * @param offset The offset applied to the pin position.
 *
 * @returns A Marker object representing the pin marker on the map.
 */
export function pinMarkerRenderDefault(coords: LngLatLike, offset: Point = new maplibre.Point(0, 0)): Marker {
  return new maplibre.Marker({ anchor: 'bottom' }).setLngLat(coords).setOffset(offset)
}
