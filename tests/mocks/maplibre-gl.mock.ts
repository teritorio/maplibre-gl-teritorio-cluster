import { vi } from 'vitest'

vi.mock('maplibre-gl', () => ({
  Map: class {
    addLayer = vi.fn()
    addSource = vi.fn()
    on = vi.fn()
  },
}))
