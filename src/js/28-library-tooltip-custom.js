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
// n'existe pas toujours (ex. jeux de données GIS-GR/Géoportail en majuscules,
// ou trilingues avec fr_name/de_name/en_name au lieu d'une seule clé "name")
// — repli sur les variantes courantes (le français d'abord), puis sur la
// première propriété textuelle non vide plutôt que de n'afficher aucun titre.
var _TITLE_KEY_GUESSES = [
  'name', 'NAME', 'Name', 'nom', 'NOM', 'Nom',
  'fr_name', 'fr_nom', 'name_fr', 'nom_fr', 'de_name', 'en_name',
  'title', 'TITLE', 'Title', 'label', 'LABEL', 'libelle', 'LIBELLE'
];
// Jamais un bon titre pour UNE feature — un classificateur de territoire,
// pas un nom propre (ex. "Region": "Saarland" sur un site touristique
// devenait le titre affiché faute de mieux, avant cette exclusion).
var _TITLE_FALLBACK_EXCLUDE_RE = /^(region|r.gion|pays|land|country|territoire|bloc)$/i;
function _guessFeatureTitle(props) {
  for (var i = 0; i < _TITLE_KEY_GUESSES.length; i++) {
    var v = props[_TITLE_KEY_GUESSES[i]];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  var keys = Object.keys(props);
  for (var j = 0; j < keys.length; j++) {
    var v2 = props[keys[j]];
    if (typeof v2 === 'string' && v2.trim() && !_LIB_FIELD_EXCLUDE_RE.test(keys[j]) && !_TITLE_FALLBACK_EXCLUDE_RE.test(keys[j])) return v2;
  }
  return '';
}

// Regroupe les variantes linguistiques d'un même champ (préfixe/suffixe
// fr_/de_/en_, courant dans les exports GIS-GR/Géoportail trilingues) et ne
// garde que la meilleure (français si présent, sinon anglais, sinon
// allemand) — sans ça, les 6 premiers champs pris pour le modèle auto
// (triés alphabétiquement) tombaient souvent tout en allemand ("de_" avant
// "fr_"), la version française existant pourtant sur la même feature.
var _LANG_PREFIX_RE = /^(fr|de|en)[_-](.+)$/i;
var _LANG_SUFFIX_RE = /^(.+)[_-](fr|de|en)$/i;
var _LANG_RANK = {fr:0, en:1, de:2};
function _selectDisplayFields(fields) {
  var groups = {}, order = [];
  fields.forEach(function(f) {
    if (_LIB_FIELD_EXCLUDE_RE.test(f) || _TITLE_FALLBACK_EXCLUDE_RE.test(f)) return;
    var mp = _LANG_PREFIX_RE.exec(f), ms = !mp && _LANG_SUFFIX_RE.exec(f);
    var base = mp ? mp[2].toLowerCase() : ms ? ms[1].toLowerCase() : f.toLowerCase();
    var lang = mp ? mp[1].toLowerCase() : ms ? ms[2].toLowerCase() : null;
    if (!groups[base]) { groups[base] = {field:f, rank: lang ? _LANG_RANK[lang] : -1}; order.push(base); }
    else if (lang && _LANG_RANK[lang] < groups[base].rank) { groups[base].field = f; groups[base].rank = _LANG_RANK[lang]; }
  });
  return order.map(function(b) { return groups[b].field; });
}

function _libraryDefaultTtTemplate(layer) {
  var fields = _detectAllFields(layer.geojson);
  var lines = ['<div class="tt-chip-row"><span class="tt-bloc-chip" style="background:{{layerColor}};color:#1a1a1a">{{layerName}}</span></div>'];
  var titleField = _TITLE_KEY_GUESSES.find(function(k) { return fields.indexOf(k) !== -1; });
  if (titleField) lines.push('<div class="tt-name">{{' + titleField + '}}</div>');
  _selectDisplayFields(fields).slice(0, 6).forEach(function(f) {
    if (f === titleField) return;
    // Le préfixe/suffixe de langue n'a plus lieu d'être DANS LE LIBELLÉ une
    // fois qu'on a déjà choisi la variante française (_selectDisplayFields
    // ci-dessus) — "Fr category" serait aussi peu naturel que ce qu'on
    // corrige. Uniquement ici : le sélecteur de champ choroplèthe (js/10)
    // doit lui garder le nom exact, deux champs distincts (fr_/de_) pouvant
    // y coexister sans avoir été dédoublonnés.
    var label = _prettyFieldLabel(f.replace(_LANG_PREFIX_RE, '$2').replace(_LANG_SUFFIX_RE, '$1'));
    lines.push('<div class="tt-row"><span class="tt-row-label">' + _escHtml(label) + '</span><span class="tt-row-val">{{' + f + '}}</span></div>');
  });
  return lines.join('\n');
}

// Contexte d'un modèle Bibliothèque (réel ou aperçu) : les propriétés
// brutes de la feature, plus layerName/layerColor — ET les mêmes alias
// chipColor/chipLabel/name que le modèle GLOBAL (js/09 _ttContext), pour
// qu'un modèle copié depuis l'onglet Style > Infobulle fonctionne tel quel
// ici (et inversement) sans que l'auteur réapprenne un autre vocabulaire de
// variables selon l'endroit où il colle son HTML.
function _libraryTplContext(layer, props) {
  var ctx = Object.assign({}, props, { layerName: layer.name, layerColor: layer.color });
  ctx.chipLabel = layer.name;
  ctx.chipColor = layer.color;
  if (ctx.name === undefined) ctx.name = _guessFeatureTitle(props) || layer.name;
  return ctx;
}

// Contexte d'aperçu (js/29) : la première entité réelle de la couche — un
// exemple générique n'aurait aucun sens ici, le schéma de champs étant
// propre à chaque jeu de données importé.
function _libraryPreviewContext(layer) {
  var rawProps = ((layer.geojson.features || [])[0] || {}).properties || {};
  var props = {};
  Object.keys(rawProps).forEach(function(k) {
    props[k] = (rawProps[k] !== null && rawProps[k] !== undefined) ? String(rawProps[k]) : '';
  });
  return _libraryTplContext(layer, props);
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
  autoBtn.title = 'Repartir de l\'affichage actuel (nom de couche + premiers champs)';
  autoBtn.textContent = '↺ Partir de l\'affichage actuel';
  tplRow.appendChild(autoBtn);
  detail.appendChild(tplRow);

  // Barre d'outils + aperçu en direct (js/29) — l'aperçu utilise la première
  // entité réelle de la couche importée, plus parlant qu'un exemple générique
  // vu que le schéma de champs est propre à chaque jeu de données.
  var tpl = document.createElement('textarea');
  tpl.id = 'lib-tttpl-' + px + layer.id;
  tpl.rows = 5;
  tpl.style.cssText = 'width:100%;font-family:monospace;font-size:10.5px';
  tpl.value = layer.ttTemplate || '';
  detail.appendChild(_buildTtToolbar(tpl, function() { _syncLibTpl(); }));
  detail.appendChild(tpl);
  var preview = _buildTtPreview(function() { return tpl.value; }, function() { return _libraryPreviewContext(layer); });
  detail.appendChild(preview);
  function _syncLibTpl() {
    layer.ttTemplate = tpl.value;
    preview.refresh();
    _refreshLibraryTooltipIfShown(layer);
  }

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
      _ttInsertAtCursor(tpl, '{{' + f + '}}', '', '');
      _syncLibTpl();
    });
    chipsWrap.appendChild(chip);
  });
  detail.appendChild(chipsWrap);

  wrap.appendChild(detail);
  list.appendChild(wrap);

  toggleLbl.querySelector('input').addEventListener('change', function() {
    layer.ttCustom = this.checked;
    detail.style.display = this.checked ? 'block' : 'none';
    // Le modèle reste vide tant que l'auteur n'a pas cliqué "Partir de
    // l'affichage actuel" ou utilisé la barre d'outils/les variables —
    // plus de mur de HTML imposé au premier clic sur la case à cocher.
    preview.refresh();
    _refreshLibraryTooltipIfShown(layer);
  });
  autoBtn.addEventListener('click', function() {
    tpl.value = _libraryDefaultTtTemplate(layer);
    _syncLibTpl();
  });
  tpl.addEventListener('input', _syncLibTpl);
  preview.refresh();
  document.getElementById('lib-ttbg-' + px + layer.id).addEventListener('input', function() { layer.ttBg = this.value; _refreshLibraryTooltipIfShown(layer); });
  document.getElementById('lib-ttcolor-' + px + layer.id).addEventListener('input', function() { layer.ttColor = this.value; _refreshLibraryTooltipIfShown(layer); });
}
