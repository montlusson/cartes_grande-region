//  FLUX — PANNEAU (liste, contrôles par flèche, câblage des événements)
// ══════════════════════════════════════════════════════════════════

function _updateFlowEmptyHint() {
  var hint = document.getElementById('flow-empty-hint');
  if (hint) hint.style.display = _flowArrows.length ? 'none' : 'block';
}

function _renderFlowList() {
  var list = document.getElementById('flow-list');
  if (!list) return;
  list.innerHTML = '';
  _flowArrows.forEach(function(arrow) { _appendFlowItem(arrow, list); });
}

function _appendFlowItem(arrow, list) {
  var div = document.createElement('div');
  div.className = 'lib-item';
  div.innerHTML =
    '<input type="checkbox" class="lib-item-check" id="flow-chk-' + arrow.id + '"' + (arrow.visible ? ' checked' : '') + '>' +
    '<span class="lib-item-dot" id="flow-dot-' + arrow.id + '" style="background:' + arrow.color + ';cursor:pointer" title="Changer la couleur"></span>' +
    '<input type="color" id="flow-color-' + arrow.id + '" value="' + arrow.color + '" style="position:absolute;opacity:0;width:0;height:0">' +
    '<div style="flex:1;min-width:0">' +
      '<input type="text" id="flow-name-' + arrow.id + '" value="' + _escAttr(arrow.name) + '"' +
        ' style="width:100%;border:none;background:none;font-size:11px;font-weight:600;padding:0">' +
    '</div>' +
    '<button class="lib-del-btn" title="Supprimer" style="background:none;border:none;cursor:pointer;padding:1px 5px;color:#bbb;font-size:14px;line-height:1">✕</button>';
  list.appendChild(div);

  var ctrl = document.createElement('div');
  ctrl.className = 'lib-opa-row';
  ctrl.style.cssText = 'flex-wrap:wrap;gap:6px 8px;padding:2px 4px 10px 34px';
  ctrl.innerHTML =
    '<select id="flow-style-' + arrow.id + '" style="flex:0 0 auto;font-size:10.5px;padding:2px 4px;border:1px solid var(--border);border-radius:4px">' +
      '<option value="linear"' + (arrow.style==='linear'?' selected':'') + '>Linéaire</option>' +
      '<option value="flow"' + (arrow.style==='flow'?' selected':'') + '>Flux (épaisseur variable)</option>' +
    '</select>' +
    '<label style="font-size:9.5px;color:var(--muted);display:flex;align-items:center;gap:3px">Épaisseur' +
      '<input type="range" id="flow-width-' + arrow.id + '" min="1" max="10" step="1" value="' + arrow.width + '"' +
        (_flowNumValue(arrow) !== null ? ' disabled title="Pilotée par la valeur ci-dessous"' : '') +
        ' style="width:52px;accent-color:var(--accent)"></label>' +
    '<input type="number" id="flow-value-' + arrow.id + '" value="' + _escAttr(arrow.value) + '"' +
      ' placeholder="Valeur (proportionnel)" title="Épaisseur proportionnelle à cette valeur, à l\'échelle de tous les flux"' +
      ' style="width:110px;font-size:10.5px;padding:2px 5px;border:1px solid var(--border);border-radius:4px">' +
    '<label style="font-size:9.5px;color:var(--muted);display:flex;align-items:center;gap:3px">Courbure' +
      '<input type="range" id="flow-curve-' + arrow.id + '" min="-100" max="100" step="5" value="' + arrow.curve + '" style="width:60px;accent-color:var(--accent)"></label>' +
    '<label style="font-size:9.5px;color:var(--muted);display:flex;align-items:center;gap:3px"><input type="checkbox" id="flow-dashed-' + arrow.id + '"' + (arrow.dashed?' checked':'') + '> Pointillés</label>' +
    '<label style="font-size:9.5px;color:var(--muted);display:flex;align-items:center;gap:3px"><input type="checkbox" id="flow-astart-' + arrow.id + '"' + (arrow.arrowStart?' checked':'') + '> Pointe départ</label>' +
    '<label style="font-size:9.5px;color:var(--muted);display:flex;align-items:center;gap:3px"><input type="checkbox" id="flow-aend-' + arrow.id + '"' + (arrow.arrowEnd?' checked':'') + '> Pointe arrivée</label>' +
    '<select id="flow-headstyle-' + arrow.id + '" title="Forme de la pointe" style="flex:0 0 auto;font-size:10.5px;padding:2px 4px;border:1px solid var(--border);border-radius:4px">' +
      '<option value="triangle"' + (arrow.headStyle==='triangle'?' selected':'') + '>▲ Triangle</option>' +
      '<option value="chevron"' + (arrow.headStyle==='chevron'?' selected':'') + '>&gt; Chevron</option>' +
      '<option value="diamond"' + (arrow.headStyle==='diamond'?' selected':'') + '>◆ Losange</option>' +
      '<option value="circle"' + (arrow.headStyle==='circle'?' selected':'') + '>● Cercle</option>' +
    '</select>' +
    '<input type="text" id="flow-label-' + arrow.id + '" value="' + _escAttr(arrow.label) + '" placeholder="Étiquette (facultatif)"' +
      ' style="flex:1;min-width:120px;font-size:10.5px;padding:3px 6px;border:1px solid var(--border);border-radius:4px">' +
    '<select id="flow-labelpos-' + arrow.id + '" title="Position de l\'étiquette" style="flex:0 0 auto;font-size:10.5px;padding:2px 4px;border:1px solid var(--border);border-radius:4px">' +
      '<option value="above"' + (arrow.labelPos==='above'?' selected':'') + '>Au-dessus</option>' +
      '<option value="below"' + (arrow.labelPos==='below'?' selected':'') + '>En dessous</option>' +
      '<option value="left"' + (arrow.labelPos==='left'?' selected':'') + '>À gauche</option>' +
      '<option value="right"' + (arrow.labelPos==='right'?' selected':'') + '>À droite</option>' +
    '</select>' +
    '<button type="button" id="flow-labelreset-' + arrow.id + '" class="btn btn-secondary btn-sm"' +
      ' title="Revenir à un positionnement relatif à la flèche"' +
      (arrow.labelManual ? '' : ' style="visibility:hidden"') + '>↺ Position libre</button>';
  list.appendChild(ctrl);

  _wireFlowItemEvents(arrow, div, ctrl);
}

function _wireFlowItemEvents(arrow, div, ctrl) {
  var id = arrow.id;

  div.querySelector('input[type=checkbox]').addEventListener('change', function() {
    arrow.visible = this.checked; _renderFlows();
  });
  div.querySelector('.lib-del-btn').addEventListener('click', function() { _removeFlowArrow(id); });
  document.getElementById('flow-name-' + id).addEventListener('input', function() { arrow.name = this.value; });

  var dot = document.getElementById('flow-dot-' + id), colorInp = document.getElementById('flow-color-' + id);
  dot.addEventListener('click', function() { colorInp.click(); });
  colorInp.addEventListener('input', function() { arrow.color = this.value; dot.style.background = this.value; _renderFlows(); });

  document.getElementById('flow-style-' + id).addEventListener('change', function() { arrow.style = this.value; _renderFlows(); });
  document.getElementById('flow-headstyle-' + id).addEventListener('change', function() { arrow.headStyle = this.value; _renderFlows(); });
  document.getElementById('flow-width-' + id).addEventListener('input', function() { arrow.width = parseInt(this.value, 10); _renderFlows(); });
  // La valeur pilote une échelle PARTAGÉE entre tous les flux (cf.
  // _flowValueScale) : la changer redessine donc aussi les AUTRES flux —
  // mais surtout PAS _renderFlowList() ici (reconstruirait ce champ en plein
  // saisie et ferait perdre le focus à chaque frappe) ; seul CE curseur
  // "Épaisseur" (grisé/actif selon qu'une valeur est saisie) est mis à jour.
  document.getElementById('flow-value-' + id).addEventListener('input', function() {
    arrow.value = this.value.trim();
    document.getElementById('flow-width-' + id).disabled = _flowNumValue(arrow) !== null;
    _renderFlows(); _updateLegend();
  });
  document.getElementById('flow-labelpos-' + id).addEventListener('change', function() {
    arrow.labelPos = this.value; arrow.labelManual = null;
    document.getElementById('flow-labelreset-' + id).style.visibility = 'hidden';
    _renderFlows();
  });
  document.getElementById('flow-labelreset-' + id).addEventListener('click', function() {
    _resetFlowLabelPos(arrow);
    this.style.visibility = 'hidden';
  });
  document.getElementById('flow-curve-' + id).addEventListener('input', function() { arrow.curve = parseInt(this.value, 10); _renderFlows(); });
  document.getElementById('flow-dashed-' + id).addEventListener('change', function() { arrow.dashed = this.checked; _renderFlows(); });
  document.getElementById('flow-astart-' + id).addEventListener('change', function() { arrow.arrowStart = this.checked; _renderFlows(); });
  document.getElementById('flow-aend-' + id).addEventListener('change', function() { arrow.arrowEnd = this.checked; _renderFlows(); });
  document.getElementById('flow-label-' + id).addEventListener('input', function() { arrow.label = this.value; _renderFlows(); });
}

function _wireFlowEvents() {
  var btnDraw = document.getElementById('btn-flow-draw');
  if (btnDraw) btnDraw.addEventListener('click', function() { _setFlowDrawMode(!_flowDrawMode); });

  var btnCsv = document.getElementById('btn-flow-csv-load');
  if (btnCsv) btnCsv.addEventListener('click', _loadFlowCSV);

  // Quitter l'onglet Flux pendant un dessin en cours annule le mode dessin —
  // sinon un clic sur la carte depuis un autre onglet créerait un flux
  // fantôme sans que l'utilisateur comprenne pourquoi.
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.tab !== 'flows' && _flowDrawMode) _setFlowDrawMode(false);
    });
  });

  _wireFlowDrawClick();
  _updateFlowEmptyHint();
}
