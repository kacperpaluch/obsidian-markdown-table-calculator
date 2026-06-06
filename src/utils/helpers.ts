export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function removeHtmlComments(value: string): string {
	return value.replace(/<!--[\s\S]*?-->/g, "");
}

export function clampInteger(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(Math.max(Math.round(value), min), max);
}
