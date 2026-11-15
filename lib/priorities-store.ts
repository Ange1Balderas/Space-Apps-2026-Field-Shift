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
} from "@/lib/scoring";
import type { Priority } from "@/lib/types";

type PrioritiesStore = {
	priorities: Priorities;
	/** Sets one slider. Values are kept between 0 and 100. */
	setPriority: (priority: Priority, value: number) => void;
	resetPriorities: () => void;
	/** Irrigation and equipment. The tool assumes no irrigation until told otherwise. */
	constraints: Constraints;
	setConstraint: (name: keyof Constraints, value: boolean) => void;
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
	resetPriorities: () => set({ priorities: DEFAULT_PRIORITIES }),
	constraints: DEFAULT_CONSTRAINTS,
	setConstraint: (name, value) =>
		set((state) => ({ constraints: { ...state.constraints, [name]: value } })),
}));
