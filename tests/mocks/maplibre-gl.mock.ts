import { vi } from 'vitest'

vi.mock('maplibre-gl', () => {
  return {
    Map: vi.fn().mockImplementation(() => {
      return {
        addLayer: vi.fn(),
        addSource: vi.fn(),
        on: vi.fn(),
      }
    }),
  }
})
