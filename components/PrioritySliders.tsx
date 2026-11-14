"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The four priority sliders (SPEC.md, user flow step 5). Each slider sets the weight of
// the indicators listed under it; which indicators those are comes from config/scoring.json.

import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { INDICATOR_LABELS } from "@/lib/card-text";
import { PRIORITIES, SCORING } from "@/lib/library";
import { usePrioritiesStore } from "@/lib/priorities-store";
import { DEFAULT_PRIORITIES } from "@/lib/scoring";
import type { Priority } from "@/lib/types";

const PRIORITY_LABELS: Record<Priority, string> = {
	saveWater: "Save water",
	protectSoil: "Protect soil",
	income: "Income",
	simplicity: "Simplicity",
};

function PrioritySlider({ priority }: { priority: Priority }) {
	const labelId = useId();
	const value = usePrioritiesStore((state) => state.priorities[priority]);
	const setPriority = usePrioritiesStore((state) => state.setPriority);
	const weighs = SCORING.priorityIndicators[priority]
		.map((id) => INDICATOR_LABELS[id].toLowerCase())
		.join(", ");
	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between gap-3">
				<span id={labelId} className="text-sm font-medium whitespace-nowrap">
					{PRIORITY_LABELS[priority]}
				</span>
				{/* The slider itself announces "50 of 100"; this is the same number for the eye. */}
				<span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
					{value}
				</span>
			</div>
			<Slider
				value={[value]}
				min={0}
				max={100}
				step={5}
				aria-labelledby={labelId}
				aria-valuetext={`${value} of 100`}
				onValueChange={([next]) => setPriority(priority, next)}
				// The track is 6 px tall; the slider answers a touch anywhere in this 44 px band.
				className="min-h-11"
			/>
			<p className="text-xs text-muted-foreground">Weighs {weighs}.</p>
		</div>
	);
}

export function PrioritySliders() {
	const headingId = useId();
	const groupRef = useRef<HTMLDivElement>(null);
	const priorities = usePrioritiesStore((state) => state.priorities);
	const resetPriorities = usePrioritiesStore((state) => state.resetPriorities);
	const changed = PRIORITIES.some(
		(priority) => priorities[priority] !== DEFAULT_PRIORITIES[priority],
	);
	return (
		<div ref={groupRef} role="group" aria-labelledby={headingId} className="space-y-3">
			<div className="flex min-h-8 items-center justify-between gap-3">
				<div>
					<h3 id={headingId} className="text-sm font-medium">
						Your priorities
					</h3>
					<p className="text-xs text-muted-foreground">
						Each runs from 0 to 100. Move one to change how much it counts; the
						list below re-orders as you move it.
					</p>
				</div>
				{changed ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							// The button disappears once the sliders are back at 50, so keyboard
							// focus moves to the first slider instead of being dropped.
							groupRef.current
								?.querySelector<HTMLElement>('[role="slider"]')
								?.focus({ preventScroll: true });
							resetPriorities();
						}}
					>
						Reset
					</Button>
				) : null}
			</div>
			<div className="grid grid-cols-2 gap-x-5 gap-y-4">
				{PRIORITIES.map((priority) => (
					<PrioritySlider key={priority} priority={priority} />
				))}
			</div>
		</div>
	);
}
