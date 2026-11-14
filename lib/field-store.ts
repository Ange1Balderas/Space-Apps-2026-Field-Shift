// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

import { create } from "zustand";
import {
	type ClimateOrigin,
	loadPointClimate,
	loadSampleClimate,
} from "@/lib/climate-client";
import { notify } from "@/lib/feedback";
import { isInKansasBounds } from "@/lib/kansas";
import { findSampleField } from "@/lib/samples";
import type { ClimateResponse } from "@/lib/types";

/** The place the panel is about: a clicked point or a sample field. */
export type FieldSelection = {
	lat: number;
	lon: number;
	/** Shown as the panel's subtitle, for example "Finney County sample". */
	name: string;
	/** Set when the selection is a sample field. */
	sampleId: string | null;
};

/** Everything the Field panel can show. Exactly one of these at a time. */
export type FieldPanelState =
	| { kind: "empty" }
	| { kind: "outside" }
	| { kind: "loading"; selection: FieldSelection }
	| {
			kind: "ready";
			selection: FieldSelection;
			climate: ClimateResponse;
			origin: ClimateOrigin;
	  }
	| { kind: "error"; selection: FieldSelection; message: string };

type FieldStore = {
	panel: FieldPanelState;
	/** A click on the map. Points outside Kansas get a message, not a request. */
	selectPoint: (lat: number, lon: number) => void;
	/** One of the sample fields in lib/samples.ts. */
	selectSample: (id: string) => void;
	/** Loads the current selection again after an error. */
	retry: () => void;
};

// Only the newest request may update the panel. An older one is cancelled, and its late
// answer is ignored, so a slow first click can never overwrite a faster second one.
let activeRequest: AbortController | null = null;

export const useFieldStore = create<FieldStore>()((set, get) => {
	async function load(selection: FieldSelection): Promise<void> {
		activeRequest?.abort();
		const request = new AbortController();
		activeRequest = request;
		set({ panel: { kind: "loading", selection } });

		const sample = selection.sampleId
			? findSampleField(selection.sampleId)
			: undefined;
		try {
			const loaded = sample
				? await loadSampleClimate(sample, request.signal)
				: await loadPointClimate(selection.lat, selection.lon, request.signal);
			if (request.signal.aborted) return;
			set({ panel: { kind: "ready", selection, ...loaded } });
			if (loaded.origin === "sample-fallback") {
				notify.info("Live data unavailable, showing cached data");
			}
		} catch (error) {
			if (request.signal.aborted) return;
			set({
				panel: {
					kind: "error",
					selection,
					message:
						error instanceof Error && error.message
							? error.message
							: "Something unexpected happened.",
				},
			});
		}
	}

	return {
		panel: { kind: "empty" },

		selectPoint(lat, lon) {
			if (!isInKansasBounds(lat, lon)) {
				activeRequest?.abort();
				set({ panel: { kind: "outside" } });
				return;
			}
			void load({ lat, lon, name: "Selected point", sampleId: null });
		},

		selectSample(id) {
			const sample = findSampleField(id);
			if (!sample) return;
			void load({
				lat: sample.lat,
				lon: sample.lon,
				name: `${sample.name} sample`,
				sampleId: sample.id,
			});
		},

		retry() {
			const { panel } = get();
			if (panel.kind === "error") void load(panel.selection);
		},
	};
});

/** The selected place, if the panel has one. */
export function selectionOf(panel: FieldPanelState): FieldSelection | null {
	return "selection" in panel ? panel.selection : null;
}
