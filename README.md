# kitchenForge Plugin

**English** — Interactive recipe blocks for Obsidian. Describe ingredients in YAML, then scale the whole recipe with one click or recompute dependent quantities live from formulas.

**Français** — Blocs de recettes interactifs pour Obsidian. Décrivez vos ingrédients en YAML, puis mettez la recette à l'échelle en un clic ou recalculez les quantités dépendantes en direct à partir de formules.

---

kitchenForge renders a fenced ` ```kitchenforge ` code block as a structured ingredient list. A block operates in one of two mutually exclusive modes.

## Calculation mode (`id` + `calc`)

Mark base ingredients with an `id` to expose them as editable inputs. Dependent ingredients use a `calc:` expression that may reference those ids. The custom `@` operator computes `a @ b = a × b / 1000` — handy for g-per-kg ratios in charcuterie and similar recipes (e.g. salt at 20 g/kg of meat). The supported operators are `+ - * /` and `@`.

````markdown
```kitchenforge
unit: g
sections:
  - name: 🥩 Raw materials
    items:
      - name: Pork (semi-fatty)
        id: pork
        value: 800

      - name: Back fat
        id: lard
        value: 200

  - name: 🧂 Spices and seasonings
    items:
      - name: Nitrite salt (0.6% NaNO₂)
        calc: (pork + lard) @ 20

      - name: Ground black pepper
        calc: (pork + lard) @ 1.5

      - name: Nutmeg
        calc: (pork + lard) @ .5

      - name: Sugar
        calc: (pork + lard) @ 1.5

      - name: Dried garlic
        calc: (pork + lard) @ 5

      - name: Milk powder
        calc: (pork + lard) @ 5

      - name: Iced water
        calc: pork @ 15
```
````

<details>
<summary>Version française</summary>

````markdown
```kitchenforge
unit: g
sections:
  - name: 🥩 Matières premières
    items:
      - name: Porc mi-gras
        id: porc
        value: 800

      - name: Lard gras
        id: lard
        value: 200

  - name: 🧂 Épices et aromates
    items:
      - name: Sel nitrité (0,6 % NaNO₂)
        calc: (porc + lard) @ 20

      - name: Poivre noir moulu
        calc: (porc + lard) @ 1.5

      - name: Noix de muscade
        calc: (porc + lard) @ .5

      - name: Sucre
        calc: (porc + lard) @ 1.5

      - name: Ail séché
        calc: (porc + lard) @ 5

      - name: Lait en poudre
        calc: (porc + lard) @ 5

      - name: Eau glacée
        calc: porc @ 15
```
````

</details>

Edit any of the inputs — all dependent amounts recompute immediately.

## Scaling mode (`scales`)

Provide a `scales` list and plain ingredients with fixed `value`s. kitchenForge renders one button per scale; clicking it multiplies every amount by `mult`. Each click scales from the original amounts (not the most recent ones), so flipping between scales is non-destructive. The scale with `mult: 1`, if present, is selected on render; otherwise an implicit `💯 1:1` button (the recipe as written) is added automatically and selected by default.

````markdown
```kitchenforge
unit: g
decimals: 1
scales:
  - name: Full
    mult: 1
  - name: Half
    mult: .5
  - name: Third
    mult: .33
sections:
  - name: 🥣 Dough
    items:
      - name: Flour
        value: 400
      - name: Butter
        value: 140
      - name: Egg yolks
        value: 2
        unit: pcs
      - name: Sour cream
        value: 160
      - name: Salt
        value: 5

  - name: 🌰 Filling
    items:
      - name: Ground nuts
        value: 80
      - name: Powdered sugar
        value: 40
```
````

### Rounding (`round`)

By default scaled amounts use the recipe-wide `decimals`. Set a per-item `round: N` to snap an amount to the nearest multiple of `N` instead — useful for ingredients where decimal precision is just noise (round potatoes to the nearest `25` g) or for whole-unit items (eggs, sachets with `round: 1`). A non-zero amount never rounds down to `0`: it floors at one step, so scaling down can't make an ingredient disappear.

```yaml
- name: Potato
  value: 150
  round: 25      # 49.5 → 50, not 49.5
- name: Egg
  value: 1
  unit: pcs
  round: 1       # whole eggs only; a half-recipe still shows 1, not 0
```

Note that `round: 1` on a low count of an impactful ingredient (e.g. eggs) introduces real error when scaled — for those, expressing the ingredient by weight (1 egg ≈ 50 g) with a small `round` scales more honestly.

<details>
<summary>Version française</summary>

````markdown
```kitchenforge
unit: g
decimals: 1
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
      - name: Jaunes d'œufs
        value: 2
        unit: u
      - name: Crème fraîche épaisse
        value: 160
      - name: Sel
        value: 5

  - name: 🌰 Garniture
    items:
      - name: Noix moulues
        value: 80
      - name: Sucre glace
        value: 40
```
````

</details>

A recipe that mixes `scales:` with any item carrying `id:` or `calc:` is rejected with a clear error.

## Fields

| Field | Where | Notes |
|---|---|---|
| `unit` | top level | Default unit applied to items that don't override it. Defaults to `g`. |
| `decimals` | top level | Decimal places for computed/scaled amounts. Defaults to `2`. |
| `scales[]` | top level | `{name, mult}`. Mutually exclusive with `id`/`calc` items. |
| `sections[]` | top level | `{name, items[]}`. |
| `name` | item | Required. |
| `value` | item | Number. Required for plain and `id` items; computed for `calc` items. |
| `unit` | item | Overrides the recipe-level unit for this item. |
| `id` | item | Exposes the item as an editable input. Other items can reference the id in `calc`. |
| `calc` | item | Expression. Supports `+ - * /` and `@`. |
| `round` | item | Snap computed/scaled amount to the nearest multiple of this step (e.g. `25`, `1`). Overrides `decimals`; a non-zero amount floors at one step. |

## Copy

Every rendered block has a 📋 button at the top. Clicking it copies the current state of the recipe (with whatever values are currently shown) as Markdown to the clipboard.

## Installation

### From the community plugins browser

Once kitchenForge is approved: Settings → Community plugins → Browse → search for "kitchenForge" → Install → Enable.

### Manually

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest) and drop them into `<vault>/.obsidian/plugins/kitchen-forge/`. Then enable the plugin in Settings → Community plugins.

## Development

```sh
npm install
npm run dev      # esbuild in watch mode
npm test         # vitest
npm run lint
npm run build    # tsc + production esbuild
```

Tests cover both the pure helpers (`src/recipe.ts`, `src/calc.ts`) and the DOM-facing renderer (`src/kitchenforge.ts`) via `happy-dom`.
