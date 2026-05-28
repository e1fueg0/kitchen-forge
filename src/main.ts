import {ButtonComponent, Plugin, TextComponent} from 'obsidian';
import YAML from "yaml";
import jsep from "jsep";
import {DEFAULT_SETTINGS, MyPluginSettings} from "./settings";

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
	unit: string;
	decimals: number;
	scales: Scale[];
	sections: Section[];
};

type Vars = Record<string, number>;

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

function round(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

export default class HelloWorldPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		jsep.addBinaryOp('@', 10);
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor('kitchenforge', (source, el, ctx) => {
			const recipe = YAML.parse(source) as Recipe;
			if (recipe.decimals == null)
				recipe.decimals = 2;
			if (recipe.unit == null)
				recipe.unit = "g";

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

				const blockEl = el.createDiv({ cls: "kf-block" });

				const copyCmp = new ButtonComponent(blockEl)
				copyCmp.setButtonText("Copy")
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

					const old = copyCmp.buttonEl.textContent;
					copyCmp.setButtonText("Copied ✓");
					copyCmp.setDisabled(true);

					setTimeout(() => {
						copyCmp.setButtonText(old ?? "Copy");
						copyCmp.setDisabled(false);
					}, 1000);
				})

				if (recipe.scales) {
					if (calcNo > 0)
						throw new Error("Cannot have scales with ids/formulas specified");
					const btnBlockEl = blockEl.createEl("p");
					for (const scale of recipe.scales) {
						const scaleCmp = new ButtonComponent(btnBlockEl)
						scaleCmp.setButtonText(scale.name);
						scaleCmp.onClick(async () => {
							const old = scaleCmp.buttonEl.textContent;
							scaleCmp.setButtonText("Set " + scale.name);
							scaleCmp.setDisabled(true);

							for (const binding of multBindings) {
								const calculated = round(binding.origValue * scale.mult, recipe.decimals);
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
							item.unit = recipe.unit;
						if (item.calc) {
							item.value = round(evaluate(jsep(item.calc), vars), recipe.decimals);
							const valueEl = bEl.createSpan({text: String(item.value)});
							calcBindings.push({expr: item.calc, el: valueEl, item: item});
						} else if (!item.id) {
							const valueEl = bEl.createSpan({text: `${(item.value)}`});
							multBindings.push({origValue: item.value ?? 0, el: valueEl, item: item});
						} else {
							const input = new TextComponent(bEl);
							input.inputEl.type = "number";
							input.setValue(`${(item.value)}`);
							input.inputEl.setCssProps({"width": "10ch"});
							input.onChange(value => {
								let nValue = Number(value);
								vars[item.id] = nValue;
								item.value = nValue;
								for (const binding of calcBindings) {
									const calculated = round(evaluate(jsep(binding.expr), vars), recipe.decimals);
									binding.el.setText(`${calculated}`);
									binding.item.value = calculated;
								}
							});
						}

						bEl.createEl('span', {text: ` ${item.unit}`});
					}
				}
			} catch (e) {
				el.createEl('p', {text: 'Error parsing recipe: ' + e.message, cls: "kf-error"});
				return;
			}
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function evaluate(node: jsep.Expression, vars: Vars): number {
	switch (node.type) {

		case "Literal":
			return Number(node.value);

		case "Identifier": {
			const value = vars[node.name];

			if (value == null) {
				throw new Error(`Unknown variable: ${node.name}`);
			}

			return value;
		}

		case "BinaryExpression": {
			const left = evaluate(node.left, vars);
			const right = evaluate(node.right, vars);

			let result;
			switch (node.operator) {
				case "+":
					result = left + right;
					break;

				case "-":
					result = left - right;
					break;

				case "*":
					result = left * right;
					break;

				case "/":
					result = left / right;
					break;

				case "@":
					result = left * right / 1000;
					break;

				default:
					throw new Error(`Unsupported operator: ${node.operator}`);
			}
			return result;
		}

		default:
			throw new Error(`Unsupported node type: ${node.type}`);
	}
}
