//  EVENT WIRING
// ══════════════════════════════════════════════════════════════════

function wireEvents() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
      document.querySelectorAll('.tab-pane').forEach(function(p){p.classList.remove('active');});
      btn.classList.add('active');
      document.getElementById('tab-'+tab).classList.add('active');
    });
  });

  // Champs Titre/Chapô/Auteur/Source → cartouche sur la carte + exports
  ['map-title', 'map-chapo', 'map-author', 'map-source'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', _updateMapMeta);
  });

  // Tableau de données accessible
  var btnTable = document.getElementById('btn-table');
  if (btnTable) btnTable.addEventListener('click', _openTableModal);
  var tblClose = document.getElementById('table-modal-close');
  if (tblClose) tblClose.addEventListener('click', function() {
    document.getElementById('table-modal').classList.add('hidden');
  });
  var tblModal = document.getElementById('table-modal');
  if (tblModal) tblModal.addEventListener('click', function(e) {
    if (e.target === tblModal) tblModal.classList.add('hidden');
  });
  var btnTableCsv = document.getElementById('btn-table-csv');
  if (btnTableCsv) btnTableCsv.addEventListener('click', _exportTableCSV);

  // Étiquettes — noms sur la carte
  var chkCap = document.getElementById('lbl-capitals');
  if (chkCap) chkCap.addEventListener('change', function() {
    _labelGroups.capitals = this.checked;
    _renderLabels();
  });
  Object.keys(CHEFS_LIEUX).forEach(function(gid) {
    var chk = document.getElementById('grp-' + gid);
    if (chk) chk.addEventListener('change', function() {
      _labelGroups[gid] = this.checked;
      _renderLabels();
    });
  });
  var btnAddLbl = document.getElementById('btn-add-label');
  if (btnAddLbl) btnAddLbl.addEventListener('click', _addLabelFromInput);
  var lblInput = document.getElementById('label-search');
  if (lblInput) lblInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') _addLabelFromInput(); });
  var lblSize = document.getElementById('label-size');
  if (lblSize) lblSize.addEventListener('input', function() {
    var v = document.getElementById('label-size-v');
    if (v) v.textContent = this.value;
    document.getElementById('map-frame').style.setProperty('--label-size', this.value + 'px');
    _updateLabelPlacements();
  });

  // Infobulle : image + modèle HTML
  var ttImgMode = document.getElementById('tt-img-mode');
  if (ttImgMode) ttImgMode.addEventListener('change', function() {
    _ttImageMode = this.value;
    var w = document.getElementById('tt-img-url-wrap');
    if (w) w.style.display = this.value === 'custom' ? 'block' : 'none';
    _refreshTooltip();
  });
  var ttImgUrl = document.getElementById('tt-img-url');
  if (ttImgUrl) ttImgUrl.addEventListener('input', function() { _ttImageUrl = this.value; _refreshTooltip(); });
  var ttHtmlChk = document.getElementById('tt-html-mode');
  if (ttHtmlChk) ttHtmlChk.addEventListener('change', function() {
    _ttHtmlMode = this.checked;
    var w = document.getElementById('tt-html-wrap');
    if (w) w.style.display = this.checked ? 'block' : 'none';
    if (this.checked) {
      var tpl = document.getElementById('tt-html-tpl');
      if (tpl && !tpl.value.trim()) {
        tpl.value = _generateDefaultTpl();
        _ttHtmlTemplate = tpl.value;
      }
    }
    _refreshTooltip();
  });
  var ttHtmlTpl = document.getElementById('tt-html-tpl');
  if (ttHtmlTpl) ttHtmlTpl.addEventListener('input', function() { _ttHtmlTemplate = this.value; _refreshTooltip(); });
  var btnTplAuto = document.getElementById('btn-tt-tpl-auto');
  if (btnTplAuto) btnTplAuto.addEventListener('click', function() {
    var tpl = document.getElementById('tt-html-tpl');
    if (!tpl) return;
    tpl.value = _generateDefaultTpl();
    _ttHtmlTemplate = tpl.value;
    _refreshTooltip();
  });
  document.addEventListener('click', function(e) {
    var chip = e.target && e.target.closest ? e.target.closest('.tt-var-chip') : null;
    if (!chip || !chip.dataset || !chip.dataset.var) return;
    var tpl = document.getElementById('tt-html-tpl');
    if (!tpl) return;
    var insert = '{{' + chip.dataset.var + '}}';
    var s = tpl.selectionStart, end = tpl.selectionEnd;
    tpl.value = tpl.value.substring(0, s) + insert + tpl.value.substring(end);
    tpl.selectionStart = tpl.selectionEnd = s + insert.length;
    tpl.focus();
    _ttHtmlTemplate = tpl.value;
    _refreshTooltip();
  });

  // Échap ferme les modals
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      ['embed-modal', 'table-modal'].forEach(function(mid) {
        var m = document.getElementById(mid);
        if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
      });
    }
  });

  // Sélecteur de couche de fond
  var fillSel = document.getElementById('fill-layer-sel');
  if (fillSel) {
    fillSel.addEventListener('change', function() {
      _fillLayer = this.value;
      if (!_cache[_fillLayer] && _fillLayer !== 'blocs' && _fillLayer !== 'none') {
        showLoading('Chargement de ' + _fillLayer + '…', '');
        _ensureLayer(_fillLayer).then(function() {
          hideLoading();
          _redrawFill();
          _updateLegend();
        }).catch(function(e) { hideLoading(); setStatus('Erreur: ' + e); });
      } else {
        _redrawFill();
        _updateLegend();
      }
    });
  }

  // Curseurs d'épaisseur de trait
  ['blocs', 'subdiv', 'cantons', 'communes'].forEach(function(group) {
    var el = document.getElementById('sw-' + group);
    if (!el) return;
    el.addEventListener('input', function() {
      _strokeWidths[group] = parseFloat(this.value);
      var lbl = document.getElementById('sw-' + group + '-v');
      if (lbl) lbl.textContent = this.value;
      _applyStrokeWidthGroup(group);
    });
  });

  // Repliables (toggle-X ↔ body-X)
  ['toggle-overlays', 'toggle-chefslieux', 'toggle-st-colors', 'toggle-st-strokes',
   'toggle-st-choro', 'toggle-st-labels', 'toggle-st-tooltip'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function() {
      this.classList.toggle('collapsed');
      var body = document.getElementById(id.replace('toggle-', 'body-'));
      if (body) body.classList.toggle('collapsed');
    });
  });

  // Cases à cocher des contours (overlays)
  document.querySelectorAll('input[id^="chk-"]').forEach(function(chk) {
    var id = chk.id.replace('chk-', '');
    chk.addEventListener('change', function() {
      _activeLayers[id] = this.checked;
      if (!_mapReady) return;
      if (this.checked) {
        _redrawOverlay(id);
      } else {
        _removeOverlay(id);
      }
    });
  });

  // CSV / choroplèthe
  _buildChoroUI();

  var btnLoadCsv = document.getElementById('btn-load-csv');
  if (btnLoadCsv) btnLoadCsv.addEventListener('click', loadCSV);

  var btnSample = document.getElementById('btn-sample-gr');
  if (btnSample) btnSample.addEventListener('click', function() {
    var sample = 'region,valeur\nGrand Est,42\nWallonie,38\nLuxembourg,75\nSaarland,33\nRheinland-Pfalz,41';
    document.getElementById('csv-input').value = sample;
    loadCSV();
    var jt = document.getElementById('join-type');
    if (jt) jt.value = 'region';
  });

  var btnClear = document.getElementById('btn-clear-csv');
  if (btnClear) btnClear.addEventListener('click', function() {
    _csvData = null; _dataMap = {}; _rowMap = {}; _choroBreaks = []; _choroColors = []; _catMode = false; _catColors = {}; _catOverrides = {};
    _renderCatColorUI();
    _updateTtVarChips();
    document.getElementById('csv-input').value = '';
    document.getElementById('csv-preview-wrap').style.display = 'none';
    _updateDataBadge();
    document.getElementById('btn-apply-data').disabled = true;
    _redrawFill(); _updateLegend(); _refreshAllOverlays();
  });

  var joinColSel  = document.getElementById('join-col');
  if (joinColSel)  joinColSel.addEventListener('change',  function() { _joinCol  = this.value; if (_csvData && _joinCol && _valueCol) applyData(); });
  var valueColSel = document.getElementById('value-col');
  if (valueColSel) valueColSel.addEventListener('change', function() { _valueCol = this.value; if (_csvData && _joinCol && _valueCol) applyData(); });
  var joinTypeSel = document.getElementById('join-type');
  if (joinTypeSel) joinTypeSel.addEventListener('change', function() { if (_csvData && _joinCol && _valueCol) applyData(); });

  var btnApply = document.getElementById('btn-apply-data');
  if (btnApply) btnApply.addEventListener('click', applyData);

  var btnCatReset = document.getElementById('btn-cat-reset');
  if (btnCatReset) btnCatReset.addEventListener('click', function() {
    _catOverrides = {};
    if (_csvData && _valueCol) applyData();
  });

  // Couleur des délimitations ('' / « auto » = automatique)
  var stC = document.getElementById('stroke-color');
  var stH = document.getElementById('stroke-color-hex');
  var stA = document.getElementById('stroke-color-auto');
  function _setStrokeOverride(v) {
    _strokeOverride = v;
    if (stC && v) stC.value = v;
    if (stH) stH.value = v || 'auto';
    _applyStrokeColors();
  }
  if (stC) stC.addEventListener('input', function() { _setStrokeOverride(this.value); });
  if (stH) stH.addEventListener('change', function() {
    var v = String(this.value).trim().toLowerCase();
    if (v === '' || v === 'auto') { _setStrokeOverride(''); return; }
    v = v.replace(/^#/, '');
    if (/^[0-9a-f]{3}$/.test(v)) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    if (/^[0-9a-f]{6}$/.test(v)) _setStrokeOverride('#' + v);
    else this.value = _strokeOverride || 'auto';
  });
  if (stA) stA.addEventListener('click', function() { _setStrokeOverride(''); });

  // Classes quantiles
  document.querySelectorAll('[data-steps]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _choroSteps = parseInt(btn.dataset.steps, 10);
      document.querySelectorAll('[data-steps]').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      if (_csvData && _valueCol) { _buildChoroScale(); applyData(); }
    });
  });

  // Export
  var exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.addEventListener('click', exportMap);

  // ── Bouton Embed ──────────────────────────────────────────────
  var embedBtn = document.getElementById('btn-embed');
  if (embedBtn) embedBtn.addEventListener('click', _openEmbedModal);

  // Fermeture modal
  var modalClose = document.getElementById('embed-modal-close');
  if (modalClose) modalClose.addEventListener('click', function() {
    document.getElementById('embed-modal').classList.add('hidden');
  });
  var modal = document.getElementById('embed-modal');
  if (modal) modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // URL + dimensions → regénère le code iframe
  ['embed-url','embed-w','embed-h'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', _updateEmbedCode);
  });


  
// ── Sélecteur de blocs ───────────────────────────────────────────
  document.querySelectorAll('.bloc-chip').forEach(function(btn) {
    btn.addEventListener('click', function() { _toggleBloc(btn.dataset.bloc); });
  });

  // ── Bibliothèque de couches GeoJSON ─────────────────────────────
  _wireLibUpload();

  // Copier le code
  var copyBtn = document.getElementById('btn-copy-embed');
  if (copyBtn) copyBtn.addEventListener('click', function() {
    var ta = document.getElementById('embed-code');
    if (!ta || !ta.value) return;
    navigator.clipboard ? navigator.clipboard.writeText(ta.value).then(function() {
      copyBtn.textContent = '✓ Copié !';
      setTimeout(function() { copyBtn.textContent = 'Copier le code'; }, 2000);
    }) : (ta.select(), document.execCommand('copy'));
  });

  // Télécharger le fichier HTML embed
  var dlBtn = document.getElementById('btn-dl-embed');
  if (dlBtn) dlBtn.addEventListener('click', function() {
    if (!_embedPayload) return;
    var html = _generateEmbedHTML(_embedPayload);
    var blob = new Blob([html], {type: 'text/html;charset=utf-8'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = _embedFilename || 'grande-region-embed.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    setStatus('✓ Fichier embed téléchargé : ' + a.download);
  });

  // Publication GitHub (js/16-publish.js)
  if (typeof _wirePublishUI === 'function') _wirePublishUI();
}

// ══════════════════════════════════════════════════════════════════
