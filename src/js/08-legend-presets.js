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

  // Légende par bloc régional : inutile si une seule région est affichée
  // (rien à comparer — cf. _fillColorExpression, même condition).
  var activeCount = Object.keys(_activeBlocs).filter(function(b) { return _activeBlocs[b]; }).length;
  if (activeCount === 1) return;

  Object.keys(BLOC_COLORS).forEach(function(region) {
    if (!_activeBlocs[region]) return;
    var item = document.createElement('span');
    item.className = 'leg-item';
    item.innerHTML = '<span class="leg-swatch" style="background:' + BLOC_COLORS[region] + '"></span><span style="font-size:11px">' + BLOC_LABELS[region] + '</span>';
    el.appendChild(item);
  });
}

// ── Couleurs des blocs (onglet Style) : un sélecteur par territoire ──
function _renderBlocColorPickers() {
  var box = document.getElementById('bloc-colors');
  if (!box) return;
  box.innerHTML = '';
  Object.keys(BLOC_COLORS).forEach(function(region) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0';
    var lbl = document.createElement('span');
    lbl.textContent = BLOC_LABELS[region] || region;
    lbl.style.cssText = 'font-size:11px;flex:1';
    var inp = document.createElement('input');
    inp.type = 'color';
    inp.value = BLOC_COLORS[region];
    inp.setAttribute('aria-label', 'Couleur pour ' + region);
    inp.style.cssText = 'width:28px;height:24px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;flex:none;background:none';
    inp.addEventListener('input', function() {
      BLOC_COLORS[region] = this.value;
      _drawBlocs();
      _updateLegend();
      _applyStrokeColors(); // recalcule aussi les traits des niveaux intermédiaires (dérivés de BLOC_COLORS)
    });
    row.appendChild(lbl);
    row.appendChild(inp);
    box.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════════
