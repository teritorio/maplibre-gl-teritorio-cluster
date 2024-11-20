import { vi } from 'vitest'

vi.mock('maplibre-gl', () => {
  return {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      querySourceFeatures: vi.fn().mockReturnValue([]),
      getSource: vi.fn().mockReturnValue({
        getClusterLeaves: vi.fn(),
      }),
      fitBounds: vi.fn(),
    })),
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      setOffset: vi.fn().mockReturnThis(),
    })),
    Point: vi.fn().mockImplementation((x, y) => ({
      x,
      y,
    })),
  }
})
