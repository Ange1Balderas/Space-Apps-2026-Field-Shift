// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Server-side access to the cached sample answers. The files are imported, not read from
// disk, so they are bundled with the API route on Vercel.

import { climatePoint, isClimateResponse } from "@/lib/climate";
import { SAMPLE_FIELDS } from "@/lib/samples";
import type { ClimateResponse } from "@/lib/types";
import finney from "@/public/data/samples/finney.json";

const SAMPLE_FILES: Record<string, unknown> = { finney };

/** The cached climate answer for a sample field at this point, or null if there is none. */
export function cachedClimateFor(
	lat: number,
	lon: number,
): ClimateResponse | null {
	const wanted = climatePoint(lat, lon);
	for (const sample of SAMPLE_FIELDS) {
		const at = climatePoint(sample.lat, sample.lon);
		if (at.lat !== wanted.lat || at.lon !== wanted.lon) continue;
		const file = SAMPLE_FILES[sample.id];
		if (
			typeof file === "object" &&
			file !== null &&
			"climate" in file &&
			isClimateResponse(file.climate)
		) {
			return file.climate;
		}
	}
	return null;
}
