// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

// Which of the panel's two tabs is open, and where on the About tab the reader was sent.
// A source badge opens its entry on the About tab (SPEC.md, "UI rules": "opens its About the
// Data entry") and remembers what was pressed, so the reader can be taken back to it.

import { create } from "zustand";

export type PanelView = "field" | "about";

type ViewStore = {
	view: PanelView;
	/** The id of the About entry to bring into view, or null when the tab was opened by hand. */
	target: string | null;
	/** Counts the requests, so asking for the same entry twice brings it into view twice. */
	request: number;
	/** What was pressed on the Field tab to get to About, to return to. */
	origin: HTMLElement | null;
	/** True from the press of "Back" until the reader has been taken back. */
	returning: boolean;
	/** A tab was chosen by hand: nothing to bring into view, nothing to return to. */
	showView: (view: PanelView) => void;
	/** Opens the About tab at an entry. `origin` is the control that asked. */
	openAbout: (target: string, origin?: HTMLElement | null) => void;
	/** Goes back to the Field tab, to whatever opened About. */
	backToField: () => void;
	/** The reader has been taken back. */
	settle: () => void;
};

export const useViewStore = create<ViewStore>()((set) => ({
	view: "field",
	target: null,
	request: 0,
	origin: null,
	returning: false,
	showView: (view) => set({ view, target: null, origin: null, returning: false }),
	openAbout: (target, origin = null) =>
		set((state) => ({
			view: "about",
			target,
			request: state.request + 1,
			// A link inside the About tab keeps the way back that is already there.
			origin: state.view === "field" ? origin : state.origin,
			returning: false,
		})),
	backToField: () => set({ view: "field", target: null, returning: true }),
	settle: () => set({ origin: null, returning: false }),
}));
