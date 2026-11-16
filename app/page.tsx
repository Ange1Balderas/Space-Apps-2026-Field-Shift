// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { Disclaimer } from "@/components/Disclaimer";
import { MapView } from "@/components/MapView";
import { PrintSummary } from "@/components/PrintSummary";
import { SidePanel } from "@/components/SidePanel";
import { ToneBadge } from "@/components/tone-badge";
import { isMockMode } from "@/lib/data-mode";

// The Kansas map beside the panel. A map click or a sample field button loads that place's
// crops, soil and climate into the panel's Field tab; its About the data tab explains the
// sources, the scores and the terms (SPEC.md, "User flow").
export default function Home() {
	return (
		<>
			{/* On paper the app gives way to the one-page summary (SPEC.md, feature 18). */}
			<PrintSummary />
			<div className="flex min-h-dvh flex-col print:hidden lg:h-dvh">
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
					<div className="h-[55dvh] min-h-72 min-w-0 lg:h-auto lg:min-h-0">
						<MapView />
					</div>

					{/* The panel names itself: its tabs are labelled, and each section inside is a
					    region labelled by its own heading. min-w-0 on both halves keeps a wide table
					    in the panel from widening the page on a phone. */}
					<div className="min-w-0 border-t p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l">
						<SidePanel />
					</div>
				</main>
			</div>
		</>
	);
}
