import {escapeHtml, removeHtmlComments, clampInteger} from "../utils/helpers";
import type {TableCalculationOptions} from "./types";

export function parseNumber(text: string): number | null {
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

export function formatResult(value: number, options: TableCalculationOptions): string {
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

export function formatNumber(value: number, options: TableCalculationOptions): string {
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

function groupThousands(integerPart: string, separator: string): string {
	if (separator.length === 0) {
		return integerPart;
	}

	const sign = integerPart.startsWith("-") ? "-" : "";
	const digits = sign ? integerPart.slice(1) : integerPart;
	return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)}`;
}
