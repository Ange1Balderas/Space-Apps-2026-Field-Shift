// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The tool computes in metric, the units NASA POWER reports, and converts at the edge:
// the API contract and the interface use inches and °F (CLAUDE.md rule 5).
//
// Both conversions come from NIST Special Publication 811, Appendix B.8 (opened 2026-11-14):
// https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8
//   "inch (in) to centimeter (cm): 2.54 E+00", printed in bold, which that table uses for exact factors.
//   "degree Fahrenheit (temperature) to degree Celsius: t/°C = (t/°F - 32)/1.8".

export const MM_PER_INCH = 25.4;

export function mmToIn(mm: number): number {
	return mm / MM_PER_INCH;
}

export function cmToIn(cm: number): number {
	return (cm * 10) / MM_PER_INCH;
}

/** Metres to feet. A foot is 12 inches, so this rests on the same inch as the rest. */
export function mToFt(metres: number): number {
	return (metres * 1000) / MM_PER_INCH / 12;
}

export function cToF(celsius: number): number {
	return (celsius * 9) / 5 + 32;
}

export function fToC(fahrenheit: number): number {
	return ((fahrenheit - 32) * 5) / 9;
}

// Rounds to a fixed number of decimal places. Used only when a value leaves the server
// or reaches the screen, never between calculation steps.
export function roundTo(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}
