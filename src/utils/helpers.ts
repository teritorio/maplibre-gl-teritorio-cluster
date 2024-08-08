import type { LngLatLike, MarkerOptions } from 'maplibre-gl'
import { Marker } from 'maplibre-gl'

// Helper to apply styles on DOM element
export const buildCss = (htmlEl: HTMLElement, styles: { [key: string]: string }) => {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property]);
}

export function createPinMarker(
  coords: LngLatLike,
  offset: number = 0,
  options: MarkerOptions = { scale: 1.3, color: '#f44336' }
) {
  return new Marker({ ...options }).setLngLat(coords).setOffset([offset, -20])
}