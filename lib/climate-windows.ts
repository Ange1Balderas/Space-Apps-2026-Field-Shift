// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The months a field is usually hot, dry or frosty, laid over the field calendar (SPEC.md,
// user flow step 7: "typical heat, dry and frost windows"). SPEC.md does not define the
// windows. A threshold picked by the tool would be a tuning constant, so each window is
// worked out by a rule that needs no chosen number:
//   Hot    a day at or above the hot-day threshold occurred in that month in more than half
//          of the last ten years on record.
//   Dry    reference ET exceeds rain in that month by more than it does in the field's own
//          average month, on the last ten years. It marks the months when the air asks for
//          the most water beyond what rain gives.
//   Frost  the months from the average first fall freeze to the average last spring freeze,
//          over every year on record that had one.
// These rules are the tool's own. They only mark the calendar; no score uses them.

import { monthOfDayIndex } from "@/lib/calendar";
import { RECENT_YEARS, recentClimate } from "@/lib/scoring";
import type { ClimateResponse } from "@/lib/types";

export type ClimateWindows = {
	/** Calendar months, 1 to 12, in each window. Empty when the window cannot be worked out. */
	hot: number[];
	dry: number[];
	frost: number[];
	/** The years the hot and dry windows are worked out from, or null without monthly figures. */
	recentYears: { first: number; last: number } | null;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function mean(values: readonly number[]): number | null {
	return values.length === 0
		? null
		: values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function climateWindows(
	climate: Pick<ClimateResponse, "years" | "monthlyByYear">,
): ClimateWindows {
	const recent = recentClimate(climate);
	let hot: number[] = [];
	let dry: number[] = [];
	if (recent) {
		const rows = climate.monthlyByYear.filter(
			(row) => row.year >= recent.firstYear && row.year <= recent.lastYear,
		);
		hot = MONTHS.filter((month) => {
			const ofMonth = rows.filter((row) => row.month === month);
			const withHotDay = ofMonth.filter((row) => row.hotDays >= 1).length;
			return ofMonth.length > 0 && withHotDay * 2 > ofMonth.length;
		});
		const deficit = MONTHS.map(
			(month) => recent.et0In[month - 1] - recent.rainIn[month - 1],
		);
		const average = (mean(deficit) ?? 0);
		dry = MONTHS.filter((month) => deficit[month - 1] > average);
	}

	// Day of the year 1 is 1 January; monthOfDayIndex counts from 0.
	const spring = mean(
		climate.years.flatMap((row) =>
			row.lastSpringFreezeDoy === null ? [] : [row.lastSpringFreezeDoy],
		),
	);
	const fall = mean(
		climate.years.flatMap((row) =>
			row.firstFallFreezeDoy === null ? [] : [row.firstFallFreezeDoy],
		),
	);
	let frost: number[] = [];
	if (spring !== null && fall !== null) {
		const lastMonth = monthOfDayIndex(Math.round(spring) - 1);
		const firstMonth = monthOfDayIndex(Math.round(fall) - 1);
		frost = MONTHS.filter((month) => month >= firstMonth || month <= lastMonth);
	}

	return {
		hot,
		dry,
		frost,
		recentYears: recent ? { first: recent.firstYear, last: recent.lastYear } : null,
	};
}

export { RECENT_YEARS };
