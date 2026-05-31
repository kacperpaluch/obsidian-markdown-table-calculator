import {App, PluginSettingTab, Setting} from "obsidian";
import type MarkdownTableCalculatorPlugin from "./main";

export interface MarkdownTableCalculatorSettings {
	autoUpdate: boolean;
	debounceMs: number;
	decimalPlaces: number;
	decimalSeparator: string;
	thousandsSeparator: string;
	currencySuffix: string;
}

export const DEFAULT_SETTINGS: MarkdownTableCalculatorSettings = {
	autoUpdate: true,
	debounceMs: 700,
	decimalPlaces: 2,
	decimalSeparator: ",",
	thousandsSeparator: " ",
	currencySuffix: "",
};

const USAGE_EXAMPLE = `| Item | Amount |
|---|---:|
| Groceries | 10 |
| Fuel | 50 |
| Lunch | 22,32 |
| Total | =SUM |`;

const RECALCULATED_EXAMPLE = `| Total | <span class="markdown-table-calculator-positive">82,32</span> <!-- table-calc: SUM --> |`;

export class MarkdownTableCalculatorSettingTab extends PluginSettingTab {
	plugin: MarkdownTableCalculatorPlugin;

	constructor(app: App, plugin: MarkdownTableCalculatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		this.renderUsage(containerEl);
		this.renderSettings(containerEl);
	}

	private renderUsage(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Usage")
			.setHeading();
		containerEl.createEl("p", {
			text: "Type a formula in a table cell. The plugin recalculates the result after a short pause and writes it back to the same cell.",
		});

		const example = containerEl.createEl("pre", {
			cls: "markdown-table-calculator-example",
		});
		example.createEl("code", {text: USAGE_EXAMPLE});

		containerEl.createEl("p", {
			text: "After recalculation, the formula is stored in an HTML comment, so later amount changes can still update the sum automatically.",
		});

		const recalculated = containerEl.createEl("pre", {
			cls: "markdown-table-calculator-example",
		});
		recalculated.createEl("code", {text: RECALCULATED_EXAMPLE});

		containerEl.createEl("p", {
			text: "The short formula sums the column it is placed in. Positive results are green, negative results are red. You can also target a column by header name, 1-based number, or spreadsheet-style letter.",
		});
	}

	private renderSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Calculation")
			.setHeading();

		new Setting(containerEl)
			.setName("Automatic recalculation")
			.setDesc("Recalculate sums after editing the active note, without using the command palette.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.autoUpdate)
				.onChange(async (value) => {
					this.plugin.settings.autoUpdate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Recalculation delay")
			.setDesc("How long to wait after typing, in milliseconds. Recommended: 500-1000.")
			.addText((text) => text
				.setPlaceholder("700")
				.setValue(String(this.plugin.settings.debounceMs))
				.onChange(async (value) => {
					this.plugin.settings.debounceMs = parseIntegerSetting(value, 700);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Decimal places")
			.setDesc("How many decimal places to show in the result.")
			.addText((text) => text
				.setPlaceholder("2")
				.setValue(String(this.plugin.settings.decimalPlaces))
				.onChange(async (value) => {
					this.plugin.settings.decimalPlaces = parseIntegerSetting(value, 2);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Decimal separator")
			.setDesc("The character between the integer and fractional parts.")
			.addText((text) => text
				.setPlaceholder(",")
				.setValue(this.plugin.settings.decimalSeparator)
				.onChange(async (value) => {
					this.plugin.settings.decimalSeparator = value.length > 0 ? value[0] ?? "," : ",";
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Thousands separator")
			.setDesc("Leave empty if you do not want to group thousands.")
			.addText((text) => text
				.setPlaceholder(" ")
				.setValue(this.plugin.settings.thousandsSeparator)
				.onChange(async (value) => {
					this.plugin.settings.thousandsSeparator = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Result suffix")
			.setDesc("Text appended after the result, for example a space and currency symbol.")
			.addText((text) => text
				.setValue(this.plugin.settings.currencySuffix)
				.onChange(async (value) => {
					this.plugin.settings.currencySuffix = value;
					await this.plugin.saveSettings();
				}));
	}
}

function parseIntegerSetting(value: string, fallback: number): number {
	const parsed = Number.parseInt(value.trim(), 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}
