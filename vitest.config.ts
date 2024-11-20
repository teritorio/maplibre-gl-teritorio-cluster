import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    setupFiles: './tests/mocks/maplibre-gl.mock.ts',
  },
})
