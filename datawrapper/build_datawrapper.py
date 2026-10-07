#!/usr/bin/env python3
"""Génère les fonds de carte TopoJSON de la Grande Région pour Datawrapper.

    python3 datawrapper/build_datawrapper.py            # tout régénérer
    python3 datawrapper/build_datawrapper.py communes_lorraine blocs

Contraintes Datawrapper respectées (https://www.datawrapper.de/academy/how-to-upload-your-own-map) :
  - TopoJSON valide, polygones uniquement, WGS-84 (EPSG:4326)
  - poids < 2 Mo (dur) et idéalement < 500 Ko (cible) — la simplification est
    réglée automatiquement au maximum de détail qui tient dans la cible
  - un identifiant unique par région (`id`), coordonnées quantifiées
    (pas de décimales microscopiques), points intérieurs `cx`/`cy` pour les étiquettes

La simplification passe par mapshaper (Visvalingam pondéré, frontières
partagées entre voisins : pas de trous ni de chevauchements créés par le
dessin) et garde chaque polygone (`keep-shapes`).
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "fonds"
CONFIG_JS = ROOT.parent / "src" / "js" / "01-config-state.js"
MAPSHAPER = os.environ.get("MAPSHAPER", "npx --yes mapshaper@0.7.80").split()

TARGET = 500_000       # recommandé par Datawrapper
SOFT_MAX = 1_000_000   # repli quand 500 Ko est impossible (milliers de communes) : chargement encore rapide
# (limite dure Datawrapper : 2 Mo — jamais approchée volontairement)
# Exception assumée : 5 034 communes dans un seul fichier ne tiennent pas en 1 Mo.
EXTRA_LIMIT = {"communes_grande-region": 1_900_000}
QUANT = 100_000        # grille de quantification TopoJSON

BLOC_LABELS = {
    "Rheinland-Pfalz": "Rhénanie-Palatinat", "Saarland": "Sarre", "Wallonie": "Wallonie",
    "Grand Est": "Lorraine", "Luxembourg": "Luxembourg",
}
BLOC_PAYS = {
    "Rheinland-Pfalz": "Allemagne", "Saarland": "Allemagne", "Wallonie": "Belgique",
    "Grand Est": "France", "Luxembourg": "Luxembourg",
}
SLUG = {"Rheinland-Pfalz": "rhenanie-palatinat", "Saarland": "sarre", "Wallonie": "wallonie",
        "Grand Est": "lorraine", "Luxembourg": "luxembourg"}
REGION_CODE = {"LOR": "Grand Est", "RLP": "Rheinland-Pfalz", "SL": "Saarland",
               "WAL": "Wallonie", "LUX": "Luxembourg"}
FR_DEPTS = {"54": "Meurthe-et-Moselle", "55": "Meuse", "57": "Moselle", "88": "Vosges"}
WAL_PROV = {"2": "Brabant wallon", "5": "Hainaut", "6": "Liège", "8": "Luxembourg", "9": "Namur"}

# Corrections de la source (data.public.lu) constatées à l'audit — voir README.
CORRECTIONS = json.loads((ROOT / "corrections.json").read_text(encoding="utf-8"))

# Niveaux administratifs : id → (fichier source, territoire, libellé du niveau)
LEVELS = {
    "depts_lor":      ("Grand Est", "départements"),
    "arr_lor":        ("Grand Est", "arrondissements"),
    "cantons_lor":    ("Grand Est", "cantons"),
    "kreise_rlp":     ("Rheinland-Pfalz", "Kreise"),
    "vg_rlp":         ("Rheinland-Pfalz", "Verbandsgemeinden"),
    "landkreise_sar": ("Saarland", "Landkreise"),
    "provinces_wal":  ("Wallonie", "provinces"),
    "arr_wal":        ("Wallonie", "arrondissements"),
    "cantons_lux":    ("Luxembourg", "cantons"),
}


def _js_object(name):
    """Lit un objet littéral {'k':'v'} de 01-config-state.js (source unique de vérité)."""
    src = CONFIG_JS.read_text(encoding="utf-8")
    m = re.search(r"var %s = \{(.*?)\n\};" % name, src, re.S)
    return dict(re.findall(r"'([^']+)'\s*:\s*'([^']*)'", m.group(1)))


def _urls():
    src = CONFIG_JS.read_text(encoding="utf-8")
    return dict(re.findall(r"^\s+(\w+):\s+'(https://download[^']+)'", src, re.M))


def fetch(layer_id, cache):
    path = cache / (layer_id + ".geojson")
    if not path.exists():
        url = _urls()[layer_id]
        if not url.startswith("https://download.data.public.lu/"):  # URL tirée du code source, jamais saisie
            sys.exit("URL inattendue pour %s : %s" % (layer_id, url))
        print("  ↓ %s" % layer_id)
        urllib.request.urlretrieve(url, path)  # nosemgrep: dynamic-urllib-use-detected
    return json.loads(path.read_text(encoding="utf-8"))


def clean_name(s):
    return re.sub(r"\s+", " ", (s or "").strip())


def commune_parent(region, code, canton_lux):
    if region == "Grand Est":
        return FR_DEPTS.get(code[:2], "")
    if region == "Wallonie":
        return WAL_PROV.get(code[:1], "")
    if region == "Luxembourg":
        return canton_lux.get(code[:2], "")
    return AGS_KREISE.get(code[:5], "")


def communes_features(cache):
    geo = fetch("communes", cache)
    canton_lux = {clean_name(f["properties"]["code"]): clean_name(f["properties"]["name"])
                  for f in fetch("cantons_lux", cache)["features"]}
    feats = []
    for f in geo["features"]:
        p = f["properties"]
        region = REGION_CODE.get(p["region"], p["region"])
        name = clean_name(p["name"])
        code = CORRECTIONS["codes"].get(BLOC_LABELS[region] + "|" + name) \
            or CORRECTIONS["codes"].get(region + "|" + name) or (p["code"] or "").strip()
        name = CORRECTIONS["noms"].get(region + "|" + code, name)
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "id": code, "name": name,
            "territoire": BLOC_LABELS[region], "pays": BLOC_PAYS[region],
            "subdivision": commune_parent(region, code, canton_lux),
            "_region": region,
        }})
    return feats


def level_features(layer_id, cache):
    region, _ = LEVELS[layer_id]
    feats = []
    for f in fetch(layer_id, cache)["features"]:
        p = f["properties"]
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "id": clean_name(p["code"]), "name": clean_name(p["name"]),
            "territoire": BLOC_LABELS[region], "pays": BLOC_PAYS[region], "_region": region,
            "_type": clean_name(p.get("de_entity")),
        }})
    return feats


def disambiguate(feats):
    """`name` reste lisible ET unique : « Berg (Ahrweiler) » si le nom existe en double."""
    counts = {}
    for f in feats:
        counts[f["properties"]["name"]] = counts.get(f["properties"]["name"], 0) + 1
    for f in feats:
        p = f["properties"]
        dup = counts[p["name"]] > 1
        extra = p.get("subdivision") or p.get("_type") or p.get("territoire")
        if dup and extra:
            p["name"] = "%s (%s)" % (p["name"], extra)


def check_ids(feats, name):
    seen, problems = {}, []
    for f in feats:
        i = f["properties"]["id"]
        if not i:
            problems.append("id vide : %s" % f["properties"]["name"])
        seen.setdefault(i, []).append(f["properties"]["name"])
    for i, names in seen.items():
        if len(names) > 1:
            problems.append("id en double %s : %s" % (i, names))
    if problems:
        sys.exit("✗ %s — %s" % (name, "; ".join(problems)))


def run_mapshaper(args):
    r = subprocess.run(MAPSHAPER + args, capture_output=True, text=True)
    if r.returncode:
        sys.exit("mapshaper a échoué :\n" + r.stderr)
    return r.stderr


def export(feats, name, tmp, keys):
    """Écrit fonds/<name>.topojson au plus fort détail qui tient sous TARGET (sinon HARD_MAX)."""
    for f in feats:
        f["properties"] = {k: f["properties"][k] for k in keys if k in f["properties"]}
    limits = (TARGET, SOFT_MAX) + ((EXTRA_LIMIT[name],) if name in EXTRA_LIMIT else ())
    src = tmp / (name + ".geojson")
    src.write_text(json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")
    OUT.mkdir(exist_ok=True)
    out = OUT / (name + ".topojson")

    def build(pct):
        args = ["-i", str(src), "-clean"]
        if pct < 100:
            args += ["-simplify", "%s%%" % pct, "visvalingam", "weighted", "keep-shapes"]
        args += ["-each", "cx=Math.round(this.innerX*1e3)/1e3, cy=Math.round(this.innerY*1e3)/1e3",
                 "-o", str(out), "format=topojson", "quantization=%d" % QUANT, "force"]
        run_mapshaper(args)
        return out.stat().st_size

    lo, hi, best = 0.3, 100.0, None   # % de sommets conservés
    for limit in limits:
        lo, hi, best = 0.3, 100.0, None
        if build(lo) > limit:
            continue
        for _ in range(9):
            mid = (lo + hi) / 2
            if build(mid) <= limit:
                lo, best = mid, mid
            else:
                hi = mid
        best = lo
        break
    else:
        sys.exit("✗ %s dépasse %d Ko même à 0,3 %% : à découper" % (name, limits[-1] // 1000))
    size = build(best)
    return size, best, limit


def specs(cache):
    """(nom de fichier, features, clés de propriétés conservées)"""
    commune_keys = ["id", "name", "subdivision"]               # un seul territoire par fichier : pas de colonne constante
    commune_keys_all = ["id", "name", "territoire", "pays", "subdivision"]
    level_keys = ["id", "name"]
    communes = communes_features(cache)
    allc = json.loads(json.dumps(communes))   # copie AVANT les noms désambiguïsés par territoire

    for region, slug in SLUG.items():
        feats = [f for f in communes if f["properties"]["_region"] == region]
        disambiguate(feats)
        yield "communes_" + slug, feats, commune_keys

    # Fichier combiné : les codes NIS (BE) et INSEE (FR) se chevauchent (5 chiffres chacun) →
    # préfixe pays pour garder un `id` unique, comme Datawrapper l'exige.
    iso = {"Allemagne": "DE", "Belgique": "BE", "France": "FR", "Luxembourg": "LU"}
    for f in allc:
        f["properties"]["id"] = "%s-%s" % (iso[f["properties"]["pays"]], f["properties"]["id"])
    disambiguate(allc)
    yield "communes_grande-region", allc, commune_keys_all

    for layer_id, (region, _) in LEVELS.items():
        feats = level_features(layer_id, cache)
        disambiguate(feats)
        yield layer_id.replace("_", "-"), feats, level_keys


def blocs_spec(tmp, cache):
    """Un polygone par territoire (fusion des communes), via mapshaper -dissolve."""
    src = tmp / "communes_all.geojson"
    feats = communes_features(cache)
    src.write_text(json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")
    merged = tmp / "blocs_raw.geojson"
    run_mapshaper(["-i", str(src), "-dissolve", "_region", "copy-fields=territoire,pays",
                   "-o", str(merged), "format=geojson", "force"])
    out = json.loads(merged.read_text(encoding="utf-8"))["features"]
    for f in out:
        p = f["properties"]
        p["id"] = SLUG[p["_region"]]
        p["name"] = p["territoire"]
    return "blocs", out, ["id", "name", "pays"]


def describe(name):
    """(groupe, libellé) affichés dans l'onglet Bib. de l'outil via manifest.json."""
    if name == "blocs":
        return "Territoires", "Les 5 territoires"
    if name == "communes_grande-region":
        return "Communes", "Toute la Grande Région (cartes transfrontalières)"
    if name.startswith("communes_"):
        slug = name[len("communes_"):]
        region = next(r for r, sl in SLUG.items() if sl == slug)
        return "Communes", "%s (%s)" % (BLOC_LABELS[region], BLOC_PAYS[region])
    layer_id = name.replace("-", "_")
    region, level = LEVELS[layer_id]
    return "Niveaux intermédiaires", "%s — %s" % (level.capitalize(), BLOC_LABELS[region])


def main():
    wanted = set(sys.argv[1:])
    cache = pathlib.Path(tempfile.gettempdir()) / "gr-datawrapper-cache"
    cache.mkdir(exist_ok=True)
    global AGS_KREISE
    AGS_KREISE = _js_object("AGS_KREISE")
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="gr-dw-"))
    try:
        todo = list(specs(cache)) + [blocs_spec(tmp, cache)]
        print("Fonds de carte Datawrapper → %s" % OUT)
        report = []
        for name, feats, keys in todo:
            if wanted and name not in wanted:
                continue
            check_ids(feats, name)
            size, pct, limit = export(feats, name, tmp, keys)
            flag = "✓" if size <= TARGET else "≈ >500 Ko"
            print("  %s %-28s %4d régions  %6.0f Ko  (détail conservé : %.1f %%)" % (
                flag, name, len(feats), size / 1000, pct))
            group, label = describe(name)
            report.append({"file": name + ".topojson", "group": group, "label": label,
                           "regions": len(feats),
                           "bytes": size, "simplification_kept_pct": round(pct, 1)})
        if not wanted:
            (OUT / "manifest.json").write_text(
                json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
