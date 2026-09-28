//  DONNÉES — RECHERCHE EN DIRECT DE FICHIERS TABULAIRES
//  Pendant, pour l'onglet Données, de la recherche en direct de l'onglet
//  Bibliothèque (js/24 _searchTabularCatalogs, js/25 pour l'équivalent
//  géographique) — ne montre que des formats que #csv-input sait avaler
//  tel quel (CSV), pour que chaque résultat affiché soit réellement
//  utilisable en un clic, comme pour la recherche géographique.
// ══════════════════════════════════════════════════════════════════

function _wireDataTabSearch() {
  var btn = document.getElementById('btn-data-search');
  var input = document.getElementById('data-search-input');
  if (!btn || !input) return;
  function run() {
    var q = input.value.trim();
    if (!q) return;
    _runDataTabSearch(q);
  }
  btn.addEventListener('click', run);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') run(); });
}

function _runDataTabSearch(query) {
  var box = document.getElementById('data-search-results');
  if (!box) return;
  box.innerHTML = '<div style="font-size:10.5px;color:var(--muted);padding:6px 2px">Recherche dans Open Data Luxembourg…</div>';

  _searchTabularCatalogs(query).then(function(results) {
    box.innerHTML = '';
    if (!results.length) {
      box.innerHTML = '<div style="font-size:10.5px;color:var(--muted);padding:6px 2px">Aucun CSV trouvé pour « ' + _escHtml(query) + ' ».</div>';
      return;
    }
    results.sort(function(a, b) { return (b.dateMs || 0) - (a.dateMs || 0); });
    results.forEach(function(r) { _appendDataSearchResult(r, box); });
  }).catch(function(e) {
    box.innerHTML = '<div style="font-size:10.5px;color:var(--accent-red)">✗ Échec de la recherche : ' + _escHtml(e.message || e) + '</div>';
  });
}

function _appendDataSearchResult(r, box) {
  var row = document.createElement('div');
  row.className = 'terr-layer-row';
  row.style.alignItems = 'center';
  var span = document.createElement('span');
  span.style.cssText = 'flex:1;padding-right:8px;line-height:1.35';
  var dateStr = _fmtResultDate(r.dateMs);
  span.innerHTML = _escHtml(r.title) + ' <span class="lib-badge">' + _escHtml(r.sourceLabel) + '</span>'
    + (dateStr ? ' <span class="lib-badge" title="Date de la ressource">' + _escHtml(dateStr) + '</span>' : '');

  var dl = document.createElement('a');
  dl.className = 'btn btn-secondary btn-sm';
  dl.textContent = '⬇';
  dl.title = 'Télécharger le CSV';
  dl.href = r.url; dl.target = '_blank'; dl.rel = 'noopener noreferrer';

  var btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm';
  btn.textContent = '+ Charger';
  btn.title = 'Charger ce CSV dans le champ ci-dessus (colonne de jointure et valeur à choisir ensuite)';
  btn.addEventListener('click', function() { _loadDataSearchResult(r, btn); });

  row.appendChild(span);
  row.appendChild(dl);
  row.appendChild(btn);
  box.appendChild(row);
}

function _loadDataSearchResult(r, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  setStatus('Récupération de « ' + r.title + ' »…');
  fetch(r.url)
    .then(function(resp) { return resp.ok ? resp.text() : Promise.reject(new Error('HTTP ' + resp.status)); })
    .then(function(text) {
      document.getElementById('csv-input').value = text;
      loadCSV();
      btn.textContent = '✓ Chargé';
      setStatus('✓ « ' + r.title + ' » chargé — choisissez la colonne de jointure et la valeur à cartographier ci-dessus.');
      document.getElementById('csv-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function() { btn.textContent = '+ Charger'; btn.disabled = false; }, 1800);
    })
    .catch(function(err) {
      setStatus('✗ « ' + r.title + ' » : échec du chargement (' + err.message + ')');
      btn.textContent = '✗ Échec';
      btn.title = 'Échec du chargement — cliquer pour réessayer : ' + err.message;
      btn.disabled = false;
    });
}
