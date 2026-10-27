import jsep from "jsep";
import {evaluate, round, roundToStep, Vars} from "./calc";

export type Ingredient = {
	name: string;
	/** Formula variable name. Must be unique across the whole recipe. */
	id?: string;
	value?: number;
	calc?: string;
	unit?: string;
	round?: number;
};

export type Section = {
	name: string;
	items: Ingredient[];
};

export type Scale = {
	name: string;
	mult: number;
};

export type Recipe = {
	unit?: string;
	decimals?: number;
	scales: Scale[];
	sections: Section[];
};

// Minimal element interface so helpers don't depend on the full HTMLElement type
// (and so tests can pass stubs without happy-dom + obsidian DOM polyfills).
// HTMLElement structurally satisfies this once Obsidian's setText extension is loaded.
export type SetTextEl = { setText(text: string): void };

export type CalcBinding = {
	expr: string;
	el: SetTextEl;
	item: Ingredient;
};

export type MultBinding = {
	origValue: number;
	el: SetTextEl;
	item: Ingredient;
};

export function formatRecipeToMarkdown(recipe: Recipe): string {
	const lines: string[] = [];
	for (const section of recipe.sections) {
		if (section.name) {
			lines.push(`__${section.name}__`);
			lines.push("");
		} else if (lines.length > 0) {
			lines.push("&nbsp;");   // пустой абзац: отступ + разрыв нумерации
			lines.push("");
		}
		let no = 1;
		for (const item of section.items) {
			lines.push(` ${no++}. ${item.name}: **${item.value} ${item.unit}**`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

// Round a computed amount, honoring a per-item `round` step when present and
// otherwise falling back to the recipe-wide decimal precision.
function roundForItem(value: number, item: Ingredient, decimals: number): number {
	return item.round != null ? roundToStep(value, item.round, decimals) : round(value, decimals);
}

export function applyScale(bindings: MultBinding[], mult: number, decimals: number): void {
	for (const binding of bindings) {
		const calculated = roundForItem(binding.origValue * mult, binding.item, decimals);
		binding.el.setText(`${calculated}`);
		binding.item.value = calculated;
	}
}

export function recalcCalcBindings(bindings: CalcBinding[], vars: Vars, decimals: number): void {
	for (const binding of bindings) {
		const calculated = roundForItem(evaluate(jsep(binding.expr), vars), binding.item, decimals);
		binding.el.setText(`${calculated}`);
		binding.item.value = calculated;
	}
}

export type IdLocation = {
	section: Section;
	item: Ingredient;
};

export type DuplicateId = {
	id: string;
	first: IdLocation;
	second: IdLocation;
};

// IDs become keys in the shared `vars` object, so duplicates would silently
// make two inputs write to the same formula variable.
export function findDuplicateId(recipe: Recipe): DuplicateId | null {
	const seen = new Map<string, IdLocation>();
	for (const section of recipe.sections) {
		for (const item of section.items) {
			if (!item.id) continue;
			const id = String(item.id);
			const first = seen.get(id);
			if (first)
				return {id, first, second: {section, item}};
			seen.set(id, {section, item});
		}
	}
	return null;
}

export function prefillVars(recipe: Recipe, vars: Vars): boolean {
	let hasIdsOrCalcs = false;
	for (const section of recipe.sections) {
		for (const item of section.items) {
			if (item.id && item.value != null) {
				vars[item.id] = item.value;
			}
			if (item.calc || item.id)
				hasIdsOrCalcs = true;
		}
	}
	return hasIdsOrCalcs;
}
