//  INIT
// ══════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════
//  RECHERCHE CARTE — barre flottante avec autocomplétion
// ══════════════════════════════════════════════════════════════════

var _srInput = null, _srList = null, _srClear = null;
var _srItems = [];   // [{name, sub, feat}] — résultats filtrés
var _srActive = -1;  // index surligné au clavier
var _srBusy = false; // chargement communes en cours
var _srPin = null;   // marqueur temporaire

function _srBuildCandidates() {
  var order = ['communes','cantons_lux','cantons_lor','vg_rlp','arr_wal','arr_lor',
               'kreise_rlp','landkreise_sar','provinces_wal','depts_lor'];
  var seen = {}, all = [];
  order.forEach(function(id) {
    var geo = _cache[id]; if (!geo) return;
    (geo.features || []).forEach(function(f) {
      if (!_inGRBounds(f)) return;
      var nm = (f.properties || {}).name || ''; if (!nm) return;
      var key = _normStr(nm); if (seen[key]) return;
      seen[key] = true;
      var h = getHierarchy(f);
      var sub = h.kreis || h.arrondissement || h.canton || h.province || h.dept || h.region || '';
      all.push({ name: nm, sub: sub, feat: f });
    });
  });
  return all;
}

function _srFilter(q) {
  var qn = _normStr(q); if (!qn) { _srItems = []; return; }
  var all = _srBuildCandidates();
  var exact = [], prefix = [], contains = [];
  all.forEach(function(c) {
    var cn = _normStr(c.name);
    if (cn === qn)                exact.push(c);
    else if (cn.indexOf(qn) === 0) prefix.push(c);
    else if (cn.indexOf(qn) >= 0)  contains.push(c);
  });
  _srItems = exact.concat(prefix, contains).slice(0, 10);
}

function _srRender() {
  _srList.innerHTML = ''; _srActive = -1;
  if (!_srItems.length) { _srList.classList.remove('vis'); return; }
  _srItems.forEach(function(c, i) {
    var li = document.createElement('div');
    li.className = 'msl-item'; li.setAttribute('role', 'option'); li.id = 'msl-' + i;
    li.innerHTML = _escHtml(c.name) + (c.sub ? '<span class="msl-sub">' + _escHtml(c.sub) + '</span>' : '');
    li.addEventListener('mousedown', function(ev) { ev.preventDefault(); _srSelect(i); });
    _srList.appendChild(li);
  });
  _srList.classList.add('vis');
}

function _srClearPin() {
  if (_srPin) { _srPin.remove(); _srPin = null; }
}

function _srSelect(i) {
  var c = _srItems[i]; if (!c) return;
  _srInput.value = c.name;
  _srItems = []; _srList.classList.remove('vis');
  _srClear.classList.add('vis');
  _srClearPin();
  var center = _featCenter(c.feat);
  var codeLen = String((c.feat.properties || {}).code || '').length;
  var targetZ = Math.max(_map.getZoom(), codeLen >= 5 ? 10 : codeLen >= 3 ? 8 : 7);
  _map.flyTo({ center: center, zoom: targetZ, duration: 650 });
  _ttPinned = false;
  _map.once('moveend', function() {
    var el = document.createElement('div');
    el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:var(--accent);border:2px solid #fff;box-shadow:0 0 0 2px var(--accent);pointer-events:none';
    _srPin = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(center).addTo(_map);
    var proj = _map.project(center);
    _showTooltip({ point: proj }, c.feat);
    _ttPinned = true;
  });
}

function _srAutoLoad(q) {
  if (_srBusy) return;
  _srBusy = true;
  _srList.innerHTML = '<div class="msl-hint">Chargement des communes…</div>';
  _srList.classList.add('vis');
  _ensureLayer('communes').then(function() {
    _srBusy = false; _srFilter(q); _srRender();
    if (!_srItems.length) {
      _srList.innerHTML = '<div class="msl-hint">Aucun résultat</div>';
      _srList.classList.add('vis');
    }
  }).catch(function() { _srBusy = false; _srList.classList.remove('vis'); });
}

function _srInputHandler() {
  var q = (_srInput.value || '').trim();
  _srClear.classList.toggle('vis', q.length > 0);
  if (!q) { _srItems = []; _srList.classList.remove('vis'); return; }
  _srFilter(q);
  if (_srItems.length) { _srRender(); return; }
  if (!_cache['communes']) { _srAutoLoad(q); return; }
  _srList.innerHTML = '<div class="msl-hint">Aucun résultat</div>';
  _srList.classList.add('vis');
}

function _srKeyHandler(e) {
  var open = _srList.classList.contains('vis');
  if (e.key === 'Escape') {
    if (open) { _srItems = []; _srList.classList.remove('vis'); }
    else { _srInput.value = ''; _srClear.classList.remove('vis'); _srClearPin(); _srInput.blur(); }
    return;
  }
  if (!open) return;
  var nodes = _srList.querySelectorAll('.msl-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _srActive = Math.min(_srActive + 1, nodes.length - 1);
    nodes.forEach(function(n, i) { n.classList.toggle('msl-active', i === _srActive); });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _srActive = Math.max(_srActive - 1, 0);
    nodes.forEach(function(n, i) { n.classList.toggle('msl-active', i === _srActive); });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    _srSelect(_srActive >= 0 ? _srActive : 0);
  }
}

function _initSearch() {
  _srInput = document.getElementById('map-search-input');
  _srList  = document.getElementById('map-search-list');
  _srClear = document.getElementById('map-search-clear');
  if (!_srInput) return;
  _srInput.addEventListener('input',   _srInputHandler);
  _srInput.addEventListener('keydown', _srKeyHandler);
  _srInput.addEventListener('focus',   function() { if ((_srInput.value || '').trim()) _srInputHandler(); });
  _srInput.addEventListener('blur',    function() { setTimeout(function() { _srList.classList.remove('vis'); }, 160); });
  _srClear.addEventListener('click',   function() {
    _srInput.value = ''; _srClear.classList.remove('vis');
    _srItems = []; _srList.classList.remove('vis'); _srClearPin(); _srInput.focus();
  });
  document.addEventListener('keydown', function(e) {
    var tag = (document.activeElement || {}).tagName || '';
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); _srInput.focus(); _srInput.select();
    }
  });
}

// ══════════════════════════════════════════════════════════════════
//  PRÉVISUALISATION RESPONSIVE — Desktop / Mobile
// ══════════════════════════════════════════════════════════════════

function _initPreviewToggle() {
  var btnD    = document.getElementById('btn-preview-desktop');
  var btnM    = document.getElementById('btn-preview-mobile');
  var devSel  = document.getElementById('device-select');
  var cwInput = document.getElementById('pv-custom-w');
  var chInput = document.getElementById('pv-custom-h');
  var btnRot  = document.getElementById('btn-pv-rotate');
  var btnExit = document.getElementById('btn-exit-preview');
  var pvLabel = document.getElementById('pv-dims-label');
  if (!btnD || !btnM) return;

  var DEVICES = {
    '360x780': {w:360,h:780}, '402x873': {w:402,h:873},
    '440x956': {w:440,h:956}, '412x924': {w:412,h:924},
    '1032x1376': {w:1032,h:1376}
  };
  var _pvW = 360, _pvH = 780, _pvRotated = false;

  // Datawrapper-style : padding proportionnel à la largeur du container
  function _pvPad() {
    var el = document.getElementById('map-frame');
    var w = el ? el.offsetWidth : 800;
    return Math.max(8, Math.round(w * 0.04));
  }

  // Recadrage adaptatif — double-rAF pour attendre la fin du layout
  function _pvFitBounds(animate) {
    if (!_map || !_mapReady) return;
    var bb = (typeof _getActiveBlocsBbox === 'function') ? _getActiveBlocsBbox() : GR_BOUNDS;
    _map.fitBounds(bb, { padding: _pvPad(), duration: animate === false ? 0 : 350 });
    _map.once('moveend', function() {
      _zoomBase = _map.getZoom();
      if (typeof _updateZoomLevel === 'function') _updateZoomLevel();
      if (typeof _updateZoomBtns  === 'function') _updateZoomBtns();
    });
  }

  function _pvScheduleFit(animate) {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (typeof _syncMapChrome === 'function') _syncMapChrome();
        if (!_map) return;
        _map.resize();
        _pvFitBounds(animate);
      });
    });
  }

  // Espace réellement disponible pour la coque du mockup, pour qu'un
  // appareil plus haut que la fenêtre (ex. iPhone 14 Pro sur un petit écran)
  // tienne entièrement à l'écran plutôt que de forcer un défilement.
  function _pvAvailable() {
    var el = document.getElementById('preview');
    var bar = document.getElementById('preview-bar');
    if (!el) return {w: 1200, h: 800};
    var barH = (bar && bar.offsetHeight) || 0;
    var shellMargin = 48; // margin:24px auto (haut+bas) sur #preview-shell
    var sidePad = 32;     // marge de respiration latérale
    return {
      w: Math.max(200, el.clientWidth - sidePad),
      h: Math.max(200, el.clientHeight - barH - shellMargin)
    };
  }

  function _pvApply() {
    var w = _pvRotated ? _pvH : _pvW;
    var h = _pvRotated ? _pvW : _pvH;

    var bezel = 20; // border:10px de chaque côté sur #preview-shell
    var avail = _pvAvailable();
    var scale = Math.min(1, avail.w / (w + bezel), avail.h / (h + bezel));
    var renderW = Math.round(w * scale);
    var renderH = Math.round(h * scale);

    document.documentElement.style.setProperty('--pv-w', renderW + 'px');
    document.documentElement.style.setProperty('--pv-h', renderH + 'px');
    document.body.classList.toggle('pv-tablet', w >= 600);
    // Air entre la carte et le bord du mockup téléphone (cf. note CSS sur
    // #map-frame : un padding CSS ne suffit pas ici, piloté directement).
    // En haut, l'encoche (::before sur #preview-shell, 20px) déborde de 10px
    // dans #map-frame (bordure du mockup 10px) : sans marge du haut plus
    // large que les autres côtés, l'encoche recouvre le haut de la carte.
    var mapDiv = document.getElementById('maplibre-map');
    if (mapDiv) mapDiv.style.inset = (w < 600) ? '14px 8px 8px' : '0';
    if (pvLabel) {
      pvLabel.textContent = w + ' × ' + h + ' px' + (scale < 0.999 ? ' (affiché à ' + Math.round(scale * 100) + '%)' : '');
    }
    _pvScheduleFit(true);
  }

  function _setPreviewMode(on) {
    document.body.classList.toggle('preview-mode', on);
    btnD.setAttribute('aria-pressed', on ? 'false' : 'true');
    btnM.setAttribute('aria-pressed', on ? 'true' : 'false');
    btnD.classList.toggle('active', !on);
    btnM.classList.toggle('active',  on);
    if (on) { _pvRotated = false; _pvApply(); }
    else {
      document.documentElement.style.removeProperty('--pv-w');
      document.documentElement.style.removeProperty('--pv-h');
      document.body.classList.remove('pv-tablet');
      var mapDiv = document.getElementById('maplibre-map');
      if (mapDiv) mapDiv.style.inset = '0';
      _pvScheduleFit(true);
    }
  }

  // Fenêtre redimensionnée pendant que le mockup mobile est actif : on
  // recalcule l'échelle (_pvApply) pour qu'il continue de tenir à l'écran.
  var _pvResizeTimer = null;
  window.addEventListener('resize', function() {
    if (!document.body.classList.contains('preview-mode')) return;
    clearTimeout(_pvResizeTimer);
    _pvResizeTimer = setTimeout(_pvApply, 120);
  });

  // ResizeObserver : recadrage continu si la coque change de taille
  // (ex : redimensionnement de la fenêtre en mode desktop)
  if (typeof ResizeObserver !== 'undefined') {
    var _pvRoW = 0;
    var _pvRO = new ResizeObserver(function(entries) {
      var w = Math.round(entries[0].contentRect.width);
      if (w === _pvRoW || w === 0) return;
      _pvRoW = w;
      requestAnimationFrame(function() {
        if (typeof _syncMapChrome === 'function') _syncMapChrome();
        if (!_map || !_mapReady) return;
        _map.resize();
        _pvFitBounds(false);
      });
    });
    var _pvFrame = document.getElementById('map-frame');
    if (_pvFrame) _pvRO.observe(_pvFrame);

    // Légende pleine largeur en pied de page mobile (preview) : la hauteur
    // varie avec son contenu (blocs actifs, choroplèthe...) — on pousse les
    // boutons de zoom au-dessus à chaque changement plutôt que de deviner
    // une hauteur fixe.
    var legendEl = document.getElementById('map-legend');
    var zoomBtns = document.getElementById('zoom-btns');
    var zoomReset = document.getElementById('zoom-reset');
    if (legendEl && zoomBtns) {
      var _liftLegend = function() {
        var mobilePv = document.body.classList.contains('preview-mode')
          && !document.body.classList.contains('pv-tablet');
        var lift = (mobilePv && legendEl.offsetHeight) ? (legendEl.offsetHeight + 10) + 'px' : '';
        zoomBtns.style.bottom = lift;
        if (zoomReset) zoomReset.style.bottom = lift;
      };
      new ResizeObserver(_liftLegend).observe(legendEl);
    }
  }

  if (devSel) devSel.addEventListener('change', function() {
    var d = DEVICES[this.value];
    if (d) { _pvW = d.w; _pvH = d.h; }
    else {
      _pvW = parseInt((cwInput || {}).value) || 375;
      _pvH = parseInt((chInput || {}).value) || 667;
    }
    if (cwInput) cwInput.value = _pvW;
    if (chInput) chInput.value = _pvH;
    _pvRotated = false;
    _pvApply();
  });

  function _onCustomDim() {
    if (devSel) devSel.value = 'custom';
    _pvW = Math.max(280, Math.min(1400, parseInt((cwInput || {}).value) || 375));
    _pvH = Math.max(400, Math.min(1200, parseInt((chInput || {}).value) || 667));
    _pvRotated = false;
    _pvApply();
  }
  if (cwInput) cwInput.addEventListener('change', _onCustomDim);
  if (chInput) chInput.addEventListener('change', _onCustomDim);
  if (btnRot)  btnRot.addEventListener('click', function() { _pvRotated = !_pvRotated; _pvApply(); });
  btnD.addEventListener('click',   function() { _setPreviewMode(false); });
  btnM.addEventListener('click',   function() { _setPreviewMode(true);  });
  if (btnExit) btnExit.addEventListener('click', function() { _setPreviewMode(false); });
  _setPreviewMode(false);
}

document.addEventListener('DOMContentLoaded', function() {
  _initMap();
  wireEvents();
  _initSearch();
  _initPreviewToggle();
  _updateLegend();
  _renderBlocColorPickers();
  _renderLibraryCatalog();
  _activeLayers['blocs'] = true;

  showLoading('Initialisation...', 'Chargement des données administratives');

  var initLayers = ['depts_lor', 'arr_lor', 'kreise_rlp', 'landkreise_sar', 'provinces_wal', 'cantons_lux'];

  function afterInitialLoad() {
    hideLoading();
    function go() {
      _mapReady = true;
      _zoomBase = _map.getZoom();
      _wireZoomUI();
      _wireTooltipEvents();
      _drawBlocs();
      _updateLegend();
      setStatus('✓ Vue "Blocs" chargée.');
    }
    if (_mapReady) { _drawBlocs(); _updateLegend(); }
    else _map.once('load', go);
    var btnExport = document.getElementById('btn-export');
    if (btnExport) btnExport.disabled = false;
    var btnEmbed = document.getElementById('btn-embed');
    if (btnEmbed) btnEmbed.disabled = false;
  }

  Promise.all(initLayers.map(function(id) {
    return _fetchLayer(id).catch(function(e) {
      console.warn('[carte] couche ' + id + ' non chargée :', e);
      return null; // ne bloque pas les autres couches
    });
  })).then(afterInitialLoad);
});
