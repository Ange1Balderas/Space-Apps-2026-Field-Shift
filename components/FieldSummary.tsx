"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The field itself (SPEC.md, user flow step 3): the crops it grew in the last 8 years, which
// the farmer can correct, and its soil. The two halves load and fail on their own.

import { ChevronDownIcon } from "lucide-react";
import { useId } from "react";
import { Term } from "@/components/Glossary";
import { SourceBadge } from "@/components/SourceBadge";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Loadable } from "@/lib/field-store";
import type { TermId } from "@/lib/glossary";
import {
	cropChoices,
	cropLabel,
	type RotationYear,
	rotationYears,
} from "@/lib/rotation-edit";
import type { HistoryResponse, SoilResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function CropChip({
	row,
	onEdit,
}: {
	row: RotationYear;
	onEdit: (year: number, cdlCode: number) => void;
}) {
	return (
		<div
			className={cn(
				"relative min-h-[3.25rem] rounded-md border bg-background px-2 py-1.5 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-1 has-[select:focus-visible]:outline-ring",
				// A corrected year looks different, so it is never mistaken for a detected one.
				row.edited && "border-dashed border-foreground/50",
			)}
		>
			<div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
				<span>{row.year}</span>
				<span className="flex items-center gap-1">
					{row.edited ? (
						<span className="font-medium text-foreground">Yours</span>
					) : null}
					<ChevronDownIcon aria-hidden="true" className="size-3" />
				</span>
			</div>
			{/* The name is plain text so a long one wraps instead of being cut off. The real
			    control is the select laid over the whole chip: a click or tap anywhere on the
			    chip opens it, and the keyboard reaches it like any other select. */}
			<p aria-hidden="true" className="mt-0.5 text-sm leading-snug font-medium">
				{row.cdlCode === null ? "Choose a crop" : cropLabel(row.cdlCode)}
			</p>
			<select
				aria-label={`Crop in ${row.year}${row.edited ? ", changed by you" : ""}`}
				className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
				value={row.cdlCode ?? ""}
				onChange={(event) => onEdit(row.year, Number(event.target.value))}
			>
				{row.cdlCode === null ? <option value="">Choose a crop</option> : null}
				{cropChoices(row.detectedCode).map((code) => (
					<option key={code} value={code}>
						{cropLabel(code)}
					</option>
				))}
			</select>
		</div>
	);
}

function Rotation({
	history,
	cropEdits,
	onEditCrop,
	onResetCrops,
	onRetry,
}: {
	history: Loadable<HistoryResponse>;
	cropEdits: Readonly<Record<number, number>>;
	onEditCrop: (year: number, cdlCode: number) => void;
	onResetCrops: () => void;
	onRetry: () => void;
}) {
	const headingId = useId();
	const detected = history.status === "ready" ? history.data : null;
	const rows = rotationYears(detected, cropEdits, new Date().getFullYear());
	const edited = rows.filter((row) => row.edited).length;

	return (
		<div role="group" aria-labelledby={headingId} className="space-y-2">
			<header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
				<h3 id={headingId} className="text-sm font-medium">
					Crops grown here
				</h3>
				<SourceBadge source="USDA NASS CDL" />
			</header>

			{history.status === "loading" ? (
				<div aria-hidden="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{Array.from({ length: 8 }, (_, index) => (
						<Skeleton key={index} className="h-[3.25rem]" />
					))}
				</div>
			) : (
				<>
					{history.status === "error" ? (
						<ErrorState
							title="The crop history could not be loaded"
							error={
								new Error(
									`${history.message} You can still enter the crops yourself below.`,
								)
							}
							onRetry={onRetry}
						/>
					) : null}

					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{rows.map((row) => (
							<CropChip key={row.year} row={row} onEdit={onEditCrop} />
						))}
					</div>

					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{detected ? (
							<p>
								{edited === 0
									? "Read from one pixel of the Cropland Data Layer, which can be wrong for a year. Change any year that is."
									: `${edited} of ${rows.length} years changed by you. The rest are from the Cropland Data Layer.`}
							</p>
						) : (
							<p>Not from the Cropland Data Layer: these years are yours to fill in.</p>
						)}
						{edited > 0 ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={onResetCrops}
							>
								{detected ? "Back to detected crops" : "Clear my entries"}
							</Button>
						) : null}
					</div>
				</>
			)}
		</div>
	);
}

const NOT_AVAILABLE = "Not available";

function withUnit(value: number | null, unit: string): string {
	return value === null ? NOT_AVAILABLE : `${value}${unit}`;
}

function Soil({
	soil,
	onRetry,
}: {
	soil: Loadable<SoilResponse>;
	onRetry: () => void;
}) {
	const headingId = useId();
	return (
		<div role="group" aria-labelledby={headingId} className="space-y-2">
			<header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
				<h3 id={headingId} className="text-sm font-medium">
					Soil
				</h3>
				<SourceBadge source="USDA NRCS SSURGO" />
			</header>

			{soil.status === "loading" ? (
				<div aria-hidden="true" className="space-y-2">
					<Skeleton className="h-4 w-3/4" />
					<div className="grid grid-cols-2 gap-x-4 gap-y-2">
						{Array.from({ length: 7 }, (_, index) => (
							<Skeleton key={index} className="h-9" />
						))}
					</div>
				</div>
			) : null}

			{soil.status === "error" ? (
				<ErrorState
					title="Soil data unavailable"
					error={new Error(soil.message)}
					onRetry={onRetry}
				/>
			) : null}

			{soil.status === "ready" ? (
				<>
					<p className="text-sm break-words">{soil.data.mapUnitName}</p>
					<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
						{(
							[
								["soil-texture", "Texture", soil.data.texture ?? NOT_AVAILABLE],
								[
									"available-water",
									"Available water, top 39 in",
									withUnit(soil.data.availableWaterIn, " in"),
								],
								[
									"organic-matter",
									"Organic matter",
									withUnit(soil.data.organicMatterPct, "%"),
								],
								["slope", "Slope", withUnit(soil.data.slopePct, "%")],
								[
									"k-factor",
									"Erodibility by water (K factor)",
									withUnit(soil.data.kFactor, ""),
								],
								[
									"wind-erodibility",
									"Wind erodibility index",
									withUnit(soil.data.windErodibilityIndex, " tons/acre/yr"),
								],
								[
									"hydrologic-group",
									"Hydrologic group",
									soil.data.hydrologicGroup ?? NOT_AVAILABLE,
								],
							] satisfies [TermId, string, string][]
						).map(([term, label, value]) => (
							<div key={term} className="min-w-0">
								<dt className="text-xs text-muted-foreground">
									{/* Each soil fact is a glossary term: the label is its tooltip. */}
									<Term id={term} className="min-h-6">
										{label}
									</Term>
								</dt>
								<dd className="font-medium">{value}</dd>
							</div>
						))}
					</dl>
					<p className="text-xs text-muted-foreground">
						The soil map unit under this point, described by its main soil. A map
						unit can include other soils.
					</p>
				</>
			) : null}
		</div>
	);
}

export function FieldSummary({
	history,
	soil,
	cropEdits,
	onEditCrop,
	onResetCrops,
	onRetryHistory,
	onRetrySoil,
}: {
	history: Loadable<HistoryResponse>;
	soil: Loadable<SoilResponse>;
	cropEdits: Readonly<Record<number, number>>;
	onEditCrop: (year: number, cdlCode: number) => void;
	onResetCrops: () => void;
	onRetryHistory: () => void;
	onRetrySoil: () => void;
}) {
	return (
		<div className="space-y-5">
			<Rotation
				history={history}
				cropEdits={cropEdits}
				onEditCrop={onEditCrop}
				onResetCrops={onResetCrops}
				onRetry={onRetryHistory}
			/>
			<Soil soil={soil} onRetry={onRetrySoil} />
		</div>
	);
}
