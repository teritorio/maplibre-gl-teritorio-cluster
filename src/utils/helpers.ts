import type { LngLatLike, MapGeoJSONFeature } from 'maplibre-gl'
import { Marker, Point } from 'maplibre-gl'

// Helper to apply styles on DOM element
export const buildCss = (htmlEl: HTMLElement, styles: { [key: string]: string }) => {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property]);
}

// Circle shape
export const unfoldedClusterRenderCircle = (
  parent: HTMLDivElement,
  items: MapGeoJSONFeature[],
  markerSize: number,
  renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement,
  clickHandler: (e: Event, feature: MapGeoJSONFeature) => void
): void => {
  const radius = (markerSize / 2) / Math.sin(Math.PI / items.length)
  let angle = 360 / items.length
  let rot = 0

  buildCss(parent, {
    'height': `${radius * 2}px`,
    'width': `${radius * 2}px`,
  })

  // Position items on circle
  items.forEach((feature) => {
    const featureHTML = renderMarker(feature)

    buildCss(featureHTML, {
      'position': 'absolute',
      'left': `calc(50% - ${markerSize / 2}px)`,
      'top': `calc(50% - ${markerSize / 2}px)`,
      'transform': `rotate(${rot * 1}deg) translate(${radius}px) rotate(${rot * -1}deg)`,
      'transform-origin': 'center'
    })

    rot += angle

    featureHTML.addEventListener('click', (e) => clickHandler(e, feature))
    parent.append(featureHTML)
  })
}

// Unfolded Cluster default styles
export const unfoldedClusterRenderDefault = (
  parent: HTMLDivElement,
  items: MapGeoJSONFeature[],
  renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement,
  clickHandler: (e: Event, feature: MapGeoJSONFeature) => void
): void => {
  buildCss(parent, {
    'display': 'flex',
    'gap': '2px',
    'flex-wrap': 'wrap',
    'max-width': '200px',
    'cursor': 'pointer'
  })

  // Create Unfolded Cluster HTML leaves
  items.forEach(feature => {
    const featureHTML = renderMarker(feature)

    featureHTML.addEventListener('click', (e: Event) => clickHandler(e, feature))
    parent.append(featureHTML)
  })
}

// Cluster default styles
export const clusterRenderDefault = (
  element: HTMLDivElement,
  props: MapGeoJSONFeature['properties']
): void => {
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
    'cursor': 'pointer'
  });
}

// Single Marker default styles
export const markerRenderDefault = (
  element: HTMLDivElement,
  markerSize: number
): void => {
  buildCss(element, {
    'background-color': 'blue',
    'border-radius': '100%',
    'justify-content': 'center',
    'align-items': 'center',
    'display': 'flex',
    'color': 'white',
    'width': `${markerSize}px`,
    'height': `${markerSize}px`,
    'cursor': 'pointer'
  });
}

// Pin Marker default styles
export const pinMarkerRenderDefault = (
  coords: LngLatLike,
  offset: Point = new Point(0, 0)
): Marker => {
  return new Marker({ anchor: 'bottom' }).setLngLat(coords).setOffset(offset)
}