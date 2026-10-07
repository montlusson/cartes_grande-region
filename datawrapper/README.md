# Fonds de carte Datawrapper — Grande Région

16 fonds TopoJSON prêts à importer dans Datawrapper (*Cartes → Carte choroplèthe → Personnalisée → Importer votre propre carte*), dans `fonds/`.

```bash
python3 datawrapper/build_datawrapper.py       # régénère tout (≈ 20 s, nécessite node/npx pour mapshaper)
python3 datawrapper/validate_datawrapper.py    # contrôle indépendant, code retour ≠ 0 au moindre échec
```

## Quel fichier choisir

| Besoin | Fichier | Régions | Poids |
|---|---|---|---|
| Les 5 territoires | `blocs` | 5 | 164 Ko |
| Communes d'un territoire | `communes_lorraine` / `_rhenanie-palatinat` / `_sarre` / `_wallonie` / `_luxembourg` | 2321 / 2300 / 52 / 261 / 100 | 999 / 999 / 75 / 298 / 169 Ko |
| Communes, tous territoires | `communes_grande-region` | 5034 | 1 898 Ko |
| Niveaux intermédiaires | `depts-lor`, `arr-lor`, `cantons-lor`, `kreise-rlp`, `vg-rlp`, `landkreise-sar`, `provinces-wal`, `arr-wal`, `cantons-lux` | 4 à 170 | 39–362 Ko |

Préférez le fichier d'un territoire dès qu'une carte n'en couvre qu'un : plus léger, plus précis, chargement plus rapide pour le lecteur. `communes_grande-region` frôle la limite de 2 Mo (détail réduit à ≈ 21 %) : à réserver aux cartes transfrontalières communales.

## Colonnes à choisir dans Datawrapper

- **Clé** : `id`. Codes officiels : INSEE (Lorraine), NIS (Wallonie), AGS (Allemagne), code commune (Luxembourg). Dans `communes_grande-region` seulement, les ids sont préfixés (`FR-54395`, `BE-25044`, `DE-07133090`, `LU-1001`) car NIS et INSEE ont tous deux 5 chiffres et se chevauchent.
- **Nom affiché** : `name`. Les homonymes sont levés par la subdivision : « Berg (Ahrweiler) », « Remoncourt (Vosges) ».
- `subdivision` (département / Kreis / province / canton) et, dans le fichier combiné, `territoire` et `pays` : utilisables pour regrouper ou filtrer.
- `cx`, `cy` : point intérieur de chaque région (étiquettes toujours à l'intérieur du polygone).

## Contraintes Datawrapper respectées

TopoJSON valide, polygones uniquement, WGS-84, `id` unique par région, coordonnées quantifiées (pas de décimales microscopiques), poids < 2 Mo. Cible de 500 Ko tenue pour 13 fichiers sur 16 ; les 3 fichiers communaux de Lorraine, de Rhénanie-Palatinat et de la Grande Région dépassent 500 Ko parce que 2 300 à 5 000 noms pèsent à eux seuls plus de 300 Ko : le détail est alors réglé au maximum qui tient dans 1 Mo (1,9 Mo pour le combiné).

La simplification est faite par mapshaper (Visvalingam pondéré sur frontières partagées) : deux communes voisines gardent la même frontière, sans trou ni chevauchement créé par le dessin.

## Corrections apportées aux données sources

Source : data.public.lu (« municipalities-gr-2026 »). Détail dans `corrections.json`, recoupé avec Wikidata (codes INS/INSEE).

- **Wallonie, 4 codes décalés** : Hélécine (25043 → **25118**), Incourt (25044 → **25043**), Ittre (25048 → **25044**), Jodoigne (25050 → **25048**). Jodoigne et La Hulpe partageaient 25050, ce qui aurait fusionné les deux communes dans Datawrapper.
- **Lorraine, 57211** : nommée « Norroy-le-Veneur » comme 57511, c'est en réalité **Fèves**.
- **Typographie** : 31 noms wallons sans les majuscules/traits d'union officiels (« Jemeppe-Sur-Sambre » → « Jemeppe-sur-Sambre »), 3 noms lorrains (Plaine-de-Walsch, L'Isle-en-Rigault, Arrancy-sur-Crusnes) ; espaces parasites supprimées (code d'Obergeckler, nom de Douaumont-Vaux).

**Non corrigé, à vérifier à la main** (la source et Wikidata divergent sans certitude) : Capavenir Vosges (88465), Vry (57736), Saulmory-et-Villefranche (55471). Rhénanie-Palatinat et Luxembourg n'ont pas été recoupés avec une source externe : seuls les doublons et codes vides ont été contrôlés.
