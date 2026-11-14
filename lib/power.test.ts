// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The answer shape used here was copied from a real NASA POWER daily answer on 2026-11-14
// (keys and header fields), with made-up values.

import { describe, expect, it } from "vitest";
import { buildPowerUrl, lastFullYear, parsePowerDaily } from "@/lib/power";
import { UpstreamError } from "@/lib/upstream";

// What a day looks like when the answer has none of the four reference ET inputs.
const NO_ET = { solarMj: null, dewC: null, rhPct: null, windMs: null };

function powerBody(overrides: Record<string, unknown> = {}): unknown {
	return {
		type: "Feature",
		geometry: { type: "Point", coordinates: [-100.74, 38.05, 858.35] },
		properties: {
			parameter: {
				T2M_MAX: { "19810102": 14.24, "19810101": 8.44, "19810103": -999 },
				T2M_MIN: { "19810101": -4.1, "19810102": -2.5, "19810103": -6.0 },
				PRECTOTCORR: { "19810101": 0, "19810102": 1.25, "19810103": 0.4 },
			},
		},
		header: { fill_value: -999, start: "19810101", end: "19810103" },
		...overrides,
	};
}

describe("lastFullYear", () => {
	it("is the year before the current UTC year", () => {
		expect(lastFullYear(new Date("2026-11-14T12:00:00Z"))).toBe(2025);
		expect(lastFullYear(new Date("2026-01-01T00:00:00Z"))).toBe(2025);
		expect(lastFullYear(new Date("2025-12-31T23:59:59Z"))).toBe(2024);
	});
});

describe("buildPowerUrl", () => {
	it("asks the daily point API for whole years of the seven parameters", () => {
		const url = new URL(buildPowerUrl({ lat: 38.05, lon: -100.74 }, 1981, 2025));
		expect(`${url.origin}${url.pathname}`).toBe(
			"https://power.larc.nasa.gov/api/temporal/daily/point",
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			parameters: "T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,T2MDEW,RH2M,WS2M",
			community: "AG",
			latitude: "38.05",
			longitude: "-100.74",
			start: "19810101",
			end: "20251231",
			format: "JSON",
		});
	});
});

describe("parsePowerDaily", () => {
	it("returns the elevation and one record per day, in date order", () => {
		const { elevationM, days } = parsePowerDaily(powerBody());
		expect(elevationM).toBe(858.35);
		expect(days).toEqual([
			{ date: "19810101", tmaxC: 8.44, tminC: -4.1, rainMm: 0, ...NO_ET },
			{ date: "19810102", tmaxC: 14.24, tminC: -2.5, rainMm: 1.25, ...NO_ET },
			{ date: "19810103", tmaxC: null, tminC: -6, rainMm: 0.4, ...NO_ET },
		]);
	});

	it("reads the four reference ET inputs when the answer has them", () => {
		// Values copied from a real answer for 1 July 1984 and 1 January 1981 at 37.97, -100.72
		// (2026-11-14). The sunlight series holds the fill value before 1984.
		const body = powerBody({
			properties: {
				parameter: {
					T2M_MAX: { "19840701": 28.29, "19810101": 8.44 },
					T2M_MIN: { "19840701": 18.97, "19810101": -1.43 },
					PRECTOTCORR: { "19840701": 0.5, "19810101": 0 },
					ALLSKY_SFC_SW_DWN: { "19840701": 21.79, "19810101": -999 },
					T2MDEW: { "19840701": 12.31, "19810101": -5.43 },
					RH2M: { "19840701": 50.29, "19810101": 53.91 },
					WS2M: { "19840701": 4.01, "19810101": 2.57 },
				},
			},
		});
		expect(parsePowerDaily(body).days).toEqual([
			{
				date: "19810101",
				tmaxC: 8.44,
				tminC: -1.43,
				rainMm: 0,
				solarMj: null,
				dewC: -5.43,
				rhPct: 53.91,
				windMs: 2.57,
			},
			{
				date: "19840701",
				tmaxC: 28.29,
				tminC: 18.97,
				rainMm: 0.5,
				solarMj: 21.79,
				dewC: 12.31,
				rhPct: 50.29,
				windMs: 4.01,
			},
		]);
	});

	it("uses the fill value the header names", () => {
		const body = powerBody({ header: { fill_value: 8.44 } });
		const { days } = parsePowerDaily(body);
		expect(days[0].tmaxC).toBeNull();
		// -999 is an ordinary number once the header names another fill value.
		expect(days[2].tmaxC).toBe(-999);
	});

	it("treats a day missing from one parameter as a missing value", () => {
		const body = powerBody({
			properties: {
				parameter: {
					T2M_MAX: { "19810101": 8.44 },
					T2M_MIN: {},
					PRECTOTCORR: { "19810101": 0 },
				},
			},
		});
		expect(parsePowerDaily(body).days).toEqual([
			{ date: "19810101", tmaxC: 8.44, tminC: null, rainMm: 0, ...NO_ET },
		]);
	});

	it.each([
		["not an object", null],
		["an error answer", { header: "failed", messages: ["bad parameter"] }],
		["no elevation", powerBody({ geometry: { coordinates: [-100.74, 38.05] } })],
		[
			"a missing parameter",
			powerBody({ properties: { parameter: { T2M_MAX: {}, T2M_MIN: {} } } }),
		],
		[
			"no days",
			powerBody({
				properties: {
					parameter: { T2M_MAX: {}, T2M_MIN: {}, PRECTOTCORR: {} },
				},
			}),
		],
	])("rejects %s with an UpstreamError", (_name, body) => {
		expect(() => parsePowerDaily(body)).toThrow(UpstreamError);
	});
});
