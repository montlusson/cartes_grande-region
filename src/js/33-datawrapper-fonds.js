// ══════════════════════════════════════════════════════════════════
//  FONDS DE CARTE DATAWRAPPER — liste de téléchargement (onglet Bib.)
//  Fichiers générés par datawrapper/build_datawrapper.py ; la liste, les
//  libellés et les poids viennent de datawrapper/fonds/manifest.json pour
//  ne jamais diverger des fichiers réellement publiés.
// ══════════════════════════════════════════════════════════════════

var DW_FONDS_DIR = 'datawrapper/fonds/';

function _renderDatawrapperFonds() {
  var box = document.getElementById('dw-fonds');
  if (!box) return;
  fetch(DW_FONDS_DIR + 'manifest.json')
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(list) {
      var groups = [];
      list.forEach(function(f) {
        var g = groups.filter(function(x) { return x.name === f.group; })[0];
        if (!g) { g = { name: f.group, items: [] }; groups.push(g); }
        g.items.push(f);
      });
      groups.forEach(function(group) {
        var wrap = document.createElement('div');
        wrap.className = 'terr-group';
        var hdr = document.createElement('div');
        hdr.className = 'terr-header collapsible collapsed';
        hdr.textContent = group.name;
        var body = document.createElement('div');
        body.className = 'terr-layers collapsible-body collapsed';
        hdr.addEventListener('click', function() {
          hdr.classList.toggle('collapsed');
          body.classList.toggle('collapsed');
        });
        group.items.forEach(function(f) {
          var row = document.createElement('div');
          row.className = 'terr-layer-row';
          row.style.alignItems = 'center';
          var span = document.createElement('span');
          span.style.cssText = 'flex:1;padding-right:8px;line-height:1.35';
          span.textContent = f.label + ' — ' + f.regions + ' régions, ' + Math.round(f.bytes / 1000) + ' Ko';
          function link(file, text, title) {
            var a = document.createElement('a');
            a.className = 'btn btn-secondary btn-sm';
            a.style.cssText = 'text-decoration:none;margin-left:4px';
            a.href = DW_FONDS_DIR + file;
            a.download = file;
            a.textContent = text;
            a.title = title;
            return a;
          }
          row.appendChild(span);
          row.appendChild(link(f.file, '↓ Carte', f.file + ' — fond de carte GeoJSON à importer dans Datawrapper'));
          row.appendChild(link(f.csv, '↓ CSV', f.csv + ' — données de base (id, nom, initiales…) à coller dans l\'onglet Données'));
          body.appendChild(row);
        });
        wrap.appendChild(hdr);
        wrap.appendChild(body);
        box.appendChild(wrap);
      });
    })
    .catch(function() {
      box.textContent = 'Liste indisponible (fichiers publiés avec la carte en ligne uniquement).';
      box.style.cssText = 'font-size:10px;color:var(--muted)';
    });
}
