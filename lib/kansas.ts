// AI-assisted: written with Claude, reviewed by Angel Balderas.

// Bounding box of the State of Kansas, longitude and latitude in degrees: [[west, south], [east, north]].
// Source: U.S. Census Bureau TIGERweb, State_County map service, "States" layer, extent of
// STUSAB = 'KS' with outSR=4326, retrieved 2026-11-14 and rounded to 6 decimal places:
// https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query?where=STUSAB%3D%27KS%27&returnExtentOnly=true&outSR=4326&f=json
export const KANSAS_BOUNDS: [[number, number], [number, number]] = [
	[-102.051769, 36.993016],
	[-94.588387, 40.003166],
];

/**
 * True when the point is inside the Kansas bounding box.
 *
 * This is a rectangle, not the state line. The north-east corner of Kansas follows the
 * Missouri River, so a small piece of Missouri sits inside the box and passes this check.
 * The exact border test waits for the county boundary file (see SPEC.md, feature 1).
 */
export function isInKansasBounds(lat: number, lon: number): boolean {
	const [[west, south], [east, north]] = KANSAS_BOUNDS;
	return (
		Number.isFinite(lat) &&
		Number.isFinite(lon) &&
		lat >= south &&
		lat <= north &&
		lon >= west &&
		lon <= east
	);
}
