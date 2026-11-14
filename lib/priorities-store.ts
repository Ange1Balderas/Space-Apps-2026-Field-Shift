// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

// The farmer's four priorities. They belong to the farmer, not to a field, so they stay as
// they are when another field is picked.

import { create } from "zustand";
import { DEFAULT_PRIORITIES, type Priorities } from "@/lib/scoring";
import type { Priority } from "@/lib/types";

type PrioritiesStore = {
	priorities: Priorities;
	/** Sets one slider. Values are kept between 0 and 100. */
	setPriority: (priority: Priority, value: number) => void;
	resetPriorities: () => void;
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
}));
