
// ══════════════════════════════════════════════════════════════════
//  CONFIGURATION — URLS & HIÉRARCHIE
// ══════════════════════════════════════════════════════════════════

// ── Publication GitHub Pages (voir js/16-publish.js) ────────────
// Jeton personnel stocké uniquement dans le localStorage de ce navigateur,
// jamais envoyé ailleurs qu'à api.github.com, jamais inclus dans un fichier
// publié (le générateur d'embed n'a aucun accès à _ghToken()).
var GH_OWNER = 'montlusson';
var GH_REPO  = 'cartes_grande-region';
var GH_BRANCH = 'main';
var GITHUB_PAGES_BASE = 'https://' + GH_OWNER + '.github.io/' + GH_REPO + '/';
var LS_TOKEN_KEY = 'grtool_gh_pat';
var MANIFEST_PATH = 'manifest.json';

var GR_URLS = {
  communes:       'https://download.data.public.lu/resources/municipalities-in-the-greater-region-2026/20260121-020153/municipalities-gr-2026.geojson',
  depts_lor:      'https://download.data.public.lu/resources/administrative-entities-2020/20200325-153614/administrative-entities-2020-1948-departements-lor-2020-5.geojson',
  cantons_lor:    'https://download.data.public.lu/resources/administrative-entities-2020/20200325-153605/administrative-entities-2020-1948-cantons-lor-2020-6.geojson',
  arr_lor:        'https://download.data.public.lu/resources/administrative-entities-2020/20200325-152205/administrative-entities-2020-1948-arrondissements-lor-2020-7.geojson',
  kreise_rlp:     'https://download.data.public.lu/resources/administrative-entities-2020/20200325-153151/administrative-entities-2020-1948-kreise-rlp-2020-4.geojson',
  vg_rlp:         'https://download.data.public.lu/resources/administrative-entities-2020/20200325-152339/administrative-entities-2020-1948-vg-vfg-vfs-gks-rlp-2020-3.geojson',
  landkreise_sar: 'https://download.data.public.lu/resources/administrative-entities-2020/20200325-153244/administrative-entities-2020-1948-landkreise-sar-2020-8.geojson',
  provinces_wal:  'https://download.data.public.lu/resources/administrative-entities-2020/20200325-152731/administrative-entities-2020-1948-provinces-wal-2020-0.geojson',
  arr_wal:        'https://download.data.public.lu/resources/administrative-entities-2020/20200325-152159/administrative-entities-2020-1948-arrondissements-wal-2020-2.geojson',
  cantons_lux:    'https://download.data.public.lu/resources/administrative-entities-2020/20200325-152605/administrative-entities-2020-1948-cantons-lux-2020-9.geojson',
};

// Ordre alphabétique des pays (Allemagne, Belgique, France, Luxembourg) —
// suivi par tous les objets ci-dessous ainsi que les listes HTML de
// territoires (puces "Blocs actifs", niveaux intermédiaires, chefs-lieux).
var BLOC_COLORS = {
  'Rheinland-Pfalz':  '#b3d4f5',
  'Saarland':         '#bfa0dd',
  'Wallonie':         '#f5baba',
  'Grand Est':        '#b5e2b5',
  'Luxembourg':       '#ffdca8',
};

var BLOC_LABELS = {
  'Rheinland-Pfalz': 'Rhénanie-Palatinat (DE)',
  'Saarland': 'Sarre (DE)',
  'Wallonie': 'Wallonie (BE)',
  'Grand Est': 'Lorraine (FR)',
  'Luxembourg': 'Luxembourg (LU)',
};

var BLOC_PAYS = {
  'Rheinland-Pfalz': 'Allemagne',
  'Saarland': 'Allemagne',
  'Wallonie': 'Belgique',
  'Grand Est': 'France',
  'Luxembourg': 'Luxembourg',
};

// Palettes (5 teintes) pour les couches de subdivision, par bloc régional —
// chaque gradient reprend la teinte de BLOC_COLORS ci-dessus.
var BLOC_SUBDIV_PALETTES = {
  'Rheinland-Pfalz': ['#90caf9','#42a5f5','#1565c0','#0d47a1','#283593'],
  'Saarland':        ['#c292f2','#8c33e6','#701cc4','#47147b','#611da5'],
  'Wallonie':        ['#f48fb1','#e91e63','#c2185b','#880e4f','#ad1457'],
  'Grand Est':       ['#a5d6a7','#66bb6a','#388e3c','#1b5e20','#558b2f'],
  'Luxembourg':      ['#ffcc80','#ffa726','#e65100','#bf360c','#ff6f00'],
};

// Département FR depuis le préfixe INSEE à 2 chiffres
var FR_DEPTS = { '54':'Meurthe-et-Moselle', '55':'Meuse', '57':'Moselle', '88':'Vosges' };

// Département FR depuis le code NUTS3 (utilisé par depts_lor, ex. 'FRF31'), pas de préfixe INSEE
var NUTS3_FR_DEPTS = { 'FRF31':'Meurthe-et-Moselle', 'FRF32':'Meuse', 'FRF33':'Moselle', 'FRF34':'Vosges' };

// Codes AGS (5 premières chiffres) → nom du Kreis/Landkreis
// Source: grandes régions DE calculées par intersection spatiale (PIP) sur communes-gr-2026
var AGS_KREISE = {
  // Saarland (DEC0x → AGS 1004x)
  '10041':'Saarbrücken', '10042':'Merzig-Wadern', '10043':'Neunkirchen',
  '10044':'Saarlouis', '10045':'Saarpfalz-Kreis', '10046':'St. Wendel',
  // Rheinland-Pfalz
  '07111':'Koblenz', '07131':'Ahrweiler', '07132':'Altenkirchen (Ww)',
  '07133':'Bad Kreuznach', '07134':'Birkenfeld', '07135':'Cochem-Zell',
  '07137':'Mayen-Koblenz', '07138':'Neuwied', '07140':'Rhein-Hunsrück-Kreis',
  '07141':'Rhein-Lahn-Kreis', '07143':'Westerwaldkreis',
  '07211':'Trier', '07231':'Bernkastel-Wittlich', '07232':'Eifelkreis Bitburg-Prüm',
  '07233':'Vulkaneifel', '07235':'Trier-Saarburg',
  '07311':'Frankenthal (Pfalz)', '07312':'Kaiserslautern', '07313':'Südliche Weinstraße',
  '07314':'Ludwigshafen a. Rh.', '07315':'Mainz', '07316':'Neustadt a.d.W.',
  '07317':'Pirmasens', '07318':'Speyer', '07319':'Worms', '07320':'Zweibrücken',
  '07331':'Alzey-Worms', '07332':'Bad Dürkheim', '07333':'Donnersbergkreis',
  '07334':'Germersheim', '07335':'Kaiserslautern', '07336':'Kusel',
  '07337':'Südliche Weinstraße', '07338':'Rhein-Pfalz-Kreis',
  '07339':'Mainz-Bingen', '07340':'Südwestpfalz'
};

// Codes NIS (préfixe 1 car) → Province wallonne
var WAL_PROV = {
  '2':'Brabant Wallon', '5':'Hainaut', '6':'Liège', '8':'Luxembourg', '9':'Namur'
};

// Codes NIS (préfixe 2 chars) → Arrondissement wallon
var WAL_ARR = {
  '25':'Nivelles',
  '51':'Ath', '52':'Charleroi', '53':'Mons', '55':'Soignies',
  '56':'Thuin', '57':'Tournai-Mouscron', '58':'La Louvière',
  '61':'Huy', '62':'Liège', '63':'Verviers', '64':'Waremme',
  '81':'Arlon', '82':'Bastogne', '83':'Marche-en-Famenne', '84':'Neufchâteau', '85':'Virton',
  '91':'Dinant', '92':'Namur', '93':'Philippeville'
};

// Codes INSEE (préfixe 3 chars) → Arrondissement lorrain
// Calculé par intersection spatiale sur les communes de la Grande Région
// LOR_ARR supprimée : préfixes INSEE non géographiques → remplacé par PIP sur arr_lor

// Région canonique déduite depuis le layer ID (fallback si prop 'region' absente)
var _LAYER_REGION = {
  'depts_lor':      'Grand Est',
  'kreise_rlp':     'Rheinland-Pfalz',
  'landkreise_sar': 'Saarland',
  'provinces_wal':  'Wallonie',
  'cantons_lux':    'Luxembourg',
  'arr_lor':        'Grand Est',
  'cantons_lor':    'Grand Est',
  'arr_wal':        'Wallonie',
  'vg_rlp':         'Rheinland-Pfalz',
};

// Sous-couches "Communes" par territoire — toutes puisent dans le même
// GeoJSON partagé (_cache['communes']), filtré par région à l'affichage
// (cf. _drawOverlay, js/05-overlays.js) pour permettre d'activer le niveau
// communal territoire par territoire plutôt qu'en bloc unique.
var COMMUNES_SUBLAYER_REGION = {
  'communes_rlp': 'Rheinland-Pfalz',
  'communes_sar': 'Saarland',
  'communes_wal': 'Wallonie',
  'communes_lor': 'Grand Est',
  'communes_lux': 'Luxembourg',
};

// Couches affichées comme "subdivisions" coloriées par palette/index
var SUBDIV_IDS = ['depts_lor','kreise_rlp','landkreise_sar','provinces_wal',
                  'arr_wal','cantons_lux','arr_lor','cantons_lor','vg_rlp'];

// Champs affichés dans l'infobulle
var _ttFields = {
  name:true, region:false, pays:false, dept:false, arrondissement:false,
  canton:false, kreis:false, province:false, vg:false, code:false, dataval:true
};

// ── Étiquettes & infobulle enrichie ────────────────────────────────
var CAPITALS = [
  { name: 'Metz',       bloc: 'Grand Est',       lng: 6.1757, lat: 49.1193 },
  { name: 'Mayence',    bloc: 'Rheinland-Pfalz', lng: 8.2473, lat: 49.9929 },
  { name: 'Sarrebruck', bloc: 'Saarland',        lng: 6.9969, lat: 49.2402 },
  { name: 'Namur',      bloc: 'Wallonie',        lng: 4.8674, lat: 50.4669 },
  { name: 'Luxembourg', bloc: 'Luxembourg',      lng: 6.1296, lat: 49.6116 },
];

var FLAG_PAYS = {
  'France':     'https://flagcdn.com/w80/fr.png',
  'Allemagne':  'https://flagcdn.com/w80/de.png',
  'Belgique':   'https://flagcdn.com/w80/be.png',
  'Luxembourg': 'https://flagcdn.com/w80/lu.png',
};
var FLAG_REGION = {
  'Rheinland-Pfalz': 'https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Rhineland-Palatinate.svg?width=120',
  'Saarland':        'https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Saarland.svg?width=120',
  'Wallonie':        'https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Wallonia.svg?width=120',
  'Grand Est':       'https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Lorraine.svg?width=120',
  'Luxembourg':      'https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Luxembourg.svg?width=120',
};

var CHEFS_LIEUX = {
  depts_lor: { label: "Préfectures — départements lorrains", bloc: "Grand Est", items: [["Bar-le-Duc",5.171,48.762],["Épinal",6.4867,48.1637],["Metz",6.1962,49.1046],["Nancy",6.1734,48.6881]] },
  arr_lor: { label: "Chefs-lieux — arrondissements lorrains", bloc: "Grand Est", items: [["Bar-le-Duc",5.171,48.762],["Briey",5.9546,49.2664],["Commercy",5.5659,48.7489],["Épinal",6.4867,48.1637],["Forbach",6.8985,49.1917],["Lunéville",6.5101,48.5961],["Metz",6.1962,49.1046],["Nancy",6.1734,48.6881],["Neufchâteau",5.7026,48.357],["Saint-Dié-des-Vosges",6.9387,48.2972],["Sarrebourg",7.0478,48.7329],["Sarreguemines",7.0714,49.106],["Thionville",6.1443,49.3718],["Toul",5.898,48.6792],["Verdun",5.3611,49.144]] },
  kreise_rlp: { label: "Chefs-lieux — Kreise (Rhénanie-Palatinat)", bloc: "Rheinland-Pfalz", items: [["Ahrweiler",7.1315,50.5296],["Altenkirchen",7.6402,50.6886],["Alzey",8.1033,49.7463],["Bad Dürkheim",8.1028,49.4518],["Bad Ems",7.7246,50.3385],["Bad Kreuznach",7.8708,49.8346],["Birkenfeld",7.1657,49.646],["Bitburg",6.5209,49.9771],["Cochem",7.1603,50.149],["Daun",6.8101,50.2031],["Frankenthal (Pfalz)",8.3657,49.5338],["Germersheim",8.3724,49.2162],["Ingelheim am Rhein",8.0672,49.9776],["Kaiserslautern",7.7487,49.4269],["Kirchheimbolanden",7.9769,49.666],["Koblenz",7.5901,50.3466],["Kusel",7.3918,49.5375],["Landau in der Pfalz",8.0225,49.2357],["Ludwigshafen am Rhein",8.3876,49.4884],["Mainz",8.2432,49.9653],["Montabaur",7.807,50.4204],["Neustadt an der Weinstraße",8.1585,49.3485],["Neuwied",7.4825,50.4602],["Pirmasens",7.5938,49.188],["Simmern",7.5331,49.9866],["Speyer",8.4336,49.3298],["Trier",6.6497,49.7784],["Wittlich",6.9072,49.9929],["Worms",8.3424,49.6616],["Zweibrücken",7.3687,49.2529]] },
  landkreise_sar: { label: "Chefs-lieux — Landkreise (Sarre)", bloc: "Saarland", items: [["Homburg",7.3388,49.3175],["Merzig",6.616,49.4512],["Neunkirchen",7.1863,49.3469],["Saarbrücken",6.9823,49.2471],["Saarlouis",6.7453,49.3112],["St. Wendel",7.1863,49.4639]] },
  provinces_wal: { label: "Chefs-lieux — provinces wallonnes", bloc: "Wallonie", items: [["Arlon",5.7946,49.6745],["Liège",5.5992,50.6246],["Mons",3.9698,50.4458],["Namur",4.8535,50.4593],["Wavre",4.5883,50.7232]] },
  arr_wal: { label: "Chefs-lieux — arrondissements wallons", bloc: "Wallonie", items: [["Arlon",5.7946,49.6745],["Ath",3.7842,50.6299],["Bastogne",5.7042,50.0131],["Charleroi",4.4277,50.4227],["Dinant",4.9512,50.2424],["Huy",5.2265,50.5034],["La Louvière",4.15,50.4792],["Liège",5.5992,50.6246],["Marche-en-Famenne",5.34,50.2182],["Mons",3.9698,50.4458],["Namur",4.8535,50.4593],["Neufchâteau",5.4222,49.8411],["Nivelles",4.3258,50.5893],["Philippeville",4.603,50.1613],["Soignies",4.0414,50.5671],["Thuin",4.3109,50.3222],["Tournai",3.4106,50.6206],["Verviers",5.8692,50.5877],["Virton",5.5725,49.5727],["Waremme",5.2637,50.6923]] },
  cantons_lux: { label: "Chefs-lieux — cantons luxembourgeois", bloc: "Luxembourg", items: [["Capellen",6.0097,49.6273],["Clervaux",6.0474,50.0677],["Diekirch",6.1491,49.8668],["Echternach",6.4186,49.8007],["Esch-sur-Alzette",5.9741,49.4898],["Grevenmacher",6.4106,49.677],["Luxembourg",6.1364,49.6079],["Mersch",6.0981,49.7422],["Redange",5.8829,49.7781],["Remich",6.3605,49.5479],["Vianden",6.1881,49.939],["Wiltz",5.929,49.9834]] }
};

var _labels = [];                 // [{id, name, lng, lat}] — étiquettes ajoutées à la main
var _labelGroups = { capitals: false };   // + un booléen par groupe de CHEFS_LIEUX
var _labelMarkers = {};           // id → { mk, name, el, placement }
var _ttLastEvt = null, _ttLastFeat = null;   // pour rafraîchir l'infobulle épinglée
var _blocTestGeoms = {};   // region → géométrie décimée du bloc (test de confinement des étiquettes)

var _ttImageMode = 'none';        // none | pays | region | custom
var _ttImageUrl = '';
var _ttHtmlMode = false;
var _ttHtmlTemplate = '';

// ══════════════════════════════════════════════════════════════════
//  ÉTAT GLOBAL
// ══════════════════════════════════════════════════════════════════

var _cache = {};         // layerId → geojson
var _lookups = {};       // layerId → {code: name}
var _strokeWidths = { blocs:1, subdiv:1.2, cantons:0.7, communes:0.3 };
var _activeLayers = {};  // layerId → true/false (overlays de contours)
var _fillLayer = 'blocs';
var _map = null;
var _mapReady = false;
var _ttPinned = false;
var _zk = 1;
var _zoomBase = null;


// ══════════════════════════════════════════════════════════════════
//  CHOROPLÈTHE — CONSTANTES & ÉTAT
// ══════════════════════════════════════════════════════════════════

// `id` = identifiant interne stable (ne pas renommer, sert de clé) ;
// `label` = nom affiché à l'utilisateur (en français).
var CHORO_PALS = [
  {id:'Blues',   label:'Bleus',              c:['#deebf7','#9ecae1','#3182bd']},
  {id:'Greens',  label:'Verts',              c:['#e5f5e0','#a1d99b','#31a354']},
  {id:'Reds',    label:'Rouges',             c:['#fee0d2','#fc9272','#de2d26']},
  {id:'Oranges', label:'Oranges',            c:['#fee6ce','#fdae6b','#e6550d']},
  {id:'Purples', label:'Violets',            c:['#efedf5','#bcbddc','#756bb1']},
  {id:'YlOrRd',  label:'Jaune-Orange-Rouge', c:['#ffeda0','#feb24c','#f03b20']},
  {id:'YlGnBu',  label:'Jaune-Vert-Bleu',    c:['#edf8b1','#7fcdbb','#2c7fb8']},
  {id:'RdYlGn',  label:'Rouge-Jaune-Vert',   c:['#d73027','#ffffbf','#1a9850']},
  {id:'BuPu',    label:'Bleu-Violet',        c:['#e0ecf4','#9ebcda','#8856a7']},
  {id:'RdPu',    label:'Rouge-Rose',         c:['#feebe2','#f768a1','#7a0177']},
  // Déclinaisons des couleurs officielles Reporter (dégradé clair → couleur
  // de marque exacte comme teinte la plus foncée, même principe que les
  // palettes ci-dessus).
  {id:'ReporterBleu',   label:'Bleu Reporter',   c:['#d7dce8','#9eaac7','#5e71a1']},
  {id:'ReporterOrange', label:'Orange Reporter', c:['#fee2bf','#fcba66','#fa8c00']},
  {id:'ReporterJaune',  label:'Jaune Reporter',  c:['#fff8c0','#ffee68','#ffe303']},
  {id:'ReporterNoir',   label:'Noir Reporter',   c:['#bfbfbf','#666666','#000000']},
];

var _csvData      = null;  // {rows, cols}
var _joinCol      = '';
var _valueCol     = '';
var _choroPalette = 'Blues';
var _choroSteps   = 5;
var _dataMap      = {};    // normalizedKey → valeur brute
var _rowMap       = {};    // normalizedKey → ligne CSV complète
var _choroBreaks  = [];    // seuils quantiles (N-1 valeurs pour N classes)
var _choroColors  = [];    // hex par classe, de la plus basse à la plus haute
var _catMode      = false; // colonne de valeurs non numérique → couleurs par catégorie
var _catColors    = {};    // catégorie (texte brut, trim) → hex
var _catOverrides = {};    // catégorie → hex choisi par l'utilisateur (prioritaire)
var _autoJoinBusy = false; // garde du chargement automatique de la couche communes
var _strokeOverride = '';  // couleur des délimitations choisie ('' = automatique)

// Couleurs conventionnelles des partis de la Grande Région (clé = _normStr du nom)
var PARTY_COLORS = {
  // France
  rassemblementnational:  '#11305e',
  larepubliqueenmarche:   '#ffb400',
  lesrepublicains:        '#0066cc',
  partisocialiste:        '#e75480',
  lafranceinsoumise:      '#b71c3a',
  europeecologielesverts: '#00a95c',
  deboutlafrance:         '#5b7a9d',
  // Belgique
  ps:    '#e2001a',
  mr:    '#2a6fdb',
  ecolo: '#6ab023',
  cdh:   '#f08000',
  // Luxembourg
  csv:      '#f6a800',
  dp:       '#3bb7e6',
  lsap:     '#d52b1e',
  deigreng: '#46962b',
  adr:      '#00689d',
  // Allemagne
  cdu:   '#161616',
  spd:   '#e3000f',
  grune: '#3f9c35',
  afd:   '#009ee0',
  fdp:   '#ffed00',
  dielinke: '#be3075',
  linke:    '#be3075',
  freiewahler: '#f59b00',
  // Groupes au Parlement européen (libellés FR et DE)
  ppe: '#3399ff', evp: '#3399ff',
  sd:  '#f0001c',
  reneweurope: '#ffd700',
  lesvertsale: '#57b45f', grunefea: '#57b45f',
  identiteetdemocratie: '#2b3856', identitatunddemokratie: '#2b3856',
  cre: '#1e5f9e', ekr: '#1e5f9e',
  guengl: '#b71c1c',
  // Lectures simplifiées (colonnes « Légende »)
  centredroite: '#3399ff', mitterechts: '#3399ff',
  centregauche: '#f0001c', mittelinks:  '#f0001c',
  liberaux:     '#ffd700', liberal:     '#ffd700',
  ecologistes:  '#57b45f', grun:        '#57b45f',
  extremedroite:'#2b3856', rechtsauen:  '#2b3856',
  extremegauche:'#b71c1c', linksauen:   '#b71c1c',
  conservateurseurosceptiques: '#1e5f9e', euroskeptischekonservative: '#1e5f9e',
};
// Palette de repli pour les catégories sans couleur attitrée (Tableau 10)
var CAT_FALLBACK = ['#4e79a7','#f28e2b','#e15759','#76b7b4','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac'];

// ══════════════════════════════════════════════════════════════════
