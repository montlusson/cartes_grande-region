//  EXPORT PNG
// ══════════════════════════════════════════════════════════════════

function exportMap() {
  if (!_mapReady) return;

  var btn = document.getElementById('btn-export');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  setStatus('Export en cours…');

  // Forcer un rendu complet, puis capturer le canvas
  _map.triggerRepaint();
  _map.once('render', function() {
    try {
      var mapCanvas = _map.getCanvas();

      // Canvas de sortie : même taille que le rendu GL (déjà en pixels physiques)
      var out = document.createElement('canvas');
      out.width  = mapCanvas.width;
      out.height = mapCanvas.height;
      var ctx = out.getContext('2d');

      // 1 — Fond carte
      ctx.drawImage(mapCanvas, 0, 0);

      // 1b — Étiquettes : points + noms (placement identique à l'écran)
      var lblIds = Object.keys(_labelMarkers);
      if (lblIds.length) {
        var dprL = window.devicePixelRatio || 1;
        var lblSizeEl = document.getElementById('label-size');
        var ls = parseFloat(lblSizeEl ? lblSizeEl.value : '11.5') || 11.5;
        var dOff = 8 * dprL;
        ctx.font = '600 ' + Math.round(ls * dprL) + 'px Inter,system-ui,sans-serif';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        lblIds.forEach(function(id) {
          var m = _labelMarkers[id];
          var pt = _map.project(m.mk.getLngLat());
          var x = pt.x * dprL, y = pt.y * dprL;
          ctx.beginPath();
          ctx.arc(x, y, 3.5 * dprL, 0, Math.PI * 2);
          ctx.fillStyle = '#1d2d35'; ctx.fill();
          ctx.lineWidth = 1.5 * dprL; ctx.strokeStyle = '#fff'; ctx.stroke();
          if (!m.placement) return;          // nom masqué pour cause de chevauchement
          var tx = x, ty = y;
          if (m.placement === 'right')      { ctx.textAlign = 'left';   tx = x + dOff; }
          else if (m.placement === 'left')  { ctx.textAlign = 'right';  tx = x - dOff; }
          else if (m.placement === 'top')   { ctx.textAlign = 'center'; ty = y - dOff - ls * dprL * 0.65; }
          else                              { ctx.textAlign = 'center'; ty = y + dOff + ls * dprL * 0.65; }
          ctx.lineWidth = Math.round(3 * dprL);
          ctx.strokeStyle = 'rgba(255,255,255,.9)';
          ctx.strokeText(m.name, tx, ty);
          ctx.fillStyle = '#1a1a1a';
          ctx.fillText(m.name, tx, ty);
        });
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }

      // 2 — Légende superposée en bas à gauche
      var dpr     = window.devicePixelRatio || 1;
      var pad     = Math.round(10 * dpr);
      var swW     = Math.round(22 * dpr);
      var swH     = Math.round(10 * dpr);
      var lineH   = Math.round(18 * dpr);
      var fontSize = Math.round(11 * dpr);

      ctx.font = 'bold ' + Math.round(9 * dpr) + 'px Inter,system-ui,sans-serif';
      var legend = document.getElementById('map-legend');
      var items  = legend ? Array.from(legend.querySelectorAll('.leg-item')) : [];

      if (items.length) {
        // Mesurer la largeur max du texte
        ctx.font = fontSize + 'px Inter,system-ui,sans-serif';
        var maxTxtW = 0;
        items.forEach(function(item) {
          var lbl = item.querySelector('span:last-child');
          if (lbl) maxTxtW = Math.max(maxTxtW, ctx.measureText(lbl.textContent.trim()).width);
        });

        var boxW = pad + swW + Math.round(6 * dpr) + Math.ceil(maxTxtW) + pad;
        var boxH = pad + items.length * lineH + pad;
        var bx   = pad;
        var by   = out.height - boxH - pad;

        // Fond semi-transparent
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        var r = Math.round(5 * dpr);
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + boxW - r, by);
        ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
        ctx.lineTo(bx + boxW, by + boxH - r);
        ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
        ctx.lineTo(bx + r, by + boxH);
        ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();

        // Items
        ctx.font = fontSize + 'px Inter,system-ui,sans-serif';
        items.forEach(function(item, i) {
          var swatch = item.querySelector('.leg-swatch');
          var lbl    = item.querySelector('span:last-child');
          var iy     = by + pad + i * lineH;

          if (swatch) {
            var bg = swatch.style.background;
            if (bg.indexOf('linear-gradient') !== -1) {
              // Gradient : extraire les couleurs et dessiner manuellement
              var colMatches = bg.match(/#[0-9a-fA-F]{3,6}/g) || [];
              if (colMatches.length >= 2) {
                var grad = ctx.createLinearGradient(bx + pad, 0, bx + pad + swW, 0);
                colMatches.forEach(function(c, ci) {
                  grad.addColorStop(ci / (colMatches.length - 1), c);
                });
                ctx.fillStyle = grad;
              } else {
                ctx.fillStyle = '#aaa';
              }
            } else {
              ctx.fillStyle = bg || '#aaa';
            }
            ctx.fillRect(bx + pad, iy + Math.round((lineH - swH) / 2), swW, swH);
          }

          if (lbl) {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillText(
              lbl.textContent.trim(),
              bx + pad + swW + Math.round(6 * dpr),
              iy + Math.round((lineH + fontSize * 0.7) / 2)
            );
          }
        });
      }

      // 3 — Titre, date et crédits en haut à droite (depuis l'onglet Style)
      var meta   = _getMapMeta();
      var title  = meta.title || 'Grande Région';
      var credit = [meta.source ? 'Source : ' + meta.source : '',
                    meta.author ? 'Carte : '  + meta.author : ''].filter(Boolean).join(' · ');
      var today  = new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric'});
      var tsFont = Math.round(10 * dpr) + 'px Inter,system-ui,sans-serif';
      ctx.font = 'bold ' + tsFont;
      var tw = ctx.measureText(title).width;
      ctx.font = tsFont;
      var dw = ctx.measureText(today).width;
      var cw = credit ? ctx.measureText(credit).width : 0;
      var tpad = Math.round(8 * dpr);
      var tx = Math.round((out.width - Math.max(tw, dw, cw)) / 2);   // titre centré
      var ty = tpad;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(tx - tpad, ty, Math.max(tw, dw, cw) + tpad * 2, Math.round((credit ? 46 : 34) * dpr));
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold ' + Math.round(10 * dpr) + 'px Inter,system-ui,sans-serif';
      ctx.fillText(title, tx, ty + Math.round(13 * dpr));
      ctx.font = Math.round(9 * dpr) + 'px Inter,system-ui,sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText(today, tx, ty + Math.round(26 * dpr));
      if (credit) ctx.fillText(credit, tx, ty + Math.round(38 * dpr));

      // 4 — Téléchargement
      out.toBlob(function(blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'grande-region-' + new Date().toISOString().slice(0, 10) + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        setStatus('✓ Export PNG téléchargé.');
      }, 'image/png');

    } catch (err) {
      setStatus('✗ Export impossible : ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '&#8659; PNG'; }
    }
  });
}

// ══════════════════════════════════════════════════════════════════
