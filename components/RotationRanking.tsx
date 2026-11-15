"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The rotation cards for the selected field (SPEC.md, user flow steps 4 and 5): the field's
// own rotation, then the three best matches among the library rotations that are usual in
// this part of Kansas. The other rotations the tool scored sit behind a disclosure.
// Scoring runs in the browser (lib/scoring.ts), so a slider or switch re-orders the cards at
// once.

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useMemo } from "react";
import { GlossedText, Term } from "@/components/Glossary";
import { PrioritySliders } from "@/components/PrioritySliders";
import { RotationCard } from "@/components/RotationCard";
import { SourceBadge } from "@/components/SourceBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { whySuggested } from "@/lib/card-text";
import { climateWindows } from "@/lib/climate-windows";
import { type ExistingRotation, existingRotation } from "@/lib/existing-rotation";
import type { Loadable } from "@/lib/field-store";
import { LIBRARY } from "@/lib/library";
import { transitionBase } from "@/lib/motion";
import { usePrioritiesStore } from "@/lib/priorities-store";
import { cropLabel, rotationYears } from "@/lib/rotation-edit";
import {
	annualRainIn,
	type RankedRotation,
	rank,
	recentClimate,
	scoreField,
} from "@/lib/scoring";
import type {
	ClimateResponse,
	HistoryResponse,
	SoilResponse,
} from "@/lib/types";

const REGION_NAMES = { west: "western", central: "central", east: "eastern" };

/** SPEC.md: "Existing rotation plus the top three candidates". */
const TOP_CANDIDATES = 3;

/**
 * Something the farmer should know that is not an error. The failures themselves are
 * announced once, by the section that owns the data (Field or Conditions).
 */
function QuietNote({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="rounded-md border bg-background px-3 py-2.5 text-xs">
			<p className="font-medium">{title}</p>
			<p className="mt-0.5 text-muted-foreground">{children}</p>
		</div>
	);
}

function ListSkeleton() {
	return (
		<div className="space-y-2" aria-hidden="true">
			<Skeleton className="h-4 w-56" />
			{[224, 176, 176].map((height, row) => (
				// Three fixed placeholders: their position is their identity.
				<div key={row} className="space-y-2 rounded-md border p-3">
					<div className="flex justify-between gap-3">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-6 w-12" />
					</div>
					<Skeleton className="w-full" style={{ height }} />
				</div>
			))}
		</div>
	);
}

/** What to say under the field's own rotation. */
function ownLines(own: ExistingRotation, item: RankedRotation): string[] {
	const lines: string[] = [];
	if (own.leftOut.length > 0) {
		const named = own.leftOut
			.map(
				({ year, cdlCode }) =>
					`${year} (${cdlCode === null ? "no crop on record" : cropLabel(cdlCode)})`,
			)
			.join(", ");
		lines.push(
			`Scored on ${own.scoredYears} of ${own.totalYears} years. Left out, because the tool has no values for them: ${named}.`,
		);
	}
	if (item.water?.mode === "dryland") {
		lines.push(
			"Scored as dryland. The crop map does not show irrigation: turn the switch on above if this field is irrigated.",
		);
	} else if (item.water?.mode === "irrigated") {
		lines.push("Scored as irrigated, because the switch above says this field can be.");
	}
	return lines;
}

export function RotationRanking({
	climate,
	history,
	soil,
	cropEdits,
}: {
	climate: Loadable<ClimateResponse>;
	history: Loadable<HistoryResponse>;
	soil: Loadable<SoilResponse>;
	cropEdits: Readonly<Record<number, number>>;
}) {
	const priorities = usePrioritiesStore((state) => state.priorities);
	const constraints = usePrioritiesStore((state) => state.constraints);
	const reducedMotion = useReducedMotion();

	const climateData = climate.status === "ready" ? climate.data : null;
	const soilData = soil.status === "ready" ? soil.data : null;
	const historyData = history.status === "ready" ? history.data : null;

	// The field's own rotation, from the detected years and the farmer's corrections.
	const own = useMemo(
		() =>
			existingRotation(
				rotationYears(historyData, cropEdits, new Date().getFullYear()),
			),
		[historyData, cropEdits],
	);

	// Scored once per field and per switch. A slider move only changes the weights below.
	const scores = useMemo(
		() =>
			climateData
				? scoreField(
						{ climate: climateData, soil: soilData },
						LIBRARY,
						constraints,
						own,
					)
				: null,
		[climateData, soilData, own, constraints],
	);
	const ranking = useMemo(
		() => (scores ? rank(scores, priorities, LIBRARY.scoring) : null),
		[scores, priorities],
	);
	const windows = useMemo(
		() => (climateData ? climateWindows(climateData) : null),
		[climateData],
	);

	const waiting =
		climate.status === "loading" ||
		soil.status === "loading" ||
		history.status === "loading";

	// The sliders belong to the farmer, not to the field, so they are there from the start.
	let list: ReactNode;
	if (climate.status === "error") {
		list = (
			<QuietNote title="The rotations are not scored yet">
				The scores are worked out from the climate history, which could not be
				loaded. Try it again under Conditions, below.
			</QuietNote>
		);
	} else if (waiting || !ranking || !climateData || !windows) {
		list = (
			<div>
				<p className="sr-only">Scoring the rotations for this field.</p>
				<ListSkeleton />
			</div>
		);
	} else {
		const recent = recentClimate(climateData);
		if (!recent) {
			list = (
				<QuietNote title="No monthly climate for this point">
					<GlossedText text="The rotations are scored from monthly rain and reference evapotranspiration, and this answer has none. Nothing is estimated in their place." />
				</QuietNote>
			);
		} else {
			const yearlyRain = annualRainIn(climateData);
			const regionName = ranking.region ? REGION_NAMES[ranking.region] : null;
			// The field's own rotation is on screen already, so it is not also listed as left out.
			const leftOutForIrrigation = ranking.hiddenForIrrigation.filter(
				(item) => item !== ranking.sameAsExisting,
			);
			// The switch can add a rotation that ranks low and sits behind the disclosure. It is
			// named here with its place, so the switch is seen to have done something.
			const addedByIrrigation = constraints.irrigationAvailable
				? [
						...ranking.candidates.map((item, index) => ({ item, place: `ranked ${index + 1}` })),
						...ranking.elsewhere.map((item) => ({ item, place: "usual elsewhere in Kansas" })),
					]
						.filter(({ item }) => item.rotation.water === "irrigated")
						.map(({ item, place }) => `${item.rotation.name} (${place})`)
				: [];
			const top = ranking.candidates.slice(0, TOP_CANDIDATES);
			const rest = ranking.candidates.slice(TOP_CANDIDATES);
			const more = rest.length + ranking.elsewhere.length;
			const best = top[0] ?? null;
			const ownItem = ranking.existing;
			const ownScored = ownItem !== null && ownItem.total !== null;
			const layout = reducedMotion ? false : "position";
			const nothingEntered = Object.keys(cropEdits).length === 0;
			const card = (item: RankedRotation, position: number | null, lines: string[]) => (
				<RotationCard
					item={item}
					position={position}
					best={item === best && item.total !== null}
					lines={lines}
					own={ownScored ? ownItem : null}
					climate={climateData}
					windows={windows}
					regionName={regionName}
					calendarOpen={item === best}
				/>
			);

			list = (
				<>
					<div className="space-y-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground">
								{yearlyRain !== null && regionName
									? `About ${Math.round(yearlyRain)} in of rain a year here, which the tool counts as ${regionName} Kansas. `
									: ""}
								Scores use the weather of {recent.firstYear} to {recent.lastYear}.
							</p>
							<div className="flex flex-wrap gap-1.5">
								<SourceBadge source="NASA POWER" />
								{soilData ? <SourceBadge source="USDA NRCS SSURGO" /> : null}
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							A score compares rotations with each other on recent weather and
							published crop values. It is not a forecast of yield or price, and
							it is yours to weigh against what you know of the field.
						</p>

						{addedByIrrigation.length > 0 ? (
							<p className="text-xs text-muted-foreground">
								Included because this field can be irrigated:{" "}
								{addedByIrrigation.join(", ")}.
							</p>
						) : null}

						{soil.status === "error" ? (
							<QuietNote title="Scored without the soil facts">
								The soil survey could not be loaded, so soil protection has no
								score and stored water is not limited by what the soil can hold.
								Try it again under Field.
							</QuietNote>
						) : null}

						{own && ownItem && ownScored ? (
							<RotationCard
								item={ownItem}
								position={null}
								best={false}
								lines={ownLines(own, ownItem)}
								own={null}
								climate={climateData}
								windows={windows}
								regionName={regionName}
								calendarOpen={true}
							/>
						) : null}
						{own && !ownScored ? (
							<QuietNote title="Your current rotation is not scored">
								{history.status === "error" && nothingEntered
									? "The crop history could not be loaded. Try it again under Field, or choose the crops you grow there."
									: own.leftOut.length === own.totalYears
										? "The tool has no values for the crops on record here. Choose the crops you grow under Field to have your own rotation scored."
										: "There is no crop in the years on record, so there is nothing to score."}
							</QuietNote>
						) : null}
					</div>

					<div className="space-y-2">
						<h3 className="text-sm font-medium">
							{regionName ? `Usual in ${regionName} Kansas` : "Rotations in the library"}
							, best match first
						</h3>
						{/* Says the new leader once when a slider or switch changes it. */}
						<p className="sr-only" aria-live="polite">
							{best && best.total !== null
								? `Best match of those compared: ${best.rotation.name}.`
								: ""}
						</p>
						{top.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								The library has no other rotation for this part of Kansas yet.
							</p>
						) : (
							<ol className="space-y-2">
								{top.map((item, index) => (
									<motion.li
										key={item.rotation.id}
										layout={layout}
										transition={transitionBase}
									>
										{card(
											item,
											index + 1,
											ownScored ? [whySuggested(item, ownItem)] : [],
										)}
									</motion.li>
								))}
							</ol>
						)}
					</div>

					{more > 0 ? (
						<details className="space-y-2">
							<summary className="cursor-pointer rounded-sm py-1 text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
								{more} more {more === 1 ? "rotation" : "rotations"} scored for
								this field
							</summary>
							{rest.length > 0 ? (
								<ol start={TOP_CANDIDATES + 1} className="mt-2 space-y-2">
									{rest.map((item, index) => (
										<motion.li
											key={item.rotation.id}
											layout={layout}
											transition={transitionBase}
										>
											{card(
												item,
												TOP_CANDIDATES + index + 1,
												ownScored ? [whySuggested(item, ownItem)] : [],
											)}
										</motion.li>
									))}
								</ol>
							) : null}
							{ranking.elsewhere.length > 0 ? (
								<div className="mt-2 space-y-2">
									<h3 className="text-sm font-medium">
										Usual in other parts of Kansas
									</h3>
									<p className="text-xs text-muted-foreground">
										Scored the same way, but the library lists these for another
										part of the state, so they are not ranked with the ones
										above.
									</p>
									<ul className="space-y-2">
										{ranking.elsewhere.map((item) => (
											<motion.li
												key={item.rotation.id}
												layout={layout}
												transition={transitionBase}
											>
												{card(item, null, [
													`The library lists it for ${item.rotation.regions.map((region) => REGION_NAMES[region]).join(" and ")} Kansas.`,
												])}
											</motion.li>
										))}
									</ul>
								</div>
							) : null}
						</details>
					) : null}

					<div className="space-y-1 text-xs text-muted-foreground">
						{leftOutForIrrigation.length > 0 ? (
							<p>
								Not shown, because this field is scored as{" "}
								<Term id="dryland">dryland</Term> and{" "}
								{leftOutForIrrigation.length === 1 ? "it needs" : "they need"}{" "}
								irrigation: {leftOutForIrrigation.map((item) => item.name).join(", ")}.
							</p>
						) : null}
						{ranking.sameAsExisting ? (
							<p>
								{ranking.sameAsExisting.name} is in the library too. It is not
								listed again, because it is what this field already grows.
							</p>
						) : null}
						<p>
							The library holds {LIBRARY.rotations.length} rotations so far. Crop
							water demand is <Term id="potential-demand">potential demand</Term>:
							what a well-watered crop would use.
						</p>
					</div>
				</>
			);
		}
	}

	return (
		<div className="space-y-4">
			<PrioritySliders />
			{list}
		</div>
	);
}
