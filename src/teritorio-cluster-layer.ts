import type { CircleLayerSpecification, CircleLayoutPropsPossiblyEvaluated, CustomLayerInterface, FilterSpecification, GeoJSONSource, LayerSpecification, Map as MapGL, SymbolLayerSpecification } from 'maplibre-gl'

type SymbolOrCircleLayerSpecification =
  | ({
    type: Extract<LayerSpecification['type'], 'symbol'>
    suffix: string
    filter: FilterSpecification
  } & Pick<SymbolLayerSpecification, 'layout' | 'paint'>)
  | ({
    type: Extract<LayerSpecification['type'], 'circle'>
    suffix: string
    filter: FilterSpecification
  } & Pick<CircleLayerSpecification, 'layout' | 'paint'>)

export class TeritorioClusterLayer implements CustomLayerInterface {
  id: string
  type: 'custom'
  layers: SymbolOrCircleLayerSpecification[]

  private map: MapGL | null = null
  private sourceId: string
  private source: GeoJSONSource | null = null

  constructor(
    id: string,
    sourceId: string,
    markerLayerConfig: Pick<CircleLayerSpecification, 'layout' | 'paint'>,
    markerSymbolLayerConfig: Pick<SymbolLayerSpecification, 'layout' | 'paint'>,
    clusterLayerConfig: Pick<CircleLayerSpecification, 'layout' | 'paint'>,
    clusterSymbolLayerConfig: Pick<SymbolLayerSpecification, 'layout' | 'paint'>,
  ) {
    this.id = id
    this.sourceId = sourceId
    this.type = 'custom'
    this.layers = [
      { type: 'circle', suffix: 'marker', filter: ['!=', 'cluster', true], ...markerLayerConfig },
      { type: 'symbol', suffix: 'marker-symbol', filter: ['!=', 'cluster', true], ...markerSymbolLayerConfig },
      { type: 'circle', suffix: 'cluster', filter: ['has', 'point_count'], ...clusterLayerConfig },
      { type: 'symbol', suffix: 'cluster-symbol', filter: ['has', 'point_count'], ...clusterSymbolLayerConfig },
    ]
  }

  onAdd(map: MapGL, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map

    if (!map.getSource(this.sourceId))
      throw new Error(`Source ${this.sourceId} is missing.`)

    this.setLayers()
    this.setupLayerInteractions()
  }

  private setLayers(): void {
    if (!this.map)
      throw new Error(`Call Map.addLayer() first.`)

    this.layers.forEach(({ type, suffix, filter, ...rest }) => {
      this.addLayer(type, suffix, filter, rest)
    })
  }

  private addLayer(
    type: Extract<LayerSpecification['type'], 'symbol' | 'circle'>,
    suffix: string,
    filter: FilterSpecification,
    rest: any,
  ): void {
    if (!this.map)
      throw new Error(`Call Map.addLayer() first.`)

    this.map.addLayer({
      id: `${this.sourceId}-${suffix}`,
      type,
      source: this.sourceId,
      filter,
      ...rest,
    })
  }

  private setupLayerInteractions(): void {
    if (!this.map)
      throw new Error(`Call Map.addLayer() first.`)

    const interactiveLayers = this.layers.filter(layer => layer.type === 'circle')

    interactiveLayers.forEach((layer) => {
      this.map!.on('mouseenter', `${this.sourceId}-${layer.suffix}`, () => {
        this.map!.getCanvas().style.cursor = 'pointer'
      })

      this.map!.on('mouseleave', `${this.sourceId}-${layer.suffix}`, () => {
        this.map!.getCanvas().style.cursor = ''
      })
    })
  }

  onRemove(map: MapGL, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    console.log('layer removed')
  }

  render(): void {
    console.log('rendering...')
  }
}
