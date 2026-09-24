
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

  // Jeton inline : visible seulement s'il n'y en a pas déjà un enregistré
  // (évite l'aller-retour vers l'onglet "Publié" pour une 1ʳᵉ publication).
  var tokenBox = document.getElementById('embed-token-inline');
  if (tokenBox) tokenBox.classList.toggle('show', typeof _ghToken !== 'function' || !_ghToken());

  document.getElementById('embed-modal').classList.remove('hidden');
}

function _updateEmbedCode() {
  var url    = (document.getElementById('embed-url').value || '').trim();
  var w      = document.getElementById('embed-w').value || '800';
  var h      = document.getElementById('embed-h').value || '520';
  var ta     = document.getElementById('embed-code');
  var field  = document.getElementById('embed-result-field');
  var actions = document.getElementById('embed-result-actions');
  if (!url) {
    ta.value = '';
    if (field) field.classList.remove('show');
    if (actions) actions.classList.remove('show');
    return;
  }
  // max-width:100% évite le débordement horizontal sur mobile si la page
  // hôte ne contraint pas déjà ses iframes (le ratio w/h est conservé, la
  // hauteur reste fixe — c'est la largeur qui cède la place si besoin).
  ta.value = '<iframe\n'
           + '  src="' + url + '"\n'
           + '  width="' + w + '" height="' + h + '"\n'
           + '  frameborder="0"\n'
           + '  scrolling="no"\n'
           + '  style="border:none;width:' + w + 'px;height:' + h + 'px;max-width:100%"\n'
           + '  title="Grande Région — carte interactive"\n'
           + '  allowfullscreen\n'
           + '></iframe>';
  if (field) field.classList.add('show');
  if (actions) actions.classList.add('show');
}

// ══════════════════════════════════════════════════════════════════
