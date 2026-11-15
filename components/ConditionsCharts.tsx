"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Climate charts for the selected field (SPEC.md, features 2 and 3, user flow step 6): hot
// days, growing-season rain and the last spring freeze, one per tab, each from 1981 to the
// last full year with its trend arrow, its confidence label, its long-term average and a
// table of the same numbers. The first fall freeze is a fourth tab: SPEC.md's trend
// detection lists the series, and its trend is the clearest one at the sample fields.
//
// Hot days and rain are amounts, so they are bars from zero. A freeze date is a day of the
// year, where zero means nothing, so it is drawn as points on a date axis.

import { MoveRightIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useId } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	type TooltipContentProps,
	XAxis,
	YAxis,
} from "recharts";
import { SourceBadge } from "@/components/SourceBadge";
import { EmptyState } from "@/components/states";
import { type Tone, ToneBadge } from "@/components/tone-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FREEZE_F, GROWING_SEASON, HOT_DAY_F } from "@/lib/indicators";
import {
	describeTrend,
	FREEZE_DATE_WORDS,
	formatDayOfYear,
	formatPValue,
	HOT_DAY_WORDS,
	monthName,
	SEASON_RAIN_WORDS,
	type SeriesWords,
	TREND_LABEL_TEXT,
	type TrendDirection,
	trendDirection,
} from "@/lib/trend-text";
import { MIN_TREND_POINTS, type TrendSummary } from "@/lib/trends";
import type { ClimateResponse } from "@/lib/types";

type YearRow = ClimateResponse["years"][number];
type Point = { year: number; value: number | null };

const SEASON = `${monthName(GROWING_SEASON.firstMonth)} to ${monthName(GROWING_SEASON.lastMonth)}`;

type Series = {
	id: "hotDays" | "seasonRainIn" | "lastSpringFreezeDoy" | "firstFallFreezeDoy";
	tab: string;
	title: string;
	/** What one value is, with the years it covers. */
	subtitle: (firstYear: number, lastYear: number) => string;
	axisTitle: string;
	axisWidth: number;
	kind: "bars" | "dates";
	words: SeriesWords;
	/** Status colour for a trend that the test finds: which direction is the one to watch. */
	tone: Record<TrendDirection, Tone>;
	/** A value as it is read out: "41 hot days", "14.2 in", "April 21". */
	value: (value: number) => string;
	/** A value on the axis. */
	tick: (value: number) => string;
	average: (average: number) => string;
	low: string;
	high: string;
	tableHeader: string;
	note: string;
};

// Status colour marks the direction of a trend, and only once the test finds one (SPEC.md,
// "UI rules": status colours only for wetter or drier and for trend direction). The warning
// tone goes to the direction a crop is exposed to: more hot days, less rain, a later freeze.
const SERIES: Series[] = [
	{
		id: "hotDays",
		tab: "Hot days",
		title: "Hot days each year",
		subtitle: (first, last) =>
			`Days with a high of ${HOT_DAY_F}°F or above, ${first} to ${last}`,
		axisTitle: "Days per year",
		axisWidth: 32,
		kind: "bars",
		words: HOT_DAY_WORDS,
		tone: { up: "warning", down: "info", flat: "neutral" },
		value: (value) => `${value} ${value === 1 ? "hot day" : "hot days"}`,
		tick: (value) => String(value),
		average: (average) => `${Math.round(average)} days a year`,
		low: "Fewest",
		high: "Most",
		tableHeader: `Days at or above ${HOT_DAY_F}°F`,
		note: "",
	},
	{
		id: "seasonRainIn",
		tab: "Rain",
		title: "Growing-season rain each year",
		subtitle: (first, last) => `Rain from ${SEASON}, ${first} to ${last}`,
		axisTitle: "Inches",
		axisWidth: 32,
		kind: "bars",
		words: SEASON_RAIN_WORDS,
		tone: { up: "info", down: "warning", flat: "neutral" },
		value: (value) => `${value.toFixed(1)} in`,
		tick: (value) => String(value),
		average: (average) => `${average.toFixed(1)} in a year`,
		low: "Driest",
		high: "Wettest",
		tableHeader: `Rain, ${SEASON} (in)`,
		note: `${SEASON} is this tool's own choice of growing season: no public definition for Kansas was found. `,
	},
	{
		id: "lastSpringFreezeDoy",
		tab: "Spring freeze",
		title: "Last spring freeze each year",
		subtitle: (first, last) =>
			`The last day from January to June with a low of ${FREEZE_F}°F or below, ${first} to ${last}`,
		axisTitle: "Date",
		axisWidth: 54,
		kind: "dates",
		words: FREEZE_DATE_WORDS,
		tone: { up: "warning", down: "info", flat: "neutral" },
		value: (value) => formatDayOfYear(value),
		tick: (value) => formatDayOfYear(value, "short"),
		average: (average) => formatDayOfYear(average),
		low: "Earliest",
		high: "Latest",
		tableHeader: `Last day at or below ${FREEZE_F}°F`,
		note: "Dates are read on a 365-day year, so in a leap year they can be a day off. ",
	},
	{
		id: "firstFallFreezeDoy",
		tab: "Fall freeze",
		title: "First fall freeze each year",
		subtitle: (first, last) =>
			`The first day from July to December with a low of ${FREEZE_F}°F or below, ${first} to ${last}`,
		axisTitle: "Date",
		axisWidth: 54,
		kind: "dates",
		words: FREEZE_DATE_WORDS,
		// An earlier fall freeze is the one that catches a crop still in the field.
		tone: { up: "info", down: "warning", flat: "neutral" },
		value: (value) => formatDayOfYear(value),
		tick: (value) => formatDayOfYear(value, "short"),
		average: (average) => formatDayOfYear(average),
		low: "Earliest",
		high: "Latest",
		tableHeader: `First day at or below ${FREEZE_F}°F`,
		note: "Dates are read on a 365-day year, so in a leap year they can be a day off. ",
	},
];

const DIRECTION_ICON = {
	up: TrendingUpIcon,
	down: TrendingDownIcon,
	flat: MoveRightIcon,
} as const;

/** "in 1992", or "in 1992 and 2 other years" when several years share the value. */
function whichYears(points: readonly Point[], value: number): string {
	const years = points.filter((point) => point.value === value);
	const others = years.length - 1;
	if (others === 0) return `in ${years[0].year}`;
	return `in ${years[0].year} and ${others} other ${others === 1 ? "year" : "years"}`;
}

function TrendBox({
	trend,
	series,
}: {
	trend: TrendSummary | undefined;
	series: Series;
}) {
	if (!trend) {
		return (
			<p className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
				A trend test needs at least {MIN_TREND_POINTS} complete years, and this
				point has fewer.
			</p>
		);
	}
	const direction =
		trend.label === "none" ? "flat" : trendDirection(trend.perDecade);
	const Icon = DIRECTION_ICON[direction];
	return (
		<div className="rounded-md border bg-background px-3 py-2">
			<div className="flex items-center gap-2">
				<Icon
					aria-hidden="true"
					className="size-4 shrink-0 text-muted-foreground"
				/>
				<ToneBadge tone={series.tone[direction]}>
					{TREND_LABEL_TEXT[trend.label]}
				</ToneBadge>
			</div>
			<p className="mt-1.5 text-sm">{describeTrend(trend, series.words)}</p>
			<p className="mt-1 text-xs text-muted-foreground">
				Mann-Kendall trend test, {formatPValue(trend.pValue)}. The change per
				decade is Sen&apos;s slope.
			</p>
		</div>
	);
}

// One tooltip per series, made once, so the chart is not handed a new component on each draw.
const TOOLTIPS = Object.fromEntries(
	SERIES.map((series) => [
		series.id,
		function SeriesTooltip({ active, payload, label }: TooltipContentProps) {
			const value = payload?.[0]?.value;
			if (!active || typeof value !== "number") return null;
			return (
				<div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
					<p className="font-medium">{label}</p>
					<p className="text-muted-foreground">{series.value(value)}</p>
				</div>
			);
		},
	]),
);

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

function SeriesChart({
	series,
	years,
	trend,
}: {
	series: Series;
	years: readonly YearRow[];
	trend: TrendSummary | undefined;
}) {
	const headingId = useId();
	const firstYear = years[0].year;
	const lastYear = years[years.length - 1].year;
	const points: Point[] = years.map((row) => ({ year: row.year, value: row[series.id] }));
	const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
	const missing = points.length - values.length;
	const decadeTicks = points.map((point) => point.year).filter((year) => year % 10 === 0);

	if (values.length === 0) {
		return (
			<p className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
				No year on record here has a value for this chart.
			</p>
		);
	}

	const average = values.reduce((sum, value) => sum + value, 0) / values.length;
	const lowest = Math.min(...values);
	const highest = Math.max(...values);
	const commonAxis = (
		<>
			<CartesianGrid vertical={false} stroke="var(--border)" />
			<XAxis
				dataKey="year"
				ticks={decadeTicks}
				interval={0}
				tickLine={false}
				axisLine={{ stroke: "var(--border)" }}
				tick={AXIS_TICK}
			/>
			<Tooltip
				content={TOOLTIPS[series.id]}
				// A band behind the bar, or a hairline through the point, in the theme's own colours.
				cursor={
					series.kind === "bars"
						? { fill: "var(--muted)", fillOpacity: 0.6 }
						: { stroke: "var(--border)" }
				}
				isAnimationActive={false}
			/>
		</>
	);
	// The average line crosses dark marks. A wider line in the surface colour under it keeps
	// the dashes readable there.
	const averageLine = (
		<>
			<ReferenceLine y={average} stroke="var(--card)" strokeWidth={3} />
			<ReferenceLine
				y={average}
				stroke="var(--muted-foreground)"
				strokeDasharray="5 4"
			/>
		</>
	);
	const label = `${series.title}, ${firstYear} to ${lastYear}. Use the left and right arrow keys to read each year.`;
	const margin = { top: 10, right: 4, bottom: 0, left: 0 };

	return (
		<article aria-labelledby={headingId} className="space-y-3">
			<header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
				<div className="min-w-0">
					<h3 id={headingId} className="text-sm font-medium">
						{series.title}
					</h3>
					<p className="text-xs text-muted-foreground">
						{series.subtitle(firstYear, lastYear)}
					</p>
				</div>
				<SourceBadge source="NASA POWER" />
			</header>

			<TrendBox trend={trend} series={series} />

			<figure className="m-0">
				{/* The value axis title, set above the plot so it costs no width on a phone. */}
				<p className="mb-1 text-xs text-muted-foreground">{series.axisTitle}</p>
				{/* Recharts makes the plot a keyboard stop: the arrow keys step through the years.
				    It gets a name, and the same focus outline as the map. */}
				<div className="h-56 w-full [&_.recharts-surface]:focus-visible:outline-2 [&_.recharts-surface]:focus-visible:outline-offset-2 [&_.recharts-surface]:focus-visible:outline-ring">
					<ResponsiveContainer width="100%" height="100%">
						{series.kind === "bars" ? (
							<BarChart data={points} margin={margin} barCategoryGap={2} aria-label={label}>
								{commonAxis}
								<YAxis
									width={series.axisWidth}
									allowDecimals={false}
									tickLine={false}
									axisLine={false}
									tick={AXIS_TICK}
								/>
								<Bar
									dataKey="value"
									fill="var(--chart-2)"
									radius={[2, 2, 0, 0]}
									maxBarSize={24}
									isAnimationActive={false}
								/>
								{averageLine}
							</BarChart>
						) : (
							<LineChart data={points} margin={margin} aria-label={label}>
								{commonAxis}
								<YAxis
									width={series.axisWidth}
									// A date axis does not start at zero: it spans the dates on record.
									domain={[
										(dataMin: number) => Math.floor(dataMin / 10) * 10,
										(dataMax: number) => Math.ceil(dataMax / 10) * 10,
									]}
									allowDecimals={false}
									tickFormatter={series.tick}
									tickLine={false}
									axisLine={false}
									tick={AXIS_TICK}
								/>
								{averageLine}
								<Line
									dataKey="value"
									stroke="var(--chart-2)"
									// 45 points sit a few pixels apart on a phone: small dots and a thin line
									// keep each year readable.
									strokeWidth={1.5}
									dot={{ r: 2, fill: "var(--chart-2)", strokeWidth: 0 }}
									activeDot={{ r: 4 }}
									connectNulls={false}
									isAnimationActive={false}
								/>
							</LineChart>
						)}
					</ResponsiveContainer>
				</div>
				<figcaption className="mt-2 space-y-1 text-xs text-muted-foreground">
					<p className="flex items-center gap-2">
						<span
							aria-hidden="true"
							className="inline-block w-6 shrink-0 border-t border-dashed border-muted-foreground"
						/>
						Average, {firstYear} to {lastYear}: {series.average(average)}
					</p>
					<p>
						{series.low}: {series.value(lowest)} {whichYears(points, lowest)}.{" "}
						{series.high}: {series.value(highest)} {whichYears(points, highest)}.
						{missing > 0
							? ` ${missing} ${missing === 1 ? "year has" : "years have"} no value and ${missing === 1 ? "is" : "are"} left as a gap.`
							: ""}
					</p>
				</figcaption>
			</figure>

			<details className="text-xs">
				<summary className="w-fit min-h-6 cursor-pointer rounded-sm py-1 text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
					Show the numbers as a table
				</summary>
				<section
					aria-label={`${series.title}, as a table`}
					// A scrolling area has to take keyboard focus to be scrolled by keyboard.
					tabIndex={0}
					className="mt-2 max-h-56 overflow-y-auto rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<table className="w-full border-collapse text-left tabular-nums">
						{/* The header stays put while the rows scroll. Its rule sits on the cells,
						    because a collapsed row border does not travel with a sticky header. */}
						<thead className="sticky top-0 bg-card">
							<tr>
								<th scope="col" className="border-b px-3 py-1.5 font-medium">
									Year
								</th>
								<th scope="col" className="border-b px-3 py-1.5 font-medium">
									{series.tableHeader}
								</th>
							</tr>
						</thead>
						<tbody>
							{points.map((point) => (
								<tr key={point.year} className="border-b last:border-b-0">
									<td className="px-3 py-1">{point.year}</td>
									<td className="px-3 py-1">
										{point.value === null
											? "none"
											: series.kind === "dates"
												? series.value(point.value)
												: series.id === "seasonRainIn"
													? point.value.toFixed(1)
													: point.value}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			</details>

			{/* Grid size: the NASA POWER answer itself says "Average for 0.5 x 0.625 degree
			    lat/lon region", and SPEC.md, "Uncertainty on every number", gives it as "about
			    50 km grid", which is about 30 miles. */}
			<p className="text-xs text-muted-foreground">
				{series.note}NASA POWER describes the climate of a grid cell roughly 30
				miles across. It is the area&apos;s record, not a reading from this field.
			</p>
		</article>
	);
}

export function ConditionsCharts({ climate }: { climate: ClimateResponse }) {
	if (climate.years.length === 0) {
		return (
			<EmptyState
				headingLevel={3}
				title="No complete years for this point"
				description="NASA POWER returned no full calendar year of daily data here, so there is nothing to chart."
			/>
		);
	}
	return (
		<Tabs defaultValue={SERIES[0].id}>
			{/* Four tabs do not fit on one line on a phone, so the list may wrap. */}
			<TabsList aria-label="Climate charts" className="h-auto flex-wrap justify-start">
				{SERIES.map((series) => (
					<TabsTrigger key={series.id} value={series.id}>
						{series.tab}
					</TabsTrigger>
				))}
			</TabsList>
			{SERIES.map((series) => (
				<TabsContent key={series.id} value={series.id}>
					<SeriesChart
						series={series}
						years={climate.years}
						trend={climate.trends[series.id]}
					/>
				</TabsContent>
			))}
		</Tabs>
	);
}
