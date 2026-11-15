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
// The control sits on the map, and on a phone the map is small. The switch, the legend and
// the source badge are always there while the layer is on. The date picker folds away, and
// starts folded, so the card covers as little of the map as it can.

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
// NASA writes "16-Day".
const PERIOD = VEGETATION.period.toLowerCase();

// Larger on a phone: a phone's browser zooms the page when a control with small text
// takes focus.
const SELECT_CLASS =
	"h-8 w-full rounded-md border bg-background px-2 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring max-sm:h-9 max-sm:text-base";

/** The date picker, behind a fold. Mounted only while the layer is on. */
function PictureDetails({ day, onDay }: { day: string; onDay: (day: string) => void }) {
	const yearId = useId();
	const dayId = useId();
	const year = Number(day.slice(0, 4));
	// Folded at first on every screen. The card sits over the south-west of the map, and with
	// the pickers open it hid the south-west corner of Kansas on a laptop. After that it is
	// the reader's, until the layer is switched off.
	const [open, setOpen] = useState(false);
	return (
		<details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
			{/* The triangle is drawn here, so the browser's own marker is taken away. */}
			<summary className="flex min-h-6 cursor-pointer list-none items-center rounded-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
				<span className="mr-1 text-muted-foreground" aria-hidden="true">
					{open ? "▾" : "▸"}
				</span>
				Picture dated {formatVegetationDay(day, true)}
				<span className="sr-only">: choose another date</span>
			</summary>
			<div className="mt-1.5 grid grid-cols-2 gap-2">
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
					{/* NASA dates each picture. Which day of its window that is was not found in
					    NASA's description of the layer, so the label does not say. Short enough
					    to stay on one line. */}
					<label htmlFor={dayId} className="text-muted-foreground">
						{PERIOD} picture
					</label>
					{/* Only the dates NASA has a picture for are offered. */}
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
		</details>
	);
}

export function VegetationControl({
	on,
	onToggle,
	day,
	onDay,
	status,
	gaps,
	onRetry,
}: {
	on: boolean;
	onToggle: (on: boolean) => void;
	/** The date NASA gives the picture on show, YYYY-MM-DD. */
	day: string;
	onDay: (day: string) => void;
	status: VegetationStatus;
	/** True when the picture is drawn but some of its tiles could not be loaded. */
	gaps: boolean;
	onRetry: () => void;
}) {
	const switchId = useId();
	const helpId = useId();
	// "Try again" takes its own button away, so keyboard focus goes to the switch first.
	const retry = () => {
		document.getElementById(switchId)?.focus();
		onRetry();
	};

	return (
		// When the map is short, the card scrolls inside itself instead of covering the
		// controls above it. It is a little tighter on a phone, where the map is small.
		<div className="pointer-events-auto min-h-0 w-64 max-w-full space-y-1.5 overflow-y-auto rounded-md border bg-card p-2.5 text-xs shadow-xs max-sm:space-y-1 max-sm:p-2">
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
			{/* Shorter once the layer is on: the legend then says what the picture is, and the
			    map is small on a phone. */}
			<p id={helpId} className="text-muted-foreground">
				{on
					? "A picture only: no score uses it."
					: "A NASA satellite picture of how green the land is. No score uses it."}
			</p>

			{/* Always on the page, so that a change is read out from the first one on. A note
			    that arrives with its words already in it is often not read out, so the gaps
			    are announced here too. */}
			<p
				role="status"
				className={on && status === "checking" ? "text-muted-foreground" : "sr-only"}
			>
				{!on
					? ""
					: status === "checking"
						? `Asking NASA for the picture dated ${formatVegetationDay(day, true)}.`
						: status === "ready"
							? gaps
								? `Showing the picture dated ${formatVegetationDay(day, true)}, with gaps: some parts of it did not load.`
								: `Showing the picture dated ${formatVegetationDay(day, true)}.`
							: ""}
			</p>

			{on ? (
				<>
					{status === "failed" ? (
						<div role="alert" className="space-y-1.5 rounded-md border bg-background p-2">
							<p>
								NASA&apos;s vegetation pictures could not be loaded just now. The rest of
								the map still works.
							</p>
							{/* Taller on a phone, for a thumb. */}
							<Button
								type="button"
								variant="outline"
								size="xs"
								className="max-sm:h-9"
								onClick={retry}
							>
								Try again
							</Button>
						</div>
					) : (
						// No legend while there is no picture for it to explain.
						<div>
							<div
								aria-hidden="true"
								className="h-2.5 w-full rounded-sm border"
								style={{ backgroundImage: GRADIENT }}
							/>
							<div className="mt-0.5 flex items-baseline justify-between tabular-nums">
								<span>{VEGETATION.legend.minLabel}</span>
								<span>
									<Term id="ndvi">NDVI</Term> (a ratio, no unit)
								</span>
								<span>{VEGETATION.legend.maxLabel}</span>
							</div>
						</div>
					)}

					{/* The first tile came, but the map could not load every tile after it. The
					    line above announces it; this is the note to read and the way to ask again. */}
					{status === "ready" && gaps ? (
						<div className="space-y-1.5 rounded-md border bg-background p-2">
							<p>Some parts of this picture did not load, so it has gaps.</p>
							<Button
								type="button"
								variant="outline"
								size="xs"
								className="max-sm:h-9"
								onClick={retry}
							>
								Try again
							</Button>
						</div>
					) : null}

					{/* Not in the fold: what the colours mean is in the NDVI tooltip beside the
					    legend, and where the picture comes from is one tap away. */}
					<SourceBadge source="NASA GIBS MODIS" />

					<PictureDetails day={day} onDay={onDay} />
				</>
			) : null}
		</div>
	);
}
