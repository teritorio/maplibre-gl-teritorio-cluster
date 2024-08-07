import type { LngLatLike } from 'maplibre-gl'
import { Marker } from 'maplibre-gl'

// Helper to apply styles on DOM element
export const buildCss = (htmlEl: HTMLElement, styles: { [key: string]: string }) => {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property]);
}

export function createPinMarker(coords: LngLatLike, offset: number = 0) {
  return new Marker({
    scale: 1.3,
    color: '#f44336',
  }).setLngLat(coords).setOffset([offset, -20])
}