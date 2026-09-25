//  BIBLIOTHÈQUE — mise en valeur des données, badge, table générique
// ══════════════════════════════════════════════════════════════════

// Légende choroplèthe d'une couche Bibliothèque : pastille + intervalle,
// et CHAQUE pastille est éditable (clic → sélecteur de couleur natif) pour
// permettre à la rédaction d'ajuster les teintes au besoin éditorial.
function _renderChoroLegend(layer, container) {
  container.innerHTML = '';
  if (!layer.choro) return;
  var b = layer.choro.breaks, c = layer.choro.colors;
  c.forEach(function(color, i) {
    var lo = i === 0 ? layer.choro.min : b[i - 1];
    var hi = i === c.length - 1 ? layer.choro.max : b[i];
    var item = document.createElement('span');
    item.className = 'leg-item';
    item.style.cursor = 'pointer';
    item.title = 'Cliquer pour changer cette couleur';
    var sw = document.createElement('span');
    sw.className = 'leg-swatch'; sw.style.background = color;
    var picker = document.createElement('input');
    picker.type = 'color'; picker.value = color;
    picker.style.cssText = 'position:absolute;opacity:0;width:0;height:0';
    picker.addEventListener('input', function() {
      layer.choro.colors[i] = picker.value;
      sw.style.background = picker.value;
      _setUserLayerColor(layer);
    });
    var txt = document.createElement('span');
    txt.textContent = _fmtChoroNum(lo) + '–' + _fmtChoroNum(hi);
    item.appendChild(sw); item.appendChild(picker); item.appendChild(txt);
    item.addEventListener('click', function(e) { if (e.target !== picker) picker.click(); });
    container.appendChild(item);
  });
}

// Badge « Aucune donnée » du bandeau : reflète aussi la présence de couches
// Bibliothèque (import manuel ou catalogue GIS-GR), pas seulement le CSV.
function _updateDataBadge() {
  var badge = document.getElementById('data-badge');
  if (!badge) return;
  if (_csvData && _csvData.rows.length) {
    badge.textContent = _csvData.rows.length + ' lignes';
    badge.className = 'badge badge-ok';
  } else if (_userLayers.length) {
    badge.textContent = _userLayers.length + ' couche' + (_userLayers.length > 1 ? 's' : '') + ' (Bib.)';
    badge.className = 'badge badge-ok';
  } else {
    badge.textContent = 'Aucune donnée';
    badge.className = 'badge badge-warn';
  }
}

// Quand au moins une couche Bibliothèque est visible, on efface le fond de
// carte (couche de fond + sa légende) pour que les données importées
// ressortent sans concurrence visuelle — et on restaure l'état précédent
// dès qu'il n'y en a plus.
var _libFocusPrevFill = null;
function _updateLibraryBasemapFocus() {
  var anyVisible = _userLayers.some(function(l) { return l.visible; });
  var legend = document.getElementById('map-legend');
  if (anyVisible) {
    if (_libFocusPrevFill === null) {
      _libFocusPrevFill = _fillLayer;
      _fillLayer = 'none';
      var sel = document.getElementById('fill-layer-sel');
      if (sel) sel.value = 'none';
      _redrawFill();
    }
    if (legend) legend.style.display = 'none';
  } else if (_libFocusPrevFill !== null) {
    _fillLayer = _libFocusPrevFill;
    _libFocusPrevFill = null;
    var sel2 = document.getElementById('fill-layer-sel');
    if (sel2) sel2.value = _fillLayer;
    _redrawFill();
    if (legend) legend.style.display = '';
  }
}

// Onglet Données : liste des couches Bibliothèque chargées, chacune avec un
// accès à ses données en tableau (accessible, exportable en CSV).
function _renderLibraryDataTab() {
  var box = document.getElementById('lib-data-tab-list');
  if (!box) return;
  box.innerHTML = '';
  if (!_userLayers.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  var hdr = document.createElement('div');
  hdr.className = 'section-title';
  hdr.style.margin = '14px 0 8px';
  hdr.textContent = 'Couches Bibliothèque';
  box.appendChild(hdr);
  _userLayers.forEach(function(layer) {
    var row = document.createElement('div');
    row.className = 'lib-item';
    var name = document.createElement('div');
    name.style.cssText = 'flex:1;font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    name.textContent = layer.name;
    var btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-sm';
    btn.textContent = '☰ Tableau';
    btn.addEventListener('click', function() { _openGenericLayerTable(layer); });
    row.appendChild(name); row.appendChild(btn);
    box.appendChild(row);
  });
}

// Tableau accessible générique pour une couche Bibliothèque (colonnes
// dynamiques, contrairement à _openTableModal qui suppose le schéma fixe
// des couches administratives). Réutilise la même modale.
function _openGenericLayerTable(layer) {
  var feats = layer.geojson.features || [];
  var colSet = {};
  feats.slice(0, 200).forEach(function(f) {
    Object.keys(f.properties || {}).forEach(function(k) { if (k !== '_cv') colSet[k] = true; });
  });
  var cols = Object.keys(colSet).map(function(k) { return {k:k, l:k}; });
  var rows = feats.map(function(f) { return f.properties || {}; });

  document.getElementById('table-modal-title').textContent = layer.name;
  document.getElementById('table-modal-meta').textContent =
    rows.length + ' objet' + (rows.length > 1 ? 's' : '') + ' · Bibliothèque';

  var html = '<table style="border-collapse:collapse;width:100%;font-size:12px">'
           + '<caption style="text-align:left;padding:6px 9px;font-size:11px;color:#888">'
           + 'Alternative accessible : données de la couche « ' + _escHtml(layer.name) + ' »</caption><thead><tr>';
  cols.forEach(function(c) {
    html += '<th scope="col" style="position:sticky;top:0;background:#f9f9f9;text-align:left;padding:6px 9px;border-bottom:1px solid #e4e4e4;white-space:nowrap">'
          + _escHtml(c.l) + '</th>';
  });
  html += '</tr></thead><tbody>';
  rows.forEach(function(r) {
    html += '<tr>';
    cols.forEach(function(c) {
      var v = r[c.k];
      html += '<td style="padding:4px 9px;border-bottom:1px solid #f3f3f3;white-space:nowrap">'
            + _escHtml(v === undefined || v === null ? '' : v) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('table-modal-wrap').innerHTML = html;
  document.getElementById('table-modal').classList.remove('hidden');
  _tableRowsCache = { rows: rows, cols: cols };
  var closeBtn = document.getElementById('table-modal-close');
  if (closeBtn) closeBtn.focus();
}
