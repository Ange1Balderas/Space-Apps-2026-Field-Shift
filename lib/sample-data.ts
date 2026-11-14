// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Server-side access to the cached sample answers. The files are imported, not read from
// disk, so they are bundled with the API routes on Vercel.

import { climatePoint, isClimateResponse } from "@/lib/climate";
import { isHistoryResponse, isSoilResponse } from "@/lib/contracts";
import { fieldPoint } from "@/lib/kansas";
import { SAMPLE_FIELDS } from "@/lib/samples";
import type {
	ClimateResponse,
	HistoryResponse,
	SoilResponse,
} from "@/lib/types";
import brown from "@/public/data/samples/brown.json";
import finney from "@/public/data/samples/finney.json";
import thomas from "@/public/data/samples/thomas.json";

const SAMPLE_FILES: Record<string, unknown> = { brown, finney, thomas };

type Rounding = (lat: number, lon: number) => { lat: number; lon: number };

/** The cached file of the sample field at this point, compared at the given precision. */
function sampleFileAt(
	lat: number,
	lon: number,
	round: Rounding,
): Record<string, unknown> | null {
	const wanted = round(lat, lon);
	for (const sample of SAMPLE_FIELDS) {
		const at = round(sample.lat, sample.lon);
		if (at.lat !== wanted.lat || at.lon !== wanted.lon) continue;
		const file = SAMPLE_FILES[sample.id];
		if (typeof file === "object" && file !== null) {
			return file as Record<string, unknown>;
		}
	}
	return null;
}

/** The cached climate answer for a sample field at this point, or null if there is none. */
export function cachedClimateFor(
	lat: number,
	lon: number,
): ClimateResponse | null {
	const climate = sampleFileAt(lat, lon, climatePoint)?.climate;
	return isClimateResponse(climate) ? climate : null;
}

/** The cached crop history for a sample field at this point, or null if there is none. */
export function cachedHistoryFor(
	lat: number,
	lon: number,
): HistoryResponse | null {
	const history = sampleFileAt(lat, lon, fieldPoint)?.history;
	return isHistoryResponse(history) ? history : null;
}

/** The cached soil answer for a sample field at this point, or null if there is none. */
export function cachedSoilFor(lat: number, lon: number): SoilResponse | null {
	const soil = sampleFileAt(lat, lon, fieldPoint)?.soil;
	return isSoilResponse(soil) ? soil : null;
}
