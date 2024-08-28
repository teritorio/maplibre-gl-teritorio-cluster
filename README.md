# MapLibre GL Teritorio Cluster

Render native MapLibre GL JS clusters as HTML marker.

Render:
- HTML cluster
- HTML group marked as small cluster or last zoom level
- Pin Marker on feature click

Allow visualization and interaction with all markers, even when superposed.
Can display and interact with small cluster without the need to zoom or TeritorioCluster.

See the [Demo page](https://teritorio.github.io/maplibre-gl-teritorio-cluster/index.html).

![alt text](image.png)

## Usage

Add to you project (or use CDN).
```bash
yarn add maplibre-gl-teritorio-cluster
```

> [!WARNING]
> Set your GeoJson source with `clusterMaxZoom: 22` in order to let the plugin handle cluster/individual marker rendering across all zoom level

```js
import { Map } from "maplibre-gl"
import { TeritorioCluster } from 'maplibre-gl-teritorio-cluster'

const map = new Map({
  container: "map_dom_el_id",
  style: './style.json'
});

map.on('load', () => {
  const TeritorioCluster = new TeritorioCluster(map, 'your_source_name', options)

  // Get feature click event
  TeritorioCluster.addEventListener('teritorioClick', (e) => {
    console.log(e)
  })

  // Render feature on map data updates
  map.on('data', (e) => {
    if (e.sourceId !== 'your_source_name' || !e.isSourceLoaded)
      return;

    map.on('move', TeritorioCluster.render);
    map.on('moveend', TeritorioCluster.render);
    TeritorioCluster.render()
  });
})

// Create whatever HTML element you want as Cluster
const clusterMode = (element: HTMLDivElement, props: MapGeoJSONFeature['properties'], size?: number): void => {}

// Create whatever HTML element you want as individual Marker
const displayMarker = (element: HTMLDivElement, feature: MapGeoJSONFeature, size?: number): void => {}

// Create whatever HTML element you want as Pin Marker
const displayPinMarker = (coords: LngLatLike, offset: Point): Marker => {}
```

## API

- [TeritorioCluster](#teritoriocluster)
  - [Parameters](#parameters)
  - [addEventListener](#addeventlistener)

### TeritorioCluster

Create a new Maplibre GL JS plugin for feature (cluster / individual marker) rendering

#### Parameters

  - `map`: [`maplibregl.Map`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/) The Map object represents the map on your page
  - `source`: `string` The ID of the vector tile or GeoJSON source to query
  - `options`: `object` Options to configure the plugin
    - `options.clusterMaxZoom`: `number` The cluster's max zoom (optional, default `17`)
    - `options.clusterMode`: `(element: HTMLDivElement, props: MapGeoJSONFeature['properties'], size?: number): void` Custom function for cluster rendering (optional)
    - `options.clusterSize`: `number` Set the size for default cluster rendering mode (optional, default `38`)
    - `options.markerMode`: `(element: HTMLDivElement, feature: MapGeoJSONFeature, size?: number): void` Custom function for individual marker rendering (optional)
    - `options.markerSize`: `number` Set the size for default individual marker rendering mode (optional, default `24`)
    - `options.teritorioClusterMode`: `'circle'` TeritorioCluster rendering preset (optional)
    - `options.pinMarkerMode`: `(coords: LngLatLike, offset: Point): Marker` Custom function for pin marker rendering (optional)

#### addEventListener

Listen to feature click and returns it for external control.

```js
TeritorioCluster.addEventListener('teritorioClick', (e) => {
  console.log(e.detail.selectedFeature)
})

```

## Dev

Install Maplibre GL JS as peer dependency
```bash
yarn add maplibre-gl
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
