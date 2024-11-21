import { Map as MapGL } from 'maplibre-gl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeritorioCluster } from '../src/teritorio-cluster'
import { getFeatureId } from '../src/utils/get-feature-id'

vi.mock('../src/utils/get-feature-id', () => ({
  getFeatureId: vi.fn(),
}))

describe('setSelectedFeature', () => {
  let map: MapGL
  let teritorioCluster: TeritorioCluster

  beforeEach(() => {
    map = new MapGL({ container: 'map' })
    teritorioCluster = new TeritorioCluster(map, 'sourceId')
  })

  it('should render pin marker when feature is not found and is a Point', () => {
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: null,
    } satisfies GeoJSON.Feature

    vi.mocked(getFeatureId).mockReturnValue('some-unique-id')

    teritorioCluster.setSelectedFeature(feature)

    expect(teritorioCluster.selectedFeatureId).toBe('some-unique-id')
    expect(teritorioCluster.pinMarker?.setLngLat).toHaveBeenCalledWith([10, 20])
    expect(teritorioCluster.pinMarker?.addTo).toHaveBeenCalledWith(map)
  })

  it('should log an error if feature is not a Point and not found', () => {
    const feature = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[]]] },
      properties: null,
    } satisfies GeoJSON.Feature
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(getFeatureId).mockReturnValue('some-unique-id')

    teritorioCluster.setSelectedFeature(feature)

    expect(consoleErrorSpy).toHaveBeenCalledWith('Feature some-unique-id is not of type \'Point\', and is not supported.')
  })
})
