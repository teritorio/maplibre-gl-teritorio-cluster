import type { GeoJSONFeature, Point } from 'maplibre-gl'
import maplibre from 'maplibre-gl'

export function isClusterFeature(feature: GeoJSONFeature): boolean {
  return Boolean(feature.properties?.cluster)
}

export function getFeatureId(feature: GeoJSONFeature): string {
  if (feature.properties.cluster) {
    if (!feature.id)
      throw new Error('Cluster feature is missing "id".')
    return feature.id.toString()
  }

  // Vido support: shouldn't be part of this plugin
  let metadata = feature.properties.metadata
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata)
    }
    catch {
      metadata = undefined
    }
  }

  return (metadata?.id ?? feature.properties?.id).toString()
}

export function calculatePinMarkerOffset(cluster: HTMLElement, marker: HTMLElement): Point {
  const { clusterXCenter, clusterYCenter } = getClusterCenter(cluster)
  const { x, y, height, width } = marker.getBoundingClientRect()
  return new maplibre.Point(x - clusterXCenter + width / 2, y - clusterYCenter + height / 2)
}

// Helper to apply styles on DOM element
export function buildCss(htmlEl: HTMLElement, styles: { [key: string]: string }): void {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property])
}

function getClusterCenter(cluster: HTMLElement): {
  clusterXCenter: number
  clusterYCenter: number
} {
  const { left, right, top, bottom } = cluster.getBoundingClientRect()
  return { clusterXCenter: (left + right) / 2, clusterYCenter: (top + bottom) / 2 }
}
