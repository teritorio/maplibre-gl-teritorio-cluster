import type { CircleLayerSpecification, CustomLayerInterface, GeoJSONSource, Map as MapGL, SymbolLayerSpecification } from 'maplibre-gl'

interface PartialSymbolLayerSpecification {
  layout: Partial<SymbolLayerSpecification['layout']>
  paint: Partial<SymbolLayerSpecification['paint']>
}

interface PartialCircleLayerSpecification {
  layout: Partial<CircleLayerSpecification['layout']>
  paint: Partial<CircleLayerSpecification['paint']>
}

export class TeritorioClusterLayer implements CustomLayerInterface {
  id: string
  type: 'custom'
  markerLayerConfig: PartialCircleLayerSpecification
  markerSymbolLayerConfig: PartialSymbolLayerSpecification
  clusterLayerConfig: PartialCircleLayerSpecification
  clusterSymbolLayerConfig: PartialSymbolLayerSpecification

  private map: MapGL | null = null
  private sourceId: string
  private source: GeoJSONSource | null = null

  constructor(
    id: string,
    sourceId: string,
    markerLayerConfig: PartialCircleLayerSpecification,
    markerSymbolLayerConfig: PartialSymbolLayerSpecification,
    clusterLayerConfig: PartialCircleLayerSpecification,
    clusterSymbolLayerConfig: PartialSymbolLayerSpecification,
  ) {
    this.id = id
    this.sourceId = sourceId
    this.type = 'custom'
    this.markerLayerConfig = markerLayerConfig
    this.markerSymbolLayerConfig = markerSymbolLayerConfig
    this.clusterLayerConfig = clusterLayerConfig
    this.clusterSymbolLayerConfig = clusterSymbolLayerConfig
  }

  onAdd(map: MapGL, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map

    if (!map.getSource(this.sourceId))
      throw new Error(`Source ${this.sourceId} is missing.`)

    this.map.addLayer({
      id: `${this.sourceId}-marker`,
      type: 'circle',
      source: this.sourceId,
      filter: ['!=', 'cluster', true],
      ...this.markerLayerConfig,
    })

    this.map.addLayer({
      id: `${this.sourceId}-marker-symbol`,
      type: 'symbol',
      source: this.sourceId,
      filter: ['!=', 'cluster', true],
      ...this.markerSymbolLayerConfig,
    })

    this.map.addLayer({
      id: `${this.sourceId}-cluster`,
      type: 'circle',
      source: this.sourceId,
      filter: ['has', 'point_count'],
      ...this.clusterLayerConfig,
    })

    this.map.addLayer({
      id: `${this.sourceId}-cluster-symbol`,
      type: 'symbol',
      source: this.sourceId,
      filter: ['has', 'point_count'],
      ...this.clusterSymbolLayerConfig,
    })
  }

  onRemove(map: MapGL, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    console.log('layer removed')
  }

  render(): void {
    console.log('rendering...')
  }
}
