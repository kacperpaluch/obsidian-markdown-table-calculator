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

export interface ParsedCell {
	start: number;
	end: number;
	text: string;
}

export interface ParsedRow {
	cells: ParsedCell[];
}

export interface Formula {
	type: string;
	columnRef: string | null;
	expression: string;
}
