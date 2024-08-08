import type { LngLatLike, MarkerOptions, PointLike } from 'maplibre-gl'
import { Marker } from 'maplibre-gl'

// Helper to apply styles on DOM element
export const buildCss = (htmlEl: HTMLElement, styles: { [key: string]: string }) => {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property]);
}

export function createMarker(
  coords: LngLatLike,
  offset: PointLike = [0, 0],
  options: MarkerOptions = { scale: 1.3, color: '#f44336' }
) {
  return new Marker({ ...options }).setLngLat(coords).setOffset(offset)
}