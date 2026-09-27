//  FLUX — MODÈLE DE DONNÉES + GÉOMÉTRIE (flèches/flux, cf. Datawrapper
//  « Arrows in locator maps ») — rendu en GeoJSON statique (lon/lat), comme
//  toutes les autres couches de l'outil : pas de recalcul au zoom/pan.
// ══════════════════════════════════════════════════════════════════

var _flowArrows = [];
var FLOW_LINE_SRC   = 'flow-line-src';
var FLOW_RIBBON_SRC = 'flow-ribbon-src';
var FLOW_HEAD_SRC   = 'flow-head-src';
var FLOW_LABEL_SRC  = 'flow-label-src';

var FLOW_HEAD_STYLES = ['triangle', 'chevron', 'diamond', 'circle'];
var FLOW_WIDTH_MIN = 1.5, FLOW_WIDTH_MAX = 10; // même unité que le curseur manuel "Épaisseur" (1-10)

function _newFlowArrow(from, to) {
  var color = _nextLibColor(); _libPaletteIdx++;
  return {
    id: 'fl' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
    name: 'Flux', from: from, to: to,
    curve: 25, style: 'linear', color: color, width: 3, headStyle: 'triangle',
    value: '', // proportionnalité : si renseignée, prime sur "width" via une échelle PARTAGÉE (cf. _flowEffWidth)
    dashed: false, arrowStart: false, arrowEnd: true,
    label: '', labelPos: 'above', labelManual: null, visible: true
  };
}

function _flowNumValue(arrow) {
  if (arrow.value === '' || arrow.value === undefined || arrow.value === null) return null;
  var v = parseFloat(arrow.value);
  return isNaN(v) ? null : v;
}

// Échelle PARTAGÉE valeur→épaisseur sur tous les flux visibles porteurs
// d'une valeur — pas une normalisation isolée par flux/import : deux flux de
// même valeur (dessinés à la main ou issus d'imports CSV différents) ont
// ainsi rigoureusement la même épaisseur, comme les flèches "flux" Datawrapper.
function _flowValueScale() {
  var vals = _flowArrows.filter(function(a) { return a.visible; })
    .map(_flowNumValue).filter(function(v) { return v !== null; });
  if (!vals.length) return null;
  return { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
}

function _flowWidthFromValue(value) {
  var s = _flowValueScale();
  if (!s || s.max === s.min) return (FLOW_WIDTH_MIN + FLOW_WIDTH_MAX) / 2;
  var t = (value - s.min) / (s.max - s.min);
  return FLOW_WIDTH_MIN + t * (FLOW_WIDTH_MAX - FLOW_WIDTH_MIN);
}

// Épaisseur effective d'un flux : pilotée par la valeur si renseignée
// (proportionnalité), sinon repli sur le curseur manuel "Épaisseur".
function _flowEffWidth(arrow) {
  var v = _flowNumValue(arrow);
  return v !== null ? _flowWidthFromValue(v) : (arrow.width || 3);
}

// ── Géométrie : courbe de Bézier quadratique entre from/to ─────────
function _bezierPoint(p0, pc, p1, t) {
  var mt = 1 - t;
  return [mt*mt*p0[0] + 2*mt*t*pc[0] + t*t*p1[0], mt*mt*p0[1] + 2*mt*t*pc[1] + t*t*p1[1]];
}
function _bezierTangent(p0, pc, p1, t) {
  var mt = 1 - t;
  return [2*mt*(pc[0]-p0[0]) + 2*t*(p1[0]-pc[0]), 2*mt*(pc[1]-p0[1]) + 2*t*(p1[1]-pc[1])];
}
// Point de contrôle : décalé perpendiculairement au segment from→to, d'une
// fraction de sa longueur (curve : -100..100, glisseur du panneau).
function _flowControlPoint(arrow) {
  var p0 = arrow.from, p1 = arrow.to;
  var mx = (p0[0]+p1[0])/2, my = (p0[1]+p1[1])/2;
  var dx = p1[0]-p0[0], dy = p1[1]-p0[1];
  var frac = (arrow.curve || 0) / 100 * 0.5;
  return [mx - dy*frac, my + dx*frac];
}
function _chordLen(arrow) {
  var dx = arrow.to[0]-arrow.from[0], dy = arrow.to[1]-arrow.from[1];
  return Math.sqrt(dx*dx + dy*dy) || 0.0001;
}

var FLOW_SAMPLES = 40;

function _flowLineCoords(arrow, t0, t1) {
  var pc = _flowControlPoint(arrow), pts = [];
  for (var i = 0; i <= FLOW_SAMPLES; i++) {
    pts.push(_bezierPoint(arrow.from, pc, arrow.to, t0 + (t1 - t0) * (i / FLOW_SAMPLES)));
  }
  return pts;
}

// Demi-largeur du ruban "flux" (style effilé) : fraction de la longueur de
// la flèche (géométrie statique, pas de pixels) — factorisé pour que la tête
// de flèche (_flowHeadFeatures) parte de la même largeur réelle du trait.
function _flowRibbonHalfWidths(arrow) {
  var chord = _chordLen(arrow);
  var maxHalf = chord * (0.012 + _flowEffWidth(arrow) * 0.006);
  return { min: maxHalf * 0.15, max: maxHalf };
}

// Ruban effilé (style "flux") : fin au départ, épais à l'arrivée.
function _flowRibbonFeature(arrow) {
  var hw = _flowRibbonHalfWidths(arrow), minHalf = hw.min, maxHalf = hw.max;
  var t0 = arrow.arrowStart ? _flowHeadTrim(arrow, false) : 0;
  var t1 = arrow.arrowEnd ? 1 - _flowHeadTrim(arrow, true) : 1;
  var pc = _flowControlPoint(arrow), left = [], right = [];
  for (var i = 0; i <= FLOW_SAMPLES; i++) {
    var t = t0 + (t1 - t0) * (i / FLOW_SAMPLES);
    var p = _bezierPoint(arrow.from, pc, arrow.to, t);
    var tan = _bezierTangent(arrow.from, pc, arrow.to, t);
    var len = Math.sqrt(tan[0]*tan[0] + tan[1]*tan[1]) || 1;
    var nx = -tan[1]/len, ny = tan[0]/len;
    var half = minHalf + (maxHalf - minHalf) * t;
    left.push([p[0] + nx*half, p[1] + ny*half]);
    right.push([p[0] - nx*half, p[1] - ny*half]);
  }
  var ring = left.concat(right.reverse());
  ring.push(ring[0]);
  return { type:'Feature', properties:{id:arrow.id, color:arrow.color}, geometry:{type:'Polygon', coordinates:[ring]} };
}

// Conversion pixels → degrés (longitude locale) à un point donné, pour que
// la tête d'une flèche "linéaire" (épaisseur en pixels, paint MapLibre)
// s'aligne sur la largeur RÉELLE du trait affiché, pas sur une estimation
// indépendante — seule fonction de ce module qui dépend du zoom courant.
function _pxToDeg(lngLat, px) {
  if (!_map) return 0.01;
  var p = _map.project(lngLat);
  var p2 = _map.unproject([p.x + px, p.y]);
  return Math.abs(p2.lng - lngLat[0]) || 0.001;
}

// Demi-largeur réelle du trait à une extrémité (t=0 ou t=1) — base commune
// pour dimensionner la tête sur l'épaisseur effective, pas sur la longueur
// de la flèche : augmenter le curseur "Épaisseur" grossit aussi la pointe.
function _flowEndHalfWidth(arrow, atEnd) {
  if (arrow.style === 'flow') {
    var hw = _flowRibbonHalfWidths(arrow);
    return atEnd ? hw.max : hw.min;
  }
  var pc = _flowControlPoint(arrow);
  var pt = _bezierPoint(arrow.from, pc, arrow.to, atEnd ? 1 : 0);
  return _pxToDeg(pt, _flowEffWidth(arrow)) / 2;
}

// Dimensions de la tête à une extrémité, dérivées de l'épaisseur réelle du
// trait à cet endroit (pas de la longueur de la flèche) : augmenter le
// curseur "Épaisseur" grossit aussi la pointe, comme demandé.
function _flowHeadSize(arrow, atEnd, style) {
  var halfW = _flowEndHalfWidth(arrow, atEnd);
  var headW = halfW * 3.4;
  var headLen = headW * (style === 'diamond' ? 0.9 : style === 'circle' ? 0.55 : 1.1);
  return { headW: headW, headLen: headLen };
}

// Fraction de la courbe (en t) à retirer au tracé du corps (ligne/ruban)
// pour laisser la place à la tête — dérivée de la taille RÉELLE de la tête
// (pas d'une fraction fixe de la longueur) : sans ça, une tête proportionnée
// à une épaisseur en pixels (petite à un faible zoom) laisserait un trou
// visible avant le corps trimmé d'un pourcentage fixe de la longueur totale.
function _flowHeadTrim(arrow, atEnd) {
  var style = FLOW_HEAD_STYLES.indexOf(arrow.headStyle) !== -1 ? arrow.headStyle : 'triangle';
  var size = _flowHeadSize(arrow, atEnd, style);
  var frac = size.headLen / _chordLen(arrow);
  return Math.max(0.01, Math.min(0.35, frac));
}

// Contour (ring) de la tête selon le style choisi — tip = pointe, (ux,uy) =
// direction vers l'avant, headLen/headW = dimensions dérivées de l'épaisseur
// réelle du trait à cette extrémité (cf. _flowEndHalfWidth).
function _flowHeadRing(tip, ux, uy, headLen, headW, style) {
  var nx = -uy, ny = ux;
  function back(d, s) { return [tip[0] - ux*d + nx*s, tip[1] - uy*d + ny*s]; }
  if (style === 'diamond') {
    return [tip, back(headLen*0.85, headW/2), back(headLen*1.7, 0), back(headLen*0.85, -headW/2), tip];
  }
  if (style === 'chevron') {
    return [tip, back(headLen, headW/2), back(headLen*0.5, 0), back(headLen, -headW/2), tip];
  }
  if (style === 'circle') {
    var r = headW/2, cx = tip[0] - ux*r, cy = tip[1] - uy*r, pts = [];
    for (var i = 0; i <= 20; i++) {
      var a = i/20 * Math.PI*2;
      pts.push([cx + ux*Math.cos(a)*r + nx*Math.sin(a)*r, cy + uy*Math.cos(a)*r + ny*Math.sin(a)*r]);
    }
    return pts;
  }
  return [tip, back(headLen, headW/2), back(headLen, -headW/2), tip]; // triangle (défaut)
}

function _flowHeadFeatures(arrow) {
  var pc = _flowControlPoint(arrow);
  var style = FLOW_HEAD_STYLES.indexOf(arrow.headStyle) !== -1 ? arrow.headStyle : 'triangle';
  function headAt(t, forward, atEnd) {
    var size = _flowHeadSize(arrow, atEnd, style);
    var headW = size.headW, headLen = size.headLen;
    var tip = _bezierPoint(arrow.from, pc, arrow.to, t);
    var tan = _bezierTangent(arrow.from, pc, arrow.to, t);
    var len = Math.sqrt(tan[0]*tan[0] + tan[1]*tan[1]) || 1;
    var ux = tan[0]/len * (forward ? 1 : -1), uy = tan[1]/len * (forward ? 1 : -1);
    var ring = _flowHeadRing(tip, ux, uy, headLen, headW, style);
    return { type:'Feature', properties:{id:arrow.id, color:arrow.color}, geometry:{type:'Polygon', coordinates:[ring]} };
  }
  var feats = [];
  if (arrow.arrowEnd)   feats.push(headAt(1, true, true));
  if (arrow.arrowStart) feats.push(headAt(0, false, false));
  return feats;
}

// Position de l'étiquette relative à la flèche — au-dessus (défaut), en
// dessous, ou à côté (gauche/droite) : text-offset + text-anchor pilotés
// par flux via des expressions ['get', ...] (propriétés data-driven MapLibre).
var FLOW_LABEL_POS = {
  above: { offset:[0,-0.9], anchor:'bottom' },
  below: { offset:[0, 0.9], anchor:'top' },
  left:  { offset:[-1.3,0], anchor:'right' },
  right: { offset:[1.3, 0], anchor:'left' }
};

function _flowLabelFeature(arrow) {
  if (!arrow.label) return null;
  // Placée manuellement (glisser-déposer sur la carte) : coordonnée exacte,
  // centrée sur le point déposé — sinon position relative à la flèche
  // (préréglage au-dessus/en dessous/gauche/droite).
  if (arrow.labelManual) {
    return { type:'Feature', properties:{id:arrow.id, label:arrow.label, loffset:[0,0], lanchor:'center'},
      geometry:{type:'Point', coordinates:arrow.labelManual} };
  }
  var pc = _flowControlPoint(arrow);
  var mid = _bezierPoint(arrow.from, pc, arrow.to, 0.5);
  var pos = FLOW_LABEL_POS[arrow.labelPos] || FLOW_LABEL_POS.above;
  return { type:'Feature', properties:{id:arrow.id, label:arrow.label, loffset:pos.offset, lanchor:pos.anchor},
    geometry:{type:'Point', coordinates:mid} };
}

// ── Rendu : une source/couche partagée par style (pas une par flèche) ──
function _flowSourcesReady() { return !!(_map && _map.getSource(FLOW_LINE_SRC)); }

function _initFlowLayers() {
  if (!_map || _flowSourcesReady()) return;
  _map.addSource(FLOW_LINE_SRC,   {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  _map.addSource(FLOW_RIBBON_SRC, {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  _map.addSource(FLOW_HEAD_SRC,   {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  _map.addSource(FLOW_LABEL_SRC,  {type:'geojson', data:{type:'FeatureCollection', features:[]}});

  _map.addLayer({ id:'flow-ribbon', type:'fill', source:FLOW_RIBBON_SRC,
    paint:{ 'fill-color':['get','color'], 'fill-opacity':0.85 } });
  _map.addLayer({ id:'flow-line-solid', type:'line', source:FLOW_LINE_SRC,
    filter:['==', ['get','dashed'], false],
    paint:{ 'line-color':['get','color'], 'line-width':['get','width'], 'line-opacity':0.9 } });
  _map.addLayer({ id:'flow-line-dashed', type:'line', source:FLOW_LINE_SRC,
    filter:['==', ['get','dashed'], true],
    paint:{ 'line-color':['get','color'], 'line-width':['get','width'], 'line-opacity':0.9, 'line-dasharray':[2,1.6] } });
  _map.addLayer({ id:'flow-head', type:'fill', source:FLOW_HEAD_SRC,
    paint:{ 'fill-color':['get','color'], 'fill-opacity':0.9 } });
  _map.addLayer({ id:'flow-label', type:'symbol', source:FLOW_LABEL_SRC,
    layout:{ 'text-field':['get','label'], 'text-size':11, 'text-font':['Noto Sans Bold'],
             'text-offset':['get','loffset'], 'text-anchor':['get','lanchor'], 'text-allow-overlap':false },
    paint:{ 'text-color':'#1a1a1a', 'text-halo-color':'#fff', 'text-halo-width':1.6 } });
}

function _renderFlows() {
  if (!_map || !_mapReady) return;
  _initFlowLayers();
  var lines = [], ribbons = [], heads = [], labels = [];
  _flowArrows.forEach(function(arrow) {
    if (!arrow.visible) return;
    if (arrow.style === 'flow') {
      ribbons.push(_flowRibbonFeature(arrow));
    } else {
      var lt0 = arrow.arrowStart ? _flowHeadTrim(arrow, false) : 0;
      var lt1 = arrow.arrowEnd ? 1 - _flowHeadTrim(arrow, true) : 1;
      lines.push({ type:'Feature',
        properties:{id:arrow.id, color:arrow.color, width:_flowEffWidth(arrow), dashed:!!arrow.dashed},
        geometry:{type:'LineString', coordinates:_flowLineCoords(arrow, lt0, lt1)} });
    }
    heads = heads.concat(_flowHeadFeatures(arrow));
    var lbl = _flowLabelFeature(arrow);
    if (lbl) labels.push(lbl);
  });
  _map.getSource(FLOW_LINE_SRC).setData({type:'FeatureCollection', features:lines});
  _map.getSource(FLOW_RIBBON_SRC).setData({type:'FeatureCollection', features:ribbons});
  _map.getSource(FLOW_HEAD_SRC).setData({type:'FeatureCollection', features:heads});
  _map.getSource(FLOW_LABEL_SRC).setData({type:'FeatureCollection', features:labels});
  ['flow-ribbon','flow-line-solid','flow-line-dashed','flow-head','flow-label'].forEach(function(id) {
    if (_map.getLayer(id)) _map.moveLayer(id);
  });
}

function _addFlowArrow(from, to) {
  var arrow = _newFlowArrow(from, to);
  _flowArrows.push(arrow);
  _renderFlows();
  _renderFlowList();
  _updateFlowEmptyHint();
  _updateLegend();
  setStatus('✓ Flux ajouté.');
  return arrow;
}

function _removeFlowArrow(id) {
  _flowArrows = _flowArrows.filter(function(a) { return a.id !== id; });
  _renderFlows();
  _renderFlowList();
  _updateFlowEmptyHint();
  _updateLegend();
}

// Légende de l'échelle valeur→épaisseur (3 échantillons min/médiane/max),
// appelée depuis _updateLegend() (js/08-legend-presets.js) : un simple trait
// SVG à la largeur réelle par échantillon, comme la légende des flèches
// "flux" de Datawrapper — appendue à la légende existante, pas une 2e boîte
// séparée (bénéficie ainsi gratuitement de l'export PNG/embed déjà câblés
// sur #map-legend).
function _appendFlowLegend(container) {
  var scale = _flowValueScale();
  if (!scale) return;
  var title = document.createElement('div');
  title.style.cssText = 'font-size:9.5px;color:#888;margin-top:2px';
  title.textContent = 'Épaisseur des flux';
  container.appendChild(title);
  var samples = scale.min === scale.max ? [scale.min] : [scale.min, (scale.min + scale.max) / 2, scale.max];
  samples.forEach(function(v) {
    var w = _flowWidthFromValue(v);
    var item = document.createElement('span');
    item.className = 'leg-item';
    item.innerHTML =
      '<svg width="28" height="14" style="flex:none;overflow:visible">' +
        '<line x1="2" y1="7" x2="26" y2="7" stroke="#555" stroke-width="' + w.toFixed(1) + '" stroke-linecap="round"/>' +
      '</svg>' +
      '<span style="font-size:10px">' + _escHtml(_legendFmtNum(v)) + '</span>';
    container.appendChild(item);
  });
}
