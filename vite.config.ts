import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig(({ command, mode }) => {
  // Demo build config
  if (command === 'build' && mode === 'demo') {
    return {
      base: '/maplibre-gl-teritorio-cluster/',
      build: {
        outDir: './demo',
        target: 'esnext',
      },
    }
  }

  // Library build config
  if (command === 'build') {
    return {
      build: {
        lib: {
          entry: './src/index.ts',
          name: 'MaplibreGlTeritorioCluster',
          fileName: 'maplibre-gl-teritorio-cluster',
        },
        copyPublicDir: false,
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
    }
  }

  // Local Development config
  return {}
})
