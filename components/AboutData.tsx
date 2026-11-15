"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The About the data tab (SPEC.md, user flow step 8, feature 10 and "SI layer"): every source
// with its link and purpose, the resolution table, satellite against ground, Sen's slope
// beside a least-squares slope for the selected field, how the scores are worked out with
// every constant the tool chose, and the glossary.
//
// Nothing here is typed twice: the sources, the uses, the constants and the definitions come
// from data/sources.json, data/glossary.json, config/scoring.json and the code's own
// constants through lib/about.ts and lib/glossary.ts.

import { ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Section } from "@/components/layout/page";
import { LinkedText } from "@/components/LinkedText";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	assumptions,
	describeUses,
	formatSlope,
	pairCount,
	SOURCE_KINDS,
	SOURCES,
	type SourceEntry,
	slopeRows,
	sourceAnchor,
	TOOL_RULES,
	termAnchor,
	usesOf,
} from "@/lib/about";
import { selectionOf, useFieldStore } from "@/lib/field-store";
import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryEntry } from "@/lib/glossary";
import { LIBRARY, SCORING } from "@/lib/library";
import { formatPValue, TREND_LABEL_TEXT } from "@/lib/trend-text";
import { MIN_TREND_POINTS } from "@/lib/trends";
import { cn } from "@/lib/utils";
import { useViewStore } from "@/lib/view-store";

/** The parts of the tab, in order. The ids are also what a link from the Field tab asks for. */
export const ABOUT_PARTS = [
	{ id: "about-sources", title: "Sources" },
	{ id: "about-precision", title: "How fine each source is" },
	{ id: "about-ground", title: "Satellite and ground" },
	{ id: "about-trends", title: "Two ways to measure a trend" },
	{ id: "about-scores", title: "How the scores are worked out" },
	{ id: "about-glossary", title: "Glossary" },
] as const;

const ASSUMPTIONS = assumptions();
const LIVE_SOURCES = SOURCES.filter((source) => source.kind === "live");
const INDICATOR_ENTRIES = GLOSSARY.filter((entry) => entry.group === "scores");

const ENTRY_CLASS =
	"scroll-mt-3 space-y-1 rounded-md border bg-background p-3 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Shown inside the entry a badge on the Field tab sent the reader to: one press goes back
 * to where they were.
 */
function BackToField({ at }: { at: string }) {
	const target = useViewStore((state) => state.target);
	const origin = useViewStore((state) => state.origin);
	const backToField = useViewStore((state) => state.backToField);
	if (target !== at || origin === null) return null;
	return (
		<p>
			<Button type="button" variant="outline" size="sm" onClick={backToField}>
				Back to where you were
			</Button>
		</p>
	);
}

/** True for the entry the reader was just sent to, so it can be picked out by eye. */
function useArrivedAt(id: string): boolean {
	return useViewStore((state) => state.target === id);
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex min-h-6 items-center gap-1 rounded-sm underline underline-offset-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
		>
			{children}
			<ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0" />
			<span className="sr-only"> (opens in a new tab)</span>
		</a>
	);
}

function SourceItem({ source }: { source: SourceEntry }) {
	const id = sourceAnchor(source.id);
	const headingId = useId();
	const arrived = useArrivedAt(id);
	const uses = usesOf(source);
	return (
		// Named by its heading: when focus is sent here, a screen reader says the title first.
		<li
			id={id}
			tabIndex={-1}
			aria-labelledby={headingId}
			className={cn(ENTRY_CLASS, arrived && "border-foreground/50")}
		>
			<h4 id={headingId} className="text-sm font-medium">
				{source.name}
			</h4>
			<BackToField at={id} />
			{source.purpose ? <p className="text-muted-foreground">{source.purpose}</p> : null}
			{uses.length > 0 ? (
				<p className="text-muted-foreground">
					<span className="font-medium text-foreground">
						{source.purpose ? "Also cited for:" : "Used for:"}
					</span>{" "}
					{describeUses(uses)}
				</p>
			) : null}
			{source.resolution ? (
				<p className="text-muted-foreground">
					<span className="font-medium text-foreground">Resolution:</span>{" "}
					{source.resolution}
				</p>
			) : null}
			{source.confidence ? (
				<p className="text-muted-foreground">
					<span className="font-medium text-foreground">For one field:</span>{" "}
					{source.confidence}
				</p>
			) : null}
			<p className="flex flex-wrap gap-x-4 gap-y-0.5">
				{source.links.map((link) => (
					<ExternalLink key={link.url} href={link.url}>
						{link.label}
					</ExternalLink>
				))}
			</p>
		</li>
	);
}

function GlossaryItem({ entry }: { entry: GlossaryEntry }) {
	const id = termAnchor(entry.id);
	const headingId = useId();
	const arrived = useArrivedAt(id);
	return (
		<li
			id={id}
			tabIndex={-1}
			aria-labelledby={headingId}
			className={cn(ENTRY_CLASS, arrived && "border-foreground/50")}
		>
			<h4 id={headingId} className="text-sm font-medium">
				{entry.term}
			</h4>
			<BackToField at={id} />
			<p>{entry.definition}</p>
			{entry.here ? <p>{entry.here}</p> : null}
			{entry.note ? <p>{entry.note}</p> : null}
			<p className="text-muted-foreground">
				{entry.source ? (
					<LinkedText text={entry.source} prefix={entry.own ? "Leans on:" : "Source:"} />
				) : (
					"The tool's own term: it says what this tool does, not what a publication defines."
				)}
			</p>
		</li>
	);
}

/** Sen's slope beside the least-squares slope for the selected field, with all its states. */
function SlopeComparison() {
	const panel = useFieldStore((state) => state.panel);
	const retry = useFieldStore((state) => state.retry);
	const selection = selectionOf(panel);

	if (panel.kind !== "field" || !selection) {
		return (
			<EmptyState
				headingLevel={3}
				title="No field selected"
				description="Choose a field on the map or on the Field tab. The two slopes for its climate record will be listed here."
			/>
		);
	}
	if (panel.climate.status === "loading") {
		return (
			<div>
				<p role="status" className="sr-only">
					Loading the climate history for {selection.name}.
				</p>
				<div aria-hidden="true" className="space-y-2">
					<Skeleton className="h-4 w-56 max-w-full" />
					{[0, 1, 2, 3, 4].map((row) => (
						<Skeleton key={row} className="h-8 w-full" />
					))}
				</div>
			</div>
		);
	}
	if (panel.climate.status === "error") {
		return (
			<ErrorState
				title="The climate history could not be loaded"
				error={
					new Error(
						`${panel.climate.message.trim().replace(/[.!?]?$/, ".")} The two slopes are worked out from it.`,
					)
				}
				onRetry={() => retry("climate")}
			/>
		);
	}

	const climate = panel.climate.data;
	const rows = slopeRows(climate);
	if (rows.length === 0) {
		return (
			<p className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
				A trend needs at least {MIN_TREND_POINTS} complete years, and the record at{" "}
				{selection.name} has fewer, so there are no slopes to compare.
			</p>
		);
	}
	const firstYear = climate.years[0]?.year;
	const lastYear = climate.years[climate.years.length - 1]?.year;
	const longest = Math.max(...rows.map((row) => row.years));
	return (
		<div className="space-y-2">
			<div
				role="region"
				aria-label="Change per decade, as a table"
				// A box that can scroll sideways has to take keyboard focus to be scrolled by keyboard.
				tabIndex={0}
				className="overflow-x-auto rounded-md border outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
			>
				<table className="w-full border-collapse text-left text-xs tabular-nums">
					<caption className="border-b bg-background px-3 py-2 text-left font-medium">
						Change per decade at {selection.name}, {firstYear} to {lastYear}
					</caption>
					<thead>
						<tr className="text-muted-foreground">
							<th scope="col" className="border-b px-2 py-1.5 font-medium">
								Yearly series
							</th>
							<th scope="col" className="border-b px-2 py-1.5 font-medium">
								Sen&apos;s slope
							</th>
							<th scope="col" className="border-b px-2 py-1.5 font-medium">
								Linear regression
							</th>
							<th scope="col" className="border-b px-2 py-1.5 font-medium">
								Mann-Kendall test
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id} className="border-b align-top last:border-b-0">
								<th scope="row" className="px-2 py-1.5 font-normal">
									{row.name}
								</th>
								<td className="px-2 py-1.5">
									{formatSlope(row.sensPerDecade, row.unit)}
								</td>
								<td className="px-2 py-1.5">
									{formatSlope(row.linearPerDecade, row.unit)}
								</td>
								<td className="px-2 py-1.5">
									{TREND_LABEL_TEXT[row.label]}, {formatPValue(row.pValue)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="text-xs text-muted-foreground">
				For the two freeze dates, + means later in the year. In a record of {longest}{" "}
				years there are {pairCount(longest)} pairs of years, and any one year is part of
				only {longest - 1} of them.
			</p>
		</div>
	);
}

function Heading3({ children }: { children: ReactNode }) {
	return <h3 className="text-sm font-medium">{children}</h3>;
}

export function AboutData() {
	return (
		<div className="space-y-4">
			<Section
				title="About the data"
				description="Where each number comes from, how far to trust it, and what the tool does with it."
				contentClassName="space-y-3 text-sm"
			>
				<p>
					Field Shift Kansas compares crop rotations for one field. It reads what the
					field has grown, its soil and its climate since 1981 from public sources,
					scores each rotation on seven indicators, and orders the rotations by the
					priorities you set.
				</p>
				<nav aria-label="On this tab">
					<ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
						{ABOUT_PARTS.map((part) => (
							<li key={part.id}>
								<a
									href={`#${part.id}`}
									className="inline-flex min-h-6 items-center rounded-sm underline underline-offset-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
								>
									{part.title}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<div className="space-y-1.5">
					<Heading3>What it cannot tell you</Heading3>
					<ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
						<li>
							A score compares rotations with each other. It is not a forecast of yield,
							price or profit.
						</li>
						<li>
							The tool cannot see local prices, this field&apos;s history beyond the crop
							map, irrigation rights, crop insurance rules or local disease pressure.
						</li>
						<li>
							Crop water demand is potential demand: what a well-watered crop would use.
						</li>
						<li>
							NASA POWER describes an area roughly 35 miles across, not this field. A
							hot day is counted only when that area&apos;s high reaches{" "}
							{SCORING.hotDayF}°F. At one point in central Kansas, its hottest day of
							2019 was 94.9°F, so that year shows no hot day there.
						</li>
						<li>
							The library holds {LIBRARY.rotations.length} rotations so far. A value
							with no source yet is left out, never guessed.
						</li>
					</ul>
				</div>
				<div className="space-y-1.5">
					<Heading3>How this text was written</Heading3>
					<p className="text-xs text-muted-foreground">
						AI-assisted: the explanations on this tab and in the term tooltips were
						written with Claude, an AI assistant, from the sources linked beside them,
						and reviewed by Angel Balderas. Nothing on screen is written by AI while you
						use the tool. Every sentence on a rotation card is a fixed template filled
						with a computed number or a sourced library entry.
					</p>
				</div>
			</Section>

			<div id="about-sources" className="scroll-mt-3">
				<Section
					title="Sources"
					description="Every source the tool draws on, with what it is used for."
					contentClassName="space-y-4"
				>
					{SOURCE_KINDS.map((kind) => (
						<div key={kind.id} className="space-y-2">
							<Heading3>{kind.title}</Heading3>
							{kind.note ? (
								<p className="text-xs text-muted-foreground">{kind.note}</p>
							) : null}
							<ul className="space-y-2">
								{SOURCES.filter((source) => source.kind === kind.id).map((source) => (
									<SourceItem key={source.id} source={source} />
								))}
							</ul>
						</div>
					))}
				</Section>
			</div>

			<div id="about-precision" className="scroll-mt-3">
				<Section
					title="How fine each source is"
					description="The size of what each source sees, and how far to trust it for one field."
					contentClassName="space-y-2"
				>
					<div
						role="region"
						aria-label="How fine each source is, as a table"
						tabIndex={0}
						className="overflow-x-auto rounded-md border outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
					>
						<table className="w-full border-collapse text-left text-xs">
							<caption className="sr-only">
								Resolution of each source read for a field, and the confidence it
								deserves for one field
							</caption>
							<thead>
								<tr className="text-muted-foreground">
									<th scope="col" className="border-b px-2 py-1.5 font-medium">
										Source
									</th>
									<th scope="col" className="border-b px-2 py-1.5 font-medium">
										Resolution
									</th>
									<th scope="col" className="border-b px-2 py-1.5 font-medium">
										For one field
									</th>
								</tr>
							</thead>
							<tbody>
								{LIVE_SOURCES.map((source) => (
									<tr key={source.id} className="border-b align-top last:border-b-0">
										<th scope="row" className="px-2 py-1.5 font-medium">
											{source.name}
										</th>
										<td className="px-2 py-1.5">{source.resolution}</td>
										<td className="px-2 py-1.5">{source.confidence}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="text-xs text-muted-foreground">
						A score is only as local as its coarsest input. Water fit and heat exposure
						are worked out from NASA POWER, so they describe the area&apos;s weather on
						this field&apos;s soil, not this field&apos;s own weather.
					</p>
				</Section>
			</div>

			<div id="about-ground" className="scroll-mt-3">
				<Section
					title="Satellite and ground"
					description="What a long record from above can and cannot see."
					contentClassName="space-y-2 text-sm"
				>
					<p>
						Satellites and weather models see large areas the same way every day, back
						decades, but they average over many fields. A rain gauge or a soil probe is
						exact for one spot and nowhere else. The tool uses the long, even record
						for the long view.
					</p>
					<p>
						NASA POWER is itself both. Its temperature, rain, humidity and wind come
						from NASA&apos;s weather models, and its sunlight from satellite
						observations. A local reading would sharpen the answer here:
					</p>
					<ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
						<li>
							<span className="font-medium text-foreground">Rain and heat.</span> NASA
							POWER gives one value for an area roughly 35 miles across. A rain gauge
							and a thermometer on the farm tell you what this field got.
						</li>
						<li>
							<span className="font-medium text-foreground">Water in the soil.</span>{" "}
							The tool estimates the water stored before planting from rain and one
							published average. A soil probe at planting measures it.
						</li>
						<li>
							<span className="font-medium text-foreground">Crops grown.</span> The
							Cropland Data Layer reads one 30 m pixel and can be wrong for a year. Your
							own records are better, and you can enter them on the Field tab.
						</li>
						<li>
							<span className="font-medium text-foreground">Soil.</span> The survey
							describes a map unit by its main soil, and a map unit can include other
							soils. What you know of this field&apos;s soil counts for more.
						</li>
					</ul>
				</Section>
			</div>

			<div id="about-trends" className="scroll-mt-3">
				<Section
					title="Two ways to measure a trend"
					description="Sen's slope beside a linear regression slope, for the selected field."
					contentClassName="space-y-3 text-sm"
				>
					<p>
						Each climate chart gives a change per decade. The tool measures it with
						Sen&apos;s slope and asks the Mann-Kendall test whether it is a trend. It
						also works out the slope of an ordinary linear regression line, fitted by
						least squares, shown here only so the two can be compared.
					</p>
					<SlopeComparison />
					<div className="space-y-1.5 text-xs text-muted-foreground">
						<p>
							<span className="font-medium text-foreground">
								Why the tool reports Sen&apos;s slope.
							</span>{" "}
							It takes the slope between every pair of years and keeps the middle one.
							One extreme year, such as a severe drought, is part of only a small share
							of those pairs, so it can move the middle slope only a little. EPA&apos;s guidance
							calls Sen&apos;s slope &quot;insensitive to outliers&quot;. A regression
							line is fitted to all the years at once, and the same guidance says
							regression &quot;is very sensitive to extreme values (outliers)&quot;. A
							wide gap between the two slopes is a reason to look at the chart for an
							unusual year.
						</p>
						<p>
							<span className="font-medium text-foreground">
								What the test takes for granted.
							</span>{" "}
							It treats the years as independent of each other. EPA&apos;s guidance
							warns that &quot;applying the usual tests to correlated data tends to
							result in a test whose actual significance level (false rejection error
							rate) is larger than the nominal error rate&quot;. Weather in one year is
							not wholly independent of the year before, so a label can look more
							certain than it is.
						</p>
						<p>
							<LinkedText
								prefix="Source:"
								text="U.S. EPA, Guidance for Data Quality Assessment: Practical Methods for Data Analysis (EPA QA/G-9, QA00 update, July 2000), sections 4.3.2.1, 4.3.3.1 and 4.8. https://www.epa.gov/sites/default/files/2015-06/documents/g9-final.pdf"
							/>
						</p>
					</div>
				</Section>
			</div>

			<div>
				<Section
					id="about-scores"
					focusable
					className="scroll-mt-3"
					title="How the scores are worked out"
					description="The seven indicators, the sliders, and every number and rule the tool chose."
					contentClassName="space-y-4"
				>
					<BackToField at="about-scores" />
					<p className="text-sm">
						Each rotation gets seven scores from 0 to 100, and its overall score is
						their weighted average. A slider sets the weight of the indicators listed
						under it, shared equally between them. An indicator with no score for a
						rotation is left out of that rotation&apos;s average. With every slider at
						zero, all seven count the same.
					</p>
					<div className="space-y-2">
						<Heading3>The seven indicators</Heading3>
						<ul className="space-y-2">
							{INDICATOR_ENTRIES.map((entry) => (
								<GlossaryItem key={entry.id} entry={entry} />
							))}
						</ul>
					</div>
					<div className="space-y-2">
						<Heading3>Tool assumptions: the numbers the tool chose</Heading3>
						<p className="text-xs text-muted-foreground">
							None of these is a published fact. Each is a choice, kept in one file so
							that it can be seen and changed.
						</p>
						<ul className="space-y-2">
							{ASSUMPTIONS.map((item) => (
								<li key={item.key} className={ENTRY_CLASS}>
									<h4 className="text-sm font-medium">
										{item.label}
										{item.value ? (
											<span className="font-normal text-muted-foreground">
												{" "}
												· {item.value}
											</span>
										) : null}
									</h4>
									<p>{item.text}</p>
									{item.source ? (
										<p className="text-muted-foreground">
											<LinkedText text={item.source} prefix="What is published:" />
										</p>
									) : null}
									{item.assumption ? (
										<p className="text-muted-foreground">
											<LinkedText text={item.assumption} prefix="What the tool did:" />
										</p>
									) : null}
								</li>
							))}
						</ul>
					</div>
					<div className="space-y-2">
						<Heading3>Rules with no number to tune</Heading3>
						<ul className="space-y-2">
							{TOOL_RULES.map((rule) => (
								<li key={rule.title} className={ENTRY_CLASS}>
									<h4 className="text-sm font-medium">{rule.title}</h4>
									<p>{rule.text}</p>
								</li>
							))}
						</ul>
					</div>
				</Section>
			</div>

			<div id="about-glossary" className="scroll-mt-3">
				<Section
					title="Glossary"
					description="The terms used on the Field tab, each with where its definition comes from."
					contentClassName="space-y-4"
				>
					{GLOSSARY_GROUPS.filter((group) => group.id !== "scores").map((group) => (
						<div key={group.id} className="space-y-2">
							<Heading3>{group.title}</Heading3>
							<ul className="space-y-2">
								{GLOSSARY.filter((entry) => entry.group === group.id).map((entry) => (
									<GlossaryItem key={entry.id} entry={entry} />
								))}
							</ul>
						</div>
					))}
					<p className="text-xs text-muted-foreground">
						The seven scores are explained above, under How the scores are worked out.
					</p>
				</Section>
			</div>
		</div>
	);
}
