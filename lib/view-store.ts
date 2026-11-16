// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

// Which of the panel's tabs is open, and where on the About tab the reader was sent.
// The field's facts are split over three tabs (Field, Rotations, Conditions; Angel's
// request of 2026-11-15 after seeing the one long page), and the fourth is About the data.
// A source badge opens its entry on the About tab (SPEC.md, "UI rules": "opens its About
// the Data entry") and remembers what was pressed and which tab it was on, so the reader
// can be taken back to it.

import { create } from "zustand";

export type PanelView = "field" | "rotations" | "conditions" | "about";

/** The three tabs that show the chosen field. */
export const FIELD_VIEWS = ["field", "rotations", "conditions"] as const;
export type FieldView = (typeof FIELD_VIEWS)[number];

type ViewStore = {
	view: PanelView;
	/** The tab About was opened from, to return to. */
	from: FieldView;
	/** The id of the About entry to bring into view, or null when the tab was opened by hand. */
	target: string | null;
	/** Counts the requests, so asking for the same entry twice brings it into view twice. */
	request: number;
	/** What was pressed to get to About, to return to. */
	origin: HTMLElement | null;
	/** True from the press of "Back" until the reader has been taken back. */
	returning: boolean;
	/** A tab was chosen by hand: nothing to bring into view, nothing to return to. */
	showView: (view: PanelView) => void;
	/** Opens the About tab at an entry. `origin` is the control that asked. */
	openAbout: (target: string, origin?: HTMLElement | null) => void;
	/** Goes back to the tab that opened About, to whatever opened it. */
	backToField: () => void;
	/** The reader has been taken back. */
	settle: () => void;
};

const isFieldView = (view: PanelView): view is FieldView =>
	(FIELD_VIEWS as readonly string[]).includes(view);

export const useViewStore = create<ViewStore>()((set) => ({
	view: "field",
	from: "field",
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
			origin: isFieldView(state.view) ? origin : state.origin,
			from: isFieldView(state.view) ? state.view : state.from,
			returning: false,
		})),
	backToField: () => set((state) => ({ view: state.from, target: null, returning: true })),
	settle: () => set({ origin: null, returning: false }),
}));
