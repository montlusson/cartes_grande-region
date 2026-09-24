//  LÉGENDE
// ══════════════════════════════════════════════════════════════════

function _updateLegend() {
  var el = document.getElementById('map-legend');
  el.innerHTML = '';

  // Légende catégorielle (parti vainqueur, etc.)
  if (Object.keys(_dataMap).length && _valueCol && _catMode) {
    Object.keys(_catColors).forEach(function(cat) {
      var item = document.createElement('span');
      item.className = 'leg-item';
      item.innerHTML = '<span class="leg-swatch" style="background:'+_catColors[cat]+'"></span>'
                     + '<span style="font-size:10px">'+_escHtml(cat)+'</span>';
      el.appendChild(item);
    });
    var nd = document.createElement('span');
    nd.className = 'leg-item';
    nd.innerHTML = '<span class="leg-swatch" style="background:#ccc"></span>'
                 + '<span style="font-size:10px">Sans donnée</span>';
    el.appendChild(nd);
    return;
  }

  // Légende choroplèthe (prioritaire si données chargées)
  if (Object.keys(_dataMap).length && _valueCol && _choroColors.length) {
    _choroColors.forEach(function(color, i) {
      var lo  = _choroBreaks[i - 1];
      var hi  = _choroBreaks[i];
      var lbl = (lo !== undefined ? '≥' + parseFloat(lo).toFixed(1) : '')
              + (lo !== undefined && hi !== undefined ? ' — ' : '')
              + (hi !== undefined ? '<' + parseFloat(hi).toFixed(1) : (lo !== undefined ? '+' : ''));
      if (!lbl) lbl = '—';
      var item = document.createElement('span');
      item.className = 'leg-item';
      item.innerHTML = '<span class="leg-swatch" style="background:'+color+'"></span>'
                     + '<span style="font-size:10px">'+lbl+'</span>';
      el.appendChild(item);
    });
    return;
  }

  if (_activeFillLayerId && SUBDIV_IDS.indexOf(_activeFillLayerId) !== -1) {
    // Légende par bloc régional (les subdivisions sont coloriées en dégradé par région)
    Object.keys(BLOC_SUBDIV_PALETTES).forEach(function(region) {
      if (!_activeBlocs[region]) return;
      var item = document.createElement('span');
      item.className = 'leg-item';
      var pal  = BLOC_SUBDIV_PALETTES[region];
      var grad = 'linear-gradient(90deg,' + pal.join(',') + ')';
      item.innerHTML = '<span class="leg-swatch" style="background:' + grad + '"></span><span style="font-size:11px">' + BLOC_LABELS[region] + '</span>';
      el.appendChild(item);
    });
    return;
  }

  Object.keys(BLOC_COLORS).forEach(function(region) {
    if (!_activeBlocs[region]) return;
    var item = document.createElement('span');
    item.className = 'leg-item';
    item.innerHTML = '<span class="leg-swatch" style="background:' + BLOC_COLORS[region] + '"></span><span style="font-size:11px">' + BLOC_LABELS[region] + '</span>';
    el.appendChild(item);
  });
}

// ══════════════════════════════════════════════════════════════════
//  PRESETS — vues rapides
// ══════════════════════════════════════════════════════════════════

function applyPreset(name) {
  var cfg = PRESETS[name];
  if (!cfg) return;

  document.querySelectorAll('.preset-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.preset === name);
  });

  var sel = document.getElementById('fill-layer-sel');
  if (sel) sel.value = cfg.fill;
  _fillLayer = cfg.fill;

  // Mettre à jour les cases à cocher d'overlays selon le preset
  var allKnownOverlays = Object.keys(_activeLayers).concat(Object.keys(cfg.overlays));
  allKnownOverlays.forEach(function(id) {
    var on = !!cfg.overlays[id];
    _activeLayers[id] = on;
    var chk = document.getElementById('chk-' + id);
    if (chk) chk.checked = on;
    if (_mapReady) { if (on) _redrawOverlay(id); else _removeOverlay(id); }
  });

  var layersToLoad = Object.keys(cfg.overlays).filter(function(id) {
    return cfg.overlays[id] && id !== 'blocs' && !_cache[id];
  });
  if (cfg.fill !== 'none' && cfg.fill !== 'blocs' && !_cache[cfg.fill]) {
    layersToLoad.push(cfg.fill);
  }

  if (!layersToLoad.length) {
    _redrawFill();
    _refreshAllOverlays();
    _updateLegend();
    return;
  }

  showLoading('Chargement des couches…', layersToLoad.join(', '));
  Promise.all(layersToLoad.map(function(id) { return _ensureLayer(id); }))
    .then(function() {
      hideLoading();
      _redrawFill();
      _refreshAllOverlays();
      _updateLegend();
      setStatus('Vue "' + name + '" chargée — ' + layersToLoad.length + ' couche(s) supplémentaire(s)');
    })
    .catch(function(e) { hideLoading(); setStatus('Erreur: ' + e); });
}

// ══════════════════════════════════════════════════════════════════
