// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// NASA's vegetation layer on the map (SPEC.md, feature 13): the vegetation index (NDVI) from
// the MODIS instrument on the Terra satellite, served as map tiles by NASA GIBS. The browser
// loads the tiles straight from GIBS, as SPEC.md's architecture says.
//
// Everything about the layer comes from data/vegetation-layer.json, which
// scripts/gibs-vegetation-layer.mjs writes from GIBS's own documents: the dates the layer
// has, its colour scale and NASA's description of it. The file is checked when this module
// loads, so a broken file stops the build and the tests.
//
// The layer is a picture only. No score reads it.

import layerJson from "@/data/vegetation-layer.json";
import { KANSAS_BOUNDS } from "@/lib/kansas";

export type VegetationPeriod = {
	/** First day of the first picture in the period, YYYY-MM-DD. */
	start: string;
	/** First day of the last picture in the period. */
	end: string;
	/** Days from one picture to the next. */
	stepDays: number;
};

export type VegetationStop = { value: number; rgb: [number, number, number] };

export type VegetationLayer = {
	/** The layer's name in GIBS. */
	layer: string;
	title: string;
	subtitle: string;
	measurement: string;
	/** How long one picture covers, in NASA's words, for example "16-Day". */
	period: string;
	/** The size of one reading, in NASA's words, for example "250m". */
	resolution: string;
	product: { shortName: string; title: string } | null;
	/** Tile address with {date}, {z}, {y} and {x} to fill in. */
	tileUrl: string;
	/** The deepest zoom level GIBS has tiles for. */
	maxZoom: number;
	periods: VegetationPeriod[];
	legend: {
		minLabel: string;
		maxLabel: string;
		stops: VegetationStop[];
		/** Readings below this are drawn clear, or null when every reading has a colour. */
		clearBelow: number | null;
	};
	/** When the file was written from GIBS, as an ISO time. */
	readAt: string;
	readFrom: string[];
};

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

/** A real calendar day written as YYYY-MM-DD. */
export function isIsoDay(value: unknown): value is string {
	if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
	const time = Date.parse(`${value}T00:00:00Z`);
	return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

const dayTime = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** What is wrong with a vegetation layer file, in plain words. An empty list means it is sound. */
export function vegetationProblems(value: unknown): string[] {
	if (!isRecord(value)) return ["vegetation layer: expected an object"];
	const problems: string[] = [];
	for (const key of ["layer", "title", "subtitle", "measurement", "period", "resolution", "readAt"]) {
		if (!isText(value[key])) problems.push(`vegetation layer.${key}: expected text`);
	}
	const tileUrl = value.tileUrl;
	if (
		!isText(tileUrl) ||
		!tileUrl.startsWith("https://") ||
		!["{date}", "{z}", "{y}", "{x}"].every((part) => tileUrl.includes(part))
	) {
		problems.push("vegetation layer.tileUrl: expected an https address with {date}, {z}, {y} and {x}");
	}
	if (!Number.isInteger(value.maxZoom) || (value.maxZoom as number) < 0) {
		problems.push("vegetation layer.maxZoom: expected a zoom level");
	}
	if (!Array.isArray(value.periods) || value.periods.length === 0) {
		problems.push("vegetation layer.periods: expected at least one period");
	} else {
		value.periods.forEach((period: unknown, index) => {
			const where = `vegetation layer.periods[${index}]`;
			if (
				!isRecord(period) ||
				!isIsoDay(period.start) ||
				!isIsoDay(period.end) ||
				!Number.isInteger(period.stepDays) ||
				(period.stepDays as number) <= 0
			) {
				problems.push(`${where}: expected { start, end, stepDays } with two real days and a whole number of days`);
				return;
			}
			const span = dayTime(period.end) - dayTime(period.start);
			if (span < 0 || span % ((period.stepDays as number) * DAY_MS) !== 0) {
				problems.push(`${where}: the last day is not a whole number of steps after the first`);
			}
		});
	}
	const legend = value.legend;
	if (!isRecord(legend) || !isText(legend.minLabel) || !isText(legend.maxLabel)) {
		problems.push("vegetation layer.legend: expected { minLabel, maxLabel, stops }");
	} else if (!Array.isArray(legend.stops) || legend.stops.length < 2) {
		problems.push("vegetation layer.legend.stops: expected at least two colours");
	} else {
		let previous = Number.NEGATIVE_INFINITY;
		legend.stops.forEach((stop: unknown, index) => {
			const where = `vegetation layer.legend.stops[${index}]`;
			const rgb = isRecord(stop) ? stop.rgb : null;
			if (
				!isRecord(stop) ||
				typeof stop.value !== "number" ||
				!Array.isArray(rgb) ||
				rgb.length !== 3 ||
				!rgb.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
			) {
				problems.push(`${where}: expected { value, rgb } with three whole numbers from 0 to 255`);
				return;
			}
			if (stop.value <= previous) problems.push(`${where}: the values have to rise`);
			previous = stop.value;
		});
	}
	return problems;
}

function load(value: unknown): VegetationLayer {
	const problems = vegetationProblems(value);
	if (problems.length > 0) {
		throw new Error(
			`data/vegetation-layer.json is not in the expected shape:\n  ${problems.join("\n  ")}`,
		);
	}
	return value as VegetationLayer;
}

export const VEGETATION: VegetationLayer = load(layerJson);

/** The id of the map source and of the map layer that draw the pictures. */
export const VEGETATION_SOURCE_ID = "nasa-vegetation";

/** Every day the layer has a picture for, oldest first. Only these are offered. */
export function vegetationDates(periods: readonly VegetationPeriod[]): string[] {
	const days: string[] = [];
	for (const period of periods) {
		const last = dayTime(period.end);
		for (let time = dayTime(period.start); time <= last; time += period.stepDays * DAY_MS) {
			days.push(new Date(time).toISOString().slice(0, 10));
		}
	}
	return days;
}

export const VEGETATION_DATES: readonly string[] = vegetationDates(VEGETATION.periods);

/** The newest picture: what the layer shows when it is first switched on. */
export const LATEST_VEGETATION_DATE = VEGETATION_DATES[VEGETATION_DATES.length - 1];

/** The years that have a picture, newest first. */
export function vegetationYears(dates: readonly string[]): number[] {
	return [...new Set(dates.map((day) => Number(day.slice(0, 4))))].sort((a, b) => b - a);
}

/** The pictures of one year, oldest first. */
export function datesOfYear(dates: readonly string[], year: number): string[] {
	return dates.filter((day) => Number(day.slice(0, 4)) === year);
}

/**
 * The picture of `year` whose month and day are nearest to those of `day`, so that changing
 * the year keeps the time of year. Null when the year has no picture.
 */
export function nearestInYear(
	dates: readonly string[],
	year: number,
	day: string,
): string | null {
	const candidates = datesOfYear(dates, year);
	if (candidates.length === 0) return null;
	// Days into the year, on a common year, so that years compare month for month.
	const intoYear = (value: string) =>
		(Date.parse(`2001-${value.slice(5)}T00:00:00Z`) - Date.parse("2001-01-01T00:00:00Z")) / DAY_MS;
	// 29 February has no place in the common year: it is read as 28 February.
	const safe = (value: string) => (value.slice(5) === "02-29" ? `${value.slice(0, 4)}-02-28` : value);
	const target = intoYear(safe(day));
	return candidates.reduce((best, candidate) =>
		Math.abs(intoYear(safe(candidate)) - target) < Math.abs(intoYear(safe(best)) - target)
			? candidate
			: best,
	);
}

/** The tile address for one day, with {z}, {y} and {x} left for the map to fill in. */
export function vegetationTileUrl(day: string, layer: Pick<VegetationLayer, "tileUrl"> = VEGETATION): string {
	return layer.tileUrl.replace("{date}", day);
}

/** The Web Mercator tile that holds a point at a zoom level. */
export function tileAt(lat: number, lon: number, zoom: number): { x: number; y: number; z: number } {
	const count = 2 ** zoom;
	const latRad = (lat * Math.PI) / 180;
	const x = Math.floor(((lon + 180) / 360) * count);
	const y = Math.floor(
		((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * count,
	);
	return { x: Math.min(count - 1, Math.max(0, x)), y: Math.min(count - 1, Math.max(0, y)), z: zoom };
}

// One tile over the middle of Kansas, asked for before the layer is drawn: if NASA cannot
// serve it, the layer says so instead of leaving a blank map.
const PROBE_ZOOM = 5;
const [[WEST, SOUTH], [EAST, NORTH]] = KANSAS_BOUNDS;

/** The address of one tile over the middle of Kansas for a day. */
export function vegetationProbeUrl(day: string, layer: Pick<VegetationLayer, "tileUrl"> = VEGETATION): string {
	const tile = tileAt((SOUTH + NORTH) / 2, (WEST + EAST) / 2, PROBE_ZOOM);
	return vegetationTileUrl(day, layer)
		.replace("{z}", String(tile.z))
		.replace("{y}", String(tile.y))
		.replace("{x}", String(tile.x));
}

/** The colour scale as a CSS gradient, left to right, from the first stop to the last. */
export function legendGradient(stops: readonly VegetationStop[]): string {
	const first = stops[0].value;
	const span = stops[stops.length - 1].value - first;
	const parts = stops.map((stop) => {
		const share = span === 0 ? 0 : ((stop.value - first) / span) * 100;
		return `rgb(${stop.rgb.join(" ")}) ${Math.round(share * 10) / 10}%`;
	});
	return `linear-gradient(to right, ${parts.join(", ")})`;
}

const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

/** A day as "October 16", or "October 16, 2026" with the year. */
export function formatVegetationDay(day: string, withYear = false): string {
	const month = MONTHS[Number(day.slice(5, 7)) - 1];
	const date = Number(day.slice(8, 10));
	return withYear ? `${month} ${date}, ${day.slice(0, 4)}` : `${month} ${date}`;
}
