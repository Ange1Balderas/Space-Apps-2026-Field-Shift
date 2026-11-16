// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Which Kansas county a point is in, from public/data/counties.geojson (the U.S. Census
// Bureau's generalized county outlines, written by scripts/kansas_county_outlines.py). The
// county is the unit of the preprocessed NASA data (SPEC.md, "Design decisions": one small
// JSON file per county), so a chosen point is matched to its county here, in the browser.

export type County = { fips: string; name: string };

type Ring = [number, number][];
type Feature = {
	properties: { fips: string; name: string };
	geometry:
		| { type: "Polygon"; coordinates: Ring[] }
		| { type: "MultiPolygon"; coordinates: Ring[][] };
};
export type CountyCollection = { features: Feature[] };

export const COUNTIES_FILE = "/data/counties.geojson";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isPair = (value: unknown): value is [number, number] =>
	Array.isArray(value) &&
	value.length === 2 &&
	value.every((n) => typeof n === "number" && Number.isFinite(n));

const isRing = (value: unknown): value is Ring =>
	Array.isArray(value) && value.length >= 4 && value.every(isPair);

/** True when the value is a county collection this module can search. */
export function isCountyCollection(value: unknown): value is CountyCollection {
	if (!isRecord(value) || !Array.isArray(value.features)) return false;
	return value.features.every((feature) => {
		if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)) {
			return false;
		}
		const { fips, name } = feature.properties;
		if (typeof fips !== "string" || !/^20\d{3}$/.test(fips) || typeof name !== "string") {
			return false;
		}
		const { type, coordinates } = feature.geometry;
		if (type === "Polygon") return Array.isArray(coordinates) && coordinates.every(isRing);
		if (type === "MultiPolygon") {
			return (
				Array.isArray(coordinates) &&
				coordinates.every((polygon) => Array.isArray(polygon) && polygon.every(isRing))
			);
		}
		return false;
	});
}

/**
 * Even-odd test: a point is inside a ring when a line from it to the east crosses the ring
 * an odd number of times. Coordinates are GeoJSON order, [longitude, latitude].
 */
export function pointInRing(lon: number, lat: number, ring: Ring): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		const crosses = yi > lat !== yj > lat;
		if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

function pointInPolygon(lon: number, lat: number, polygon: Ring[]): boolean {
	// The first ring is the outer edge; any other ring is a hole.
	if (!pointInRing(lon, lat, polygon[0])) return false;
	return polygon.slice(1).every((hole) => !pointInRing(lon, lat, hole));
}

/** The county the point is in, or null when it is in none (outside Kansas, or on no outline). */
export function countyAt(lat: number, lon: number, counties: CountyCollection): County | null {
	for (const feature of counties.features) {
		const { geometry } = feature;
		const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
		if (polygons.some((polygon) => pointInPolygon(lon, lat, polygon))) {
			return { fips: feature.properties.fips, name: feature.properties.name };
		}
	}
	return null;
}

let loading: Promise<CountyCollection> | null = null;

/**
 * The county outlines, fetched once per page and shared by every lookup. A failed fetch is
 * forgotten, so the next lookup tries again.
 */
export function loadCounties(fetchJson: (url: string) => Promise<unknown>): Promise<CountyCollection> {
	if (!loading) {
		loading = fetchJson(COUNTIES_FILE).then(
			(body) => {
				if (!isCountyCollection(body)) {
					throw new Error("The county outlines arrived in a form this page could not read.");
				}
				return body;
			},
			(error: unknown) => {
				loading = null;
				throw error;
			},
		);
	}
	return loading;
}

/** For tests: forgets the shared outlines. */
export function resetCountiesForTests(): void {
	loading = null;
}
