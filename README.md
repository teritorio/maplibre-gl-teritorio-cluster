# maplibre-gl-teritorio-cluster

![alt text](image.png)

Show cluster's points in one HTML element

## Installation

```bash
npm install maplibre-gl maplibre-gl-teritorio-cluster
```

## Demo

```bash
yarn install
yarn dev
```

## Usage

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