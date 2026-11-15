"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SOURCE_BADGE_ENTRIES, sourceAnchor } from "@/lib/about";
import { useViewStore } from "@/lib/view-store";

export type SourceName = keyof typeof SOURCE_BADGE_ENTRIES;

// SPEC.md, "UI rules": every number carries a small source badge that opens its About the
// Data entry. The entry says what the tool takes from the source and how far to trust it,
// and holds the link to the provider's own page.
export function SourceBadge({ source }: { source: SourceName }) {
	const openAbout = useViewStore((state) => state.openAbout);
	return (
		<Badge asChild variant="outline" className="min-h-6">
			<button
				type="button"
				className="cursor-pointer hover:border-foreground/50 hover:bg-accent hover:text-accent-foreground"
				onClick={(event) =>
					openAbout(sourceAnchor(SOURCE_BADGE_ENTRIES[source]), event.currentTarget)
				}
			>
				<span className="sr-only">Source: </span>
				{source}
				<InfoIcon aria-hidden="true" />
				<span className="sr-only">. Opens its entry on the About the data tab.</span>
			</button>
		</Badge>
	);
}
