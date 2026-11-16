"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The county's soil moisture status from NASA SMAP (SPEC.md, feature 12, user flow step 6:
// "this season's soil moisture against normal"). The last full month of the record, labelled
// wetter than usual, about normal or drier than usual against the same month in the other
// years, with "short record" beside it because SMAP began in 2015. It is a status for the
// county, not the field, and no score uses it. Loads, fails and retries on its own.
//
// A county whose file has not been built yet shows nothing at all: SPEC.md ("Risks and
// fallbacks") says to hide SMAP rather than show placeholders.

import { type ReactNode, useId } from "react";
import { Term } from "@/components/Glossary";
import { SourceBadge } from "@/components/SourceBadge";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MoistureResult } from "@/lib/field-client";
import type { Loadable } from "@/lib/field-store";
import {
	describeMoisture,
	formatMonth,
	MOISTURE_LABEL_TEXT,
	type MoistureLabel,
	moistureLabel,
	nearNormalZ,
	recordSpan,
	SHORT_RECORD_YEARS,
} from "@/lib/moisture";
import { cn } from "@/lib/utils";

// Semantic tokens only (SPEC.md, "Design direction"): the tone is carried by a light tint,
// the same pairs as the notice component, and the text stays in the foreground colour.
const LABEL_CLASSES: Record<MoistureLabel, string> = {
	wetter: "border-info/40 bg-info/10",
	normal: "border-border bg-card",
	drier: "border-warning/50 bg-warning/10",
};

function Frame({
	headingId,
	children,
	badge = true,
}: {
	headingId: string;
	children: ReactNode;
	badge?: boolean;
}) {
	return (
		<section aria-labelledby={headingId} className="space-y-3 rounded-lg border bg-card p-4">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="space-y-0.5">
					<h3 id={headingId} className="text-sm font-medium">
						Soil moisture now
					</h3>
					<p className="text-xs text-muted-foreground">
						The county&apos;s last full month, from NASA&apos;s SMAP satellite, against
						the same month in other years.
					</p>
				</div>
				{badge ? <SourceBadge source="NASA SMAP" /> : null}
			</div>
			{children}
		</section>
	);
}

export function SoilMoisture({
	moisture,
	onRetry,
}: {
	moisture: Loadable<MoistureResult>;
	onRetry: () => void;
}) {
	const headingId = useId();

	if (moisture.status === "loading") {
		return (
			<Frame headingId={headingId}>
				<output aria-live="polite" className="block space-y-2">
					<span className="sr-only">Loading soil moisture</span>
					<Skeleton className="h-6 w-36 rounded-full" />
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-5/6" />
					<Skeleton className="h-3 w-2/3" />
				</output>
			</Frame>
		);
	}

	if (moisture.status === "error") {
		return (
			<Frame headingId={headingId}>
				<ErrorState
					title="Soil moisture is not available right now"
					error={new Error(moisture.message)}
					onRetry={onRetry}
				/>
			</Frame>
		);
	}

	const result = moisture.data;

	// Inside the Kansas rectangle, outside the state line.
	if (result.kind === "no-county") {
		return (
			<Frame headingId={headingId} badge={false}>
				<p className="text-sm text-muted-foreground">
					This spot is outside Kansas, so there is no county soil moisture record to show.
				</p>
			</Frame>
		);
	}

	// Not built yet for this county: hidden rather than a placeholder (SPEC.md).
	if (result.kind === "no-record") return null;

	const { county, data } = result;
	const { latest } = data;
	const span = recordSpan(data);

	if (!latest) {
		return (
			<Frame headingId={headingId} badge={false}>
				<p className="text-sm text-muted-foreground">
					NASA SMAP&apos;s record for {county.name} has no recent month with enough
					readings of recommended quality to average, so there is no status to show.
				</p>
			</Frame>
		);
	}

	const label = moistureLabel(latest.z);
	const labelText = label
		? MOISTURE_LABEL_TEXT[label]
		: nearNormalZ() === null
			? "Cut-off not sourced yet"
			: "Too few years to say";
	const shortRecord = span !== null && span.years < SHORT_RECORD_YEARS;

	return (
		<Frame headingId={headingId}>
			<div className="flex flex-wrap items-center gap-2">
				<Badge
					variant="outline"
					className={cn("min-h-6 text-sm", label ? LABEL_CLASSES[label] : "border-border bg-card")}
				>
					{labelText}
				</Badge>
				{shortRecord ? (
					<Badge variant="outline" className="min-h-6 text-muted-foreground">
						Short record
					</Badge>
				) : null}
				<span className="text-xs text-muted-foreground">
					{county.name}, {formatMonth(latest.year, latest.month)}
				</span>
			</div>
			<p className="text-sm">{describeMoisture(latest)}</p>
			<p className="text-xs text-muted-foreground">
				A <Term id="soil-moisture-anomaly">soil moisture anomaly</Term> for the county, read
				at its center: wetter or drier than the same month in the readings since{" "}
				{span ? span.from : "2015"}, not the 30 years usually used for a normal. It describes
				the top layer of soil over a wide area (a 9 km grid cell, from a satellite footprint
				about 36 km across), not this field, and no score uses it.
			</p>
		</Frame>
	);
}
