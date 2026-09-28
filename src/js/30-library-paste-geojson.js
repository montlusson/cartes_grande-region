//  BIBLIOTHÈQUE — COLLER DU GEOJSON DIRECTEMENT
//  Voie de secours quand un service externe échoue (WFS en panne, réponse
//  malformée...) : l'auteur récupère le GeoJSON autrement (onglet réseau du
//  navigateur, export d'un autre outil...) et le colle ici, plutôt que de
//  devoir d'abord l'enregistrer en fichier pour utiliser le dépôt/glisser
//  (js/10 _wireLibUpload, qui fournit _normalizeGeojsonText).
// ══════════════════════════════════════════════════════════════════

function _wireLibPaste() {
  var input = document.getElementById('lib-paste-input');
  var btn = document.getElementById('lib-paste-btn');
  if (!input || !btn) return;
  btn.addEventListener('click', function() {
    var text = input.value.trim();
    if (!text) return;
    var geojson;
    try {
      geojson = _normalizeGeojsonText(text);
    } catch (err) {
      setStatus('✗ GeoJSON collé : ' + err.message);
      return;
    }
    _addUserLayer('Couche collée', geojson, _nextLibColor());
    _libPaletteIdx++;
    input.value = '';
  });
}
