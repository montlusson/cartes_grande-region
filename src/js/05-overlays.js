//  OVERLAYS — contours administratifs (toggle via cases à cocher)
// ══════════════════════════════════════════════════════════════════

var _overlaySourceIds = {}; // layerId → bool (source déjà ajoutée)

function _overlayIds(layerId) {
  return { src: 'ov-src-' + layerId, line: 'ov-line-' + layerId };
}

function _getStrokeColor(layerId) {
  var colors = {
    blocs: '#1d2d35', depts_lor: '#2e7d32', arr_lor: '#388e3c', cantons_lor: '#43a047',
    kreise_rlp: '#1565c0', vg_rlp: '#1976d2', landkreise_sar: '#0288d1',
    provinces_wal: '#c62828', arr_wal: '#e53935', cantons_lux: '#e65100', communes: '#888',
  };
  return colors[layerId] || '#555';
}
// Quand une choroplèthe est active, les délimitations internes adoptent une
// version assombrie de la palette choisie (au lieu des couleurs par défaut).
function _choroStrokeColor() {
  if (_catMode) return '#444444';
  var palObj = CHORO_PALS.find(function(p) { return p.id === _choroPalette; }) || CHORO_PALS[0];
  var rgb = _hexToRgb(palObj.c[palObj.c.length - 1]);
  return _rgbToHex(rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.55);
}
function _strokeColorFor(layerId) {
  if (_strokeOverride) return _strokeOverride;
  if (Object.keys(_dataMap).length && _valueCol) return _choroStrokeColor();
  return _getStrokeColor(layerId);
}

// Réapplique la couleur de délimitation (surcharge ou automatique) aux
// overlays et au contour de la couche active.
function _applyStrokeColors() {
  if (!_mapReady) return;
  _refreshAllOverlays();
  if (_map.getLayer(ACTIVE_LINE_ID)) {
    _map.setPaintProperty(ACTIVE_LINE_ID, 'line-color',
      _strokeOverride || ((Object.keys(_dataMap).length && _valueCol) ? _choroStrokeColor() : '#2a2a2a'));
  }
}

function _getStrokeGroup(layerId) {
  if (layerId === 'blocs') return 'blocs';
  if (layerId === 'communes') return 'communes';
  if (layerId === 'cantons_lux' || layerId === 'cantons_lor' || layerId === 'vg_rlp') return 'cantons';
  return 'subdiv';
}
function _getStrokeWidth(layerId) {
  return _strokeWidths[_getStrokeGroup(layerId)] || 1;
}

function _drawOverlay(layerId) {
  if (layerId === 'blocs') {
    if (_map.getLayer(BLOCS_LINE_ID)) {
      _map.setPaintProperty(BLOCS_LINE_ID, 'line-width', _strokeWidths.blocs);
      _setVisible(BLOCS_LINE_ID, true);
    }
    return;
  }
  var geo = _cache[layerId];
  if (!geo) return;
  var ids = _overlayIds(layerId);
  var derivedRegion = _LAYER_REGION[layerId];
  var feats = (geo.features || []).filter(_inGRBounds).filter(function(f) {
    var props = f.properties || {};
    return !!_activeBlocs[_canonicalRegion(props.region || props.REGION || derivedRegion)];
  }).map(function(f) {
    var props = f.properties || {};
    return {
      type: 'Feature', geometry: f.geometry,
      properties: Object.assign({}, props, {region: _canonicalRegion(props.region || derivedRegion)})
    };
  });
  var fc = {type: 'FeatureCollection', features: feats};

  if (_map.getSource(ids.src)) {
    _map.getSource(ids.src).setData(fc);
  } else {
    _map.addSource(ids.src, {type: 'geojson', data: fc});
    _map.addLayer({
      id: ids.line, type: 'line', source: ids.src,
      paint: {
        'line-color': _strokeColorFor(layerId),
        'line-width': _getStrokeWidth(layerId),
        'line-opacity': 0.85
      },
      layout: { 'line-join': 'round' }
    });
  }
  _map.setPaintProperty(ids.line, 'line-width', _getStrokeWidth(layerId));
  _map.setPaintProperty(ids.line, 'line-color', _strokeColorFor(layerId));
  _setVisible(ids.line, true);
}

function _removeOverlay(layerId) {
  if (layerId === 'blocs') {
    _setVisible(BLOCS_LINE_ID, false);
    return;
  }
  var ids = _overlayIds(layerId);
  _setVisible(ids.line, false);
}

// Replace les contours administratifs actifs (overlays) au sommet de la pile
// de calques. Sans cela, la couche de remplissage au premier plan (ex. la
// choroplèthe "communes", quasi opaque) peut être ajoutée APRÈS les overlays
// et donc les recouvrir visuellement — rendant les frontières intermédiaires
// (départements/Kreise/provinces/arrondissements/cantons) invisibles.
function _bringOverlaysToFront() {
  if (_activeLayers['blocs'] && _map.getLayer(BLOCS_LINE_ID)) {
    _map.moveLayer(BLOCS_LINE_ID);
  }
  Object.keys(_activeLayers).forEach(function(id) {
    if (id === 'blocs' || !_activeLayers[id]) return;
    var ids = _overlayIds(id);
    if (_map.getLayer(ids.line)) _map.moveLayer(ids.line);
  });
}

function _redrawOverlay(id) {
  if (_cache[id] || id === 'blocs') {
    _drawOverlay(id);
  } else if (_activeLayers[id]) {
    _ensureLayer(id).then(function() { _drawOverlay(id); });
  }
}
function _refreshAllOverlays() {
  Object.keys(_activeLayers).forEach(function(id) {
    if (_activeLayers[id]) _redrawOverlay(id);
  });
}

// Met à jour la largeur de tous les overlays appartenant à un groupe de slider
function _applyStrokeWidthGroup(group) {
  Object.keys(_activeLayers).forEach(function(id) {
    if (!_activeLayers[id]) return;
    if (_getStrokeGroup(id) !== group) return;
    if (id === 'blocs') {
      if (_map.getLayer(BLOCS_LINE_ID)) _map.setPaintProperty(BLOCS_LINE_ID, 'line-width', _strokeWidths.blocs);
    } else {
      var ids = _overlayIds(id);
      if (_map.getLayer(ids.line)) _map.setPaintProperty(ids.line, 'line-width', _getStrokeWidth(id));
    }
  });
  if (_activeFillLayerId && _getStrokeGroup(_activeFillLayerId) === group && _map.getLayer(ACTIVE_LINE_ID)) {
    _map.setPaintProperty(ACTIVE_LINE_ID, 'line-width', _getStrokeWidth(_activeFillLayerId));
  }
}

// ══════════════════════════════════════════════════════════════════
//  ORCHESTRATION DU RENDU
// ══════════════════════════════════════════════════════════════════

function _redrawFill() {
  if (!_mapReady) return;

  if (_fillLayer === 'none') {
    _removeActiveFillLayer();
    _setBlocsAsBackground(false);
    setStatus('Fond vide — sélectionnez une couche pour l\'afficher.');
    return;
  }

  if (_fillLayer === 'blocs') {
    var toLoad = BLOCS_SOURCE_LAYERS.filter(function(s) { return !_cache[s]; });
    var go = function() {
      _drawBlocs();
      _removeActiveFillLayer();
      _setBlocsAsBackground(false);
      setStatus('✓ Vue "Blocs" — 5 régions affichées.');
    };
    if (!toLoad.length) { go(); return; }
    showLoading('Chargement des blocs…', toLoad.join(', '));
    Promise.all(toLoad.map(function(s) { return _fetchLayer(s); }))
      .then(function() { hideLoading(); go(); })
      .catch(function(e) { hideLoading(); setStatus('Erreur blocs: ' + e); });
    return;
  }

  // Couche de subdivision / cantons / communes : fond "blocs" + couche active au 1er plan
  var ensureBlocsBg = BLOCS_SOURCE_LAYERS.filter(function(s) { return !_cache[s]; });
  var id = _fillLayer;

  function drawAll() {
    _drawBlocs();
    if (_cache[id]) {
      _drawActiveFillLayer(id);
      var label = document.querySelector('#fill-layer-sel option[value="' + id + '"]');
      setStatus('✓ Vue "' + (label ? label.textContent : id) + '" affichée');
    }
  }

  var need = ensureBlocsBg.slice();
  if (!_cache[id]) need.push(id);
  if (!need.length) { drawAll(); return; }

  showLoading('Chargement de la couche…', need.join(', '));
  Promise.all(need.map(function(s) { return _ensureLayer(s); }))
    .then(function() { hideLoading(); drawAll(); })
    .catch(function(e) { hideLoading(); setStatus('Erreur de chargement: ' + e); });
}

// ══════════════════════════════════════════════════════════════════
