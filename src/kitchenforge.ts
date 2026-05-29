import {ButtonComponent, MarkdownPostProcessorContext, TextComponent} from 'obsidian';
import YAML from "yaml";
import {Vars} from "./calc";
import {
	applyScale,
	CalcBinding,
	formatRecipeToMarkdown,
	MultBinding,
	prefillVars,
	recalcCalcBindings,
	Recipe,
	Scale,
} from "./recipe";

const SCALE_PREFIX = "🎚 ️";
const SELECTED_PREFIX = "✅";

function reportError(el: HTMLElement, message: string) {
	el.createEl('p', {text: 'Error parsing recipe: ' + message, cls: "kf-error"});
}

export function processKitchenForgeBlock(source: string, el: HTMLElement, _: MarkdownPostProcessorContext): void {
	let recipe: Recipe | null;
	try {
		recipe = YAML.parse(source) as Recipe | null;
	} catch (e) {
		reportError(el, e instanceof Error ? e.message : String(e));
		return;
	}

	if (recipe == null || typeof recipe !== "object") {
		reportError(el, "Recipe must be a YAML mapping");
		return;
	}
	if (!Array.isArray(recipe.sections)) {
		reportError(el, "Recipe must have a 'sections' array");
		return;
	}
	for (const section of recipe.sections) {
		if (!Array.isArray(section.items)) {
			reportError(el, `Section '${section.name}' must have an 'items' array`);
			return;
		}
	}

	if (recipe.decimals == null)
		recipe.decimals = 2;
	const decimals = recipe.decimals;
	if (recipe.unit == null)
		recipe.unit = "g";
	const unit = recipe.unit;

	const vars: Vars = {};
	const calcBindings: CalcBinding[] = [];
	const multBindings: MultBinding[] = [];

	const hasIdsOrCalcs = prefillVars(recipe, vars);

	const blockEl = el.createDiv({cls: "kf-block"});

	const copyCmp = new ButtonComponent(blockEl);
	const copyLabel = "📋";
	copyCmp.setButtonText(copyLabel);
	copyCmp.onClick(async () => {
		try {
			await navigator.clipboard.writeText(formatRecipeToMarkdown(recipe));

			copyCmp.setButtonText("✅");
			copyCmp.setDisabled(true);

			setTimeout(() => {
				copyCmp.setButtonText(copyLabel);
				copyCmp.setDisabled(false);
			}, 1000);
		} catch (e) {
			reportError(el, "Copy failed: " + (e instanceof Error ? e.message : String(e)));
		}
	});

	if (recipe.scales) {
		if (hasIdsOrCalcs) {
			reportError(el, "Cannot have scales with ids/formulas specified");
			return;
		}
		const btnBlockEl = blockEl.createDiv({cls: "kf-scale-block"});
		btnBlockEl.createSpan({text: "📏 "});
		const scaleButtons: {cmp: ButtonComponent; scale: Scale}[] = [];
		for (const scale of recipe.scales) {
			const scaleCmp = new ButtonComponent(btnBlockEl);
			scaleCmp.setButtonText((scale.mult === 1 ? SELECTED_PREFIX : SCALE_PREFIX) + scale.name);
			scaleButtons.push({cmp: scaleCmp, scale});
			scaleCmp.onClick(async () => {
				try {
					for (const entry of scaleButtons) {
						const prefix = entry.scale === scale ? SELECTED_PREFIX : SCALE_PREFIX;
						entry.cmp.setButtonText(prefix + entry.scale.name);
					}
					scaleCmp.setDisabled(true);

					applyScale(multBindings, scale.mult, decimals);

					setTimeout(() => {
						scaleCmp.setDisabled(false);
					}, 1000);
				} catch (e) {
					reportError(el, "Scale failed: " + (e instanceof Error ? e.message : String(e)));
				}
			});
		}
	}

	for (const section of recipe.sections) {
		blockEl.createEl('h3', {text: section.name});
		const listEl = blockEl.createEl('ol');
		for (const item of section.items) {
			const itemEl = listEl.createEl('li');
			itemEl.createSpan({text: `${item.name}: `});
			const bEl = itemEl.createEl('b');

			if (!item.unit)
				item.unit = unit;
			if (item.calc) {
				const valueEl = bEl.createSpan({text: ""});
				calcBindings.push({expr: item.calc, el: valueEl, item: item});
			} else if (!item.id) {
				const valueEl = bEl.createSpan({text: `${(item.value)}`});
				multBindings.push({origValue: item.value ?? 0, el: valueEl, item: item});
			} else {
				const id = item.id;
				const input = new TextComponent(bEl);
				input.inputEl.type = "number";
				input.inputEl.addClass("kf-input");
				input.setValue(`${(item.value)}`);
				input.onChange(value => {
					try {
						const nValue = Number(value);
						vars[id] = nValue;
						item.value = nValue;
						recalcCalcBindings(calcBindings, vars, decimals);
					} catch (e) {
						reportError(el, "Formula error: " + (e instanceof Error ? e.message : String(e)));
					}
				});
			}

			bEl.createEl('span', {text: ` ${item.unit}`});
		}
	}

	// Evaluate all calc bindings once everything is wired up.
	try {
		recalcCalcBindings(calcBindings, vars, decimals);
	} catch (e) {
		reportError(el, "Formula error: " + (e instanceof Error ? e.message : String(e)));
	}
}
