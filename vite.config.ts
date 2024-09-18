import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  return {
    base: command === 'serve' ? '/' : '/maplibre-gl-teritorio-cluster/',
    build: {
      lib: {
        entry: 'src/index.ts',
        name: 'MaplibreGlTeritorioCluster',
        fileName: 'maplibre-gl-teritorio-cluster'
      },
    }
  }
})