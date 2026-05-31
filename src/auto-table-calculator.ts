import {Editor, MarkdownView, Plugin} from "obsidian";
import {
	calculateMarkdownTableSums,
	LineReplacement,
	TableCalculationOptions,
} from "./table-calculator";
import {MarkdownTableCalculatorSettings} from "./settings";

export class AutoTableCalculator {
	private debounceTimer: number | null = null;
	private applyingChanges = false;

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => MarkdownTableCalculatorSettings
	) {}

	register(): void {
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("editor-change", (editor: Editor) => {
				this.schedule(editor);
			})
		);

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("active-leaf-change", () => {
				const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					this.schedule(view.editor);
				}
			})
		);
	}

	clear(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	recalculateEditor(editor: Editor): number {
		const settings = this.getSettings();
		const result = calculateMarkdownTableSums(editor.getValue(), this.toCalculationOptions(settings));

		if (result.replacements.length === 0) {
			return 0;
		}

		this.applyingChanges = true;
		try {
			applyLineReplacements(editor, result.replacements);
		} finally {
			this.applyingChanges = false;
		}

		return result.updatedCells;
	}

	private schedule(editor: Editor): void {
		const settings = this.getSettings();
		if (!settings.autoUpdate || this.applyingChanges) {
			return;
		}

		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			this.recalculateEditor(editor);
		}, clampDebounceMs(settings.debounceMs));
	}

	private toCalculationOptions(settings: MarkdownTableCalculatorSettings): TableCalculationOptions {
		return {
			currencySuffix: settings.currencySuffix,
			decimalPlaces: settings.decimalPlaces,
			decimalSeparator: settings.decimalSeparator,
			thousandsSeparator: settings.thousandsSeparator,
		};
	}
}

function applyLineReplacements(editor: Editor, replacements: LineReplacement[]): void {
	const cursor = editor.getCursor();
	const sortedReplacements = [...replacements].sort((a, b) => b.line - a.line);

	for (const replacement of sortedReplacements) {
		const currentLine = editor.getLine(replacement.line);
		if (currentLine === replacement.text) {
			continue;
		}

		editor.replaceRange(
			replacement.text,
			{line: replacement.line, ch: 0},
			{line: replacement.line, ch: currentLine.length}
		);
	}

	editor.setCursor(cursor);
}

function clampDebounceMs(value: number): number {
	if (!Number.isFinite(value)) {
		return 700;
	}

	return Math.min(Math.max(Math.round(value), 150), 5000);
}
