import type { GeoJSONFeature } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { getFeatureId } from '../src/utils'

function makeFeature(overrides: Partial<GeoJSONFeature> & { properties?: Record<string, unknown> }): GeoJSONFeature {
  return {
    type: 'Feature',
    id: undefined,
    geometry: {
      type: 'Point',
      coordinates: [0, 0],
    },
    properties: {},
    ...overrides,
  } as unknown as GeoJSONFeature
}

describe('getFeatureId', () => {
  describe('cluster features', () => {
    it('returns id for a cluster feature', () => {
      const feature = makeFeature({
        id: 42,
        properties: { cluster: true },
      })
      expect(getFeatureId(feature)).toBe('42')
    })

    it('throws when cluster feature has no id', () => {
      const feature = makeFeature({
        id: undefined,
        properties: { cluster: true },
      })
      expect(() => getFeatureId(feature)).toThrow('Cluster feature is missing "id".')
    })
  })

  describe('non-cluster features — feature.id priority', () => {
    it('returns feature.id when set, ignoring properties.metadata.id', () => {
      const feature = makeFeature({
        id: 7,
        properties: {
          metadata: { id: 99 },
        },
      })
      expect(getFeatureId(feature)).toBe('7')
    })

    it('returns feature.id when set, ignoring properties.id', () => {
      const feature = makeFeature({
        id: 'abc',
        properties: { id: 'xyz' },
      })
      expect(getFeatureId(feature)).toBe('abc')
    })

    it('falls through to fallback when feature.id is "" (empty string)', () => {
      const feature = makeFeature({
        id: '',
        properties: {
          metadata: { id: 55 },
        },
      })
      expect(getFeatureId(feature)).toBe('55')
    })

    it('returns "0" when feature.id is 0 (falsy but valid)', () => {
      const feature = makeFeature({
        id: 0,
        properties: {
          metadata: { id: 99 },
        },
      })
      expect(getFeatureId(feature)).toBe('0')
    })

    it('returns distinct ids for features sharing the same metadata.id but with unique feature.id', () => {
      const f1 = makeFeature({
        id: 1,
        properties: {
          metadata: { id: 100 },
        },
      })
      const f2 = makeFeature({
        id: 2,
        properties: {
          metadata: { id: 100 },
        },
      })
      expect(getFeatureId(f1)).toBe('1')
      expect(getFeatureId(f2)).toBe('2')
      expect(getFeatureId(f1)).not.toBe(getFeatureId(f2))
    })
  })

  describe('non-cluster features — fallback to properties', () => {
    it('falls back to metadata.id (object) when feature.id is absent', () => {
      const feature = makeFeature({
        properties: {
          metadata: { id: 55 },
        },
      })
      expect(getFeatureId(feature)).toBe('55')
    })

    it('falls back to metadata.id when metadata is a JSON string', () => {
      const feature = makeFeature({
        properties: {
          metadata: JSON.stringify({ id: 77 }),
        },
      })
      expect(getFeatureId(feature)).toBe('77')
    })

    it('falls back to properties.id when metadata is absent', () => {
      const feature = makeFeature({
        properties: { id: 33 },
      })
      expect(getFeatureId(feature)).toBe('33')
    })

    it('falls back to properties.id when metadata JSON is invalid', () => {
      const feature = makeFeature({
        properties: { metadata: 'not-json', id: 11 },
      })
      expect(getFeatureId(feature)).toBe('11')
    })
  })
})
