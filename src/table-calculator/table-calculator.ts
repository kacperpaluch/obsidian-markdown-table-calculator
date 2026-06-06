import type {ParsedRow, TableCalculationOptions, TableCalculationResult, LineReplacement} from "./types";
import type {FormulaHandler} from "./formula-registry";
import {FORMULA_HANDLERS} from "./formula-registry";
import {parseFormula, resolveColumnIndex} from "./formula-parser";
import {isCodeFenceBoundary, isTableStart, isTableLikeLine, isSeparatorRow, parseTableRow} from "./table-parser";
import {parseNumber, formatResult} from "./number-formatter";

export function calculateMarkdownTableSums(
	markdown: string,
	options: TableCalculationOptions
): TableCalculationResult {
	const lines = markdown.split(/\r?\n/);
	const replacements: LineReplacement[] = [];
	let updatedCells = 0;
	let inCodeFence = false;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex] ?? "";

		if (isCodeFenceBoundary(line)) {
			inCodeFence = !inCodeFence;
			continue;
		}

		if (inCodeFence || !isTableStart(lines, lineIndex)) {
			continue;
		}

		const startLine = lineIndex;
		let endLine = lineIndex;
		while (endLine < lines.length && isTableLikeLine(lines[endLine] ?? "")) {
			endLine++;
		}

		const tableLines = lines.slice(startLine, endLine);
		const tableResult = calculateTable(tableLines, options);
		for (const replacement of tableResult.replacements) {
			replacements.push({
				line: startLine + replacement.line,
				text: replacement.text,
			});
		}
		updatedCells += tableResult.updatedCells;
		lineIndex = endLine - 1;
	}

	return {
		replacements,
		updatedCells,
	};
}

function calculateTable(
	tableLines: string[],
	options: TableCalculationOptions
): TableCalculationResult {
	const parsedRows = tableLines.map((line) => parseTableRow(line));
	const header = parsedRows[0];
	const separator = parsedRows[1];
	if (!header || !separator || !isSeparatorRow(separator)) {
		return {
			replacements: [],
			updatedCells: 0,
		};
	}

	const updatedLines = [...tableLines];
	let updatedCells = 0;

	for (let rowIndex = 2; rowIndex < parsedRows.length; rowIndex++) {
		let parsedRow = parsedRows[rowIndex];
		if (!parsedRow) {
			continue;
		}

		for (let cellIndex = 0; cellIndex < parsedRow.cells.length; cellIndex++) {
			const cell = parsedRow.cells[cellIndex];
			if (!cell) {
				continue;
			}

			const formula = parseFormula(cell.text);
			if (!formula) {
				continue;
			}

			const handler = FORMULA_HANDLERS[formula.type];
			if (!handler) {
				continue;
			}

			const targetColumnIndex = formula.columnRef === null
				? cellIndex
				: resolveColumnIndex(formula.columnRef, header);
			if (targetColumnIndex === null) {
				continue;
			}

			const result = aggregateColumn(parsedRows, targetColumnIndex, handler);
			const resultOptions = handler.formatDecimalPlaces >= 0
				? {...options, decimalPlaces: handler.formatDecimalPlaces}
				: options;
			const nextCellText = `${formatResult(result, resultOptions)} <!-- table-calc: ${formula.expression} -->`;

			if (cell.text.trim() === nextCellText) {
				continue;
			}

			const currentLine = updatedLines[rowIndex];
			if (currentLine === undefined) {
				continue;
			}

			const nextLine = replaceCellText(currentLine, parsedRow, cellIndex, nextCellText);
			updatedLines[rowIndex] = nextLine;
			parsedRow = parseTableRow(nextLine);
			updatedCells++;
		}
	}

	const replacements: LineReplacement[] = [];
	for (let rowIndex = 0; rowIndex < updatedLines.length; rowIndex++) {
		const originalLine = tableLines[rowIndex];
		const updatedLine = updatedLines[rowIndex];
		if (originalLine !== undefined && updatedLine !== undefined && originalLine !== updatedLine) {
			replacements.push({
				line: rowIndex,
				text: updatedLine,
			});
		}
	}

	return {
		replacements,
		updatedCells,
	};
}

function aggregateColumn(
	rows: ParsedRow[],
	columnIndex: number,
	handler: FormulaHandler
): number {
	const values: number[] = [];

	for (let rowIndex = 2; rowIndex < rows.length; rowIndex++) {
		const cell = rows[rowIndex]?.cells[columnIndex];
		if (!cell || parseFormula(cell.text)) {
			continue;
		}

		const value = parseNumber(cell.text);
		if (value !== null) {
			values.push(value);
		}
	}

	return handler.aggregate(values);
}

function replaceCellText(line: string, row: ParsedRow, cellIndex: number, nextText: string): string {
	const cell = row.cells[cellIndex];
	if (!cell) {
		return line;
	}

	const rawCell = line.slice(cell.start, cell.end);
	if (rawCell.trim().length === 0) {
		return `${line.slice(0, cell.start)} ${nextText} ${line.slice(cell.end)}`;
	}

	const leadingWhitespaceLength = rawCell.length - rawCell.trimStart().length;
	const trailingWhitespaceLength = rawCell.length - rawCell.trimEnd().length;
	const contentStart = cell.start + leadingWhitespaceLength;
	const contentEnd = cell.end - trailingWhitespaceLength;

	return `${line.slice(0, contentStart)}${nextText}${line.slice(contentEnd)}`;
}
