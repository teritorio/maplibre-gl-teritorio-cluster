import type { LngLatLike, MapGeoJSONFeature } from 'maplibre-gl'
import { Marker, Point } from 'maplibre-gl'

// Helper to apply styles on DOM element
export function buildCss(htmlEl: HTMLElement, styles: { [key: string]: string }): void {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property])
}

// Circle shape
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

// HexaGrid shape
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

// Smart: mix between Circle and HexaGrid shape
export function unfoldedClusterRenderSmart(parent: HTMLDivElement, items: MapGeoJSONFeature[], markerSize: number, renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement, clickHandler: (e: Event, feature: MapGeoJSONFeature) => void): void {
  if (items.length <= 5) {
    unfoldedClusterRenderCircle(parent, items, markerSize, renderMarker, clickHandler)
  }
  else {
    unfoldedClusterRenderHexaGrid(parent, items, markerSize, renderMarker, clickHandler)
  }
}

// Grid shape
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

// Cluster default styles
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

// Single Marker default styles
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

// Pin Marker default styles
export function pinMarkerRenderDefault(coords: LngLatLike, offset: Point = new Point(0, 0)): Marker {
  return new Marker({ anchor: 'bottom' }).setLngLat(coords).setOffset(offset)
}
