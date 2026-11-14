// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Sample fields: points whose data is cached in public/data/samples/, so the demo never
// depends on a live service (SPEC.md, user flow step 2).

import type { ClimateResponse } from "@/lib/types";

export type SampleField = {
	id: string;
	name: string;
	lat: number;
	lon: number;
	/** Public path of the cached file. */
	file: string;
};

/** Shape of public/data/samples/{id}.json. Phase 2 adds the crop history and soil answers. */
export type SampleFieldFile = {
	id: string;
	name: string;
	lat: number;
	lon: number;
	climate: ClimateResponse;
};

// PROVISIONAL point for Phase 1: the Census Bureau's internal point for Finney County, Kansas.
// Source: U.S. Census Bureau TIGERweb, State_County map service, "Counties" layer, GEOID 20055,
// INTPTLAT +38.0498075 and INTPTLON -100.7399674, retrieved 2026-11-14, rounded to 4 decimals:
// https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?where=GEOID%3D%2720055%27&outFields=NAME,GEOID,INTPTLAT,INTPTLON&returnGeometry=false&f=json
// It has not been checked against the Cropland Data Layer. In Phase 2 a point that shows
// cropland in all 8 years replaces it, with Thomas and Brown counties (SPEC.md, "Sample fields").
export const SAMPLE_FIELDS: readonly SampleField[] = [
	{
		id: "finney",
		name: "Finney County",
		lat: 38.0498,
		lon: -100.74,
		file: "/data/samples/finney.json",
	},
];

export function findSampleField(id: string): SampleField | undefined {
	return SAMPLE_FIELDS.find((sample) => sample.id === id);
}
