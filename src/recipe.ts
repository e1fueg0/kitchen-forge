import jsep from "jsep";
import {evaluate, round, Vars} from "./calc";

export type Ingredient = {
	name: string;
	id?: string;
	value?: number;
	calc?: string;
	unit?: string;
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
		lines.push(`__${section.name}__`);
		lines.push("");
		let no = 1;
		for (const item of section.items) {
			lines.push(` ${no++}. ${item.name}: **${item.value} ${item.unit}**`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

export function applyScale(bindings: MultBinding[], mult: number, decimals: number): void {
	for (const binding of bindings) {
		const calculated = round(binding.origValue * mult, decimals);
		binding.el.setText(`${calculated}`);
		binding.item.value = calculated;
	}
}

export function recalcCalcBindings(bindings: CalcBinding[], vars: Vars, decimals: number): void {
	for (const binding of bindings) {
		const calculated = round(evaluate(jsep(binding.expr), vars), decimals);
		binding.el.setText(`${calculated}`);
		binding.item.value = calculated;
	}
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
