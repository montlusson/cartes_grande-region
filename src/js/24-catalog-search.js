//  BIBLIOTHÈQUE — RECHERCHE EN DIRECT DANS LES CATALOGUES (GIS-GR,
//  Géoportail Luxembourg, STATEC/LUSTAT) — comble les trous du catalogue
//  statique (js/18-library-catalog.js) en interrogeant les géocatalogues
//  GeoNetwork publics au moment de la recherche, même technique que celle
//  qui a servi à constituer ce catalogue statique (osint-toolkit).
// ══════════════════════════════════════════════════════════════════

var CATALOG_SEARCH_SOURCES = [
  { id: 'gisgr', label: 'GIS-GR (Grande Région)', searchUrl: 'https://geocatalogue.gis-gr.eu/geonetwork/srv/api/search/records/_search' },
  { id: 'geoportail', label: 'Géoportail Luxembourg', searchUrl: 'https://geocatalogue.geoportail.lu/geonetwork/srv/api/search/records/_search' }
];

// Un résultat n'est retenu que s'il expose un lien de téléchargement réel
// (WFS pour GIS-GR, OGC API-Features pour le Géoportail LU) — sinon ce
// n'est qu'une carte WMS visualisable, pas des données intégrables.
function _extractDownloadLink(sourceId, links) {
  if (sourceId === 'geoportail') {
    var ogc = links.find(function(l) { return l.protocol === 'OGC API-Features' && l.function === 'download'; });
    if (!ogc) return null;
    var base = (ogc.urlObject.default || '').replace(/\/$/, '');
    return { kind: 'ogcfeatures', url: base + '/items?f=json&limit=500' };
  }
  var wfs = links.find(function(l) { return l.protocol === 'OGC:WFS'; });
  if (!wfs) return null;
  var typeName = (wfs.nameObject || {}).default || '';
  if (!typeName) return null;
  var svcUrl = (wfs.urlObject || {}).default || '';
  return { kind: 'wfs', url: svcUrl + '?service=WFS&version=2.0.0&request=GetFeature&typeName=' + encodeURIComponent(typeName) + '&outputFormat=geojson' };
}

function _searchOneGeoCatalog(source, query) {
  var body = JSON.stringify({
    query: { bool: { must: [{ multi_match: { query: query, fields: ['resourceTitleObject.*', 'resourceAbstractObject.*'] } }] } },
    size: 30,
    _source: ['resourceTitleObject', 'link', 'changeDate']
  });
  return fetch(source.searchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
    .then(function(data) {
      var hits = (data.hits && data.hits.hits) || [];
      var out = [];
      hits.forEach(function(hit) {
        var src = hit._source || {};
        var links = src.link || [];
        var dl = _extractDownloadLink(source.id, links);
        if (!dl) return;
        var titleObj = src.resourceTitleObject || {};
        var dateMs = src.changeDate ? Date.parse(src.changeDate) : 0;
        out.push({
          source: source.id, sourceLabel: source.label,
          title: titleObj.langfre || titleObj.default || '(sans titre)',
          kind: dl.kind, url: dl.url, dateMs: isNaN(dateMs) ? 0 : dateMs
        });
      });
      return out;
    })
    .catch(function() { return []; }); // une source indisponible ne doit pas casser la recherche globale
}

// ── Open Data Luxembourg (data.public.lu, plateforme uData) ─────────
// Portail généraliste : contrairement à GIS-GR/Géoportail (uniquement des
// géodonnées), la plupart des jeux de données n'ont AUCUNE géométrie
// (CSV, PDF, XLSX…) ou sont dans un format qu'on ne sait pas rendre
// directement (KML, TIFF…). On ne retient QUE les ressources explicitement
// au format "geojson" — le seul que _addUserLayer() consomme sans
// conversion — pour que chaque résultat affiché soit réellement
// intégrable en un clic, comme demandé.
var OPENDATA_LU_SEARCH_URL = 'https://data.public.lu/api/1/datasets/';

function _searchOpenDataLu(query) {
  var url = OPENDATA_LU_SEARCH_URL + '?q=' + encodeURIComponent(query) + '&page_size=20';
  return fetch(url, { headers: { 'Accept': 'application/json' } })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
    .then(function(data) {
      var out = [];
      (data.data || []).forEach(function(ds) {
        (ds.resources || []).forEach(function(res) {
          if (res.format !== 'geojson') return;
          // "latest" = lien stable data.public.lu (survit à un déplacement du
          // fichier source), à défaut l'URL directe de la ressource.
          var link = res.latest || res.url;
          if (!link) return;
          // Certains exports ArcGIS proposent la même couche dans plusieurs
          // projections via ?outSR=... — seule 4326 (WGS84) est un GeoJSON
          // valide au sens strict ; toute autre valeur donnerait des
          // coordonnées fausses une fois affichées telles quelles.
          if (/[?&]outSR=(?!4326\b)\d+/.test(link)) return;
          var label = ds.title;
          if (res.title && res.title !== ds.title) label += ' — ' + res.title;
          // Filtre de première ligne sur le libellé (LUREF = EPSG:2169, la
          // projection officielle luxembourgeoise, pas WGS84) — la vérité
          // vient du contrôle sur les coordonnées réelles au moment de
          // l'ajout (_looksLikeWgs84, js/25-catalog-search-ui.js), qui a
          // détecté en test qu'un intitulé "(coordonnées LUREF)" n'a pas
          // toujours de trace dans l'URL elle-même.
          if (/luref|epsg:?\s?2169/i.test(label)) return;
          // Date de la RESSOURCE (le fichier lui-même), pas du jeu de
          // données parent — plus fidèle à "fichier le plus récent".
          var dateMs = Date.parse(res.last_modified || ds.last_modified || 0);
          out.push({ source: 'opendata-lu', sourceLabel: 'Open Data Luxembourg', title: label, kind: 'geojson', url: link, dateMs: isNaN(dateMs) ? 0 : dateMs });
        });
      });
      return out.slice(0, 25);
    })
    .catch(function() { return []; });
}

// Recherche géométrique combinée (GIS-GR + Géoportail LU + Open Data LU) —
// résultats directement compatibles avec _addUserLayer() comme n'importe
// quel import GeoJSON manuel, à n'importe quel niveau (points, lignes,
// polygones à n'importe quelle échelle administrative).
function _searchGeoCatalogs(query) {
  var jobs = CATALOG_SEARCH_SOURCES.map(function(s) { return _searchOneGeoCatalog(s, query); });
  jobs.push(_searchOpenDataLu(query));
  return Promise.all(jobs).then(function(lists) { return [].concat.apply([], lists); });
}

// ── STATEC / LUSTAT (Open Data statistique) ─────────────────────────
// Séries temporelles nationales (une ligne par période, pas par commune) —
// PAS directement joignables sur les limites de l'outil comme une
// choroplèthe ; proposées en consultation/téléchargement plutôt qu'en
// "+ Ajouter à la carte" pour ne pas suggérer une compatibilité qui n'existe
// pas (cf. fetch_wide_csv, osint-toolkit/tools_statec.py : pivot par période).
var STATEC_DATAFLOWS_URL = 'https://lustat.statec.lu/rest/dataflow/LU1/all/all';
var _statecCache = null;

function _loadStatecDataflows() {
  if (_statecCache) return Promise.resolve(_statecCache);
  return fetch(STATEC_DATAFLOWS_URL, { headers: { 'Accept': 'application/json', 'Accept-Language': 'fr' } })
    .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
    .then(function(data) {
      var refs = (data && data.references) || {};
      var list = [];
      Object.keys(refs).forEach(function(k) {
        var v = refs[k];
        if (v && v.id) list.push({ id: v.id, name: v.name || '', description: v.description || '' });
      });
      _statecCache = list;
      return list;
    });
}

// Pas de champ date structuré dans le catalogue STATEC — seulement du texte
// libre du genre "Date de publication : 31/08/2009 - Périodicité : ..." dans
// la description. Extraction best-effort ; 0 (donc trié en dernier) si absent.
function _parseStatecDate(description) {
  var m = /date de publication\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(description || '');
  if (!m) return 0;
  var ms = Date.parse(m[3] + '-' + m[2] + '-' + m[1]);
  return isNaN(ms) ? 0 : ms;
}

function _searchStatec(query) {
  var needle = query.trim().toLowerCase();
  if (!needle) return Promise.resolve([]);
  return _loadStatecDataflows().then(function(list) {
    return list.filter(function(d) {
      return (d.name + ' ' + d.description).toLowerCase().indexOf(needle) !== -1;
    }).slice(0, 20).map(function(d) {
      return {
        source: 'statec', sourceLabel: 'STATEC / LUSTAT',
        title: d.name, kind: 'statec', dateMs: _parseStatecDate(d.description),
        viewUrl: 'https://lustat.statec.lu/vis?lc=fr&df[ds]=release&df[id]=' + encodeURIComponent(d.id) + '&df[ag]=LU1',
        csvUrl: 'https://lustat.statec.lu/rest/data/LU1,' + encodeURIComponent(d.id) + '/all?dimensionAtObservation=AllDimensions&format=csv'
      };
    });
  }).catch(function() { return []; });
}

// ── Communes luxembourgeoises fusionnées ─────────────────────────────
// Le Luxembourg est passé de 118 communes (2006) à 100 (depuis le
// 1ᵉʳ sept. 2023) via 14 fusions successives. Des jeux de données plus
// anciens (ou jamais mis à jour) référencent encore les communes
// disparues — les repérer évite de superposer une physionomie du pays
// obsolète à la carte actuelle. Liste vérifiée (Wikipédia FR, "Histoire
// des communes luxembourgeoises", 2026-09-28) — à revérifier si de
// nouvelles fusions sont annoncées après cette date.
var LU_COMMUNE_MERGERS = [
  { old: ['Bastendorf', 'Fouhren'], into: 'Tandel', date: '2006-01-01' },
  { old: ['Kautenbach', 'Wilwerwiltz'], into: 'Kiischpelt', date: '2006-01-01' },
  { old: ['Clervaux', 'Heinerscheid', 'Munshausen'], into: 'Clervaux', date: '2012-01-01' },
  { old: ['Ermsdorf', 'Medernach'], into: "Vallée de l'Ernz", date: '2012-01-01' },
  { old: ['Esch-sur-Sûre', 'Heiderscheid', 'Neunhausen'], into: 'Esch-sur-Sûre', date: '2012-01-01' },
  { old: ['Bascharage', 'Clemency', 'Clémency'], into: 'Käerjeng', date: '2012-01-01' },
  { old: ['Consthum', 'Hoscheid', 'Hosingen'], into: 'Parc Hosingen', date: '2012-01-01' },
  { old: ['Burmerange', 'Wellenstein'], into: 'Schengen', date: '2012-01-01' }, // Schengen elle-même ne change pas de nom
  { old: ['Eschweiler', 'Wiltz-Campagne'], into: 'Wiltz', date: '2015-01-01' },
  { old: ['Hobscheid', 'Septfontaines'], into: 'Habscht', date: '2018-01-01' },
  { old: ['Boevange-sur-Attert', 'Tuntange'], into: 'Helperknapp', date: '2018-01-01' },
  { old: ['Mompach', 'Rosport'], into: 'Rosport-Mompach', date: '2018-01-01' },
  { old: ['Grosbous', 'Wahl'], into: 'Groussbus-Wal', date: '2023-09-01' },
  { old: ['Bous', 'Waldbredimus'], into: 'Bous-Waldbredimus', date: '2023-09-01' }
];

// old name (normalisé) → {into, date} — construit une fois.
var _luOldCommuneLookup = null;
function _luOldCommuneMap() {
  if (_luOldCommuneLookup) return _luOldCommuneLookup;
  _luOldCommuneLookup = {};
  LU_COMMUNE_MERGERS.forEach(function(m) {
    m.old.forEach(function(name) {
      // Une commune qui garde son nom après fusion (ex. Clervaux, Schengen,
      // Esch-sur-Sûre, Wiltz) ne doit PAS être signalée comme "disparue".
      if (_normStr(name) === _normStr(m.into)) return;
      _luOldCommuneLookup[_normStr(name)] = { into: m.into, date: m.date };
    });
  });
  return _luOldCommuneLookup;
}

// Cherche, dans les valeurs texte des propriétés GeoJSON, des noms de
// communes luxembourgeoises disparues — retourne la liste des occurrences
// trouvées (nom ancien → commune actuelle), ou [] si rien détecté.
function _findStaleLuCommunes(geojson) {
  var lookup = _luOldCommuneMap();
  var found = {};
  (geojson.features || []).forEach(function(f) {
    var props = f.properties || {};
    Object.keys(props).forEach(function(k) {
      var v = props[k];
      if (typeof v !== 'string' || !v.trim()) return;
      var hit = lookup[_normStr(v.trim())];
      if (hit) found[v.trim()] = hit.into;
    });
  });
  return Object.keys(found).map(function(old) { return { old: old, into: found[old] }; });
}
