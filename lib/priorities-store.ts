// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

// The farmer's four priorities and what they have told the tool about the farm. Both belong
// to the farmer, not to one field, so they stay as they are when another field is picked.

import { create } from "zustand";
import {
	type Constraints,
	DEFAULT_CONSTRAINTS,
	DEFAULT_PRIORITIES,
	type Priorities,
	RAIN_CHANGE_RANGE,
} from "@/lib/scoring";
import type { Priority } from "@/lib/types";

type PrioritiesStore = {
	priorities: Priorities;
	/** Sets one slider. Values are kept between 0 and 100. */
	setPriority: (priority: Priority, value: number) => void;
	resetPriorities: () => void;
	/** Irrigation and equipment. The tool assumes no irrigation until told otherwise. */
	constraints: Constraints;
	setConstraint: (name: "irrigationAvailable" | "hasNoTillEquipment", value: boolean) => void;
	/** The rain scenario, in percent; 0 is the record as it is (lib/scoring.ts, rainFactor). */
	setRainChange: (pct: number) => void;
};

export const usePrioritiesStore = create<PrioritiesStore>()((set) => ({
	priorities: DEFAULT_PRIORITIES,
	setPriority: (priority, value) =>
		set((state) => ({
			priorities: {
				...state.priorities,
				[priority]: Math.min(100, Math.max(0, value)),
			},
		})),
	// Reset puts the sliders back, and the rain back to the record; the farm switches stay.
	resetPriorities: () =>
		set((state) => ({
			priorities: DEFAULT_PRIORITIES,
			constraints: { ...state.constraints, rainChangePct: 0 },
		})),
	constraints: DEFAULT_CONSTRAINTS,
	setConstraint: (name, value) =>
		set((state) => ({ constraints: { ...state.constraints, [name]: value } })),
	setRainChange: (pct) =>
		set((state) => ({
			constraints: {
				...state.constraints,
				rainChangePct: Math.min(RAIN_CHANGE_RANGE.max, Math.max(RAIN_CHANGE_RANGE.min, pct)),
			},
		})),
}));
