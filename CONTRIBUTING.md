# Contributing

This document contains a set of guidelines to help developers during the contribution process.

## Development

### Download and install dependencies

```shell
git clone https://github.com/teritorio/maplibre-gl-teritorio-cluster.git
cd maplibre-gl-teritorio-cluster
yarn install
```

### Run locally

Runs the project in development/watch mode with [Vite Dev server](https://vitejs.dev/guide/cli.html#dev-server).

```shell
yarn dev
```

### Build package

Bundles the package to the `dist` folder.
The package is bundled with [Typescript tsc CLI](https://www.typescriptlang.org/docs/handbook/compiler-options.html) into multiple formats (CommonJS, ESM).

```shell
yarn build
```
