import type {Formula, ParsedRow} from "./types";
import {normalizeHeader, stripMatchingQuotes} from "./table-parser";
import {ALL_FORMULA_NAMES} from "./formula-registry";

const FORMULA_NAME_PATTERN = ALL_FORMULA_NAMES.join("|");
const FORMULA_COMMENT_PATTERN = new RegExp(`<!--\\s*table-calc:\\s*(${FORMULA_NAME_PATTERN})(?:\\(([^)]*)\\))?\\s*-->`, "i");
const INLINE_FORMULA_PATTERN = new RegExp(`^=\\s*(${FORMULA_NAME_PATTERN})(?:\\s*\\(([^)]*)\\))?$`, "i");

export function parseFormula(text: string): Formula | null {
	const commentMatch = text.match(FORMULA_COMMENT_PATTERN);
	if (commentMatch) {
		const type = (commentMatch[1] ?? "SUM").toUpperCase();
		const columnRef = normalizeFormulaColumnRef(commentMatch[2]);
		return {
			type,
			columnRef,
			expression: formatFormulaExpression(type, columnRef),
		};
	}

	const inlineMatch = text.trim().match(INLINE_FORMULA_PATTERN);
	if (inlineMatch) {
		const type = (inlineMatch[1] ?? "SUM").toUpperCase();
		const columnRef = normalizeFormulaColumnRef(inlineMatch[2]);
		return {
			type,
			columnRef,
			expression: formatFormulaExpression(type, columnRef),
		};
	}

	return null;
}

function normalizeFormulaColumnRef(value: string | undefined): string | null {
	const columnRef = value?.trim() ?? "";
	return columnRef.length > 0 ? columnRef : null;
}

function formatFormulaExpression(type: string, columnRef: string | null): string {
	return columnRef === null ? type : `${type}(${columnRef})`;
}

export function resolveColumnIndex(columnRef: string, header: ParsedRow): number | null {
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
