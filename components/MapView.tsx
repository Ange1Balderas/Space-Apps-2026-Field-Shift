"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.

import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixedIcon, MapPinIcon, PlusIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import MapGL, {
	Layer,
	type MapRef,
	Marker,
	NavigationControl,
	Source,
} from "react-map-gl/maplibre";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VegetationControl, type VegetationStatus } from "@/components/VegetationControl";
import { selectionOf, useFieldStore } from "@/lib/field-store";
import { KANSAS_BOUNDS } from "@/lib/kansas";
import { locationProblem, locationResult } from "@/lib/location";
import { SAMPLE_FIELDS } from "@/lib/samples";
import {
	isVegetationTileError,
	LATEST_VEGETATION_DATE,
	VEGETATION,
	VEGETATION_SOURCE_ID,
	vegetationProbeUrl,
	vegetationTileUrl,
} from "@/lib/vegetation";

// OpenFreeMap Positron: the muted basemap SPEC.md names under "UI rules". No API key.
const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Space kept between Kansas and the edge of the map, in pixels.
const FIT_OPTIONS = { padding: 24 };

// How long NASA is given to answer for the first vegetation tile (CLAUDE.md rule 4).
const VEGETATION_TIMEOUT_MS = 15_000;

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

	// NASA's vegetation layer (SPEC.md, feature 13). It is off until asked for. Before it is
	// drawn, one tile over the middle of Kansas is asked for: if NASA cannot serve it, the
	// control says so and the map stays as it was.
	const [vegetationOn, setVegetationOn] = useState(false);
	const [vegetationDay, setVegetationDay] = useState(LATEST_VEGETATION_DATE);
	// Counts the tries, so "Try again" asks NASA once more for the same day.
	const [vegetationTry, setVegetationTry] = useState(0);
	// The answer to the last question asked, with the question it answers.
	const [vegetationAnswer, setVegetationAnswer] = useState<{
		day: string;
		attempt: number;
		ok: boolean;
	} | null>(null);
	// The basemap layer the pictures go under: its first line layer, so rivers, roads, county
	// lines and place names stay on top of the picture and only the plain ground is covered.
	const [layerAbovePictures, setLayerAbovePictures] = useState<string | undefined>(undefined);
	// The question (day and try) for which the map reported a tile it could not load.
	const [vegetationGaps, setVegetationGaps] = useState<string | null>(null);
	const vegetationAsk = `${vegetationDay}:${vegetationTry}`;

	useEffect(() => {
		if (!vegetationOn) return;
		// True once the day has changed or the layer is off: an answer that arrives after that
		// belongs to a question nobody is asking any more.
		let superseded = false;
		const controller = new AbortController();
		const timer = window.setTimeout(() => controller.abort(), VEGETATION_TIMEOUT_MS);
		fetch(vegetationProbeUrl(vegetationDay), { signal: controller.signal })
			.then((response) => {
				// Only the answer is wanted. The map asks for its own copy of the tile.
				void response.body?.cancel();
				return response.ok;
			})
			// A network failure, or the timer's abort: NASA did not serve the tile in time.
			.catch(() => false)
			.then((ok) => {
				window.clearTimeout(timer);
				if (!superseded) {
					setVegetationAnswer({ day: vegetationDay, attempt: vegetationTry, ok });
				}
			});
		return () => {
			superseded = true;
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [vegetationOn, vegetationDay, vegetationTry]);

	const vegetationStatus: VegetationStatus = !vegetationOn
		? "off"
		: vegetationAnswer &&
				vegetationAnswer.day === vegetationDay &&
				vegetationAnswer.attempt === vegetationTry
			? vegetationAnswer.ok
				? "ready"
				: "failed"
			: "checking";

	// "Use my location": idle, asking the browser, or a sentence saying why no point was chosen.
	const [locating, setLocating] = useState(false);
	const [locationNote, setLocationNote] = useState("");
	const findMyLocation = () => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			setLocationNote(locationProblem(null));
			return;
		}
		if (locating) return;
		setLocating(true);
		// Said aloud by the status line below: a changed button label is not announced.
		setLocationNote("Finding your location.");
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
				setLocationNote("");
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
			{/* Both groups of controls share one column over the map: the samples and the
			    location button at the top, the vegetation layer at the bottom. When the map is
			    short the lower group gives way and scrolls inside itself, so it never covers
			    the upper one. The column stops above MapLibre's credits, which take two lines
			    on a phone and one on a wider screen. */}
			<div className="pointer-events-none absolute inset-x-3 top-3 bottom-14 z-20 flex flex-col justify-between gap-2 sm:bottom-9">
			<div className="max-w-[calc(100%-3rem)] shrink-0">
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
						// Not `disabled`: that would drop keyboard focus while the browser is asked.
						aria-disabled={locating}
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

			{/* The vegetation layer's switch, date and legend. It needs the map, so it waits for it.
			    It comes before the map in the page so the keyboard reaches it first. */}
			{status === "ready" ? (
				<div className="flex min-h-0 max-w-full flex-col items-start justify-end">
					<VegetationControl
						on={vegetationOn}
						onToggle={(next) => {
							setVegetationOn(next);
							// An answer from before the layer was switched off says nothing about now.
							setVegetationAnswer(null);
							setVegetationGaps(null);
						}}
						day={vegetationDay}
						onDay={(next) => {
							setVegetationDay(next);
							// Gaps belong to the picture that had them. Coming back to its day
							// asks for it afresh.
							setVegetationGaps(null);
						}}
						status={vegetationStatus}
						gaps={vegetationGaps === vegetationAsk}
						onRetry={() => {
							setVegetationTry((count) => count + 1);
							setVegetationGaps(null);
						}}
					/>
				</div>
			) : null}
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
						const layers = event.target.getStyle().layers;
						setLayerAbovePictures(
							(
								layers.find((layer) => layer.type === "line") ??
								layers.find((layer) => layer.type === "symbol")
							)?.id,
						);
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
						// One failed tile also arrives here. That is not a failed map. A failed tile of
						// the vegetation layer leaves a gap in its picture, and its control says so.
						if ("tile" in event) {
							if (isVegetationTileError(event, vegetationDay)) setVegetationGaps(vegetationAsk);
							return;
						}
						// Once the map has loaded there is something to show, so keep showing it.
						setStatus((current) => (current === "ready" ? current : "error"));
					}}
				>
					<NavigationControl position="top-right" showCompass={false} />
					{/* A new day, or another try, is a new source: the key makes the map drop the old
					    pictures and ask for them again. */}
					{vegetationStatus === "ready" ? (
						<Source
							key={vegetationAsk}
							id={VEGETATION_SOURCE_ID}
							type="raster"
							tiles={[vegetationTileUrl(vegetationDay)]}
							tileSize={256}
							maxzoom={VEGETATION.maxZoom}
							attribution="NASA GIBS"
						>
							<Layer
								id={VEGETATION_SOURCE_ID}
								type="raster"
								beforeId={layerAbovePictures}
								// Not see-through: the colours on the map have to be the legend's colours.
								paint={{ "raster-opacity": 1 }}
							/>
						</Source>
					) : null}
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
