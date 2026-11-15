"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Glossary tooltips (SPEC.md, user flow step 8: "Glossary tooltips on every science word").
// A term is a button with a dotted underline. Pointing at it or reaching it with the
// keyboard shows its definition; so does a tap, which is the only way on a phone. Escape, a
// second press or a press anywhere else hides it. The definitions and their sources are in
// data/glossary.json, and the full entries, with links, are on the About the data tab.

import { type ReactNode, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	GLOSSARY,
	glossaryEntry,
	markTerms,
	type TermId,
	type TextPart,
} from "@/lib/glossary";
import { cn } from "@/lib/utils";

/** The id of the hidden text that describes a term to a screen reader. */
const definitionId = (id: TermId) => `definition-${id}`;

/**
 * Every definition once, hidden, for screen readers. A tooltip only exists while it is open,
 * which is too late for a screen reader that reads a button as it takes focus. Each term
 * button points here instead, so its definition is read with it. Rendered once, by the panel.
 */
export function GlossaryDescriptions() {
	return (
		<div hidden>
			{GLOSSARY.map((entry) => (
				<span key={entry.id} id={definitionId(entry.id)}>
					Definition: {entry.definition}
					{entry.here ? ` ${entry.here}` : ""}{" "}
					{entry.own ? "The tool's own term." : `Source: ${entry.sourceName}.`}
				</span>
			))}
		</div>
	);
}

export function Term({
	id,
	children,
	className,
}: {
	id: TermId;
	children: ReactNode;
	className?: string;
}) {
	const entry = glossaryEntry(id);
	const [open, setOpen] = useState(false);
	// Whether the tooltip was open when the press began. Radix closes an open tooltip on
	// pointer down, before the click arrives, so the click cannot tell by looking at `open`.
	const openAtPress = useRef<boolean | null>(null);
	return (
		<Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
			<TooltipTrigger
				type="button"
				// Radix would point at the tooltip, and only while it is open. This points at
				// the definition that is always in the page (GlossaryDescriptions).
				aria-describedby={definitionId(id)}
				className={cn(
					"cursor-help rounded-sm text-left underline decoration-muted-foreground decoration-dotted underline-offset-[3px] outline-hidden hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring",
					className,
				)}
				onPointerDown={() => {
					openAtPress.current = open;
				}}
				// A press that never becomes a click is forgotten: a mouse dragged off the term,
				// or a touch the browser took over to scroll. A finger "leaves" on every tap,
				// between lifting and the click, so for touch only a cancelled press counts.
				onPointerLeave={(event) => {
					if (event.pointerType === "mouse") openAtPress.current = null;
				}}
				onPointerCancel={() => {
					openAtPress.current = null;
				}}
				onKeyDown={(event) => {
					// Radix answers Escape only on the newest tooltip layer, and a tooltip that is
					// still fading out counts as one. This closes the tooltip of the focused term.
					if (event.key === "Escape" && open) setOpen(false);
				}}
				onClick={(event) => {
					// Radix would close the tooltip on a click. Here a press toggles it instead:
					// a touch screen has no pointer to hover with.
					event.preventDefault();
					const wasOpen = openAtPress.current ?? open;
					openAtPress.current = null;
					setOpen(!wasOpen);
				}}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent
				collisionPadding={8}
				// While it is open, Radix adds the tooltip to what describes the button. The
				// definition is described already, so the tooltip's part is one short sentence
				// instead of the same definition a second time.
				aria-label="The definition is on screen."
				className="max-w-[min(20rem,calc(100vw-1rem))] space-y-1 py-2 text-left text-pretty"
			>
				<span className="block font-medium">{entry.term}</span>
				<span className="block">{entry.definition}</span>
				{entry.here ? <span className="block">{entry.here}</span> : null}
				<span className="block opacity-80">
					{entry.own ? "The tool's own term." : `Source: ${entry.sourceName}.`} More
					under About the data.
				</span>
			</TooltipContent>
		</Tooltip>
	);
}

/** Text in which the glossary terms found by `markTerms` are tooltips. */
export function Glossed({ parts }: { parts: readonly TextPart[] }) {
	return (
		<>
			{parts.map((part, index) =>
				typeof part === "string" ? (
					part
				) : (
					// The parts of one fixed text: their position is their identity.
					<Term key={index} id={part.term}>
						{part.text}
					</Term>
				),
			)}
		</>
	);
}

/** One piece of text with its glossary terms as tooltips, each term once. */
export function GlossedText({ text }: { text: string }) {
	return <Glossed parts={markTerms([text])[0]} />;
}
