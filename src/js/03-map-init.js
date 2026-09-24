//  CARTE — INITIALISATION MAPLIBRE
// ══════════════════════════════════════════════════════════════════

var GR_BOUNDS = [[3.4, 47.7], [8.6, 51.1]]; // [sw, ne]

// Limites réelles mesurées sur la géométrie chargée (et non plus une
// approximation à la main : les anciennes valeurs sous-estimaient Wallonie,
// qui débordait donc du cadrage). Pour la Sarre à la Rhénanie-Palatinat, etc.,
// simple bbox géographique — aucune exception.
// Wallonie fait exception : l'arrondissement de Tournai-Mouscron (bien à
// l'ouest, ~2.84°E, isolé du reste du territoire) est volontairement exclu
// du cadrage pour ne pas dézoomer tout le monde pour un seul territoire
// excentré — il reste affiché sur la carte, juste pas garanti dans le cadre.
var BLOC_BOUNDS = {
  'Grand Est':       [[4.89, 47.81], [7.64, 49.62]],
  'Rheinland-Pfalz': [[6.11, 48.97], [8.51, 50.95]],
  'Saarland':        [[6.36, 49.11], [7.41, 49.64]],
  'Wallonie':        [[3.49, 49.50], [6.41, 50.81]], // hors Tournai-Mouscron
  'Luxembourg':      [[5.74, 49.45], [6.53, 50.19]],
};

// Blocs actuellement affichés — tous actifs par défaut
var _activeBlocs = {
  'Grand Est': true, 'Rheinland-Pfalz': true, 'Saarland': true,
  'Wallonie': true, 'Luxembourg': true
};


function _initMap() {
  var frame = document.getElementById('map-frame');

  var mapDiv = document.createElement('div');
  mapDiv.id = 'maplibre-map';
  mapDiv.style.position = 'absolute';
  mapDiv.style.inset = '0';
  frame.insertBefore(mapDiv, frame.firstChild);

  _map = new maplibregl.Map({
    container: 'maplibre-map',
    style: {
      version: 8,
      sources: {},
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#e8e6e0' } }
      ]
    },
    bounds: GR_BOUNDS,
    fitBoundsOptions: { padding: (function() { var w = (document.getElementById('map-frame') || {}).offsetWidth || 800; return Math.max(16, Math.round(w * 0.04)); })() },
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    maxPitch: 0,
    preserveDrawingBuffer: true,
  });

  _map.touchZoomRotate.disableRotation();

  _map.on('load', function() {
    _mapReady = true;
    // Rendre les couches utilisateur ajoutées avant le chargement
    _userLayers.forEach(function(l) { _renderUserLayerOnMap(l); });
    _zoomBase = _map.getZoom();
    _wireZoomUI();
    _wireTooltipEvents();
    _redrawFill();
    _renderLabels();
    _map.on('moveend', _updateLabelPlacements);
    // Double-rAF : attend la stabilisation du layout CSS (sidebar 320px incluse)
    // avant de recadrer — corrige le zoom initial sur desktop et mobile.
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (!_map) return;
        _map.resize();
        _fitToActiveBlocs(false);
      });
    });
  });

  _map.on('zoom', function() {
    _updateZoomLevel();
    _updateZoomBtns();
  });
}

function _relativeZoomFactor() {
  if (_zoomBase === null) return 1;
  return Math.pow(2, _map.getZoom() - _zoomBase);
}
function _updateZoomLevel() {
  var el = document.getElementById('zoom-level');
  if (!el || !_map) return;
  if (_zoomBase === null) _zoomBase = _map.getZoom();
  var k = _relativeZoomFactor();
  el.textContent = '×' + (k >= 10 ? Math.round(k) : k.toFixed(1));
}
function _updateZoomBtns() {
  var zin = document.getElementById('zoom-in');
  var zout = document.getElementById('zoom-out');
  if (!_map || !zin || !zout) return;
  zin.disabled = _map.getZoom() >= _map.getMaxZoom() - 0.05;
  zout.disabled = _map.getZoom() <= _map.getMinZoom() + 0.05;
}
function _resetZoom() {
  if (!_map) return;
  _fitToActiveBlocs(true);
}


// ══════════════════════════════════════════════════════════════════
//  GESTION DES BLOCS ACTIFS
// ══════════════════════════════════════════════════════════════════

function _getActiveBlocsBbox() {
  var active = Object.keys(_activeBlocs).filter(function(b) { return _activeBlocs[b]; });
  if (!active.length) return GR_BOUNDS;
  var w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  active.forEach(function(b) {
    var bb = BLOC_BOUNDS[b]; if (!bb) return;
    w = Math.min(w, bb[0][0]); s = Math.min(s, bb[0][1]);
    e = Math.max(e, bb[1][0]); n = Math.max(n, bb[1][1]);
  });
  return isFinite(w) ? [[w, s], [e, n]] : GR_BOUNDS;
}

function _fitToActiveBlocs(animate) {
  if (!_map || !_mapReady) return;
  var bb = _getActiveBlocsBbox();
  var active = Object.keys(_activeBlocs).filter(function(b) { return _activeBlocs[b]; });
  var padding = active.length <= 2 ? 50 : 24;
  _map.fitBounds(bb, { padding: padding, duration: animate ? 500 : 0 });
  _map.once('moveend', function() {
    _zoomBase = _map.getZoom();
    _updateZoomLevel();
    _updateZoomBtns();
  });
}

function _updateBlocChips() {
  document.querySelectorAll('.bloc-chip').forEach(function(btn) {
    btn.classList.toggle('active', !!_activeBlocs[btn.dataset.bloc]);
  });
}

function _toggleBloc(region) {
  var activeList = Object.keys(_activeBlocs).filter(function(b) { return _activeBlocs[b]; });
  if (activeList.length === 1 && _activeBlocs[region]) {
    setStatus('⚠ Au moins un bloc doit rester actif.');
    _updateBlocChips();
    return;
  }
  _activeBlocs[region] = !_activeBlocs[region];
  _updateBlocChips();
  if (_mapReady) {
    _redrawFill();
    _refreshAllOverlays();
    _updateLegend();
    _fitToActiveBlocs(true);
    _renderLabels();
  }
}

// ══════════════════════════════════════════════════════════════════
//  ZOOM UI
// ══════════════════════════════════════════════════════════════════

var _zoomUIWired = false;
function _wireZoomUI() {
  if (_zoomUIWired) return;        // évite le double câblage (deux chemins d'init)
  _zoomUIWired = true;
  document.getElementById('zoom-in').addEventListener('click', function() {
    _map.zoomIn({duration: 300});
  });
  document.getElementById('zoom-out').addEventListener('click', function() {
    _map.zoomOut({duration: 300});
  });
  document.getElementById('zoom-reset').querySelector('button').addEventListener('click', _resetZoom);
  _updateZoomLevel();
  _updateZoomBtns();
}

// ══════════════════════════════════════════════════════════════════
