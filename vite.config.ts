import { defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  return {
    base: command === 'build' ? '/maplibre-gl-teritorio-cluster/' : '/',
    build: mode === 'production' ? {
      lib: {
        entry: 'src/index.ts',
        name: 'MaplibreGlTeritorioCluster',
        fileName: 'maplibre-gl-teritorio-cluster'
      },
    } : undefined
  }
})