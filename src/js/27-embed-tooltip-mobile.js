//  EMBED — INFOBULLE TACTILE (tap = épingler) + FICHE PLEIN ÉCRAN MOBILE
//  Complète PLAYER_SCRIPT (js/14-export-embed-template.js) depuis
//  l'EXTÉRIEUR de son IIFE, via window.__tt qu'elle expose — un survol
//  ("mousemove") seul ne donne jamais accès à l'infobulle sur tactile (pas
//  de hover persistant au doigt) ; il faut un tap qui l'épingle, comme
//  l'éditeur (_wireTooltipEvents, js/06-choropleth-scale.js).
// ══════════════════════════════════════════════════════════════════

var EMBED_TT_MOBILE_JS = [
'(function(){',
'  function ready(){',
'    var T = window.__tt;',
'    if (!T) { setTimeout(ready, 50); return; }', // PLAYER_SCRIPT expose __tt en fin d\'IIFE ; ce script peut s\'exécuter avant
'    function isMobile(){ return window.matchMedia("(pointer: coarse)").matches; }',
'    function layout(){',
'      if (isMobile()) { T.tt.classList.add("tt-sheet"); T.tt.style.left=""; T.tt.style.top=""; }',
'      else T.tt.classList.remove("tt-sheet");',
'    }',
'    T.map.on("click", function(e){',
'      var feats = T.map.queryRenderedFeatures(e.point, {layers:T.layers});',
'      if (!feats.length) { T.pinned = false; T.tt.style.display = "none"; return; }',
'      T.pinned = !T.pinned;',
'      if (T.pinned) { T.renderTT(feats[0].properties||{}, e.point.x, e.point.y); layout(); }',
'      else T.tt.style.display = "none";',
'    });',
'    window.addEventListener("resize", layout);',
'  }',
'  ready();',
'})();'
].join('\n');
