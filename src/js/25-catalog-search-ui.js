//  BIBLIOTHÈQUE — UI DE LA RECHERCHE EN DIRECT (js/24-catalog-search.js)
// ══════════════════════════════════════════════════════════════════

function _wireCatalogSearch() {
  var btn = document.getElementById('btn-catalog-search');
  var input = document.getElementById('catalog-search-input');
  if (!btn || !input) return;
  function run() {
    var q = input.value.trim();
    if (!q) return;
    _runCatalogSearch(q);
  }
  btn.addEventListener('click', run);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') run(); });

  // Un résultat "✓ Affiché" redevient "+ Ajouter" si sa couche est retirée
  // depuis un autre endroit (onglet Données/Bibliothèque), pas seulement en
  // recliquant ici — sinon le bouton mentirait sur l'état réel de la carte.
  _libLayerRemovedListeners.push(function(layerId) {
    document.querySelectorAll('#catalog-search-results [data-added-layer-id="' + layerId + '"]').forEach(function(row) {
      _setSearchResultAdded(row, null);
    });
  });
}

function _runCatalogSearch(query) {
  var box = document.getElementById('catalog-search-results');
  if (!box) return;
  box.innerHTML = '<div style="font-size:10.5px;color:var(--muted);padding:6px 2px">Recherche dans GIS-GR, Géoportail Luxembourg, Open Data Luxembourg et STATEC/LUSTAT…</div>';

  Promise.all([_searchGeoCatalogs(query), _searchStatec(query)]).then(function(res) {
    var all = res[0].concat(res[1]);
    box.innerHTML = '';
    if (!all.length) {
      box.innerHTML = '<div style="font-size:10.5px;color:var(--muted);padding:6px 2px">Aucun résultat téléchargeable pour « ' + _escHtml(query) + ' ».</div>';
      return;
    }
    // Les fichiers les plus récents en premier, sur tous les catalogues
    // confondus (pas un classement par source) — dateMs manquant (0) relégué
    // en fin de liste plutôt qu'exclu, la date n'étant pas toujours exposée.
    all.sort(function(a, b) { return (b.dateMs || 0) - (a.dateMs || 0); });
    all.forEach(function(r) {
      if (r.kind === 'statec') _appendStatecSearchResult(r, box);
      else _appendGeoSearchResult(r, box);
    });
  }).catch(function(e) {
    box.innerHTML = '<div style="font-size:10.5px;color:var(--accent-red)">✗ Échec de la recherche : ' + _escHtml(e.message || e) + '</div>';
  });
}

function _fmtResultDate(dateMs) {
  if (!dateMs) return '';
  var d = new Date(dateMs);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function _appendGeoSearchResult(r, box) {
  var row = document.createElement('div');
  row.className = 'terr-layer-row';
  row.style.alignItems = 'center';
  var span = document.createElement('span');
  span.style.cssText = 'flex:1;padding-right:8px;line-height:1.35';
  var dateStr = _fmtResultDate(r.dateMs);
  span.innerHTML = _escHtml(r.title) + ' <span class="lib-badge">' + _escHtml(r.sourceLabel) + '</span>'
    + (dateStr ? ' <span class="lib-badge" title="Date de la donnée source">' + _escHtml(dateStr) + '</span>' : '');

  var dl = document.createElement('a');
  dl.className = 'btn btn-secondary btn-sm';
  dl.textContent = '⬇';
  dl.title = 'Télécharger le fichier identifié';
  dl.href = r.url; dl.target = '_blank'; dl.rel = 'noopener noreferrer';

  var btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm';
  btn.textContent = '+ Ajouter';
  btn.title = 'Récupérer ce jeu de données réel et l\'ajouter comme couche';
  btn.addEventListener('click', function() { _addSearchResultAsLayer(r, row, btn); });

  row.appendChild(span);
  row.appendChild(dl);
  row.appendChild(btn);
  box.appendChild(row);
}

// STATEC/LUSTAT : séries temporelles nationales (une valeur par période, pas
// par commune) — pas de bouton "+ Ajouter" qui suggérerait à tort une
// compatibilité choroplèthe ; juste un accès et un téléchargement du brut.
function _appendStatecSearchResult(r, box) {
  var row = document.createElement('div');
  row.className = 'terr-layer-row';
  row.style.alignItems = 'center';
  var span = document.createElement('span');
  span.style.cssText = 'flex:1;padding-right:8px;line-height:1.35';
  var dateStr = _fmtResultDate(r.dateMs);
  span.innerHTML = _escHtml(r.title) + ' <span class="lib-badge">STATEC / LUSTAT</span>'
    + (dateStr ? ' <span class="lib-badge" title="Date de publication">' + _escHtml(dateStr) + '</span>' : '');
  span.title = 'Série temporelle nationale (une valeur par période) — non cartographiable directement, contrairement aux jeux de données géographiques ci-dessus.';

  var dl = document.createElement('a');
  dl.className = 'btn btn-secondary btn-sm';
  dl.textContent = '⬇';
  dl.title = 'Télécharger le CSV brut';
  dl.href = r.csvUrl; dl.target = '_blank'; dl.rel = 'noopener noreferrer';

  var link = document.createElement('a');
  link.className = 'btn btn-secondary btn-sm';
  link.textContent = '↗ Voir sur LUSTAT';
  link.href = r.viewUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';

  row.appendChild(span);
  row.appendChild(dl);
  row.appendChild(link);
  box.appendChild(row);
}

// Repli de sûreté avant tout ajout à la carte : un intitulé peut annoncer
// WGS84 alors que le fichier réel est dans une autre projection (constaté
// en test sur un résultat Open Data Luxembourg dont l'URL ne portait aucune
// trace de "LUREF", seul le titre de la ressource le mentionnait) — sans ce
// contrôle, la couche s'ajouterait avec des coordonnées fausses ou hors
// carte. Un point WGS84 valide a toujours |lon|≤180 et |lat|≤90 ; les
// coordonnées LUREF (EPSG:2169) sont des mètres à 5-6 chiffres.
function _firstCoordinate(geom) {
  if (!geom) return null;
  var c = geom.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') ? c : null;
}
function _looksLikeWgs84(geojson) {
  var feats = geojson.features || [];
  for (var i = 0; i < Math.min(feats.length, 5); i++) {
    var pt = _firstCoordinate(feats[i].geometry);
    if (!pt) continue;
    if (Math.abs(pt[0]) > 180 || Math.abs(pt[1]) > 90) return false;
  }
  return true;
}

// État visuel du bouton "+ Ajouter" : layerId = couche affichée (coloré,
// "✓ Affiché", reclic = retire) ; null = état neutre par défaut.
function _setSearchResultAdded(row, layerId) {
  var btn = row.querySelector('.btn:last-child');
  if (layerId) {
    row.dataset.addedLayerId = layerId;
    row.style.background = 'var(--success-bg)';
    btn.textContent = '✓ Affiché';
    btn.title = 'Déjà affiché sur la carte — cliquer pour retirer';
  } else {
    delete row.dataset.addedLayerId;
    row.style.background = '';
    btn.textContent = '+ Ajouter';
    btn.title = 'Récupérer ce jeu de données réel et l\'ajouter comme couche';
  }
  btn.disabled = false;
}

function _addSearchResultAsLayer(r, row, btn) {
  // Déjà affiché : reclic = retirer (évite le doublon plutôt que de
  // recharger une 2e fois la même couche).
  if (row.dataset.addedLayerId) { _removeUserLayer(row.dataset.addedLayerId); _setSearchResultAdded(row, null); return; }

  btn.disabled = true;
  btn.textContent = '…';
  setStatus('Récupération de « ' + r.title + ' »…');
  _fetchTextSmart(r.url)
    .then(function(text) {
      var geojson = _parseLenientGeojson(text);
      if (!geojson || !geojson.features) throw new Error('réponse inattendue du serveur');
      if (!_looksLikeWgs84(geojson)) throw new Error('coordonnées hors WGS84 (projection non standard, ex. LUREF) — non intégrable directement');
      _dropGeometrylessFeatures(geojson);
      _assertHasUsableFeatures(geojson);
      var layer = _addUserLayer(r.title, geojson, _nextLibColor());
      _libPaletteIdx++;
      _setSearchResultAdded(row, layer.id);
      document.querySelector('.tab-btn[data-tab="data"]').click();
      _checkStaleLuCommunesUI(layer, row);
    })
    .catch(function(err) {
      // L'échec doit rester visible — pas de retour silencieux à "+
      // Ajouter" qui laisserait croire que rien ne s'est passé.
      setStatus('✗ « ' + r.title + ' » : échec du chargement (' + err.message + ')');
      btn.textContent = '✗ Échec';
      btn.title = 'Échec du chargement — cliquer pour réessayer : ' + err.message;
      btn.disabled = false;
    });
}

// Avertit si le fichier ajouté référence des communes luxembourgeoises
// fusionnées depuis (cf. LU_COMMUNE_MERGERS, js/24-catalog-search.js) — la
// carte ne doit jamais superposer silencieusement une physionomie du pays
// obsolète à la vue actuelle. Propose un correctif : renommer les valeurs
// vers la commune actuelle (ne fusionne PAS les polygones eux-mêmes — les
// anciens tracés communaux restent visibles, mais au moins nommés
// correctement pour l'infobulle, le tableau et une éventuelle jointure).
function _checkStaleLuCommunesUI(layer, afterRow) {
  var stale = _findStaleLuCommunes(layer.geojson);
  if (!stale.length) return;
  var list = stale.map(function(s) { return s.old + ' → ' + s.into; }).join(', ');
  setStatus('⚠ « ' + layer.name + ' » contient d\'anciennes communes luxembourgeoises fusionnées depuis : ' + list + ' — la physionomie du pays affichée n\'est plus à jour.');

  var warn = document.createElement('div');
  warn.style.cssText = 'font-size:10px;line-height:1.5;color:var(--warn-fg);background:var(--warn-bg);border-radius:6px;padding:6px 8px;margin:2px 0 6px';
  warn.innerHTML = '⚠ Anciennes communes détectées (fusionnées depuis) : <strong>' + _escHtml(list) + '</strong>.'
    + ' Les tracés d\'origine restent affichés tels quels ; seul le nom peut être corrigé automatiquement.';
  var fixBtn = document.createElement('button');
  fixBtn.className = 'btn btn-secondary btn-sm';
  fixBtn.style.marginTop = '4px';
  fixBtn.textContent = '🔧 Renommer vers les communes actuelles';
  fixBtn.addEventListener('click', function() {
    _renameStaleLuCommunes(layer, stale);
    warn.remove();
    setStatus('✓ Noms de communes mis à jour dans « ' + layer.name + ' ».');
  });
  warn.appendChild(document.createElement('br'));
  warn.appendChild(fixBtn);
  afterRow.insertAdjacentElement('afterend', warn);
}

function _renameStaleLuCommunes(layer, stale) {
  var map = {};
  stale.forEach(function(s) { map[s.old] = s.into; });
  (layer.geojson.features || []).forEach(function(f) {
    var props = f.properties || {};
    Object.keys(props).forEach(function(k) {
      if (typeof props[k] === 'string' && map[props[k].trim()] !== undefined) props[k] = map[props[k].trim()];
    });
  });
  if (_map && _map.getSource('usrc-' + layer.id)) _map.getSource('usrc-' + layer.id).setData(layer.geojson);
}
