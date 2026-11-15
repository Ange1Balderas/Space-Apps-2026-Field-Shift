"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The switch, the date picker and the legend of NASA's vegetation layer (SPEC.md, feature
// 13: "Toggle on the map with a legend, units and a date picker"). The pictures themselves
// are drawn by MapView. Everything said here about the layer comes from
// data/vegetation-layer.json, which is written from NASA GIBS's own documents.
//
// The legend's colours are NASA's, copied from the layer's colour map: they have to match
// the picture, so they are the one place where colours are not the app's own tokens.
//
// The control sits on the map, and on a phone the map is small. The switch and the legend
// are always there; the date picker and the explanation fold away, and start folded on a
// narrow screen.

import { useId, useState } from "react";
import { Term } from "@/components/Glossary";
import { SourceBadge } from "@/components/SourceBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	datesOfYear,
	formatVegetationDay,
	legendGradient,
	nearestInYear,
	VEGETATION,
	VEGETATION_DATES,
	vegetationYears,
} from "@/lib/vegetation";

/** Off, asking NASA for a first tile, drawn, or not available just now. */
export type VegetationStatus = "off" | "checking" | "ready" | "failed";

const YEARS = vegetationYears(VEGETATION_DATES);
const GRADIENT = legendGradient(VEGETATION.legend.stops);
// NASA writes "16-Day" and "250m".
const PERIOD = VEGETATION.period.toLowerCase();
const RESOLUTION = VEGETATION.resolution.replace(/^(\d+)\s*m$/, "$1 m");

const SELECT_CLASS =
	"h-8 w-full rounded-md border bg-background px-2 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

/** The date picker and the explanation, behind a fold. Mounted only while the layer is on. */
function PictureDetails({ day, onDay }: { day: string; onDay: (day: string) => void }) {
	const yearId = useId();
	const dayId = useId();
	const year = Number(day.slice(0, 4));
	// Open on a screen with room for it, folded on a phone. After that it is the reader's.
	const [open, setOpen] = useState(() => window.matchMedia("(min-width: 640px)").matches);
	return (
		<details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
			<summary className="flex min-h-6 cursor-pointer items-center rounded-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
				<span className="mr-1 text-muted-foreground" aria-hidden="true">
					{open ? "▾" : "▸"}
				</span>
				Picture of {formatVegetationDay(day, true)}
				<span className="sr-only">: choose another date, and what the picture shows</span>
			</summary>
			<div className="mt-1.5 space-y-2">
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-0.5">
						<label htmlFor={yearId} className="text-muted-foreground">
							Year
						</label>
						<select
							id={yearId}
							className={SELECT_CLASS}
							value={year}
							onChange={(event) => {
								// Changing the year keeps the time of year.
								const next = nearestInYear(VEGETATION_DATES, Number(event.target.value), day);
								if (next) onDay(next);
							}}
						>
							{YEARS.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-0.5">
						<label htmlFor={dayId} className="text-muted-foreground">
							{PERIOD} picture from
						</label>
						{/* Only the days NASA has a picture for are offered. */}
						<select
							id={dayId}
							className={SELECT_CLASS}
							value={day}
							onChange={(event) => onDay(event.target.value)}
						>
							{datesOfYear(VEGETATION_DATES, year).map((option) => (
								<option key={option} value={option}>
									{formatVegetationDay(option)}
								</option>
							))}
						</select>
					</div>
				</div>
				{/* What the colours mean is in the NDVI tooltip beside the legend, and in the
				    layer's entry on the About tab, which this badge opens. */}
				<SourceBadge source="NASA GIBS MODIS" />
			</div>
		</details>
	);
}

export function VegetationControl({
	on,
	onToggle,
	day,
	onDay,
	status,
	onRetry,
}: {
	on: boolean;
	onToggle: (on: boolean) => void;
	/** The first day of the picture on show, YYYY-MM-DD. */
	day: string;
	onDay: (day: string) => void;
	status: VegetationStatus;
	onRetry: () => void;
}) {
	const switchId = useId();
	const helpId = useId();

	return (
		<div className="pointer-events-auto w-64 max-w-full space-y-1.5 rounded-md border bg-card p-2.5 text-xs shadow-xs">
			<div className="flex items-center justify-between gap-3">
				<label htmlFor={switchId} className="text-sm font-medium">
					Vegetation from space
				</label>
				{/* The row is 24 px tall, and the label is a second target for the same switch. */}
				<span className="flex min-h-6 shrink-0 items-center">
					<Switch
						id={switchId}
						checked={on}
						aria-describedby={helpId}
						onCheckedChange={onToggle}
					/>
				</span>
			</div>
			{/* Shorter once the layer is on: the map is small on a phone. */}
			<p id={helpId} className="text-muted-foreground">
				{on
					? `A picture only, ${RESOLUTION} to a reading. No score uses it.`
					: "A NASA satellite picture of how green the land is. No score uses it."}
			</p>

			{on ? (
				<>
					{/* Always on the page while the layer is on, so a change is read out. */}
					<p role="status" className={status === "checking" ? "text-muted-foreground" : "sr-only"}>
						{status === "checking"
							? `Asking NASA for the picture of ${formatVegetationDay(day, true)}.`
							: status === "ready"
								? `Showing the picture of ${formatVegetationDay(day, true)}.`
								: ""}
					</p>

					{status === "failed" ? (
						<div role="alert" className="space-y-1.5 rounded-md border bg-background p-2">
							<p>
								NASA&apos;s vegetation pictures could not be loaded just now. The rest of
								the map still works.
							</p>
							<Button type="button" variant="outline" size="xs" onClick={onRetry}>
								Try again
							</Button>
						</div>
					) : null}

					<div>
						<div
							aria-hidden="true"
							className="h-2.5 w-full rounded-sm border"
							style={{ backgroundImage: GRADIENT }}
						/>
						<div className="mt-0.5 flex items-baseline justify-between tabular-nums">
							<span>{VEGETATION.legend.minLabel}</span>
							<span>
								<Term id="ndvi">NDVI</Term>, no unit
							</span>
							<span>{VEGETATION.legend.maxLabel}</span>
						</div>
					</div>

					<PictureDetails day={day} onDay={onDay} />
				</>
			) : null}
		</div>
	);
}
