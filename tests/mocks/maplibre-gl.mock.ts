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
    }))
  }
})
