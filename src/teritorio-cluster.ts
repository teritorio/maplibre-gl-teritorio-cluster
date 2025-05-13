import type { CustomLayerInterface, FitBoundsOptions, GeoJSONFeature, GeoJSONSource, LngLatLike, MapGeoJSONFeature, Map as MapGL, MapSourceDataEvent, Marker, Point } from 'maplibre-gl'
import type { FeatureInClusterMatch, FeatureMatch, TeritorioClusterOptions } from './types'
import bbox from '@turf/bbox'
import { featureCollection } from '@turf/helpers'
import maplibre from 'maplibre-gl'
import { deepMerge } from './utils/deep-merge'
import { clusterRenderDefault, markerRenderDefault, pinMarkerRenderDefault, unfoldedClusterRenderSmart } from './utils/helpers'
import { calculatePinMarkerOffset, getFeatureId, isClusterFeature } from './utils/index'

/**
 * TeritorioCluster is a custom layer interface for MapLibre
 * providing smart cluster and marker rendering, including
 * support for unfolded clusters, pin markers, and click interactions.
 */
export class TeritorioCluster extends EventTarget implements CustomLayerInterface {
  public readonly id: string
  public readonly type: 'custom' = 'custom' as const

  private readonly UNFOLDED_CLASS = 'teritorio-unfolded-cluster'

  /**
   * Default cluster options.
   */
  private readonly defaultOptions: TeritorioClusterOptions = {
    clusterMaxZoom: 17,
    clusterMinZoom: 0,
    clusterRender: clusterRenderDefault,
    fitBoundsOptions: { padding: 20 },
    initialFeature: undefined,
    markerRender: markerRenderDefault,
    markerSize: 24,
    unfoldedClusterRender: unfoldedClusterRenderSmart,
    unfoldedClusterMaxLeaves: 7,
    pinMarkerRender: pinMarkerRenderDefault,
  } satisfies TeritorioClusterOptions

  // Internal layer configuration
  private map: MapGL | null = null
  private readonly sourceId: string
  private source: GeoJSONSource | null = null
  private opts: Required<TeritorioClusterOptions>

  // Caching state
  private clusterLeaves = new Map<string, MapGeoJSONFeature[]>()
  private featuresMap = new Map<string, GeoJSONFeature>()
  private markersOnScreen = new Map<string, Marker>()

  // UI state
  private pinMarker: Marker | null = null
  private selectedFeatureId: string | null = null
  private abortExec: number = 0

  /**
   * Creates a new instance of the TeritorioCluster custom layer.
   * @param id - Unique ID for the layer.
   * @param sourceId - ID of the GeoJSON source.
   * @param options - Optional configuration overrides.
   */
  constructor(
    id: string,
    sourceId: string,
    options?: Partial<TeritorioClusterOptions>,
  ) {
    super()

    this.id = id
    this.sourceId = sourceId
    this.opts = deepMerge(this.defaultOptions, options || {})
  }

  /**
   * Initializes the cluster layer when added to the map.
   *
   * @param map - The MapLibre GL map instance.
   *
   * @remarks
   * This method is called when the layer is first added to the map. It performs the following actions:
   * - Stores a reference to the map instance.
   * - Sets the GeoJSON source using `setSource()`.
   * - Adds a transparent circle layer to the map to enable access to the source data.
   * - Registers event listeners for `sourcedata` and `moveend` to trigger re-rendering when source data changes or the map is moved.
   */
  public onAdd = (map: MapGL): void => {
    this.map = map

    this.setSource()

    // Add transparent layer to enable source data
    this.map.addLayer({
      id: `${this.id}-hidden`,
      type: 'circle',
      source: this.sourceId,
      paint: {
        'circle-color': 'transparent',
      },
    })

    this.map.on('sourcedata', this.onSourceData)
    this.map.on('moveend', this.onMoveEnd)
  }

  /**
   * Called when the layer is removed from the map.
   *
   * @remarks
   * This method is triggered when the layer is removed from the map, typically during map cleanup or when
   * switching layers. It performs necessary cleanup by:
   * - Removing event listeners that were previously added for map movements and source data changes (`moveend`, `sourcedata`).
   * - Removing all markers currently on screen.
   * - Resetting the pin marker, if present.
   */
  public onRemove = (): void => {
    if (!this.map)
      return

    this.map.off('sourcedata', this.onSourceData)
    this.map.off('moveend', this.onMoveEnd)
    this.markersOnScreen.forEach(marker => marker.remove())
    this.resetPinMarker()

    this.map.removeLayer(`${this.id}-hidden`)
  }

  /**
   * Required for CustomLayerInterface but unused in this implementation.
   *
   * @remarks
   * This method is part of the `CustomLayerInterface` contract. In this implementation,
   * it does not perform any actions, as rendering is handled elsewhere.
   */
  public render = (): void => {
    //
  }

  /**
   * Clears the currently selected feature and removes its pin.
   *
   * @remarks
   * This method resets the selected feature ID and invokes the `resetPinMarker` method
   * to remove any existing pin marker associated with the selected feature from the map.
   */
  public resetSelectedFeature = (): void => {
    this.selectedFeatureId = null
    this.resetPinMarker()
  }

  /**
   * Sets a feature as selected and places a pin marker on it.
   *
   * @param feature - The GeoJSON feature to select. Must be of type `Point` geometry.
   *
   * @throws Throws an error if the feature is not of type `Point` geometry when not found in the cluster.
   * @throws Throws an error if the cluster associated with a feature cannot be found.
   *
   * @remarks
   * If the feature is part of the visible map markers, a pin marker will be placed on its coordinates.
   * If the feature is part of a cluster, the function will attempt to render the pin marker at the cluster's coordinates.
   * If the feature is not part of the cluster or map, the method will place the pin marker on the given coordinates directly.
   */
  public setSelectedFeature = (feature: GeoJSONFeature): void => {
    const id = getFeatureId(feature)
    const match = this.findFeature(id)

    if (!match) {
      if (feature.geometry.type !== 'Point') {
        throw new Error(`Feature ${id} is not Geometry.Point, thus not supported yet.`)
      }

      // Sets a Pin Marker on a specific coordinates which isn't related to any feature from data source
      this.resetSelectedFeature()
      this.selectedFeatureId = id
      this.renderPinMarker(new maplibre.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]))

      return
    }

    this.resetSelectedFeature()
    this.selectedFeatureId = id

    if ('type' in match && match.type === 'Feature' && match.geometry.type === 'Point') {
      const coords = match.geometry.coordinates

      this.renderPinMarker(new maplibre.LngLat(coords[0], coords[1]))
    }
    else if ('feature' in match && match.feature.geometry.type === 'Point') {
      const cluster = this.markersOnScreen.get(match.clusterId)

      if (!cluster) {
        throw new Error(`Cluster ${match.clusterId} not found.`)
      }

      this.renderPinMarkerInCluster(cluster.getElement(), cluster.getLngLat())
    }
  }

  /**
   * Updates the fit bounds configuration used for clustering.
   *
   * @param options - The options to apply when fitting the bounds,
   * such as padding, maximum zoom level, and animation settings.
   */
  public setBoundsOptions = (options: FitBoundsOptions): void => {
    this.opts.fitBoundsOptions = options
  }

  /**
   * Returns the current options (useful for testing).
   *
   * @returns The current options object, including all required configuration values.
   *
   * @remarks
   * The returned object will include the default options merged with any user-provided options
   * passed during the instantiation of the `TeritorioCluster`. This can be helpful when validating
   * the behavior of the cluster and ensuring the correct settings are being applied during tests.
   */
  public getOptionsForTesting(): Required<TeritorioClusterOptions> {
    return this.opts
  }

  /**
   * Fired when source data has changed; triggers re-render.
   *
   * @param event - The event object that contains details about the source data change.
   *
   * @remarks
   * This method checks if the source data has finished loading (`isSourceLoaded` is true) and if the event
   * pertains to the correct source (`sourceId`). If the data change is not related to metadata (`sourceDataType !== 'metadata'`),
   * it increments the `abortExec` counter to ensure that any ongoing render operation is canceled, and triggers
   * the `renderCustom` method to refresh the map with the new data.
   */
  private onSourceData = (event: MapSourceDataEvent): void => {
    if (event.isSourceLoaded && event.sourceId === this.sourceId && event.sourceDataType !== 'metadata') {
      this.abortExec++
      this.renderCustom(this.abortExec)
    }
  }

  /**
   * Fired on map movement; triggers re-render.
   *
   * It increments the `abortExec` counter to ensure that any ongoing render operations are
   * cancelled if they are outdated, and then it triggers the `renderCustom` method to refresh the map.
   *
   * @remarks
   * This method is typically tied to the map's `moveend` event. It ensures that the map's visual state
   * is updated whenever the user moves or zooms the map, keeping the features and clusters correctly rendered.
   */
  private onMoveEnd = (): void => {
    this.abortExec++
    this.renderCustom(this.abortExec)
  }

  /**
   * This method handles the creation and removal of markers for features, clusters, and pin markers
   * based on the current zoom level and the selected feature. It is responsible for managing the state
   * of markers on the screen, including rendering clusters, unfolded clusters, and regular markers.
   *
   * It also ensures that features are properly added or removed when the map zoom level changes,
   * and handles the placement of the pin marker for the selected feature or the initial feature.
   *
   * @param currentExec - A unique execution ID used for cancellation safety. This helps avoid
   * rendering outdated results when multiple rendering requests are queued.
   *
   * @returns A promise that resolves when the rendering process is complete.
   *
   * @remarks
   * - The method checks if the map and source are properly loaded before attempting any rendering.
   * - If the `abortExec` value does not match the `currentExec`, the method returns early to cancel
   *   outdated rendering requests.
   * - It renders clusters and individual markers based on the current zoom level, and ensures markers
   *   are correctly updated for features that are part of a cluster.
   * - If a feature is selected, the method will place a pin marker on it. If the feature is part of
   *   a cluster, the pin marker will be positioned inside the cluster.
   */
  private renderCustom = async (currentExec: number): Promise<void> => {
    if (
      !this.map
      || !this.map.isSourceLoaded(this.sourceId)
      || !this.source
      || this.abortExec !== currentExec) {
      return
    }

    const features = this.map!.querySourceFeatures(this.sourceId)
    this.clearRenderState()

    const newMarkers = new Map<string, Marker>()
    const maxZoomLimit = this.map!.getZoom() >= this.opts.clusterMaxZoom
    const minZoomLimit = this.map!.getZoom() >= this.opts.clusterMinZoom

    this.clusterLeaves.clear()
    this.featuresMap.clear()

    for (const feature of features) {
      if (this.abortExec !== currentExec)
        return

      const id = getFeatureId(feature)
      this.featuresMap.set(id, feature)

      if (isClusterFeature(feature)) {
        const success = await this.loadClusterLeaves(id, feature)

        if (this.abortExec !== currentExec)
          return

        if (!success)
          return
      }
    }

    this.featuresMap.forEach((feature) => {
      const coords = feature.geometry.type === 'Point' ? new maplibre.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]) : undefined
      const id = getFeatureId(feature)

      if (!coords) {
        console.error(`Feature ${id} is not Geometry.Point, thus not supported yet.`)
        return
      }

      let marker = this.markersOnScreen.get(id)
      const props = feature.properties

      if (props.cluster) {
        const leaves = this.clusterLeaves.get(id)

        if (!leaves) {
          console.error(`Cluster ${id} has no leaves`)
          return
        }

        if (
          (marker && maxZoomLimit && !marker.getElement().classList.contains(this.UNFOLDED_CLASS))
          || (marker && !maxZoomLimit && marker.getElement().classList.contains(this.UNFOLDED_CLASS) && this.markersOnScreen.has(id))
          || (marker && minZoomLimit && !marker.getElement().classList.contains(this.UNFOLDED_CLASS))
          || (marker && !minZoomLimit && marker.getElement().classList.contains(this.UNFOLDED_CLASS) && this.markersOnScreen.has(id))
        ) {
          marker = undefined
          this.markersOnScreen.get(id)?.remove()
          this.markersOnScreen.delete(id)
        }

        if (!marker) {
          let element: HTMLDivElement | undefined

          if (minZoomLimit && ((leaves.length <= this.opts.unfoldedClusterMaxLeaves) || maxZoomLimit))
            element = this.renderUnfoldedCluster(id, leaves)
          else
            element = this.renderCluster(id, props)

          marker = new maplibre.Marker({ element }).setLngLat(coords).addTo(this.map!)

          // If selected feature is now part of this new cluster
          // We position the Pin marker on it's new position
          if (this.pinMarker && this.selectedFeatureId && this.isFeatureInCluster(id, this.selectedFeatureId)) {
            this.resetPinMarker()
            this.renderPinMarkerInCluster(element, coords)
          }

          // If initialFeature is part of this new cluster
          // We position the Pin marker on it
          if (this.opts.initialFeature && this.isFeatureInCluster(id, getFeatureId(this.opts.initialFeature))) {
            this.selectedFeatureId = getFeatureId(this.opts.initialFeature)
            this.renderPinMarkerInCluster(element, coords)
            this.opts.initialFeature = undefined
          }
        }
      }
      else {
        if (!marker) {
          const element = this.renderMarker(feature)

          marker = new maplibre.Marker({ element }).setLngLat(coords).addTo(this.map!)
          element.addEventListener('click', (e: Event) => this.featureClickHandler(e, feature))

          // Keep Pin Marker on top
          if (this.pinMarker && this.selectedFeatureId === id) {
            this.resetPinMarker()
            this.renderPinMarker(coords)
          }

          // If initialFeature is this new marker
          // We position the Pin marker on it
          if (this.opts.initialFeature && (getFeatureId(this.opts.initialFeature) === id)) {
            this.selectedFeatureId = id
            this.renderPinMarker(coords)
            this.opts.initialFeature = undefined
          }
        }
      }

      newMarkers.set(id, marker)
    })

    // for every marker we've added previously, remove those that are no longer visible
    for (const [id, marker] of this.markersOnScreen.entries()) {
      if (!newMarkers.has(id))
        marker.remove()
    }

    if (this.opts.initialFeature && !this.selectedFeatureId && !this.pinMarker) {
      const id = getFeatureId(this.opts.initialFeature)
      const coords = this.opts.initialFeature.geometry.type === 'Point'
        ? new maplibre.LngLat(this.opts.initialFeature.geometry.coordinates[0], this.opts.initialFeature.geometry.coordinates[1])
        : undefined

      if (!coords) {
        console.error(`Coordinates not found for feature id : ${id}`)
        return
      }

      this.selectedFeatureId = id
      this.renderPinMarker(coords)
      this.opts.initialFeature = undefined
    }

    this.markersOnScreen = newMarkers
  }

  /**
   * Renders a cluster that expands to show individual features.
   *
   * @param id - The unique identifier for the cluster.
   * @param leaves - An array of GeoJSON features representing the individual features inside the cluster.
   *
   * @returns A `HTMLDivElement` representing the unfolded cluster marker.
   *
   * @remarks
   * This method creates a `div` element for an unfolded cluster and applies the necessary rendering logic
   * based on the `unfoldedClusterRender` function provided in the options. The unfolded cluster will display
   * individual markers for each feature inside the cluster and handle user click interactions.
   */
  private renderUnfoldedCluster = (id: string, leaves: MapGeoJSONFeature[]): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = id
    element.classList.add(this.UNFOLDED_CLASS)

    this.opts.unfoldedClusterRender(
      element,
      leaves,
      this.opts.markerSize,
      this.renderMarker,
      this.featureClickHandler,
    )

    return element
  }

  /**
   * Fits the map viewport to the bounds of cluster leaves.
   *
   * @param features - An array of GeoJSON features representing the leaves of a cluster.
   *
   * @remarks
   * This method calculates the bounding box for the given cluster leaves using the `bbox` function from
   * the `@turf/bbox` library. It then adjusts the map's viewport to fit the bounds, using the options
   * specified in `fitBoundsOptions`.
   */
  private fitBoundsToClusterLeaves = (features: MapGeoJSONFeature[]): void => {
    const bounds = bbox(featureCollection(features))

    this.map!.fitBounds(bounds as [number, number, number, number], this.opts.fitBoundsOptions)
  }

  /**
   * Renders a collapsed cluster marker.
   *
   * @param id - The unique identifier for the cluster.
   * @param props - The properties of the cluster.
   *
   * @returns A `HTMLDivElement` representing the cluster marker, which can be added to the map.
   *
   * @remarks
   * This method creates a `div` element for the cluster marker, using the `clusterRender` function
   * from the options to customize the rendering. An event listener is attached to the element that
   * listens for click events, which, when triggered, stops the event from propagating and fits
   * the map's bounds to the leaves (features) of the cluster.
   */
  private renderCluster = (id: string, props: MapGeoJSONFeature['properties']): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = id

    this.opts.clusterRender(element, props)

    element.addEventListener('click', (e: Event) => {
      e.stopPropagation()

      if (!(e.currentTarget instanceof HTMLElement))
        return

      // Fit map to cluster leaves bounding box
      const leaves = this.clusterLeaves.get(e.currentTarget.id)

      if (leaves)
        this.fitBoundsToClusterLeaves(leaves)
    })

    return element
  }

  /**
   * Checks if a given feature is part of a cluster.
   *
   * @param clusterId - The ID of the cluster to check.
   * @param featureId - The ID of the feature to check within the cluster.
   *
   * @returns `true` if the feature is part of the cluster, `false` otherwise.
   *
   * @remarks
   * This method looks up the cluster by its ID in the `clusterLeaves` map. If the cluster is found,
   * it checks whether the given feature ID exists among the leaves (features) of that cluster.
   * If the cluster doesn't exist or the feature is not part of the cluster, `false` is returned.
   */
  private isFeatureInCluster = (clusterId: string, featureId: string): boolean => {
    if (!this.clusterLeaves.has(clusterId)) {
      console.error(`Cluster ${clusterId} not found.`)
      return false
    }

    return this.clusterLeaves.get(clusterId)!.findIndex(feature => getFeatureId(feature) === featureId) > -1
  }

  /**
   * Renders the pin marker within a cluster.
   *
   * @param cluster - The HTML element representing the cluster container.
   * @param coords - The geographic coordinates where the pin marker should be placed.
   *
   * @remarks
   * If the cluster is "unfolded", this method calculates the appropriate offset
   * for the pin marker based on the selected feature's position within the cluster.
   * Otherwise, it places the pin marker directly at the given coordinates.
   *
   * @throws If the selected feature's DOM element cannot be found within the cluster.
   */
  private renderPinMarkerInCluster = (cluster: HTMLElement, coords: LngLatLike): void => {
    const isUnfoldedCluster = cluster.classList.contains(this.UNFOLDED_CLASS)

    if (!isUnfoldedCluster) {
      this.renderPinMarker(coords)
    }
    else {
      // Get selected feature DOM element position within cluster
      const selectedFeatureHTML = Array.from(cluster.children).find(el => el.id === this.selectedFeatureId) as HTMLElement

      if (!selectedFeatureHTML)
        throw new Error('Selected feature HTML marker was not found !')

      this.renderPinMarker(coords, calculatePinMarkerOffset(cluster, selectedFeatureHTML))
    }
  }

  /**
   * Renders a regular feature marker.
   *
   * @param feature - The GeoJSON feature to render a marker for. Must have a unique ID.
   *
   * @returns An HTMLDivElement representing the rendered marker.
   *
   * @remarks
   * This method creates a `div` element, assigns it an ID from the feature,
   * and passes it to the configured `markerRender` callback for custom rendering.
   * The resulting DOM element is returned for use in map markers.
   */
  private renderMarker = (feature: GeoJSONFeature): HTMLDivElement => {
    const element = document.createElement('div')
    element.id = getFeatureId(feature)

    this.opts.markerRender(element, this.opts.markerSize, feature)

    return element
  }

  /**
   * Finds a feature by ID in the visible features or cluster leaves.
   *
   * @param id - The unique identifier of the feature to find.
   *
   * @returns The matched feature either as a `GeoJSONFeature` (if directly visible on the map)
   *          or as a `FeatureInClusterMatch` (if part of a cluster), or `undefined` if not found.
   *
   * @remarks
   * This method first looks in the `featuresMap`, which holds features currently rendered on the map.
   * If not found there, it attempts to locate the feature within the stored cluster leaves.
   */
  private findFeature = (id: string): FeatureMatch | undefined => {
    return this.featuresMap.get(id) ?? this.findClusterizedFeature(id)
  }

  /**
   * Searches cluster leaves for a feature by ID.
   *
   * @param id - The unique identifier of the feature to search for.
   *
   * @returns An object containing the `clusterId` and the matched `feature` if found,
   *          otherwise returns `undefined`.
   *
   * @remarks
   * This method iterates over all cluster leaves maintained in memory to locate
   * a feature by its ID.
   */
  private findClusterizedFeature = (id: string): FeatureInClusterMatch | undefined => {
    const iterator = this.clusterLeaves.entries()

    for (const [key, value] of iterator) {
      const match = value.find(feature => getFeatureId(feature) === id)

      if (match) {
        return { clusterId: key, feature: match }
      }
    }
  }

  /**
   * Handles marker click to select a feature.
   *
   * @param event - The click event triggered on a marker element.
   * @param feature - The GeoJSON feature associated with the clicked marker.
   *
   * @remarks
   * If the feature is already selected, the handler exits early.
   * Otherwise, it sets the feature as selected using `setSelectedFeature`,
   * and dispatches a `CustomEvent` named `'feature-click'` with the selected feature as its detail payload.
   * This event can be listened on consumer-level for additional interactions.
   */
  private featureClickHandler = (event: Event, feature: GeoJSONFeature): void => {
    event.stopPropagation()

    if (!(event.currentTarget instanceof HTMLElement) || this.selectedFeatureId === getFeatureId(feature))
      return

    this.setSelectedFeature(feature)

    this.dispatchEvent(new CustomEvent('feature-click', {
      detail: {
        selectedFeature: feature,
      },
    }))
  }

  /**
   * Removes the current pin marker if any.
   *
   * @remarks
   * This method checks if a pin marker is currently present on the map.
   * If so, it removes the marker and sets the `pinMarker` property to `null`.
   * This is typically used to reset the pin marker when a new feature is selected or deselected.
   */
  private resetPinMarker = (): void => {
    if (!this.pinMarker)
      return

    this.pinMarker.remove()
    this.pinMarker = null
  }

  /**
   * Renders the pin marker at a given coordinate, optionally with offset.
   *
   * @param coords - The geographic location where the pin marker should be placed. Accepts any valid `LngLatLike` format.
   * @param offset - Optional screen offset for the marker relative to the coordinate, useful for positioning over clustered elements.
   *                 Defaults to a zero offset.
   *
   * @remarks
   * This method uses the `pinMarkerRender` function defined in options to create the marker.
   * The marker is then added to the map and stored in the internal `pinMarker` reference.
   * If a pin marker already exists, it will be replaced by the new one.
   */
  private renderPinMarker = (coords: LngLatLike, offset: Point = new maplibre.Point(0, 0)): void => {
    this.pinMarker = this.opts.pinMarkerRender(coords, offset)
    this.pinMarker.addTo(this.map!)
  }

  /**
   * Loads the leaf features for a cluster.
   *
   * @param id - The cluster ID as a string.
   * @param feature - The GeoJSON feature representing the cluster.
   * @returns A promise that resolves to `true` if the leaves were successfully loaded and cached, or `false` if an error occurred.
   *
   * @remarks
   * This method uses MapLibre's `getClusterLeaves` to retrieve the individual features contained within a cluster.
   * The results are stored in an internal cache (`clusterLeaves`) keyed by the cluster ID.
   * It handles any exceptions gracefully and logs a warning if fetching fails.
   */
  private loadClusterLeaves = async (id: string, feature: GeoJSONFeature): Promise<boolean> => {
    try {
      const leaves = await this.source!.getClusterLeaves(
        Number.parseInt(id),
        feature.properties!.point_count,
        0,
      ) as MapGeoJSONFeature[]

      this.clusterLeaves.set(id, leaves)
      return true
    }
    catch (error) {
      console.warn('Error while getClusterLeaves: ', error)
      return false
    }
  }

  /**
   * Clears all render state before a new render pass.
   *
   * @remarks
   * This method resets the state by clearing the `clusterLeaves` map (which holds cluster data)
   * and the `featuresMap` (which stores individual feature data currently visible on the map).
   * It ensures that the map is ready for a fresh render pass without any leftover state from previous renders.
   */
  private clearRenderState = (): void => {
    this.clusterLeaves.clear()
    this.featuresMap.clear()
  }

  /**
   * Gets the GeoJSON source and stores a reference.
   *
   * @throws Will throw an error if the source is missing or not of type 'geojson'.
   *
   * @remarks
   * This method ensures that the map instance exists and the source with the given `sourceId`
   * is present and valid. If the source is found and is a GeoJSON source, it is stored for later use.
   */
  private setSource = (): void => {
    if (!this.map)
      return

    const source = this.map.getSource(this.sourceId)

    if (!source)
      throw new Error(`Source ${this.sourceId} is missing.`)

    if (source.type !== 'geojson')
      throw new Error(`Source ${this.sourceId} is not a GeoJSON.`)

    this.source = source as GeoJSONSource
  }
}
