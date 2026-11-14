"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Climate charts for the selected field (SPEC.md, feature 2 and feature 3). Phase 1 has one:
// hot days per year. Growing-season rain and freeze dates join it in Phase 4.

import { MoveRightIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useId } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
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
import { HOT_DAY_F } from "@/lib/indicators";
import {
	describeTrend,
	formatPValue,
	HOT_DAY_WORDS,
	TREND_LABEL_TEXT,
	type TrendDirection,
	trendDirection,
} from "@/lib/trend-text";
import { MIN_TREND_POINTS, type TrendSummary } from "@/lib/trends";
import type { ClimateResponse } from "@/lib/types";

type YearRow = ClimateResponse["years"][number];

export function ConditionsCharts({ climate }: { climate: ClimateResponse }) {
	if (climate.years.length === 0) {
		return (
			<EmptyState
				title="No complete years for this point"
				description="NASA POWER returned no full calendar year of daily data here, so there is nothing to chart."
			/>
		);
	}
	return <HotDaysChart years={climate.years} trend={climate.trends.hotDays} />;
}

/** "in 1992", or "in 1992 and 2 other years" when several years share the value. */
function whichYears(rows: readonly YearRow[], hotDays: number): string {
	const years = rows.filter((row) => row.hotDays === hotDays);
	const others = years.length - 1;
	if (others === 0) return `in ${years[0].year}`;
	return `in ${years[0].year} and ${others} other ${others === 1 ? "year" : "years"}`;
}

const DIRECTION_ICON = {
	up: TrendingUpIcon,
	down: TrendingDownIcon,
	flat: MoveRightIcon,
} as const;

// Status colour marks the direction of a trend, and only once the test finds one
// (SPEC.md, "UI rules": status colours only for wetter or drier and for trend direction).
// More hot days is the direction a crop is exposed to, so it takes the warning tone.
const DIRECTION_TONE: Record<TrendDirection, Tone> = {
	up: "warning",
	down: "info",
	flat: "neutral",
};

function HotDaysTrend({ trend }: { trend: TrendSummary | undefined }) {
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
				<ToneBadge tone={DIRECTION_TONE[direction]}>
					{TREND_LABEL_TEXT[trend.label]}
				</ToneBadge>
			</div>
			<p className="mt-1.5 text-sm">{describeTrend(trend, HOT_DAY_WORDS)}</p>
			<p className="mt-1 text-xs text-muted-foreground">
				Mann-Kendall trend test, {formatPValue(trend.pValue)}. The change per
				decade is Sen&apos;s slope.
			</p>
		</div>
	);
}

function HotDaysTooltip({
	active,
	payload,
	label,
}: TooltipContentProps) {
	const value = payload?.[0]?.value;
	if (!active || typeof value !== "number") return null;
	return (
		<div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
			<p className="font-medium">{label}</p>
			<p className="text-muted-foreground">
				{value} {value === 1 ? "hot day" : "hot days"}
			</p>
		</div>
	);
}

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

function HotDaysChart({
	years,
	trend,
}: {
	years: readonly YearRow[];
	trend: TrendSummary | undefined;
}) {
	const headingId = useId();
	const firstYear = years[0].year;
	const lastYear = years[years.length - 1].year;
	const counts = years.map((row) => row.hotDays);
	const average = counts.reduce((sum, days) => sum + days, 0) / counts.length;
	const fewest = Math.min(...counts);
	const most = Math.max(...counts);
	const decadeTicks = years
		.map((row) => row.year)
		.filter((year) => year % 10 === 0);

	return (
		<article aria-labelledby={headingId} className="space-y-3">
			<header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
				<div className="min-w-0">
					<h3 id={headingId} className="text-sm font-medium">
						Hot days each year
					</h3>
					<p className="text-xs text-muted-foreground">
						Days with a high of {HOT_DAY_F}°F or above, {firstYear} to{" "}
						{lastYear}
					</p>
				</div>
				<SourceBadge source="NASA POWER" />
			</header>

			<HotDaysTrend trend={trend} />

			<figure className="m-0">
				{/* The value axis title, set above the plot so it costs no width on a phone. */}
				<p className="mb-1 text-xs text-muted-foreground">Days per year</p>
				<div className="h-56 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={[...years]}
							margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
							barCategoryGap={2}
						>
							<CartesianGrid vertical={false} stroke="var(--border)" />
							<XAxis
								dataKey="year"
								ticks={decadeTicks}
								interval={0}
								tickLine={false}
								axisLine={{ stroke: "var(--border)" }}
								tick={AXIS_TICK}
							/>
							<YAxis
								width={32}
								allowDecimals={false}
								tickLine={false}
								axisLine={false}
								tick={AXIS_TICK}
							/>
							<Tooltip
								content={HotDaysTooltip}
								cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }}
								isAnimationActive={false}
							/>
							<Bar
								dataKey="hotDays"
								fill="var(--chart-2)"
								radius={[2, 2, 0, 0]}
								maxBarSize={24}
								isAnimationActive={false}
							/>
							<ReferenceLine
								y={average}
								stroke="var(--muted-foreground)"
								strokeDasharray="5 4"
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
				<figcaption className="mt-2 space-y-1 text-xs text-muted-foreground">
					<p className="flex items-center gap-2">
						<span
							aria-hidden="true"
							className="inline-block w-6 shrink-0 border-t border-dashed border-muted-foreground"
						/>
						Average, {firstYear} to {lastYear}: {Math.round(average)} days a
						year
					</p>
					<p>
						Fewest: {fewest} {whichYears(years, fewest)}. Most: {most}{" "}
						{whichYears(years, most)}.
					</p>
				</figcaption>
			</figure>

			<details className="text-xs">
				<summary className="w-fit cursor-pointer rounded-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
					Show the numbers as a table
				</summary>
				<section
					aria-label="Hot days each year, as a table"
					// A scrolling area has to take keyboard focus to be scrolled by keyboard.
					tabIndex={0}
					className="mt-2 max-h-56 overflow-y-auto rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<table className="w-full border-collapse text-left tabular-nums">
						<thead className="sticky top-0 bg-card">
							<tr className="border-b">
								<th scope="col" className="px-3 py-1.5 font-medium">
									Year
								</th>
								<th scope="col" className="px-3 py-1.5 font-medium">
									Days at or above {HOT_DAY_F}°F
								</th>
							</tr>
						</thead>
						<tbody>
							{years.map((row) => (
								<tr key={row.year} className="border-b last:border-b-0">
									<td className="px-3 py-1">{row.year}</td>
									<td className="px-3 py-1">{row.hotDays}</td>
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
				NASA POWER describes the climate of a grid cell roughly 30 miles across.
				It is the area&apos;s record, not a reading from this field.
			</p>
		</article>
	);
}
