import maplibre from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { TeritorioCluster } from '../src/index'

describe('teritorio cluster class implementation', () => {
  it('should call onAdd when map.addLayer is used', () => {
    const map = new maplibre.Map({ container: 'map' })

    map.on('load', () => {
      map.addSource('earthquakes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: true,
        clusterRadius: 80,
        clusterMaxZoom: 22,
        maxzoom: 24,
      })

      const teritorioLayer = new TeritorioCluster(
        'layerId',
        'sourceId',
        {
          clusterRender: vi.fn(),
          markerRender: vi.fn(),
          unfoldedClusterRender: vi.fn(),
          pinMarkerRender: vi.fn(),
        },
      )
      const onAddSpy = vi.spyOn(teritorioLayer, 'onAdd')

      map.addLayer(teritorioLayer)

      expect(onAddSpy).toHaveBeenCalledOnce()
      expect(onAddSpy).toHaveBeenCalledWith(map)
    })
  })

  it('should initialize with default values', () => {
    const teritorioCluster = new TeritorioCluster('layerId', 'sourceId')
    const opts = teritorioCluster.getOptionsForTesting()

    expect(teritorioCluster.id).toBe('layerId')
    expect(opts.clusterMaxZoom).toBe(17)
    expect(opts.clusterMinZoom).toBe(0)
    expect(opts.markerSize).toBe(24)
    expect(opts.unfoldedClusterMaxLeaves).toBe(7)
    expect(opts.fitBoundsOptions).toEqual({ padding: 20 })
    expect(opts.initialFeature).toBeUndefined()
    expect(typeof opts.clusterRender).toBe('function')
    expect(typeof opts.markerRender).toBe('function')
    expect(typeof opts.pinMarkerRender).toBe('function')
    expect(typeof opts.unfoldedClusterRender).toBe('function')
  })

  it('should initialize with user values', () => {
    const teritorioCluster = new TeritorioCluster(
      'layerId',
      'sourceId',
      {
        clusterMaxZoom: 22,
        clusterMinZoom: 2,
        clusterRender: vi.fn(),
        fitBoundsOptions: { padding: { top: 57, bottom: 20, left: 20, right: 20 } },
        markerRender: vi.fn(),
        markerSize: 28,
        unfoldedClusterRender: vi.fn(),
        unfoldedClusterMaxLeaves: 8,
        pinMarkerRender: vi.fn(),
      },
    )
    const opts = teritorioCluster.getOptionsForTesting()

    expect(teritorioCluster.id).toBe('layerId')
    expect(opts.clusterMaxZoom).toBe(22)
    expect(opts.clusterMinZoom).toBe(2)
    expect(opts.markerSize).toBe(28)
    expect(opts.unfoldedClusterMaxLeaves).toBe(8)
    expect(opts.fitBoundsOptions).toEqual({ padding: { top: 57, bottom: 20, left: 20, right: 20 } })
    expect(opts.initialFeature).toBeUndefined()
    expect(typeof opts.clusterRender).toBe('function')
    expect(typeof opts.markerRender).toBe('function')
    expect(typeof opts.pinMarkerRender).toBe('function')
    expect(typeof opts.unfoldedClusterRender).toBe('function')
  })
})
