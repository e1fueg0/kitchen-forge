import {App, ButtonComponent, Editor, MarkdownView, Modal, Notice, Plugin, TextComponent} from 'obsidian';
import YAML from "yaml";
import jsep from "jsep";
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab} from "./settings";

// Remember to rename these classes and interfaces!

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

type Recipe = {
	unit: string;
	sections: Section[];
};

type Vars = Record<string, number>;

type CalcBinding = {
	expr: string;
	el: HTMLElement;
	item: Ingredient;
};

export default class HelloWorldPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		jsep.addBinaryOp('@', 10);
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor('kitchenforge', (source, el, ctx) => {
			const recipe = YAML.parse(source) as Recipe;

			const vars: Vars = {};
			const bindings: CalcBinding[] = [];

			try {
				for (const section of recipe.sections) {
					for (const item of section.items) {
						if (item.id && item.value != null) {
							vars[item.id] = item.value;
						}
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

				for (const section of recipe.sections) {
					blockEl.createEl('h3', {text: section.name});
					const listEl = blockEl.createEl('ol');
					for (const item of section.items) {
						const itemEl = listEl.createEl('li');
						itemEl.createSpan({text: `${item.name}: `});
						const bEl = itemEl.createEl('b');

						if (!item.unit)
							item.unit = recipe.unit;
						let value: number | undefined;
						let expr = item.calc;
						if (expr) {
							value = evaluate(jsep(expr), vars);
							item.value = value;
							const valueEl = bEl.createSpan({text: String(value)});
							bindings.push({expr: expr, el: valueEl, item: item});
						} else if (!item.id) {
							value = item.value;
							bEl.createSpan({text: `${value}`});
						} else {
							value = item.value;
							const input = new TextComponent(bEl);
							input.inputEl.type = "number";
							input.setValue(`${value}`);
							input.inputEl.setCssProps({"width": "10ch"});
							input.onChange(value => {
								let nValue = Number(value);
								vars[item.id] = nValue;
								item.value = nValue;
								for (const binding of bindings) {
									const calculated = evaluate(jsep(binding.expr), vars);
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
			return round2(result);
		}

		default:
			throw new Error(`Unsupported node type: ${node.type}`);
	}

	function round2(n: number): number {
		return Math.round(n * 100) / 100;
	}
}
