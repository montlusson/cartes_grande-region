#!/usr/bin/env python3
"""Contrôle indépendant des fonds générés (ne partage aucun code avec build_datawrapper.py).

    python3 datawrapper/validate_datawrapper.py

Vérifie, pour chaque fonds/*.geojson, les exigences Datawrapper :
JSON valide, type "FeatureCollection", polygones uniquement, `id` présent et unique,
coordonnées WGS-84 dans la zone Grande Région (≤ 5 décimales), poids < 2 Mo (cible 500 Ko),
points d'étiquette `cx`/`cy` situés à l'intérieur de la bbox de la région,
CSV de données de base couvrant exactement les ids du fond.
Code retour ≠ 0 au moindre échec.
"""
import json
import pathlib
import sys

FONDS = pathlib.Path(__file__).resolve().parent / "fonds"
HARD, TARGET = 2_000_000, 500_000
BBOX = (2.0, 45.0, 14.0, 54.0)   # lon min, lat min, lon max, lat max (large : Grande Région)


def geom_bbox(g):
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    pts = [pt for poly in polys for ring in poly for pt in ring]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def ring_area(ring):
    """Aire signée (formule du lacet) : > 0 = antihoraire."""
    return sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1)) / 2


def winding_ok(g):
    """RFC 7946 : anneau extérieur antihoraire, trous horaires (sinon d3 remplit tout l'écran)."""
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return all(ring_area(poly[0]) > 0 and all(ring_area(h) < 0 for h in poly[1:]) for poly in polys)


def max_decimals(g):
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return max(len(repr(c).split(".")[1]) if "." in repr(c) else 0
               for poly in polys for ring in poly for pt in ring for c in pt)


def check_csv(path, ids):
    """Le CSV de données de base doit couvrir exactement les ids du fond."""
    import csv
    with open(path, encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    errs = []
    if "id" not in (rows[0] if rows else {}):
        return ["CSV sans colonne id"]
    csv_ids = [r["id"] for r in rows]
    if len(set(csv_ids)) != len(csv_ids):
        errs.append("CSV : ids en double")
    if set(csv_ids) != set(ids):
        errs.append("CSV ≠ fond : %d ids manquants, %d en trop" % (
            len(set(ids) - set(csv_ids)), len(set(csv_ids) - set(ids))))
    for r in rows:
        if any((v or "").strip() == "" for k, v in r.items() if k in ("id", "name", "sigle", "territoire", "pays")):
            errs.append("CSV : cellule vide pour %s" % r["id"])
            break
    return errs


def check(path):
    errs, warns = [], []
    size = path.stat().st_size
    try:
        geo = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        return ["JSON invalide : %s" % e], [], size, 0
    if geo.get("type") != "FeatureCollection":
        errs.append('type racine ≠ "FeatureCollection"')
    if size >= HARD:
        errs.append("poids ≥ 2 Mo")
    elif size > TARGET:
        warns.append("> 500 Ko (recommandé) : %d Ko" % (size // 1000))
    ids, n = {}, 0
    for f in geo.get("features", []):
        n += 1
        p = f.get("properties") or {}
        g = f.get("geometry") or {}
        if f.get("type") != "Feature" or g.get("type") not in ("Polygon", "MultiPolygon"):
            errs.append("entité non polygonale : %s" % p.get("name"))
            continue
        if not g.get("coordinates"):
            errs.append("géométrie vide : %s" % p.get("name"))
            continue
        i = p.get("id")
        if not i:
            errs.append("id manquant : %s" % p.get("name"))
        ids.setdefault(i, []).append(p.get("name"))
        if not p.get("name"):
            errs.append("name manquant : id=%s" % i)
        x0, y0, x1, y1 = geom_bbox(g)
        if x0 < BBOX[0] or y0 < BBOX[1] or x1 > BBOX[2] or y1 > BBOX[3]:
            errs.append("hors zone : %s" % p.get("name"))
        if not winding_ok(g):
            errs.append("anneaux mal orientés (RFC 7946) : %s" % p.get("name"))
        if max_decimals(g) > 5:
            errs.append("décimales microscopiques : %s" % p.get("name"))
        cx, cy = p.get("cx"), p.get("cy")
        if cx is None or cy is None:
            warns.append("cx/cy absent : %s" % p.get("name"))
        elif not (x0 - 1e-3 <= cx <= x1 + 1e-3 and y0 - 1e-3 <= cy <= y1 + 1e-3):
            errs.append("point d'étiquette hors bbox : %s" % p.get("name"))
    errs += ["id en double %s : %s" % (i, nm) for i, nm in ids.items() if len(nm) > 1]
    names = {}
    for i, nm in ids.items():
        names.setdefault(nm[0], []).append(i)
    errs += ["nom en double (illisible pour le lecteur) : %s" % nm for nm, v in names.items() if len(v) > 1]
    csv_path = path.with_suffix(".csv")
    if csv_path.exists():
        errs += check_csv(csv_path, list(ids))
    else:
        errs.append("CSV de données de base absent")
    return errs, warns, size, n


def main():
    files = sorted(FONDS.glob("*.geojson"))
    if not files:
        sys.exit("Aucun fonds à contrôler dans %s" % FONDS)
    bad = 0
    for f in files:
        errs, warns, size, n = check(f)
        status = "✗" if errs else ("≈" if warns else "✓")
        print("%s %-34s %5d régions %6d Ko %s" % (status, f.name, n, size // 1000,
              " | ".join((errs + warns)[:3])))
        bad += bool(errs)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
