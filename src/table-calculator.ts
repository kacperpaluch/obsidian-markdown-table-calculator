export interface TableCalculationOptions {
	currencySuffix: string;
	decimalPlaces: number;
	decimalSeparator: string;
	thousandsSeparator: string;
}

export interface LineReplacement {
	line: number;
	text: string;
}

export interface TableCalculationResult {
	replacements: LineReplacement[];
	updatedCells: number;
}

interface ParsedCell {
	start: number;
	end: number;
	text: string;
}

interface ParsedRow {
	cells: ParsedCell[];
}

interface Formula {
	columnRef: string | null;
	expression: string;
}

const FORMULA_COMMENT_PATTERN = /<!--\s*table-calc:\s*SUM(?:\(([^)]*)\))?\s*-->/i;
const INLINE_FORMULA_PATTERN = /^=\s*SUM(?:\s*\(([^)]*)\))?$/i;

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

			const targetColumnIndex = formula.columnRef === null
				? cellIndex
				: resolveColumnIndex(formula.columnRef, header);
			if (targetColumnIndex === null) {
				continue;
			}

			const sum = sumColumn(parsedRows, targetColumnIndex);
			const nextCellText = `${formatResult(sum, options)} <!-- table-calc: ${formula.expression} -->`;

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

function isTableStart(lines: string[], lineIndex: number): boolean {
	const headerLine = lines[lineIndex];
	const separatorLine = lines[lineIndex + 1];
	if (!headerLine || !separatorLine || !isTableLikeLine(headerLine) || !isTableLikeLine(separatorLine)) {
		return false;
	}

	const header = parseTableRow(headerLine);
	const separator = parseTableRow(separatorLine);
	return header.cells.length >= 2 && isSeparatorRow(separator);
}

function isTableLikeLine(line: string): boolean {
	return line.includes("|") && line.trim().length > 0;
}

function isSeparatorRow(row: ParsedRow): boolean {
	if (row.cells.length < 2) {
		return false;
	}

	return row.cells.every((cell) => /^:?-{3,}:?$/.test(cell.text.replace(/\s/g, "")));
}

function isCodeFenceBoundary(line: string): boolean {
	return /^\s*(`{3,}|~{3,})/.test(line);
}

function parseTableRow(line: string): ParsedRow {
	const pipeIndexes = getUnescapedPipeIndexes(line);
	if (pipeIndexes.length === 0) {
		return {
			cells: [],
		};
	}

	const firstNonWhitespace = line.search(/\S/);
	const lastNonWhitespace = findLastNonWhitespaceIndex(line);
	const firstPipeIndex = pipeIndexes[0];
	const lastPipeIndex = pipeIndexes[pipeIndexes.length - 1];
	if (firstPipeIndex === undefined || lastPipeIndex === undefined) {
		return {
			cells: [],
		};
	}

	const hasLeadingPipe = firstNonWhitespace >= 0 && firstPipeIndex === firstNonWhitespace;
	const hasTrailingPipe = lastNonWhitespace >= 0 && lastPipeIndex === lastNonWhitespace;
	const startBoundary = hasLeadingPipe ? firstPipeIndex : -1;
	const endBoundary = hasTrailingPipe ? lastPipeIndex : line.length;
	const boundaries = [
		startBoundary,
		...pipeIndexes.filter((index) => index > startBoundary && index < endBoundary),
		endBoundary,
	];
	const cells: ParsedCell[] = [];

	for (let boundaryIndex = 0; boundaryIndex < boundaries.length - 1; boundaryIndex++) {
		const leftBoundary = boundaries[boundaryIndex];
		const rightBoundary = boundaries[boundaryIndex + 1];
		if (leftBoundary === undefined || rightBoundary === undefined) {
			continue;
		}

		const start = leftBoundary === -1 ? 0 : leftBoundary + 1;
		const end = rightBoundary;
		cells.push({
			start,
			end,
			text: line.slice(start, end).trim(),
		});
	}

	return {
		cells,
	};
}

function getUnescapedPipeIndexes(line: string): number[] {
	const indexes: number[] = [];
	for (let index = 0; index < line.length; index++) {
		if (line[index] === "|" && !isEscaped(line, index)) {
			indexes.push(index);
		}
	}

	return indexes;
}

function isEscaped(line: string, index: number): boolean {
	let slashCount = 0;
	for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor--) {
		slashCount++;
	}

	return slashCount % 2 === 1;
}

function findLastNonWhitespaceIndex(line: string): number {
	for (let index = line.length - 1; index >= 0; index--) {
		if (/\S/.test(line[index] ?? "")) {
			return index;
		}
	}

	return -1;
}

function parseFormula(text: string): Formula | null {
	const commentMatch = text.match(FORMULA_COMMENT_PATTERN);
	if (commentMatch) {
		const columnRef = normalizeFormulaColumnRef(commentMatch[1]);
		return {
			columnRef,
			expression: formatFormulaExpression(columnRef),
		};
	}

	const inlineMatch = text.trim().match(INLINE_FORMULA_PATTERN);
	if (inlineMatch) {
		const columnRef = normalizeFormulaColumnRef(inlineMatch[1]);
		return {
			columnRef,
			expression: formatFormulaExpression(columnRef),
		};
	}

	return null;
}

function normalizeFormulaColumnRef(value: string | undefined): string | null {
	const columnRef = value?.trim() ?? "";
	return columnRef.length > 0 ? columnRef : null;
}

function formatFormulaExpression(columnRef: string | null): string {
	return columnRef === null ? "SUM" : `SUM(${columnRef})`;
}

function resolveColumnIndex(columnRef: string, header: ParsedRow): number | null {
	const cleanRef = stripMatchingQuotes(columnRef.trim());
	const numericIndex = parseNumericColumnIndex(cleanRef, header.cells.length);
	if (numericIndex !== null) {
		return numericIndex;
	}

	const normalizedRef = normalizeHeader(cleanRef);
	const namedIndex = header.cells.findIndex((cell) => normalizeHeader(cell.text) === normalizedRef);
	if (namedIndex >= 0) {
		return namedIndex;
	}

	const letterIndex = parseLetterColumnIndex(cleanRef, header.cells.length);
	if (letterIndex !== null) {
		return letterIndex;
	}

	return null;
}

function parseNumericColumnIndex(value: string, columnsCount: number): number | null {
	if (!/^\d+$/.test(value)) {
		return null;
	}

	const index = Number.parseInt(value, 10) - 1;
	return index >= 0 && index < columnsCount ? index : null;
}

function parseLetterColumnIndex(value: string, columnsCount: number): number | null {
	if (!/^[A-Za-z]+$/.test(value)) {
		return null;
	}

	let index = 0;
	for (const char of value.toUpperCase()) {
		index = index * 26 + char.charCodeAt(0) - 64;
	}
	index -= 1;

	return index >= 0 && index < columnsCount ? index : null;
}

function stripMatchingQuotes(value: string): string {
	const first = value[0];
	const last = value[value.length - 1];
	if ((first === "\"" || first === "'" || first === "`") && first === last) {
		return value.slice(1, -1).trim();
	}

	return value;
}

function normalizeHeader(value: string): string {
	return removeHtmlComments(value)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_`~]/g, "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

function sumColumn(rows: ParsedRow[], columnIndex: number): number {
	let sum = 0;

	for (let rowIndex = 2; rowIndex < rows.length; rowIndex++) {
		const cell = rows[rowIndex]?.cells[columnIndex];
		if (!cell || parseFormula(cell.text)) {
			continue;
		}

		const value = parseNumber(cell.text);
		if (value !== null) {
			sum += value;
		}
	}

	return sum;
}

function parseNumber(text: string): number | null {
	const cleanText = removeHtmlComments(text)
		.replace(/<[^>]*>/g, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_`~]/g, "");
	const match = cleanText.match(/[-+]?\d(?:[\d\s\u00A0.,]*\d)?/);
	if (!match) {
		return null;
	}

	const normalized = normalizeNumberToken(match[0]);
	if (normalized === null) {
		return null;
	}

	const value = Number(normalized);
	return Number.isFinite(value) ? value : null;
}

function normalizeNumberToken(token: string): string | null {
	let compact = token.replace(/[\s\u00A0]/g, "").replace(/[^0-9,.\-+]/g, "");
	if (compact.length === 0) {
		return null;
	}

	const sign = compact.startsWith("-") ? "-" : "";
	compact = compact.replace(/^[+-]/, "");
	if (compact.length === 0) {
		return null;
	}

	const separators = compact.match(/[,.]/g) ?? [];
	if (separators.length === 0) {
		return `${sign}${compact}`;
	}

	if (separators.length === 1) {
		const separatorIndex = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
		const integerPart = compact.slice(0, separatorIndex);
		const fractionPart = compact.slice(separatorIndex + 1);
		if (fractionPart.length === 3 && integerPart.length > 0) {
			return `${sign}${integerPart}${fractionPart}`;
		}

		return `${sign}${integerPart}.${fractionPart}`;
	}

	const decimalSeparatorIndex = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
	const integerPart = compact.slice(0, decimalSeparatorIndex).replace(/[,.]/g, "");
	const fractionPart = compact.slice(decimalSeparatorIndex + 1).replace(/[,.]/g, "");
	return `${sign}${integerPart}.${fractionPart}`;
}

function formatResult(value: number, options: TableCalculationOptions): string {
	const numberText = formatNumber(value, options);
	const className = getResultClassName(value);
	if (className === null) {
		return numberText;
	}

	return `<span class="${className}">${escapeHtml(numberText)}</span>`;
}

function getResultClassName(value: number): string | null {
	if (value > 0) {
		return "markdown-table-calculator-positive";
	}

	if (value < 0) {
		return "markdown-table-calculator-negative";
	}

	return null;
}

function formatNumber(value: number, options: TableCalculationOptions): string {
	const decimalPlaces = clampInteger(options.decimalPlaces, 0, 8, 2);
	const fixed = value.toFixed(decimalPlaces);
	const [integerPart = "0", fractionPart = ""] = fixed.split(".");
	const groupedInteger = groupThousands(integerPart, options.thousandsSeparator);
	const decimalSeparator = options.decimalSeparator || ",";
	const numberText = decimalPlaces > 0
		? `${groupedInteger}${decimalSeparator}${fractionPart}`
		: groupedInteger;

	return `${numberText}${options.currencySuffix}`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function groupThousands(integerPart: string, separator: string): string {
	if (separator.length === 0) {
		return integerPart;
	}

	const sign = integerPart.startsWith("-") ? "-" : "";
	const digits = sign ? integerPart.slice(1) : integerPart;
	return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)}`;
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

function removeHtmlComments(value: string): string {
	return value.replace(/<!--[\s\S]*?-->/g, "");
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(Math.max(Math.round(value), min), max);
}
