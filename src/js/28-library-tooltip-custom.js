//  BIBLIOTHÈQUE — INFOBULLE PERSONNALISÉE PAR COUCHE
//  Le modèle HTML global (Style > Infobulle, js/07-choropleth-data.js) ne
//  sert que la couche administrative active — une couche Bibliothèque (ex.
//  un GeoJSON importé ou trouvé via la recherche) a un schéma de propriétés
//  totalement différent et sans rapport, donc son PROPRE modèle, pas un
//  modèle partagé global. _showLibraryTooltip (js/19-library-focus.js)
//  l'utilise en priorité si activé.
// ══════════════════════════════════════════════════════════════════

// Toutes les clés de propriété (pas seulement numériques, cf.
// _detectNumericFields) — ce sont les variables insérables dans le modèle.
function _detectAllFields(geojson) {
  var feats = (geojson.features || []).slice(0, 30);
  var keys = {};
  feats.forEach(function(f) { Object.keys(f.properties || {}).forEach(function(k) { keys[k] = true; }); });
  return Object.keys(keys).sort();
}

// Titre par défaut d'une feature sans modèle personnalisé : la clé "name"
// n'existe pas toujours (ex. jeux de données GIS-GR/Géoportail en majuscules
// ou dans une autre langue) — repli sur les variantes courantes, puis sur la
// première propriété textuelle non vide plutôt que de n'afficher aucun titre.
var _TITLE_KEY_GUESSES = ['name', 'NAME', 'Name', 'nom', 'NOM', 'Nom', 'title', 'TITLE', 'Title', 'label', 'LABEL', 'libelle', 'LIBELLE'];
function _guessFeatureTitle(props) {
  for (var i = 0; i < _TITLE_KEY_GUESSES.length; i++) {
    var v = props[_TITLE_KEY_GUESSES[i]];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  var keys = Object.keys(props);
  for (var j = 0; j < keys.length; j++) {
    var v2 = props[keys[j]];
    if (typeof v2 === 'string' && v2.trim() && !_LIB_FIELD_EXCLUDE_RE.test(keys[j])) return v2;
  }
  return '';
}

function _libraryDefaultTtTemplate(layer) {
  var fields = _detectAllFields(layer.geojson);
  var lines = ['<div class="tt-chip-row"><span class="tt-bloc-chip" style="background:{{layerColor}};color:#1a1a1a">{{layerName}}</span></div>'];
  var titleField = _TITLE_KEY_GUESSES.find(function(k) { return fields.indexOf(k) !== -1; });
  if (titleField) lines.push('<div class="tt-name">{{' + titleField + '}}</div>');
  fields.slice(0, 6).forEach(function(f) {
    if (f === titleField) return;
    lines.push('<div class="tt-row"><span class="tt-row-label">' + _escHtml(_prettyFieldLabel(f)) + '</span><span class="tt-row-val">{{' + f + '}}</span></div>');
  });
  return lines.join('\n');
}

function _appendLibTooltipEditor(layer, list, px) {
  var wrap = document.createElement('div');
  wrap.className = 'lib-opa-row';
  wrap.style.cssText = 'flex-wrap:wrap;gap:5px 6px;padding:4px 4px 8px 34px';
  wrap.id = 'lib-tted-row-' + px + layer.id;

  var toggleLbl = document.createElement('label');
  toggleLbl.style.cssText = 'flex-basis:100%;display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--muted);cursor:pointer';
  toggleLbl.innerHTML = '<input type="checkbox" id="lib-ttchk-' + px + layer.id + '"' + (layer.ttCustom ? ' checked' : '') + '> ✎ Personnaliser l\'infobulle de cette couche';
  wrap.appendChild(toggleLbl);

  var detail = document.createElement('div');
  detail.id = 'lib-ttdetail-' + px + layer.id;
  detail.style.cssText = 'flex-basis:100%;display:' + (layer.ttCustom ? 'block' : 'none');

  var tplRow = document.createElement('div');
  tplRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:3px';
  tplRow.innerHTML = '<span style="font-size:10px;color:var(--muted)">Modèle HTML</span>';
  var autoBtn = document.createElement('button');
  autoBtn.className = 'btn btn-secondary btn-sm'; autoBtn.type = 'button';
  autoBtn.textContent = '↺ Modèle auto';
  tplRow.appendChild(autoBtn);
  detail.appendChild(tplRow);

  var tpl = document.createElement('textarea');
  tpl.id = 'lib-tttpl-' + px + layer.id;
  tpl.rows = 5;
  tpl.style.cssText = 'width:100%;font-family:monospace;font-size:10.5px';
  tpl.value = layer.ttTemplate || '';
  detail.appendChild(tpl);

  var colorsRow = document.createElement('div');
  colorsRow.style.cssText = 'display:flex;gap:10px;margin:6px 0';
  function colorField(labelText, id, value) {
    var f = document.createElement('div');
    f.style.cssText = 'display:flex;align-items:center;gap:4px';
    f.innerHTML = '<span style="font-size:10px;color:var(--muted)">' + labelText + '</span>' +
      '<input type="color" id="' + id + '" value="' + (value || '#ffffff') + '" style="width:24px;height:20px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:none">';
    return f;
  }
  colorsRow.appendChild(colorField('Fond', 'lib-ttbg-' + px + layer.id, layer.ttBg || '#ffffff'));
  colorsRow.appendChild(colorField('Texte', 'lib-ttcolor-' + px + layer.id, layer.ttColor || '#1a1a1a'));
  detail.appendChild(colorsRow);

  var chipsWrap = document.createElement('div');
  chipsWrap.style.cssText = 'margin-top:2px';
  var fields = _detectAllFields(layer.geojson);
  ['layerName', 'layerColor'].concat(fields).forEach(function(f) {
    var chip = document.createElement('span');
    chip.className = 'tt-var-chip csv-col';
    chip.textContent = f;
    chip.addEventListener('click', function() {
      var insert = '{{' + f + '}}';
      var s = tpl.selectionStart || 0, end = tpl.selectionEnd || 0;
      tpl.value = tpl.value.substring(0, s) + insert + tpl.value.substring(end);
      tpl.selectionStart = tpl.selectionEnd = s + insert.length;
      tpl.focus();
      layer.ttTemplate = tpl.value;
      _refreshLibraryTooltipIfShown(layer);
    });
    chipsWrap.appendChild(chip);
  });
  detail.appendChild(chipsWrap);

  wrap.appendChild(detail);
  list.appendChild(wrap);

  toggleLbl.querySelector('input').addEventListener('change', function() {
    layer.ttCustom = this.checked;
    detail.style.display = this.checked ? 'block' : 'none';
    if (this.checked && !tpl.value.trim()) {
      tpl.value = _libraryDefaultTtTemplate(layer);
      layer.ttTemplate = tpl.value;
    }
    _refreshLibraryTooltipIfShown(layer);
  });
  autoBtn.addEventListener('click', function() {
    tpl.value = _libraryDefaultTtTemplate(layer);
    layer.ttTemplate = tpl.value;
    _refreshLibraryTooltipIfShown(layer);
  });
  tpl.addEventListener('input', function() { layer.ttTemplate = tpl.value; _refreshLibraryTooltipIfShown(layer); });
  document.getElementById('lib-ttbg-' + px + layer.id).addEventListener('input', function() { layer.ttBg = this.value; _refreshLibraryTooltipIfShown(layer); });
  document.getElementById('lib-ttcolor-' + px + layer.id).addEventListener('input', function() { layer.ttColor = this.value; _refreshLibraryTooltipIfShown(layer); });
}
