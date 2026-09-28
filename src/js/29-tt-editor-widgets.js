//  INFOBULLE — BARRE D'OUTILS + APERÇU EN DIRECT
//  Partagé entre le modèle global (onglet Style > Infobulle, js/07 + js/11)
//  et le modèle par couche Bibliothèque (js/28) — le point commun des deux
//  est un <textarea> de modèle HTML avec placeholders {{var}} ; ce module
//  ajoute au-dessus une barre de boutons qui insère des éléments prédéfinis
//  sans avoir à écrire de HTML, et en dessous un aperçu rendu en direct
//  (mêmes classes CSS que la vraie infobulle, cf. styles.css) — pour rendre
//  le modèle éditable sans avoir à le lire.
// ══════════════════════════════════════════════════════════════════

// Insère avant/après la sélection courante (ou un texte de repli si rien
// n'est sélectionné), puis resélectionne le texte inséré — permet de
// ré-appliquer un bouton (ex. mettre en valeur une autre portion) sans
// perdre le curseur.
function _ttInsertAtCursor(ta, before, after, fallback) {
  var s = ta.selectionStart || 0, end = ta.selectionEnd || 0;
  var mid = ta.value.substring(s, end) || fallback || '';
  ta.value = ta.value.substring(0, s) + before + mid + after + ta.value.substring(end);
  ta.selectionStart = s + before.length;
  ta.selectionEnd = ta.selectionStart + mid.length;
  ta.focus();
}

// onChange : appelé après chaque insertion (mise à jour de la variable liée
// au textarea + rafraîchissement de l'aperçu/de la carte, propre à chaque
// appelant — cf. js/11-events.js et js/28-library-tooltip-custom.js).
function _buildTtToolbar(ta, onChange) {
  var bar = document.createElement('div');
  bar.className = 'tt-editor-toolbar';
  [
    { label: '― Ligne fine', title: 'Insérer une ligne de séparation fine',
      run: function() { _ttInsertAtCursor(ta, '\n<hr class="tt-hr-thin">\n', '', ''); } },
    { label: '─ Ligne moyenne', title: 'Insérer une ligne de séparation moyenne',
      run: function() { _ttInsertAtCursor(ta, '\n<hr class="tt-hr-medium">\n', '', ''); } },
    { label: '▬ Ligne épaisse', title: 'Insérer une ligne de séparation épaisse',
      run: function() { _ttInsertAtCursor(ta, '\n<hr class="tt-hr-thick">\n', '', ''); } },
    { label: '☰ Liste', title: 'Insérer une liste à puces',
      run: function() { _ttInsertAtCursor(ta, '\n<ul class="tt-list">\n  <li>', '</li>\n  <li>Élément 2</li>\n</ul>\n', 'Élément 1'); } },
    { label: 'A＋ Mettre en valeur', title: 'Agrandir le texte sélectionné (ou un texte de départ)',
      run: function() { _ttInsertAtCursor(ta, '<big>', '</big>', 'Texte en valeur'); } }
  ].forEach(function(b) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = b.label; btn.title = b.title;
    btn.addEventListener('click', function() { b.run(); onChange(); });
    bar.appendChild(btn);
  });
  return bar;
}

// getTpl/getCtx : fonctions (pas des valeurs figées) — appelées à chaque
// refresh() pour toujours lire l'état courant du modèle et son contexte
// d'exemple (fixe pour le modèle global, données réelles de la couche pour
// le modèle Bibliothèque, cf. les deux appelants).
function _buildTtPreview(getTpl, getCtx) {
  var box = document.createElement('div');
  box.className = 'tt-preview-box';
  var label = document.createElement('span');
  label.className = 'tt-preview-label';
  label.textContent = 'Aperçu';
  var inner = document.createElement('div');
  inner.className = 'tt-preview-inner';
  box.appendChild(label);
  box.appendChild(inner);
  box.refresh = function() {
    var tpl = getTpl();
    inner.innerHTML = tpl.trim()
      ? _renderTpl(tpl, getCtx(), true)
      : '<span style="color:var(--muted);font-size:11px">Le modèle est vide — utilisez les boutons ci-dessus ou les variables ci-dessous.</span>';
  };
  return box;
}

// Contexte d'exemple pour l'aperçu du modèle GLOBAL (onglet Style) — fixe,
// pour que l'aperçu fonctionne même avant tout survol de la carte (cf.
// js/09-ui-helpers.js _ttContext pour le contexte réel utilisé à l'affichage).
function _ttGlobalPreviewContext() {
  var region = 'Grand Est';
  return {
    name: 'Metz', region: BLOC_LABELS[region] || region, pays: 'France',
    dept: 'Moselle', arrondissement: 'Metz', canton: '', kreis: '', province: '', vg: '',
    code: '57463', valeur: '42', colonne: _valueLabel() || 'Valeur',
    flag_pays: FLAG_PAYS['France'] || '', flag_region: FLAG_REGION[region] || '',
    chipLabel: 'Lorraine', chipColor: BLOC_COLORS[region] || '#a6d49f',
    // Alias layerName/layerColor (vocabulaire Bibliothèque, js/28) : un
    // modèle copié depuis l'onglet Bibliothèque se prévisualise ici aussi.
    layerName: 'Lorraine', layerColor: BLOC_COLORS[region] || '#a6d49f'
  };
}
