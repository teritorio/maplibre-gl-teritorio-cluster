import { describe, it, expect, vi } from 'vitest';
import { getFeatureId } from '../src/utils/get-feature-id'

describe('getFeatureId', () => {
  it('should return the feature id for clusters', () => {
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { cluster: true },
      id: 123,
      geometry: { type: 'Point', coordinates: [0, 0] },
    };

    const result = getFeatureId(feature);
    expect(result).toBe('123');
  });

  it('should return the feature id if no metadata and but property id exists', () => {
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { id: 456 },
      geometry: { type: 'Point', coordinates: [1, 1] },
    };

    const result = getFeatureId(feature);
    expect(result).toBe('456');
  });

  it('should return the metadata id if metadata exists', () => {
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { metadata: '{"id": "789"}' },
      geometry: { type: 'Point', coordinates: [2, 2] },
    };

    const result = getFeatureId(feature);
    expect(result).toBe('789');
  });

  it('should return "unknown" when no id or metadata is available', () => {
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [3, 3] },
    };

    const result = getFeatureId(feature);
    expect(result).toBe('unknown');
  });

  it('should handle malformed metadata and return "unknown"', () => {
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { metadata: 'invalid-json' },
      geometry: { type: 'Point', coordinates: [4, 4] },
    };

    const result = getFeatureId(feature);
    expect(result).toBe('unknown');
  });

  it('should log an error when an exception occurs', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [3, 3] },
    };

    getFeatureId(feature);

    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error in getFeatureId:');

    consoleErrorSpy.mockRestore();
  });

  it('should return feature id if metadata is malformed but feature has id', () => {
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { metadata: 'invalid-json' },
      id: 101,
      geometry: { type: 'Point', coordinates: [5, 5] },
    };

    const result = getFeatureId(feature);
    expect(result).toBe('101');
  });
});
