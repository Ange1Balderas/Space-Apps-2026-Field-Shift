// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// "Use my location" (SPEC.md, user flow step 1). The browser asks the person for permission;
// this file only turns its answer into a point or into a plain sentence. The location is
// used once, to choose the field: it goes to this tool's own routes as a point, exactly like
// a click on the map, and is not stored.

import { isInKansasBounds } from "@/lib/kansas";

export type LocationResult =
	| { kind: "point"; lat: number; lon: number }
	| { kind: "problem"; message: string };

// The codes of the browser's GeolocationPositionError.
const DENIED = 1;
const UNAVAILABLE = 2;
const TIMED_OUT = 3;

/** What to say when the browser has no location to give. */
export function locationProblem(code: number | null): string {
	switch (code) {
		case DENIED:
			return "Location access was not allowed, so no point was chosen. Click the map or pick a sample field instead.";
		case UNAVAILABLE:
			return "This device could not work out where it is. Click the map or pick a sample field instead.";
		case TIMED_OUT:
			return "Finding your location took too long. Try again, or click the map.";
		default:
			return "This browser does not share a location with this page. Click the map or pick a sample field instead.";
	}
}

/** A position the browser gave: a point inside Kansas, or a sentence saying it is outside. */
export function locationResult(lat: number, lon: number): LocationResult {
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return { kind: "problem", message: locationProblem(UNAVAILABLE) };
	}
	if (!isInKansasBounds(lat, lon)) {
		return {
			kind: "problem",
			message:
				"Your location is outside Kansas, and this tool covers Kansas only. Click a spot inside the state or pick a sample field.",
		};
	}
	return { kind: "point", lat, lon };
}
