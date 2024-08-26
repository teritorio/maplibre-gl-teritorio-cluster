import type { LngLatLike, MapGeoJSONFeature } from 'maplibre-gl'
import { Marker, Point } from 'maplibre-gl'

// Helper to apply styles on DOM element
export const buildCss = (htmlEl: HTMLElement, styles: { [key: string]: string }) => {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property]);
}

// Circle shape
export const displayUnclusterInCircle = (
  parent: HTMLDivElement,
  items: MapGeoJSONFeature[],
  itemSize: number,
  renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement,
  clickHandler: (e: Event, feature: MapGeoJSONFeature) => void
) => {
  const radius = (itemSize / 2) / Math.sin(Math.PI / items.length)
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
      'display': 'block',
      'height': `${itemSize}px`,
      'left': '50%',
      'line-height': `${itemSize}px`,
      'margin': `-${itemSize / 2}px`,
      'position': 'absolute',
      'text-align': 'center',
      'top': '50%',
      'width': `${itemSize}px`,
    })

    buildCss(featureHTML, {
      'transform': `rotate(${rot * 1}deg) translate(${radius}px) rotate(${rot * -1}deg)`
    })

    rot += angle

    featureHTML.addEventListener('click', (e) => clickHandler(e, feature))
    parent.append(featureHTML)
  })
}

// Uncluster default styles
export const displayUnclusterDefault = (
  parent: HTMLDivElement,
  items: MapGeoJSONFeature[],
  renderMarker: (feature: MapGeoJSONFeature) => HTMLDivElement,
  clickHandler: (e: Event, feature: MapGeoJSONFeature) => void
) => {
  buildCss(parent, {
    'display': 'flex',
    'gap': '2px',
    'flex-wrap': 'wrap',
    'max-width': '200px',
    'cursor': 'pointer'
  })

  // Create Uncluster HTML leaves
  items.forEach(feature => {
    const featureHTML = renderMarker(feature)

    featureHTML.addEventListener('click', (e: Event) => clickHandler(e, feature))
    parent.append(featureHTML)
  })
}

// Cluster default styles
export const displayClusterDefault = (
  element: HTMLDivElement,
  props: MapGeoJSONFeature['properties'],
  size: number
) => {
  element.innerHTML = props.point_count

  buildCss(element, {
    'background-color': 'red',
    'border-radius': '100%',
    'justify-content': 'center',
    'align-items': 'center',
    'display': 'flex',
    'color': 'white',
    'width': `${size}px`,
    'height': `${size}px`,
    'cursor': 'pointer'
  });
}

// Single Marker default styles
export const displayMarkerDefault = (element: HTMLDivElement, size: number) => {
  buildCss(element, {
    'background-color': 'blue',
    'border-radius': '100%',
    'justify-content': 'center',
    'align-items': 'center',
    'display': 'flex',
    'color': 'white',
    'width': `${size}px`,
    'height': `${size}px`,
    'cursor': 'pointer'
  });
}

export const displayPinMarkerDefault = (coords: LngLatLike, offset: Point = new Point(0, 0)) => {
  return new Marker({ anchor: 'bottom' }).setLngLat(coords).setOffset(offset)
}