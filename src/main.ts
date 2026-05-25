import {App, Editor, MarkdownView, Modal, Notice, Plugin, TextComponent} from 'obsidian';
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
};

export default class HelloWorldPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		jsep.addBinaryOp('@', 10);
		await this.loadSettings();

		// // This creates an icon in the left ribbon.
		// this.addRibbonIcon('dice', 'Sample', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('This is a notice!');
		// });
		// this.addRibbonIcon('dice', 'Greet', () => {
		// 	new Notice('Hello, world!');
		// });
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
				for (const section of recipe.sections) {
					blockEl.createEl('h3', {text: section.name});
					const listEl = blockEl.createEl('ol');
					for (const item of section.items) {
						const itemEl = listEl.createEl('li');
						itemEl.createSpan({text: `${item.name}: `});
						const bEl = itemEl.createEl('b');

						const unit = item.unit ? item.unit : recipe.unit;
						let value: number | undefined;
						let expr = item.calc;
						if (expr) {
							value = evaluate(jsep(expr), vars);
							const valueEl = bEl.createSpan({text: String(value)});
							bindings.push({expr: expr, el: valueEl});
						} else if (!item.id) {
							value = item.value;
							bEl.createSpan({text: `${value}`});
						} else {
							value = item.value;
							const input = new TextComponent(bEl);
							input.inputEl.type = "number";
							input.setValue(`${value}`);
							input.inputEl.style.width = "10ch";
							input.onChange(value => {
								console.log(`Calc: ${item.id} -> ${value}`);
								vars[item.id] = Number(value);
								console.log(" !! " + JSON.stringify(vars));
								for (const binding of bindings) {
									const calculated = evaluate(jsep(binding.expr), vars);
									console.log(` !! ${binding.expr} -> ${calculated}`);
									console.log("EXPR", binding.expr);
									console.log("AST", jsep(binding.expr));
									console.log("VARS", vars);
									binding.el.setText(`${calculated}`);
								}
							});
						}

						bEl.createEl('span', {text: ` ${unit}`});
					}
				}
			} catch (e) {
				el.createEl('p', {text: 'Error parsing recipe: ' + e.message});
				return;
			}
		});
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-modal-simple',
			name: 'Open modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample editor command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	new Notice("Click");
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
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
