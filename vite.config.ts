import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'MaplibreGlTeritorioCluster',
      fileName: 'maplibre-gl-teritorio-cluster',
    },
    sourcemap: true,
    rollupOptions: {
      external: ['maplibre-gl'], // Exclude maplibre-gl from the bundle
      output: {
        globals: {
          'maplibre-gl': 'maplibregl', // Define the global variable for maplibre-gl in the browser
        },
      },
    },
  },
  server: {
    open: './demo/index.html',
  },
})
