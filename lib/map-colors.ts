// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// MapLibre paints with colour strings of its own and cannot read a CSS variable, while the
// design rule is semantic colour tokens only (CLAUDE.md rule 6). This resolves a token to
// the colour the browser actually shows, by painting one pixel with it. The tokens are
// written in oklch, which MapLibre does not parse, so the pixel is read back as rgba.

export const TRANSPARENT = "rgba(0, 0, 0, 0)";

// A colour no token has. If it is still the fill after the token is assigned, the browser
// did not understand the token's value (a canvas ignores an invalid colour).
const SENTINEL = "#010203";

const cache = new Map<string, string>();

/**
 * The colour of a CSS token such as "--border" or "--chart-1", as "rgba(r, g, b, a)".
 * Browser only. Falls back to transparent when the token, the canvas or the browser's
 * colour support is missing, so a missing token draws nothing rather than a wrong colour.
 */
export function tokenColor(token: string): string {
	const found = cache.get(token);
	if (found) return found;
	const result = resolve(token);
	cache.set(token, result);
	return result;
}

function resolve(token: string): string {
	if (typeof document === "undefined") return TRANSPARENT;
	const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
	if (!value) return TRANSPARENT;
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext("2d");
	if (!context) return TRANSPARENT;
	context.fillStyle = SENTINEL;
	context.fillStyle = value;
	if (String(context.fillStyle).toLowerCase() === SENTINEL) return TRANSPARENT;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
	return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

/** Forgets the resolved colours: for tests, and for a theme change if one is ever added. */
export function resetTokenColors(): void {
	cache.clear();
}
