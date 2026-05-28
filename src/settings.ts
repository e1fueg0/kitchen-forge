import {App, PluginSettingTab, Setting} from "obsidian";
import KitchenForgePlugin from "./main";

export interface KitchenForgeSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: KitchenForgeSettings = {
	mySetting: 'default'
}

export class KitchenForgeSettingTab extends PluginSettingTab {
	plugin: KitchenForgePlugin;

	constructor(app: App, plugin: KitchenForgePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
