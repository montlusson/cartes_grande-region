//  TOOLTIP (hover / clic) — couche active + couche "blocs"
// ══════════════════════════════════════════════════════════════════

var _ttWiredLayers = {};

function _wireTooltipEvents() {
  [BLOCS_FILL_ID, ACTIVE_FILL_ID].forEach(function(layerId) {
    if (!_map.getLayer(layerId) || _ttWiredLayers[layerId]) return;
    _ttWiredLayers[layerId] = true;

    _map.on('mousemove', layerId, function(e) {
      if (_ttPinned) return;
      if (!e.features || !e.features.length) return;
      // Préférer la couche active (premier plan) si elle est sous le curseur
      var feats = _map.queryRenderedFeatures(e.point, {
        layers: [ACTIVE_FILL_ID, BLOCS_FILL_ID].filter(function(l){ return _map.getLayer(l); })
      });
      if (!feats.length) return;
      _showTooltip(e, feats[0]);
      _map.getCanvas().style.cursor = 'pointer';
    });
    _map.on('mouseleave', layerId, function() {
      _map.getCanvas().style.cursor = '';
      if (!_ttPinned) _hideTooltip();
    });
    _map.on('click', layerId, function(e) {
      var feats = _map.queryRenderedFeatures(e.point, {
        layers: [ACTIVE_FILL_ID, BLOCS_FILL_ID].filter(function(l){ return _map.getLayer(l); })
      });
      if (!feats.length) return;
      _ttPinned = !_ttPinned;
      _showTooltip(e, feats[0]);
    });
  });

  if (!_ttWiredLayers['__bgclick']) {
    _ttWiredLayers['__bgclick'] = true;
    _map.on('click', function(e) {
      var layers = [ACTIVE_FILL_ID, BLOCS_FILL_ID].filter(function(l){ return _map.getLayer(l); });
      var feats = _map.queryRenderedFeatures(e.point, {layers: layers});
      if (!feats.length) { _ttPinned = false; _hideTooltip(); }
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  CHOROPLÈTHE — FONCTIONS
// ══════════════════════════════════════════════════════════════════

// Normalise une chaîne pour la jointure (insensible casse, accents, ponctuation)
function _normStr(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

// Utilitaires couleur hex ↔ RGB (pas de D3 disponible)
function _hexToRgb(hex) {
  var h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function _rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(function(v){
    return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  }).join('');
}

// Interpole N couleurs entre les stops d'une palette (3 stops → N couleurs)
function _interpolatePalette(stops, n) {
  if (n <= 1) return [stops[Math.floor(stops.length / 2)]];
  var colors = [];
  for (var i = 0; i < n; i++) {
    var t   = i / (n - 1);
    var seg = t * (stops.length - 1);
    var lo  = Math.floor(seg);
    var hi  = Math.min(lo + 1, stops.length - 1);
    var f   = seg - lo;
    var c0  = _hexToRgb(stops[lo]);
    var c1  = _hexToRgb(stops[hi]);
    colors.push(_rgbToHex(c0[0]+(c1[0]-c0[0])*f, c0[1]+(c1[1]-c0[1])*f, c0[2]+(c1[2]-c0[2])*f));
  }
  return colors;
}

// Construit l'échelle quantile : remplit _choroBreaks et _choroColors
function _buildChoroScale(valsOverride) {
  if (!_csvData || !_valueCol) return;
  var vals;
  if (valsOverride && valsOverride.length) {
    vals = valsOverride.slice();
  } else {
    vals = [];
    _csvData.rows.forEach(function(r) {
      var v = parseFloat(r[_valueCol]);
      if (!isNaN(v)) vals.push(v);
    });
  }
  if (!vals.length) return;
  vals.sort(function(a, b) { return a - b; });

  // N-1 seuils pour N classes (quantile uniforme)
  _choroBreaks = [];
  for (var i = 1; i < _choroSteps; i++) {
    var idx = Math.floor(vals.length * i / _choroSteps);
    _choroBreaks.push(vals[idx]);
  }

  // Interpoler les couleurs depuis les 3 stops de la palette choisie
  var palObj = CHORO_PALS.find(function(p) { return p.id === _choroPalette; }) || CHORO_PALS[0];
  _choroColors = _interpolatePalette(palObj.c, _choroSteps);
}

// Mode catégoriel : une couleur fixe par valeur distincte (partis, etc.),
// classées par fréquence décroissante. Couleur attitrée si connue, sinon repli.
function _buildCatScale(rawVals) {
  var freq = {};
  rawVals.forEach(function(v) {
    var c = String(v).trim();
    if (c) freq[c] = (freq[c] || 0) + 1;
  });
  var cats = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a] || a.localeCompare(b); });
  _catColors = {};
  var fb = 0;
  cats.forEach(function(c) {
    var known = PARTY_COLORS[_normStr(c)];
    _catColors[c] = known || CAT_FALLBACK[fb++ % CAT_FALLBACK.length];
    if (_catOverrides[c] !== undefined) _catColors[c] = _catOverrides[c];
  });
  _choroBreaks = []; _choroColors = [];
}

// Retourne la couleur choroplèthe pour une valeur brute
function _choroColor(val) {
  if (_catMode) {
    var c = String(val === undefined || val === null ? '' : val).trim();
    return (c && _catColors[c] !== undefined) ? _catColors[c] : '#ccc';
  }
  var v = parseFloat(val);
  if (isNaN(v) || !_choroColors.length) return '#ccc';
  var cls = 0;
  while (cls < _choroBreaks.length && v >= _choroBreaks[cls]) cls++;
  return _choroColors[cls] || '#ccc';
}

// Repeint la choroplèthe (carte + légende) sans toucher au panneau de couleurs
// — utilisé pendant la sélection au color picker pour ne pas casser l'input.
function _repaintChoro() {
  if (_fillLayer === 'blocs' && _mapReady && _map.getLayer(BLOCS_FILL_ID)) {
    _map.setPaintProperty(BLOCS_FILL_ID, 'fill-color', _fillColorExpression());
  } else {
    _redrawFill();
  }
  _updateLegend();
  _refreshAllOverlays();
}

// Panneau « Couleurs des catégories » : un sélecteur par catégorie.
// Masque la section quantiles (palettes/classes), sans objet en mode catégoriel.
function _renderCatColorUI() {
  var wrap = document.getElementById('cat-colors-wrap');
  var box  = document.getElementById('cat-colors');
  var num  = document.getElementById('section-choro-num');
  var active = _catMode && Object.keys(_catColors).length > 0;
  if (num) num.style.display = active ? 'none' : '';
  if (!wrap || !box) return;
  if (!active) { wrap.style.display = 'none'; box.innerHTML = ''; return; }
  wrap.style.display = 'block';
  box.innerHTML = '';
  Object.keys(_catColors).forEach(function(cat) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:3px 0';
    var inp = document.createElement('input');
    inp.type = 'color';
    inp.value = _catColors[cat];
    inp.setAttribute('aria-label', 'Couleur pour ' + cat);
    inp.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;flex:none;background:none';
    var hex = document.createElement('input');
    hex.type = 'text';
    hex.value = _catColors[cat];
    hex.spellcheck = false;
    hex.setAttribute('aria-label', 'Code hexadécimal pour ' + cat);
    hex.style.cssText = 'width:74px;font-family:monospace;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;flex:none';
    function _setCatColor(v) {
      _catOverrides[cat] = v;
      _catColors[cat] = v;
      inp.value = v;
      hex.value = v;
      _repaintChoro();
    }
    inp.addEventListener('input', function() { _setCatColor(this.value); });
    hex.addEventListener('change', function() {
      var v = String(this.value).trim().replace(/^#/, '').toLowerCase();
      if (/^[0-9a-f]{3}$/.test(v)) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
      if (/^[0-9a-f]{6}$/.test(v)) _setCatColor('#' + v);
      else this.value = _catColors[cat];   // saisie invalide → on restaure
    });
    var lbl = document.createElement('span');
    lbl.textContent = cat;
    lbl.title = cat;
    lbl.style.cssText = 'font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    row.appendChild(inp); row.appendChild(hex); row.appendChild(lbl);
    box.appendChild(row);
  });
}

// Extrait la clé de jointure d'une feature GeoJSON selon le type sélectionné
function _getJoinKey(feat) {
  var p  = (feat && feat.properties) ? feat.properties : feat || {};
  var el = document.getElementById('join-type');
  var jt = el ? el.value : 'name';
  if (jt === 'name')   return _normStr(p.name || '');
  if (jt === 'region') return _normStr(p.region || '');
  if (jt === 'insee' || jt === 'ags' || jt === 'nis' || jt === 'lux') return p.code || '';
  return _normStr(p.name || '');
}

// Clés de jointure réellement présentes dans les couches chargées
function _collectFeatureKeys() {
  var keys = {};
  var el = document.getElementById('join-type');
  var jt = el ? el.value : 'name';
  if (jt === 'region') {
    Object.keys(BLOC_COLORS).forEach(function(r) { keys[_normStr(r)] = true; });
    return keys;
  }
  Object.keys(_cache).forEach(function(id) {
    ((_cache[id] && _cache[id].features) || []).forEach(function(f) {
      var k = _getJoinKey(f);
      if (k) keys[k] = true;
    });
  });
  return keys;
}

// Construit _dataMap à partir de _csvData puis redessine
