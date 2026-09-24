
// ══════════════════════════════════════════════════════════════════
//  PUBLICATION — GitHub Pages en un clic (jeton + manifeste)
// ══════════════════════════════════════════════════════════════════
// Remplace le workflow manuel (télécharger → glisser dans le dépôt →
// attendre le déploiement → copier l'URL) par un appel direct à l'API
// GitHub Contents depuis le navigateur (api.github.com supporte CORS,
// vérifié en conditions réelles). Le jeton ne quitte jamais ce module :
// _serializeEmbedPayload()/_generateEmbedHTML() (js/13) n'y ont pas accès.

function _ghToken() {
  try { return localStorage.getItem(LS_TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function _setGhToken(tok) {
  try {
    if (tok) localStorage.setItem(LS_TOKEN_KEY, tok);
    else localStorage.removeItem(LS_TOKEN_KEY);
  } catch (e) {}
}

function _b64EncodeUtf8(str) { return btoa(unescape(encodeURIComponent(str))); }
function _b64DecodeUtf8(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }

function _ghApi(path, opts) {
  opts = opts || {};
  var headers = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  var tok = _ghToken();
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  return fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/' + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function (resp) {
    if (resp.status === 401) throw new Error('Jeton invalide ou expiré.');
    if (resp.status === 403) throw new Error('Jeton sans les permissions requises (Contents: Read and write sur ce dépôt).');
    if (resp.status === 404) return null;
    if (!resp.ok) {
      return resp.text().then(function (t) {
        throw new Error('Erreur GitHub (' + resp.status + ') : ' + t.slice(0, 200));
      });
    }
    return resp.status === 204 ? null : resp.json();
  });
}

function _ghGetFile(path) {
  return _ghApi('contents/' + path + '?ref=' + GH_BRANCH).then(function (res) {
    if (!res) return null;
    return { sha: res.sha, content: _b64DecodeUtf8(res.content) };
  });
}

function _ghPutFile(path, content, message, sha) {
  var body = { message: message, content: _b64EncodeUtf8(content), branch: GH_BRANCH };
  if (sha) body.sha = sha;
  return _ghApi('contents/' + path, { method: 'PUT', body: body });
}

function _ghDeleteFile(path, message, sha) {
  return _ghApi('contents/' + path, { method: 'DELETE', body: { message: message, sha: sha, branch: GH_BRANCH } });
}

// ── Manifeste des cartes publiées (manifest.json à la racine du dépôt) ──
function _loadManifestForWrite() {
  return _ghGetFile(MANIFEST_PATH).then(function (f) {
    if (!f) return { sha: null, list: [] };
    var list;
    try { list = JSON.parse(f.content); } catch (e) { list = []; }
    return { sha: f.sha, list: Array.isArray(list) ? list : [] };
  });
}

function _loadManifestPublic() {
  // Lecture publique (page GitHub Pages), aucun jeton requis.
  return fetch(GITHUB_PAGES_BASE + MANIFEST_PATH, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (list) { return Array.isArray(list) ? list : []; });
}

// ── Publication ──────────────────────────────────────────────────
function _waitUntilLive(url, timeoutMs) {
  var start = Date.now();
  timeoutMs = timeoutMs || 45000;
  function attempt() {
    return fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) { return !!r.ok; })
      .catch(function () { return false; })
      .then(function (ok) {
        if (ok) return true;
        if (Date.now() - start > timeoutMs) return false;
        return new Promise(function (res) { setTimeout(res, 3000); }).then(attempt);
      });
  }
  return attempt();
}

function _publishCurrentMap() {
  if (!_mapReady) return Promise.reject(new Error('Carte non prête.'));
  if (!_ghToken()) return Promise.reject(new Error('Collez votre jeton GitHub ci-dessus d’abord.'));

  var sel = document.getElementById('embed-publish-target');
  var updateFilename = sel && sel.value ? sel.value : null;

  var info = _serializeEmbedPayload();
  var filename = updateFilename || ('grande-region-' + info.id + '.html');
  var html = _generateEmbedHTML(info.payload);
  var meta = _getMapMeta();
  var title = (meta && meta.title) || 'Carte Grande Région';
  var width = Number(document.getElementById('embed-w').value) || 800;
  var height = Number(document.getElementById('embed-h').value) || 520;

  return _ghGetFile(filename)
    .then(function (existing) {
      return _ghPutFile(filename, html, 'Publie ' + filename, existing ? existing.sha : null);
    })
    .then(function () { return _loadManifestForWrite(); })
    .then(function (m) {
      var url = GITHUB_PAGES_BASE + filename;
      var now = new Date().toISOString();
      var idx = -1;
      m.list.forEach(function (e, i) { if (e.filename === filename) idx = i; });
      var entry = {
        id: idx >= 0 ? m.list[idx].id : info.id,
        filename: filename, title: title, url: url,
        width: width, height: height, updatedAt: now,
        createdAt: idx >= 0 ? (m.list[idx].createdAt || now) : now
      };
      if (idx >= 0) m.list[idx] = entry; else m.list.push(entry);
      return _ghPutFile(MANIFEST_PATH, JSON.stringify(m.list, null, 2), 'Met à jour manifest.json', m.sha)
        .then(function () { return { url: url, width: width, height: height }; });
    })
    .then(function (result) {
      return _waitUntilLive(result.url).then(function (isLive) {
        return { url: result.url, width: result.width, height: result.height, isLive: isLive };
      });
    });
}

function _deletePublishedMap(filename, title) {
  if (!_ghToken()) return Promise.reject(new Error('Jeton GitHub requis.'));
  if (!window.confirm('Supprimer "' + title + '" ? Le lien cessera de fonctionner s’il est déjà intégré ailleurs.')) {
    return Promise.resolve(false);
  }
  return _ghGetFile(filename).then(function (existing) {
    return existing ? _ghDeleteFile(filename, 'Supprime ' + filename, existing.sha) : null;
  }).then(function () {
    return _loadManifestForWrite();
  }).then(function (m) {
    m.list = m.list.filter(function (e) { return e.filename !== filename; });
    return _ghPutFile(MANIFEST_PATH, JSON.stringify(m.list, null, 2), 'Retire ' + filename + ' du manifeste', m.sha);
  }).then(function () { return true; });
}

// ── UI : statuts ─────────────────────────────────────────────────
function _setPublishStatus(msg, kind) {
  var el = document.getElementById('publish-status');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'publish-status' + (kind ? ' ' + kind : '');
}

function _refreshTokenUI() {
  var input = document.getElementById('gh-token-input');
  var status = document.getElementById('gh-token-status');
  var has = !!_ghToken();
  if (input) input.placeholder = has ? '•••••••••••••••••• (enregistré)' : 'github_pat_…';
  if (status) {
    status.textContent = has ? '✓ Jeton enregistré sur cet appareil.' : 'Aucun jeton enregistré.';
    status.style.color = has ? '#1e8449' : '';
  }
}

// ── Cible de mise à jour dans le modal embed ─────────────────────
function _populatePublishTargetSelect() {
  var sel = document.getElementById('embed-publish-target');
  if (!sel) return;
  sel.innerHTML = '<option value="">Nouvelle carte</option>';
  _loadManifestPublic().then(function (entries) {
    entries.forEach(function (e) {
      var opt = document.createElement('option');
      opt.value = e.filename;
      opt.textContent = 'Mettre à jour : ' + (e.title || e.filename);
      sel.appendChild(opt);
    });
  });
}

// ── Galerie des cartes publiées (onglet "Publié") ────────────────
var _pubEntries = [];

function _pubCopyCode(entry) {
  var code = '<iframe\n  src="' + entry.url + '"\n  width="' + entry.width + '" height="' + entry.height + '"\n'
           + '  style="border:0" loading="lazy" title="' + _escAttr(entry.title || 'Carte Grande Région') + '"></iframe>';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function () {
      setStatus('✓ Code copié — ' + (entry.title || entry.filename));
    });
  }
}

function _pubUpdateTarget(entry) {
  _openEmbedModal();
  var sel = document.getElementById('embed-publish-target');
  if (sel) sel.value = entry.filename;
  var w = document.getElementById('embed-w'); if (w) w.value = entry.width;
  var h = document.getElementById('embed-h'); if (h) h.value = entry.height;
}

function _pubDelete(entry) {
  _deletePublishedMap(entry.filename, entry.title || entry.filename).then(function (done) {
    if (done) _refreshPublishedList();
  }).catch(function (err) { setStatus('✗ ' + err.message); });
}

function _refreshPublishedList() {
  var list = document.getElementById('pub-list');
  var hint = document.getElementById('pub-empty-hint');
  if (!list) return;
  list.innerHTML = '<div class="msl-hint">Chargement…</div>';
  _loadManifestPublic().then(function (entries) {
    entries.sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
    _pubEntries = entries;
    if (hint) hint.style.display = entries.length ? 'none' : 'block';
    list.innerHTML = entries.map(function (e) {
      var d = e.updatedAt ? new Date(e.updatedAt).toLocaleDateString('fr-FR') : '';
      return '<div class="pub-item">'
        + '<div class="pub-item-name">' + _escHtml(e.title || e.filename) + '</div>'
        + '<div class="pub-item-sub">' + d + ' · ' + e.width + '×' + e.height + '</div>'
        + '<div class="pub-item-actions">'
        + '<button class="btn btn-ghost btn-sm" data-pub="copy" data-filename="' + _escAttr(e.filename) + '">Copier le code</button>'
        + '<a class="btn btn-ghost btn-sm" href="' + _escAttr(e.url) + '" target="_blank" rel="noopener">Ouvrir</a>'
        + '<button class="btn btn-ghost btn-sm" data-pub="update" data-filename="' + _escAttr(e.filename) + '">Mettre à jour</button>'
        + '<button class="btn btn-ghost btn-sm" data-pub="delete" data-filename="' + _escAttr(e.filename) + '">Supprimer</button>'
        + '</div></div>';
    }).join('');
  });
}

// ── Câblage (appelé depuis wireEvents(), js/11-events.js) ────────
function _wirePublishUI() {
  _refreshTokenUI();

  var saveBtn = document.getElementById('gh-token-save');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    var input = document.getElementById('gh-token-input');
    var tok = (input && input.value || '').trim();
    if (!tok) { var s = document.getElementById('gh-token-status'); if (s) { s.textContent = 'Collez un jeton avant d’enregistrer.'; s.style.color = '#c0392b'; } return; }
    _setGhToken(tok);
    if (input) input.value = '';
    _refreshTokenUI();
  });

  var clearBtn = document.getElementById('gh-token-clear');
  if (clearBtn) clearBtn.addEventListener('click', function () {
    _setGhToken('');
    _refreshTokenUI();
  });

  var pubBtn = document.getElementById('btn-publish-embed');
  if (pubBtn) pubBtn.addEventListener('click', function () {
    // Jeton saisi à l'instant dans le modal (pas encore enregistré) :
    // on l'enregistre au vol pour publier en un seul clic, sans repasser
    // par l'onglet "Publié".
    if (!_ghToken()) {
      var inlineInput = document.getElementById('embed-token-input');
      var inlineTok = (inlineInput && inlineInput.value || '').trim();
      if (inlineTok) {
        _setGhToken(inlineTok);
        _refreshTokenUI();
        var tokenBox = document.getElementById('embed-token-inline');
        if (tokenBox) tokenBox.classList.remove('show');
      }
    }

    pubBtn.disabled = true;
    _setPublishStatus('Publication en cours…', 'pending');
    _publishCurrentMap().then(function (res) {
      pubBtn.disabled = false;
      var urlInput = document.getElementById('embed-url');
      if (urlInput) urlInput.value = res.url;
      _updateEmbedCode();
      _setPublishStatus(res.isLive ? '✓ En ligne.' : '✓ Publié (mise en ligne en cours — quelques secondes de plus).', 'ok');
      _populatePublishTargetSelect();
      _refreshPublishedList();
    }).catch(function (err) {
      pubBtn.disabled = false;
      _setPublishStatus('✗ ' + err.message, 'err');
    });
  });

  var refreshBtn = document.getElementById('pub-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', _refreshPublishedList);

  var pubList = document.getElementById('pub-list');
  if (pubList) pubList.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pub]');
    if (!btn) return;
    var filename = btn.dataset.filename;
    var entry = null;
    _pubEntries.forEach(function (x) { if (x.filename === filename) entry = x; });
    if (!entry) return;
    if (btn.dataset.pub === 'copy') _pubCopyCode(entry);
    else if (btn.dataset.pub === 'update') _pubUpdateTarget(entry);
    else if (btn.dataset.pub === 'delete') _pubDelete(entry);
  });

  _refreshPublishedList();
}
