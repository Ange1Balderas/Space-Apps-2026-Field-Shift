// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The field's rotation as the panel shows it: the crops the Cropland Data Layer detected,
// with the farmer's own corrections laid over them (SPEC.md, feature 4: "farmer can edit them").

import { cdlClassName } from "@/lib/cdl";
import type { HistoryResponse } from "@/lib/types";

// What a farmer can choose when correcting a year: the crops in SPEC.md's rotation library
// (corn, sorghum, soybeans, winter wheat, alfalfa, wheat double-cropped with soybeans),
// fallow, and grass or pasture. The values are Cropland Data Layer class codes.
export const CROP_CHOICE_CODES: readonly number[] = [1, 4, 5, 24, 36, 26, 61, 176];

// Shorter wording for class names that do not fit a chip. The class is the same;
// lib/cdl.ts holds USDA's own name for each code.
const SHORT_LABELS: Readonly<Record<number, string>> = {
	26: "Wheat then soybeans",
	37: "Other hay",
	61: "Fallow",
	176: "Grass or pasture",
	225: "Wheat then corn",
	236: "Wheat then sorghum",
};

/** The name shown for a class code. */
export function cropLabel(cdlCode: number): string {
	return SHORT_LABELS[cdlCode] ?? cdlClassName(cdlCode) ?? `Class ${cdlCode}`;
}

/** One year of the rotation as shown. `cdlCode` is null when nothing is known for the year. */
export type RotationYear = {
	year: number;
	cdlCode: number | null;
	/** True when the farmer's choice replaces, or stands in for, the detected class. */
	edited: boolean;
	/** What the Cropland Data Layer says for the year, or null when it has nothing. */
	detectedCode: number | null;
};

/**
 * The years to show. With a crop history they are its years. Without one (the service
 * failed) they are the 8 years before `currentYear`, empty until the farmer fills them in,
 * which is SPEC.md's fallback: "farmer picks their crops from a dropdown instead".
 */
export function rotationYears(
	history: HistoryResponse | null,
	edits: Readonly<Record<number, number>>,
	currentYear: number,
): RotationYear[] {
	const detected = history
		? history.years.map((row) => ({ year: row.year, code: row.cdlCode as number | null }))
		: Array.from({ length: 8 }, (_, index) => ({
				year: currentYear - 8 + index,
				code: null as number | null,
			}));
	return detected.map(({ year, code }) => {
		const choice = edits[year];
		const edited = choice !== undefined && choice !== code;
		return {
			year,
			cdlCode: edited ? choice : code,
			edited,
			detectedCode: code,
		};
	});
}

/** The choices offered for one year: the standard list, plus the detected class if it is not in it. */
export function cropChoices(detectedCode: number | null): number[] {
	if (detectedCode === null || CROP_CHOICE_CODES.includes(detectedCode)) {
		return [...CROP_CHOICE_CODES];
	}
	return [detectedCode, ...CROP_CHOICE_CODES];
}
