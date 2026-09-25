//  BIBLIOTHÈQUE — CATALOGUE GIS-GR (jeux de données réels, WFS)
// ══════════════════════════════════════════════════════════════════
// Chaque item pointe vers un vrai service WFS du Géoportail (ws.geoportail.lu,
// CORS ouvert) — trouvé et vérifié via le catalogue GeoNetwork public
// (geocatalogue.gis-gr.eu). Cliquer "+" récupère le GeoJSON réel et l'ajoute
// comme couche via _addUserLayer(), exactement comme un import manuel.
//
// `joinable` (optionnel) : pour les jeux de données "une valeur par commune"
// dont la couverture correspond exactement à la couche "communes" déjà
// intégrée à l'outil (fond de carte propre, cohérent partout ailleurs) —
// au lieu de dessiner la géométrie du fichier récupéré (qui peut mal
// s'emboîter aux découpes fines), on route les valeurs vers le pipeline
// CSV/jointure existant (onglet Données) : mêmes limites communales que
// partout dans l'outil, et on bénéficie gratuitement des palettes, du
// nombre de classes réglable, des couleurs par catégorie et de l'export.
// Ne s'applique qu'aux jeux de données communaux à couverture unique —
// les jeux de données infrarégionaux (Kreise+provinces+cantons mélangés)
// n'ont pas d'équivalent fusionné côté outil et restent en couche directe.

var LIBRARY_CATALOG = [
  { cat: 'Démographie', items: [
    { label: 'Densité de population par commune (2024)', service: 'GR_Pop_density_WFS', layer: 'Pop_density:Pop_density_2024',
      joinable: { nameField: 'name', valueField: 'pop_density', valueLabel: 'Densité de population (hab/km²)' } },
    { label: 'Densité par entité infrarégionale (2025)', service: 'GR_Pop_density_WFS', layer: 'Pop_density:Pop_density_2025' },
    { label: 'Évolution de la population 2000–2025', service: 'GR_Population_change_WFS', layer: 'Population_change:Pop_change_2000_2025' },
    { label: 'Projection de la population 2025–2070', service: 'GR_Population_projection_WFS', layer: 'Population_projection:Projection_total_pop_2025_2070' },
    { label: 'Population en âge de travailler — projection 2025–2070', service: 'GR_Population_projection_WFS', layer: 'Population_projection:Projection_20_64_years_2025_2070' },
  ]},
  { cat: 'Mobilité', items: [
    { label: 'Bus transfrontaliers — Luxembourg ↔ Lorraine (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_bus_lines_Luxembourg_Lorraine_2026' },
    { label: 'Bus transfrontaliers — Luxembourg ↔ Rhénanie-Palatinat (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_bus_lines_Luxembourg_Rhineland_Palatinate_2026' },
    { label: 'Bus transfrontaliers — Luxembourg ↔ Sarre (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_bus_lines_Luxembourg_Saarland_2026' },
    { label: 'Bus transfrontaliers — Luxembourg ↔ Wallonie (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_bus_lines_Luxembourg_Belgium_2026' },
    { label: 'Bus transfrontaliers — Lorraine ↔ Sarre (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_bus_lines_France_Germany_2026' },
    { label: 'Bus transfrontaliers — Wallonie ↔ Lorraine (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_bus_lines_Belgium_France_2026' },
    { label: 'Bus transfrontaliers — Rhénanie-Palatinat ↔ Wallonie (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_bus_lines_Germany_Belgium_2026' },
    { label: 'Trains transfrontaliers — Luxembourg ↔ France (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_railway_Luxembourg_France_2026' },
    { label: 'Trains transfrontaliers — Luxembourg ↔ Allemagne (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_trains_Luxembourg_Germany_2026' },
    { label: 'Trains transfrontaliers — Luxembourg ↔ Belgique (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_trains_Luxembourg_Belgium_2026' },
    { label: 'Trains transfrontaliers — France ↔ Allemagne (2026)', service: 'GR_Cross_border_railway_bus_lines_WFS', layer: 'Cross_border_railway_bus_lines:Cross_border_trains_France_Germany_2026' },
    { label: 'Pistes cyclables — réseau transfrontalier (2026)', service: 'GR_Cycle_paths_WFS', layer: 'Cycle_paths:Cross_border_cycle_paths_GR_2026' },
    { label: 'Pistes cyclables — EuroVelo (2026)', service: 'GR_Cycle_paths_WFS', layer: 'Cycle_paths:EuroVelo_GR_2026' },
    { label: 'Aires de covoiturage (2026)', service: 'GR_Carpool_parkings_WFS', layer: 'Carpool_parkings:Carpool_parkings_2026' },
    { label: 'Bornes de recharge électrique (2021)', service: 'GR_Charging_stations_electric_vehicles_WFS', layer: 'Charging_stations_electric_vehicles:Charging_stations_electric_vehicles_2021' },
    { label: 'Aéroports — passagers annuels (2017)', service: 'GR_Transport_infrastructures_WFS', layer: 'Transport_infrastructures:Airport_passengers_2017' },
  ]},
  { cat: 'Marché du travail', items: [
    { label: 'Frontaliers vers le Luxembourg — total (2023)', service: 'GR_Commuter_flows_to_Luxembourg_WFS', layer: 'Commuter_flows_to_Luxembourg:Commuters_Lux_2023' },
    { label: 'Frontaliers vers le Luxembourg — depuis la Lorraine (2023)', service: 'GR_Commuter_flows_to_Luxembourg_WFS', layer: 'Commuter_flows_to_Luxembourg:Commuters_LOR_LUX_2013_2023_share' },
    { label: 'Frontaliers vers le Luxembourg — depuis la Rhénanie-Palatinat (2023)', service: 'GR_Commuter_flows_to_Luxembourg_WFS', layer: 'Commuter_flows_to_Luxembourg:Commuters_RLP_LUX_2013_2023_share' },
    { label: 'Frontaliers vers le Luxembourg — depuis la Sarre (2023)', service: 'GR_Commuter_flows_to_Luxembourg_WFS', layer: 'Commuter_flows_to_Luxembourg:Commuters_SL_LUX_2013_2023_share' },
    { label: 'Frontaliers vers le Luxembourg — depuis la Wallonie (2023)', service: 'GR_Commuter_flows_to_Luxembourg_WFS', layer: 'Commuter_flows_to_Luxembourg:Commuters_WAL_LUX_2013_2023_share' },
    { label: 'Frontaliers — France vers la Sarre (2023)', service: 'GR_Commuter_flows_France_to_Germany_WFS', layer: 'Commuter_flows_France_to_Germany:Commuters_FR_SL_2023_share' },
    { label: 'Frontaliers — France vers la Rhénanie-Palatinat (2023)', service: 'GR_Commuter_flows_France_to_Germany_WFS', layer: 'Commuter_flows_France_to_Germany:Commuters_FR_RLP_share_2023' },
    { label: 'Frontaliers — Wallonie ↔ France (2023)', service: 'GR_Commuters_between_Wallonia_and_France_WFS', layer: 'Commuters_between_Wallonia_and_France:Commuters_WAL_to_FR_2023_share' },
    { label: 'Taux de chômage par territoire (2016)', service: 'GR_Unemployment_WFS', layer: 'Unemployment:Unemployement_rate_2016' },
  ]},
  { cat: 'Environnement', items: [
    { label: 'Types de forêts — Regiowood (2021)', service: 'GR_land_cover_WFS', layer: 'land_cover:Forest_types_Regiowood_2021' },
    { label: 'Sites Natura 2000 — directive habitats (2022)', service: 'GR_Nature_protection_WFS', layer: 'Nature_protection:Habitats_directive_zones_2022' },
    { label: 'Sites Natura 2000 — directive oiseaux (2022)', service: 'GR_Nature_protection_WFS', layer: 'Nature_protection:Birds_directive_zones_2022' },
    { label: 'Réserves de biosphère (2022)', service: 'GR_Nature_protection_WFS', layer: 'Nature_protection:Biosphere_reserves_perimeter_2022' },
    { label: 'Cours d\'eau — linéaires (2019)', service: 'GR_Hydrographic_network_GeoConnectGR_WFS', layer: 'Hydrographic_network_GeoConnectGR:Linear_watercourses_2019' },
    { label: 'Cours d\'eau — plans d\'eau (2019)', service: 'GR_Hydrographic_network_GeoConnectGR_WFS', layer: 'Hydrographic_network_GeoConnectGR:Areal_watercourses_2019' },
  ]},
  { cat: 'Énergie', items: [
    { label: 'Centrales nucléaires et sites Seveso (2018)', service: 'GR_Industrial_nuclear_risks_WFS', layer: 'Industrial_nuclear_risks:Nuclear_power_plants_2018', knownDown: true },
    { label: 'Production d\'énergie solaire — niveau communal', service: 'GR_Energy_WFS', layer: 'Energy:BIPV_Potential_Municipality',
      joinable: { nameField: 'name', valueField: 'Jahresertrag_je_Gebietsfläche__MWh_km2_', valueLabel: 'Production solaire (MWh/km²/an)' } },
    { label: 'Production d\'énergie solaire — Kreise / arrondissements / cantons', service: 'GR_Energy_WFS', layer: 'Energy:BIPV_Potential_Kreise_Arrondissements_Cantons' },
  ]},
  { cat: 'Culture / Tourisme', items: [
    { label: 'Centres d\'art et lieux d\'exposition (2026)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Centre_d_Art' },
    { label: 'Cinémas (2026)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Cinema' },
    { label: 'Théâtres (2026)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Théâtre' },
    { label: 'Musées (2026)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Musee' },
    { label: 'Bibliothèques (2026)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Bibliothèque' },
    { label: 'Salles de concert (2026)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Salle_de_concert' },
    { label: 'Sites UNESCO — patrimoine mondial (2025)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:World_heritage_2025' },
    { label: 'Sites touristiques (2020)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Tourist_sites_GR_2020' },
    { label: 'Nuitées touristiques (2024)', service: 'GR_Culture_tourism_WFS', layer: 'Culture_tourism:Nights_spent_tourist_accomodations_2024_absolute' },
  ]},
  { cat: 'Sécurité', items: [
    { label: 'Sites Seveso et centrales nucléaires (2018)', service: 'GR_Industrial_nuclear_risks_WFS', layer: 'Industrial_nuclear_risks:Nuclear_power_plants_2018', knownDown: true },
    { label: 'Accidents de la route — tués / 1M hab. (2020–2024)', service: 'GR_Road_safety_WFS', layer: 'Road_safety:Road_accidents_2020_2024_deaths' },
  ]},
];

function _catalogItemUrl(item) {
  return 'https://ws.geoportail.lu/wss/service/' + item.service + '/guest'
    + '?service=WFS&version=2.0.0&request=GetFeature'
    + '&typeName=' + encodeURIComponent(item.layer)
    + '&outputFormat=geojson';
}

// Date de la dernière vérification manuelle du catalogue contre le vrai
// géocatalogue GIS-GR (recherche + liens WFS réels) — pas une vérification
// automatique : si GIS-GR publie de nouvelles éditions, redemander une
// repasse (même méthode que la constitution initiale de cette liste) mettra
// à jour les libellés/URLs le cas échéant.
var LIBRARY_CATALOG_CHECKED = '2026-09-25';

function _renderLibraryCatalog() {
  var box = document.getElementById('lib-catalog');
  if (!box) return;
  box.innerHTML = '';

  var note = document.createElement('div');
  note.style.cssText = 'font-size:9.5px;color:var(--muted);margin:-4px 0 10px';
  note.textContent = 'Catalogue vérifié le ' + LIBRARY_CATALOG_CHECKED +
    ' — demandez une repasse si vous pensez que GIS-GR a publié plus récent.';
  box.appendChild(note);

  LIBRARY_CATALOG.forEach(function(group, gi) {
    var wrap = document.createElement('div');
    wrap.className = 'terr-group';
    var hdr = document.createElement('div');
    hdr.className = 'terr-header collapsible collapsed';
    hdr.textContent = group.cat;
    wrap.appendChild(hdr);
    var body = document.createElement('div');
    body.className = 'terr-layers collapsible-body collapsed';
    hdr.addEventListener('click', function() {
      hdr.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });
    group.items.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'terr-layer-row';
      row.style.alignItems = 'center';
      var span = document.createElement('span');
      span.textContent = item.label;
      span.style.cssText = 'flex:1;padding-right:8px;line-height:1.35';
      var btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = item.joinable ? '+ Charger' : '+ Ajouter';
      btn.title = item.knownDown
        ? 'Ce service GIS-GR est temporairement en panne côté serveur — réessayez plus tard.'
        : item.joinable
          ? 'Charger ces valeurs dans l\'onglet Données (jointure sur les communes de l\'outil, pour un rendu optimal)'
          : 'Récupérer ce jeu de données réel (GIS-GR) et l\'ajouter comme couche';
      btn.addEventListener('click', function() { _onCatalogBtnClick(item, btn); });
      row.appendChild(span);
      row.appendChild(btn);
      body.appendChild(row);
    });
    wrap.appendChild(body);
    box.appendChild(wrap);
  });

  // Si une couche liée à un item du catalogue est supprimée depuis "Couches
  // contextuelles", remettre son bouton à "+ Ajouter" au lieu de rester sur
  // "✕ Retirer" pour une couche qui n'existe plus.
  _libLayerRemovedListeners.push(function(layerId) {
    LIBRARY_CATALOG.forEach(function(group) {
      group.items.forEach(function(item) {
        if (item._addedLayerId === layerId) {
          item._addedLayerId = null;
          if (item._btn) _setCatalogBtnAdded(item, false);
        }
      });
    });
  });
}

function _setCatalogBtnAdded(item, added) {
  var btn = item._btn;
  if (!btn) return;
  btn.disabled = false;
  btn.classList.toggle('btn-secondary', !added);
  if (added) {
    btn.textContent = '✕ Retirer';
    btn.title = 'Retirer cette couche de la carte';
  } else {
    btn.textContent = '+ Ajouter';
    btn.title = item.knownDown
      ? 'Ce service GIS-GR est temporairement en panne côté serveur — réessayez plus tard.'
      : 'Récupérer ce jeu de données réel (GIS-GR) et l\'ajouter comme couche';
  }
}

// Convertit une valeur brute en cellule CSV sûre (guillemets si nécessaire)
function _csvCell(v) {
  v = String(v === undefined || v === null ? '' : v);
  return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

// Jeux de données "une valeur par commune" : plutôt que de dessiner la
// géométrie récupérée, on republie les valeurs sur les communes déjà
// intégrées à l'outil via le pipeline CSV/jointure existant (cf. note en
// tête de fichier) — même mécanisme que si l'utilisateur avait collé un CSV.
function _addCatalogItemAsData(item, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  setStatus('Récupération de « ' + item.label + ' »…');
  fetch(_catalogItemUrl(item))
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function(geojson) {
      if (!geojson || !geojson.features) throw new Error('réponse inattendue du serveur');
      var nf = item.joinable.nameField, vf = item.joinable.valueField, vl = item.joinable.valueLabel || vf;
      var lines = ['nom,' + _csvCell(vl)];
      geojson.features.forEach(function(f) {
        var p = f.properties || {};
        if (p[nf] === undefined) return;
        lines.push(_csvCell(p[nf]) + ',' + _csvCell(p[vf]));
      });
      document.getElementById('csv-input').value = lines.join('\n');
      loadCSV();
      document.getElementById('join-type').value = 'name';
      _joinCol = 'nom'; _valueCol = vl;
      document.getElementById('join-col').value = 'nom';
      document.getElementById('value-col').value = vl;
      // Le niveau communal est connu d'avance (item.joinable) : on force le
      // chargement + l'affichage de "communes" AVANT la jointure, sinon
      // l'auto-détection de la meilleure couche peut se caler par coïncidence
      // sur une couche déjà chargée (arrondissements, Kreise…) dont quelques
      // noms recoupent des noms de communes, et jointer presque à vide.
      setStatus('Chargement de la couche communes pour la jointure…');
      return _ensureLayer('communes').then(function() {
        _fillLayer = 'communes';
        var fsel = document.getElementById('fill-layer-sel');
        if (fsel) fsel.value = 'communes';
        applyData();
        document.querySelector('.tab-btn[data-tab="data"]').click();
        btn.textContent = '✓ Chargé';
        setTimeout(function() { btn.textContent = '+ Charger'; btn.disabled = false; }, 1800);
      });
    })
    .catch(function(err) {
      setStatus('✗ « ' + item.label + ' » : échec du chargement (' + err.message + ')');
      btn.textContent = '✗ Échec';
      setTimeout(function() { btn.textContent = '+ Charger'; btn.disabled = false; }, 2200);
    });
}

function _onCatalogBtnClick(item, btn) {
  if (item.joinable) { _addCatalogItemAsData(item, btn); return; }
  item._btn = btn;
  if (item._addedLayerId) {
    _removeUserLayer(item._addedLayerId);
    item._addedLayerId = null;
    _setCatalogBtnAdded(item, false);
    return;
  }
  _addCatalogItem(item, btn);
}

function _addCatalogItem(item, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  setStatus('Récupération de « ' + item.label + ' »…');
  fetch(_catalogItemUrl(item))
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function(geojson) {
      if (!geojson || !geojson.features) throw new Error('réponse inattendue du serveur');
      var layer = _addUserLayer(item.label, geojson, _nextLibColor());
      _libPaletteIdx++;
      item._addedLayerId = layer.id;
      _setCatalogBtnAdded(item, true);
      // Toutes les couches Bibliothèque (pas seulement les "+ Charger"
      // joignables) sont exploitables depuis l'onglet Données — palette,
      // classes, légende, tableau — donc on y bascule aussi dans ce cas.
      document.querySelector('.tab-btn[data-tab="data"]').click();
    })
    .catch(function(err) {
      setStatus('✗ « ' + item.label + ' » : échec du chargement (' + err.message + ')' +
        (item.knownDown ? ' — service GIS-GR actuellement en panne.' : ''));
      btn.textContent = '✗ Échec';
      setTimeout(function() { _setCatalogBtnAdded(item, false); }, 2200);
    });
}
