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
	/** Visible section heading. For a choice variant this is the variant label. */
	name: string;
	/**
	 * Optional choice-group label. Sections with the same value are collected
	 * into one group, rendered where the first such section appears.
	 */
	choice?: string;
	items: Ingredient[];
};

// A recipe is rendered as an ordered list of blocks: standalone sections and
// choice groups. All sections with the same `choice` value belong to one group,
// even when other sections separate them; the group is rendered at the
// position of its first variant.
export type SectionGroup =
	| { kind: "section"; section: Section }
	| { kind: "choice"; title: string; variants: Section[] };

// YAML values are untyped, so names and choice labels must be checked at
// runtime instead of trusting the TypeScript declarations.
function normalizedText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function choiceTitle(section: Section): string | null {
	const title = normalizedText(section.choice);
	return title.length > 0 ? title : null;
}

// Variants without a usable name still need a label: the UI, copied Markdown
// and show-all headings all use this fallback.
export function variantName(name: unknown, index: number): string {
	const label = normalizedText(name);
	return label.length > 0 ? label : `Variant ${index + 1}`;
}

// Sections inside a choice group are addressed as "Group → Variant". The
// composite name is used in copied Markdown and in show-all headings, where
// the group label is no longer visible next to the section.
export function sectionDisplayName(name: unknown, choice?: unknown): string {
	const group = normalizedText(choice);
	if (group.length === 0)
		return typeof name === "string" ? name : "";
	const variant = normalizedText(name);
	return variant.length > 0 ? `${group} → ${variant}` : group;
}

export function groupSections(sections: Section[]): SectionGroup[] {
	const groups: SectionGroup[] = [];
	const groupsByTitle = new Map<string, { kind: "choice"; title: string; variants: Section[] }>();

	for (const section of sections) {
		const title = choiceTitle(section);

		if (title == null) {
			groups.push({kind: "section", section});
			continue;
		}

		let group = groupsByTitle.get(title);
		if (group == null) {
			group = {kind: "choice", title, variants: []};
			groupsByTitle.set(title, group);
			groups.push(group);
		}
		group.variants.push(section);
	}

	// A one-variant group is not a choice at all: render it as a normal section
	// with the composite "Group → Variant" heading. This also lets the renderer
	// skip the show-all toggle when no real choice groups remain.
	return groups.map((group): SectionGroup => {
		if (group.kind !== "choice")
			return group;

		// Normalize variant labels once, so the buttons, headings and copied
		// Markdown all agree on the same fallback for blank names.
		const variants = group.variants.map((variant, index): Section => ({
			...variant,
			name: variantName(variant.name, index),
		}));

		if (variants.length !== 1)
			return {kind: "choice", title: group.title, variants};

		const variant = variants[0]!;
		return {
			kind: "section",
			section: {
				...variant,
				name: sectionDisplayName(variant.name, group.title),
				choice: undefined,
			},
		};
	});
}

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

export function formatSectionsToMarkdown(sections: Section[]): string {
	const lines: string[] = [];
	for (const section of sections) {
		const title = sectionDisplayName(section.name, section.choice);
		if (title) {
			lines.push(`__${title}__`);
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

export function formatRecipeToMarkdown(recipe: Recipe): string {
	return formatSectionsToMarkdown(recipe.sections);
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
