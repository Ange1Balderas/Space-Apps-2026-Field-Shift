"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The ranked list of rotations for the selected field: the field's own rotation first, then
// the library rotations that are usual in this part of Kansas, best first, then the ones
// usual elsewhere. Every row shows its score and the seven indicator scores behind it.
// Scoring runs in the browser (lib/scoring.ts), so a slider move re-orders the list at once.
// The full rotation cards, the toggles and the calendar strip arrive in Phase 4.

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode, useMemo } from "react";
import { PrioritySliders } from "@/components/PrioritySliders";
import { SourceBadge } from "@/components/SourceBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { INDICATOR_LABELS, whySuggested } from "@/lib/card-text";
import { type ExistingRotation, existingRotation } from "@/lib/existing-rotation";
import type { Loadable } from "@/lib/field-store";
import { INDICATOR_IDS, LIBRARY } from "@/lib/library";
import { transitionBase } from "@/lib/motion";
import { usePrioritiesStore } from "@/lib/priorities-store";
import { cropLabel, rotationYears } from "@/lib/rotation-edit";
import {
	annualRainIn,
	DEFAULT_CONSTRAINTS,
	distinctCrops,
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
import { cn } from "@/lib/utils";

const REGION_NAMES = { west: "western", central: "central", east: "eastern" };

function cropNames(item: RankedRotation): string {
	const names = distinctCrops(item.rotation).map(
		(id) => LIBRARY.crops.find((crop) => crop.id === id)?.name ?? id,
	);
	return names.length === 0 ? "No crop the tool knows" : names.join(", ");
}

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
			{[56, 44, 44].map((height, row) => (
				// Three fixed placeholders: their position is their identity.
				<div key={row} className="space-y-2 rounded-md border p-3">
					<div className="flex justify-between gap-3">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-6 w-12" />
					</div>
					<Skeleton className="w-full" style={{ height: height * 4 }} />
				</div>
			))}
		</div>
	);
}

function RotationRow({
	item,
	position,
	best,
	lines,
}: {
	item: RankedRotation;
	/** Place in the ranking, or null for a row that is not ranked. */
	position: number | null;
	best: boolean;
	/** Short sentences shown under the name. */
	lines: string[];
}) {
	return (
		<div
			className={cn(
				"@container space-y-2.5 rounded-md border bg-background p-3",
				best && "border-chart-1",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-0.5">
					<p className="text-sm font-medium">
						{position !== null ? `${position}. ` : ""}
						{item.rotation.name}
					</p>
					{best ? (
						<p className="text-xs font-medium">
							<span
								aria-hidden="true"
								className="mr-1.5 inline-block size-2 rounded-full bg-chart-1"
							/>
							Best match for these priorities
						</p>
					) : null}
					<p className="text-xs text-muted-foreground">{cropNames(item)}</p>
				</div>
				<p className="shrink-0 text-right">
					{item.total === null ? (
						<span className="text-xs text-muted-foreground">Not scored</span>
					) : (
						<>
							<span className="sr-only">Score </span>
							<span className="text-lg font-semibold tabular-nums">
								{Math.round(item.total)}
							</span>
							<span className="text-xs text-muted-foreground"> of 100</span>
						</>
					)}
				</p>
			</div>

			{lines.map((line) => (
				<p key={line} className="text-xs text-muted-foreground">
					{line}
				</p>
			))}

			{/* Two columns only when the row itself is wide: the panel is narrow beside the map. */}
			<dl className="grid gap-x-6 gap-y-1 @lg:grid-cols-2">
				{INDICATOR_IDS.map((id) => {
					const score = item.indicators[id].score;
					return (
						<div key={id} className="flex items-center gap-2 text-xs">
							<dt className="w-[9.5rem] shrink-0 text-muted-foreground">
								{INDICATOR_LABELS[id]}
							</dt>
							<dd className="flex min-w-0 flex-1 items-center gap-2">
								<span
									aria-hidden="true"
									className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
								>
									<span
										className="block h-full rounded-full bg-chart-3"
										style={{ width: `${score === null ? 0 : Math.round(score)}%` }}
									/>
								</span>
								<span className="w-14 shrink-0 text-right tabular-nums">
									{score === null ? "no score" : Math.round(score)}
								</span>
							</dd>
						</div>
					);
				})}
			</dl>

			<details className="text-xs">
				<summary className="cursor-pointer rounded-sm py-1 font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
					How these scores were worked out
					<span className="sr-only"> for {item.rotation.name}</span>
				</summary>
				<ul className="mt-1.5 space-y-1.5 text-muted-foreground">
					{INDICATOR_IDS.map((id) => (
						<li key={id}>
							<span className="font-medium text-foreground">
								{INDICATOR_LABELS[id]}:
							</span>{" "}
							{item.indicators[id].why}
						</li>
					))}
				</ul>
			</details>
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
			"Scored as dryland. The crop map does not show irrigation, and the tool has not been told this field has any.",
		);
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

	// Scored once per field. A slider move only changes the weights below.
	const scores = useMemo(
		() =>
			climateData
				? scoreField(
						{ climate: climateData, soil: soilData },
						LIBRARY,
						DEFAULT_CONSTRAINTS,
						own,
					)
				: null,
		[climateData, soilData, own],
	);
	const ranking = useMemo(
		() => (scores ? rank(scores, priorities, LIBRARY.scoring) : null),
		[scores, priorities],
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
	} else if (waiting || !ranking || !climateData) {
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
					The rotations are scored from monthly rain and reference
					evapotranspiration, and this answer has none. Nothing is estimated in
					their place.
				</QuietNote>
			);
		} else {
			const yearlyRain = annualRainIn(climateData);
			// The field's own rotation is on screen already, so it is not also listed as left out.
			const leftOutForIrrigation = ranking.hiddenForIrrigation.filter(
				(item) => item !== ranking.sameAsExisting,
			);
			const best = ranking.candidates[0] ?? null;
			const ownItem = ranking.existing;
			const ownScored = ownItem !== null && ownItem.total !== null;
			const layout = reducedMotion ? false : "position";
			const nothingEntered = Object.keys(cropEdits).length === 0;

			list = (
				<>
					<div className="space-y-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground">
								{yearlyRain !== null && ranking.region
									? `About ${Math.round(yearlyRain)} in of rain a year here, which the tool counts as ${REGION_NAMES[ranking.region]} Kansas. `
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

						{soil.status === "error" ? (
							<QuietNote title="Scored without the soil facts">
								The soil survey could not be loaded, so soil protection has no
								score and stored water is not limited by what the soil can hold.
								Try it again under Field.
							</QuietNote>
						) : null}

						{own && ownItem && ownScored ? (
							<RotationRow
								item={ownItem}
								position={null}
								best={false}
								lines={ownLines(own, ownItem)}
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
							{ranking.region
								? `Usual in ${REGION_NAMES[ranking.region]} Kansas`
								: "Rotations in the library"}
							, best match first
						</h3>
						{/* Says the new leader once when a slider move changes it. */}
						<p className="sr-only" aria-live="polite">
							{best && best.total !== null
								? `Best match for these priorities: ${best.rotation.name}.`
								: ""}
						</p>
						{ranking.candidates.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								The library has no other rotation for this part of Kansas yet.
							</p>
						) : (
							<ol className="space-y-2">
								{ranking.candidates.map((item, index) => (
									<motion.li
										key={item.rotation.id}
										layout={layout}
										transition={transitionBase}
									>
										<RotationRow
											item={item}
											position={index + 1}
											best={item === best && item.total !== null}
											lines={ownScored ? [whySuggested(item, ownItem)] : []}
										/>
									</motion.li>
								))}
							</ol>
						)}
					</div>

					{ranking.elsewhere.length > 0 ? (
						<div className="space-y-2">
							<h3 className="text-sm font-medium">Usual in other parts of Kansas</h3>
							<p className="text-xs text-muted-foreground">
								Scored the same way, but the library lists these for another part
								of the state, so they are not ranked with the ones above.
							</p>
							<ul className="space-y-2">
								{ranking.elsewhere.map((item) => (
									<motion.li
										key={item.rotation.id}
										layout={layout}
										transition={transitionBase}
									>
										<RotationRow
											item={item}
											position={null}
											best={false}
											lines={[
												`The library lists it for ${item.rotation.regions.map((region) => REGION_NAMES[region]).join(" and ")} Kansas.`,
											]}
										/>
									</motion.li>
								))}
							</ul>
						</div>
					) : null}

					<div className="space-y-1 text-xs text-muted-foreground">
						{leftOutForIrrigation.length > 0 ? (
							<p>
								Not shown, because this field is scored as dryland and{" "}
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
							water demand is potential demand: what a well-watered crop would
							use. Crop values come from FAO-56, USDA NASS and K-State.
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
