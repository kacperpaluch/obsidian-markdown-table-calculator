import {Notice, Plugin} from "obsidian";
import {AutoTableCalculator} from "./auto-table-calculator";
import {
	DEFAULT_SETTINGS,
	MarkdownTableCalculatorSettings,
	MarkdownTableCalculatorSettingTab,
} from "./settings";

export default class MarkdownTableCalculatorPlugin extends Plugin {
	settings: MarkdownTableCalculatorSettings;
	private calculator: AutoTableCalculator | null = null;

	async onload() {
		await this.loadSettings();

		this.calculator = new AutoTableCalculator(this, () => this.settings);
		this.calculator.register();

		this.addCommand({
			id: "recalculate-markdown-table-sums",
			name: "Recalculate Markdown table sums",
			editorCallback: (editor) => {
				const updatedCells = this.calculator?.recalculateEditor(editor) ?? 0;
				new Notice(
					updatedCells > 0
						? `Recalculated cells: ${updatedCells}`
						: "No sums to recalculate"
				);
			},
		});

		this.addSettingTab(new MarkdownTableCalculatorSettingTab(this.app, this));
	}

	onunload() {
		this.calculator?.clear();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<MarkdownTableCalculatorSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
