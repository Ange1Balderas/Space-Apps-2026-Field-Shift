// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Checks the vegetation layer file as committed, the checks that guard it, and the dates,
// tile addresses and colour scale worked out from it.

import { describe, expect, it } from "vitest";
import layerJson from "@/data/vegetation-layer.json";
import { isInKansasBounds } from "@/lib/kansas";
import {
	datesOfYear,
	formatVegetationDay,
	isIsoDay,
	isVegetationTileError,
	LATEST_VEGETATION_DATE,
	legendGradient,
	nearestInYear,
	tileAt,
	VEGETATION,
	VEGETATION_DATES,
	vegetationDates,
	vegetationProbeUrl,
	vegetationProblems,
	vegetationResolutionText,
	vegetationTileUrl,
	vegetationYears,
} from "@/lib/vegetation";

type Loose = Record<string, unknown>;
const loose = (): Loose => JSON.parse(JSON.stringify(layerJson)) as Loose;

describe("the vegetation layer file as committed", () => {
	it("has the expected shape", () => {
		expect(vegetationProblems(layerJson)).toEqual([]);
	});

	it("is NASA's 16-day MODIS vegetation index, read from GIBS", () => {
		expect(VEGETATION.layer).toBe("MODIS_Terra_L3_NDVI_16Day");
		expect(VEGETATION.period).toBe("16-Day");
		expect(VEGETATION.tileUrl.startsWith("https://gibs.earthdata.nasa.gov/")).toBe(true);
		expect(VEGETATION.readFrom.every((url) => url.startsWith("https://gibs.earthdata.nasa.gov/"))).toBe(true);
		expect(isIsoDay(VEGETATION.readAt.slice(0, 10))).toBe(true);
	});

	it("has a colour scale that rises from its first label to its last", () => {
		const { stops, minLabel, maxLabel } = VEGETATION.legend;
		expect(stops[0].value).toBe(Number(minLabel));
		expect(stops[stops.length - 1].value).toBeLessThanOrEqual(Number(maxLabel));
		expect(stops.length).toBeGreaterThanOrEqual(2);
	});
});

describe("vegetationProblems", () => {
	it("refuses a period whose last day is not a whole number of steps after its first", () => {
		const broken = loose();
		(broken.periods as Loose[])[0].end = "2000-12-19";
		expect(vegetationProblems(broken).join("\n")).toContain(
			"periods[0]: the last day is not a whole number of steps after the first",
		);
	});

	it("refuses a day that is not on the calendar, and a tile address with a part missing", () => {
		const badDay = loose();
		(badDay.periods as Loose[])[1].start = "2001-02-30";
		expect(vegetationProblems(badDay).join("\n")).toContain("periods[1]: expected");

		const badUrl = loose();
		badUrl.tileUrl = "https://gibs.earthdata.nasa.gov/wmts/{z}/{y}/{x}.png";
		expect(vegetationProblems(badUrl).join("\n")).toContain("tileUrl");
	});

	it("refuses colours out of range and values that do not rise", () => {
		const badColour = loose();
		((badColour.legend as Loose).stops as Loose[])[0].rgb = [0, 0, 300];
		expect(vegetationProblems(badColour).join("\n")).toContain("stops[0]: expected");

		const flat = loose();
		((flat.legend as Loose).stops as Loose[])[1].value = 0;
		expect(vegetationProblems(flat).join("\n")).toContain("stops[1]: the values have to rise");
	});

	it("refuses something that is not an object", () => {
		expect(vegetationProblems([])).toEqual(["vegetation layer: expected an object"]);
	});
});

describe("the dates the layer has", () => {
	it("steps through each period from its first day to its last", () => {
		expect(
			vegetationDates([
				{ start: "2025-12-03", end: "2025-12-19", stepDays: 16 },
				{ start: "2026-01-01", end: "2026-02-02", stepDays: 16 },
			]),
		).toEqual(["2025-12-03", "2025-12-19", "2026-01-01", "2026-01-17", "2026-02-02"]);
	});

	it("steps correctly through a leap year", () => {
		const days = vegetationDates([{ start: "2024-02-18", end: "2024-03-21", stepDays: 16 }]);
		expect(days).toEqual(["2024-02-18", "2024-03-05", "2024-03-21"]);
	});

	it("are in order, with none twice, and end at the last period's last day", () => {
		expect([...VEGETATION_DATES].sort()).toEqual([...VEGETATION_DATES]);
		expect(new Set(VEGETATION_DATES).size).toBe(VEGETATION_DATES.length);
		expect(LATEST_VEGETATION_DATE).toBe(VEGETATION.periods[VEGETATION.periods.length - 1].end);
		expect(VEGETATION_DATES[0]).toBe(VEGETATION.periods[0].start);
		for (const day of VEGETATION_DATES) expect(isIsoDay(day), day).toBe(true);
	});

	it("starts each full year on 1 January, as the 16-day pictures do", () => {
		for (const period of VEGETATION.periods.slice(1)) {
			expect(period.start.slice(5), period.start).toBe("01-01");
		}
	});

	it("lists the years newest first, and the pictures of one year oldest first", () => {
		const years = vegetationYears(VEGETATION_DATES);
		expect(years[0]).toBe(Number(LATEST_VEGETATION_DATE.slice(0, 4)));
		expect(years[years.length - 1]).toBe(2000);
		const of2025 = datesOfYear(VEGETATION_DATES, 2025);
		expect(of2025[0]).toBe("2025-01-01");
		expect(of2025).toHaveLength(23);
		expect(datesOfYear(VEGETATION_DATES, 1999)).toEqual([]);
	});

	it("keeps the time of year when the year changes", () => {
		expect(nearestInYear(VEGETATION_DATES, 2012, "2026-07-12")).toBe("2012-07-11");
		expect(nearestInYear(VEGETATION_DATES, 2025, "2026-10-16")).toBe("2025-10-16");
		// 2000 starts in March: the nearest picture to a January day is its first.
		expect(nearestInYear(VEGETATION_DATES, 2000, "2026-01-17")).toBe("2000-03-05");
		expect(nearestInYear(VEGETATION_DATES, 1999, "2026-01-17")).toBeNull();
	});
});

describe("tile addresses", () => {
	it("puts the day into the address and leaves the tile numbers to the map", () => {
		const url = vegetationTileUrl("2026-10-16");
		expect(url).toBe(
			"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_16Day/default/2026-10-16/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
		);
	});

	it("finds the tile that holds a point", () => {
		expect(tileAt(0, 0, 0)).toEqual({ x: 0, y: 0, z: 0 });
		expect(tileAt(0.1, 0.1, 1)).toEqual({ x: 1, y: 0, z: 1 });
		expect(tileAt(-0.1, -0.1, 1)).toEqual({ x: 0, y: 1, z: 1 });
		// The Finney County sample, at zoom 6.
		expect(tileAt(37.965, -100.723, 6)).toEqual({ x: 14, y: 24, z: 6 });
	});

	it("asks for one whole tile over the middle of Kansas before drawing the layer", () => {
		const url = vegetationProbeUrl("2026-10-16");
		expect(url).toBe(
			"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_16Day/default/2026-10-16/GoogleMapsCompatible_Level9/5/12/7.png",
		);
		expect(url).not.toMatch(/[{}]/);
		// The middle of that tile is inside the Kansas rectangle.
		expect(isInKansasBounds(38.5, -98.3)).toBe(true);
		expect(tileAt(38.5, -98.3, 5)).toEqual({ x: 7, y: 12, z: 5 });
	});
});

describe("the size of a reading and a failed tile", () => {
	it("gives NASA's 250 m in feet first, as about", () => {
		expect(VEGETATION.resolution).toBe("250m");
		expect(vegetationResolutionText()).toBe("about 820 ft (250 m)");
		expect(vegetationResolutionText({ resolution: "1 km" })).toBe("1 km");
	});

	it("knows a failed tile of this layer from any other error", () => {
		expect(isVegetationTileError({ tile: {}, sourceId: "nasa-vegetation" })).toBe(true);
		expect(isVegetationTileError({ tile: {}, sourceId: "openmaptiles" })).toBe(false);
		expect(isVegetationTileError({ sourceId: "nasa-vegetation" })).toBe(false);
		expect(isVegetationTileError(null)).toBe(false);
	});

	it("does not count a late report about another day's picture", () => {
		const failed = (url?: string) => ({
			tile: {},
			sourceId: "nasa-vegetation",
			error: url ? Object.assign(new Error("404"), { url }) : new TypeError("Failed to fetch"),
		});
		const address = vegetationTileUrl("2026-10-16").replace("{z}/{y}/{x}", "7/49/28");
		expect(isVegetationTileError(failed(address), "2026-10-16")).toBe(true);
		expect(isVegetationTileError(failed(address), "2012-07-11")).toBe(false);
		// No address to go by: the network failed before any answer. It counts.
		expect(isVegetationTileError(failed(), "2012-07-11")).toBe(true);
		// No day asked about: any failed tile of the layer counts.
		expect(isVegetationTileError(failed(address))).toBe(true);
	});
});

describe("the colour scale and the words for a day", () => {
	it("writes the stops as a gradient from left to right", () => {
		expect(
			legendGradient([
				{ value: 0, rgb: [241, 236, 236] },
				{ value: 0.5, rgb: [86, 161, 0] },
				{ value: 1, rgb: [0, 24, 1] },
			]),
		).toBe("linear-gradient(to right, rgb(241 236 236) 0%, rgb(86 161 0) 50%, rgb(0 24 1) 100%)");
	});

	it("writes a day in words", () => {
		expect(formatVegetationDay("2026-10-16")).toBe("October 16");
		expect(formatVegetationDay("2026-01-01", true)).toBe("January 1, 2026");
	});

	it("knows a real day from a made-up one", () => {
		expect(isIsoDay("2024-02-29")).toBe(true);
		expect(isIsoDay("2025-02-29")).toBe(false);
		expect(isIsoDay("2025-2-9")).toBe(false);
	});
});
