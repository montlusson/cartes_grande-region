//  EXPORT EMBED (carte interactive standalone)
// ══════════════════════════════════════════════════════════════════

/**
 * Génère un ID unique court pour nommer le fichier embed.
 */
function _embedId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Sérialise les données nécessaires pour l'état courant de la carte.
 * Retourne { data, state, estimatedBytes }.
 */
function _serializeEmbedPayload() {
  var center = _map.getCenter();

  // ── Collections GeoJSON à embarquer ───────────────────────────
  var data = {};

  // Fond "blocs" (toujours présent) — la couleur (choroplèthe par région ou
  // défaut) doit être gravée par feature : l'embed n'a accès ni à _dataMap
  // ni à _activeBlocs, seulement à ce qui est écrit dans ce payload.
  data._blocs = _buildBlocsCollection();
  data._blocs.features.forEach(function(f) {
    var region = f.properties && f.properties.region;
    f.properties._fillColor = _blocRegionColor(region);
  });

  // Couche active au premier plan
  if (_fillLayer !== 'blocs' && _cache[_fillLayer]) {
    // On réutilise _buildActiveCollection qui bake déjà _fillColor
    data._active = _buildActiveCollection(_fillLayer);
  }

  // Overlays : on garde la géométrie + propriétés utiles au tooltip
  Object.keys(_activeLayers).forEach(function(id) {
    if (!_activeLayers[id] || id === 'blocs') return;
    if (_cache[id]) {
      data[id] = {
        type: 'FeatureCollection',
        features: (_cache[id].features || [])
          .filter(_inGRBounds)
          .map(function(f) {
            var p = f.properties || {};
            // On ne garde que les propriétés utiles (allège le payload)
            return {
              type: 'Feature',
              geometry: f.geometry,
              properties: {
                name: p.name || p.NAME || '',
                region: _canonicalRegion(p.region || p.REGION || _LAYER_REGION[id] || ''),
                code: p.code || '',
                pays: p.pays || ''
              }
            };
          })
      };
    }
  });

  // ── Légende pré-calculée ──────────────────────────────────────
  var legendEl = document.getElementById('map-legend');
  var legendItems = [];
  if (legendEl) {
    Array.from(legendEl.querySelectorAll('.leg-item')).forEach(function(item) {
      var sw  = item.querySelector('.leg-swatch');
      var lbl = item.querySelector('span:last-child');
      if (sw && lbl) legendItems.push({ bg: sw.style.background, label: lbl.textContent.trim() });
    });
  }

  // ── État courant ──────────────────────────────────────────────
  var state = {
    id:         _embedId(),
    meta:       _getMapMeta(),
    labels:     _labelItems().map(function(l) { return { name: l.name, lng: l.lng, lat: l.lat, bloc: l.bloc || null }; }),
    blocBounds: BLOC_BOUNDS,
    strokeColor: _strokeOverride || ((Object.keys(_dataMap).length && _valueCol) ? _choroStrokeColor() : null),
    labelSize:  parseFloat((document.getElementById('label-size') || { value: '11.5' }).value) || 11.5,
    blocPays:   BLOC_PAYS,
    tt: { imageMode: _ttImageMode, imageUrl: _ttImageUrl,
          htmlMode: _ttHtmlMode, htmlTpl: _ttHtmlTemplate,
          valueCol: _valueCol || '', flagsPays: FLAG_PAYS, flagsRegion: FLAG_REGION },
    center:     [center.lng, center.lat],
    zoom:       _map.getZoom(),
    bounds:     _getActiveBlocsBbox(),
    fillLayer:  _fillLayer,
    overlays:   Object.keys(_activeLayers).filter(function(id) { return _activeLayers[id]; }),
    legend:     legendItems,
    blocColors: BLOC_COLORS,
    blocLabels: BLOC_LABELS,
    strokeWidths: _strokeWidths
  };

  // Échappe "<" pour qu'aucune balise de fin de script présente dans les
  // données ne puisse casser (ni injecter dans) le HTML embed généré.
  // NB : ne jamais écrire la séquence fermante en clair ici, même en
  // commentaire — le parseur HTML terminerait ce bloc script.
  var json = JSON.stringify({data: data, state: state}).replace(/</g, '\\u003c');
  return { payload: json, id: state.id, bytes: json.length };
}

/**
 * Génère le HTML complet du fichier embed standalone.
 */
