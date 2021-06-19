import * as Constants from './constants';

export default function render() {
  // eslint-disable-next-line no-invalid-this
  const store = this;
  const mapExists = store.ctx.map && store.ctx.map.getSource(Constants.sources.HOT) !== undefined;
  if (!mapExists) return cleanup();

  const mode = store.ctx.events.currentModeName();

  store.ctx.ui.queueMapClasses({ mode });

  let newHotIds = [];
  let newColdIds = [];

  if (store.isDirty) {
    newColdIds = store.getAllIds();
  } else {
    newHotIds = store.getChangedIds().filter(id => store.get(id) !== undefined);
    newColdIds = store.sources.hot.filter(geojson => geojson.properties.id && newHotIds.indexOf(geojson.properties.id) === -1 && store.get(geojson.properties.id) !== undefined).map(geojson => geojson.properties.id);
  }

  store.sources.hot = [];
  const lastColdCount = store.sources.cold.length;
  store.sources.cold = store.isDirty ? [] : store.sources.cold.filter((geojson) => {
    const id = geojson.properties.id || geojson.properties.parent;
    return newHotIds.indexOf(id) === -1;
  });

  const coldChanged = lastColdCount !== store.sources.cold.length || newColdIds.length > 0;
  newHotIds.forEach(id => renderFeature(id, 'hot'));
  newColdIds.forEach(id => renderFeature(id, 'cold'));

  function renderFeature(id, source) {
    const feature = store.get(id);
    const featureInternal = feature.internal(mode);
    store.ctx.events.currentModeRender(featureInternal, (geojson) => {
      store.sources[source].push(geojson);
    });
  }
  const typePolygonList = [
    Constants.geojsonTypes.POLYGON,
    Constants.geojsonTypes.MULTI_POLYGON
  ];
  const typeLineList = [
    Constants.geojsonTypes.LINE_STRING,
    Constants.geojsonTypes.MULTI_LINE_STRING,
  ];

  if (coldChanged) {
    store.ctx.map.getSource(Constants.sources.COLD).setData({
      type: Constants.geojsonTypes.FEATURE_COLLECTION,
      features: store.sources.cold
    });
    for (let i = 0; i < store.sources.cold.length; i++) {
      const element = store.sources.cold[i];
      if (typePolygonList.includes(element.geometry.type)) {
        store.ctx.map.fire(Constants.events.UPDATE_POLYGON, {
          feature: store.sources.cold[i],
          other: "cold"
        });
      }
      if (typeLineList.includes(element.geometry.type)) {
        store.ctx.map.fire(Constants.events.UPDATE_MULTI_LINE_STRING, {
          feature: store.sources.cold[i],
          other: "cold"
        });
      }
    }
  }

  store.ctx.map.getSource(Constants.sources.HOT).setData({
    type: Constants.geojsonTypes.FEATURE_COLLECTION,
    features: store.sources.hot
  });
  for (let i = 0; i < store.sources.hot.length; i++) {
    const element = store.sources.hot[i];
    if (typePolygonList.includes(element.geometry.type)) {
      store.ctx.map.fire(Constants.events.UPDATE_POLYGON, {
        feature: store.sources.hot[i],
        other: "hot"
      });
    }
    if (typeLineList.includes(element.geometry.type)) {
      store.ctx.map.fire(Constants.events.UPDATE_MULTI_LINE_STRING, {
        feature: store.sources.hot[i],
        other: "hot"
      });
    }
  }

  if (store._emitSelectionChange) {
    store.ctx.map.fire(Constants.events.SELECTION_CHANGE, {
      features: store.getSelected().map(feature => feature.toGeoJSON()),
      points: store.getSelectedCoordinates().map(coordinate => ({
        type: Constants.geojsonTypes.FEATURE,
        properties: {},
        geometry: {
          type: Constants.geojsonTypes.POINT,
          coordinates: coordinate.coordinates
        }
      }))
    });
    store._emitSelectionChange = false;
  }

  if (store._deletedFeaturesToEmit.length) {
    const geojsonToEmit = store._deletedFeaturesToEmit.map(feature => feature.toGeoJSON());

    store._deletedFeaturesToEmit = [];

    store.ctx.map.fire(Constants.events.DELETE, {
      features: geojsonToEmit
    });
  }

  cleanup();
  store.ctx.map.fire(Constants.events.RENDER, {});

  function cleanup() {
    store.isDirty = false;
    store.clearChangedIds();
  }
}
