// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The words on a rotation card (SPEC.md, "How each card's five fields are written"). Every
// sentence here is a fixed template filled with a computed number or a library entry, so
// each claim traces to a value. No language model writes any of it.

import type { Library } from "@/lib/library";
import { INDICATOR_IDS } from "@/lib/library";
import type { RotationScore } from "@/lib/scoring";
import type { ClimateResponse, CropId, IndicatorId } from "@/lib/types";

export const INDICATOR_LABELS: Record<IndicatorId, string> = {
	waterFit: "Water fit",
	heatExposure: "Heat and drought exposure",
	soilProtection: "Soil protection",
	soilBuilding: "Soil building",
	pestBreak: "Pest and disease break",
	marketFit: "Market fit",
	simplicity: "Simplicity",
};

/** SPEC.md: every risk ends with this. */
export const VERIFY_LOCALLY = "Check with your local K-State extension agent.";

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

const one = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

function cropName(library: Pick<Library, "crops">, id: CropId): string {
	return library.crops.find((crop) => crop.id === id)?.name ?? id;
}

/** Why suggested: the two indicators where this rotation beats the field's own by the most. */
export function whySuggested(
	candidate: RotationScore,
	existing: RotationScore | null,
): string {
	if (!existing) return "There is no current rotation to compare it with.";
	const gains = INDICATOR_IDS.flatMap((id) => {
		const mine = candidate.indicators[id].score;
		const theirs = existing.indicators[id].score;
		if (mine === null || theirs === null) return [];
		const gain = Math.round(mine) - Math.round(theirs);
		return gain > 0 ? [{ id, gain, mine: Math.round(mine), theirs: Math.round(theirs) }] : [];
	})
		.sort((a, b) => b.gain - a.gain || INDICATOR_IDS.indexOf(a.id) - INDICATOR_IDS.indexOf(b.id))
		.slice(0, 2);
	if (gains.length === 0) {
		return "It does not score higher than your current rotation on any indicator.";
	}
	const parts = gains.map(
		(item) =>
			`${INDICATOR_LABELS[item.id].toLowerCase()} (${item.mine} against ${item.theirs})`,
	);
	return `Scores higher than your current rotation on ${parts.join(" and on ")}.`;
}

export type CardLine = { text: string; source: string | null };

/** Evidence: the values behind the scores, each with where it comes from. */
export function evidenceLines(
	score: RotationScore,
	library: Pick<Library, "crops" | "scoring">,
): CardLine[] {
	const lines: CardLine[] = [];
	const seen = new Set<CropId>();
	for (const season of score.water?.seasons ?? []) {
		if (seen.has(season.crop)) continue;
		seen.add(season.crop);
		lines.push({
			text:
				`${cropName(library, season.crop)}: potential water demand ${one(season.demandIn)} in. ` +
				`Rain in its season ${one(season.seasonRainIn)} in, of which ${one(season.effectiveRainIn)} in is counted as usable; ` +
				`${one(season.storedIn)} in stored from ${one(season.bareRainIn)} in of rain on the bare field before planting` +
				`${season.storedCapped ? " (limited by what this soil can hold)" : ""}.`,
			source: "NASA POWER rain and weather, FAO-56 method and crop coefficients",
		});
	}
	if (score.water?.irrigationNeedIn != null) {
		lines.push({
			text: `Irrigation needed to close the gap: about ${one(score.water.irrigationNeedIn)} in a year, averaged over the cycle.`,
			source: "NASA POWER rain and weather, FAO-56 method and crop coefficients",
		});
	}
	const heatSeen = new Set<CropId>();
	for (const item of score.heat) {
		if (heatSeen.has(item.crop)) continue;
		heatSeen.add(item.crop);
		lines.push({
			text: `${cropName(library, item.crop)}: ${one(item.hotDaysPerMonth)} days a year at or above ${library.scoring.hotDayF}°F in ${item.months.map((month) => MONTH_NAMES[month - 1]).join(" and ")}, its heat-sensitive time.`,
			source: "NASA POWER",
		});
	}
	if (score.calendar.bareShare !== null) {
		lines.push({
			text: `The field is bare in ${score.calendar.bareMonths} of the cycle's ${score.calendar.knownMonths} months.`,
			source: "USDA NASS usual planting and harvesting dates",
		});
	}
	return lines;
}

/** Benefits: what the library says, with its source. */
export function benefitLines(score: RotationScore): CardLine[] {
	return score.rotation.benefits.map((item) => ({ text: item.text, source: item.source }));
}

/** Information gaps: what the tool cannot see, and what it could not work out here. */
export function informationGaps(score: RotationScore): string[] {
	const gaps = [
		"The tool cannot see local prices, this field's history beyond the crop map, irrigation rights, crop insurance rules or local disease pressure.",
		"Crop water demand is potential demand: what a well-watered crop would use. A dryland crop uses less and yields less.",
		"NASA POWER describes an area roughly 30 miles across, not this field.",
	];
	for (const id of INDICATOR_IDS) {
		const indicator = score.indicators[id];
		if (indicator.score === null) {
			gaps.push(`${INDICATOR_LABELS[id]} has no score: ${indicator.why}`);
		}
	}
	if (score.calendar.unplaced.length > 0) {
		gaps.push("Usual planting and harvest dates are not sourced yet for every crop in this rotation.");
	}
	return gaps;
}

/** Risks to verify locally: the library's, plus what the numbers show. Each ends the same way. */
export function riskLines(
	score: RotationScore,
	climate: Pick<ClimateResponse, "trends">,
	regionName: string | null,
): CardLine[] {
	const lines: CardLine[] = score.rotation.risks.map((item) => ({
		text: item.text,
		source: item.source,
	}));
	const trend = climate.trends.hotDays;
	if (trend && trend.label === "likely" && trend.perDecade > 0 && score.heat.length > 0) {
		lines.push({
			text: `Hot days are likely increasing here, by about ${one(trend.perDecade)} a decade since 1981.`,
			source: "NASA POWER",
		});
	}
	if (score.typicalHere === false && regionName) {
		lines.push({
			text: `The library lists this rotation for ${score.rotation.regions.join(" and ")} Kansas; this field's rainfall puts it in the ${regionName}.`,
			source: null,
		});
	}
	return lines.map((line) => ({ ...line, text: `${line.text} ${VERIFY_LOCALLY}` }));
}
