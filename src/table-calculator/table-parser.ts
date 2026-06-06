import type {ParsedCell, ParsedRow} from "./types";
import {removeHtmlComments} from "../utils/helpers";

export function isTableStart(lines: string[], lineIndex: number): boolean {
	const headerLine = lines[lineIndex];
	const separatorLine = lines[lineIndex + 1];
	if (!headerLine || !separatorLine || !isTableLikeLine(headerLine) || !isTableLikeLine(separatorLine)) {
		return false;
	}

	const header = parseTableRow(headerLine);
	const separator = parseTableRow(separatorLine);
	return header.cells.length >= 2 && isSeparatorRow(separator);
}

export function isTableLikeLine(line: string): boolean {
	return line.includes("|") && line.trim().length > 0;
}

export function isSeparatorRow(row: ParsedRow): boolean {
	if (row.cells.length < 2) {
		return false;
	}

	return row.cells.every((cell) => /^:?-{3,}:?$/.test(cell.text.replace(/\s/g, "")));
}

export function isCodeFenceBoundary(line: string): boolean {
	return /^\s*(`{3,}|~{3,})/.test(line);
}

export function parseTableRow(line: string): ParsedRow {
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

export function normalizeHeader(value: string): string {
	return removeHtmlComments(value)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_`~]/g, "")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

export function stripMatchingQuotes(value: string): string {
	const first = value[0];
	const last = value[value.length - 1];
	if ((first === "\"" || first === "'" || first === "`") && first === last) {
		return value.slice(1, -1).trim();
	}

	return value;
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
