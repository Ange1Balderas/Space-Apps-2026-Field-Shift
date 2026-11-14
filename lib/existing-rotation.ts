// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Turns the field's own years (Cropland Data Layer classes, or the farmer's entries) into a
// rotation the tool can score. The mapping is Angel's decision of 2026-11-14 (SPEC.md,
// "Decisions made on 2026-11-14, after Phase 2", item 5):
//   1 Corn, 4 Sorghum, 5 Soybeans, 24 Winter Wheat and 36 Alfalfa are those crops;
//   61 Fallow/Idle Cropland is a year with no planting;
//   26, 225 and 236 are winter wheat plus soybeans, corn or sorghum in the same year;
//   every other class has no crop id: the year is named and left out of the score.
//
// The years are treated as one cycle that repeats. The Cropland Data Layer names the crop
// it sees in a year, so winter wheat seen in a year was planted the fall before.

import type { CropId, Rotation } from "@/lib/types";

export const CDL_FALLOW_CODE = 61;

export const CDL_CROPS: Readonly<Record<number, readonly CropId[]>> = {
	1: ["corn"],
	4: ["grain_sorghum"],
	5: ["soybean"],
	24: ["winter_wheat"],
	36: ["alfalfa"],
	26: ["winter_wheat", "soybean"],
	225: ["winter_wheat", "corn"],
	236: ["winter_wheat", "grain_sorghum"],
};

export type ExistingRotation = {
	rotation: Rotation;
	/** Years of the cycle (counting from 1) that are left out of the score. */
	unknownYears: number[];
	/** The calendar years left out, with what was seen there. A null code means nothing is on record. */
	leftOut: { year: number; cdlCode: number | null }[];
	scoredYears: number;
	totalYears: number;
};

export const EXISTING_ROTATION_ID = "existing";

/**
 * The field's own rotation from its years, or null when there are no years at all. A
 * rotation with nothing planted in any scored year comes back with no plantings; the
 * scoring then has nothing to score and says so.
 */
export function existingRotation(
	years: readonly { year: number; cdlCode: number | null }[],
): ExistingRotation | null {
	if (years.length === 0) return null;
	const ordered = [...years].sort((a, b) => a.year - b.year);
	const total = ordered.length;
	const plantings: Rotation["plantings"] = [];
	const unknownYears: number[] = [];
	const leftOut: ExistingRotation["leftOut"] = [];
	const add = (crop: CropId, plantYear: number) => {
		if (!plantings.some((item) => item.crop === crop && item.plantYear === plantYear)) {
			plantings.push({ crop, plantYear });
		}
	};
	ordered.forEach(({ year, cdlCode }, index) => {
		const cycleYear = index + 1;
		if (cdlCode === CDL_FALLOW_CODE) return;
		const crops = cdlCode === null ? undefined : CDL_CROPS[cdlCode];
		if (!crops) {
			unknownYears.push(cycleYear);
			leftOut.push({ year, cdlCode });
			return;
		}
		for (const crop of crops) {
			// Winter wheat seen this year went in the fall before; the first year's wheat
			// belongs to the fall of the last year, because the cycle repeats.
			add(crop, crop === "winter_wheat" ? (index === 0 ? total : index) : cycleYear);
		}
	});
	return {
		rotation: {
			id: EXISTING_ROTATION_ID,
			name: "Your current rotation",
			cycleYears: total,
			plantings,
			// Whether the field is irrigated is the farmer's to say; the crop map does not show it.
			water: "either",
			regions: [],
			needsNoTill: false,
			benefits: [],
			risks: [],
		},
		unknownYears,
		leftOut,
		scoredYears: total - unknownYears.length,
		totalYears: total,
	};
}
