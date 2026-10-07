# Fonds de carte Datawrapper — Grande Région

16 fonds **GeoJSON** prêts à importer dans Datawrapper (*Cartes → Carte choroplèthe → Personnalisée → Importer votre propre carte*), chacun accompagné d'un **CSV de données de base** à coller dans l'onglet Données. Tout est dans `fonds/`, et téléchargeable depuis l'onglet Bib. de l'outil.

```bash
python3 datawrapper/build_datawrapper.py       # régénère tout (≈ 25 s, nécessite node/npx pour mapshaper)
python3 datawrapper/validate_datawrapper.py    # contrôle indépendant, code retour ≠ 0 au moindre échec
```

## Mode d'emploi

1. Importer `xxx.geojson` comme carte personnalisée.
2. Dans l'onglet Données, coller le contenu de `xxx.csv` (même nom) : une ligne par région, avec nom, initiales, pays…
3. Choisir `id` comme colonne de clé, `name` comme libellé, puis ajouter vos propres colonnes de valeurs à côté.

**Cartes à symboles** : collez le CSV, puis indiquez les colonnes `latitude` et `longitude` pour placer un symbole au centre de chaque région (le point est toujours à l'intérieur du polygone, même simplifié). Pour des symboles ailleurs qu'au centre (une adresse, un site), remplacez ces deux colonnes par vos propres coordonnées.

Les ids peuvent commencer par un zéro (`07133090`, `0106`) : gardez la colonne en **texte** si un tableur ouvre le CSV, sinon les zéros sautent.

## Quel fichier choisir

| Besoin | Fichier | Régions | Poids |
|---|---|---|---|
| Les 5 territoires | `blocs` | 5 | 439 Ko |
| Communes d'un territoire | `communes_lorraine` / `_rhenanie-palatinat` / `_sarre` / `_wallonie` / `_luxembourg` | 2321 / 2300 / 52 / 261 / 100 | 995 / 996 / 185 / 498 / 457 Ko |
| Communes, tous territoires | `communes_grande-region` | 5034 | 1 891 Ko |
| Niveaux intermédiaires | `depts-lor`, `arr-lor`, `cantons-lor`, `kreise-rlp`, `vg-rlp`, `landkreise-sar`, `provinces-wal`, `arr-wal`, `cantons-lux` | 4 à 170 | 89–499 Ko |

Préférez le fichier d'un territoire dès qu'une carte n'en couvre qu'un : plus léger, plus précis. `communes_grande-region` frôle la limite de 2 Mo et ne conserve que 3 % des sommets d'origine : formes lisibles à l'échelle de la Grande Région, grossières en zoom commune. Les fichiers de Lorraine (15 %) et de Rhénanie-Palatinat (11 %) sont aussi simplifiés ; les autres, peu ou pas.

## Colonnes

| | GeoJSON | CSV |
|---|---|---|
| `id` — clé de jointure | ✓ | ✓ |
| `name` — nom affiché | ✓ | ✓ |
| `sigle` — initiales du territoire (LOR, RLP, SL, WAL, LUX) | blocs, niveaux | ✓ |
| `territoire`, `pays`, `pays_sigle` (FR, DE, BE, LU) | blocs, niveaux ; `territoire`/`pays` dans le combiné | ✓ |
| `subdivision` — département / Kreis / province / canton | communes | communes |
| `cx`, `cy` — point intérieur pour les étiquettes | ✓ | — |
| `latitude`, `longitude` — point intérieur de la région (même point que `cx`/`cy`) | — | ✓ |

Codes officiels : INSEE (Lorraine), NIS (Wallonie), AGS (Allemagne), code commune (Luxembourg). Dans `communes_grande-region` seulement, les ids sont préfixés (`FR-54395`, `BE-25044`, `DE-07133090`, `LU-1001`) car NIS et INSEE ont tous deux 5 chiffres et se chevauchent. Les homonymes sont levés par la subdivision : « Berg (Ahrweiler) », « Remoncourt (Vosges) ».

Le GeoJSON des communes ne porte que `id`, `name`, `subdivision` (+ `cx`/`cy`) pour rester léger ; les colonnes supplémentaires sont dans le CSV, où le poids ne compte pas.

## Contraintes Datawrapper respectées

GeoJSON valide (RFC 7946 : extérieurs antihoraires), polygones uniquement, WGS-84, `id` unique par région, coordonnées à 4 décimales (≈ 11 m, pas de « décimales microscopiques »), poids < 2 Mo. Cible de 500 Ko tenue pour 13 fichiers sur 16 ; les communes de Lorraine, de Rhénanie-Palatinat et de la Grande Région dépassent 500 Ko parce que 2 300 à 5 000 communes pèsent trop : le détail est alors réglé au maximum qui tient dans 1 Mo (1,9 Mo pour le combiné).

La simplification est faite par mapshaper (Visvalingam pondéré sur frontières partagées) : deux communes voisines gardent la même frontière, sans trou ni chevauchement créé par le dessin.

## Corrections apportées aux données sources

Source : data.public.lu (« municipalities-gr-2026 »). Détail dans `corrections.json`, recoupé avec Wikidata (codes INS/INSEE).

- **Wallonie, 4 codes décalés** : Hélécine (25043 → **25118**), Incourt (25044 → **25043**), Ittre (25048 → **25044**), Jodoigne (25050 → **25048**). Jodoigne et La Hulpe partageaient 25050, ce qui aurait fusionné les deux communes dans Datawrapper.
- **Lorraine, 57211** : nommée « Norroy-le-Veneur » comme 57511, c'est en réalité **Fèves**.
- **Typographie** : 31 noms wallons sans les majuscules/traits d'union officiels (« Jemeppe-Sur-Sambre » → « Jemeppe-sur-Sambre »), 3 noms lorrains (Plaine-de-Walsch, L'Isle-en-Rigault, Arrancy-sur-Crusnes) ; espaces parasites supprimées (code d'Obergeckler, nom de Douaumont-Vaux).

**Non corrigé, à vérifier à la main** (la source et Wikidata divergent sans certitude) : Capavenir Vosges (88465), Vry (57736), Saulmory-et-Villefranche (55471). Rhénanie-Palatinat et Luxembourg n'ont pas été recoupés avec une source externe : seuls les doublons et codes vides ont été contrôlés.
