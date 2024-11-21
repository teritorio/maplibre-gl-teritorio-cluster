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
      rollupOptions: {
        external: ['maplibre-gl'], // Exclude maplibre-gl from the bundle
        output: {
          globals: {
            'maplibre-gl': 'maplibregl',  // Define the global variable for maplibre-gl in the browser
          },
        },
      }
    } : undefined
  }
})