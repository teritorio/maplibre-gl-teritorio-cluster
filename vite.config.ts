import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  base: '/maplibre-gl-teritorio-cluster/',
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
  plugins: [
    dts({
      rollupTypes: true,
    }),
  ],
  server: {
    open: './demo/index.html',
  },
})
