//  FLUX — DESSIN SUR LA CARTE + IMPORT CSV
// ══════════════════════════════════════════════════════════════════

var _flowDrawMode = false;
var _flowDrawFrom = null; // [lng,lat] en attente du 2e clic, ou null

function _setFlowDrawMode(on) {
  _flowDrawMode = on; _flowDrawFrom = null;
  var btn = document.getElementById('btn-flow-draw');
  var hint = document.getElementById('flow-draw-hint');
  if (btn) { btn.classList.toggle('btn-primary', !on); btn.classList.toggle('btn-secondary', on);
    btn.textContent = on ? '✕ Arrêter le dessin' : '✎ Dessiner sur la carte'; }
  if (hint) { hint.style.display = on ? 'block' : 'none'; hint.textContent = 'Cliquez le point de départ…'; }
  if (_map) _map.getCanvas().style.cursor = on ? 'crosshair' : '';
}

function _wireFlowDrawClick() {
  if (!_map || _map.__flowClickWired) return;
  _map.__flowClickWired = true;
  // Les têtes des flèches "linéaires" sont dimensionnées sur l'épaisseur en
  // PIXELS du trait (cf. _flowEndHalfWidth) pour rester fidèles à ce qui est
  // affiché — donc dépendantes du zoom, contrairement au reste de la
  // géométrie (statique). Seul recalcul déclenché par un changement de vue.
  _map.on('zoomend', function() {
    if (_flowArrows.some(function(a) { return a.visible && a.style !== 'flow'; })) _renderFlows();
  });
  _map.on('click', function(e) {
    if (!_flowDrawMode) return;
    var pt = [e.lngLat.lng, e.lngLat.lat];
    var hint = document.getElementById('flow-draw-hint');
    if (!_flowDrawFrom) {
      _flowDrawFrom = pt;
      if (hint) hint.textContent = 'Cliquez le point d\'arrivée…';
    } else {
      var arrow = _addFlowArrow(_flowDrawFrom, pt);
      _flowDrawFrom = null;
      if (hint) hint.textContent = 'Cliquez le point de départ… (« ' + arrow.name + ' » créé)';
    }
  });
}

// ── Import CSV : noms de territoires connus, ou coordonnées explicites ──
function _resolveFlowPoint(row, plainCol, lonCol, latCol) {
  if (lonCol && latCol && row[lonCol] !== undefined && row[latCol] !== undefined) {
    var lon = parseFloat(String(row[lonCol]).replace(',', '.'));
    var lat = parseFloat(String(row[latCol]).replace(',', '.'));
    if (!isNaN(lon) && !isNaN(lat)) return [lon, lat];
    return null;
  }
  var name = (row[plainCol] || '').trim();
  if (!name) return null;
  var f = _findFeatureByName(name);
  return f ? _featCenter(f) : null;
}

function _loadFlowCSV() {
  var ta = document.getElementById('flow-csv-input');
  var text = ta ? ta.value : '';
  if (!text.trim()) return;
  var parsed = parseCSV(text);
  if (!parsed.rows.length) { setStatus('✗ Aucune ligne trouvée dans le tableau de flux.'); return; }

  var useCoords = ['lon_origine','lat_origine','lon_destination','lat_destination'].every(function(c) {
    return parsed.cols.indexOf(c) !== -1;
  });
  if (!useCoords && !_cache['communes']) {
    setStatus('… Chargement de la couche communes pour résoudre les noms…');
    _ensureLayer('communes').then(_loadFlowCSV)
      .catch(function(e) { setStatus('✗ Chargement des communes impossible : ' + e); });
    return;
  }

  var valCol = parsed.cols.find(function(c) { return /valeur|value|volume|nb|nombre|total/i.test(c); });

  var created = 0, skipped = 0;
  parsed.rows.forEach(function(row) {
    var from = useCoords ? _resolveFlowPoint(row, null, 'lon_origine', 'lat_origine')
                          : _resolveFlowPoint(row, parsed.cols[0]);
    var to   = useCoords ? _resolveFlowPoint(row, null, 'lon_destination', 'lat_destination')
                          : _resolveFlowPoint(row, parsed.cols[1]);
    if (!from || !to) { skipped++; return; }
    var arrow = _newFlowArrow(from, to);
    arrow.name = (row[parsed.cols[0]] || 'Origine') + ' → ' + (row[parsed.cols[1]] || 'Destination');
    if (valCol) {
      var v = parseFloat(row[valCol]);
      // La valeur brute alimente l'échelle PARTAGÉE (_flowValueScale) —
      // pas une normalisation isolée à cet import : deux imports séparés
      // (ou un import + un flux dessiné à la main) restent comparables.
      if (!isNaN(v)) { arrow.style = 'flow'; arrow.value = String(v); arrow.label = String(row[valCol]); }
    }
    _flowArrows.push(arrow);
    created++;
  });
  _renderFlows(); _renderFlowList(); _updateFlowEmptyHint(); _updateLegend();
  setStatus('✓ ' + created + ' flux importé' + (created > 1 ? 's' : '') +
    (skipped ? ' — ' + skipped + ' ligne' + (skipped > 1 ? 's' : '') + ' ignorée' + (skipped > 1 ? 's' : '') + ' (origine/destination introuvable)' : '') + '.');
}
