---
title: kitchenForge — démonstration complète
tags:
  - kitchenforge
  - demo
---

# kitchenForge — démonstration complète

Ce fichier est une démonstration vivante du plugin. Ouvrez-le dans Obsidian **en mode lecture** : chaque bloc `kitchenforge` devient une recette interactive. Passez en mode source — les commentaires YAML sont visibles dans chaque bloc, et les explications les entourent.

L'interface du plugin (boutons, messages, infobulles) est en anglais : les messages attendus ci-dessous sont donc cités tels quels.

À essayer à la main :

- en mode calcul, modifiez les nombres dans les champs et regardez les formules se recalculer ;
- en mode mise à l'échelle, cliquez sur les boutons d'échelle et comparez les arrondis ;
- dans les groupes de choix, changez de variante, activez « tout afficher » (l'icône œil) et copiez la recette (📋) ;
- dans la section des erreurs, voyez comment le plugin réagit à un YAML invalide.

## Légende

| Symbole | Signification |
|---|---|
| `✅` | échelle sélectionnée |
| `🎚` | échelle disponible mais non sélectionnée |
| `●` | variante sélectionnée dans un groupe de choix |
| `○` | variante disponible dans un groupe de choix |
| `📋` | copie ce qui est affiché à l'instant |
| `👁` | affiche toutes les variantes de tous les groupes |
| `—` | la quantité n'est pas un nombre (`Infinity`/`NaN`), ou le champ est vide |

## 0. Ce que montre ce fichier

| Fonctionnalité | Où regarder |
|---|---|
| Mode calcul : `id` + `calc`, l'opérateur `@` | 1.1, 1.2 |
| Formules sans `id`, littéraux numériques uniquement | 1.3 |
| Suppression des espaces dans les noms et les unités | 1.4 |
| Une unité vide supprime l'unité de la recette | 1.4, 2.1 |
| Une section sans nom = un espace visuel | 1.5 |
| Échelles explicites et `decimals` | 2.1 |
| Échelles auto-nommées et le `💯 1:1` implicite | 2.2 |
| La première échelle est sélectionnée selon l'ordre | 2.3 |
| Restauration exacte des valeurs d'origine sur 1:1 | 2.3, 2.1 |
| Arrondi en virgule flottante (`1.005 → 1.01`) | 2.4 |
| `scales: []` = aucune échelle | 2.5 |
| Groupes de choix, variantes non adjacentes | 3.1 |
| Plusieurs groupes, `Variant N`, un groupe à une seule variante | 3.2 |
| L'échelle survit au changement de variante | 3.3 |
| Formules dans les variantes masquées | 3.4 |
| Copie et accessibilité | 4 |
| Erreurs de syntaxe (le bloc n'est pas affiché) | 5 |
| Erreurs d'exécution (le bloc est affiché) | 6 |
| Aide-mémoire des champs | 7 |

---

# 1. Mode calcul : `id` + `calc`

Dans ce mode, les ingrédients avec un `id` deviennent des champs de saisie, et les ingrédients avec `calc` sont recalculés à partir de formules. Un même bloc ne peut pas utiliser à la fois `scales` et `id`/`calc` — ce sont deux modes différents.

## 1.1 Exemple minimal : un ratio

Passez « Porc » de `800` à `1000` — le sel et le poivre se recalculent seuls. `@` est le pour mille : `a @ b = a × b / 1000`, donc `@ 20` signifie 20 g pour 1 kg, et non 20 %.

```kitchenforge
# Mode calcul : id + calc.
# Les valeurs des ids deviennent des variables utilisables dans les formules.
unit: g
sections:
  - name: 🥩 Viande
    items:
      - name: Porc
        id: pork
        value: 800          # un champ de saisie

      - name: Lard gras
        id: lard
        value: 200          # un champ de saisie

  - name: 🧂 Assaisonnement
    items:
      - name: Sel
        calc: (pork + lard) @ 20     # 20 g pour 1 kg = 2 %

      - name: Poivre noir
        calc: (pork + lard) @ 1.5    # 1,5 g pour 1 kg = 0,15 %
```

## 1.2 Recette complète : toutes les opérations, guillemets, `round`, unité vide

Presque toutes les possibilités du mode calcul sont réunies ici :

- les nombres peuvent s'écrire comme nombres (`200`) ou comme chaînes (`"800"`) — les deux sont interprétés comme des nombres ;
- `+ - * / @`, les parenthèses et le moins unaire sont pris en charge ;
- `unit` sur un ingrédient remplace l'unité de la recette ;
- `unit: ""` supprime complètement l'unité ;
- `round: 1` arrondit le résultat à un entier, mais ne laisse jamais une valeur non nulle devenir zéro ;
- `decimals: 2` définit la précision par défaut.

```kitchenforge
unit: g
decimals: 2
sections:
  - name: 🥩 Matières premières
    items:
      - name: Porc mi-gras
        id: pork
        value: "800"        # une chaîne contenant un nombre est acceptée aussi

      - name: Lard gras
        id: lard
        value: 200

      - name: Sel nitrité (saisie)
        id: salt
        value: 20

  - name: 🧂 Épices et aromates
    items:
      - name: Sel nitrité (calculé)
        calc: (pork + lard) @ 20

      - name: Poivre noir
        calc: (pork + lard) @ 1.5

      - name: Noix de muscade
        calc: (pork + lard) @ .5

      - name: Sucre
        calc: (pork + lard) @ 1.5

      - name: Ail séché
        calc: (pork + lard) @ 5

      - name: Lait en poudre
        calc: (pork + lard) @ 5

      - name: Eau glacée
        calc: pork @ 15

      - name: Part de sel dans la viande
        calc: salt / (pork + lard) * 100
        unit: "%"           # unité redéfinie

      - name: Sachets d'épices
        calc: (pork + lard) / 500
        unit: u
        round: 1            # à l'entier ; 0,2 sachet devient 1, jamais 0

      - name: Poids du lot sans unité
        calc: pork + lard
        unit: ""            # unité vide : « g » n'est pas ajouté
```

> Essayez de baisser « Porc » à `100` : « Sachets d'épices » affiche `1`, pas `0` — c'est le garde-fou qui empêche un ingrédient de disparaître lors de l'arrondi au pas.

## 1.3 Formules sans `id` : littéraux numériques uniquement

`calc` n'est pas obligé de référencer un `id`. Si la recette n'a aucun `id`, aucun champ de saisie n'apparaît, mais les formules sont quand même évaluées. Seuls les nombres sont autorisés dans les formules : les chaînes, `true`, `false` et `null` sont rejetés (voir la section 6).

```kitchenforge
unit: g
sections:
  - name: 🔢 Nombres uniquement
    items:
      - name: Moitié
        calc: 100 / 2

      - name: Pour mille
        calc: 1000 @ 0.5

      - name: Priorité des opérateurs
        calc: (2 + 3) * 4 - 10 / 2

      - name: Moins unaire
        calc: "-5 + 10"
```

## 1.4 Suppression des espaces et unité vide

Les noms d'ingrédients et les unités sont débarrassés des espaces aux bords. Une unité `""` (ou une chaîne d'espaces) signifie « pas d'unité » et n'est **pas** remplacée par l'unité de la recette. Les noms de section sont rognés aussi.

```kitchenforge
unit: g
sections:
  - name: "  🥣 Pâte  "       # les espaces autour du nom de section sont retirés
    items:
      - name: "  Farine  "       # les espaces autour du nom sont retirés
        value: 500

      - name: "  Sel  "
        value: 5
        unit: "  g  "           # les espaces autour de l'unité sont retirés

      - name: Œufs
        value: 2
        unit: u

      - name: "  Sucre  "
        value: 50
        unit: ""                # l'unité de la recette n'est pas ajoutée
```

## 1.5 Une section sans nom = un espace visuel

Une section sans `name` (ou avec un nom uniquement composé d'espaces) n'affiche aucun titre. S'il y avait du contenu avant elle, un paragraphe vide fait office d'espace. La toute première section ne reçoit pas d'espace.

```kitchenforge
unit: g
sections:
  - name: 🥣 Pâte
    items:
      - name: Farine
        value: 500

  - items:                  # pas de nom : espace visuel
      - name: Sel
        value: 5

  - name: 🧂 Garniture
    items:
      - name: Pommes
        value: 300
```

---

# 2. Mode mise à l'échelle : `scales`

Il n'y a pas de formules ici : chaque valeur est fixe, et les boutons d'échelle les multiplient par `mult`. Chaque clic part des valeurs **d'origine**, donc changer d'échelle ne cumule jamais les arrondis.

## 2.1 Échelles explicites, `decimals`, `round` et 1:1 exact

- La première échelle (`Complet`, `mult: 1`) est sélectionnée à l'ouverture.
- Sur 1:1, les valeurs d'origine sont affichées exactement : `12.345` reste `12.345` même avec `decimals: 2`.
- Sur les autres échelles, les valeurs sont arrondies à `decimals` ou au pas `round`.
- `round: 25` est un pas de 25 g ; `round: 1` arrondit aux pièces entières.
- Avec `round`, une valeur non nulle ne devient jamais zéro.

```kitchenforge
unit: g
decimals: 2
scales:
  - name: Complet
    mult: 1
  - name: Moitié
    mult: .5
  - name: Tiers
    mult: .33
sections:
  - name: 🥣 Pâte
    items:
      - name: Farine
        value: 400

      - name: Beurre
        value: 140

      - name: Œufs
        value: 2
        unit: u
        round: 1            # pièces entières ; 0,66 → 1

      - name: Crème fraîche
        value: 160

      - name: Sel
        value: 5

      - name: Épice exacte
        value: 12.345       # 12.345 exactement sur 1:1 ; 6,17 sur moitié

  - name: 🥔 Accompagnement
    items:
      - name: Pomme de terre
        value: 150
        round: 25          # pas de 25 g ; moitié → 75, tiers → 50

      - name: Aneth
        value: 3
        unit: ""           # pas d'unité
```

## 2.2 Échelles auto-nommées et le `💯 1:1` implicite

Si une échelle n'a pas de `name`, elle en reçoit un à partir de `mult` : `💯 1:1` pour `1`, et `×2`, `×0.5`, `×1.5` pour les autres. Si aucune échelle n'a `mult: 1`, le plugin ajoute un `💯 1:1` implicite **en premier** — la recette s'ouvre aux quantités d'origine.

```kitchenforge
unit: g
scales:
  - mult: .5            # → 🎚 ×0.5
  - mult: 2             # → 🎚 ×2
sections:
  - name: 🥞 Crêpes
    items:
      - name: Lait
        value: 500

      - name: Farine
        value: 250

      - name: Œufs
        value: 2
        unit: u
```

## 2.3 La première échelle est sélectionnée selon l'ordre

La première échelle de la liste devient sélectionnée, même si son `mult` n'est pas `1`. Ici « Double » est sélectionné à l'ouverture, donc les valeurs sont déjà arrondies. Le bouton « Original » restaure les valeurs d'origine exactes.

```kitchenforge
unit: g
decimals: 2
scales:
  - name: Double
    mult: 2
  - name: Original
    mult: 1
sections:
  - name: 🍰 Génoise
    items:
      - name: Farine
        value: 12.345       # à l'ouverture : 24.69 ; « Original » : 12.345

      - name: Sucre
        value: 100          # à l'ouverture : 200 ; « Original » : 100
```

> Si vous voulez une autre échelle par défaut tout en gardant 1:1 disponible, placez-la en premier et ajoutez une entrée `mult: 1` après elle.

## 2.4 Précision de l'arrondi : `1.005 → 1.01`

L'arrondi décale l'exposant, donc les erreurs classiques de virgule flottante binaire ne transforment pas `1.005` en `1.00`.

```kitchenforge
unit: g
decimals: 2
scales:
  - name: Original
    mult: 1
  - name: Moitié
    mult: .5
sections:
  - name: 🔬 Précision
    items:
      - name: Échantillon 2.01
        value: 2.01         # moitié = 1.005 → 1.01

      - name: Échantillon 8.575
        value: 8.575        # moitié = 4.2875 → 4.29
```

## 2.5 `scales: []` — une liste vide signifie « aucune échelle »

Un tableau vide ne crée aucun bouton et ne bloque pas le mode calcul.

```kitchenforge
unit: g
scales: []
sections:
  - name: 🥗 Salade
    items:
      - name: Tomates
        value: 200

      - name: Concombres
        value: 100
```

Le même `scales: []` vide ne gêne pas `id`/`calc` :

```kitchenforge
unit: g
scales: []
sections:
  - name: 🥗 Salade
    items:
      - name: Tomates
        id: tomatoes
        value: 200

      - name: Concombres
        id: cucumbers
        value: 100

      - name: Total
        calc: tomatoes + cucumbers
```

---

# 3. Groupes de choix : `choice`

Les sections qui partagent une même valeur `choice` forment un seul groupe de variantes. Le groupe est dessiné à la position de la **première** variante, même si d'autres sections s'intercalent entre les variantes. La première variante est sélectionnée à l'ouverture.

## 3.1 Exemple de base : des variantes non adjacentes

Dans la source, « Décor » se trouve entre « Pommes » et « Cerises », mais à l'écran le groupe est rassemblé au niveau de la première variante, et « Décor » se retrouve après lui.

```kitchenforge
unit: g
sections:
  - name: 🥣 Pâte
    items:
      - name: Farine
        value: 400

  - choice: Garniture
    name: 🍎 Pommes
    items:
      - name: Pommes
        value: 500
      - name: Cannelle
        value: 5

  - name: 🌰 Décor
    items:
      - name: Noix
        value: 80

  - choice: Garniture
    name: 🍒 Cerises
    items:
      - name: Cerises
        value: 400
      - name: Sucre
        value: 60
```

Ce qu'il faut vérifier :

- les boutons `● 🍎 Pommes` et `○ 🍒 Cerises` ;
- le bouton œil à côté de 📋 affiche toutes les variantes ;
- en mode « toutes les variantes », les titres deviennent `Garniture → 🍎 Pommes` et `Garniture → 🍒 Cerises` ;
- 📋 ne copie que la variante visible et conserve le nom du groupe.

## 3.2 Plusieurs groupes, `Variant N` et un groupe à une seule variante

- Un nom de variante vide (`name: ""`) et un `name` absent donnent `Variant 2`, `Variant 3` — identiques dans les boutons, les titres et la copie.
- Un groupe à une seule variante n'est pas un groupe : il est dessiné comme une section normale `Parsemage → 🍬 Sucre glace`.
- Le bouton œil est global pour tous les groupes du bloc.

```kitchenforge
unit: g
sections:
  - choice: Garniture
    name: 🍎 Pommes
    items:
      - name: Pommes
        value: 500

  - choice: Garniture
    name: ""                 # nom vide → Variant 2
    items:
      - name: Poires
        value: 450

  - choice: Garniture
    # pas de nom             # → Variant 3
    items:
      - name: Prunes
        value: 400

  - choice: Glaçage
    name: 🍫 Chocolat
    items:
      - name: Chocolat
        value: 100

  - choice: Glaçage
    name: 🍋 Citron
    items:
      - name: Jus de citron
        value: 40

  - choice: Parsemage
    name: 🍬 Sucre glace
    items:
      - name: Sucre glace
        value: 20
```

## 3.3 Groupe de choix + échelles : l'échelle survit au changement de variante

Cliquez sur « Moitié », puis passez de pommes à cerises — les cerises sont déjà divisées par deux. L'échelle s'applique à toutes les variantes, y compris les masquées.

```kitchenforge
unit: g
scales:
  - name: Complet
    mult: 1
  - name: Moitié
    mult: .5
sections:
  - name: 🥣 Pâte
    items:
      - name: Farine
        value: 400

  - choice: Garniture
    name: 🍎 Pommes
    items:
      - name: Pommes
        value: 500

  - choice: Garniture
    name: 🍒 Cerises
    items:
      - name: Cerises
        value: 400
```

## 3.4 Groupe de choix + formules : les variantes masquées sont calculées aussi

Un `id` est partagé par toute la recette, il ne peut donc pas être dupliqué dans les variantes. Ici `flour` est déclaré dans une section ordinaire, et les deux variantes de garniture l'utilisent dans `calc`. La variante masquée est évaluée au rendu, donc le changement n'affiche jamais de nombres périmés.

```kitchenforge
unit: g
sections:
  - name: 🥣 Base
    items:
      - name: Farine
        id: flour
        value: 500

      - name: Eau
        id: water
        value: 300

  - choice: Garniture
    name: 🍎 Pommes
    items:
      - name: Pommes
        calc: flour * 0.8

      - name: Sucre
        calc: flour @ 100

  - choice: Garniture
    name: 🍒 Cerises
    items:
      - name: Cerises
        calc: flour * 0.6

      - name: Sucre
        calc: flour @ 120

  - name: 🧂 Parsemage
    items:
      - name: Sel
        calc: flour @ 5
```

---

# 4. Copie et accessibilité

Le bouton 📋 copie **ce qui est affiché à l'instant** sous forme de liste Markdown propre :

- les valeurs sont déjà calculées ou mises à l'échelle ;
- les variantes masquées ne sont pas copiées ;
- la variante sélectionnée reçoit un titre `Groupe → Variante` ;
- en mode « toutes les variantes », chaque variante est copiée ;
- une valeur non numérique ou vide est copiée comme `—` ;
- le YAML source n'est jamais modifié ;
- après une copie réussie, le bouton devient ✅ pendant une seconde.

Un exemple de ce que copie le bloc 3.1 (pour la variante pommes) :

```text
__🥣 Pâte__

 1. Farine: **400 g**

__Garniture → 🍎 Pommes__

 1. Pommes: **500 g**
 2. Cannelle: **5 g**

__🌰 Décor__

 1. Noix: **80 g**
```

Accessibilité :

- le bouton de copie a `aria-label` et `title` « Copy recipe » ;
- l'échelle sélectionnée a `aria-pressed="true"`, les autres `false` ;
- le bouton œil a `aria-pressed` et un libellé clair ;
- la ligne d'état est annoncée via `aria-live="polite"` et `aria-atomic="true"` ;
- les champs de saisie ont un `aria-label` du type « Amount for ... » et `step="any"`, pour que les valeurs décimales ne soient pas considérées comme invalides.

---

# 5. Erreurs de syntaxe

Dans cette section, le bloc **n'est pas affiché**. À la place apparaît un paragraphe unique avec la classe `.kf-error` et un préfixe :

```text
Error parsing recipe: <message>
```

C'est une vérification statique : le YAML, la structure sections/ingrédients, les échelles et la précision sont validés avant le rendu. S'il y a une erreur, il n'y a pas de recette partielle.

## 5.1 YAML et structure

### YAML cassé

```kitchenforge
this is: not
  valid: yaml: ::
```

> **Attendu :** `Error parsing recipe:` + le message de l'analyseur YAML.

### Bloc vide (commentaire seul)

```kitchenforge
# Commentaire seul — pas de données.
```

> **Attendu :** `Recipe must be a YAML mapping`.

### Pas de `sections`

```kitchenforge
unit: g
decimals: 2
```

> **Attendu :** `Recipe must have a 'sections' array`.

### `sections: []` vide

```kitchenforge
unit: g
sections: []
```

> **Attendu :** `Recipe must have at least one section`.

### Une section n'est pas un mapping

```kitchenforge
unit: g
sections:
  - 42
```

> **Attendu :** `Section #1 must be a mapping`.

### Une section n'a pas d'`items`

```kitchenforge
unit: g
sections:
  - name: Sans ingrédients
```

> **Attendu :** `Section 'Sans ingrédients' must have an 'items' array`.

### `items: []` vide

```kitchenforge
unit: g
sections:
  - name: Vide
    items: []
```

> **Attendu :** `Section 'Vide' must have at least one item`.

### Un ingrédient n'est pas un mapping

```kitchenforge
unit: g
sections:
  - name: Cassé
    items:
      - 5
```

> **Attendu :** `Item #1 in section 'Cassé' must be a mapping`.

### Un ingrédient n'a pas de nom

```kitchenforge
unit: g
sections:
  - name: Cassé
    items:
      - value: 100
```

> **Attendu :** `Item #1 in section 'Cassé' must have a non-empty string 'name'`.

### Un nom d'ingrédient ne contient que des espaces

```kitchenforge
unit: g
sections:
  - name: Cassé
    items:
      - name: "   "
        value: 100
```

> **Attendu :** `Item #1 in section 'Cassé' must have a non-empty string 'name'`.

### Un nom de section n'est pas une chaîne

```kitchenforge
unit: g
sections:
  - name: 123
    items:
      - name: x
        value: 1
```

> **Attendu :** `Section #1 name must be a string` (le message indique `#1` parce que le nom n'est pas une chaîne).

### `choice` n'est pas une chaîne

```kitchenforge
unit: g
sections:
  - name: A
    choice: 123
    items:
      - name: x
        value: 1
```

> **Attendu :** `Choice group name in section 'A' must be a string`.

## 5.2 Champs des ingrédients

### `unit` n'est pas une chaîne

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        value: 1
        unit: 5
```

> **Attendu :** `Item 'x' in section 'A' must have a string 'unit'`.

### `calc` n'est pas une chaîne

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        calc: 123
```

> **Attendu :** `Item 'x' in section 'A' must have a string 'calc'`.

### `round` n'est pas un nombre

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        value: 1
        round: abc
```

> **Attendu :** `Item 'x' in section 'A' must have a numeric 'round'`.

### `id` n'est pas une chaîne

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        id: 0
        value: 1
```

> **Attendu :** `Item 'x' in section 'A' must have a string 'id'`.

### Un `id` invalide

`id` doit être un nom de variable valide : pas d'espaces ni de traits d'union, pas `true`/`false`/`null`, pas `__proto__`. Un trait d'union transformerait `olive-oil` en soustraction, donc un tel id est rejeté.

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        id: olive-oil
        value: 1
```

> **Attendu :** `Item 'x' in section 'A' has an invalid 'id' 'olive-oil': use a valid formula variable name`.
>
> Autres variantes rejetées : `id: "a b"`, `id: true`, `id: __proto__`, `id: "123"`.

### `id` et `calc` sur le même ingrédient

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        id: x
        value: 1
        calc: x * 2
```

> **Attendu :** `Item 'x' in section 'A' cannot have both 'id' and 'calc'`.

## 5.3 Valeurs

### Pas de `value` sur un ingrédient simple

```kitchenforge
unit: g
sections:
  - name: Cassé
    items:
      - name: A
```

> **Attendu :** `Item 'A' in section 'Cassé' must have a numeric 'value'`.

### `value: null`

```kitchenforge
unit: g
sections:
  - name: Cassé
    items:
      - name: A
        value: null
```

> **Attendu :** `Item 'A' in section 'Cassé' must have a numeric 'value'`.

### `value` n'est pas un nombre

```kitchenforge
unit: g
sections:
  - name: Cassé
    items:
      - name: A
        value: "1/2"
```

> **Attendu :** `Item 'A' in section 'Cassé' must have a numeric 'value'`.
>
> Une chaîne vide, `abc`, un objet et un tableau sont rejetés aussi. Un nombre entre guillemets (`"800"`) est accepté.

### `id` sans `value`

```kitchenforge
unit: g
sections:
  - name: Cassé
    items:
      - name: A
        id: a
```

> **Attendu :** `Item 'A' in section 'Cassé' must have a numeric 'value'`.

## 5.4 `id` en double

Les `id` sont des noms de variables globaux pour toute la recette. Un doublon est rejeté même si l'un d'eux est écrit avec des espaces : les ids sont rognés avant la comparaison.

```kitchenforge
unit: g
sections:
  - name: Sauce
    items:
      - name: Sel
        id: salt
        value: 5

  - name: Pâte
    items:
      - name: Sel
        id: salt
        value: 2
```

> **Attendu :** `Duplicate id 'salt': 'Sel' in 'Sauce' and 'Sel' in 'Pâte'`.

### Un doublon entre variantes de choix

Les variantes forment une seule recette, donc les ids ne peuvent pas se répéter, même entre variantes.

```kitchenforge
unit: g
sections:
  - choice: Garniture
    name: Pomme
    items:
      - name: Pommes
        id: fruit
        value: 5

  - choice: Garniture
    name: Cerise
    items:
      - name: Cerises
        id: fruit
        value: 7
```

> **Attendu :** `Duplicate id 'fruit': 'Pommes' in 'Pomme' and 'Cerises' in 'Cerise'`.

## 5.5 Échelles

### `scales` n'est pas un tableau

```kitchenforge
unit: g
scales: foo
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' must be an array`.

### Une entrée de `scales` n'est pas un mapping

```kitchenforge
unit: g
scales:
  - null
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' entry #1 must be a mapping`.

### Un `name` d'échelle n'est pas une chaîne

```kitchenforge
unit: g
scales:
  - name: 2
    mult: 2
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' entry #1 'name' must be a string`.

### Pas de `mult`

```kitchenforge
unit: g
scales:
  - name: Full
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' entry #1 'Full' must have a positive numeric 'mult'`.

### `mult: 0` ou négatif

```kitchenforge
unit: g
scales:
  - name: Zero
    mult: 0
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' entry #1 'Zero' must have a positive numeric 'mult'`.

### `mult` n'est pas un nombre

```kitchenforge
unit: g
scales:
  - name: Bad
    mult: abc
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' entry #1 'Bad' must have a positive numeric 'mult'`.

### Noms d'échelle explicites en double

```kitchenforge
unit: g
scales:
  - name: Half
    mult: .5
  - name: Half
    mult: 2
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' entry #2 has duplicate name 'Half' (entry #1 already uses it)`.

### Noms générés en double

Deux échelles sans nom avec le même `mult` reçoivent le même nom généré `×2` — c'est un doublon aussi.

```kitchenforge
unit: g
scales:
  - mult: 2
  - mult: 2
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'scales' entry #2 has duplicate name '×2' (entry #1 already uses it)`.

### Le nom réservé `💯 1:1`

Si aucune échelle n'a `mult: 1`, le plugin ajoute un `💯 1:1` implicite. Une échelle utilisateur portant ce nom ne peut pas être créée — sinon deux boutons identiques apparaîtraient.

```kitchenforge
unit: g
scales:
  - name: "💯 1:1"
    mult: 2
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Scale name '💯 1:1' is reserved for the implicit 1:1 scale`.

## 5.6 Mélange de modes et précision

### `scales` avec `id`/`calc`

```kitchenforge
unit: g
scales:
  - name: Full
    mult: 1
sections:
  - name: S
    items:
      - name: A
        id: a
        value: 10
      - name: B
        calc: a * 2
```

> **Attendu :** `Cannot have scales with ids/formulas specified`.
>
> Un bloc — un mode. Supprimez `scales`, ou supprimez tous les `id`/`calc`.

### `decimals` hors limites

```kitchenforge
unit: g
decimals: 16
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'decimals' must be an integer between 0 and 15`.
>
> `decimals: abc`, `decimals: 2.5` et `decimals: -1` sont rejetés aussi.

### L'`unit` de la recette n'est pas une chaîne

```kitchenforge
unit: 5
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Attendu :** `Recipe 'unit' must be a string`.

---

# 6. Erreurs d'exécution

Dans cette section, le bloc **est affiché**, mais un paragraphe `.kf-error` apparaît en dessous. Ces erreurs ne cassent pas toute la recette : les autres formules continuent de se calculer, et le message disparaît dès que la saisie est corrigée.

## 6.1 Variable inconnue

`missing` n'est jamais déclaré. L'erreur apparaît dès le rendu. En même temps, « Formule correcte » se calcule quand même — une formule cassée ne bloque pas les autres.

```kitchenforge
unit: g
sections:
  - name: 🧪 Erreur de formule
    items:
      - name: Viande
        id: meat
        value: 100

      - name: Sel
        calc: missing * 2          # erreur : la variable n'existe pas

      - name: Formule correcte
        calc: meat * 2             # calculée indépendamment : 200
```

> **Attendu :** `Formula error: Unknown variable: missing`.
>
> Le champ « Sel » reste vide, « Formule correcte » affiche `200`.
>
> Si vous cliquez maintenant sur 📋, la copie réussit alors que l'erreur de formule reste en place — une copie réussie ne doit pas masquer des erreurs sans rapport.

## 6.2 Opérateur non pris en charge

Seuls `+ - * / @` sont pris en charge. Tout autre opérateur (`%`, `^`, `**`, etc.) provoque une erreur d'exécution.

```kitchenforge
unit: g
sections:
  - name: 🧪 Opérateur %
    items:
      - name: Viande
        id: meat
        value: 100

      - name: Reste
        calc: meat % 3
```

> **Attendu :** `Formula error: Unsupported operator: %`.

## 6.3 Un littéral non numérique

Seuls les nombres sont autorisés dans les formules. Les chaînes, `true`/`false` et `null` ne sont pas convertis silencieusement en nombre — c'est une erreur.

```kitchenforge
unit: g
sections:
  - name: 🧪 Littéral chaîne
    items:
      - name: Chaîne
        calc: "'abc' + 1"
```

> **Attendu :** `Formula error: Unsupported literal: abc`.

```kitchenforge
unit: g
sections:
  - name: 🧪 Littéral booléen
    items:
      - name: Booléen
        calc: "true + 1"
```

> **Attendu :** `Formula error: Unsupported literal: true`.

## 6.4 Division par zéro : pas une erreur, mais `—`

`Infinity` et `NaN` ne sont pas traités comme une erreur de formule : la valeur est simplement affichée comme `—` et copiée de la même façon. Passez le diviseur à `2` pour obtenir `5`.

```kitchenforge
unit: g
sections:
  - name: 🧪 Division par zéro
    items:
      - name: Diviseur
        id: zero
        value: 0

      - name: Résultat
        calc: 10 / zero            # Infinity → « — »
```

> **Attendu :** le champ du résultat affiche `—`, sans message d'erreur.
>
> La copie affiche `—` aussi. C'est fait pour que `Infinity`/`NaN` n'atteignent jamais le presse-papiers.

## 6.5 Champ vide

Si vous videz un champ `id`, la recette n'a simplement pas de valeur pour lui — elle est conservée comme « non définie » au lieu de devenir `0`. Les quantités dépendantes affichent `—`, le champ est mis en évidence, et une infobulle discrète liste ce qui reste à remplir. Retapez un nombre : la mise en évidence et l'infobulle disparaissent, et les quantités reviennent. (Une vraie faute de frappe dans une formule reste une erreur `Formula error:` en rouge — voir 6.1.)

```kitchenforge
unit: g
sections:
  - name: 🧪 Vide le champ « Viande »
    items:
      - name: Viande
        id: meat
        value: 100

      - name: Sel
        calc: meat @ 20
```

> **Attendu après avoir vidé le champ :** le champ « Sel » affiche `—`, le champ « Viande » est mis en évidence, et l'infobulle `Enter a value for “Viande”` apparaît — ce n'est pas une erreur de formule.
>
> Après avoir saisi `500` : sel `10`, et la mise en évidence et l'infobulle disparaissent.

## 6.6 Une variante masquée cassée ne casse pas la visible

Les formules sont évaluées dans toutes les variantes, y compris les masquées. Une formule cassée dans la première variante n'empêche pas la seconde : passez à « Correcte » et vous verrez `2`. L'erreur reste, parce que la formule cassée est toujours là.

```kitchenforge
unit: g
sections:
  - choice: Garniture
    name: Cassée
    items:
      - name: Erreur
        calc: missing * 2

  - choice: Garniture
    name: Correcte
    items:
      - name: Normal
        calc: 1 + 1
```

> **Attendu :** `Formula error: Unknown variable: missing` ; la seconde variante affiche `2`.

## 6.7 Erreurs qu'une recette ne peut pas déclencher

Certains messages n'apparaissent qu'à l'interaction ou quand l'environnement échoue. Il est utile de les connaître :

| Message | Quand il apparaît | Ce que fait le plugin |
|---|---|---|
| `Scale failed: ...` | une erreur pendant l'application d'une échelle | l'échelle n'est pas appliquée, le ✅ reste sur l'échelle précédente, le bouton redevient actif |
| `Copy failed: ...` | le navigateur a bloqué l'accès au presse-papiers | affiche une erreur de copie, la recette est inchangée |
| `Formula error: ...` | une erreur pendant le recalcul après saisie | efface seulement les valeurs cassées, les autres formules restent calculées |
| `Enter a value for ...` | un champ `id` est vide | le garde comme « non défini » : les quantités dépendantes affichent `—` et le champ est mis en évidence (ce n'est pas une erreur) |
| `—` | `Infinity`/`NaN` ou un champ vide | affiche un tiret dans l'interface et dans la copie |

---

# 7. Aide-mémoire des champs

| Champ | Niveau | Obligatoire | Ce qu'il fait |
|---|---|---|---|
| `unit` | recette | non | Unité par défaut ; `g` par défaut. Affichage uniquement, aucune conversion. |
| `decimals` | recette | non | Décimales pour les quantités calculées et mises à l'échelle ; entier `0...15`, `2` par défaut. |
| `scales[]` | recette | non | Liste de `{name?, mult}`. Incompatible avec `id`/`calc`. Une liste vide signifie aucune échelle. |
| `sections[]` | recette | **oui** | Une liste non vide de sections. |
| `choice` | section | non | Libellé du groupe de choix. Les sections ayant le même `choice` forment un groupe. |
| `name` | section | non | Titre ; un nom vide crée un espace visuel. Sur une variante, c'est le libellé du bouton. |
| `items[]` | section | **oui** | Une liste non vide d'ingrédients. |
| `name` | ingrédient | **oui** | Une chaîne non vide ; rognée. |
| `value` | ingrédient | oui, sauf avec `calc` | Un nombre ou une chaîne numérique. Ignorée quand `calc` est présent (mais validée si fournie). |
| `unit` | ingrédient | non | Remplace l'unité de la recette. `""` supprime l'unité. Rognée. |
| `id` | ingrédient | non | Un nom de variable de formule. Unique dans toute la recette. Nécessite `value`. |
| `calc` | ingrédient | non | Une formule : `+ - * / @`, parenthèses, moins unaire. Utilisée à la place de `value`. |
| `round` | ingrédient | non | Un pas d'arrondi pour les quantités calculées/mises à l'échelle. Une valeur non nulle ne devient jamais zéro. |

Formules :

```text
a + b      addition
a - b      soustraction
a * b      multiplication
a / b      division
a @ b      pour mille : a × b / 1000
( ... )    regroupement
-a         moins unaire
```

---

# 8. Récapitulatif rapide des correctifs

| Correctif | Démonstration |
|---|---|
| 1:1 restaure les valeurs d'origine exactes | 2.3, 2.1 |
| Formatage propre des quantités (`—` au lieu de `Infinity`/`NaN`) | 6.4 |
| Une unité d'ingrédient vide supprime l'unité de la recette | 1.4, 2.1 |
| Les noms d'échelle en double sont rejetés | 5.5 |
| Les `sections`/`items` vides sont rejetés | 5.1 |
| Les noms et les unités sont rognés | 1.4 |
| Les formules n'acceptent que des littéraux numériques | 6.3 |
| La sélection d'échelle est conservée en cas d'échec | 6.7 |
| Les erreurs de formule survivent à une copie réussie | 6.1 |
| Une `value` non numérique sur un ingrédient simple est une erreur | 5.3 |
| L'arrondi au premier rendu est décrit fidèlement | 2.3 |
| Les échelles auto-nommées et le 1:1 implicite | 2.2 |