
function _openEmbedModal() {
  if (!_mapReady) return;

  var info = _serializeEmbedPayload();
  _embedPayload  = info.payload;
  _embedFilename = 'grande-region-' + info.id + '.html';

  // Avertissement taille > 3 Mo
  var note = document.getElementById('embed-size-note');
  if (note) note.classList.toggle('show', info.bytes > 3 * 1024 * 1024);

  // Pré-remplir avec l'URL GitHub Pages + nom de fichier
  var urlInput = document.getElementById('embed-url');
  if (urlInput) {
    urlInput.placeholder = GITHUB_PAGES_BASE + _embedFilename;
    urlInput.value = GITHUB_PAGES_BASE + _embedFilename;
  }

  // Générer le code iframe immédiatement (URL pré-remplie)
  _updateEmbedCode();

  // Onglet publication (js/16-publish.js) : liste des cartes déjà publiées
  // pour proposer une mise à jour en place plutôt qu'une nouvelle URL.
  if (typeof _populatePublishTargetSelect === 'function') _populatePublishTargetSelect();
  if (typeof _setPublishStatus === 'function') _setPublishStatus('');

  document.getElementById('embed-modal').classList.remove('hidden');
}

function _updateEmbedCode() {
  var url  = (document.getElementById('embed-url').value || '').trim();
  var w    = document.getElementById('embed-w').value || '800';
  var h    = document.getElementById('embed-h').value || '520';
  var ta   = document.getElementById('embed-code');
  var hint = document.getElementById('embed-code-hint');
  if (!url) {
    ta.value = '';
    if (hint) hint.style.display = '';
    return;
  }
  if (hint) hint.style.display = 'none';
  ta.value = '<iframe\n'
           + '  src="' + url + '"\n'
           + '  width="' + w + '" height="' + h + '"\n'
           + '  frameborder="0"\n'
           + '  scrolling="no"\n'
           + '  style="border:none;width:' + w + 'px;height:' + h + 'px"\n'
           + '  title="Grande Région — carte interactive"\n'
           + '  allowfullscreen\n'
           + '></iframe>';
}

// ══════════════════════════════════════════════════════════════════
