"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The Field tab of the panel beside the map (components/SidePanel.tsx holds the tabs). With
// nothing selected it invites a click or a sample field.
// With a field selected it has three sections (SPEC.md, "Reuse from Stragents"): Field, with
// the crops grown and the soil; Rotations, with the ranked list and the priority sliders; and
// Conditions, with the climate chart. Crop history, soil and climate each load, fail and
// retry on their own.

import { motion } from "framer-motion";
import { MapPinIcon, PrinterIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { ConditionsCharts } from "@/components/ConditionsCharts";
import { FieldSummary } from "@/components/FieldSummary";
import { Section } from "@/components/layout/page";
import { Notice } from "@/components/notice";
import { RotationRanking } from "@/components/RotationRanking";
import { SoilMoisture } from "@/components/SoilMoisture";
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
import { useViewStore } from "@/lib/view-store";

// Read out by screen readers when the panel changes. Errors and the outside-Kansas
// message announce themselves through the notice's role="alert".
function statusMessage(panel: FieldPanelState): string {
	if (panel.kind !== "field") return "";
	const parts = [panel.climate, panel.history, panel.soil, panel.moisture];
	if (parts.some((part) => part.status === "loading")) {
		return `Loading field facts for ${panel.selection.name}`;
	}
	const failed = parts.filter((part) => part.status === "error").length;
	return failed === 0
		? `Field facts loaded for ${panel.selection.name}`
		: `Field facts loaded for ${panel.selection.name}, ${failed} of ${parts.length} could not be loaded`;
}

function formatDate(isoTime: string): string {
	return new Date(isoTime).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	});
}

/**
 * A quiet note that a saved copy is on screen. It is not an alert: the toast and the status
 * line already announce it, and several alerts at once would talk over each other.
 */
function SavedCopyNote({ children }: { children: ReactNode }) {
	return (
		<p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
			{children}
		</p>
	);
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
				<Skeleton className="h-6 w-24 rounded-full" />
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
	const editCrop = useFieldStore((state) => state.editCrop);
	const resetCrops = useFieldStore((state) => state.resetCrops);
	const fadeUp = useFadeUp();
	const panelRef = useRef<HTMLDivElement>(null);
	const view = useViewStore((state) => state.view);
	const showView = useViewStore((state) => state.showView);
	// The field the panel was last brought into view for.
	const shownFor = useRef("");

	const selection = selectionOf(panel);

	// On a phone the panel sits under the map. Choosing a field brings the panel into view;
	// the link at its top leads back to the map. (SPEC.md asks for a bottom sheet on phones;
	// this is the plainer stand-in.)
	const chosen = selection ? `${selection.lat},${selection.lon}` : "";
	// A field chosen while the About tab is open brings the Field tab forward.
	useEffect(() => {
		if (chosen) showView("field");
	}, [chosen, showView]);
	useEffect(() => {
		// Waits until the Field tab is the one on screen: a hidden panel cannot be scrolled to.
		// Coming back from About to the same field does not move the page again.
		if (!chosen) {
			// Nothing is selected any more: the same field, chosen again, is a new choice.
			shownFor.current = "";
			return;
		}
		if (view !== "field" || shownFor.current === chosen) return;
		shownFor.current = chosen;
		if (!window.matchMedia("(max-width: 1023px)").matches) return;
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		panelRef.current?.scrollIntoView({
			behavior: still ? "auto" : "smooth",
			block: "start",
		});
		// Keyboard focus follows the view, so the next Tab lands in the panel, not in the map.
		panelRef.current?.focus({ preventScroll: true });
	}, [chosen, view]);

	// Facts on screen that are a saved copy because their live source failed just now.
	const savedCopies: string[] = [];
	if (panel.kind === "field") {
		if (
			panel.history.status === "ready" &&
			panel.history.origin === "sample-fallback"
		) {
			savedCopies.push("crop history");
		}
		if (
			panel.soil.status === "ready" &&
			panel.soil.origin === "sample-fallback"
		) {
			savedCopies.push("soil facts");
		}
	}

	// A button inside the panel disappears when its own action changes the panel. Keyboard
	// focus moves to the panel first, so it is never dropped back to the top of the page.
	const focusPanel = () => panelRef.current?.focus({ preventScroll: true });

	const sampleButtons = (
		<div className="flex flex-wrap justify-center gap-2">
			{SAMPLE_FIELDS.map((sample) => (
				<Button
					key={sample.id}
					type="button"
					variant="outline"
					size="sm"
					onClick={() => {
						focusPanel();
						selectSample(sample.id);
					}}
				>
					{sample.name}
				</Button>
			))}
		</div>
	);

	return (
		<div
			ref={panelRef}
			tabIndex={-1}
			className="scroll-mt-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			{/* Always on the page: a live region only announces changes made after it exists. */}
			<p role="status" className="sr-only">
				{statusMessage(panel)}
			</p>

			{selection ? (
				<div className="mb-3 flex flex-wrap gap-2">
					<Button asChild variant="outline" size="sm" className="h-10 lg:hidden">
						<a href="#map">Back to the map</a>
					</Button>
					{/* Feature 18: the browser's print dialog prints the one-page summary
					    (components/PrintSummary.tsx) in place of the app. */}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-10"
						onClick={() => window.print()}
					>
						<PrinterIcon aria-hidden="true" />
						Print summary
					</Button>
				</div>
			) : null}

			{/* The key restarts the short fade whenever the state or the place changes. */}
			<motion.div
				key={`${panel.kind}:${selection?.lat ?? ""}:${selection?.lon ?? ""}`}
				variants={fadeUp}
				initial="hidden"
				animate="visible"
				className="space-y-4"
			>
				<Section
					title="Field"
					description={
						selection
							? `${selection.name} · ${formatLatLon(selection.lat, selection.lon)}`
							: "Pick a place on the map to see what it grows, its soil and its climate."
					}
				>
					{panel.kind === "empty" ? (
						<EmptyState
							icon={<MapPinIcon />}
							headingLevel={3}
							title="No field selected"
							description="Click a spot on the map of Kansas, or start with a sample field."
							action={sampleButtons}
						/>
					) : null}

					{panel.kind === "outside" ? (
						<Notice tone="neutral" title="That spot is outside Kansas">
							<p>
								This tool covers Kansas only. Click a spot inside the state, or
								start with a sample field.
							</p>
							<div className="mt-2 flex justify-start">{sampleButtons}</div>
						</Notice>
					) : null}

					{panel.kind === "field" ? (
						<div className="space-y-3">
							{savedCopies.length > 0 ? (
								<SavedCopyNote>
									The {savedCopies.join(" and ")} could not be fetched just now.
									Showing the copy saved for this sample field.
								</SavedCopyNote>
							) : null}
							<FieldSummary
								history={panel.history}
								soil={panel.soil}
								cropEdits={panel.cropEdits}
								onEditCrop={editCrop}
								onResetCrops={() => {
									// The reset button disappears when it is pressed.
									focusPanel();
									resetCrops();
								}}
								onRetryHistory={() => {
									focusPanel();
									retry("history");
								}}
								onRetrySoil={() => {
									focusPanel();
									retry("soil");
								}}
							/>
						</div>
					) : null}
				</Section>

				{panel.kind === "field" ? (
					<Section
						title="Rotations"
						description="Your current rotation and others, scored for this field and ordered by what matters to you."
					>
						<RotationRanking
							climate={panel.climate}
							history={panel.history}
							soil={panel.soil}
							cropEdits={panel.cropEdits}
						/>
					</Section>
				) : null}

				{panel.kind === "field" ? (
					<Section
						title="Conditions"
						description="How the climate at this place has changed, year by year, and how wet the soil is now."
						contentClassName="space-y-4"
					>
						{panel.climate.status === "loading" ? <ChartSkeleton /> : null}

						{panel.climate.status === "error" ? (
							<ErrorState
								title="The climate history could not be loaded"
								error={new Error(panel.climate.message)}
								onRetry={() => {
									focusPanel();
									retry("climate");
								}}
							/>
						) : null}

						{panel.climate.status === "ready" ? (
							<div className="space-y-3">
								{panel.climate.origin === "sample-fallback" ? (
									<SavedCopyNote>
										NASA POWER could not be reached just now. Showing the copy
										saved on {formatDate(panel.climate.data.fetchedAt)}.
									</SavedCopyNote>
								) : null}
								<ConditionsCharts climate={panel.climate.data} />
							</div>
						) : null}

						<SoilMoisture
							moisture={panel.moisture}
							onRetry={() => {
								focusPanel();
								retry("moisture");
							}}
						/>
					</Section>
				) : null}

				{panel.kind === "field" &&
				panel.selection.sampleId &&
				panel.climate.status === "ready" &&
				panel.climate.origin === "sample" ? (
					<p className="px-1 text-xs text-muted-foreground">
						Sample field: everything shown here is a copy saved from the three
						sources on {formatDate(panel.climate.data.fetchedAt)}, so the sample
						works without a live connection to them.
					</p>
				) : null}
			</motion.div>
		</div>
	);
}
