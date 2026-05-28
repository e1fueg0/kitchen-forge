import {ButtonComponent, MarkdownPostProcessorContext, TextComponent} from 'obsidian';
import YAML from "yaml";
import jsep from "jsep";
import {evaluate, round, Vars} from "./calc";

type Ingredient = {
	name: string;
	id?: string;
	value?: number;
	calc?: string;
	unit?: string;
};

type Section = {
	name: string;
	items: Ingredient[];
};

type Scale = {
	name: string;
	mult: number;
};

type Recipe = {
	unit?: string;
	decimals?: number;
	scales: Scale[];
	sections: Section[];
};

type CalcBinding = {
	expr: string;
	el: HTMLElement;
	item: Ingredient;
};

type MultBinding = {
	origValue: number;
	el: HTMLElement;
	item: Ingredient;
};

export function processKitchenForgeBlock(source: string, el: HTMLElement, _: MarkdownPostProcessorContext): void {
	const recipe = YAML.parse(source) as Recipe;
	if (recipe.decimals == null)
		recipe.decimals = 2;
	let decimals = recipe.decimals;
	if (recipe.unit == null)
		recipe.unit = "g";
	let unit = recipe.unit;

	const vars: Vars = {};
	const calcBindings: CalcBinding[] = [];
	const multBindings: MultBinding[] = [];

	try {
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

		const copyCmp = new ButtonComponent(blockEl)
		let name = "📋";
		copyCmp.setButtonText(name)
		copyCmp.onClick(async () => {
			const lines: string[] = [];

			for (const section of recipe.sections) {
				lines.push(`__${section.name}__`);
				lines.push('');
				let no = 1;
				for (let item of section.items) {
					lines.push(` ${no++}. ${item.name}: **${item.value} ${item.unit}**`)
				}
				lines.push('');
			}

			const text = lines.join("\n");
			await navigator.clipboard.writeText(text);

			copyCmp.setButtonText("✅");
			copyCmp.setDisabled(true);

			setTimeout(() => {
				copyCmp.setButtonText(name);
				copyCmp.setDisabled(false);
			}, 1000);
		})

		if (recipe.scales) {
			if (calcNo > 0)
				throw new Error("Cannot have scales with ids/formulas specified");
			const btnBlockEl = blockEl.createDiv({cls: "kf-scale-block"});
			btnBlockEl.createSpan({text: "📏 "});
			for (const scale of recipe.scales) {
				const scaleCmp = new ButtonComponent(btnBlockEl)
				scaleCmp.setButtonText("🎚 ️" + scale.name);
				scaleCmp.onClick(async () => {
					const old = scaleCmp.buttonEl.textContent;
					scaleCmp.setButtonText("✅" + scale.name);
					scaleCmp.setDisabled(true);

					for (const binding of multBindings) {
						const calculated = round(binding.origValue * scale.mult, decimals);
						binding.el.setText(`${calculated}`);
						binding.item.value = calculated;
					}

					setTimeout(() => {
						scaleCmp.setButtonText(old ?? "");
						scaleCmp.setDisabled(false);
					}, 1000);
				})

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
					item.value = round(evaluate(jsep(item.calc), vars), decimals);
					const valueEl = bEl.createSpan({text: String(item.value)});
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
						let nValue = Number(value);
						vars[id] = nValue;
						item.value = nValue;
						for (const binding of calcBindings) {
							const calculated = round(evaluate(jsep(binding.expr), vars), decimals);
							binding.el.setText(`${calculated}`);
							binding.item.value = calculated;
						}
					});
				}

				bEl.createEl('span', {text: ` ${item.unit}`});
			}
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		el.createEl('p', {text: 'Error parsing recipe: ' + message, cls: "kf-error"});
		return;
	}
}
