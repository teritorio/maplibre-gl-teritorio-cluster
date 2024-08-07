# @teritorio/maplibre-gl-uncluster

![alt text](image.png)

Show cluster's points in one HTML element

## Installation

```bash
npm install maplibre-gl maplibre-gl-uncluster
```

## Demo

```bash
yarn install
yarn dev
```

## Usage

```js
import { Map } from "maplibre-gl"
import UnCluster from 'maplibre-gl-uncluster'

const map = new Map({
  container: "map_dom_el_id",
  zoom: 0.3,
  center: [0, 20],
  style: 'https://api.maptiler.com/maps/openstreetmap/style.json?key=your_api_key'
});

const unCluster = new UnCluster(map, 'your_cluster_source')

map.on('data', (e) => {
  if (e.sourceId !== 'your_cluster_source' || !e.isSourceLoaded) return;

  map.on('move', unCluster.render);
  map.on('moveend', unCluster.render);
  unCluster.render()
});
```