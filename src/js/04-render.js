//  RENDU — VUE "BLOCS" (fond permanent des 5 régions, Lux. fusionné)
// ══════════════════════════════════════════════════════════════════

var BLOCS_SOURCE_LAYERS = ['depts_lor', 'kreise_rlp', 'landkreise_sar', 'provinces_wal', 'cantons_lux'];
var BLOCS_SOURCE_ID = 'blocs-src';
var BLOCS_FILL_ID = 'blocs-fill';
var BLOCS_LINE_ID = 'blocs-line';

function _buildBlocsCollection() {
  // Regroupe toutes les subdivisions par région canonique, puis fusionne
  // chaque groupe en UNE seule géométrie : la vue "Blocs" ne doit montrer
  // que les frontières nationales/régionales — ni départements, ni
  // provinces, ni Kreise, ni cantons.
  var byRegion = {};
  function addTo(region, geometry) {
    (byRegion[region] = byRegion[region] || []).push({type: 'Feature', geometry: geometry, properties: {}});
  }

  ['depts_lor', 'kreise_rlp', 'landkreise_sar', 'provinces_wal'].forEach(function(id) {
    if (!_cache[id]) return;
    var derivedRegion = _LAYER_REGION[id];
    (_cache[id].features || []).filter(_inGRBounds).forEach(function(f) {
      var props = f.properties || {};
      var effectiveRegion = _canonicalRegion(props.region || props.REGION || props.bloc || derivedRegion);
      if (!_activeBlocs[effectiveRegion]) return;
      addTo(effectiveRegion, f.geometry);
    });
  });
  if (_cache['cantons_lux']) {
    (_cache['cantons_lux'].features || []).filter(_inGRBounds).forEach(function(f) {
      if (!_activeBlocs['Luxembourg']) return;
      addTo('Luxembourg', f.geometry);
    });
  }

  var all = [];
  Object.keys(byRegion).forEach(function(region) {
    var merged = _mergeFeaturesIntoOne(byRegion[region], region);
    if (merged) {
      all.push(merged);
    } else {
      // Repli : si la fusion échoue, on affiche quand même les polygones
      // bruts (mieux vaut des contours internes visibles qu'une région absente)
      byRegion[region].forEach(function(f) {
        all.push({type: 'Feature', geometry: f.geometry, properties: {region: region}});
      });
    }
  });
  return {type: 'FeatureCollection', features: all};
}

// Couleur d'un bloc pour la vue "Blocs" — factorisé pour être réutilisé tel
// quel par _serializeEmbedPayload() (js/13), qui doit graver la couleur dans
// chaque feature (l'embed n'a pas accès à _dataMap/_activeBlocs à l'affichage).
function _blocRegionColor(region) {
  // Si choroplèthe active avec jointure par région, on colorie chaque bloc
  var choroActive = Object.keys(_dataMap).length > 0 && !!_valueCol;
  if (choroActive) {
    var el = document.getElementById('join-type');
    var jt = el ? el.value : 'region';
    if (jt === 'region') {
      var val = _dataMap[_normStr(region)];
      return val !== undefined ? _choroColor(val) : '#ccc';
    }
  }

  // Une seule région active : rien à comparer, la couleur d'identification
  // régionale n'a de sens qu'à côté des autres — fond neutre à la place.
  var activeCount = Object.keys(_activeBlocs).filter(function(b) { return _activeBlocs[b]; }).length;
  if (activeCount === 1) return '#e4e1db';

  return BLOC_COLORS[region] || '#e0ddd8';
}

function _fillColorExpression() {
  var expr = ['match', ['get', 'region']];
  Object.keys(BLOC_COLORS).forEach(function(region) {
    expr.push(region, _blocRegionColor(region));
  });
  expr.push('#e0ddd8');
  return expr;
}

function _drawBlocs() {
  if (!_mapReady) return;
  var fc = _buildBlocsCollection();

  // Géométries de confinement des étiquettes (polygone réel, pas la bbox)
  _blocTestGeoms = {};
  (fc.features || []).forEach(function(f) {
    var reg = f.properties && f.properties.region;
    if (!reg || !f.geometry) return;
    var dec = _decimateGeom(f.geometry);
    if (!_blocTestGeoms[reg]) { _blocTestGeoms[reg] = dec; return; }
    var A = _blocTestGeoms[reg].type === 'Polygon' ? [_blocTestGeoms[reg].coordinates] : _blocTestGeoms[reg].coordinates;
    var B = dec.type === 'Polygon' ? [dec.coordinates] : dec.coordinates;
    _blocTestGeoms[reg] = { type: 'MultiPolygon', coordinates: A.concat(B) };
  });

  if (_map.getSource(BLOCS_SOURCE_ID)) {
    _map.getSource(BLOCS_SOURCE_ID).setData(fc);
    // Réévalue la couleur à chaque bascule de bloc (ex. passage à une seule
    // région active) — sinon l'expression figée à la création ne suit pas.
    _map.setPaintProperty(BLOCS_FILL_ID, 'fill-color', _fillColorExpression());
  } else {
    _map.addSource(BLOCS_SOURCE_ID, {type: 'geojson', data: fc});
    _map.addLayer({
      id: BLOCS_FILL_ID, type: 'fill', source: BLOCS_SOURCE_ID,
      paint: { 'fill-color': _fillColorExpression(), 'fill-opacity': 0.8 }
    });
    _map.addLayer({
      id: BLOCS_LINE_ID, type: 'line', source: BLOCS_SOURCE_ID,
      paint: { 'line-color': '#0D0E12', 'line-width': _strokeWidths.blocs, 'line-opacity': 0.85 }
    });
  }
  _setVisible(BLOCS_FILL_ID, true);
  _setVisible(BLOCS_LINE_ID, !!_activeLayers['blocs']);
}

// Affiche/masque la couche "blocs" comme simple FOND (sans le contour
// "blocs", qui est piloté séparément par la case à cocher #chk-blocs)
function _setBlocsAsBackground(asBackground) {
  if (!_map.getLayer(BLOCS_FILL_ID)) return;
  // Quand une couche de subdivision est active au premier plan, on baisse
  // légèrement l'opacité du fond pour bien distinguer les deux niveaux
  _map.setPaintProperty(BLOCS_FILL_ID, 'fill-opacity', asBackground ? 0.55 : 0.8);
}

// ══════════════════════════════════════════════════════════════════
//  RENDU — COUCHE DE PREMIER PLAN (subdivisions / cantons / communes)
// ══════════════════════════════════════════════════════════════════

var ACTIVE_SOURCE_ID = 'active-src';
var ACTIVE_FILL_ID = 'active-fill';
var ACTIVE_LINE_ID = 'active-line';
var _activeFillLayerId = null; // layerId actuellement dessiné au premier plan ('blocs' = aucun)

function _subdivColorFor(props, featIndex) {
  var region = _canonicalRegion(props.region);
  var pal = BLOC_SUBDIV_PALETTES[region] || ['#aaa','#888','#777','#666','#555'];
  return pal[(featIndex || 0) % pal.length];
}

function _buildActiveCollection(layerId) {
  var geo = _cache[layerId];
  if (!geo) return {type: 'FeatureCollection', features: []};
  var derivedRegion = _LAYER_REGION[layerId];
  var feats = [];
  var idx = 0;
  var choroActive = Object.keys(_dataMap).length > 0 && !!_valueCol;
  (geo.features || []).filter(_inGRBounds).forEach(function(f) {
    var props = f.properties || {};
    var region = _canonicalRegion(props.region || props.REGION || derivedRegion);
    if (!_activeBlocs[region]) return;
    var color;
    if (choroActive) {
      var ck = _getJoinKey(f);
      var cv = ck ? _dataMap[ck] : undefined;
      color = (cv !== undefined) ? _choroColor(cv) : '#ccc';
    } else if (layerId === 'communes') {
      color = BLOC_COLORS[region] || '#e0ddd8';
    } else {
      color = _subdivColorFor({region: region}, idx);
    }
    var hh = getHierarchy({ properties: Object.assign({}, props, { region: region }) });
    var extraProps = { region: region, _fillColor: color,
      _chip: _chipLabel(hh), _chipBg: BLOC_COLORS[region] || '#888' };
    if (choroActive && cv !== undefined) extraProps._dataVal = cv;
    feats.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: Object.assign({}, props, extraProps)
    });
    idx++;
  });
  return {type: 'FeatureCollection', features: feats};
}

function _drawActiveFillLayer(layerId) {
  if (!_mapReady) return;
  if (layerId === 'blocs' || layerId === 'none') {
    _removeActiveFillLayer();
    _setBlocsAsBackground(false);
    return;
  }

  var fc = _buildActiveCollection(layerId);
  var sw = (layerId === 'communes') ? _strokeWidths.communes
         : (layerId === 'cantons_lux' || layerId === 'cantons_lor' || layerId === 'vg_rlp') ? _strokeWidths.cantons
         : _strokeWidths.subdiv;

  if (_map.getSource(ACTIVE_SOURCE_ID)) {
    _map.getSource(ACTIVE_SOURCE_ID).setData(fc);
  } else {
    _map.addSource(ACTIVE_SOURCE_ID, {type: 'geojson', data: fc});
    _map.addLayer({
      id: ACTIVE_FILL_ID, type: 'fill', source: ACTIVE_SOURCE_ID,
      paint: { 'fill-color': ['get', '_fillColor'], 'fill-opacity': 0.88 }
    });
    _map.addLayer({
      id: ACTIVE_LINE_ID, type: 'line', source: ACTIVE_SOURCE_ID,
      paint: { 'line-color': '#2a2a2a', 'line-width': sw, 'line-opacity': 0.7 }
    });
    _wireTooltipEvents(); // (ré)attache les écouteurs sur la nouvelle couche
  }
  _map.setPaintProperty(ACTIVE_LINE_ID, 'line-width', sw);
  _map.setPaintProperty(ACTIVE_LINE_ID, 'line-color',
    _strokeOverride || ((Object.keys(_dataMap).length && _valueCol) ? _choroStrokeColor() : '#2a2a2a'));
  _setVisible(ACTIVE_FILL_ID, true);
  _setVisible(ACTIVE_LINE_ID, true);
  _activeFillLayerId = layerId;
  _setBlocsAsBackground(true);
  _bringOverlaysToFront();
}

function _removeActiveFillLayer() {
  [ACTIVE_FILL_ID, ACTIVE_LINE_ID].forEach(function(id) {
    if (_map.getLayer(id)) _map.removeLayer(id);
  });
  if (_map.getSource(ACTIVE_SOURCE_ID)) _map.removeSource(ACTIVE_SOURCE_ID);
  _activeFillLayerId = null;
}

function _setVisible(layerId, visible) {
  if (_map.getLayer(layerId)) {
    _map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

// ══════════════════════════════════════════════════════════════════
