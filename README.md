# MapLibre GL Teritorio Cluster

Enhance MapLibre GL JS with fully interactive HTML-based clusters and markers.

**Features:**
- 🧱 Renders MapLibre GL JS clusters as HTML elements.
- 📌 Displays a pinned marker when a feature is clicked.
- 🚫 Unfolded small clusters to avoid requiring zoom or manual ungrouping.

**3 Cluster States:**
- Cluster Marker: A single marker representing a cluster, eg. displaying the number of features.
- Unfolded Cluster: Displays individual features grouped from a small cluster or when at the highest zoom level.
-  Unclustered Features

**Customization Callbacks:**
- Custom function to render cluster.
- Custom function to render individual markers.
- Custom function to render unfolded cluster.

---
## Demo

👉 [**Live Demo**](https://teritorio.github.io/maplibre-gl-teritorio-cluster/index.html)

![Demo screenshot](public/image.png)
## Installation

Install @teritorio/maplibre-gl-teritorio-cluster with yarn

```bash
yarn add @teritorio/maplibre-gl-teritorio-cluster
```

Or use it from CDN
```html
<script type="module" src="https://unpkg.com/@teritorio/maplibre-gl-teritorio-cluster/dist/maplibre-gl-teritorio-cluster.js"></script>
```

## Usage/Examples

> [!WARNING]
> Set your GeoJSON source with `clusterMaxZoom: 22` in order to let the plugin handle individual marker rendering at the highest zoom level.

```javascript
import { TeritorioCluster } from '@teritorio/maplibre-gl-teritorio-cluster'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    name: 'MapLibre GL Teritorio Cluster',
    sources: {
      points: {
        type: 'geojson',
        cluster: true,
        clusterRadius: 80,
        clusterMaxZoom: 22, // Required
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { id: 1 },
              geometry: { type: 'Point', coordinates: [0, 0] }
            },
            {
              type: 'Feature',
              properties: { id: 2 },
              geometry: { type: 'Point', coordinates: [0, 1] }
            }
          ]
        }
      }
    },
    glyphs: 'https://orangemug.github.io/font-glyphs/glyphs/{fontstack}/{range}.pbf',
    layers: [],
    id: 'maplibre-gl-teritorio-cluster'
  }
})

map.on('load', () => {
  const clusterLayer = new TeritorioCluster(
    'teritorio-cluster-layer',
    'points',
    options
  )

  // Add the layer to map
  map.addLayer(clusterLayer)

  // Subscribe to feature click event
  clusterLayer.addEventListener('feature-click', (event) => {
    console.log(event.detail.selectedFeature)
  })
})

// Create whatever HTML element you want as Cluster
function clusterRender(element, props) {}

// Create whatever HTML element you want as individual Marker
function markerRender(element, feature, markerSize) {}

// Create whatever HTML element you want as Pin Marker
function pinMarkerRender(coords, offset) {}
```

## API Reference

#### Constructor

```js
const clusterLayer = new TeritorioCluster(id, sourceId, options)
```

| Parameter  | Type                               | Description                              |
| ---------- | ---------------------------------- | ---------------------------------------- |
| `id`       | `string`                           | Unique ID for the layer.          |
| `sourceId` | `string`                           | ID of the GeoJSON source.                 |
| `options`  | `Partial<TeritorioClusterOptions>` | Optional configuration overrides. |

#### Options

| Option                     | Type                          | Default                      | Description                                                    |
| -------------------------- | ----------------------------- | ---------------------------- | -------------------------------------------------------------- |
| `clusterMaxZoom`           | `number`                      | `17`                         | Maximum zoom level where clusters are visible.                 |
| `clusterMinZoom`           | `number`                      | `0`                          | Minimum zoom level where clustering starts.                    |
| `clusterRender`            | `(feature) => HTMLElement`    | `clusterRenderDefault`       | Custom function to render cluster.                             |
| `markerRender`             | `(feature) => HTMLElement`    | `markerRenderDefault`        | Custom function to render individual markers.                  |
| `markerSize`               | `number`                      | `24`                         | Pixel size of rendered markers.                                |
| `unfoldedClusterRender`    | `(features) => HTMLElement[]` | `unfoldedClusterRenderSmart` | Custom function to render unfolded cluster.                    |
| `unfoldedClusterMaxLeaves` | `number`                      | `7`                          | Maximum number of features to show when a cluster is unfolded. |
| `fitBoundsOptions`         | `mapboxgl.FitBoundsOptions`   | `{ padding: 20 }`            | Options for [fitBounds](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#fitbounds) method                              |
| `initialFeature`           | `GeoJSONFeature \| undefined` | `undefined`                  | Feature to auto-select on load.                                |
| `pinMarkerRender`          | `(feature) => HTMLElement`    | `pinMarkerRenderDefault`     | Custom renderer for the pinned marker.                         |

## Events

```js
clusterLayer.addEventListener('feature-click', (event) => {
  console.log('Selected feature:', event.detail.selectedFeature)
})
```
## Run Locally

Clone the project

```bash
git clone https://github.com/teritorio/maplibre-gl-teritorio-cluster.git
```

Go to the project directory

```bash
cd maplibre-gl-teritorio-cluster
```

Install dependencies

```bash
yarn install
```

Start the server

```bash
yarn dev
```

## Contributing

Contributions are always welcome!

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for ways to get started.

## Authors

- [Teritorio](https://teritorio.fr)

## License

[MIT](https://choosealicense.com/licenses/mit/)
