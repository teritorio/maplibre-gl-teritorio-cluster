import { Map as MapGL } from 'maplibre-gl'
import { beforeEach, describe, expect, it } from 'vitest'
import { TeritorioCluster } from '../src/index'

describe('teritorio cluster class implementation', () => {
  let map: MapGL
  let teritorioCluster: TeritorioCluster

  beforeEach(() => {
    // Create a mock map
    map = new MapGL({ container: 'map' })

    // Initialize the cluster
    teritorioCluster = new TeritorioCluster(map, 'sourceId')
  })

  it('should initialize with default values', () => {
    expect(teritorioCluster.map).toMatchObject(map)
    expect(teritorioCluster.clusterLeaves).toBeInstanceOf(Map)
    expect(teritorioCluster.clusterLeaves.size).toBe(0)
    expect(teritorioCluster.clusterMaxZoom).toBe(17)
    expect(teritorioCluster.clusterMinZoom).toBe(0)

    // Should have the default render function
    expect(teritorioCluster.clusterRender).toBeUndefined()

    expect(teritorioCluster.featuresMap).toBeInstanceOf(Map)
    expect(teritorioCluster.featuresMap.size).toBe(0)
    expect(teritorioCluster.fitBoundsOptions).toMatchObject({ padding: 20 })
    expect(teritorioCluster.initialFeature).toBeUndefined()

    // Should have the default render function
    expect(teritorioCluster.markerRender).toBeUndefined()

    expect(teritorioCluster.markerSize).toBe(24)
    expect(teritorioCluster.markersOnScreen).toBeInstanceOf(Map)
    expect(teritorioCluster.markersOnScreen.size).toBe(0)
    expect(teritorioCluster.pinMarker).toBeNull()

    // Should have the default render function
    expect(teritorioCluster.pinMarkerRender).toBeUndefined()

    expect(teritorioCluster.selectedClusterId).toBeNull()
    expect(teritorioCluster.selectedFeatureId).toBeNull()
    expect(teritorioCluster.sourceId).toBe('sourceId')

    // Should have the default render function
    expect(teritorioCluster.unfoldedClusterRender).toBeUndefined()

    expect(teritorioCluster.unfoldedClusterMaxLeaves).toBe(7)
  })
})
