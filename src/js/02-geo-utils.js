//  NORMALISATION RÉGION & HIÉRARCHIE
// ══════════════════════════════════════════════════════════════════

function _canonicalRegion(raw) {
  var r = raw || '';
  if (r === 'LOR' || r === 'GE')  return 'Grand Est';
  if (r === 'WAL')                return 'Wallonie';
  if (r === 'LUX')                return 'Luxembourg';
  if (r === 'RLP')                return 'Rheinland-Pfalz';
  if (r === 'SL'  || r === 'SAR') return 'Saarland';
  if (BLOC_COLORS[r]) return r;
  if (r.match(/Grand.Est|Lorraine/i))    return 'Grand Est';
  if (r.match(/Rheinland|Palatinat/i))   return 'Rheinland-Pfalz';
  if (r.match(/Saar/i))                  return 'Saarland';
  if (r.match(/Wallon/i))                return 'Wallonie';
  if (r.match(/Luxemb/i))                return 'Luxembourg';
  return r;
}

// Garde géographique simple : élimine les éventuels artefacts hors zone
function _inGRBounds(feat) {
  try {
    var geom = feat && feat.geometry;
    if (!geom || !geom.coordinates) return false;
    var lo = Infinity, hi = -Infinity, bo = Infinity, to = -Infinity;
    var polys = (geom.type === 'Polygon')      ? [geom.coordinates]  :
                (geom.type === 'MultiPolygon') ?  geom.coordinates   : null;
    if (!polys || !polys.length) return false;
    for (var pi = 0; pi < polys.length; pi++) {
      for (var ri = 0; ri < polys[pi].length; ri++) {
        var ring = polys[pi][ri];
        for (var ki = 0; ki < ring.length; ki++) {
          var lon = ring[ki][0], lat = ring[ki][1];
          if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return false;
          if (lon < lo) lo = lon; if (lon > hi) hi = lon;
          if (lat < bo) bo = lat; if (lat > to) to = lat;
        }
      }
    }
    if (!isFinite(lo)) return false;
    var cx = (lo + hi) / 2, cy = (bo + to) / 2;
    return cx >= 2 && cx <= 14 && cy >= 45 && cy <= 54;
  } catch (e) { return false; }
}

function _buildLookup(id, geo) {
  var lookup = {};
  (geo.features || []).forEach(function(f) {
    var p = f.properties || {};
    var code = p.code || p.CODE || p.objectid || '';
    var name = p.name || p.NAME || p.NOM || '';
    if (code) lookup[String(code)] = name;
  });
  _lookups[id] = lookup;
}


// Retourne properties.name du premier polygon de la couche qui contient [lng,lat]
// Utilisé pour les arrondissements lorrains (PIP géographique, sans dépendance au code NUTS)
function _pipLookup(layerId, center) {
  var geo = _cache[layerId]; if (!geo) return '';
  var feats = geo.features || [];
  for (var i = 0; i < feats.length; i++) {
    var f = feats[i];
    if (f.geometry && _pipGeom(center[0], center[1], f.geometry))
      return (f.properties || {}).name || '';
  }
  return '';
}

// Reconstitue la hiérarchie administrative d'une feature pour l'infobulle
function getHierarchy(feat) {
  var p = feat.properties || {};
  var region = _canonicalRegion(p.region);
  var code = p.code || '';
  var h = { commune: p.name, region: region, pays: BLOC_PAYS[region] || '' };

  if (region === 'Grand Est') {
    var d = code.substring(0, 2);
    h.dept = FR_DEPTS[d] || NUTS3_FR_DEPTS[code] || (d ? ('Dpt ' + d) : '');
    // Arrondissement lorrain : PIP géographique sur arr_lor (pas de préfixe INSEE)
    if (feat.geometry) h.arrondissement = _pipLookup('arr_lor', _featCenter(feat));
    if (_lookups['cantons_lor']) h.canton = _lookups['cantons_lor'][code.substring(0, 5)] || '';
  } else if (region === 'Rheinland-Pfalz' || region === 'Saarland') {
    var k5 = code.substring(0, 5);
    // AGS_KREISE : table statique préfixe AGS 5 chiffres → nom du Kreis
    h.kreis = AGS_KREISE[k5] || '';
    if (region === 'Rheinland-Pfalz' && _lookups['vg_rlp']) {
      h.vg = _lookups['vg_rlp'][code.substring(0, 8)] || '';
    }
  } else if (region === 'Wallonie') {
    // WAL_PROV / WAL_ARR : tables statiques préfixe NIS → province / arrondissement
    h.province = WAL_PROV[code.substring(0, 1)] || '';
    h.arrondissement = WAL_ARR[code.substring(0, 2)] || '';
  } else if (region === 'Luxembourg') {
    if (_lookups['cantons_lux']) h.canton = _lookups['cantons_lux'][code.substring(0, 2)] || '';
  }
  return h;
}

// ══════════════════════════════════════════════════════════════════
//  FETCH GEOJSON WITH CACHE
// ══════════════════════════════════════════════════════════════════

var _inflightLayers = {};   // id → Promise (dédoublonne les téléchargements concurrents)
function _fetchLayer(id, onProgress) {
  // Sous-couches "communes_*" (une par territoire) : alias vers le même
  // GeoJSON partagé 'communes', téléchargé et mis en cache une seule fois.
  var srcId = COMMUNES_SUBLAYER_REGION[id] ? 'communes' : id;
  if (_cache[srcId]) return Promise.resolve(_cache[srcId]);
  if (_inflightLayers[srcId]) return _inflightLayers[srcId];
  var p = new Promise(function(resolve, reject) {
    var url = GR_URLS[srcId];
    if (!url) { reject('No URL for layer: ' + id); return; }
    if (onProgress) onProgress('Chargement...', url);

    fetch(url)
      .then(function(resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var total = parseInt(resp.headers.get('Content-Length') || '0', 10);
        if (total > 1000000 && resp.body) {
          var reader = resp.body.getReader();
          var chunks = [];
          var received = 0;
          function read() {
            return reader.read().then(function(result) {
              if (result.done) {
                var blob = new Blob(chunks);
                return blob.text();
              }
              chunks.push(result.value);
              received += result.value.length;
              if (onProgress && total) onProgress(
                'Chargement ' + id + '...',
                Math.round(received / total * 100) + '% (' + Math.round(received/1024/1024*10)/10 + ' MB)'
              );
              return read();
            });
          }
          return read();
        }
        return resp.text();
      })
      .then(function(text) {
        var geo = JSON.parse(text);
        _cache[srcId] = geo;
        _buildLookup(srcId, geo);
        resolve(geo);
      })
      .catch(reject);
  });
  _inflightLayers[srcId] = p;
  p.then(function() { delete _inflightLayers[srcId]; }, function() { delete _inflightLayers[srcId]; });
  return p;
}

function _ensureLayer(id) {
  var item = document.querySelector('[data-layer="' + id + '"]');
  if (item) item.classList.add('loading');
  return _fetchLayer(id, function(msg, sub) {
    showLoading(msg, sub);
  }).finally(function() {
    if (item) item.classList.remove('loading');
    hideLoading();
  });
}

function _getAnyLoadedGeo() {
  for (var k in _cache) { if (_cache[k]) return _cache[k]; }
  return null;
}

// ══════════════════════════════════════════════════════════════════
//  FUSION LUXEMBOURG (cantons → un seul polygone, via TopoJSON)
//  En MapLibre, le rendu d'un GeoJSON ne dépend plus d'un générateur
//  de chemin sphérique ni d'un clipping par projection : les polygones
//  sont triangulés directement (earcut). Le bug de "remplissage
//  complémentaire" n'a donc plus de prise, quelle que soit l'orientation
//  des anneaux dans les données sources — confirmé visuellement (étape 1).
// ══════════════════════════════════════════════════════════════════

// Fusionne un groupe de polygones adjacents (mêmes propriétés "region")
// en une seule géométrie, via TopoJSON. Quantification (1e6, grille
// ~submétrique) indispensable : sans elle, topojson.merge() laisse des
// "coutures" internes visibles aux frontières communes — c'est ce qui
// faisait apparaître les départements/cantons/provinces au lieu du seul
// contour nationale/régional dans la vue "Blocs".
function _mergeFeaturesIntoOne(features, region) {
  if (!features || !features.length) return null;
  if (features.length === 1) {
    return {
      type: 'Feature',
      geometry: features[0].geometry,
      properties: {region: region, name: BLOC_LABELS[region] || region}
    };
  }
  try {
    var fc = {type: 'FeatureCollection', features: features};
    var topo = topojson.topology({g: fc}, 1e6);
    var merged = topojson.merge(topo, [topo.objects.g]);
    return {
      type: 'Feature',
      geometry: merged,
      properties: {region: region, name: BLOC_LABELS[region] || region}
    };
  } catch (e) {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
