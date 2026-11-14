"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The Field panel beside the map. It always shows exactly one state: nothing selected,
// a point outside Kansas, loading, an error with a retry, or the field's climate chart.

import { motion } from "framer-motion";
import { MapPinIcon } from "lucide-react";
import { ConditionsCharts } from "@/components/ConditionsCharts";
import { Section } from "@/components/layout/page";
import { Notice } from "@/components/notice";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type FieldPanelState,
	selectionOf,
	useFieldStore,
} from "@/lib/field-store";
import { useFadeUp } from "@/lib/motion";
import { SAMPLE_FIELDS } from "@/lib/samples";
import { formatLatLon } from "@/lib/trend-text";

// Read out by screen readers when the panel changes. Errors and the outside-Kansas
// message announce themselves through the notice's role="alert".
function statusMessage(panel: FieldPanelState): string {
	switch (panel.kind) {
		case "loading":
			return `Loading climate history for ${panel.selection.name}`;
		case "ready":
			return `Climate history loaded for ${panel.selection.name}`;
		default:
			return "";
	}
}

function formatDate(isoTime: string): string {
	return new Date(isoTime).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}

/** A placeholder with the outline of the chart block: title, trend box, plot and caption. */
function ChartSkeleton() {
	return (
		<div aria-hidden="true" className="space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1.5">
					<Skeleton className="h-4 w-36" />
					<Skeleton className="h-3 w-56 max-w-full" />
				</div>
				<Skeleton className="h-5 w-24 rounded-full" />
			</div>
			<Skeleton className="h-[5.5rem] w-full" />
			<Skeleton className="h-3 w-20" />
			<Skeleton className="h-56 w-full" />
			<Skeleton className="h-3 w-64 max-w-full" />
			<Skeleton className="h-3 w-52 max-w-full" />
		</div>
	);
}

export function FieldPanel() {
	const panel = useFieldStore((state) => state.panel);
	const selectSample = useFieldStore((state) => state.selectSample);
	const retry = useFieldStore((state) => state.retry);
	const fadeUp = useFadeUp();

	const selection = selectionOf(panel);
	const firstSample = SAMPLE_FIELDS[0];

	return (
		<Section
			title="Field"
			description={
				selection
					? `${selection.name} · ${formatLatLon(selection.lat, selection.lon)}`
					: "Pick a place on the map to see its climate history."
			}
		>
			{/* Always on the page: a live region only announces changes made after it exists. */}
			<p role="status" className="sr-only">
				{statusMessage(panel)}
			</p>

			{/* The key restarts the short fade whenever the state or the place changes. */}
			<motion.div
				key={`${panel.kind}:${selection?.lat ?? ""}:${selection?.lon ?? ""}`}
				variants={fadeUp}
				initial="hidden"
				animate="visible"
			>
				{panel.kind === "empty" ? (
					<EmptyState
						icon={<MapPinIcon />}
						title="No field selected"
						description="Click a spot on the map of Kansas, or start with the sample field."
						action={
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => selectSample(firstSample.id)}
							>
								Load the {firstSample.name} sample
							</Button>
						}
					/>
				) : null}

				{panel.kind === "outside" ? (
					<Notice tone="info" title="That spot is outside Kansas">
						<p>
							This tool covers Kansas only. Click a spot inside the state, or
							start with the sample field.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="mt-2"
							onClick={() => selectSample(firstSample.id)}
						>
							Load the {firstSample.name} sample
						</Button>
					</Notice>
				) : null}

				{panel.kind === "loading" ? <ChartSkeleton /> : null}

				{panel.kind === "error" ? (
					<ErrorState
						title="The climate history could not be loaded"
						error={new Error(panel.message)}
						onRetry={retry}
					/>
				) : null}

				{panel.kind === "ready" ? (
					<div className="space-y-3">
						{panel.origin === "sample-fallback" ? (
							<Notice tone="warning" title="Showing cached data">
								<p>
									NASA POWER could not be reached just now. These numbers are
									the copy saved on {formatDate(panel.climate.fetchedAt)}.
								</p>
							</Notice>
						) : null}
						<ConditionsCharts climate={panel.climate} />
						{panel.origin === "sample" ? (
							<p className="text-xs text-muted-foreground">
								Sample field: these numbers are a copy saved from NASA POWER on{" "}
								{formatDate(panel.climate.fetchedAt)}, so the sample works
								without a live connection to NASA.
							</p>
						) : null}
					</div>
				) : null}
			</motion.div>
		</Section>
	);
}
