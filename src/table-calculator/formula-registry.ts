export interface FormulaHandler {
	aggregate(values: number[]): number;
	formatDecimalPlaces: number;
}

export const ALL_FORMULA_NAMES = ["SUM", "AVERAGE", "AVG", "COUNT", "MIN", "MAX"];

export const FORMULA_HANDLERS: Record<string, FormulaHandler> = {
	SUM: {
		aggregate: (values) => values.reduce((sum, v) => sum + v, 0),
		formatDecimalPlaces: -1,
	},
	AVERAGE: {
		aggregate: (values) => {
			if (values.length === 0) return 0;
			return values.reduce((sum, v) => sum + v, 0) / values.length;
		},
		formatDecimalPlaces: -1,
	},
	AVG: {
		aggregate: (values) => {
			if (values.length === 0) return 0;
			return values.reduce((sum, v) => sum + v, 0) / values.length;
		},
		formatDecimalPlaces: -1,
	},
	COUNT: {
		aggregate: (values) => values.length,
		formatDecimalPlaces: 0,
	},
	MIN: {
		aggregate: (values) => values.length === 0 ? 0 : Math.min(...values),
		formatDecimalPlaces: -1,
	},
	MAX: {
		aggregate: (values) => values.length === 0 ? 0 : Math.max(...values),
		formatDecimalPlaces: -1,
	},
};
