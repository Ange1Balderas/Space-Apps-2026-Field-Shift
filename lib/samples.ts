// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Sample fields: points whose data is cached in public/data/samples/, so the demo never
// depends on a live service (SPEC.md, user flow step 2).

import type {
	ClimateResponse,
	HistoryResponse,
	SoilResponse,
} from "@/lib/types";

export type SampleField = {
	id: string;
	name: string;
	lat: number;
	lon: number;
	/** Public path of the cached file. */
	file: string;
};

/** Shape of public/data/samples/{id}.json: the three route answers for the sample's point. */
export type SampleFieldFile = {
	id: string;
	name: string;
	lat: number;
	lon: number;
	climate: ClimateResponse;
	history: HistoryResponse;
	soil: SoilResponse;
};

// One point in each county SPEC.md names ("Sample fields"). Angel confirmed all three on
// 2026-11-14. How they were chosen, on the same day:
//   1. A 6 by 6 grid of points inside each county's bounding box (Census TIGERweb) was sent
//      to the Cropland Data Layer service the app uses (lib/cropland.ts).
//   2. A point qualified when each of its newest 8 years (2018 to 2025) was a crop from
//      SPEC.md's rotation library or one of their double crops, or fallow. Fallow counts:
//      its class is named "Fallow/Idle Cropland" and it is part of the wheat rotations.
//   3. Among those, the point whose 8 years best fit SPEC.md's description of the county
//      was taken, then moved up to 260 m until the four points 60 m around it showed the
//      same 8 years, so it sits inside a field and not on an edge.
// Their 8 years: Finney is corn every year; Thomas alternates winter wheat and fallow, with
// sorghum in 2025; Brown alternates corn and soybeans. The Cropland Data Layer does not say
// whether a field is irrigated, so nothing here claims that.
export const SAMPLE_FIELDS: readonly SampleField[] = [
	{
		id: "finney",
		name: "Finney County",
		lat: 37.96548,
		lon: -100.72299,
		file: "/data/samples/finney.json",
	},
	{
		id: "thomas",
		name: "Thomas County",
		lat: 39.43677,
		lon: -101.1914,
		file: "/data/samples/thomas.json",
	},
	{
		id: "brown",
		name: "Brown County",
		lat: 39.84979,
		lon: -95.47566,
		file: "/data/samples/brown.json",
	},
];

export function findSampleField(id: string): SampleField | undefined {
	return SAMPLE_FIELDS.find((sample) => sample.id === id);
}
