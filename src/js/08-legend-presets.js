//  LÉGENDE
// ══════════════════════════════════════════════════════════════════

// Arrondi des nombres affichés dans les légendes (choroplèthe + échelle des
// flux) — 'auto' garde le formatage malin existant (entier si rond, sinon 1
// décimale) ; sinon un nombre de décimales fixe choisi par l'utilisateur
// (onglet Style) pour toutes les légendes numériques de la carte.
var _legendDecimals = 'auto';
function _legendFmtNum(v) {
  if (_legendDecimals === 'auto') return _fmtChoroNum(v);
  return parseFloat(v).toFixed(parseInt(_legendDecimals, 10)).toString().replace('.', ',');
}

function _updateLegend() {
  var el = document.getElementById('map-legend');
  el.className = 'pos-' + _legendPos;
  el.innerHTML = '';

  // Légende catégorielle (parti vainqueur, etc.) — _choroIsRendered() évite
  // de décrire un remplissage qui n'est plus réellement affiché (fond
  // "Aucune", jointure par région désactivée, jointure invalidée entretemps…).
  if (_choroIsRendered() && _catMode) {
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
    _appendFlowLegend(el);
    return;
  }

  // Légende choroplèthe (prioritaire si données chargées) — pastilles
  // éditables au clic (couleur personnalisée par classe), comme la légende
  // des couches Bibliothèque (_renderChoroLegend, js/19-library-focus.js).
  if (_choroIsRendered() && _choroColors.length) {
    _choroColors.forEach(function(_unused, i) {
      var color = _choroColorAt(i);
      var lo  = _choroBreaks[i - 1];
      var hi  = _choroBreaks[i];
      var lbl = (lo !== undefined ? '≥' + _legendFmtNum(lo) : '')
              + (lo !== undefined && hi !== undefined ? ' — ' : '')
              + (hi !== undefined ? '<' + _legendFmtNum(hi) : (lo !== undefined ? '+' : ''));
      if (!lbl) lbl = '—';
      var item = document.createElement('span');
      item.className = 'leg-item';
      item.innerHTML =
        '<span class="leg-swatch" style="background:'+color+';cursor:pointer" title="Changer la couleur de cette classe"></span>'
        + '<input type="color" value="'+color+'" style="position:absolute;opacity:0;width:0;height:0">'
        + '<span style="font-size:10px">'+lbl+'</span>';
      var sw = item.querySelector('.leg-swatch'), pk = item.querySelector('input[type=color]');
      sw.addEventListener('click', function() { pk.click(); });
      pk.addEventListener('input', function() {
        _choroColorOverrides[i] = pk.value;
        sw.style.background = pk.value;
        _repaintChoro(true); // true = ne pas reconstruire la légende (fermerait le picker natif en pleine sélection)
      });
      el.appendChild(item);
    });
    _appendFlowLegend(el);
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
    _appendFlowLegend(el);
    return;
  }

  // Légende par bloc régional : inutile si une seule région est affichée
  // (rien à comparer — cf. _fillColorExpression, même condition) — la
  // légende des flux reste pertinente même dans ce cas, d'où l'appel avant le retour.
  var activeCount = Object.keys(_activeBlocs).filter(function(b) { return _activeBlocs[b]; }).length;
  if (activeCount === 1) { _appendFlowLegend(el); return; }

  Object.keys(BLOC_COLORS).forEach(function(region) {
    if (!_activeBlocs[region]) return;
    var item = document.createElement('span');
    item.className = 'leg-item';
    item.innerHTML = '<span class="leg-swatch" style="background:' + BLOC_COLORS[region] + '"></span><span style="font-size:11px">' + BLOC_LABELS[region] + '</span>';
    el.appendChild(item);
  });
  _appendFlowLegend(el);
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
