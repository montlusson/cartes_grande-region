#!/usr/bin/env python3
"""Assemble les fichiers sources de src/ en un seul fichier HTML autonome.

Le dépôt garde une architecture "un seul fichier livré" (portable, pas de
serveur, cf. README) — seule la SOURCE est modulaire (chaque fichier < 500
lignes). Ce script fait l'assemblage, à lancer avant chaque publication :

    python3 build.py

La CI (.github/workflows/deploy.yml) le lance automatiquement à chaque push.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "carte_granderegion_v2026-06-12.html"

HTML_PARTIALS = [
    "html/shell-top.html",
    "html/tab-layers.html",
    "html/tab-style.html",
    "html/tab-data-library.html",
    "html/tab-publish.html",
    "html/shell-bottom.html",
]

JS_MODULES = [
    "js/01-config-state.js",
    "js/02-geo-utils.js",
    "js/03-map-init.js",
    "js/04-render.js",
    "js/05-overlays.js",
    "js/06-choropleth-scale.js",
    "js/07-choropleth-data.js",
    "js/08-legend-presets.js",
    "js/09-ui-helpers.js",
    "js/10-library.js",
    "js/11-events.js",
    "js/12-export-png.js",
    "js/13-export-embed-payload.js",
    "js/14-export-embed-template.js",
    "js/15-export-embed-modal.js",
    "js/16-publish.js",
    "js/17-init-search-preview.js",
]


def read(relpath):
    path = SRC / relpath
    if not path.exists():
        sys.exit(f"Fichier source manquant : {path}")
    return path.read_text(encoding="utf-8").rstrip("\n")


def main():
    head = read("head.html")
    style = read("styles.css")
    body = "\n".join(read(p) for p in HTML_PARTIALS)
    script = "\n".join(read(p) for p in JS_MODULES)

    html = (
        head + "\n"
        "<style>\n" + style + "\n"
        "</style>\n"
        "</head>\n"
        "<body>\n"
        + body + "\n"
        "<script>\n" + script + "\n"
        "</script>\n"
        "</body>\n"
        "</html>\n"
    )
    OUT.write_text(html, encoding="utf-8")
    print(f"✓ {OUT.name} — {html.count(chr(10)) + 1} lignes")


if __name__ == "__main__":
    main()
