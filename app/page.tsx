// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { Disclaimer } from "@/components/Disclaimer";
import { FieldPanel } from "@/components/FieldPanel";
import { MapView } from "@/components/MapView";
import { ToneBadge } from "@/components/tone-badge";
import { isMockMode } from "@/lib/data-mode";

// Phase 1: the Kansas map beside the Field panel. A map click or the sample field button
// loads that place's climate history (see SPEC.md, "Build phases").
export default function Home() {
	return (
		<div className="flex min-h-dvh flex-col lg:h-dvh">
			<header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
				<h1 className="text-lg font-semibold tracking-tight">
					Field Shift Kansas
				</h1>
				<ToneBadge tone="neutral">Early preview</ToneBadge>
				{isMockMode() ? (
					<ToneBadge tone="neutral">Mock data: cached samples only</ToneBadge>
				) : null}
				<p className="w-full text-sm text-muted-foreground">
					Compare crop rotations for a Kansas field using NASA Earth data, USDA
					soil and crop data, and your own priorities.
				</p>
			</header>

			<Disclaimer />

			<main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="h-[55dvh] min-h-72 lg:h-auto lg:min-h-0">
					<MapView />
				</div>

				{/* The panel names itself: FieldPanel renders a region labelled by its "Field" heading. */}
				<div className="border-t p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l">
					<FieldPanel />
				</div>
			</main>
		</div>
	);
}
