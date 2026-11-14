"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.

import "maplibre-gl/dist/maplibre-gl.css";
import { useState } from "react";
import MapGL, { NavigationControl } from "react-map-gl/maplibre";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";

// OpenFreeMap Positron: the muted basemap SPEC.md names under "UI rules". No API key.
const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Bounding box of the State of Kansas, longitude and latitude in degrees: [[west, south], [east, north]].
// Source: U.S. Census Bureau TIGERweb, State_County map service, "States" layer, extent of
// STUSAB = 'KS' with outSR=4326, retrieved 2026-11-14 and rounded to 6 decimal places:
// https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query?where=STUSAB%3D%27KS%27&returnExtentOnly=true&outSR=4326&f=json
const KANSAS_BOUNDS: [[number, number], [number, number]] = [
	[-102.051769, 36.993016],
	[-94.588387, 40.003166],
];

type MapStatus = "loading" | "ready" | "error";

export function MapView() {
	const [status, setStatus] = useState<MapStatus>("loading");

	return (
		<section aria-label="Map of Kansas" className="relative h-full w-full">
			<MapGL
				initialViewState={{
					bounds: KANSAS_BOUNDS,
					fitBoundsOptions: { padding: 24 },
				}}
				mapStyle={BASEMAP_STYLE_URL}
				style={{ width: "100%", height: "100%" }}
				onLoad={() => setStatus("ready")}
				// MapLibre also reports single failed tiles here. Only a failure before the
				// first load means there is no map to show.
				onError={() =>
					setStatus((current) => (current === "ready" ? current : "error"))
				}
			>
				<NavigationControl position="top-right" showCompass={false} />
			</MapGL>

			{status === "loading" ? (
				<output aria-live="polite" className="absolute inset-0 block">
					<span className="sr-only">Loading the map of Kansas</span>
					<Skeleton className="h-full w-full rounded-none" />
				</output>
			) : null}

			{status === "error" ? (
				<div className="absolute inset-0 flex items-start justify-center bg-background p-4">
					<div className="w-full max-w-md">
						<ErrorState
							title="The map could not be loaded"
							error={
								new Error(
									"The base map service did not respond. Check your connection, then try again.",
								)
							}
							onRetry={() => window.location.reload()}
						/>
					</div>
				</div>
			) : null}
		</section>
	);
}
