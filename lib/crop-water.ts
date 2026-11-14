// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Crop water demand (SPEC.md, "Formulas", item 2): reference ET times the crop coefficient,
// added up over the crop's season.
//
// The crop coefficient curve is FAO-56's (Chapter 6, "Construction of the Kc curve",
// https://www.fao.org/4/X0490E/x0490e0b.htm): the season is divided into four stages, with
// the initial value through the initial stage, the mid-season value through the mid-season
// stage, and straight lines between them in the development stage and down to the end value
// in the late season. FAO-56's coefficients describe a well-watered crop, so the result is
// potential demand: what the crop would use if water were never short.
//
// The tool's own choice: FAO-56's stage lengths are for other places, so the four stages
// are stretched or shrunk in proportion until they fill the Kansas season
// (lib/calendar.ts). FAO-56 itself calls its lengths a general guide.

import { type CropSeason, monthLength, monthOfDayIndex } from "@/lib/calendar";
import type { Crop } from "@/lib/types";

/**
 * The crop coefficient on one day of the season. `dayInSeason` counts from 0 on the
 * planting day. Null when the crop's coefficients or stage lengths are not sourced yet.
 */
export function cropCoefficient(
	crop: Pick<Crop, "kc" | "stageDays">,
	dayInSeason: number,
	seasonLength: number,
): number | null {
	if (!crop.kc || !crop.stageDays) return null;
	const { ini, mid, end } = crop.kc.value;
	const stages = crop.stageDays.value;
	const scale = seasonLength / (stages.ini + stages.dev + stages.mid + stages.late);
	const developmentStart = stages.ini * scale;
	const midStart = developmentStart + stages.dev * scale;
	const lateStart = midStart + stages.mid * scale;
	// The middle of the day stands for the day.
	const at = dayInSeason + 0.5;
	if (at <= developmentStart) return ini;
	if (at <= midStart) {
		return ini + ((mid - ini) * (at - developmentStart)) / (midStart - developmentStart);
	}
	if (at <= lateStart) return mid;
	return mid + ((end - mid) * (at - lateStart)) / (seasonLength - lateStart);
}

/**
 * Potential water demand of one season, in the unit of `et0ByMonth` (the tool passes
 * inches). `et0ByMonth` holds reference ET for January to December. Each day takes an equal
 * share of its month's reference ET. Null when the crop's coefficients are not sourced yet.
 */
export function seasonDemand(
	season: Pick<CropSeason, "startDay" | "lengthDays">,
	crop: Pick<Crop, "kc" | "stageDays">,
	et0ByMonth: readonly number[],
): number | null {
	let total = 0;
	for (let day = 0; day < season.lengthDays; day += 1) {
		const coefficient = cropCoefficient(crop, day, season.lengthDays);
		if (coefficient === null) return null;
		const month = monthOfDayIndex(season.startDay + day);
		total += (et0ByMonth[month - 1] / monthLength(month)) * coefficient;
	}
	return total;
}

/** The part of each listed month's total that falls on the listed days, added up. */
export function shareOfMonths(
	daysByMonth: readonly { month: number; days: number }[],
	totalByMonth: readonly number[],
): number {
	return daysByMonth.reduce(
		(total, { month, days }) =>
			total + (totalByMonth[month - 1] * days) / monthLength(month),
		0,
	);
}
