//  BIBLIOTHÈQUE — COUCHES GEOJSON UTILISATEUR
// ══════════════════════════════════════════════════════════════════

var _LIB_PALETTE = [
  '#e74c3c','#3498db','#27ae60','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#2c3e50','#c0392b','#16a085'
];
var _libPaletteIdx = 0;
var _userLayers = []; // [{id,name,geojson,geomType,color,opacity,visible}]

function _nextLibColor() {
  return _LIB_PALETTE[_libPaletteIdx % _LIB_PALETTE.length];
}

function _detectGeomType(geojson) {
  var types = {};
  (geojson.features || []).forEach(function(f) {
    if (f.geometry) types[f.geometry.type] = true;
  });
  if (types.Polygon || types.MultiPolygon) return 'polygon';
  if (types.LineString || types.MultiLineString) return 'line';
  return 'point';
}

function _escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Choroplèthe par valeur (couches Bibliothèque / import) ─────────
// Champs à ignorer même s'ils sont numériques : identifiants, métadonnées
// géométriques — jamais des valeurs qu'on voudrait cartographier.
var _LIB_FIELD_EXCLUDE_RE = /^(gml_?id|objectid.*|fid|id|code|.*_shape_|st_area.*|st_length.*)$/i;

// Nombre depuis une valeur brute GeoJSON : gère "5,0%" (virgule + %) et les
// nombres déjà propres. null si non interprétable.
function _coerceNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  var n = parseFloat(String(v).trim().replace('%', '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// Détecte les propriétés majoritairement numériques sur un échantillon de
// features — ce sont les candidats proposés pour la coloration par valeur.
function _detectNumericFields(geojson) {
  var feats = (geojson.features || []).slice(0, 30);
  var keys = {};
  feats.forEach(function(f) { Object.keys(f.properties || {}).forEach(function(k) { keys[k] = true; }); });
  var result = [];
  Object.keys(keys).forEach(function(k) {
    if (_LIB_FIELD_EXCLUDE_RE.test(k)) return;
    var n = 0, ok = 0;
    feats.forEach(function(f) {
      var v = (f.properties || {})[k];
      if (v === undefined || v === null || v === '') return;
      n++;
      if (_coerceNum(v) !== null) ok++;
    });
    if (n >= 3 && ok / n >= 0.8) result.push(k);
  });
  return result;
}

// Seuils quantiles + palette pour un champ donné — indépendant du CSV/join
// (cf. _buildChoroScale, js/06-choropleth-scale.js, qui lui reste dédié au
// flux CSV). Écrit aussi la valeur numérique normalisée dans chaque feature
// (_cv) : les expressions MapLibre ne savent pas parser "5,0%" elles-mêmes.
function _computeLayerChoro(layer, field, paletteId, steps) {
  var vals = [];
  (layer.geojson.features || []).forEach(function(f) {
    var n = _coerceNum((f.properties || {})[field]);
    f.properties._cv = n;
    if (n !== null) vals.push(n);
  });
  if (!vals.length) return null;
  vals.sort(function(a, b) { return a - b; });
  steps = Math.min(steps || 5, Math.max(2, vals.length));
  var breaks = [];
  for (var i = 1; i < steps; i++) breaks.push(vals[Math.floor(vals.length * i / steps)]);
  var palObj = CHORO_PALS.find(function(p) { return p.id === paletteId; }) || CHORO_PALS[0];
  return { field: field, breaks: breaks, colors: _interpolatePalette(palObj.c, steps),
           min: vals[0], max: vals[vals.length - 1] };
}

// Format court pour les bornes de légende (entier si c'en est un, sinon 1 décimale)
function _fmtChoroNum(v) {
  return (Math.round(v) === v ? v : v.toFixed(1)).toString().replace('.', ',');
}

// Couleur (unie ou expression MapLibre pilotée par _cv) pour le style d'une couche
function _layerColorExpr(layer) {
  if (!layer.choro) return layer.color;
  var expr = ['step', ['get', '_cv'], layer.choro.colors[0]];
  layer.choro.breaks.forEach(function(b, i) { expr.push(b, layer.choro.colors[i + 1]); });
  return ['case', ['==', ['get', '_cv'], null], '#ccc', expr];
}

// Couleur de délimitation d'une couche : bascule auto blanc/assombri selon
// la teinte la plus foncée de la palette (cf. _autoStrokeFor, même logique
// que la choroplèthe CSV — ex. palette Noir → blanc, pas un noir "encore
// plus noir" illisible sur la classe la plus sombre).
function _layerStrokeColor(layer) {
  if (!layer.choro) return layer.color;
  return _autoStrokeFor(layer.choro.colors[layer.choro.colors.length - 1]);
}

function _addUserLayer(name, geojson, color) {
  var id = 'ul' + Date.now().toString(36);
  var geomType = _detectGeomType(geojson);
  var n = (geojson.features || []).length;
  var layer = { id:id, name:name, geojson:geojson, geomType:geomType,
                color:color, opacity:0.82, visible:true,
                numericFields: _detectNumericFields(geojson), choro:null };
  _userLayers.push(layer);
  if (_mapReady) _renderUserLayerOnMap(layer);
  _appendLibLayerItem(layer);
  _updateLibEmptyHint();
  setStatus('✓ "' + name + '" — ' + n + ' objet' + (n > 1 ? 's' : '') + ' chargé' + (n > 1 ? 's' : '') + '.');
  _updateDataBadge();
  _updateLibraryBasemapFocus();
  _renderLibraryDataTab();
  return layer;
}

// Fonctions notifiées après suppression d'une couche (id) — permet à un
// autre module (ex. catalogue Bibliothèque, js/18-library-catalog.js) de
// resynchroniser son propre état sans dépendance directe entre fichiers.
var _libLayerRemovedListeners = [];

function _removeUserLayer(id) {
  var layer = _userLayers.find(function(l) { return l.id === id; });
  if (!layer) return;
  _removeUserLayerFromMap(layer);
  _userLayers = _userLayers.filter(function(l) { return l.id !== id; });
  ['lib-item-', 'lib-opa-row-', 'lib-choro-row-'].forEach(function(prefix) {
    var el = document.getElementById(prefix + id);
    if (el) el.remove();
  });
  _updateLibEmptyHint();
  setStatus('Couche "' + layer.name + '" supprimée.');
  _updateDataBadge();
  _updateLibraryBasemapFocus();
  _renderLibraryDataTab();
  _libLayerRemovedListeners.forEach(function(fn) { fn(id); });
}

function _renderUserLayerOnMap(layer) {
  if (!_map) return;
  var src  = 'usrc-' + layer.id;
  var lyr  = 'ulyr-' + layer.id;
  var lyr2 = 'ulyr2-' + layer.id;
  if (_map.getSource(src)) return;
  _map.addSource(src, { type: 'geojson', data: layer.geojson });
  var opa = layer.opacity;
  var col = _layerColorExpr(layer);
  if (layer.geomType === 'polygon') {
    _map.addLayer({ id:lyr,  type:'fill', source:src,
      paint: { 'fill-color':col, 'fill-opacity': opa * (layer.choro ? 0.75 : 0.38) } });
    _map.addLayer({ id:lyr2, type:'line', source:src,
      paint: { 'line-color':_layerStrokeColor(layer), 'line-width':1.4, 'line-opacity': opa } });
  } else if (layer.geomType === 'line') {
    _map.addLayer({ id:lyr, type:'line', source:src,
      paint: { 'line-color':col, 'line-width':1.8, 'line-opacity': opa } });
  } else {
    _map.addLayer({ id:lyr, type:'circle', source:src,
      paint: { 'circle-color':col, 'circle-radius':5, 'circle-opacity': opa,
               'circle-stroke-color':'#fff', 'circle-stroke-width':1 } });
  }
  _bringOverlaysToFront();
}

function _removeUserLayerFromMap(layer) {
  if (!_map) return;
  var src  = 'usrc-' + layer.id;
  var lyr  = 'ulyr-' + layer.id;
  var lyr2 = 'ulyr2-' + layer.id;
  [lyr2, lyr].forEach(function(l) { if (_map.getLayer(l)) _map.removeLayer(l); });
  if (_map.getSource(src)) _map.removeSource(src);
}

function _setUserLayerOpacity(layer) {
  if (!_map) return;
  var lyr  = 'ulyr-' + layer.id;
  var lyr2 = 'ulyr2-' + layer.id;
  var opa  = layer.opacity;
  if (layer.geomType === 'polygon') {
    if (_map.getLayer(lyr))  _map.setPaintProperty(lyr,  'fill-opacity',  opa * (layer.choro ? 0.75 : 0.38));
    if (_map.getLayer(lyr2)) _map.setPaintProperty(lyr2, 'line-opacity',  opa);
  } else if (layer.geomType === 'line') {
    if (_map.getLayer(lyr))  _map.setPaintProperty(lyr,  'line-opacity',  opa);
  } else {
    if (_map.getLayer(lyr))  _map.setPaintProperty(lyr,  'circle-opacity',opa);
  }
}

function _setUserLayerColor(layer) {
  if (!_map) return;
  var lyr  = 'ulyr-' + layer.id;
  var lyr2 = 'ulyr2-' + layer.id;
  // _computeLayerChoro écrit _cv dans les properties du GeoJSON déjà chargé
  // dans la source — sans ce setData(), MapLibre garde sa copie d'origine
  // et continue de rendre les anciennes valeurs (ou aucune).
  var src = _map.getSource('usrc-' + layer.id);
  if (src) src.setData(layer.geojson);
  var col  = _layerColorExpr(layer);
  if (layer.geomType === 'polygon') {
    if (_map.getLayer(lyr))  _map.setPaintProperty(lyr,  'fill-color',  col);
    if (_map.getLayer(lyr2)) _map.setPaintProperty(lyr2, 'line-color',  _layerStrokeColor(layer));
    _setUserLayerOpacity(layer);
  } else if (layer.geomType === 'line') {
    if (_map.getLayer(lyr))  _map.setPaintProperty(lyr,  'line-color',  col);
  } else {
    if (_map.getLayer(lyr))  _map.setPaintProperty(lyr,  'circle-color',col);
  }
}

function _updateLibEmptyHint() {
  var hint = document.getElementById('lib-empty-hint');
  if (hint) hint.style.display = _userLayers.length ? 'none' : 'block';
}

function _appendLibLayerItem(layer) {
  var list = document.getElementById('lib-layers-list');
  if (!list) return;
  var n = (layer.geojson.features || []).length;
  var typeIcon = { polygon:'▪', line:'〰', point:'●' }[layer.geomType] || '·';
  var pct = Math.round(layer.opacity * 100);

  // Item row
  var div = document.createElement('div');
  div.id = 'lib-item-' + layer.id;
  div.className = 'lib-item';
  div.innerHTML =
    '<input type="checkbox" class="lib-item-check" id="lib-chk-' + layer.id + '" checked>' +
    '<span class="lib-item-dot" id="lib-dot-' + layer.id + '"' +
      ' style="background:' + layer.color + ';cursor:pointer" title="Changer la couleur"></span>' +
    '<input type="color" id="lib-color-' + layer.id + '" value="' + layer.color + '"' +
      ' style="position:absolute;opacity:0;width:0;height:0">' +
    '<div style="flex:1;min-width:0">' +
      '<div class="lib-item-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        _escHtml(layer.name) + '</div>' +
      '<div class="lib-item-sub">' + n + ' obj. · ' + layer.geomType + '</div>' +
    '</div>' +
    '<button class="lib-del-btn" title="Supprimer"' +
      ' style="background:none;border:none;cursor:pointer;padding:1px 5px;color:#bbb;font-size:14px;line-height:1">✕</button>';
  list.appendChild(div);

  // Opacity row
  var opaDiv = document.createElement('div');
  opaDiv.className = 'lib-opa-row';
  opaDiv.id = 'lib-opa-row-' + layer.id;
  opaDiv.style.display = 'flex';
  opaDiv.innerHTML =
    '<input type="range" min="0" max="1" step=".05" value="' + layer.opacity + '"' +
      ' id="lib-opa-' + layer.id + '">' +
    '<span id="lib-opa-v-' + layer.id + '">' + pct + '%</span>';
  list.appendChild(opaDiv);

  // Choroplèthe (uniquement si des champs numériques ont été détectés)
  var choroDiv = null;
  if (layer.numericFields.length) {
    choroDiv = document.createElement('div');
    choroDiv.className = 'lib-opa-row';
    choroDiv.id = 'lib-choro-row-' + layer.id;
    choroDiv.style.cssText = 'flex-wrap:wrap;gap:5px 6px;padding:2px 4px 6px 34px';
    var choroSel = document.createElement('select');
    choroSel.style.cssText = 'flex:1;min-width:0;font-size:10.5px;padding:2px 4px;border:1px solid var(--border);border-radius:4px';
    var optFlat = document.createElement('option');
    optFlat.value = ''; optFlat.textContent = '— couleur unie —';
    choroSel.appendChild(optFlat);
    layer.numericFields.forEach(function(f) {
      var o = document.createElement('option'); o.value = f; o.textContent = f;
      choroSel.appendChild(o);
    });
    var choroPalSel = document.createElement('select');
    choroPalSel.style.cssText = 'flex:0 0 auto;font-size:10.5px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;display:none';
    CHORO_PALS.forEach(function(p) {
      var o = document.createElement('option'); o.value = p.id; o.textContent = p.label || p.id;
      choroPalSel.appendChild(o);
    });
    var choroStepsSel = document.createElement('select');
    choroStepsSel.title = 'Nombre de classes';
    choroStepsSel.style.cssText = 'flex:0 0 auto;font-size:10.5px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;display:none';
    [3,4,5,6,7].forEach(function(n) {
      var o = document.createElement('option'); o.value = n; o.textContent = n + ' classes';
      if (n === 5) o.selected = true;
      choroStepsSel.appendChild(o);
    });
    var choroLegend = document.createElement('div');
    choroLegend.style.cssText = 'flex-basis:100%;display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:2px';
    choroDiv.appendChild(choroSel);
    choroDiv.appendChild(choroPalSel);
    choroDiv.appendChild(choroStepsSel);
    choroDiv.appendChild(choroLegend);
    list.appendChild(choroDiv);

    function _applyChoro() {
      var field = choroSel.value;
      if (!field) {
        layer.choro = null;
        choroPalSel.style.display = 'none';
        choroStepsSel.style.display = 'none';
        choroLegend.innerHTML = '';
      } else {
        layer.choro = _computeLayerChoro(layer, field, choroPalSel.value, parseInt(choroStepsSel.value, 10));
        choroPalSel.style.display = '';
        choroStepsSel.style.display = '';
        _renderChoroLegend(layer, choroLegend);
      }
      _setUserLayerColor(layer);
    }
    choroSel.addEventListener('change', _applyChoro);
    choroPalSel.addEventListener('change', _applyChoro);
    choroStepsSel.addEventListener('change', _applyChoro);
  }

  // ── Events ───────────────────────────────────────────────────────
  var id = layer.id;

  // Checkbox
  var chk = div.querySelector('input[type=checkbox]');
  chk.addEventListener('change', function() {
    layer.visible = chk.checked;
    var vis = layer.visible ? 'visible' : 'none';
    if (_map) {
      ['ulyr-'+id, 'ulyr2-'+id].forEach(function(l) {
        if (_map.getLayer(l)) _map.setLayoutProperty(l, 'visibility', vis);
      });
    }
    opaDiv.style.display = layer.visible ? 'flex' : 'none';
    if (choroDiv) choroDiv.style.display = layer.visible ? 'flex' : 'none';
    _updateLibraryBasemapFocus();
  });

  // Opacity
  var slider = opaDiv.querySelector('input[type=range]');
  var valSpan = opaDiv.querySelector('span');
  slider.addEventListener('input', function() {
    layer.opacity = parseFloat(slider.value);
    valSpan.textContent = Math.round(layer.opacity * 100) + '%';
    _setUserLayerOpacity(layer);
  });

  // Color swatch → color picker
  var dot = document.getElementById('lib-dot-' + id);
  var colorPicker = document.getElementById('lib-color-' + id);
  dot.addEventListener('click', function() { colorPicker.click(); });
  colorPicker.addEventListener('input', function() {
    layer.color = colorPicker.value;
    dot.style.background = layer.color;
    _setUserLayerColor(layer);
  });

  // Delete
  div.querySelector('.lib-del-btn').addEventListener('click', function() {
    if (!confirm('Supprimer la couche "' + layer.name + '" ?')) return;
    _removeUserLayer(id);
  });
}

// ── Upload / drag-drop wiring ─────────────────────────────────────
function _wireLibUpload() {
  var dropZone   = document.getElementById('lib-drop-zone');
  var browseLink = document.getElementById('lib-browse-link');
  var fileInput  = document.getElementById('lib-file-input');
  var form       = document.getElementById('lib-add-form');
  var nameInput  = document.getElementById('lib-add-name');
  var colorInput = document.getElementById('lib-add-color');
  var swatch     = document.getElementById('lib-color-swatch');
  var confirmBtn = document.getElementById('lib-add-confirm');
  var cancelBtn  = document.getElementById('lib-add-cancel');
  var filenameEl = document.getElementById('lib-add-filename');
  if (!dropZone || !fileInput) return;

  var _pending = [];
  var _pendingIdx = 0;
  var _pendingParsed = null;

  function _humanName(filename) {
    return filename.replace(/\.(geojson|json)$/i,'').replace(/[_\-\.]/g,' ')
                   .replace(/\w/g, function(c){ return c.toUpperCase(); });
  }

  function _showForm(file) {
    filenameEl.textContent = '📄 ' + file.name;
    nameInput.value = _humanName(file.name);
    colorInput.value = _nextLibColor();
    swatch.style.background = colorInput.value;
    form.style.display = 'block';
    setTimeout(function() { nameInput.focus(); nameInput.select(); }, 50);
  }

  function _processNext() {
    if (_pendingIdx >= _pending.length) { form.style.display = 'none'; return; }
    var file = _pending[_pendingIdx];
    _pendingParsed = null;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var raw = JSON.parse(e.target.result);
        if (!raw || !raw.type) throw new Error('JSON invalide (pas de "type")');
        // Normaliser en FeatureCollection
        if (raw.type === 'FeatureCollection') {
          _pendingParsed = raw;
        } else if (raw.type === 'Feature') {
          _pendingParsed = { type:'FeatureCollection', features:[raw] };
        } else if (raw.coordinates) {
          _pendingParsed = { type:'FeatureCollection', features:[{type:'Feature',geometry:raw,properties:{}}] };
        } else if (raw.type === 'GeometryCollection') {
          _pendingParsed = { type:'FeatureCollection', features:(raw.geometries||[]).map(function(g){
            return {type:'Feature',geometry:g,properties:{}};
          })};
        } else {
          throw new Error('Type GeoJSON non reconnu : ' + raw.type);
        }
        _showForm(file);
      } catch(err) {
        setStatus('✗ ' + file.name + ' : ' + err.message);
        _pendingIdx++;
        _processNext();
      }
    };
    reader.onerror = function() {
      setStatus('✗ Impossible de lire ' + file.name);
      _pendingIdx++;
      _processNext();
    };
    reader.readAsText(file);
  }

  function _openFiles(files) {
    _pending = Array.from(files);
    _pendingIdx = 0;
    _processNext();
  }

  // Drag and drop
  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer && e.dataTransfer.files.length) _openFiles(e.dataTransfer.files);
  });

  // Click on drop zone or browse link
  dropZone.addEventListener('click', function() { fileInput.click(); });
  if (browseLink) browseLink.addEventListener('click', function(e) { e.stopPropagation(); fileInput.click(); });

  fileInput.addEventListener('change', function() {
    if (fileInput.files && fileInput.files.length) {
      _openFiles(fileInput.files);
      fileInput.value = '';
    }
  });

  // Color swatch in form
  swatch.addEventListener('click', function() { colorInput.click(); });
  colorInput.addEventListener('input', function() { swatch.style.background = colorInput.value; });

  // Confirm
  confirmBtn.addEventListener('click', function() {
    if (!_pendingParsed) return;
    var name  = nameInput.value.trim() || (_pending[_pendingIdx] && _pending[_pendingIdx].name) || 'Couche';
    var color = colorInput.value;
    _addUserLayer(name, _pendingParsed, color);
    _libPaletteIdx++;
    _pendingIdx++;
    _processNext();
  });

  nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') confirmBtn.click(); });

  // Cancel current file
  cancelBtn.addEventListener('click', function() {
    _pendingIdx++;
    _processNext();
    if (_pendingIdx >= _pending.length) form.style.display = 'none';
  });
}


// ══════════════════════════════════════════════════════════════════
