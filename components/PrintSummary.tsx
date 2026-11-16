"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The printable summary (SPEC.md, feature 18): "One-page print view of the field, conditions
// and top rotations". It is in the page all the time but shown only on paper (`hidden
// print:block`), where the app itself is hidden; the "Print summary" button in the Field
// panel opens the browser's print dialog. It reads the same stores and the same scoring as
// the panel (lib/use-ranking.ts), so what prints is what was on screen: the field, the crops
// grown, the soil, the priorities as set, the field's own rotation and the three best
// matches with their seven scores, the four climate series with their trends, the county's
// soil moisture when there is one, and the sources. Every sentence is fixed wording or a
// template filled with a computed number; no language model writes any of it.
//
// Three type sizes (SPEC.md, "Type"): the title, the body with its headings, and the tables
// with the footer. CSS pixels print at 96 to the inch, so 12 px is 9 pt and 11 px is 8.25 pt.

import type { ReactNode } from "react";
import { describeRainChange } from "@/components/PrioritySliders";
import { INDICATOR_LABELS, PRIORITY_LABELS, whySuggested } from "@/lib/card-text";
import { useFieldStore } from "@/lib/field-store";
import { FREEZE_F, GROWING_SEASON, HOT_DAY_F } from "@/lib/indicators";
import { INDICATOR_IDS, PRIORITIES } from "@/lib/library";
import {
	describeMoisture,
	formatMonth,
	MOISTURE_LABEL_TEXT,
	moistureLabel,
} from "@/lib/moisture";
import { cropLabel, rotationYears } from "@/lib/rotation-edit";
import { annualRainIn, type RankedRotation, recentClimate } from "@/lib/scoring";
import {
	describeTrend,
	FREEZE_DATE_WORDS,
	formatDayOfYear,
	formatLatLon,
	HOT_DAY_WORDS,
	monthName,
	SEASON_RAIN_WORDS,
	type SeriesWords,
	TREND_LABEL_TEXT,
} from "@/lib/trend-text";
import { MIN_TREND_POINTS } from "@/lib/trends";
import type { ClimateResponse } from "@/lib/types";
import { useFieldRanking } from "@/lib/use-ranking";

const LOADING = { status: "loading" } as const;
const NO_EDITS: Readonly<Record<number, number>> = {};
/** SPEC.md: the field's own rotation plus the top three candidates. */
const TOP_CANDIDATES = 3;
const REGION_NAMES = { west: "western", central: "central", east: "eastern" };
const LIVE_URL = "space-apps-2026-field-shift.vercel.app";
const DISCLAIMER = "This tool supports your judgment. It does not replace it.";
/** The soil survey has no value for the map unit (the same words as components/FieldSummary.tsx). */
const NOT_AVAILABLE = "Not available";

type SeriesId = "hotDays" | "seasonRainIn" | "lastSpringFreezeDoy" | "firstFallFreezeDoy";

const SEASON = `${monthName(GROWING_SEASON.firstMonth)} to ${monthName(GROWING_SEASON.lastMonth)}`;

// The same four series as the Conditions charts (components/ConditionsCharts.tsx), as rows.
const CONDITION_ROWS: {
	id: SeriesId;
	label: string;
	words: SeriesWords;
	value: (value: number) => string;
}[] = [
	{
		id: "hotDays",
		label: `Hot days (high at or above ${HOT_DAY_F}°F)`,
		words: HOT_DAY_WORDS,
		value: (value) => `${Math.round(value)} days a year`,
	},
	{
		id: "seasonRainIn",
		label: `Growing-season rain (${SEASON})`,
		words: SEASON_RAIN_WORDS,
		value: (value) => `${value.toFixed(1)} in a year`,
	},
	{
		id: "lastSpringFreezeDoy",
		label: `Last spring freeze (${FREEZE_F}°F or below, January to June)`,
		words: FREEZE_DATE_WORDS,
		value: (value) => formatDayOfYear(value),
	},
	{
		id: "firstFallFreezeDoy",
		label: `First fall freeze (${FREEZE_F}°F or below, July to December)`,
		words: FREEZE_DATE_WORDS,
		value: (value) => formatDayOfYear(value),
	},
];

/** The long-term average of a series over the years that have a value, as the chart draws it. */
function average(climate: ClimateResponse, id: SeriesId): number | null {
	const values = climate.years
		.map((year) => year[id])
		.filter((value): value is number => value !== null);
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function withUnit(value: number | null, unit: string): string {
	return value === null ? NOT_AVAILABLE : `${value}${unit}`;
}

const CELL = "border border-border px-1 py-0.5";

function Heading({ children }: { children: ReactNode }) {
	return (
		<h2 className="mt-3 mb-1 border-b border-border pb-0.5 font-semibold uppercase tracking-wide">
			{children}
		</h2>
	);
}

function ScoreCell({ score }: { score: number | null }) {
	return <td className={`${CELL} text-right tabular-nums`}>{score === null ? "—" : Math.round(score)}</td>;
}

function Page({ subtitle, children }: { subtitle: ReactNode; children: ReactNode }) {
	// The date is read in the browser only: this component renders nothing on the server
	// until a field is chosen, and the fallback below has no date.
	return (
		<div
			data-print-summary
			className="hidden bg-background text-xs leading-snug text-foreground print:block"
		>
			<header className="flex items-baseline justify-between gap-3 border-b-2 border-foreground pb-1">
				<div>
					<h1 className="text-sm font-semibold tracking-tight">Field Shift Kansas: field summary</h1>
					<p>{subtitle}</p>
				</div>
				<p className="text-right">{LIVE_URL}</p>
			</header>
			<p role="note" className="mt-1 font-medium">
				{DISCLAIMER}
			</p>
			{children}
		</div>
	);
}

export function PrintSummary() {
	const panel = useFieldStore((state) => state.panel);
	const field = panel.kind === "field" ? panel : null;
	const { priorities, constraints, climateData, soilData, historyData, own, ranking } =
		useFieldRanking(
			field?.climate ?? LOADING,
			field?.history ?? LOADING,
			field?.soil ?? LOADING,
			field?.cropEdits ?? NO_EDITS,
		);

	// Nothing chosen, or a spot outside Kansas: Ctrl+P still gets a page with the disclaimer.
	if (!field) {
		return (
			<Page subtitle="No field chosen">
				<p className="mt-2">
					{panel.kind === "outside"
						? "The spot chosen is outside Kansas. This tool covers Kansas only."
						: "Pick a field on the map, or a sample field, to print its summary."}
				</p>
			</Page>
		);
	}

	const { selection } = field;
	const historyLoading = field.history.status === "loading";
	// Reached only in the browser, once a field is selected: never during the prerender.
	const years = historyLoading ? [] : rotationYears(historyData, field.cropEdits, new Date().getFullYear());
	const edited = years.filter((row) => row.edited).length;
	const recent = climateData ? recentClimate(climateData) : null;
	const yearlyRain = climateData ? annualRainIn(climateData) : null;
	const regionName = ranking?.region ? REGION_NAMES[ranking.region] : null;
	// The cards wait for all three facts before they score (components/RotationRanking.tsx).
	const waiting =
		field.climate.status === "loading" ||
		field.soil.status === "loading" ||
		historyLoading;
	const ownItem = ranking?.existing ?? null;
	const ownScored = ownItem !== null && ownItem.total !== null;
	const top = ranking ? ranking.candidates.slice(0, TOP_CANDIDATES) : [];
	const first: RankedRotation | null = top[0] ?? null;
	const best = first !== null && first.total !== null ? first : null;
	const leftOff = ranking ? ranking.candidates.length - top.length + ranking.elsewhere.length : 0;
	const rows: { name: string; item: RankedRotation }[] = [
		...(ownItem && ownScored ? [{ name: "Your current rotation", item: ownItem }] : []),
		...top.map((item, index) => ({ name: `${index + 1}. ${item.rotation.name}`, item })),
	];
	const moisture =
		field.moisture.status === "ready" && field.moisture.data.kind === "county"
			? field.moisture.data
			: null;
	const latest = moisture?.data.latest ?? null;
	const moistureState = latest ? moistureLabel(latest.z) : null;
	const printed = new Date().toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	const firstYear = climateData?.years[0]?.year;
	const lastYear = climateData?.years[climateData.years.length - 1]?.year;

	return (
		<Page
			subtitle={
				<>
					{selection.name} · {formatLatLon(selection.lat, selection.lon)}
					{moisture ? ` · ${moisture.county.name}` : ""} · Printed {printed}
				</>
			}
		>
			<Heading>Crops grown here</Heading>
			{historyLoading ? (
				<p>The crop history was still loading when this was printed.</p>
			) : field.history.status === "error" && edited === 0 ? (
				<p>The crop history could not be loaded, and no years were filled in by hand.</p>
			) : (
				<p>
					{years
						.map(
							(row) =>
								`${row.year}: ${row.cdlCode === null ? "no crop chosen" : cropLabel(row.cdlCode)}${row.edited ? " (yours)" : ""}`,
						)
						.join(" · ")}
					.{" "}
					{historyData
						? edited === 0
							? "Read from one pixel of the USDA Cropland Data Layer, which can be wrong for a year."
							: `${edited} of ${years.length} years changed by you; the rest are from one pixel of the USDA Cropland Data Layer, which can be wrong for a year.`
						: "Not from the Cropland Data Layer: these years were filled in by hand."}
				</p>
			)}

			<Heading>Soil (USDA NRCS soil survey, SSURGO)</Heading>
			{soilData ? (
				<p>
					<span className="font-medium">{soilData.mapUnitName}.</span> Texture{" "}
					{soilData.texture ?? NOT_AVAILABLE} · Available water, top 39 in{" "}
					{withUnit(soilData.availableWaterIn, " in")} · Organic matter{" "}
					{withUnit(soilData.organicMatterPct, "%")} · Slope {withUnit(soilData.slopePct, "%")} ·
					K factor {withUnit(soilData.kFactor, "")} · Wind erodibility index{" "}
					{withUnit(soilData.windErodibilityIndex, " tons/acre/yr")} · Hydrologic group{" "}
					{soilData.hydrologicGroup ?? NOT_AVAILABLE}. The soil map unit under the point.
					Available water and slope are for the whole unit, and the other figures for its
					main soil; a map unit can include other soils.
				</p>
			) : (
				<p>
					{field.soil.status === "loading"
						? "The soil facts were still loading when this was printed."
						: "The soil facts could not be loaded, so soil protection has no score."}
				</p>
			)}

			<Heading>Your priorities</Heading>
			<p>
				{PRIORITIES.map((priority) => `${PRIORITY_LABELS[priority]} ${priorities[priority]}`).join(
					" · ",
				)}{" "}
				(each 0 to 100) ·{" "}
				{constraints.irrigationAvailable
					? "This field can be irrigated."
					: "Scored as dryland: the irrigation switch was off."}
				{(constraints.rainChangePct ?? 0) !== 0
					? ` Rain scenario: ${describeRainChange(constraints.rainChangePct ?? 0)} in every month, your scenario rather than the record; only water fit changes.`
					: ""}
			</p>

			<Heading>Rotations, scored for this field</Heading>
			{waiting || !climateData || !ranking ? (
				<p>
					{field.climate.status === "error"
						? "The climate history could not be loaded, so no rotation is scored."
						: "The rotations were still being scored when this was printed."}
				</p>
			) : !recent ? (
				<p>
					The rotations are scored from monthly rain and reference evapotranspiration, and
					this answer has none. Nothing is estimated in their place.
				</p>
			) : (
				<>
					<p className="mb-1">
						{yearlyRain !== null && regionName
							? `About ${Math.round(yearlyRain)} in of rain a year here, which the tool counts as ${regionName} Kansas. `
							: ""}
						Scores use the weather of {recent.firstYear} to {recent.lastYear}. Each score
						runs from 0 to 100 and compares rotations with each other; it is not a forecast
						of yield or price.
					</p>
					{rows.length === 0 ? (
						<p>No rotation could be scored for this field.</p>
					) : (
						<table className="w-full border-collapse text-[11px]">
							<thead>
								<tr>
									<th scope="col" className={`${CELL} text-left font-medium`}>
										Rotation
									</th>
									<th scope="col" className={`${CELL} text-right font-medium`}>
										Score
									</th>
									{INDICATOR_IDS.map((id) => (
										<th key={id} scope="col" className={`${CELL} text-right font-medium`}>
											{INDICATOR_LABELS[id]}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map(({ name, item }) => (
									<tr key={name} className={item === best ? "font-medium" : ""}>
										<th scope="row" className={`${CELL} text-left font-normal`}>
											{name}
											{item === best ? " (best match)" : ""}
											{item === ownItem && own && own.leftOut.length > 0
												? ` (scored on ${own.scoredYears} of ${own.totalYears} years)`
												: ""}
										</th>
										<td className={`${CELL} text-right font-semibold tabular-nums`}>
											{item.total === null ? "—" : Math.round(item.total)}
										</td>
										{INDICATOR_IDS.map((id) => (
											<ScoreCell key={id} score={item.indicators[id].score} />
										))}
									</tr>
								))}
							</tbody>
						</table>
					)}
					{best ? (
						<p className="mt-1">
							<span className="font-medium">{best.rotation.name}:</span>{" "}
							{whySuggested(best, ownScored ? ownItem : null)}
						</p>
					) : null}
					{leftOff > 0 ? (
						<p>
							{leftOff} more rotation{leftOff === 1 ? " was" : "s were"} scored and left off
							this page. The app lists them.
						</p>
					) : null}
				</>
			)}

			<Heading>Conditions since {firstYear ?? 1981} (NASA POWER)</Heading>
			{!climateData ? (
				<p>
					{field.climate.status === "error"
						? "The climate history could not be loaded."
						: "The climate history was still loading when this was printed."}
				</p>
			) : climateData.years.length === 0 ? (
				<p>No complete year of daily weather for this point.</p>
			) : (
				<>
					<table className="w-full border-collapse text-[11px]">
						<thead>
							<tr>
								<th scope="col" className={`${CELL} text-left font-medium`}>
									Series
								</th>
								<th scope="col" className={`${CELL} text-left font-medium`}>
									Average, {firstYear} to {lastYear}
								</th>
								<th scope="col" className={`${CELL} text-left font-medium`}>
									Trend
								</th>
								<th scope="col" className={`${CELL} text-left font-medium`}>
									What the test found
								</th>
							</tr>
						</thead>
						<tbody>
							{CONDITION_ROWS.map((row) => {
								const mean = average(climateData, row.id);
								const trend = climateData.trends[row.id];
								return (
									<tr key={row.id}>
										<th scope="row" className={`${CELL} text-left font-normal`}>
											{row.label}
										</th>
										<td className={CELL}>{mean === null ? "no values" : row.value(mean)}</td>
										<td className={CELL}>{trend ? TREND_LABEL_TEXT[trend.label] : "Not tested"}</td>
										<td className={CELL}>
											{trend
												? describeTrend(trend, row.words)
												: `Fewer than ${MIN_TREND_POINTS} complete years.`}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					<p className="mt-0.5">
						NASA POWER describes a grid cell roughly 35 miles across: the area&apos;s record,
						not a reading from this field. Trend labels come from a Mann-Kendall test; the
						change per decade is Sen&apos;s slope. The {SEASON} season, the {HOT_DAY_F}°F
						hot-day line and the freeze windows are this tool&apos;s own choices, and dates are
						read on a 365-day year.
					</p>
				</>
			)}

			{moisture && latest ? (
				<>
					<Heading>Soil moisture now (NASA SMAP, {moisture.county.name})</Heading>
					<p>
						<span className="font-medium">
							{moistureState ? MOISTURE_LABEL_TEXT[moistureState] : "Too few years to say"},{" "}
							{formatMonth(latest.year, latest.month)}.
						</span>{" "}
						{describeMoisture(latest)} A short record (SMAP began in 2015), for the county&apos;s
						top layer of soil on a 9 km grid, not this field. No score uses it.
					</p>
				</>
			) : null}

			<footer className="mt-3 border-t border-border pt-1 text-[11px]">
				<p>
					Sources: NASA POWER (weather since 1981), USDA NASS Cropland Data Layer (crops),
					USDA NRCS SSURGO through Soil Data Access (soil)
					{moisture ? ", NASA SMAP through AppEEARS (soil moisture)" : ""}, with crop values
					from FAO-56, USDA NASS and K-State Research and Extension. The scoring model and
					the numbers it chose are this tool&apos;s own; the app&apos;s About the data tab
					lists every source and assumption. Built with AI assistance (Claude); Angel
					Balderas decides the design and reviews the work. The text on this page is fixed
					wording and templates, not written by a language model. Check with your local
					K-State extension agent.
				</p>
			</footer>
		</Page>
	);
}
