#!/usr/bin/env python3
"""Contrôle indépendant des fonds générés (ne partage aucun code avec build_datawrapper.py).

    python3 datawrapper/validate_datawrapper.py

Vérifie, pour chaque fonds/*.topojson, les exigences Datawrapper :
JSON valide, type "Topology", polygones uniquement, `id` présent et unique,
coordonnées WGS-84 dans la zone Grande Région, poids < 2 Mo (cible 500 Ko),
points d'étiquette `cx`/`cy` situés à l'intérieur de la bbox de la région.
Code retour ≠ 0 au moindre échec.
"""
import json
import pathlib
import sys

FONDS = pathlib.Path(__file__).resolve().parent / "fonds"
HARD, TARGET = 2_000_000, 500_000
BBOX = (2.0, 45.0, 14.0, 54.0)   # lon min, lat min, lon max, lat max (large : Grande Région)


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    return arcs


def ring_pts(arcs, ring):
    pts = []
    for a in ring:
        seg = arcs[a] if a >= 0 else arcs[~a][::-1]
        pts.extend(seg if not pts else seg[1:])
    return pts


def geom_bbox(arcs, g):
    polys = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
    xs, ys = [], []
    for poly in polys:
        for ring in poly:
            for x, y in ring_pts(arcs, ring):
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def check(path):
    errs, warns = [], []
    size = path.stat().st_size
    try:
        topo = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        return ["JSON invalide : %s" % e], [], size, 0
    if topo.get("type") != "Topology":
        errs.append('type racine ≠ "Topology"')
    if size >= HARD:
        errs.append("poids ≥ 2 Mo")
    elif size > TARGET:
        warns.append("> 500 Ko (recommandé) : %d Ko" % (size // 1000))
    objs = topo.get("objects", {})
    if len(objs) != 1:
        errs.append("%d objets (1 attendu)" % len(objs))
    arcs = decode_arcs(topo)
    ids, n = {}, 0
    for obj in objs.values():
        for g in obj["geometries"]:
            n += 1
            p = g.get("properties") or {}
            if g.get("type") not in ("Polygon", "MultiPolygon"):
                errs.append("géométrie non polygonale : %s" % p.get("name"))
                continue
            if not g.get("arcs"):
                errs.append("géométrie vide : %s" % p.get("name"))
                continue
            i = p.get("id")
            if not i:
                errs.append("id manquant : %s" % p.get("name"))
            ids.setdefault(i, []).append(p.get("name"))
            if not p.get("name"):
                errs.append("name manquant : id=%s" % i)
            x0, y0, x1, y1 = geom_bbox(arcs, g)
            if x0 < BBOX[0] or y0 < BBOX[1] or x1 > BBOX[2] or y1 > BBOX[3]:
                errs.append("hors zone : %s" % p.get("name"))
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
    return errs, warns, size, n


def main():
    files = sorted(FONDS.glob("*.topojson"))
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
