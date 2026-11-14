// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { MapPinIcon } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { Section } from "@/components/layout/page";
import { MapView } from "@/components/MapView";
import { EmptyState } from "@/components/states";
import { ToneBadge } from "@/components/tone-badge";

// Phase 0 placeholder: the Kansas base map beside an empty field panel.
// Field selection and data arrive in Phase 1 (see SPEC.md, "Build phases").
export default function Home() {
	return (
		<div className="flex min-h-dvh flex-col lg:h-dvh">
			<header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
				<h1 className="text-lg font-semibold tracking-tight">
					Field Shift Kansas
				</h1>
				<ToneBadge tone="neutral">Early preview</ToneBadge>
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

				<aside
					aria-label="Field details"
					className="border-t p-4 lg:overflow-y-auto lg:border-t-0 lg:border-l"
				>
					<Section title="Field">
						<EmptyState
							icon={<MapPinIcon />}
							title="No field selected"
							description="Picking a field is not built yet. This early preview shows the base map of Kansas only."
						/>
					</Section>
				</aside>
			</main>
		</div>
	);
}
