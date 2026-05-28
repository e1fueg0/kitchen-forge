import {Plugin} from 'obsidian';
import jsep from "jsep";
import {DEFAULT_SETTINGS, KitchenForgeSettings} from "./settings";
import {processKitchenForgeBlock} from "./kitchenforge";

export default class KitchenForgePlugin extends Plugin {
	settings: KitchenForgeSettings;

	async onload() {
		jsep.addBinaryOp('@', 10);
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor('kitchenforge', processKitchenForgeBlock);
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<KitchenForgeSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
