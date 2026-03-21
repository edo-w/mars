export function toJsonText(fields: Record<string, unknown>): string {
	return `${JSON.stringify(fields, null, 2)}\n`;
}
