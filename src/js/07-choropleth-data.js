function applyData() {
  if (!_csvData || !_joinCol || !_valueCol) return;
  _dataMap = {}; _rowMap = {};
  var el = document.getElementById('join-type');
  var jt = el ? el.value : 'name';
  _csvData.rows.forEach(function(row) {
    var keyRaw = row[_joinCol] || '';
    var key = (jt === 'name' || jt === 'region') ? _normStr(keyRaw) : keyRaw;
    var val = row[_valueCol];
    if (key) { _dataMap[key] = val; _rowMap[key] = row; }
    // Jointure tolérante : « Nom - Précision » est aussi indexé sous « Nom »
    // (sans écraser une entrée existante) pour les exports à suffixes maison.
    if (jt === 'name' && String(keyRaw).indexOf(' - ') !== -1) {
      var alias = _normStr(String(keyRaw).split(' - ')[0]);
      if (alias && _dataMap[alias] === undefined) { _dataMap[alias] = val; _rowMap[alias] = row; }
    }
  });

  // Échelle calculée sur les lignes JOINTES uniquement : une ligne CSV qui
  // ne correspond à aucune entité ne doit pas fausser l'échelle.
  var featKeys = _collectFeatureKeys();
  var matchedVals = [], matchedRaw = [], total = 0, matched = 0;
  Object.keys(_dataMap).forEach(function(k) {
    total++;
    if (featKeys[k]) {
      matched++;
      var raw = _dataMap[k];
      if (String(raw === undefined ? '' : raw).trim() !== '') matchedRaw.push(raw);
      var v = parseFloat(raw);
      if (!isNaN(v)) matchedVals.push(v);
    }
  });
  // Rien ne se joint ? Diagnostiquer et assister plutôt que peindre en gris.
  if (total > 0 && matched === 0 && jt !== 'region') {
    // a) Couche communes pas encore chargée → la charger puis réessayer.
    if (!_cache['communes'] && !_autoJoinBusy) {
      _autoJoinBusy = true;
      setStatus('… Chargement de la couche communes pour la jointure');
      _ensureLayer('communes').then(function() { applyData(); })
        .catch(function(e) { _autoJoinBusy = false; setStatus('Erreur de chargement : ' + e); });
      return;
    }
    // b) La colonne de jointure ressemble à des valeurs, pas à des identifiants.
    var nNum = 0, nTot = 0;
    _csvData.rows.forEach(function(r) {
      var kk = r[_joinCol];
      if (kk !== undefined && String(kk).trim() !== '') { nTot++; if (!isNaN(parseFloat(kk))) nNum++; }
    });
    if (nTot && nNum > nTot * 0.8) {
      setStatus('⚠ Aucune ligne jointe : « ' + _joinCol + ' » contient des nombres. La colonne de jointure doit identifier la commune (ex. « Communes ») ; mettez la donnée à colorier (ex. « Parti vainqueur ») dans « Valeur à cartographier ».');
      _catMode = false; _catColors = {};
      _repaintChoro(); _updateLegend();
      return;
    }
    setStatus('⚠ Aucune ligne jointe : vérifiez la colonne de jointure (contient-elle les noms de communes ?) et le type d\'identifiant.');
    _catMode = false; _catColors = {};
    _repaintChoro(); _updateLegend();
    return;
  }
  _autoJoinBusy = false;

  // Détection : colonne majoritairement non numérique → mode catégoriel.
  // (Sur les lignes jointes si possible, sinon sur tout le fichier.)
  var detRaw = matchedRaw;
  if (!detRaw.length) {
    detRaw = [];
    _csvData.rows.forEach(function(r) {
      var rv = r[_valueCol];
      if (String(rv === undefined ? '' : rv).trim() !== '') detRaw.push(rv);
    });
  }
  var detNum = detRaw.filter(function(v) { return !isNaN(parseFloat(v)); });
  _catMode = detRaw.length > 0 && detNum.length < detRaw.length * 0.6;
  if (_catMode) {
    _buildCatScale(detRaw);
  } else {
    _catColors = {};
    _buildChoroScale(matchedVals.length ? matchedVals : null);
  }

  // La couche affichée ne montre aucune donnée jointe ? Basculer
  // automatiquement vers la couche où les lignes se joignent le mieux.
  if (matched > 0 && jt !== 'region') {
    var countIn = function(id) {
      var n = 0;
      (((_cache[id] || {}).features) || []).forEach(function(f) {
        var k2 = _getJoinKey(f);
        if (k2 && _dataMap[k2] !== undefined) n++;
      });
      return n;
    };
    var curN = (_fillLayer !== 'blocs' && _fillLayer !== 'none') ? countIn(_fillLayer) : 0;
    if (!curN) {
      var bestId = null, bestN = 0;
      Object.keys(_cache).forEach(function(id) {
        var n3 = countIn(id);
        if (n3 > bestN) { bestN = n3; bestId = id; }
      });
      if (bestId && bestId !== _fillLayer) {
        _fillLayer = bestId;
        var fsel = document.getElementById('fill-layer-sel');
        if (fsel) fsel.value = bestId;
      }
    }
  }
  _repaintChoro();
  _renderCatColorUI();
  if (total) {
    setStatus(matched < total
      ? '⚠ ' + matched + '/' + total + ' lignes jointes — seuils calculés sur les lignes jointes uniquement.'
      : '✓ ' + matched + '/' + total + ' lignes jointes.');
  }
}

// ─── CSV : parsing ────────────────────────────────────────────────
function parseCSV(text) {
  var lines = text.trim().split(/\r?\n/);
  if (!lines.length) return {rows:[], cols:[]};
  // Auto-détection du séparateur
  var counts = {};
  [',',';','\t','|'].forEach(function(s) {
    counts[s] = (lines[0].match(new RegExp('\\' + s, 'g')) || []).length;
  });
  var sep = ',', best = 0;
  Object.keys(counts).forEach(function(s) { if (counts[s] > best) { best = counts[s]; sep = s; } });
  var headers = lines[0].split(sep).map(function(h) { return h.trim().replace(/^"|"$/g,''); });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    var vals = lines[i].split(sep);
    var row  = {};
    headers.forEach(function(h, j) { row[h] = (vals[j] || '').trim().replace(/^"|"$/g,''); });
    rows.push(row);
  }
  return {rows: rows, cols: headers};
}

function loadCSV() {
  var text = document.getElementById('csv-input').value;
  if (!text.trim()) return;
  _csvData = parseCSV(text);
  if (!_csvData.rows.length) { alert('Aucune ligne trouvée'); return; }
  _refreshColSelects();
  _showCSVPreview();
  document.getElementById('csv-preview-wrap').style.display = 'block';
  document.getElementById('csv-row-count').textContent = _csvData.rows.length + ' lignes · ' + _csvData.cols.length + ' colonnes';
  _updateDataBadge();
  document.getElementById('btn-apply-data').disabled = false;
}

function _refreshColSelects() {
  var cols = _csvData.cols;
  ['join-col','value-col'].forEach(function(selId, i) {
    var sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '<option value="">—</option>';
    cols.forEach(function(c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    if (i === 0) {
      var jCol = cols.find(function(c) { return /nom|name|commune|ville|gemeinde|city/i.test(c); }) || cols[0];
      sel.value = jCol; _joinCol = jCol;
    } else {
      var vCol = cols.find(function(c) { return /val|value|valeur|nb|count|score|total|nombre/i.test(c); }) || (cols.length > 1 ? cols[1] : '');
      sel.value = vCol; _valueCol = vCol;
    }
  });
  _updateTtVarChips();
}

function _showCSVPreview() {
  var tbl  = document.getElementById('csv-table');
  var rows = _csvData.rows.slice(0, 5);
  var cols = _csvData.cols;
  var html = '<table style="border-collapse:collapse;font-size:10.5px;width:100%;min-width:max-content"><thead><tr>';
  cols.forEach(function(c) { html += '<th style="padding:4px 8px;text-align:left;background:#f9f9f9;border-bottom:1px solid #eee;white-space:nowrap">'+_escHtml(c)+'</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function(row) {
    html += '<tr>';
    cols.forEach(function(c) { html += '<td style="padding:3px 8px;border-bottom:1px solid #f5f5f5;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis">'+_escHtml(row[c]||'')+'</td>'; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  tbl.innerHTML = html;
}

// ─── Palette UI ───────────────────────────────────────────────────
function _buildChoroUI() {
  var el = document.getElementById('choro-pals');
  if (!el) return;
  el.innerHTML = '';
  CHORO_PALS.forEach(function(p) {
    var sw = document.createElement('div');
    sw.className = 'pal-sw' + (_choroPalette === p.id ? ' active' : '');
    sw.dataset.pal = p.id;
    sw.innerHTML = '<div class="sw-b">'+p.c.map(function(c){return '<span style="background:'+c+'"></span>';}).join('')+'</div>'
                 + '<div class="pal-label">'+p.id+'</div>';
    sw.addEventListener('click', function() {
      _choroPalette = p.id;
      document.querySelectorAll('.pal-sw').forEach(function(s){s.classList.remove('active');});
      sw.classList.add('active');
      if (_csvData && _valueCol) { _buildChoroScale(); applyData(); }
    });
    el.appendChild(sw);
  });
}

function _generateDefaultTpl() {
  var lines = [];
  // Si un drapeau (pays ou régional) est déjà actif, l'infobulle par défaut
  // affiche déjà l'image + la pastille de territoire + le nom — le modèle
  // personnalisé n'a pas besoin de les redupliquer.
  var isFlagMode = (_ttImageMode === 'pays' || _ttImageMode === 'region');
  if (!isFlagMode) {
    if (_ttImageMode === 'custom') lines.push('<img class="tt-img" src="{{img}}" alt="" onerror="this.style.display=\'none\'">');
    lines.push('<div class="tt-chip-row"><span class="tt-bloc-chip" style="background:{{chipColor}};color:#1a1a1a">{{chipLabel}}</span></div>');
    if (_ttFields.name !== false) lines.push('<div class="tt-name">{{name}}</div>');
  }
  var fmap = [
    {k:'canton',l:'Canton'},{k:'dept',l:'D\u00e9partement'},{k:'arrondissement',l:'Arrondissement'},
    {k:'kreis',l:'Kreis / Landkreis'},{k:'province',l:'Province'},{k:'vg',l:'Verbandsgemeinde'},
    {k:'region',l:'R\u00e9gion'},{k:'pays',l:'Pays'},{k:'code',l:'Code'}
  ];
  fmap.forEach(function(f) {
    if (_ttFields[f.k]) lines.push('<div class="tt-row"><span class="tt-row-label">'+f.l+'</span><span class="tt-row-val">{{'+f.k+'}}</span></div>');
  });
  if (_ttFields.dataval && _valueCol) {
    lines.push('<div class="tt-row"><span class="tt-row-label">{{colonne}}</span><span class="tt-data-val">{{valeur}}</span></div>');
  }
  return lines.join('\n');
}

function _updateTtVarChips() {
  var dyn = document.getElementById('tt-vars-dynamic');
  if (!dyn) return;
  if (!_csvData || !_csvData.cols.length) { dyn.innerHTML = ''; return; }
  var html = '<span style="font-size:10px;color:#888;margin-right:4px">Colonnes CSV :</span>';
  _csvData.cols.forEach(function(col) {
    html += '<span class="tt-var-chip csv-col" data-var="'+_escAttr(col)+'">'+_escHtml(col)+'</span>';
  });
  dyn.innerHTML = html;
}

function _refreshTooltip() {
  var tt = document.getElementById('map-tt');
  if (tt && tt.classList.contains('vis') && _ttLastEvt && _ttLastFeat) {
    _showTooltip(_ttLastEvt, _ttLastFeat);
  }
}

function _showTooltip(e, feat) {
  _ttLastEvt = e; _ttLastFeat = feat;
  var p = feat.properties || {};
  var h = getHierarchy(feat);
  var tt = document.getElementById('map-tt');
  var tf = _ttFields;
  var ctx = _ttContext(feat, h);

  // Image : toujours injectée selon l'option (modes par défaut et HTML)
  var ttImg = _ttImageSrc(ctx);
  var html = ttImg ? '<img class="tt-img" src="' + _escAttr(ttImg) + '" alt="" onerror="this.style.display=\'none\'">' : '';

  if (_ttHtmlMode && _ttHtmlTemplate.trim()) {
    // Modèle d'auteur : HTML inséré tel quel, valeurs {{\u2026}} échappées
    html += _renderTpl(_ttHtmlTemplate, ctx, true);
  } else {
  // Seule la pastille colorée avec le nom du territoire apparaît — jamais
  // de sous-entité (département, canton…) ni de nom répété en dessous,
  // quelle que soit l'image sélectionnée (aucune / pays / région / perso).
  var bc = BLOC_COLORS[h.region] || '#888';
  html += '<div class="tt-chip-row"><span class="tt-bloc-chip" style="background:' + bc + ';color:#1a1a1a">' + _escHtml(_chipLabel(h)) + '</span></div>';

  var rows = [];
  if (tf.canton  && h.canton && h.region !== 'Grand Est') rows.push({l:'Canton', v:h.canton});
  if (tf.dept    && h.dept)        rows.push({l: h.region==='Grand Est' ? 'Département' : 'Dept.', v:h.dept});
  if (tf.arrondissement && h.arrondissement && h.arrondissement !== h.dept) rows.push({l:'Arrondissement', v:h.arrondissement});
  if (tf.kreis   && h.kreis)       rows.push({l:'Kreis / Landkreis', v:h.kreis});
  if (tf.province && h.province)   rows.push({l:'Province', v:h.province});
  if (tf.vg      && h.vg)          rows.push({l:'Verbandsgemeinde', v:h.vg});
  if (tf.region)                   rows.push({l:'Région', v:BLOC_LABELS[h.region] || h.region});
  if (tf.pays    && h.pays)        rows.push({l:'Pays', v:h.pays});

  rows.forEach(function(r) {
    if (!r.v) return;
    html += '<div class="tt-row"><span class="tt-row-label">' + _escHtml(r.l) + '</span><span class="tt-row-val">' + _escHtml(r.v) + '</span></div>';
  });

  if (tf.code && p.code) {
    html += '<div class="tt-row"><span class="tt-row-label">Code</span><span class="tt-row-val" style="font-family:monospace;font-size:10.5px">' + _escHtml(p.code) + '</span></div>';
  }

  if (tf.dataval && Object.keys(_dataMap).length && _valueCol) {
    var _ttKey = _getJoinKey(feat);
    var _ttVal = _ttKey !== undefined ? _dataMap[_ttKey] : undefined;
    if (_ttVal !== undefined) {
      html += '<div class="tt-row"><span class="tt-row-label">' + _escHtml(_valueCol) + '</span><span class="tt-data-val">' + _escHtml(_ttVal) + '</span></div>';
    }
  }

  }
  html += '<div style="font-size:9.5px;color:#bbb;margin-top:5px;text-align:right">' + (_ttPinned ? '🔒 Cliquer pour déverrouiller' : 'Clic = verrouiller') + '</div>';

  tt.innerHTML = html;
  tt.classList.add('vis');

  var frame = document.getElementById('map-frame');
  var fr = frame.getBoundingClientRect();
  var mx = e.point.x;
  var my = e.point.y;
  var ttW = tt.offsetWidth || 220, ttH = tt.offsetHeight || 160;
  var left = Math.max(4, Math.min(mx + 14, fr.width - ttW - 4));
  var top  = my - ttH - 12 < 4 ? my + 14 : my - ttH - 12;
  tt.style.left = left + 'px';
  tt.style.top  = Math.max(4, top) + 'px';
}
function _hideTooltip() {
  document.getElementById('map-tt').classList.remove('vis');
}

// ══════════════════════════════════════════════════════════════════
