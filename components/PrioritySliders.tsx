"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The four priority sliders and the switches about the farm (SPEC.md, user flow step 5).
// Each slider sets the weight of the indicators listed under it; which indicators those
// are comes from config/scoring.json.
//
// Switches (Angel's decision of 2026-11-14): irrigation is shown always. The no-till switch
// shows only once a loaded rotation needs no-till equipment, because until then it would
// change nothing. The market switch waits until its effect is defined.

import { Fragment, useId, useRef } from "react";
import { Term } from "@/components/Glossary";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { INDICATOR_LABELS, PRIORITY_LABELS } from "@/lib/card-text";
import { INDICATOR_TERMS } from "@/lib/glossary";
import { LIBRARY, PRIORITIES, SCORING } from "@/lib/library";
import { usePrioritiesStore } from "@/lib/priorities-store";
import { DEFAULT_PRIORITIES, RAIN_CHANGE_RANGE } from "@/lib/scoring";
import type { Priority } from "@/lib/types";

function PrioritySlider({ priority }: { priority: Priority }) {
	const labelId = useId();
	const value = usePrioritiesStore((state) => state.priorities[priority]);
	const setPriority = usePrioritiesStore((state) => state.setPriority);
	const weighs = SCORING.priorityIndicators[priority];
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
			{/* Each indicator is a glossary term: its tooltip says how the score is made. */}
			<p className="text-xs text-muted-foreground">
				Weighs{" "}
				{weighs.map((id, index) => (
					<Fragment key={id}>
						{index > 0 ? ", " : ""}
						<Term id={INDICATOR_TERMS[id]}>{INDICATOR_LABELS[id].toLowerCase()}</Term>
					</Fragment>
				))}
				.
			</p>
		</div>
	);
}

function FarmSwitch({
	name,
	label,
	help,
}: {
	name: "irrigationAvailable" | "hasNoTillEquipment";
	label: string;
	help: string;
}) {
	const id = useId();
	const checked = usePrioritiesStore((state) => state.constraints[name]);
	const setConstraint = usePrioritiesStore((state) => state.setConstraint);
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="min-w-0">
				<label htmlFor={id} className="text-sm font-medium">
					{label}
				</label>
				<p id={`${id}-help`} className="text-xs text-muted-foreground">
					{help}
				</p>
			</div>
			{/* The row is at least 44 px tall, and the label is a second target for the same switch. */}
			<span className="flex min-h-11 shrink-0 items-center">
				<Switch
					id={id}
					checked={checked}
					aria-describedby={`${id}-help`}
					onCheckedChange={(value) => setConstraint(name, value)}
				/>
			</span>
		</div>
	);
}

/** The words for a rain scenario: "20% less rain", "10% more rain", "the rain as recorded". */
export function describeRainChange(pct: number): string {
	if (pct === 0) return "the rain as recorded";
	return `${Math.abs(pct)}% ${pct < 0 ? "less" : "more"} rain`;
}

/**
 * The rain scenario (SPEC.md, feature 15, the rainfall half). The temperature half needs each
 * day's temperatures in the browser, which the climate answer does not carry, so it is not
 * built, and the help says so.
 */
function RainScenario() {
	const labelId = useId();
	const helpId = useId();
	const pct = usePrioritiesStore((state) => state.constraints.rainChangePct ?? 0);
	const setRainChange = usePrioritiesStore((state) => state.setRainChange);
	return (
		<div className="space-y-1.5 border-t pt-3">
			<div className="flex items-baseline justify-between gap-3">
				<span id={labelId} className="text-sm font-medium">
					What if the rain changes?
				</span>
				<span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
					{pct === 0 ? "as recorded" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`}
				</span>
			</div>
			<Slider
				value={[pct]}
				min={RAIN_CHANGE_RANGE.min}
				max={RAIN_CHANGE_RANGE.max}
				step={RAIN_CHANGE_RANGE.step}
				aria-labelledby={labelId}
				aria-describedby={helpId}
				aria-valuetext={describeRainChange(pct)}
				onValueChange={([next]) => setRainChange(next)}
				className="min-h-11"
			/>
			<p id={helpId} className="text-xs text-muted-foreground">
				Scores the rotations with {describeRainChange(pct)} in every month of the recent
				average, from {RAIN_CHANGE_RANGE.min}% to +{RAIN_CHANGE_RANGE.max}%. Only{" "}
				<Term id="water-fit">water fit</Term> changes. Heat exposure does not: the
				temperature half of this scenario is not built.
			</p>
		</div>
	);
}

export function PrioritySliders() {
	const headingId = useId();
	const groupRef = useRef<HTMLDivElement>(null);
	const priorities = usePrioritiesStore((state) => state.priorities);
	const rainChangePct = usePrioritiesStore((state) => state.constraints.rainChangePct ?? 0);
	const resetPriorities = usePrioritiesStore((state) => state.resetPriorities);
	const changed =
		rainChangePct !== 0 ||
		PRIORITIES.some((priority) => priorities[priority] !== DEFAULT_PRIORITIES[priority]);
	const someRotationNeedsNoTill = LIBRARY.rotations.some(
		(rotation) => rotation.needsNoTill,
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
			<div className="space-y-2 border-t pt-3">
				<FarmSwitch
					name="irrigationAvailable"
					label="This field can be irrigated"
					help="Adds the rotations that need irrigation, and scores your own rotation as irrigated."
				/>
				{someRotationNeedsNoTill ? (
					<FarmSwitch
						name="hasNoTillEquipment"
						label="I have no-till equipment"
						help="Without it, a rotation that needs no-till scores lower on simplicity."
					/>
				) : null}
			</div>
			<RainScenario />
		</div>
	);
}
