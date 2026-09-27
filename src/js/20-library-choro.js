//  BIBLIOTHÈQUE — CHOROPLÈTHE PAR CHAMP (helpers extraits de 10-library.js
//  pour respecter le plafond de 500 lignes par module)
// ══════════════════════════════════════════════════════════════════

// Libellé lisible pour un nom de champ technique (ex. "evo_pop_total_2025_2070_txt"
// → "Evo pop total 2025 2070") — GIS-GR suffixe "_txt" ses champs texte
// formatés (ex. "5,0%"), ce qui ressemblait à tort à une extension de
// fichier .txt dans le sélecteur. Purement cosmétique : la valeur réelle
// utilisée pour la couleur reste le nom de champ brut (option.value).
function _prettyFieldLabel(key) {
  return key.replace(/_txt$/i, '').replace(/_/g, ' ').trim()
    .replace(/^./, function(c) { return c.toUpperCase(); });
}

// Seuils quantiles + palette pour un champ donné — indépendant du CSV/join
// (cf. _buildChoroScale, js/06-choropleth-scale.js, qui lui reste dédié au
// flux CSV). Écrit aussi la valeur numérique normalisée dans chaque feature
// (_cv) : les expressions MapLibre ne savent pas parser "5,0%" elles-mêmes.
function _computeLayerChoro(layer, field, paletteId, steps) {
  var vals = [];
  (layer.geojson.features || []).forEach(function(f) {
    var n = _coerceNum((f.properties || {})[field]);
    f.properties._cv = n;
    if (n !== null) vals.push(n);
  });
  if (!vals.length) return null;
  vals.sort(function(a, b) { return a - b; });
  steps = Math.min(steps || 5, Math.max(2, vals.length));
  var breaks = [];
  for (var i = 1; i < steps; i++) breaks.push(vals[Math.floor(vals.length * i / steps)]);
  var palObj = CHORO_PALS.find(function(p) { return p.id === paletteId; }) || CHORO_PALS[0];
  return { field: field, breaks: breaks, colors: _interpolatePalette(palObj.c, steps),
           min: vals[0], max: vals[vals.length - 1] };
}

// Format court pour les bornes de légende (entier si c'en est un, sinon 1 décimale)
function _fmtChoroNum(v) {
  return (Math.round(v) === v ? v : v.toFixed(1)).toString().replace('.', ',');
}
