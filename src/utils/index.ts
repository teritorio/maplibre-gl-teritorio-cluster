import type { GeoJSONFeature } from 'maplibre-gl'
import { Point } from 'maplibre-gl'

/**
 * Determines if a given GeoJSON feature is a cluster.
 *
 * A feature is considered a cluster if its properties contain a `cluster` key.
 *
 * @param feature The GeoJSON feature to check.
 *
 * @returns `true` if the feature is a cluster, otherwise `false`.
 */
export function isClusterFeature(feature: GeoJSONFeature): boolean {
  return Boolean(feature.properties?.cluster)
}

/**
 * Retrieves the ID of a feature.
 *
 * If the feature is a cluster, it returns the `id` of the cluster.
 * If the feature is not a cluster, it tries to get the `id` from its metadata or properties.
 *
 * @param feature The GeoJSON feature whose ID is to be retrieved.
 *
 * @returns The `id` of the feature as a string.
 *
 * @throws If the feature is a cluster and lacks an `id`.
 */
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

/**
 * Calculates the offset of a pin marker relative to the cluster's center.
 *
 * This is useful for positioning markers in relation to clusters on a map.
 *
 * @param cluster The HTML element representing the cluster.
 * @param marker The HTML element representing the marker.
 *
 * @returns A `Point` representing the offset of the marker relative to the cluster center.
 */
export function calculatePinMarkerOffset(cluster: HTMLElement, marker: HTMLElement): Point {
  const { clusterXCenter, clusterYCenter } = getClusterCenter(cluster)
  const { x, y, height, width } = marker.getBoundingClientRect()
  return new Point(x - clusterXCenter + width / 2, y - clusterYCenter + height / 2)
}

/**
 * Applies a set of CSS styles to a given HTML element.
 *
 * @param htmlEl The HTML element to apply the styles to.
 * @param styles An object where the keys are CSS property names and the values are the corresponding CSS values.
 */
export function buildCss(htmlEl: HTMLElement, styles: { [key: string]: string }): void {
  const rules = htmlEl.style

  for (const property in styles)
    rules.setProperty(property, styles[property])
}

/**
 * Helper function to get the center coordinates of a cluster.
 *
 * @param cluster The HTML element representing the cluster.
 *
 * @returns An object containing the center coordinates of the cluster: `clusterXCenter` and `clusterYCenter`.
 */
function getClusterCenter(cluster: HTMLElement): {
  clusterXCenter: number
  clusterYCenter: number
} {
  const { left, right, top, bottom } = cluster.getBoundingClientRect()
  return { clusterXCenter: (left + right) / 2, clusterYCenter: (top + bottom) / 2 }
}
