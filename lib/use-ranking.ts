// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

// The field's scored and ranked rotations, worked out once per field and re-weighed on every
// slider move. Shared by the rotation cards (components/RotationRanking.tsx) and the
// printable summary (components/PrintSummary.tsx), so both show the same ranking.

import { useMemo } from "react";
import { type ClimateWindows, climateWindows } from "@/lib/climate-windows";
import { type ExistingRotation, existingRotation } from "@/lib/existing-rotation";
import type { Loadable } from "@/lib/field-store";
import { LIBRARY } from "@/lib/library";
import { usePrioritiesStore } from "@/lib/priorities-store";
import { rotationYears } from "@/lib/rotation-edit";
import {
	type Constraints,
	type FieldScores,
	type Priorities,
	type Ranking,
	rank,
	scoreField,
} from "@/lib/scoring";
import type { ClimateResponse, HistoryResponse, SoilResponse } from "@/lib/types";

export type FieldRanking = {
	priorities: Priorities;
	constraints: Constraints;
	climateData: ClimateResponse | null;
	soilData: SoilResponse | null;
	historyData: HistoryResponse | null;
	/** The field's own rotation, from the detected years and the farmer's corrections. */
	own: ExistingRotation | null;
	/** Every score, once per field and per switch. Null until the climate has loaded. */
	scores: FieldScores | null;
	/** The scores weighed by the sliders and ordered. Null until the climate has loaded. */
	ranking: Ranking | null;
	windows: ClimateWindows | null;
};

export function useFieldRanking(
	climate: Loadable<ClimateResponse>,
	history: Loadable<HistoryResponse>,
	soil: Loadable<SoilResponse>,
	cropEdits: Readonly<Record<number, number>>,
): FieldRanking {
	const priorities = usePrioritiesStore((state) => state.priorities);
	const constraints = usePrioritiesStore((state) => state.constraints);

	const climateData = climate.status === "ready" ? climate.data : null;
	const soilData = soil.status === "ready" ? soil.data : null;
	const historyData = history.status === "ready" ? history.data : null;

	// Nothing is worked out while the crop history is still loading: the cards show a skeleton
	// then, and the printable summary is prerendered on the server with nothing selected,
	// where Next.js refuses a `new Date()` in a client component.
	const historyLoading = history.status === "loading";
	const own = useMemo(
		() =>
			historyLoading
				? null
				: existingRotation(
						rotationYears(historyData, cropEdits, new Date().getFullYear()),
					),
		[historyLoading, historyData, cropEdits],
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

	return { priorities, constraints, climateData, soilData, historyData, own, scores, ranking, windows };
}
