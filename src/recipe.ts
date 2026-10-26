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
	 * Optional choice-group label. Consecutive sections with the same value are
	 * rendered as variants of one group; an interrupted run starts a new group.
	 */
	choice?: string;
	items: Ingredient[];
};

// A recipe is rendered as an ordered list of blocks: standalone sections and
// groups of consecutive sections that share a `choice` name. The same `choice`
// appears twice in the source, separated by a plain section, produces two
// independent groups.
export type SectionGroup =
	| { kind: "section"; section: Section }
	| { kind: "choice"; title: string; variants: Section[] };

function choiceTitle(section: Section): string | null {
	const raw = section.choice;
	if (typeof raw !== "string") return null;
	const title = raw.trim();
	return title.length > 0 ? title : null;
}

// Sections inside a choice group are addressed as "Group → Variant". The
// composite name is used in copied Markdown and in show-all headings, where
// the group label is no longer visible next to the section.
export function sectionDisplayName(name: string, choice?: string): string {
	const group = typeof choice === "string" ? choice.trim() : "";
	if (group.length === 0) return name;
	const variant = name?.trim() ?? "";
	return variant.length > 0 ? `${group} → ${variant}` : group;
}

export function groupSections(sections: Section[]): SectionGroup[] {
	const groups: SectionGroup[] = [];
	let index = 0;

	while (index < sections.length) {
		const section = sections[index]!;
		const title = choiceTitle(section);

		if (title == null) {
			groups.push({kind: "section", section});
			index += 1;
			continue;
		}

		const variants = [section];
		let next = index + 1;
		while (next < sections.length && choiceTitle(sections[next]!) === title) {
			variants.push(sections[next]!);
			next += 1;
		}

		groups.push({kind: "choice", title, variants});
		index = next;
	}

	return groups;
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
