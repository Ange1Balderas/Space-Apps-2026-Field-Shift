"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The panel beside the map, with its four tabs: Field, Rotations and Conditions for the
// chosen place (split from one long page at Angel's request on 2026-11-15), and About the
// data (SPEC.md, user flow step 8). Every tab stays in the page while another is open, so
// the cards the reader opened, the chart they chose and their place in the list are all
// still there on return.

import { useEffect, useRef } from "react";
import { AboutData } from "@/components/AboutData";
import { FieldPanel } from "@/components/FieldPanel";
import { GlossaryDescriptions } from "@/components/Glossary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIELD_VIEWS, type PanelView, useViewStore } from "@/lib/view-store";

const FIELD_TAB_LABELS = {
	field: "Field",
	rotations: "Rotations",
	conditions: "Conditions",
} as const;

export function SidePanel() {
	const view = useViewStore((state) => state.view);
	const target = useViewStore((state) => state.target);
	const request = useViewStore((state) => state.request);
	const origin = useViewStore((state) => state.origin);
	const returning = useViewStore((state) => state.returning);
	const showView = useViewStore((state) => state.showView);
	const settle = useViewStore((state) => state.settle);
	const tabRefs = useRef<Partial<Record<PanelView, HTMLButtonElement | null>>>({});

	// A badge asked for an entry on the About tab: bring it into view and move keyboard
	// focus to it, so the next Tab continues from there. `request` makes a second press on
	// the same badge do it again.
	useEffect(() => {
		if (view !== "about" || !target) return;
		const entry = document.getElementById(target);
		if (!entry) return;
		// The whole panel has just changed, so there is nothing to glide past: the entry is
		// put at the top at once.
		entry.scrollIntoView({ block: "start" });
		entry.focus({ preventScroll: true });
	}, [view, target, request]);

	// "Back to where you were": return to the control that opened About. If it is gone, the
	// tab itself takes the focus.
	useEffect(() => {
		if (view === "about" || !returning) return;
		const to = origin?.isConnected ? origin : tabRefs.current[view];
		to?.focus({ preventScroll: true });
		to?.scrollIntoView({ block: "center" });
		settle();
	}, [view, returning, origin, settle]);

	return (
		<Tabs value={view} onValueChange={(value) => showView(value as PanelView)}>
			{/* Four tabs: on a phone the list wraps to a second row rather than overflowing. */}
			<TabsList aria-label="Panel views" className="h-auto flex-wrap">
				{FIELD_VIEWS.map((id) => (
					<TabsTrigger
						key={id}
						ref={(node) => {
							tabRefs.current[id] = node;
						}}
						value={id}
						className="min-h-8 px-3"
					>
						{FIELD_TAB_LABELS[id]}
					</TabsTrigger>
				))}
				<TabsTrigger value="about" className="min-h-8 px-3">
					About the data
				</TabsTrigger>
			</TabsList>
			{/* Every tab stays mounted and the ones not chosen are only hidden. A tab keeps what
			    the reader opened, and an About entry is there to be brought into view in the
			    same step that opens its tab. Each tab's content holds its own keyboard stops,
			    so the panel itself is not one. */}
			{FIELD_VIEWS.map((id) => (
				<TabsContent
					key={id}
					value={id}
					forceMount
					tabIndex={-1}
					className="data-[state=inactive]:hidden"
				>
					<FieldPanel section={id} />
				</TabsContent>
			))}
			<TabsContent
				value="about"
				forceMount
				tabIndex={-1}
				className="data-[state=inactive]:hidden"
			>
				<AboutData />
			</TabsContent>
			<GlossaryDescriptions />
		</Tabs>
	);
}
