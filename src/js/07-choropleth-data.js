// Libellé affiché pour la valeur cartographiée : le nom de colonne par
// défaut, ou le libellé personnalisé si l'utilisateur en a saisi un
// (#value-col-label) — utile quand l'en-tête CSV brut est trop technique
// pour l'infobulle/le tableau sans pour autant renommer la colonne elle-même.
function _valueLabel() {
  return _valueColLabel || _valueCol;
}

function applyData() {
  if (!_csvData || !_joinCol || !_valueCol) return;
  var el = document.getElementById('join-type');
  var jt = el ? el.value : 'name';
  // "Type d'identifiant" n'offre QUE des identifiants de commune (nom, ou
  // code par pays) ou "Région/Bloc" — jamais canton/arrondissement/Kreis,
  // qui n'ont pas d'option dédiée. "communes" est donc la SEULE couche
  // valide pour toute jointure jt !== 'region' ; la charger d'abord (avant
  // même de compter les correspondances) évite de se rabattre par erreur
  // sur une couche de granularité différente déjà en cache pour une autre
  // raison (ex. cantons du Luxembourg, dont plusieurs portent le même nom
  // que leur commune-centre — un « bon » nombre de correspondances
  // trompeur, sans rapport avec la vraie jointure communale voulue).
  // Les fonds de blocs (BLOCS_SOURCE_LAYERS) sont chargés dans le même
  // lot : sans ça, _redrawFill() (déclenché plus bas par _repaintChoro())
  // les charge lui-même de façon asynchrone une fois la fonction déjà
  // terminée, et son propre message de statut générique ("Vue Communes
  // affichée") écrase alors le nombre de lignes jointes calculé ici.
  if (jt !== 'region') {
    // Un chargement est déjà en cours (ex. "Colonne de jointure" et "Valeur
    // à cartographier" changés coup sur coup, chacun ré-appelant applyData) —
    // se retirer plutôt que de calculer une jointure sur un cache encore
    // incomplet : l'appel en cours rejouera de lui-même avec _joinCol/
    // _valueCol/jt les plus récents une fois son chargement terminé.
    if (_autoJoinBusy) return;
    var _needLayers = BLOCS_SOURCE_LAYERS.filter(function(s) { return !_cache[s]; });
    if (!_cache['communes']) _needLayers.push('communes');
    if (_needLayers.length) {
      _autoJoinBusy = true;
      setStatus('… Chargement de la couche communes pour la jointure');
      Promise.all(_needLayers.map(function(s) { return _ensureLayer(s); }))
        .then(function() { _autoJoinBusy = false; applyData(); })
        .catch(function(e) { _autoJoinBusy = false; setStatus('Erreur de chargement : ' + e); });
      return;
    }
  }
  _dataMap = {}; _rowMap = {};
  _csvData.rows.forEach(function(row) {
    var keyRaw = row[_joinCol] || '';
    var key = (jt === 'name' || jt === 'region') ? _normStr(keyRaw) : keyRaw;
    var val = row[_valueCol];
    if (key) { _dataMap[key] = val; _rowMap[key] = row; }
    // Jointure tolérante : « Nom - Précision » (exports à suffixes maison) et
    // « Nom/Précision » (ex. noms officiels luxembourgeois du genre
    // « Redange/Attert » quand la couche communes ne connaît que
    // « Redange ») sont aussi indexés sous « Nom » seul, sans écraser une
    // entrée existante.
    if (jt === 'name') {
      var sep = String(keyRaw).indexOf(' - ') !== -1 ? ' - ' : (String(keyRaw).indexOf('/') !== -1 ? '/' : null);
      if (sep) {
        var alias = _normStr(String(keyRaw).split(sep)[0]);
        if (alias && _dataMap[alias] === undefined) { _dataMap[alias] = val; _rowMap[alias] = row; }
      }
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
  // ("communes" est déjà garantie chargée à ce stade pour jt !== 'region',
  // cf. le chargement anticipé en tête de fonction.)
  if (total > 0 && matched === 0 && jt !== 'region') {
    // La colonne de jointure ressemble à des valeurs, pas à des identifiants.
    var nNum = 0, nTot = 0;
    _csvData.rows.forEach(function(r) {
      var kk = r[_joinCol];
      if (kk !== undefined && String(kk).trim() !== '') { nTot++; if (!isNaN(parseFloat(kk))) nNum++; }
    });
    if (nTot && nNum > nTot * 0.8) {
      setStatus('⚠ Aucune ligne jointe : « ' + _joinCol + ' » contient des nombres. La colonne de jointure doit identifier la commune (ex. « Communes ») ; mettez la donnée à colorier (ex. « Parti vainqueur ») dans « Valeur à cartographier ».');
      // _choroColors/_choroBreaks pas remis à zéro → la légende continuait
      // d'afficher les seuils/couleurs de la DERNIÈRE jointure réussie alors
      // que la carte, elle, repasse en gris faute de correspondance.
      _catMode = false; _catColors = {}; _choroColors = []; _choroBreaks = [];
      _repaintChoro(); _updateLegend();
      return;
    }
    setStatus('⚠ Aucune ligne jointe : vérifiez la colonne de jointure (contient-elle les noms de communes ?) et le type d\'identifiant.');
    _catMode = false; _catColors = {}; _choroColors = []; _choroBreaks = [];
    _repaintChoro(); _updateLegend();
    return;
  }

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

  // Bascule automatiquement sur "communes" pour afficher la jointure —
  // c'est la SEULE couche valide pour jt !== 'region' (cf. plus haut) : pas
  // de comparaison à faire entre plusieurs couches candidates, contrairement
  // à l'ancienne logique qui pouvait se caler par erreur sur une couche
  // d'une autre granularité (cantons, Kreise…) déjà en cache pour une
  // raison sans rapport, simplement parce qu'elle matchait par coïncidence
  // quelques noms.
  if (matched > 0 && jt !== 'region' && _fillLayer !== 'communes') {
    _fillLayer = 'communes';
    var fsel = document.getElementById('fill-layer-sel');
    if (fsel) fsel.value = 'communes';
  }
  _repaintChoro();
  _renderCatColorUI();
  if (total) {
    // Sous 50 % de correspondances avec un identifiant "code" (INSEE/AGS/
    // NIS/Luxembourg), la cause la plus fréquente est un référentiel de
    // codes différent de celui de la couche communes de l'outil (constaté
    // en pratique : le code commune officiel Luxembourg du RNPP/STATEC ne
    // correspond pas au code stocké ici, sans rapport avec une erreur de
    // saisie) — le nom de commune, lui, reste fiable ; le suggérer plutôt
    // que de laisser deviner pourquoi la carte reste presque vide.
    var hint = (matched < total * 0.5 && jt !== 'name' && jt !== 'region')
      ? ' Peu de correspondances par code : essayez « Nom de commune » — les codes de cette couche ne suivent pas forcément le même référentiel que votre fichier.'
      : '';
    setStatus((matched < total
      ? '⚠ ' + matched + '/' + total + ' lignes jointes — seuils calculés sur les lignes jointes uniquement.'
      : '✓ ' + matched + '/' + total + ' lignes jointes.') + hint);
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
      _valueColLabel = '';
      var lblInp = document.getElementById('value-col-label');
      if (lblInp) lblInp.value = '';
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
                 + '<div class="pal-label">'+_escHtml(p.label || p.id)+'</div>';
    sw.addEventListener('click', function() {
      _choroPalette = p.id;
      _choroColorOverrides = {}; // la palette change de sens : les couleurs personnalisées par classe ne s'appliquent plus
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
  if (_ttFields.dataval && _valueLabel()) {
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
      html += '<div class="tt-row"><span class="tt-row-label">' + _escHtml(_valueLabel()) + '</span><span class="tt-data-val">' + _escHtml(_ttVal) + '</span></div>';
    }
  }

  }
  html += '<div style="font-size:9.5px;color:#bbb;margin-top:5px;text-align:right">' + (_ttPinned ? '🔒 Cliquer pour déverrouiller' : 'Clic = verrouiller') + '</div>';

  tt.innerHTML = html;
  tt.classList.add('vis');
  tt.style.background = _ttBoxBg || '';
  tt.style.color = _ttBoxColor || '';

  var frame = document.getElementById('map-frame');
  var fr = frame.getBoundingClientRect();
  _positionTooltip(tt, fr, e.point.x, e.point.y);
}

// Sur pointeur tactile (doigt imprécis), une bulle flottante est difficile
// à lire/atteindre — bascule en fiche ancrée en bas de la carte, pleine
// largeur (mêmes proportions que le pied de page de l'embed publié). Sur
// pointeur fin (souris/trackpad), comportement flottant habituel, positionné
// près du curseur — quelle que soit la largeur de fenêtre : une largeur de
// #map-frame réduite (fenêtre desktop pas maximisée, sidebar ouverte...)
// déclenchait auparavant la fiche mobile même en usage souris, la faisant
// atterrir en bas de carte, juste au-dessus de la légende.
function _isMobileTooltipMode() {
  // L'aperçu "Vue Mobile" de l'outil simule un téléphone dans une fenêtre où
  // l'auteur, lui, garde toujours une souris — sans ce cas, l'aperçu ne
  // montrerait jamais le rendu réel que verront les lecteurs sur téléphone.
  var mobilePreview = document.body.classList.contains('preview-mode')
    && !document.body.classList.contains('pv-tablet');
  return mobilePreview || window.matchMedia('(pointer: coarse)').matches;
}
function _positionTooltip(tt, fr, px, py) {
  if (_isMobileTooltipMode()) {
    tt.classList.add('tt-sheet');
    tt.style.left = ''; tt.style.top = '';
    return;
  }
  tt.classList.remove('tt-sheet');
  var ttW = tt.offsetWidth || 220, ttH = tt.offsetHeight || 160;
  var left = Math.max(4, Math.min(px + 14, fr.width - ttW - 4));
  var top  = py - ttH - 12 < 4 ? py + 14 : py - ttH - 12;
  tt.style.left = left + 'px';
  tt.style.top  = Math.max(4, top) + 'px';
}
function _hideTooltip() {
  document.getElementById('map-tt').classList.remove('vis');
}

// ══════════════════════════════════════════════════════════════════
