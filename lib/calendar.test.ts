// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The calendars are built from the repo's own crops and dates (USDA's most active Kansas
// windows), and the expected months are counted by hand from those dates:
//   winter wheat  2 October to 27 June   (268 days)
//   corn          30 April to 2 October  (155 days)
//   sorghum       2 June to 18 October   (138 days)
//   soybeans      2 June to 16 October   (136 days)

import { describe, expect, it } from "vitest";
import {
	buildCalendar,
	dayOfYearIndex,
	monthOfDayIndex,
	windowMiddle,
} from "@/lib/calendar";
import { LIBRARY, ROTATIONS } from "@/lib/library";
import type { Rotation } from "@/lib/types";

const rotation = (id: string): Rotation => {
	const found = ROTATIONS.find((item) => item.id === id);
	if (!found) throw new Error(`no rotation ${id}`);
	return found;
};

const total = (list: readonly { days: number }[]) =>
	list.reduce((sum, item) => sum + item.days, 0);

describe("days of the 365-day year", () => {
	it("counts from 1 January as day 0", () => {
		expect(dayOfYearIndex("01-01")).toBe(0);
		expect(dayOfYearIndex("03-01")).toBe(59);
		expect(dayOfYearIndex("12-31")).toBe(364);
		expect(monthOfDayIndex(0)).toBe(1);
		expect(monthOfDayIndex(59)).toBe(3);
		expect(monthOfDayIndex(364)).toBe(12);
		// Days past the end of a year fall in the next year's months.
		expect(monthOfDayIndex(365 + 31)).toBe(2);
	});

	it("takes the middle of a window, also across the new year", () => {
		// 15 September is day 257 and 20 October day 292: the middle is day 274, 2 October.
		expect(windowMiddle("09-15", "10-20")).toBe(274);
		expect(windowMiddle("12-22", "01-10")).toBe(dayOfYearIndex("12-31"));
	});
});

describe("buildCalendar", () => {
	it("continuous wheat is bare in July, August and September", () => {
		const calendar = buildCalendar(rotation("continuous-wheat"), LIBRARY);
		expect(calendar.months).toHaveLength(12);
		expect(calendar.seasons[0].lengthDays).toBe(268);
		expect(calendar.months.filter((month) => month.bare).map((month) => month.month)).toEqual([7, 8, 9]);
		expect(calendar.bareShare).toBeCloseTo(3 / 12, 10);
		// The field is bare from 27 June to 1 October: 365 less 268 days in the ground.
		expect(total(calendar.seasons[0].bareDaysBefore)).toBe(97);
		expect(calendar.seasons[0].bareDaysBefore.map((item) => item.month)).toEqual([6, 7, 8, 9, 10]);
	});

	it("wheat-fallow is bare in 15 of 24 months, in one stretch", () => {
		const calendar = buildCalendar(rotation("wheat-fallow"), LIBRARY);
		expect(calendar.months).toHaveLength(24);
		expect(calendar.bareMonths).toBe(15);
		// Wheat goes in during October of year 1 and comes off in June of year 2.
		const crop = calendar.months.filter((month) => !month.bare).map((month) => `${month.year}-${month.month}`);
		expect(crop).toEqual(["1-10", "1-11", "1-12", "2-1", "2-2", "2-3", "2-4", "2-5", "2-6"]);
		// The fallow before planting is the rest of the two years.
		expect(total(calendar.seasons[0].bareDaysBefore)).toBe(2 * 365 - 268);
	});

	it("wheat-sorghum-fallow is a 36-month grid with two long bare stretches", () => {
		const calendar = buildCalendar(rotation("wheat-sorghum-fallow"), LIBRARY);
		expect(calendar.months).toHaveLength(36);
		expect(calendar.bareMonths).toBe(22);
		const [wheat, sorghum] = calendar.seasons;
		expect([wheat.crop, sorghum.crop]).toEqual(["winter_wheat", "grain_sorghum"]);
		// Sorghum harvest on 18 October of year 3 to wheat planting on 2 October of the next
		// year 1; wheat harvest on 27 June of year 2 to sorghum planting on 2 June of year 3.
		expect(total(wheat.bareDaysBefore)).toBe(349);
		expect(total(sorghum.bareDaysBefore)).toBe(340);
	});

	it("counts a month as a crop month only when a crop is in the ground for half of it", () => {
		const calendar = buildCalendar(rotation("continuous-corn"), LIBRARY);
		// Planted on 30 April and harvested on 2 October: April and October stay bare.
		expect(calendar.months.filter((month) => !month.bare).map((month) => month.month)).toEqual([5, 6, 7, 8, 9]);
		expect(calendar.seasons[0].daysByMonth[0]).toEqual({ month: 4, days: 1 });
	});

	it("leaves a year it knows nothing about out of the bare months and banks no rain across it", () => {
		// Three years: corn, a year with an unknown crop, corn.
		const own = { cycleYears: 3, plantings: [{ crop: "corn" as const, plantYear: 1 }, { crop: "corn" as const, plantYear: 3 }] };
		const calendar = buildCalendar(own, LIBRARY, [2]);
		expect(calendar.knownMonths).toBe(24);
		expect(calendar.months.filter((month) => month.unknown).map((month) => month.year)).toEqual(Array(12).fill(2));
		expect(calendar.bareMonths).toBe(14);
		// The corn of year 3 only banks rain from 1 January to 29 April of its own year.
		const third = calendar.seasons.find((season) => season.plantYear === 3);
		expect(total(third?.bareDaysBefore ?? [])).toBe(119);
	});

	it("covers the whole year for a perennial with no usual dates on file", () => {
		const calendar = buildCalendar({ cycleYears: 1, plantings: [{ crop: "alfalfa", plantYear: 1 }] }, LIBRARY);
		expect(calendar.bareMonths).toBe(0);
		expect(calendar.unplaced).toEqual([]);
	});

	it("reports a crop it cannot place, and does not invent dates for it", () => {
		const calendar = buildCalendar({ cycleYears: 1, plantings: [{ crop: "cover_crop", plantYear: 1 }] }, LIBRARY);
		expect(calendar.unplaced).toEqual(["cover_crop"]);
		expect(calendar.seasons).toEqual([]);
		expect(calendar.bareMonths).toBe(12);
	});
});
