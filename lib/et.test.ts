// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Expected values are the numbers FAO-56 prints, read from the pages on 2026-11-14 by the
// project's data-verifier:
//   Chapter 4, Example 18, "Determination of ETo with daily data" (Brussels, 6 July, 50°48'N,
//   100 m): https://www.fao.org/4/X0490E/x0490e08.htm
//   Chapter 3, Example 3 (saturation vapour pressure): https://www.fao.org/4/X0490E/x0490e07.htm
// Example 18 rounds each step it prints, so a result is compared to the printed figure within
// the rounding of that figure, not to more digits than the page gives.
//
// Three things in Example 18 as printed, for anyone checking this file against the page:
//   - the wind speed at 2 m is printed "2,078 m/s", with a comma; 2.078 is meant;
//   - daylight hours are printed as 16.1 and, one line later, as 16.3; this file does not use them;
//   - the example gets its vapour pressure (1.409 kPa) from the highest and lowest humidity
//     of the day. NASA POWER gives a dew point instead, so the tests below feed the same
//     1.409 kPa in through the dew point and through the mean humidity.

import { describe, expect, it } from "vitest";
import {
	atmosphericPressureKpa,
	clearSkyRadiationMj,
	dailyEt0Mm,
	extraterrestrialRadiationMj,
	meanSaturationVapourPressureKpa,
	netRadiationMj,
	penmanMonteithEt0Mm,
	psychrometricConstant,
	saturationVapourPressureKpa,
	vapourPressureFromDewPointKpa,
	vapourPressureFromMeanHumidityKpa,
	vapourPressureSlope,
} from "@/lib/et";
import type { DailyWeather } from "@/lib/indicators";

// Example 18 as printed.
const EXAMPLE = {
	latitudeDeg: 50.8,
	elevationM: 100,
	dayNumber: 187,
	tmaxC: 21.5,
	tminC: 12.3,
	windMs: 2.078,
	vapourPressureKpa: 1.409,
	solarMj: 22.07,
};

describe("FAO-56 Example 18, step by step", () => {
	it("atmospheric pressure at 100 m is 100.1 kPa", () => {
		expect(atmosphericPressureKpa(100)).toBeCloseTo(100.1, 1);
	});

	it("the psychrometric constant is 0.0666 kPa per °C", () => {
		expect(psychrometricConstant(100.1)).toBeCloseTo(0.0666, 4);
	});

	it("the slope of the vapour pressure curve at 16.9°C is 0.122 kPa per °C", () => {
		expect(vapourPressureSlope(16.9)).toBeCloseTo(0.122, 3);
	});

	it("saturation vapour pressure is 2.564 kPa at 21.5°C and 1.431 kPa at 12.3°C", () => {
		expect(saturationVapourPressureKpa(21.5)).toBeCloseTo(2.564, 3);
		expect(saturationVapourPressureKpa(12.3)).toBeCloseTo(1.431, 3);
		// Printed as 1.997; the mean of the two printed values is 1.9975.
		expect(meanSaturationVapourPressureKpa(21.5, 12.3)).toBeCloseTo(1.997, 2);
	});

	it("extraterrestrial radiation on day 187 at 50.80°N is 41.09 MJ per m² per day", () => {
		expect(extraterrestrialRadiationMj(50.8, 187)).toBeCloseTo(41.09, 1);
	});

	it("clear-sky radiation is 30.90 MJ per m² per day", () => {
		expect(clearSkyRadiationMj(41.09, 100)).toBeCloseTo(30.9, 2);
	});

	it("net shortwave is 17.00, net longwave 3.71 and net radiation 13.28 MJ per m² per day", () => {
		const net = netRadiationMj({
			solarMj: EXAMPLE.solarMj,
			clearSkyMj: 30.9,
			tmaxC: EXAMPLE.tmaxC,
			tminC: EXAMPLE.tminC,
			vapourPressureKpa: EXAMPLE.vapourPressureKpa,
		});
		expect(net.netShortwaveMj).toBeCloseTo(17.0, 1);
		expect(net.netLongwaveMj).toBeCloseTo(3.71, 2);
		expect(net.netMj).toBeCloseTo(13.28, 1);
	});

	it("reference ET is 3.88 mm, which the example rounds to 3.9 mm a day", () => {
		const et0 = penmanMonteithEt0Mm({
			tmaxC: EXAMPLE.tmaxC,
			tminC: EXAMPLE.tminC,
			windMs: EXAMPLE.windMs,
			netRadiationMj: 13.28,
			vapourPressureKpa: EXAMPLE.vapourPressureKpa,
			elevationM: EXAMPLE.elevationM,
		});
		expect(Math.abs(et0 - 3.88)).toBeLessThan(0.01);
	});
});

describe("netRadiationMj", () => {
	it("does not count more sunlight than a cloudless sky gives", () => {
		const base = { clearSkyMj: 20, tmaxC: 25, tminC: 10, vapourPressureKpa: 1.2 };
		const atLimit = netRadiationMj({ ...base, solarMj: 20 });
		const above = netRadiationMj({ ...base, solarMj: 22 });
		// FAO-56 limits measured over clear-sky sunlight to 1 in the longwave term.
		expect(above.netLongwaveMj).toBeCloseTo(atLimit.netLongwaveMj, 12);
	});
});

describe("vapour pressure", () => {
	it("matches FAO-56 Example 3: 3.075 kPa at 24.5°C, 1.705 kPa at 15°C, mean 2.39 kPa", () => {
		expect(saturationVapourPressureKpa(24.5)).toBeCloseTo(3.075, 3);
		expect(saturationVapourPressureKpa(15)).toBeCloseTo(1.705, 3);
		expect(meanSaturationVapourPressureKpa(24.5, 15)).toBeCloseTo(2.39, 2);
	});

	it("from a dew point is the saturation vapour pressure at that temperature", () => {
		// FAO-56, Chapter 3: a dew point of 15°C means 1.705 kPa (Example 3's value at 15°C).
		expect(vapourPressureFromDewPointKpa(15)).toBeCloseTo(1.705, 3);
	});

	it("from the mean humidity is that share of the mean saturation vapour pressure", () => {
		expect(vapourPressureFromMeanHumidityKpa(50, 24.5, 15)).toBeCloseTo(2.39 / 2, 2);
	});
});

describe("dailyEt0Mm", () => {
	const site = { latitudeDeg: EXAMPLE.latitudeDeg, elevationM: EXAMPLE.elevationM };
	// 6 July of a year that is not a leap year is day 187.
	const day: DailyWeather = {
		date: "20250706",
		tmaxC: EXAMPLE.tmaxC,
		tminC: EXAMPLE.tminC,
		rainMm: 0,
		solarMj: EXAMPLE.solarMj,
		windMs: EXAMPLE.windMs,
	};
	// The dew point at which the air holds Example 18's 1.409 kPa (inverse of Eq. 11).
	const log = Math.log(EXAMPLE.vapourPressureKpa / 0.6108);
	const dewC = (237.3 * log) / (17.27 - log);
	// The mean humidity that gives the same 1.409 kPa on that day.
	const rhPct =
		(100 * EXAMPLE.vapourPressureKpa) /
		meanSaturationVapourPressureKpa(EXAMPLE.tmaxC, EXAMPLE.tminC);

	it("reproduces Example 18 from one day of weather, with vapour pressure from the dew point", () => {
		const et0 = dailyEt0Mm({ ...day, dewC }, site);
		expect(et0).not.toBeNull();
		expect(Math.abs((et0 ?? 0) - 3.88)).toBeLessThan(0.02);
	});

	it("prefers the dew point and falls back to the mean humidity", () => {
		const fromHumidity = dailyEt0Mm({ ...day, rhPct }, site);
		expect(Math.abs((fromHumidity ?? 0) - 3.88)).toBeLessThan(0.02);
		// With both present the dew point decides: a wrong humidity changes nothing.
		expect(dailyEt0Mm({ ...day, dewC, rhPct: 5 }, site)).toBe(
			dailyEt0Mm({ ...day, dewC }, site),
		);
	});

	it.each([
		["no sunlight value", { solarMj: null }],
		["no wind value", { windMs: null }],
		["no high temperature", { tmaxC: null }],
		["no low temperature", { tminC: null }],
	])("is null with %s", (_name, gap) => {
		expect(dailyEt0Mm({ ...day, dewC, ...gap }, site)).toBeNull();
	});

	it("is null with neither a dew point nor a humidity, and estimates neither", () => {
		expect(dailyEt0Mm(day, site)).toBeNull();
		expect(dailyEt0Mm({ ...day, dewC: null, rhPct: null }, site)).toBeNull();
	});
});
