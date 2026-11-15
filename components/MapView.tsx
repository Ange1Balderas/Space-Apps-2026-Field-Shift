"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.

import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixedIcon, MapPinIcon, PlusIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import MapGL, {
	type MapRef,
	Marker,
	NavigationControl,
} from "react-map-gl/maplibre";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { selectionOf, useFieldStore } from "@/lib/field-store";
import { KANSAS_BOUNDS } from "@/lib/kansas";
import { locationProblem, locationResult } from "@/lib/location";
import { SAMPLE_FIELDS } from "@/lib/samples";

// OpenFreeMap Positron: the muted basemap SPEC.md names under "UI rules". No API key.
const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

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
	const mapRef = useRef<MapRef>(null);
	const keyboardHintId = useId();

	const selection = useFieldStore((state) => selectionOf(state.panel));
	const selectPoint = useFieldStore((state) => state.selectPoint);
	const selectSample = useFieldStore((state) => state.selectSample);

	// "Use my location": idle, asking the browser, or a sentence saying why no point was chosen.
	const [locating, setLocating] = useState(false);
	const [locationNote, setLocationNote] = useState("");
	const findMyLocation = () => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			setLocationNote(locationProblem(null));
			return;
		}
		setLocating(true);
		setLocationNote("");
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setLocating(false);
				const result = locationResult(
					position.coords.latitude,
					position.coords.longitude,
				);
				if (result.kind === "problem") {
					setLocationNote(result.message);
					return;
				}
				// Bring the point into view without animation, then choose it like a click.
				const map = mapRef.current;
				if (map) {
					map.jumpTo({
						center: [result.lon, result.lat],
						zoom: Math.max(map.getZoom(), 9),
					});
				}
				selectPoint(result.lat, result.lon);
			},
			(error) => {
				setLocating(false);
				setLocationNote(locationProblem(error.code));
			},
			// A field is large: the quick, coarse fix is enough, and an hour-old one will do.
			{ enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
		);
	};

	return (
		<section
			id="map"
			aria-label="Map of Kansas"
			className="relative h-full w-full scroll-mt-2"
		>
			{/* Always on the page: a live region only announces changes made after it exists. */}
			<p role="status" className="sr-only">
				{STATUS_MESSAGE[status]}
			</p>
			<p id={keyboardHintId} className="sr-only">
				Click the map to choose a field. With a keyboard, the arrow keys move
				the map, plus and minus zoom, and Enter chooses the point at the center.
			</p>

			{/* Sample fields load from cached files, so they stay usable above the loading
			    placeholder and above the error notice (both z-10). They come first in the page
			    order so the keyboard reaches them before the map, matching where they sit. */}
			<div className="pointer-events-none absolute top-3 left-3 z-20 max-w-[calc(100%-4.5rem)]">
			<fieldset className="m-0 border-0 p-0">
				{/* Only the legend and the buttons take clicks. The gaps around them stay part of the map. */}
				<legend className="pointer-events-auto mb-1 flex w-fit items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs font-medium">
					<MapPinIcon aria-hidden="true" className="size-3" />
					Sample fields
				</legend>
				<div className="flex flex-wrap gap-2">
					{SAMPLE_FIELDS.map((sample) => (
						<Button
							key={sample.id}
							type="button"
							variant="outline"
							size="sm"
							// Taller on a phone, and the chosen sample is marked for the eye as well.
							className="pointer-events-auto max-sm:h-10 aria-[current=true]:border-foreground/50 aria-[current=true]:bg-muted"
							aria-current={
								selection?.sampleId === sample.id ? "true" : undefined
							}
							onClick={() => selectSample(sample.id)}
						>
							{sample.name}
						</Button>
					))}
				</div>
			</fieldset>
				{/* Not a sample: it asks the browser where this device is, once. */}
				<div className="mt-2 flex flex-col items-start gap-1.5">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="pointer-events-auto max-sm:h-10"
						disabled={locating}
						onClick={findMyLocation}
					>
						<LocateFixedIcon aria-hidden="true" />
						{locating ? "Finding your location" : "Use my location"}
					</Button>
					{/* Always on the page, so a screen reader hears the sentence when it appears. */}
					<p
						role="status"
						className={
							locationNote
								? "pointer-events-auto max-w-xs rounded-md border bg-card px-2.5 py-1.5 text-xs"
								: "sr-only"
						}
					>
						{locationNote}
					</p>
				</div>
			</div>

			{/* MapLibre clips the browser's default focus outline, so the canvas gets an inset one.
			    While the error notice covers the map, the map is taken out of the tab order. */}
			<div
				inert={status === "error"}
				className="group relative h-full w-full [&_canvas]:focus-visible:outline-2 [&_canvas]:focus-visible:-outline-offset-2 [&_canvas]:focus-visible:outline-ring"
				onKeyDown={(event) => {
					// A mouse can click any point. A keyboard gets the same reach this way: Enter on
					// the focused map chooses the point under the crosshair at its center.
					if (event.key !== "Enter") return;
					if (!(event.target instanceof HTMLCanvasElement)) return;
					const center = mapRef.current?.getCenter().wrap();
					if (center) selectPoint(center.lat, center.lng);
				}}
			>
				<MapGL
					ref={mapRef}
					initialViewState={{
						bounds: KANSAS_BOUNDS,
						fitBoundsOptions: FIT_OPTIONS,
					}}
					mapStyle={BASEMAP_STYLE_URL}
					style={{ width: "100%", height: "100%" }}
					cursor="crosshair"
					onLoad={(event) => {
						event.target
							.getCanvas()
							.setAttribute("aria-describedby", keyboardHintId);
						setStatus("ready");
					}}
					onClick={(event) => {
						const point = event.lngLat.wrap();
						selectPoint(point.lat, point.lng);
					}}
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
					{selection ? (
						<Marker
							longitude={selection.lon}
							latitude={selection.lat}
							anchor="bottom"
						>
							{/* The one accent colour marks the chosen field (SPEC.md, "UI rules"). */}
							<MapPinIcon
								aria-hidden="true"
								strokeWidth={1.5}
								className="size-8 fill-chart-1 stroke-background drop-shadow-sm"
							/>
						</Marker>
					) : null}
				</MapGL>

				{/* Shown only while the map has keyboard focus: where Enter will choose. */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 hidden flex-col items-center justify-center group-has-[canvas:focus-visible]:flex"
				>
					<PlusIcon className="size-6 text-foreground" />
					<span className="absolute top-[calc(50%+1.25rem)] rounded-md border bg-card px-2 py-1 text-xs text-foreground shadow-xs">
						Press Enter to choose this point
					</span>
				</div>
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
				<div className="absolute inset-0 z-10 flex items-start justify-center bg-background p-4 pt-16">
					<div className="w-full max-w-md">
						<ErrorState
							title="The map could not be loaded"
							error={
								new Error(
									"Check your connection, then try again. The sample field still works without the map.",
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
