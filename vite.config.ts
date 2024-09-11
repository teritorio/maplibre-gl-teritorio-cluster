import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      base: '/',
    }
  } else {
    return {
      base: '/maplibre-gl-teritorio-cluster/',
      build: {
        outDir: 'docs'
      }
    }
  }
})