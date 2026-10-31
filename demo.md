---
title: kitchenForge — full demo
tags:
  - kitchenforge
  - demo
---

# kitchenForge — full demo

This file is a live showcase of the plugin. Open it in Obsidian **in reading mode**: every `kitchenforge` block turns into an interactive recipe. Switch to source mode — the YAML comments are visible inside each block, and the explanations sit around it.

Things to try by hand:

- in calculation mode, edit numbers in the fields and watch the formulas recompute;
- in scaling mode, click the scale buttons and compare rounding;
- in choice groups, switch variants, turn on "show all" (the eye icon) and copy the recipe (📋);
- in the errors section, see how the plugin reacts to invalid YAML.

## Legend

| Symbol | Meaning |
|---|---|
| `✅` | selected scale |
| `🎚` | available but not selected scale |
| `●` | selected variant in a choice group |
| `○` | available variant in a choice group |
| `📋` | copy what is on screen right now |
| `👁` | show every variant of every group |
| `—` | amount is not a number (`Infinity`/`NaN`), or the field is empty |

## 0. What this file demonstrates

| Feature | Where to look |
|---|---|
| Calculation mode: `id` + `calc`, the `@` operator | 1.1, 1.2 |
| Formulas without `id`, numeric literals only | 1.3 |
| Trimming spaces in names and units | 1.4 |
| An empty unit suppresses the recipe unit | 1.4, 2.1 |
| A section with no name as a visual gap | 1.5 |
| Explicit scales and `decimals` | 2.1 |
| Auto-named scales and the implicit `💯 1:1` | 2.2 |
| The first scale is selected by order | 2.3 |
| Exact restore of authored values on 1:1 | 2.3, 2.1 |
| Floating-point rounding (`1.005 → 1.01`) | 2.4 |
| `scales: []` = no scales | 2.5 |
| Choice groups, variants not next to each other | 3.1 |
| Several groups, `Variant N`, a single-variant group | 3.2 |
| The scale survives switching variants | 3.3 |
| Formulas in hidden variants | 3.4 |
| Copying and accessibility | 4 |
| Parse errors (block is not rendered) | 5 |
| Runtime errors (block is rendered) | 6 |
| Field cheat sheet | 7 |

---

# 1. Calculation mode: `id` + `calc`

In this mode, ingredients with an `id` become input fields, and ingredients with `calc` are recomputed from formulas. A single block cannot use both `scales` and `id`/`calc` — those are two different modes.

## 1.1 Minimal example: a ratio

Change "Pork" from `800` to `1000` — salt and pepper recompute on their own. `@` is per mille: `a @ b = a × b / 1000`, so `@ 20` means 20 g per 1 kg, not 20 %.

```kitchenforge
# Calculation mode: id + calc.
# The values of ids become variables available to formulas.
unit: g
sections:
  - name: 🥩 Meat
    items:
      - name: Pork
        id: pork
        value: 800          # an input field

      - name: Back fat
        id: lard
        value: 200          # an input field

  - name: 🧂 Seasoning
    items:
      - name: Salt
        calc: (pork + lard) @ 20     # 20 g per 1 kg = 2 %

      - name: Black pepper
        calc: (pork + lard) @ 1.5    # 1.5 g per 1 kg = 0.15 %
```

## 1.2 Full recipe: all operations, quotes, `round`, empty unit

Almost every calculation-mode feature is gathered here:

- numbers may be written as numbers (`200`) or as strings (`"800"`) — both are parsed as numbers;
- `+ - * / @`, parentheses and unary minus are supported;
- `unit` on an ingredient overrides the recipe unit;
- `unit: ""` removes the unit entirely;
- `round: 1` rounds the result to a whole number but never lets a non-zero value become zero;
- `decimals: 2` sets the default precision.

```kitchenforge
unit: g
decimals: 2
sections:
  - name: 🥩 Raw materials
    items:
      - name: Pork (semi-fatty)
        id: pork
        value: "800"        # a string with a number is accepted too

      - name: Back fat
        id: lard
        value: 200

      - name: Nitrite salt (input)
        id: salt
        value: 20

  - name: 🧂 Spices and additives
    items:
      - name: Nitrite salt (computed)
        calc: (pork + lard) @ 20

      - name: Black pepper
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

      - name: Salt share of the meat
        calc: salt / (pork + lard) * 100
        unit: "%"           # unit override

      - name: Packets of spice
        calc: (pork + lard) / 500
        unit: pcs
        round: 1            # to a whole number; 0.2 packets becomes 1, not 0

      - name: Batch weight without a unit
        calc: pork + lard
        unit: ""            # empty unit: "g" is not appended
```

> Try lowering "Pork" to `100`: "Packets of spice" shows `1`, not `0` — that is the guard that keeps an ingredient from vanishing under step rounding.

## 1.3 Formulas without `id`: numeric literals only

`calc` does not have to reference an `id`. If the recipe has no `id` at all, no input fields appear, but the formulas are still evaluated. Only numbers are allowed inside formulas: strings, `true`, `false` and `null` are rejected (see section 6).

```kitchenforge
unit: g
sections:
  - name: 🔢 Numbers only
    items:
      - name: Half
        calc: 100 / 2

      - name: Per mille
        calc: 1000 @ 0.5

      - name: Operator precedence
        calc: (2 + 3) * 4 - 10 / 2

      - name: Unary minus
        calc: "-5 + 10"
```

## 1.4 Trimming spaces and an empty unit

Ingredient names and units are trimmed at the edges. A unit of `""` (or a string of spaces) means "no unit" and is **not** replaced by the recipe unit. Section names are trimmed too.

```kitchenforge
unit: g
sections:
  - name: "  🥣 Dough  "       # spaces around the section name are trimmed
    items:
      - name: "  Flour  "        # spaces around the name are trimmed
        value: 500

      - name: "  Salt  "
        value: 5
        unit: "  g  "           # spaces around the unit are trimmed

      - name: Eggs
        value: 2
        unit: pcs

      - name: "  Sugar  "
        value: 50
        unit: ""                # the recipe unit is not appended
```

## 1.5 A section with no name = a visual gap

A section without `name` (or with a whitespace-only name) draws no heading. If there was content before it, an empty gap paragraph appears instead of a heading. The very first section gets no gap.

```kitchenforge
unit: g
sections:
  - name: 🥣 Dough
    items:
      - name: Flour
        value: 500

  - items:                  # no name: a visual gap
      - name: Salt
        value: 5

  - name: 🧂 Filling
    items:
      - name: Apples
        value: 300
```

---

# 2. Scaling mode: `scales`

There are no formulas here: every value is fixed, and the scale buttons multiply them by `mult`. Each click is computed from the **original** authored values, so switching scales never compounds rounding.

## 2.1 Explicit scales, `decimals`, `round` and exact 1:1

- The first scale (`Full`, `mult: 1`) is selected on open.
- On 1:1 the authored values are shown exactly: `12.345` stays `12.345` even with `decimals: 2`.
- On the other scales, values are rounded to `decimals` or to the `round` step.
- `round: 25` is a 25 g step; `round: 1` is whole pieces.
- Under `round`, a non-zero value never becomes zero.

```kitchenforge
unit: g
decimals: 2
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

      - name: Eggs
        value: 2
        unit: pcs
        round: 1            # whole pieces; 0.66 → 1

      - name: Sour cream
        value: 160

      - name: Salt
        value: 5

      - name: Exact spice
        value: 12.345       # 12.345 exactly on 1:1; 6.17 on half

  - name: 🥔 Side
    items:
      - name: Potato
        value: 150
        round: 25          # 25 g step; half → 75, third → 50

      - name: Dill
        value: 3
        unit: ""           # no unit
```

## 2.2 Auto-named scales and the implicit `💯 1:1`

If a scale has no `name`, it gets one from `mult`: `💯 1:1` for `1`, and `×2`, `×0.5`, `×1.5` for the rest. If no scale has `mult: 1`, the plugin prepends an implicit `💯 1:1` **first** — the recipe opens at the original amounts.

```kitchenforge
unit: g
scales:
  - mult: .5            # → 🎚 ×0.5
  - mult: 2             # → 🎚 ×2
sections:
  - name: 🥞 Pancakes
    items:
      - name: Milk
        value: 500

      - name: Flour
        value: 250

      - name: Eggs
        value: 2
        unit: pcs
```

## 2.3 The first scale is selected by order

The first scale in the list becomes selected, even if its `mult` is not `1`. Here "Double" is selected on open, so the values are already rounded. The "Original" button restores the exact authored values.

```kitchenforge
unit: g
decimals: 2
scales:
  - name: Double
    mult: 2
  - name: Original
    mult: 1
sections:
  - name: 🍰 Sponge
    items:
      - name: Flour
        value: 12.345       # on open: 24.69; "Original": 12.345

      - name: Sugar
        value: 100          # on open: 200; "Original": 100
```

> If you want another scale as the default while keeping 1:1 available, list that scale first and add a `mult: 1` entry after it.

## 2.4 Rounding precision: `1.005 → 1.01`

Rounding shifts the exponent, so the classic binary floating-point errors do not turn `1.005` into `1.00`.

```kitchenforge
unit: g
decimals: 2
scales:
  - name: Original
    mult: 1
  - name: Half
    mult: .5
sections:
  - name: 🔬 Precision
    items:
      - name: Sample 2.01
        value: 2.01         # half = 1.005 → 1.01

      - name: Sample 8.575
        value: 8.575        # half = 4.2875 → 4.29
```

## 2.5 `scales: []` — an empty list means "no scales"

An empty array creates no buttons and does not block calculation mode.

```kitchenforge
unit: g
scales: []
sections:
  - name: 🥗 Salad
    items:
      - name: Tomatoes
        value: 200

      - name: Cucumbers
        value: 100
```

The same empty `scales: []` does not stand in the way of `id`/`calc`:

```kitchenforge
unit: g
scales: []
sections:
  - name: 🥗 Salad
    items:
      - name: Tomatoes
        id: tomatoes
        value: 200

      - name: Cucumbers
        id: cucumbers
        value: 100

      - name: Total
        calc: tomatoes + cucumbers
```

---

# 3. Choice groups: `choice`

Sections that share a `choice` value form one variant group. The group is drawn at the position of the **first** variant, even if other sections sit between the variants. The first variant is selected on open.

## 3.1 Basic example: variants not next to each other

In the source, "Topping" sits between "Apple" and "Cherry", but on screen the group is collected at the first variant, and "Topping" ends up after it.

```kitchenforge
unit: g
sections:
  - name: 🥣 Dough
    items:
      - name: Flour
        value: 400

  - choice: Filling
    name: 🍎 Apple
    items:
      - name: Apples
        value: 500
      - name: Cinnamon
        value: 5

  - name: 🌰 Topping
    items:
      - name: Nuts
        value: 80

  - choice: Filling
    name: 🍒 Cherry
    items:
      - name: Cherries
        value: 400
      - name: Sugar
        value: 60
```

Things to check:

- the buttons `● 🍎 Apple` and `○ 🍒 Cherry`;
- the eye button next to 📋 shows every variant;
- in "all variants" mode the headings become `Filling → 🍎 Apple` and `Filling → 🍒 Cherry`;
- 📋 copies only the visible variant and keeps the group name.

## 3.2 Several groups, `Variant N` and a single-variant group

- A blank variant name (`name: ""`) and a missing `name` yield `Variant 2`, `Variant 3` — the same in buttons, headings and the copy.
- A group with a single variant is not a group: it is drawn as a normal section `Sprinkle → 🍬 Icing sugar`.
- The eye button is global for all groups in the block.

```kitchenforge
unit: g
sections:
  - choice: Filling
    name: 🍎 Apple
    items:
      - name: Apples
        value: 500

  - choice: Filling
    name: ""                 # blank name → Variant 2
    items:
      - name: Pears
        value: 450

  - choice: Filling
    # no name                # → Variant 3
    items:
      - name: Plums
        value: 400

  - choice: Glaze
    name: 🍫 Chocolate
    items:
      - name: Chocolate
        value: 100

  - choice: Glaze
    name: 🍋 Lemon
    items:
      - name: Lemon juice
        value: 40

  - choice: Sprinkle
    name: 🍬 Icing sugar
    items:
      - name: Powdered sugar
        value: 20
```

## 3.3 Choice group + scales: the scale survives a variant switch

Click "Half", then switch from apple to cherry — cherry is already halved. The scale applies to every variant, hidden ones included.

```kitchenforge
unit: g
scales:
  - name: Full
    mult: 1
  - name: Half
    mult: .5
sections:
  - name: 🥣 Dough
    items:
      - name: Flour
        value: 400

  - choice: Filling
    name: 🍎 Apple
    items:
      - name: Apples
        value: 500

  - choice: Filling
    name: 🍒 Cherry
    items:
      - name: Cherries
        value: 400
```

## 3.4 Choice group + formulas: hidden variants are computed too

An `id` is shared across the whole recipe, so it cannot be duplicated in variants. Here `flour` is declared in an ordinary section, and both filling variants use it in `calc`. The hidden variant is evaluated at render time, so switching never shows stale numbers.

```kitchenforge
unit: g
sections:
  - name: 🥣 Base
    items:
      - name: Flour
        id: flour
        value: 500

      - name: Water
        id: water
        value: 300

  - choice: Filling
    name: 🍎 Apple
    items:
      - name: Apples
        calc: flour * 0.8

      - name: Sugar
        calc: flour @ 100

  - choice: Filling
    name: 🍒 Cherry
    items:
      - name: Cherries
        calc: flour * 0.6

      - name: Sugar
        calc: flour @ 120

  - name: 🧂 Sprinkle
    items:
      - name: Salt
        calc: flour @ 5
```

---

# 4. Copying and accessibility

The 📋 button copies **what is on screen right now** as a clean Markdown list:

- values are already computed/scaled;
- hidden variants are not copied;
- the selected variant gets a `Group → Variant` heading;
- in "all variants" mode every variant is copied;
- a non-numeric or empty value is copied as `—`;
- the source YAML is never modified;
- after a successful copy the button turns into ✅ for a second.

An example of what block 3.1 copies (for the apple variant):

```text
__🥣 Dough__

 1. Flour: **400 g**

__Filling → 🍎 Apple__

 1. Apples: **500 g**
 2. Cinnamon: **5 g**

__🌰 Topping__

 1. Nuts: **80 g**
```

Accessibility:

- the copy button has `aria-label` and `title` "Copy recipe";
- the selected scale has `aria-pressed="true"`, the others `false`;
- the eye button has `aria-pressed` and a clear label;
- the status line is announced through `aria-live="polite"` and `aria-atomic="true"`;
- input fields have an `aria-label` like "Amount for …" and `step="any"`, so decimal values are not treated as invalid.

---

# 5. Parse errors

In this section the block is **not rendered**. Instead, a single paragraph with the `.kf-error` class and a prefix appears:

```text
Error parsing recipe: <message>
```

This is a static check: YAML, the section/ingredient structure, scales and precision are validated before rendering. If there is an error, there is no partial recipe.

## 5.1 YAML and structure

### Broken YAML

```kitchenforge
this is: not
  valid: yaml: ::
```

> **Expected:** `Error parsing recipe:` + the YAML parser message.

### Empty block (comment only)

```kitchenforge
# Comment only — no data.
```

> **Expected:** `Recipe must be a YAML mapping`.

### No `sections`

```kitchenforge
unit: g
decimals: 2
```

> **Expected:** `Recipe must have a 'sections' array`.

### Empty `sections: []`

```kitchenforge
unit: g
sections: []
```

> **Expected:** `Recipe must have at least one section`.

### A section is not a mapping

```kitchenforge
unit: g
sections:
  - 42
```

> **Expected:** `Section #1 must be a mapping`.

### A section has no `items`

```kitchenforge
unit: g
sections:
  - name: No ingredients
```

> **Expected:** `Section 'No ingredients' must have an 'items' array`.

### Empty `items: []`

```kitchenforge
unit: g
sections:
  - name: Empty
    items: []
```

> **Expected:** `Section 'Empty' must have at least one item`.

### An ingredient is not a mapping

```kitchenforge
unit: g
sections:
  - name: Broken
    items:
      - 5
```

> **Expected:** `Item #1 in section 'Broken' must be a mapping`.

### An ingredient has no name

```kitchenforge
unit: g
sections:
  - name: Broken
    items:
      - value: 100
```

> **Expected:** `Item #1 in section 'Broken' must have a non-empty string 'name'`.

### An ingredient name is only spaces

```kitchenforge
unit: g
sections:
  - name: Broken
    items:
      - name: "   "
        value: 100
```

> **Expected:** `Item #1 in section 'Broken' must have a non-empty string 'name'`.

### A section name is not a string

```kitchenforge
unit: g
sections:
  - name: 123
    items:
      - name: x
        value: 1
```

> **Expected:** `Section #1 name must be a string` (the message says `#1` because the name is not a string).

### `choice` is not a string

```kitchenforge
unit: g
sections:
  - name: A
    choice: 123
    items:
      - name: x
        value: 1
```

> **Expected:** `Choice group name in section 'A' must be a string`.

## 5.2 Ingredient fields

### `unit` is not a string

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        value: 1
        unit: 5
```

> **Expected:** `Item 'x' in section 'A' must have a string 'unit'`.

### `calc` is not a string

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        calc: 123
```

> **Expected:** `Item 'x' in section 'A' must have a string 'calc'`.

### `round` is not a number

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        value: 1
        round: abc
```

> **Expected:** `Item 'x' in section 'A' must have a numeric 'round'`.

### `id` is not a string

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        id: 0
        value: 1
```

> **Expected:** `Item 'x' in section 'A' must have a string 'id'`.

### An invalid `id`

`id` must be a valid variable name: no spaces or hyphens, not `true`/`false`/`null`, not `__proto__`. A hyphen would turn `olive-oil` into a subtraction, so such an id is rejected.

```kitchenforge
unit: g
sections:
  - name: A
    items:
      - name: x
        id: olive-oil
        value: 1
```

> **Expected:** `Item 'x' in section 'A' has an invalid 'id' 'olive-oil': use a valid formula variable name`.
>
> Other rejected variants: `id: "a b"`, `id: true`, `id: __proto__`, `id: "123"`.

### `id` and `calc` on the same ingredient

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

> **Expected:** `Item 'x' in section 'A' cannot have both 'id' and 'calc'`.

## 5.3 Values

### No `value` on a plain ingredient

```kitchenforge
unit: g
sections:
  - name: Broken
    items:
      - name: A
```

> **Expected:** `Item 'A' in section 'Broken' must have a numeric 'value'`.

### `value: null`

```kitchenforge
unit: g
sections:
  - name: Broken
    items:
      - name: A
        value: null
```

> **Expected:** `Item 'A' in section 'Broken' must have a numeric 'value'`.

### `value` is not a number

```kitchenforge
unit: g
sections:
  - name: Broken
    items:
      - name: A
        value: "1/2"
```

> **Expected:** `Item 'A' in section 'Broken' must have a numeric 'value'`.
>
> An empty string, `abc`, an object and an array are rejected too. A quoted number (`"800"`) is accepted.

### `id` without `value`

```kitchenforge
unit: g
sections:
  - name: Broken
    items:
      - name: A
        id: a
```

> **Expected:** `Item 'A' in section 'Broken' must have a numeric 'value'`.

## 5.4 Duplicate `id`

`id` are global variable names for the whole recipe. A duplicate is rejected even if one of them is written with spaces: ids are trimmed before comparison.

```kitchenforge
unit: g
sections:
  - name: Sauce
    items:
      - name: Salt
        id: salt
        value: 5

  - name: Dough
    items:
      - name: Salt
        id: salt
        value: 2
```

> **Expected:** `Duplicate id 'salt': 'Salt' in 'Sauce' and 'Salt' in 'Dough'`.

### A duplicate across choice variants

Variants are one recipe, so ids cannot repeat even across variants.

```kitchenforge
unit: g
sections:
  - choice: Filling
    name: Apple
    items:
      - name: Apples
        id: fruit
        value: 5

  - choice: Filling
    name: Cherry
    items:
      - name: Cherries
        id: fruit
        value: 7
```

> **Expected:** `Duplicate id 'fruit': 'Apples' in 'Apple' and 'Cherries' in 'Cherry'`.

## 5.5 Scales

### `scales` is not an array

```kitchenforge
unit: g
scales: foo
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Expected:** `Recipe 'scales' must be an array`.

### A `scales` entry is not a mapping

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

> **Expected:** `Recipe 'scales' entry #1 must be a mapping`.

### A scale `name` is not a string

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

> **Expected:** `Recipe 'scales' entry #1 'name' must be a string`.

### No `mult`

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

> **Expected:** `Recipe 'scales' entry #1 'Full' must have a positive numeric 'mult'`.

### `mult: 0` or negative

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

> **Expected:** `Recipe 'scales' entry #1 'Zero' must have a positive numeric 'mult'`.

### `mult` is not a number

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

> **Expected:** `Recipe 'scales' entry #1 'Bad' must have a positive numeric 'mult'`.

### Duplicate explicit scale names

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

> **Expected:** `Recipe 'scales' entry #2 has duplicate name 'Half' (entry #1 already uses it)`.

### Duplicate generated names

Two nameless scales with the same `mult` get the same generated name `×2` — that is a duplicate too.

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

> **Expected:** `Recipe 'scales' entry #2 has duplicate name '×2' (entry #1 already uses it)`.

### The reserved name `💯 1:1`

If no scale has `mult: 1`, the plugin adds an implicit `💯 1:1`. A user scale with that name cannot be created — otherwise two identical buttons would appear.

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

> **Expected:** `Scale name '💯 1:1' is reserved for the implicit 1:1 scale`.

## 5.6 Mixing modes and precision

### `scales` together with `id`/`calc`

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

> **Expected:** `Cannot have scales with ids/formulas specified`.
>
> One block — one mode. Remove `scales`, or remove every `id`/`calc`.

### `decimals` out of range

```kitchenforge
unit: g
decimals: 16
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Expected:** `Recipe 'decimals' must be an integer between 0 and 15`.
>
> `decimals: abc`, `decimals: 2.5` and `decimals: -1` are rejected too.

### The recipe `unit` is not a string

```kitchenforge
unit: 5
sections:
  - name: S
    items:
      - name: A
        value: 100
```

> **Expected:** `Recipe 'unit' must be a string`.

---

# 6. Runtime errors

In this section the block **is rendered**, but a `.kf-error` paragraph appears below it. Such errors do not break the whole recipe: the remaining formulas keep computing, and the message goes away once the input is fixed.

## 6.1 Unknown variable

`missing` is never declared. The error appears right at render time. At the same time, "Good formula" still computes — one broken formula does not block the others.

```kitchenforge
unit: g
sections:
  - name: 🧪 Formula error
    items:
      - name: Meat
        id: meat
        value: 100

      - name: Salt
        calc: missing * 2          # error: the variable does not exist

      - name: Good formula
        calc: meat * 2             # computed independently: 200
```

> **Expected:** `Formula error: Unknown variable: missing`.
>
> The "Salt" field stays empty, "Good formula" shows `200`.
>
> If you now click 📋, the copy succeeds while the formula error stays in place — a successful copy must not hide unrelated errors.

## 6.2 Unsupported operator

Only `+ - * / @` are supported. Any other operator (`%`, `^`, `**`, etc.) raises a runtime error.

```kitchenforge
unit: g
sections:
  - name: 🧪 Operator %
    items:
      - name: Meat
        id: meat
        value: 100

      - name: Remainder
        calc: meat % 3
```

> **Expected:** `Formula error: Unsupported operator: %`.

## 6.3 A non-numeric literal

Only numbers are allowed inside formulas. Strings, `true`/`false` and `null` are not silently coerced to a number — that is an error.

```kitchenforge
unit: g
sections:
  - name: 🧪 String literal
    items:
      - name: String
        calc: "'abc' + 1"
```

> **Expected:** `Formula error: Unsupported literal: abc`.

```kitchenforge
unit: g
sections:
  - name: 🧪 Boolean literal
    items:
      - name: Boolean
        calc: "true + 1"
```

> **Expected:** `Formula error: Unsupported literal: true`.

## 6.4 Division by zero: not an error, but `—`

`Infinity` and `NaN` are not treated as a formula error: the value is simply shown as `—` and copied the same way. Change the divisor to `2` to get `5`.

```kitchenforge
unit: g
sections:
  - name: 🧪 Division by zero
    items:
      - name: Divisor
        id: zero
        value: 0

      - name: Result
        calc: 10 / zero            # Infinity → "—"
```

> **Expected:** the result field shows `—`, with no error message.
>
> The copy shows `—` too. This is done so `Infinity`/`NaN` never reach the clipboard.

## 6.5 Empty input

If you clear an `id` field, the recipe simply has no value for it — it is kept as "not set" instead of becoming `0`. The dependent amounts show `—`, the field is highlighted, and a calm hint lists what still needs a value. Type a number back and the highlight and hint disappear and the amounts return. (A real typo in a formula is still a red `Formula error:` — see 6.1.)

```kitchenforge
unit: g
sections:
  - name: 🧪 Clear the "Meat" field
    items:
      - name: Meat
        id: meat
        value: 100

      - name: Salt
        calc: meat @ 20
```

> **Expected after clearing the field:** the "Salt" field shows `—`, the "Meat" input is highlighted, and the hint `Enter a value for “Meat”` appears — not a formula error.
>
> After typing `500`: salt `10`, and the highlight and hint disappear.

## 6.6 A broken hidden variant does not break the visible one

Formulas are evaluated in every variant, hidden ones included. A broken formula in the first variant does not stop the second: switch to "Working" and you will see `2`. The error stays because the broken formula is still there.

```kitchenforge
unit: g
sections:
  - choice: Filling
    name: Broken
    items:
      - name: Error
        calc: missing * 2

  - choice: Filling
    name: Working
    items:
      - name: Norm
        calc: 1 + 1
```

> **Expected:** `Formula error: Unknown variable: missing`; the second variant shows `2`.

## 6.7 Errors that a recipe cannot trigger

Some messages appear only on interaction or when the environment fails. It helps to know them:

| Message | When it appears | What the plugin does |
|---|---|---|
| `Scale failed: …` | an error while applying a scale | the scale is not applied, the ✅ stays on the previous scale, the button becomes active again |
| `Copy failed: …` | the browser blocked clipboard access | shows a copy error, the recipe is unchanged |
| `Formula error: …` | an error while recomputing after input | clears only the broken values, keeps the other formulas computed |
| `Enter a value for ...` | an `id` field is empty | keeps it as "not set": dependent amounts show `—` and the field is highlighted (not an error) |
| `—` | `Infinity`/`NaN` or an empty field | shows a dash in the UI and in the copy |

---

# 7. Field cheat sheet

| Field | Level | Required | What it does |
|---|---|---|---|
| `unit` | recipe | no | Default unit; `g` by default. Display only, no conversion. |
| `decimals` | recipe | no | Decimal places for computed and scaled amounts; integer `0…15`, `2` by default. |
| `scales[]` | recipe | no | List of `{name?, mult}`. Incompatible with `id`/`calc`. An empty list means no scales. |
| `sections[]` | recipe | **yes** | A non-empty list of sections. |
| `choice` | section | no | Choice-group label. Sections with the same `choice` form one group. |
| `name` | section | no | Heading; a blank name is a visual gap. On a variant it is the button label. |
| `items[]` | section | **yes** | A non-empty list of ingredients. |
| `name` | ingredient | **yes** | A non-empty string; trimmed. |
| `value` | ingredient | yes, unless `calc` | A number or numeric string. Ignored when `calc` is present (but validated when given). |
| `unit` | ingredient | no | Overrides the recipe unit. `""` removes the unit. Trimmed. |
| `id` | ingredient | no | A formula variable name. Unique across the whole recipe. Requires `value`. |
| `calc` | ingredient | no | A formula: `+ - * / @`, parentheses, unary minus. Used instead of `value`. |
| `round` | ingredient | no | A rounding step for computed/scaled amounts. A non-zero value never becomes zero. |

Formulas:

```text
a + b      addition
a - b      subtraction
a * b      multiplication
a / b      division
a @ b      per mille: a × b / 1000
( ... )    grouping
-a         unary minus
```

---

# 8. Quick checklist of today's fixes

| Fix | Demonstration |
|---|---|
| 1:1 restores exact authored values | 2.3, 2.1 |
| Clean amount formatting (`—` instead of `Infinity`/`NaN`) | 6.4 |
| An empty ingredient unit suppresses the recipe unit | 1.4, 2.1 |
| Duplicate scale names are rejected | 5.5 |
| Empty `sections`/`items` are rejected | 5.1 |
| Names and units are trimmed | 1.4 |
| Formulas accept numeric literals only | 6.3 |
| The scale selection is kept on failure | 6.7 |
| Formula errors survive a successful copy | 6.1 |
| A non-numeric `value` on a plain ingredient is an error | 5.3 |
| Rounding on the first render is described accurately | 2.3 |
| Auto-named scales and the implicit 1:1 | 2.2 |