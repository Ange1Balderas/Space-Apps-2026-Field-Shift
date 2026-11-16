// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

import { create } from "zustand";
import { notify } from "@/lib/feedback";
import {
	type DataOrigin,
	type Loaded,
	loadClimate,
	loadHistory,
	loadMoisture,
	loadSampleField,
	loadSoil,
	type MoistureResult,
} from "@/lib/field-client";
import { isInKansasBounds } from "@/lib/kansas";
import { findSampleField } from "@/lib/samples";
import type {
	ClimateResponse,
	HistoryResponse,
	SoilResponse,
} from "@/lib/types";

/** The place the panel is about: a clicked point or a sample field. */
export type FieldSelection = {
	lat: number;
	lon: number;
	/** Shown as the panel's subtitle, for example "Finney County sample". */
	name: string;
	/** Set when the selection is a sample field. */
	sampleId: string | null;
};

/** One fact about the field. Each loads, fails and retries on its own. */
export type Loadable<T> =
	| { status: "loading" }
	| { status: "ready"; data: T; origin: DataOrigin }
	| { status: "error"; message: string };

export type FieldPart = "climate" | "history" | "soil" | "moisture";

/** Everything the panel can show. Exactly one of these at a time. */
export type FieldPanelState =
	| { kind: "empty" }
	| { kind: "outside" }
	| {
			kind: "field";
			selection: FieldSelection;
			climate: Loadable<ClimateResponse>;
			history: Loadable<HistoryResponse>;
			soil: Loadable<SoilResponse>;
			/** The county's soil moisture (Phase 6). From files built in advance, for samples too. */
			moisture: Loadable<MoistureResult>;
			/**
			 * The farmer's own corrections to the detected crops: year to CDL class code.
			 * A year that is not here shows what the Cropland Data Layer says.
			 */
			cropEdits: Readonly<Record<number, number>>;
	  };

type FieldStore = {
	panel: FieldPanelState;
	/** A click on the map. Points outside Kansas get a message, not a request. */
	selectPoint: (lat: number, lon: number) => void;
	/** One of the sample fields in lib/samples.ts. */
	selectSample: (id: string) => void;
	/** Loads one fact of the current field again after an error. */
	retry: (part: FieldPart) => void;
	/** Replaces the crop shown for one year with the farmer's own choice. */
	editCrop: (year: number, cdlCode: number) => void;
	/** Drops every correction and shows the detected crops again. */
	resetCrops: () => void;
};

// Only the newest selection may update the panel. An older one is cancelled, and a late
// answer from it is ignored, so a slow first click can never overwrite a faster second one.
let activeRequest: AbortController | null = null;

const LOADING = { status: "loading" } as const;
/** The three facts a sample field's file holds. Soil moisture is loaded on its own. */
const FIELD_PARTS = ["climate", "history", "soil"] as const;

function failed(error: unknown): Loadable<never> {
	return {
		status: "error",
		message:
			error instanceof Error && error.message
				? error.message
				: "Something unexpected happened.",
	};
}

export const useFieldStore = create<FieldStore>()((set, get) => {
	/** Sets one fact, unless the panel has moved on to another selection. */
	function setPart<T>(
		request: AbortController,
		part: FieldPart,
		value: Loadable<T>,
	): void {
		if (request.signal.aborted || request !== activeRequest) return;
		set((state) =>
			state.panel.kind === "field"
				? { panel: { ...state.panel, [part]: value } }
				: state,
		);
	}

	/** Loads one fact through its route. Tells the farmer once if the copy is a cached one. */
	function loadPart<T>(
		request: AbortController,
		part: FieldPart,
		load: () => Promise<Loaded<T>>,
	): void {
		setPart(request, part, LOADING);
		load().then(
			(loaded) => {
				setPart(request, part, { status: "ready", ...loaded });
				if (loaded.origin === "sample-fallback" && !request.signal.aborted) {
					notify.info("Live data unavailable, showing cached data", {
						id: "cached-data",
					});
				}
			},
			(error) => setPart(request, part, failed(error)),
		);
	}

	/** Starts the request for one fact of a clicked point. */
	function loadOne(
		request: AbortController,
		selection: FieldSelection,
		part: FieldPart,
	): void {
		const { lat, lon } = selection;
		const { signal } = request;
		if (part === "climate") {
			loadPart(request, part, () => loadClimate(lat, lon, signal));
		} else if (part === "history") {
			loadPart(request, part, () => loadHistory(lat, lon, signal));
		} else if (part === "soil") {
			loadPart(request, part, () => loadSoil(lat, lon, signal));
		} else {
			loadPart(request, part, () => loadMoisture(lat, lon, signal));
		}
	}

	function loadAll(selection: FieldSelection): void {
		activeRequest?.abort();
		const request = new AbortController();
		activeRequest = request;
		set({
			panel: {
				kind: "field",
				selection,
				climate: LOADING,
				history: LOADING,
				soil: LOADING,
				moisture: LOADING,
				cropEdits: {},
			},
		});

		// The county's soil moisture comes from files built in advance, for a sample too.
		loadOne(request, selection, "moisture");

		const sample = selection.sampleId
			? findSampleField(selection.sampleId)
			: undefined;
		if (sample) {
			// One cached file holds all three facts, so they arrive, or fail, together.
			loadSampleField(sample, request.signal).then(
				(data) => {
					for (const part of FIELD_PARTS) {
						setPart(request, part, {
							status: "ready",
							data: data[part],
							origin: "sample",
						});
					}
				},
				(error) => {
					for (const part of FIELD_PARTS) {
						setPart(request, part, failed(error));
					}
				},
			);
			return;
		}

		for (const part of FIELD_PARTS) loadOne(request, selection, part);
	}

	return {
		panel: { kind: "empty" },

		selectPoint(lat, lon) {
			if (!isInKansasBounds(lat, lon)) {
				activeRequest?.abort();
				activeRequest = null;
				set({ panel: { kind: "outside" } });
				return;
			}
			loadAll({ lat, lon, name: "Selected point", sampleId: null });
		},

		selectSample(id) {
			const sample = findSampleField(id);
			if (!sample) return;
			loadAll({
				lat: sample.lat,
				lon: sample.lon,
				name: `${sample.name} sample`,
				sampleId: sample.id,
			});
		},

		retry(part) {
			const { panel } = get();
			if (panel.kind !== "field" || !activeRequest) return;
			if (panel.selection.sampleId && part !== "moisture") {
				// A sample's three facts come from one file, so one retry reloads all of them.
				loadAll(panel.selection);
				return;
			}
			loadOne(activeRequest, panel.selection, part);
		},

		editCrop(year, cdlCode) {
			set((state) => {
				if (state.panel.kind !== "field") return state;
				const { history, cropEdits } = state.panel;
				const detected =
					history.status === "ready"
						? history.data.years.find((row) => row.year === year)?.cdlCode
						: undefined;
				const next = { ...cropEdits };
				// Choosing the detected crop again is not a correction.
				if (detected === cdlCode) delete next[year];
				else next[year] = cdlCode;
				return { panel: { ...state.panel, cropEdits: next } };
			});
		},

		resetCrops() {
			set((state) =>
				state.panel.kind === "field"
					? { panel: { ...state.panel, cropEdits: {} } }
					: state,
			);
		},
	};
});

/** The selected place, if the panel has one. */
export function selectionOf(panel: FieldPanelState): FieldSelection | null {
	return panel.kind === "field" ? panel.selection : null;
}
