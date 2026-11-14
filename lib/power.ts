// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// NASA POWER daily point API: building the request and reading the answer.
// Docs: https://power.larc.nasa.gov/docs/services/api/
//
// Server only. The browser never calls POWER; it calls /api/climate (CLAUDE.md rule 4).

import type { DailyWeather } from "@/lib/indicators";
import { fetchUpstreamJson, isRecord, UpstreamError } from "@/lib/upstream";

export const POWER_DAILY_ENDPOINT =
	"https://power.larc.nasa.gov/api/temporal/daily/point";

// SPEC.md, "Thresholds": "Analysis window: 1981 to the last full year. POWER record start."
export const POWER_FIRST_YEAR = 1981;

// The first three feed the yearly indicators. The last four are the reference ET inputs
// (SPEC.md, "Data sources" and "Formulas", item 1). Measured on 2026-11-14 at 37.97, -100.72
// for 1981 to 2025: one request for all seven took 1.3 seconds (1.9 MB). The answer's own
// header gives the units: °C, mm/day, MJ/m^2/day (community AG), °C, % and m/s. The sunlight
// series is -999 on every day of 1981 to 1983 and complete from 1984, so reference ET
// starts in 1984; the other six had no gap.
export const POWER_PARAMETERS = [
	"T2M_MAX",
	"T2M_MIN",
	"PRECTOTCORR",
	"ALLSKY_SFC_SW_DWN",
	"T2MDEW",
	"RH2M",
	"WS2M",
] as const;

const SERVICE = "NASA POWER";

export type PowerDaily = {
	/** Elevation POWER reports for the point: the average of its MERRA-2 grid cell, in metres. */
	elevationM: number;
	/** One record per day, in date order. */
	days: DailyWeather[];
};

/** The last calendar year that has fully ended, by the UTC date. */
export function lastFullYear(now: Date): number {
	return now.getUTCFullYear() - 1;
}

export function buildPowerUrl(
	point: { lat: number; lon: number },
	startYear: number,
	endYear: number,
): string {
	const query = new URLSearchParams({
		parameters: POWER_PARAMETERS.join(","),
		community: "AG",
		latitude: String(point.lat),
		longitude: String(point.lon),
		start: `${startYear}0101`,
		end: `${endYear}1231`,
		format: "JSON",
	});
	return `${POWER_DAILY_ENDPOINT}?${query.toString()}`;
}

const unexpected = () =>
	new UpstreamError(
		"unexpected",
		`${SERVICE} sent an answer this tool could not read.`,
	);

/**
 * Turns a POWER daily JSON answer into daily records. Values equal to POWER's fill value
 * (-999 unless the header says otherwise) become null. Throws an UpstreamError when the
 * answer does not have the expected shape.
 */
export function parsePowerDaily(body: unknown): PowerDaily {
	if (!isRecord(body)) throw unexpected();

	const geometry = isRecord(body.geometry) ? body.geometry : {};
	const coordinates = Array.isArray(geometry.coordinates)
		? geometry.coordinates
		: [];
	const elevationM = coordinates[2];

	const properties = isRecord(body.properties) ? body.properties : {};
	const parameter = isRecord(properties.parameter) ? properties.parameter : {};
	const [tmax, tmin, rain, solar, dew, humidity, wind] = POWER_PARAMETERS.map(
		(name) => parameter[name],
	);

	// Temperature and rain are required. A missing reference ET input is not an error: its
	// values are null, and the days it covers have no reference ET.
	if (
		typeof elevationM !== "number" ||
		!Number.isFinite(elevationM) ||
		!isRecord(tmax) ||
		!isRecord(tmin) ||
		!isRecord(rain)
	) {
		throw unexpected();
	}

	const header = isRecord(body.header) ? body.header : {};
	const fillValue =
		typeof header.fill_value === "number" ? header.fill_value : -999;
	const read = (value: unknown): number | null =>
		typeof value === "number" && Number.isFinite(value) && value !== fillValue
			? value
			: null;

	const dates = Object.keys(tmax)
		.filter((date) => /^\d{8}$/.test(date))
		.sort();
	if (dates.length === 0) throw unexpected();

	const optional = (series: unknown, date: string): number | null =>
		isRecord(series) ? read(series[date]) : null;

	const days = dates.map((date) => ({
		date,
		tmaxC: read(tmax[date]),
		tminC: read(tmin[date]),
		rainMm: read(rain[date]),
		solarMj: optional(solar, date),
		dewC: optional(dew, date),
		rhPct: optional(humidity, date),
		windMs: optional(wind, date),
	}));
	return { elevationM, days };
}

/**
 * Fetches daily weather for a point from 1 January of `startYear` to 31 December of
 * `endYear` in one request. Timed on 2026-11-14 for 1981 to 2025: about 0.8 to 1.0 seconds
 * at four Kansas points with three parameters and 1.3 seconds with all seven, so the
 * request is not split by decade (SPEC.md, Phase 1).
 */
export async function fetchPowerDaily(
	point: { lat: number; lon: number },
	startYear: number,
	endYear: number,
): Promise<PowerDaily> {
	const body = await fetchUpstreamJson(
		SERVICE,
		buildPowerUrl(point, startYear, endYear),
		{ headers: { Accept: "application/json" } },
	);
	return parsePowerDaily(body);
}
