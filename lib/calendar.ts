// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// A rotation laid out in time (SPEC.md, "Formulas", item 10): each crop's usual
// planting-to-harvest season on a grid that covers every year of the cycle, so the tool can
// say which months have a crop and which are bare. The cycle repeats, so a season that runs
// past the last December continues in the first January.
//
// Choices this file makes, all of them the tool's own:
//   - A crop is in the ground from the middle of its usual planting window to the middle of
//     its usual harvest window (data/calendar.json holds USDA's "most active" windows).
//   - Every year has 365 days. 29 February is left out.
//   - A month counts as a crop month when a crop is in the ground for at least half of it;
//     otherwise it is bare. Water is counted by days, not by these month labels.
//   - A perennial with no usual dates on file (alfalfa) covers the whole year it is planted in.

import type { Crop, CropCalendar, CropId, Rotation } from "@/lib/types";

export const DAYS_IN_YEAR = 365;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_START = MONTH_DAYS.map((_, month) =>
	MONTH_DAYS.slice(0, month).reduce((total, days) => total + days, 0),
);

/** Days in a calendar month of the 365-day year. January is 1. */
export function monthLength(month: number): number {
	return MONTH_DAYS[month - 1];
}

/** Day of the 365-day year for a month and day such as "09-15". 1 January is 0. */
export function dayOfYearIndex(monthDay: string): number {
	const month = Number(monthDay.slice(0, 2));
	const day = Number(monthDay.slice(3, 5));
	return MONTH_START[month - 1] + day - 1;
}

/** The calendar month (1 to 12) that a day of the 365-day year falls in. */
export function monthOfDayIndex(dayIndex: number): number {
	const day = ((dayIndex % DAYS_IN_YEAR) + DAYS_IN_YEAR) % DAYS_IN_YEAR;
	let month = 11;
	while (MONTH_START[month] > day) month -= 1;
	return month + 1;
}

/** The middle day of a window, as a day of the year. A window may run past 31 December. */
export function windowMiddle(start: string, end: string): number {
	const first = dayOfYearIndex(start);
	let last = dayOfYearIndex(end);
	if (last < first) last += DAYS_IN_YEAR;
	return Math.floor((first + last) / 2) % DAYS_IN_YEAR;
}

/** One crop's time in the ground, in days counted from 1 January of the cycle's first year. */
export type CropSeason = {
	crop: CropId;
	/** The year of the cycle it is planted in, counting from 1. */
	plantYear: number;
	/** First day in the ground. */
	startDay: number;
	/** Days from planting to harvest. */
	lengthDays: number;
	/** Days in the ground in each calendar month, in order from planting. */
	daysByMonth: { month: number; days: number }[];
	/**
	 * Days the field was bare just before planting, by calendar month, back to the harvest
	 * of whatever grew before (or to a year the tool knows nothing about).
	 */
	bareDaysBefore: { month: number; days: number }[];
};

export type CalendarMonth = {
	/** Year of the cycle, counting from 1. */
	year: number;
	month: number;
	/** Crops in the ground for at least half of the month. */
	crops: CropId[];
	bare: boolean;
	/** True in a year the tool cannot place: its crop is not one it knows. */
	unknown: boolean;
};

export type RotationCalendar = {
	cycleYears: number;
	/** One entry per month of the cycle: 12 times the number of years. */
	months: CalendarMonth[];
	seasons: CropSeason[];
	bareMonths: number;
	/** Months of the cycle that are not in an unknown year. */
	knownMonths: number;
	/** Bare months as a share of the known months, or null when no month is known. */
	bareShare: number | null;
	/** Plantings that could not be placed because no usual dates are on file for the crop. */
	unplaced: CropId[];
};

function tally(days: readonly number[]): { month: number; days: number }[] {
	const out: { month: number; days: number }[] = [];
	for (const day of days) {
		const month = monthOfDayIndex(day);
		const last = out[out.length - 1];
		if (last && last.month === month) last.days += 1;
		else out.push({ month, days: 1 });
	}
	return out;
}

/**
 * Lays a rotation's plantings on its month grid.
 *
 * `unknownYears` lists years of the cycle (counting from 1) whose crop the tool does not
 * know. Their months are neither crop nor bare, they are left out of the bare share, and no
 * rain is banked across them.
 */
export function buildCalendar(
	rotation: Pick<Rotation, "cycleYears" | "plantings">,
	library: { crops: readonly Crop[]; calendar: CropCalendar },
	unknownYears: readonly number[] = [],
): RotationCalendar {
	const { cycleYears } = rotation;
	const totalDays = cycleYears * DAYS_IN_YEAR;
	const wrap = (day: number) => ((day % totalDays) + totalDays) % totalDays;

	const seasons: Omit<CropSeason, "daysByMonth" | "bareDaysBefore">[] = [];
	const unplaced: CropId[] = [];
	for (const planting of rotation.plantings) {
		const yearStart = (planting.plantYear - 1) * DAYS_IN_YEAR;
		const dates = library.calendar[planting.crop];
		const crop = library.crops.find((item) => item.id === planting.crop);
		if (dates) {
			const plant = windowMiddle(dates.value.plantStart, dates.value.plantEnd);
			let harvest = windowMiddle(dates.value.harvestStart, dates.value.harvestEnd);
			// A crop harvested earlier in the calendar than it is planted is harvested the next year.
			if (harvest <= plant) harvest += DAYS_IN_YEAR;
			seasons.push({
				crop: planting.crop,
				plantYear: planting.plantYear,
				startDay: yearStart + plant,
				lengthDays: harvest - plant,
			});
		} else if (crop?.kind === "perennial") {
			seasons.push({
				crop: planting.crop,
				plantYear: planting.plantYear,
				startDay: yearStart,
				lengthDays: DAYS_IN_YEAR,
			});
		} else {
			unplaced.push(planting.crop);
		}
	}
	seasons.sort((a, b) => a.startDay - b.startDay);

	// Which crops are in the ground on each day of the cycle.
	const cropsOnDay: CropId[][] = Array.from({ length: totalDays }, () => []);
	for (const season of seasons) {
		for (let offset = 0; offset < season.lengthDays; offset += 1) {
			const list = cropsOnDay[wrap(season.startDay + offset)];
			if (!list.includes(season.crop)) list.push(season.crop);
		}
	}
	const unknownDay = (day: number) =>
		unknownYears.includes(Math.floor(wrap(day) / DAYS_IN_YEAR) + 1);

	const months: CalendarMonth[] = [];
	for (let year = 1; year <= cycleYears; year += 1) {
		for (let month = 1; month <= 12; month += 1) {
			const first = (year - 1) * DAYS_IN_YEAR + MONTH_START[month - 1];
			const length = MONTH_DAYS[month - 1];
			const counts = new Map<CropId, number>();
			for (let day = first; day < first + length; day += 1) {
				for (const crop of cropsOnDay[day]) {
					counts.set(crop, (counts.get(crop) ?? 0) + 1);
				}
			}
			const crops = [...counts.entries()]
				.filter(([, days]) => days * 2 >= length)
				.map(([crop]) => crop);
			const unknown = crops.length === 0 && unknownYears.includes(year);
			months.push({ year, month, crops, bare: crops.length === 0 && !unknown, unknown });
		}
	}

	const placed: CropSeason[] = seasons.map((season) => {
		const inGround = Array.from(
			{ length: season.lengthDays },
			(_, offset) => season.startDay + offset,
		);
		// Walk back from the day before planting while the field is bare.
		const bare: number[] = [];
		for (let back = 1; back <= totalDays; back += 1) {
			const day = wrap(season.startDay - back);
			if (cropsOnDay[day].length > 0 || unknownDay(day)) break;
			bare.push(day);
		}
		return {
			...season,
			daysByMonth: tally(inGround),
			bareDaysBefore: tally(bare.reverse()),
		};
	});

	const knownMonths = months.filter((month) => !month.unknown).length;
	const bareMonths = months.filter((month) => month.bare).length;
	return {
		cycleYears,
		months,
		seasons: placed,
		bareMonths,
		knownMonths,
		bareShare: knownMonths === 0 ? null : bareMonths / knownMonths,
		unplaced,
	};
}
