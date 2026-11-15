"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The panel beside the map, with its two tabs: Field, and About the data (SPEC.md, user flow
// step 8). The Field tab stays in the page while About is open, so the cards the reader
// opened, the chart they chose and their place in the list are all still there on return.

import { useEffect, useRef } from "react";
import { AboutData } from "@/components/AboutData";
import { FieldPanel } from "@/components/FieldPanel";
import { GlossaryDescriptions } from "@/components/Glossary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type PanelView, useViewStore } from "@/lib/view-store";

export function SidePanel() {
	const view = useViewStore((state) => state.view);
	const target = useViewStore((state) => state.target);
	const request = useViewStore((state) => state.request);
	const origin = useViewStore((state) => state.origin);
	const returning = useViewStore((state) => state.returning);
	const showView = useViewStore((state) => state.showView);
	const settle = useViewStore((state) => state.settle);
	const fieldTabRef = useRef<HTMLButtonElement>(null);

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
	// Field tab itself takes the focus.
	useEffect(() => {
		if (view !== "field" || !returning) return;
		const to = origin?.isConnected ? origin : fieldTabRef.current;
		to?.focus({ preventScroll: true });
		to?.scrollIntoView({ block: "center" });
		settle();
	}, [view, returning, origin, settle]);

	return (
		<Tabs value={view} onValueChange={(value) => showView(value as PanelView)}>
			<TabsList aria-label="Panel views">
				<TabsTrigger ref={fieldTabRef} value="field" className="min-h-8 px-3">
					Field
				</TabsTrigger>
				<TabsTrigger value="about" className="min-h-8 px-3">
					About the data
				</TabsTrigger>
			</TabsList>
			{/* Both tabs stay mounted and the one not chosen is only hidden. The Field tab keeps
			    what the reader opened, and an About entry is there to be brought into view in
			    the same step that opens its tab. Each tab's content holds its own keyboard
			    stops, so the panel itself is not one. */}
			<TabsContent
				value="field"
				forceMount
				tabIndex={-1}
				className="data-[state=inactive]:hidden"
			>
				<FieldPanel />
			</TabsContent>
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
