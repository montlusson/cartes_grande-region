# cartes_grande-region

Outil de cartographie interactive de la Grande Région (Grand Est, Rhénanie-Palatinat, Sarre, Wallonie, Luxembourg) — multi-niveaux (Blocs/Subdivisions/Cantons/Communes), jointure CSV par nom de commune ou code INSEE/AGS, overlay de GeoJSON personnels, export PNG/Embed.

Tout tourne dans le navigateur (comme Reporter Studio) : rien n'est envoyé à un serveur, sauf les appels à l'API GitHub lors d'une publication (voir plus bas).

## Architecture : source modulaire, livrable en un seul fichier

Le fichier livré (`carte_granderegion_v2026-06-12.html`) doit rester **autonome et portable** — un seul fichier HTML, sans build côté lecteur. Mais pour l'édition, la source est découpée en modules de moins de 500 lignes dans `src/` :

```
src/
  head.html         balise <head> (avant <style>)
  styles.css        tout le CSS
  html/             partials du <body>, dans l'ordre d'assemblage
  js/                modules JS, dans l'ordre d'assemblage (portée globale partagée,
                     comme avant — pas de modules ES, juste des <script> concaténés)
build.py            assemble src/ → carte_granderegion_v2026-06-12.html
```

**Après toute modification dans `src/`, reconstruire avant de tester en local :**

```bash
python3 build.py
```

**Publication du code :**

```bash
git add -A
git commit -m "update carte"
git push
```

La CI (`.github/workflows/deploy.yml`) relance `build.py` automatiquement à chaque push, puis GitHub Pages republie (~30 s).

## Publier une carte (embed)

Bouton "Embed" → onglet "Publié" pour enregistrer un jeton GitHub, puis "Publier" dans le modal : publie directement via l'API GitHub (Contents), sans quitter l'outil. Le jeton doit être un **jeton à grain fin**, limité à ce dépôt, permission `Contents: Read and write` uniquement — jamais un jeton classique à accès large. Stocké uniquement dans le `localStorage` du navigateur, jamais envoyé ailleurs qu'à `api.github.com`, jamais inclus dans une carte publiée.

Chaque carte publiée est listée dans `manifest.json` (à la racine, généré automatiquement) et apparaît dans l'onglet "Publié" : copier le code, ouvrir, mettre à jour en place (même URL) ou supprimer.

La publication manuelle (télécharger le HTML → l'ajouter au dépôt à la main) reste disponible en repli, dans le modal Embed, sans jeton.
