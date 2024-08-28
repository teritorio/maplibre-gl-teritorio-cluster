# MapLibre GL Teritorio Cluster

Render native MapLibre GL JS clusters as HTML marker. Render:
- HTML cluster
- HTML group marked small cluster or last zoom level

Allow to see and interact with all map markers, even when superposed. Allow to see and interact with small cluster without the need to need to zoom or uncluster.

See the [Demo page](https://teritorio.github.io/maplibre-gl-teritorio-cluster/index.html).

![alt text](image.png)

## Usage

Add to you project (or use CDN).
```bash
npm add maplibre-gl-teritorio-cluster
```

> [!WARNING]
> Set your GeoJson source with `clusterMaxZoom: 22` in order to let the plugin handle cluster/individual marker rendering.

```js
import { Map } from "maplibre-gl"
import UnCluster from 'maplibre-gl-teritorio-cluster'

const map = new Map({
container: "map_dom_el_id",
zoom: 0.3,
center: [0, 20],
style: 'https://api.maptiler.com/maps/openstreetmap/style.json?key=your_api_key'
});

// Set `clusterMaxZoom` to force display unclustered points on a certain zoom level
const clusterMaxZoom = 17

const unCluster = new UnCluster(map, 'your_cluster_source', { clusterMaxZoom }, createClusterHTML, createSingleMarkerHTML)

map.on('data', (e) => {
if (e.sourceId !== 'your_cluster_source' || !e.isSourceLoaded) return;

map.on('move', unCluster.render);
map.on('moveend', unCluster.render);
unCluster.render()
});

// Create whatever HTML element you want as Cluster
const displayCluster = (): HTMLElement => {}
// Create whatever HTML element you want as individual Marker
const displayMarker = (): HTMLElement => {}
```

## Dev

Install Maplibre GL JS as peer dependency (be seriously, you should already have it)
```bash
npm install maplibre-gl
```

Install dependencies
```bash
yarn install
```

Serve the demo page
```bash
yarn dev
```

## Requirements

Requires [maplibre-gl-js](https://maplibre.org/projects/#js) >= v4.0.0.

## Contribution

Please see the [contribution guide](CONTRIBUTING.md).

## Author

[Teritorio](https://teritorio.fr)
