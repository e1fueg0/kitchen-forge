import {ButtonComponent, MarkdownPostProcessorContext, TextComponent} from 'obsidian';
import YAML from "yaml";
import {Vars} from "./calc";
import {
	applyScale,
	CalcBinding,
	formatRecipeToMarkdown,
	MultBinding,
	recalcCalcBindings,
	Recipe,
} from "./recipe";

export function processKitchenForgeBlock(source: string, el: HTMLElement, _: MarkdownPostProcessorContext): void {
	try {
		const recipe = YAML.parse(source) as Recipe | null;
		if (recipe == null || typeof recipe !== "object")
			throw new Error("Recipe must be a YAML mapping");
		if (!Array.isArray(recipe.sections))
			throw new Error("Recipe must have a 'sections' array");
		if (recipe.decimals == null)
			recipe.decimals = 2;
		const decimals = recipe.decimals;
		if (recipe.unit == null)
			recipe.unit = "g";
		const unit = recipe.unit;

		const vars: Vars = {};
		const calcBindings: CalcBinding[] = [];
		const multBindings: MultBinding[] = [];

		let calcNo = 0;
		for (const section of recipe.sections) {
			for (const item of section.items) {
				if (item.id && item.value != null) {
					vars[item.id] = item.value;
				}
				if (item.calc || item.id)
					calcNo++;
			}
		}

		const blockEl = el.createDiv({cls: "kf-block"});

		const copyCmp = new ButtonComponent(blockEl);
		const copyLabel = "📋";
		copyCmp.setButtonText(copyLabel);
		copyCmp.onClick(async () => {
			await navigator.clipboard.writeText(formatRecipeToMarkdown(recipe));

			copyCmp.setButtonText("✅");
			copyCmp.setDisabled(true);

			setTimeout(() => {
				copyCmp.setButtonText(copyLabel);
				copyCmp.setDisabled(false);
			}, 1000);
		});

		if (recipe.scales) {
			if (calcNo > 0)
				throw new Error("Cannot have scales with ids/formulas specified");
			const btnBlockEl = blockEl.createDiv({cls: "kf-scale-block"});
			btnBlockEl.createSpan({text: "📏 "});
			for (const scale of recipe.scales) {
				const scaleCmp = new ButtonComponent(btnBlockEl);
				scaleCmp.setButtonText("🎚 ️" + scale.name);
				scaleCmp.onClick(async () => {
					const old = scaleCmp.buttonEl.textContent;
					scaleCmp.setButtonText("✅" + scale.name);
					scaleCmp.setDisabled(true);

					applyScale(multBindings, scale.mult, decimals);

					setTimeout(() => {
						scaleCmp.setButtonText(old ?? "");
						scaleCmp.setDisabled(false);
					}, 1000);
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
						const nValue = Number(value);
						vars[id] = nValue;
						item.value = nValue;
						recalcCalcBindings(calcBindings, vars, decimals);
					});
				}

				bEl.createEl('span', {text: ` ${item.unit}`});
			}
		}

		// Evaluate all calc bindings once everything is wired up.
		recalcCalcBindings(calcBindings, vars, decimals);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		el.createEl('p', {text: 'Error parsing recipe: ' + message, cls: "kf-error"});
		return;
	}
}
