// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// One rotation card (SPEC.md, user flow step 4 and feature 8): the score, the seven indicator
// scores behind it, the field calendar, and the five fields: why suggested, evidence,
// benefits, information gaps and risks to verify locally. Every sentence comes from a
// template in lib/card-text.ts filled with a computed number or a sourced library entry.

import type { ReactNode } from "react";
import { FieldCalendar } from "@/components/FieldCalendar";
import { SourceBadge } from "@/components/SourceBadge";
import {
	benefitLines,
	type CardLine,
	evidenceLines,
	INDICATOR_LABELS,
	informationGaps,
	riskLines,
	splitSource,
	VERIFY_LOCALLY,
} from "@/lib/card-text";
import type { ClimateWindows } from "@/lib/climate-windows";
import { INDICATOR_IDS, LIBRARY } from "@/lib/library";
import { distinctCrops, type RankedRotation } from "@/lib/scoring";
import type { ClimateResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function cropNames(item: RankedRotation): string {
	const names = distinctCrops(item.rotation).map(
		(id) => LIBRARY.crops.find((crop) => crop.id === id)?.name ?? id,
	);
	return names.length === 0 ? "No crop the tool knows" : names.join(", ");
}

/** A part of the card that opens and closes. Its name carries the rotation for screen readers. */
function Fold({
	title,
	rotationName,
	open,
	children,
}: {
	title: string;
	rotationName: string;
	open?: boolean;
	children: ReactNode;
}) {
	return (
		<details className="text-xs" open={open}>
			<summary className="cursor-pointer rounded-sm py-1 font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
				{title}
				<span className="sr-only"> for {rotationName}</span>
			</summary>
			<div className="mt-1.5">{children}</div>
		</details>
	);
}

/** Where a sentence comes from: the words of its source, with each link as a link. */
function SourceLine({ source }: { source: string | null }) {
	if (!source) return null;
	return (
		<span className="block text-muted-foreground">
			Source:{" "}
			{splitSource(source).map((part, index) =>
				"url" in part ? (
					<a
						// The parts of one fixed string: their position is their identity.
						key={index}
						href={part.url}
						target="_blank"
						rel="noreferrer"
						className="rounded-sm underline underline-offset-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
					>
						{part.host}
						<span className="sr-only"> (opens in a new tab)</span>
					</a>
				) : (
					<span key={index}>{index > 0 ? ` ${part.text} ` : `${part.text} `}</span>
				),
			)}
		</span>
	);
}

function Lines({ lines, none }: { lines: readonly CardLine[]; none: string }) {
	if (lines.length === 0) return <p className="text-muted-foreground">{none}</p>;
	return (
		<ul className="space-y-1.5">
			{lines.map((line) => (
				<li key={line.text}>
					{line.text}
					<SourceLine source={line.source} />
				</li>
			))}
		</ul>
	);
}

export function RotationCard({
	item,
	position,
	best,
	lines,
	own,
	climate,
	windows,
	regionName,
	calendarOpen,
}: {
	item: RankedRotation;
	/** Place in the ranking, or null for a card that is not ranked. */
	position: number | null;
	best: boolean;
	/** Short sentences shown under the name: why it is suggested, or how it was scored. */
	lines: string[];
	/** The field's own rotation, to compare with. Null on the field's own card. */
	own: RankedRotation | null;
	climate: ClimateResponse;
	windows: ClimateWindows;
	/** "western", "central" or "eastern", or null when the region is not known. */
	regionName: string | null;
	calendarOpen: boolean;
}) {
	const name = item.rotation.name;
	const risks = riskLines(item, climate, regionName);
	const benefits = benefitLines(item, own);
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
						{name}
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

			{/* Two columns only when the card itself is wide: the panel is narrow beside the map. */}
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

			<div className="space-y-0.5 border-t pt-2">
				<Fold title="Field calendar" rotationName={name} open={calendarOpen}>
					<FieldCalendar
						calendar={item.calendar}
						windows={windows}
						rotationName={name}
					/>
				</Fold>
				<Fold title="Evidence" rotationName={name}>
					<Lines
						lines={evidenceLines(item, LIBRARY)}
						none="No number could be worked out for this rotation here."
					/>
				</Fold>
				<Fold title={`Benefits (${benefits.length})`} rotationName={name}>
					<Lines
						lines={benefits}
						none="No benefit has been sourced for this rotation yet, and the numbers show none against your current rotation."
					/>
				</Fold>
				<Fold title="Information gaps" rotationName={name}>
					<ul className="space-y-1.5">
						{informationGaps(item).map((gap) => (
							<li key={gap}>{gap}</li>
						))}
					</ul>
				</Fold>
				<Fold title={`Risks to verify locally (${risks.length})`} rotationName={name}>
					<Lines
						lines={risks}
						none={`No risk has been sourced for this rotation yet. That is a gap in the library, not a sign that it has none. ${VERIFY_LOCALLY}`}
					/>
				</Fold>
				<Fold title="How these scores were worked out" rotationName={name}>
					<ul className="space-y-1.5 text-muted-foreground">
						{INDICATOR_IDS.map((id) => (
							<li key={id}>
								<span className="font-medium text-foreground">
									{INDICATOR_LABELS[id]}:
								</span>{" "}
								{item.indicators[id].why}
							</li>
						))}
					</ul>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<span className="text-muted-foreground">Scores draw on</span>
						<SourceBadge source="NASA POWER" />
						<SourceBadge source="USDA NRCS SSURGO" />
						<span className="text-muted-foreground">
							and crop values from FAO-56, USDA NASS and K-State.
						</span>
					</div>
				</Fold>
			</div>

			<p className="text-xs text-muted-foreground">
				This compares rotations; it does not decide for you. {VERIFY_LOCALLY}
			</p>
		</div>
	);
}
