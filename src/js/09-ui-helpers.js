//  UI HELPERS
// ══════════════════════════════════════════════════════════════════

function showLoading(msg, sub) {
  document.getElementById('loading-msg').textContent = msg || 'Chargement...';
  document.getElementById('loading-sub').textContent = sub || '';
  document.getElementById('map-loading').classList.add('visible');
}
function hideLoading() {
  document.getElementById('map-loading').classList.remove('visible');
}
function setStatus(msg) { document.getElementById('status-msg').textContent = msg; }

// ── Métadonnées (onglet Style) : titre / chapô / auteur / source ──
function _getMapMeta() {
  function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return { title: v('map-title'), chapo: v('map-chapo'), author: v('map-author'), source: v('map-source') };
}
// ── Étiquettes : rendu sur la carte (Markers DOM) ──────────────────
// Bloc d'appartenance approximatif d'un point libre (bbox, du plus petit au plus grand)
var _BLOC_ORDER = ['Luxembourg', 'Saarland', 'Wallonie', 'Grand Est', 'Rheinland-Pfalz'];
function _blocForPoint(lng, lat) {
  for (var i = 0; i < _BLOC_ORDER.length; i++) {
    var b = BLOC_BOUNDS[_BLOC_ORDER[i]];
    if (b && lng >= b[0][0] && lng <= b[1][0] && lat >= b[0][1] && lat <= b[1][1]) return _BLOC_ORDER[i];
  }
  return null;
}

function _labelItems() {
  var items = [], seen = {};
  function push(name, lng, lat, id, bloc) {
    var k = _normStr(name);
    if (!k || seen[k]) return;           // dédoublonne (Metz préfecture = Metz arrondissement…)
    seen[k] = true;
    items.push({ id: id || ('it-' + k), name: name, lng: lng, lat: lat, bloc: bloc || null });
  }
  _labels.forEach(function(l) { push(l.name, l.lng, l.lat, l.id, _blocForPoint(l.lng, l.lat)); });
  if (_labelGroups.capitals) {
    CAPITALS.forEach(function(c) { if (_activeBlocs[c.bloc]) push(c.name, c.lng, c.lat, null, c.bloc); });
  }
  Object.keys(CHEFS_LIEUX).forEach(function(gid) {
    if (!_labelGroups[gid]) return;
    var g = CHEFS_LIEUX[gid];
    if (!_activeBlocs[g.bloc]) return;
    g.items.forEach(function(it) { push(it[0], it[1], it[2], null, g.bloc); });
  });
  return items;
}

function _renderLabels() {
  Object.keys(_labelMarkers).forEach(function(id) { _labelMarkers[id].mk.remove(); delete _labelMarkers[id]; });
  if (!_map || !_mapReady) return;
  _labelItems().forEach(function(l) {
    var el = document.createElement('div');
    el.className = 'lbl-marker p-right';
    var dot = document.createElement('span'); dot.className = 'lbl-dot';
    var txt = document.createElement('span'); txt.className = 'lbl-text';
    txt.textContent = l.name;           // textContent : aucune injection possible
    el.appendChild(dot); el.appendChild(txt);
    _labelMarkers[l.id] = {
      mk: new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([l.lng, l.lat]).addTo(_map),
      name: l.name, el: el, placement: 'right', bloc: l.bloc || null
    };
  });
  _updateLabelPlacements();
}

// Place chaque nom autour de son point (droite > gauche > dessus > dessous) ;
// si aucune position n'est libre, le nom est masqué et le point reste visible.
// Géométrie décimée (1 point sur 6) : assez précise pour le confinement,
// assez légère pour un test à chaque déplacement de carte.
function _decimateGeom(geom) {
  function ring(r) {
    if (r.length <= 30) return r;
    var o = [];
    for (var i = 0; i < r.length; i += 6) o.push(r[i]);
    o.push(r[0]);
    return o;
  }
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: geom.coordinates.map(ring) };
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(function(p) { return p.map(ring); }) };
  return geom;
}

function _pipGeom(lng, lat, geom) {
  function inRing(r) {
    var ins = false;
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
      var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  var polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (var p = 0; p < polys.length; p++) {
    if (inRing(polys[p][0])) {
      var hole = false;
      for (var h = 1; h < polys[p].length; h++) { if (inRing(polys[p][h])) { hole = true; break; } }
      if (!hole) return true;
    }
  }
  return false;
}

var _measureCtx = null;
function _updateLabelPlacements() {
  if (!_map || !_mapReady) return;
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  var sizeEl = document.getElementById('label-size');
  var size = parseFloat(sizeEl ? sizeEl.value : '11.5') || 11.5;
  _measureCtx.font = '600 ' + size + 'px Inter,system-ui,sans-serif';
  var cont = _map.getContainer();
  var viewR = { x1: 4, y1: 4, x2: (cont.offsetWidth || 800) - 4, y2: (cont.offsetHeight || 600) - 4 };
  var PAD = 5;                                   // marge entre étiquettes (anti-« trop proche »)
  var placed = [], PLACES = ['right', 'left', 'top', 'bottom'];

  // bbox écran de chaque bloc actif : on préfère garder le nom DANS son bloc
  var blocRects = {};
  Object.keys(BLOC_BOUNDS).forEach(function(b) {
    if (!_activeBlocs[b]) return;
    var p1 = _map.project([BLOC_BOUNDS[b][0][0], BLOC_BOUNDS[b][0][1]]);
    var p2 = _map.project([BLOC_BOUNDS[b][1][0], BLOC_BOUNDS[b][1][1]]);
    blocRects[b] = { x1: Math.min(p1.x, p2.x), y1: Math.min(p1.y, p2.y),
                     x2: Math.max(p1.x, p2.x), y2: Math.max(p1.y, p2.y) };
  });
  function inside(r, R) { return r.x1 >= R.x1 && r.y1 >= R.y1 && r.x2 <= R.x2 && r.y2 <= R.y2; }
  function rectInBloc(r, region) {
    var g = _blocTestGeoms[region];
    if (!g) { var R = blocRects[region]; return !R || inside(r, R); }   // repli bbox
    var corners = [[r.x1, r.y1], [r.x2, r.y1], [r.x2, r.y2], [r.x1, r.y2]];
    for (var c = 0; c < 4; c++) {
      var ll = _map.unproject(corners[c]);
      if (!_pipGeom(ll.lng, ll.lat, g)) return false;
    }
    return true;
  }
  function collides(r) {
    for (var j = 0; j < placed.length; j++) {
      var q = placed[j];
      if (r.x1 - PAD < q.x2 && q.x1 < r.x2 + PAD && r.y1 - PAD < q.y2 && q.y1 < r.y2 + PAD) return true;
    }
    return false;
  }

  Object.keys(_labelMarkers).forEach(function(id) {
    var m = _labelMarkers[id];
    var pt = _map.project(m.mk.getLngLat());
    var w = _measureCtx.measureText(m.name).width, h = size * 1.3, d = 8;
    var rects = {
      right:  { x1: pt.x + d,         y1: pt.y - h / 2,  x2: pt.x + d + w + 2, y2: pt.y + h / 2 },
      left:   { x1: pt.x - d - w - 2, y1: pt.y - h / 2,  x2: pt.x - d,         y2: pt.y + h / 2 },
      top:    { x1: pt.x - w / 2,     y1: pt.y - d - h,  x2: pt.x + w / 2,     y2: pt.y - d },
      bottom: { x1: pt.x - w / 2,     y1: pt.y + d,      x2: pt.x + w / 2,     y2: pt.y + d + h }
    };
    var ok = null, i;
    // passe 1 : libre + dans la carte + dans le POLYGONE du bloc d'appartenance
    for (i = 0; i < PLACES.length && !ok; i++) {
      var r1 = rects[PLACES[i]];
      if (!collides(r1) && inside(r1, viewR) && (!m.bloc || rectInBloc(r1, m.bloc))) ok = PLACES[i];
    }
    // passe 2 : libre + dans la carte
    for (i = 0; i < PLACES.length && !ok; i++) {
      var r2 = rects[PLACES[i]];
      if (!collides(r2) && inside(r2, viewR)) ok = PLACES[i];
    }
    // passe 3 : libre
    for (i = 0; i < PLACES.length && !ok; i++) {
      if (!collides(rects[PLACES[i]])) ok = PLACES[i];
    }
    if (ok) placed.push(rects[ok]);
    m.placement = ok;
    m.el.className = 'lbl-marker ' + (ok ? 'p-' + ok : 'p-right lbl-hidden');
  });
}

function _renderLabelsList() {
  var list = document.getElementById('labels-list');
  if (!list) return;
  list.innerHTML = '';
  _labels.forEach(function(l) {
    var row = document.createElement('div');
    row.className = 'lbl-row';
    var span = document.createElement('span');
    span.textContent = l.name + '  (' + l.lng.toFixed(3) + ', ' + l.lat.toFixed(3) + ')';
    var del = document.createElement('button');
    del.className = 'lbl-del';
    del.title = 'Supprimer';
    del.setAttribute('aria-label', 'Supprimer l’étiquette ' + l.name);
    del.textContent = '✕';
    del.addEventListener('click', function() {
      _labels = _labels.filter(function(x) { return x.id !== l.id; });
      _renderLabels(); _renderLabelsList();
    });
    row.appendChild(span); row.appendChild(del);
    list.appendChild(row);
  });
}

function _featCenter(f) {
  var lo = Infinity, hi = -Infinity, bo = Infinity, to = -Infinity;
  var g = f && f.geometry;
  if (!g || !g.type) return [0, 0];
  var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  polys.forEach(function(p) { p.forEach(function(r) { r.forEach(function(pt) {
    if (pt[0] < lo) lo = pt[0]; if (pt[0] > hi) hi = pt[0];
    if (pt[1] < bo) bo = pt[1]; if (pt[1] > to) to = pt[1];
  }); }); });
  return [(lo + hi) / 2, (bo + to) / 2];
}

function _findFeatureByName(q) {
  var qn = _normStr(q);
  if (!qn) return null;
  var order = ['communes','cantons_lux','cantons_lor','vg_rlp','arr_wal','arr_lor',
               'kreise_rlp','landkreise_sar','provinces_wal','depts_lor'];
  var prefix = null;
  for (var oi = 0; oi < order.length; oi++) {
    var geo = _cache[order[oi]]; if (!geo) continue;
    var feats = geo.features || [];
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i];
      var nm = _normStr((f.properties || {}).name || '');
      if (!nm || !_inGRBounds(f)) continue;
      if (nm === qn) return f;
      if (!prefix && nm.indexOf(qn) === 0) prefix = f;
    }
  }
  return prefix;
}

function _pushLabel(name, lng, lat) {
  _labels.push({ id: 'lbl' + Date.now().toString(36) + Math.floor(Math.random() * 1000), name: name, lng: lng, lat: lat });
  var inp = document.getElementById('label-search');
  if (inp) inp.value = '';
  _renderLabels(); _renderLabelsList();
  setStatus('✓ Étiquette « ' + name + ' » ajoutée.');
}

var _labelSearchBusy = false;
function _addLabelFromInput() {
  var inp = document.getElementById('label-search');
  if (!inp || _labelSearchBusy) return;
  var q = (inp.value || '').trim();
  if (!q) return;
  var m = q.match(/^(.+?)\s*@\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (m) {
    _pushLabel(m[1].trim(), parseFloat(m[2].replace(',', '.')), parseFloat(m[3].replace(',', '.')));
    return;
  }
  var f = _findFeatureByName(q);
  if (f) {
    var c = _featCenter(f);
    _pushLabel((f.properties || {}).name || q, c[0], c[1]);
    return;
  }
  // Introuvable : si la couche Communes n'est pas encore chargée, on la
  // charge automatiquement puis on relance la recherche.
  if (!_cache['communes']) {
    _labelSearchBusy = true;
    showLoading('Chargement des communes…', 'recherche de « ' + q + ' »');
    _ensureLayer('communes').then(function() {
      _labelSearchBusy = false;
      var f2 = _findFeatureByName(q);
      if (!f2) { setStatus('✗ « ' + q + ' » introuvable, même parmi les communes.'); return; }
      var c2 = _featCenter(f2);
      _pushLabel((f2.properties || {}).name || q, c2[0], c2[1]);
    }).catch(function(err) {
      _labelSearchBusy = false;
      setStatus('✗ Chargement des communes impossible : ' + err);
    });
    return;
  }
  setStatus('✗ « ' + q + ' » introuvable dans les couches chargées.');
}

// ── Infobulle : contexte de variables + rendu de modèle ────────────
function _escAttr(s) { return _escHtml(s).replace(/"/g, '&quot;'); }

function _ttContext(feat, h) {
  var p = feat.properties || {};
  var val = '', k;
  if (Object.keys(_dataMap).length && _valueCol) {
    k = _getJoinKey(feat);
    if (k && _dataMap[k] !== undefined) val = _dataMap[k];
  }
  var ctx = {
    name: p.name || p.NAME || '', // pas de repli BLOC_LABELS : déjà dans chipLabel
    region: BLOC_LABELS[h.region] || h.region || '',
    pays: h.pays || '',
    dept: h.dept || '', arrondissement: h.arrondissement || '', canton: h.canton || '',
    kreis: h.kreis || '', province: h.province || '', vg: h.vg || '',
    code: p.code || '',
    valeur: val, colonne: _valueCol || '',
    flag_pays: FLAG_PAYS[h.pays] || '',
    flag_region: FLAG_REGION[h.region] || '',
    chipLabel: _chipLabel(h),
    chipColor: BLOC_COLORS[h.region] || '#888'
  };
  // Exposer toutes les colonnes CSV de la ligne jointe (noms avec espaces inclus)
  if (k !== undefined && _rowMap[k]) {
    var _row = _rowMap[k];
    Object.keys(_row).forEach(function(col) {
      if (ctx[col] === undefined) ctx[col] = (_row[col] !== null && _row[col] !== undefined) ? String(_row[col]) : '';
    });
  }
  return ctx;
}

// Remplace {{variable}} ; esc=true → valeurs échappées (modèle HTML),
// esc=false → valeurs brutes (modèle d'URL, échappé ensuite via _escAttr).
function _renderTpl(tpl, ctx, esc) {
  return String(tpl).replace(/\{\{([^}]+?)\}\}/g, function(m0, key) { key = key.trim();
    var v = ctx[key];
    if (v === undefined) return '';
    return esc ? _escHtml(v) : String(v);
  });
}

// Pastille de l'infobulle : uniquement le nom du territoire (pas de
// sous-entité — département, canton, arrondissement… — ni d'initiales de
// pays), quelle que soit la configuration d'image sélectionnée.
var BLOC_CHIP_LABEL = {
  'Rheinland-Pfalz': 'Rhénanie-Palatinat',
  'Saarland':        'Sarre',
  'Wallonie':         'Wallonie',
  'Grand Est':        'Lorraine',
  'Luxembourg':       'Luxembourg',
};
function _chipLabel(h) {
  return BLOC_CHIP_LABEL[h.region] || h.pays || h.region || '';
}

function _ttImageSrc(ctx) {
  if (_ttImageMode === 'pays')   return ctx.flag_pays;
  if (_ttImageMode === 'region') return ctx.flag_region;
  if (_ttImageMode === 'custom' && _ttImageUrl.trim()) return _renderTpl(_ttImageUrl.trim(), ctx, false);
  return '';
}

// ── Tableau de données accessible (alternative RGAA à la carte) ──
var _tableRowsCache = null;

function _tableRowsForCurrentView() {
  var rows = [];
  var choro = Object.keys(_dataMap).length > 0 && !!_valueCol;
  var layerId = _activeFillLayerId;
  if (layerId && _cache[layerId]) {
    var derived = _LAYER_REGION[layerId];
    (_cache[layerId].features || []).filter(_inGRBounds).forEach(function(f) {
      var p = f.properties || {};
      var region = _canonicalRegion(p.region || p.REGION || derived);
      if (!_activeBlocs[region]) return;
      var row = { nom: p.name || p.NAME || '', region: BLOC_LABELS[region] || region,
                  pays: BLOC_PAYS[region] || '', code: p.code || '' };
      if (choro) {
        var k = _getJoinKey(f);
        var v = (k !== undefined && k !== '') ? _dataMap[k] : undefined;
        row.valeur = (v === undefined) ? '' : v;
      }
      rows.push(row);
    });
  } else {
    Object.keys(BLOC_COLORS).forEach(function(region) {
      if (!_activeBlocs[region]) return;
      var row = { nom: BLOC_LABELS[region] || region, region: BLOC_LABELS[region] || region,
                  pays: BLOC_PAYS[region] || '', code: '' };
      if (choro) {
        var v = _dataMap[_normStr(region)];
        row.valeur = (v === undefined) ? '' : v;
      }
      rows.push(row);
    });
  }
  rows.sort(function(a, b) { return String(a.nom).localeCompare(String(b.nom), 'fr'); });
  return rows;
}

function _openTableModal() {
  var rows  = _tableRowsForCurrentView();
  var choro = Object.keys(_dataMap).length > 0 && !!_valueCol;
  var meta  = _getMapMeta();

  var bits = [];
  if (meta.title) bits.push('<strong>' + _escHtml(meta.title) + '</strong>');
  bits.push(rows.length + ' entité' + (rows.length > 1 ? 's' : ''));
  if (meta.source) bits.push('Source : ' + _escHtml(meta.source));
  document.getElementById('table-modal-meta').innerHTML = bits.join(' · ');

  var cols = [{k:'nom', l:'Nom'}, {k:'region', l:'Région'}, {k:'pays', l:'Pays'}, {k:'code', l:'Code'}];
  if (choro) cols.push({k:'valeur', l: _valueCol});

  var html = '<table style="border-collapse:collapse;width:100%;font-size:12px">'
           + '<caption style="text-align:left;padding:6px 9px;font-size:11px;color:#888">'
           + 'Alternative accessible : données de la vue courante</caption><thead><tr>';
  cols.forEach(function(c) {
    html += '<th scope="col" style="position:sticky;top:0;background:#f9f9f9;text-align:left;padding:6px 9px;border-bottom:1px solid #e4e4e4">'
          + _escHtml(c.l) + '</th>';
  });
  html += '</tr></thead><tbody>';
  rows.forEach(function(r) {
    html += '<tr>';
    cols.forEach(function(c) {
      html += '<td style="padding:4px 9px;border-bottom:1px solid #f3f3f3">'
            + _escHtml(r[c.k] === undefined ? '' : r[c.k]) + '</td>';
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

function _exportTableCSV() {
  if (!_tableRowsCache) return;
  var cols = _tableRowsCache.cols, rows = _tableRowsCache.rows;
  function q(v) {
    v = String(v === undefined ? '' : v);
    return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  var lines = [cols.map(function(c) { return q(c.l); }).join(',')];
  rows.forEach(function(r) {
    lines.push(cols.map(function(c) { return q(r[c.k]); }).join(','));
  });
  var blob = new Blob(['\ufeff' + lines.join('\n')], {type: 'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'grande-region-donnees.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  setStatus('✓ Tableau exporté en CSV.');
}

function _updateMapMeta() {
  var el = document.getElementById('map-meta');
  if (!el) return;
  var m = _getMapMeta();
  if (!m.title && !m.chapo && !m.author && !m.source) {
    el.style.display = 'none'; el.innerHTML = ''; el.style.top = ''; return;
  }
  var html = '';
  if (m.title) html += '<div class="mm-title">' + _escHtml(m.title) + '</div>';
  if (m.chapo) html += '<div class="mm-chapo">' + _escHtml(m.chapo) + '</div>';
  var credits = [];
  if (m.source) credits.push('Source : ' + _escHtml(m.source));
  if (m.author) credits.push('Carte : ' + _escHtml(m.author));
  if (credits.length) html += '<div class="mm-credit">' + credits.join(' · ') + '</div>';
  el.innerHTML = html;
  el.style.display = 'block';
  _syncMapChrome();
}

// Évite la collision visuelle entre le cartouche titre/chapeau (#map-meta,
// centré en haut) et la barre de recherche (#map-search, ancrée en haut à
// gauche) : les deux étant indépendamment positionnés en CSS, ils peuvent se
// superposer sur les viewports étroits (mobile, prévisualisation device).
// On mesure la géométrie réelle après mise en page et, en cas de
// chevauchement effectif, on repousse le cartouche sous la barre de
// recherche — plutôt que d'utiliser un décalage fixe qui serait soit
// insuffisant (titre long) soit superflu (grand écran, pas de chevauchement).
function _syncMapChrome() {
  var meta = document.getElementById('map-meta');
  var search = document.getElementById('map-search');
  if (!meta || !search) return;
  if (meta.style.display === 'none' || !meta.innerHTML) { meta.style.top = ''; return; }
  meta.style.top = ''; // repart de la position CSS par défaut avant de mesurer
  var searchBottom = search.offsetTop + search.offsetHeight;
  var metaTop = meta.offsetTop;
  var metaLeft = meta.offsetLeft;
  var metaRight = metaLeft + meta.offsetWidth;
  var searchLeft = search.offsetLeft;
  var searchRight = searchLeft + search.offsetWidth;
  var overlapV = metaTop < searchBottom;
  var overlapH = metaLeft < searchRight && metaRight > searchLeft;
  if (overlapV && overlapH) {
    meta.style.top = Math.round(searchBottom + 8) + 'px';
  }
}

// ══════════════════════════════════════════════════════════════════
