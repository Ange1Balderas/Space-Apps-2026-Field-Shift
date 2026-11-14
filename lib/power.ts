// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// NASA POWER daily point API: building the request and reading the answer.
// Docs: https://power.larc.nasa.gov/docs/services/api/
//
// Server only. The browser never calls POWER; it calls /api/climate (CLAUDE.md rule 4).

import type { DailyWeather } from "@/lib/indicators";

export const POWER_DAILY_ENDPOINT =
	"https://power.larc.nasa.gov/api/temporal/daily/point";

// SPEC.md, "Thresholds": "Analysis window: 1981 to the last full year. POWER record start."
export const POWER_FIRST_YEAR = 1981;

// Only what Phase 1 computes from. Phase 3 adds the four reference ET inputs
// (ALLSKY_SFC_SW_DWN, T2MDEW, RH2M, WS2M) listed in SPEC.md, "Data sources".
export const POWER_PARAMETERS = ["T2M_MAX", "T2M_MIN", "PRECTOTCORR"] as const;

// CLAUDE.md rule 4: every external call has a 15-second timeout.
export const POWER_TIMEOUT_MS = 15_000;

export type PowerErrorKind = "timeout" | "unavailable" | "unexpected";

/** A failed POWER request. `message` is plain language and safe to show to a person. */
export class PowerError extends Error {
	readonly kind: PowerErrorKind;

	constructor(kind: PowerErrorKind, message: string) {
		super(message);
		this.name = "PowerError";
		this.kind = kind;
	}
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UNEXPECTED_ANSWER =
	"NASA POWER sent an answer this tool could not read.";

/**
 * Turns a POWER daily JSON answer into daily records. Values equal to POWER's fill value
 * (-999 unless the header says otherwise) become null. Throws a PowerError when the answer
 * does not have the expected shape.
 */
export function parsePowerDaily(body: unknown): PowerDaily {
	if (!isRecord(body)) throw new PowerError("unexpected", UNEXPECTED_ANSWER);

	const geometry = isRecord(body.geometry) ? body.geometry : {};
	const coordinates = Array.isArray(geometry.coordinates)
		? geometry.coordinates
		: [];
	const elevationM = coordinates[2];

	const properties = isRecord(body.properties) ? body.properties : {};
	const parameter = isRecord(properties.parameter) ? properties.parameter : {};
	const [tmax, tmin, rain] = POWER_PARAMETERS.map((name) => parameter[name]);

	if (
		typeof elevationM !== "number" ||
		!Number.isFinite(elevationM) ||
		!isRecord(tmax) ||
		!isRecord(tmin) ||
		!isRecord(rain)
	) {
		throw new PowerError("unexpected", UNEXPECTED_ANSWER);
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
	if (dates.length === 0) throw new PowerError("unexpected", UNEXPECTED_ANSWER);

	const days = dates.map((date) => ({
		date,
		tmaxC: read(tmax[date]),
		tminC: read(tmin[date]),
		rainMm: read(rain[date]),
	}));
	return { elevationM, days };
}

function isAbort(error: unknown): boolean {
	return (
		isRecord(error) &&
		(error.name === "TimeoutError" || error.name === "AbortError")
	);
}

const TIMED_OUT = "NASA POWER did not answer within 15 seconds.";

/**
 * Fetches daily weather for a point from 1 January of `startYear` to 31 December of
 * `endYear` in one request. Timed on 2026-11-14 for 1981 to 2025: about 0.8 to 1.0 seconds
 * at four Kansas points, so the request is not split by decade (SPEC.md, Phase 1).
 * The 15-second limit covers the whole exchange, headers and body.
 */
export async function fetchPowerDaily(
	point: { lat: number; lon: number },
	startYear: number,
	endYear: number,
): Promise<PowerDaily> {
	const signal = AbortSignal.timeout(POWER_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(buildPowerUrl(point, startYear, endYear), {
			signal,
			headers: { Accept: "application/json" },
		});
	} catch (error) {
		if (isAbort(error)) throw new PowerError("timeout", TIMED_OUT);
		throw new PowerError("unavailable", "NASA POWER could not be reached.");
	}

	if (!response.ok) {
		throw new PowerError(
			"unavailable",
			`NASA POWER answered with an error (HTTP ${response.status}).`,
		);
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch (error) {
		if (isAbort(error)) throw new PowerError("timeout", TIMED_OUT);
		throw new PowerError("unexpected", UNEXPECTED_ANSWER);
	}
	return parsePowerDaily(body);
}
