export const getFeatureId = (feature: GeoJSON.Feature): string => {
  try {
    if (!feature.properties) {
      throw new Error('Feature properties are null or undefined')
    }

    if (feature.properties.cluster) {
      if (!feature.id) {
        throw new Error('Feature is a cluster but is missing property id')
      }
      return feature.id.toString()
    }

    // Vido support: shouldn't be part of this plugin
    if (!feature.properties.metadata || typeof feature.properties.metadata !== 'string') {
      if (!feature.properties.id) {
        throw new Error('Feature property id is missing')
      }
      return feature.properties.id.toString()
    }

    const metadata = JSON.parse(feature.properties.metadata)
    if (!metadata.id) {
      throw new Error('Feature properties metadata id is missing')
    }

    return metadata.id.toString()
  } catch (error) {
    console.error("Error in getFeatureId: ", error);

    return feature.id?.toString() || 'unknown'
  }
}