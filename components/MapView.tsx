"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.

import "maplibre-gl/dist/maplibre-gl.css";
import { useRef, useState } from "react";
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

// Space kept between Kansas and the edge of the map, in pixels.
const FIT_OPTIONS = { padding: 24 };

type MapStatus = "loading" | "ready" | "error";

// Read out by screen readers. The error state announces itself through the
// notice's role="alert", so it needs no text here.
const STATUS_MESSAGE: Record<MapStatus, string> = {
	loading: "Loading the map of Kansas",
	ready: "Map of Kansas loaded",
	error: "",
};

export function MapView() {
	const [status, setStatus] = useState<MapStatus>("loading");
	// True once a person has panned or zoomed. Until then the view belongs to the tool.
	const movedByUser = useRef(false);

	return (
		<section aria-label="Map of Kansas" className="relative h-full w-full">
			{/* Always on the page: a live region only announces changes made after it exists. */}
			<p role="status" className="sr-only">
				{STATUS_MESSAGE[status]}
			</p>

			{/* MapLibre clips the browser's default focus outline, so the canvas gets an inset one.
			    While the error notice covers the map, the map is taken out of the tab order. */}
			<div
				inert={status === "error"}
				className="h-full w-full [&_canvas]:focus-visible:outline-2 [&_canvas]:focus-visible:-outline-offset-2 [&_canvas]:focus-visible:outline-ring"
			>
				<MapGL
					initialViewState={{
						bounds: KANSAS_BOUNDS,
						fitBoundsOptions: FIT_OPTIONS,
					}}
					mapStyle={BASEMAP_STYLE_URL}
					style={{ width: "100%", height: "100%" }}
					onLoad={() => setStatus("ready")}
					onMoveStart={(event) => {
						// MapLibre attaches the browser event only when a person moved the map.
						if (event.originalEvent) movedByUser.current = true;
					}}
					onResize={(event) => {
						// The first fit uses the size the map had when it was created. If the panel
						// changes size before anyone has moved the map, fit Kansas again.
						if (!movedByUser.current) {
							event.target.fitBounds(KANSAS_BOUNDS, {
								...FIT_OPTIONS,
								animate: false,
							});
						}
					}}
					onError={(event) => {
						// One failed tile also arrives here. That is not a failed map.
						if ("tile" in event) return;
						// Once the map has loaded there is something to show, so keep showing it.
						setStatus((current) => (current === "ready" ? current : "error"));
					}}
				>
					<NavigationControl position="top-right" showCompass={false} />
				</MapGL>
			</div>

			{/* z-10 keeps both overlays above MapLibre's own controls, which sit at z-index 2.
			    The placeholder pulses between solid and half transparent, so it sits on a solid
			    backing that hides the half-drawn map and its controls. */}
			{status === "loading" ? (
				<div aria-hidden="true" className="absolute inset-0 z-10 bg-background">
					<Skeleton className="h-full w-full rounded-none" />
				</div>
			) : null}

			{status === "error" ? (
				<div className="absolute inset-0 z-10 flex items-start justify-center bg-background p-4">
					<div className="w-full max-w-md">
						<ErrorState
							title="The map could not be loaded"
							error={new Error("Check your connection, then try again.")}
							onRetry={() => window.location.reload()}
						/>
					</div>
				</div>
			) : null}
		</section>
	);
}
