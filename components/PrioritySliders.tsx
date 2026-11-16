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
import {
	DEFAULT_PRIORITIES,
	describeRainChange,
	RAIN_CHANGE_RANGE,
	rainChangeOf,
	signedPercent,
} from "@/lib/scoring";
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

/** Where the record (0) sits along the rain slider's track, 0 to 1. */
const RECORD_POSITION =
	(0 - RAIN_CHANGE_RANGE.min) / (RAIN_CHANGE_RANGE.max - RAIN_CHANGE_RANGE.min);

/**
 * The rain scenario (SPEC.md, feature 15, the rainfall half), a group of its own under the
 * priorities, with its own way back to the record. The temperature half needs each day's
 * temperatures in the browser, which the climate answer does not carry, so it is not built,
 * and the help says so.
 */
function RainScenario() {
	const headingId = useId();
	const helpId = useId();
	const sliderRef = useRef<HTMLDivElement>(null);
	const pct = usePrioritiesStore((state) => rainChangeOf(state.constraints));
	const setRainChange = usePrioritiesStore((state) => state.setRainChange);
	return (
		<div ref={sliderRef} role="group" aria-labelledby={headingId} className="space-y-1.5">
			<div className="flex min-h-8 items-center justify-between gap-3">
				<div className="flex items-baseline gap-2">
					<h3 id={headingId} className="text-sm font-medium">
						What if the rain changes?
					</h3>
					{/* The slider itself reads "20% less rain"; this is the same for the eye. */}
					<span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
						{pct === 0 ? "as recorded" : signedPercent(pct)}
					</span>
				</div>
				{pct !== 0 ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							// The button disappears at 0, so focus goes to the slider, not the page top.
							sliderRef.current
								?.querySelector<HTMLElement>('[role="slider"]')
								?.focus({ preventScroll: true });
							setRainChange(0);
						}}
					>
						Back to the record
					</Button>
				) : null}
			</div>
			{/* The track fills from the left end, so a tick marks where the record (0) sits. The
			    thumb (16 px) is kept inside the track, so its centre is pulled toward the middle
			    by half its width times how far it is from the middle; the tick follows the same rule. */}
			<div className="relative">
				<span
					aria-hidden="true"
					className="pointer-events-none absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-muted-foreground"
					style={{
						left: `calc(${RECORD_POSITION * 100}% + ${(0.5 - RECORD_POSITION) * 16}px)`,
					}}
				/>
				<Slider
					value={[pct]}
					min={RAIN_CHANGE_RANGE.min}
					max={RAIN_CHANGE_RANGE.max}
					step={RAIN_CHANGE_RANGE.step}
					aria-labelledby={headingId}
					aria-describedby={helpId}
					aria-valuetext={describeRainChange(pct)}
					onValueChange={([next]) => setRainChange(next)}
					className="min-h-11"
				/>
			</div>
			<p id={helpId} className="text-xs text-muted-foreground">
				Scores the rotations with less or more rain than recorded, the same change in every
				month, from {Math.abs(RAIN_CHANGE_RANGE.min)}% less to {RAIN_CHANGE_RANGE.max}% more.
				A what-if, not a forecast. Only <Term id="water-fit">water fit</Term> changes;{" "}
				<Term id="heat-exposure">heat exposure</Term> does not, because the temperature half
				of this scenario is not built.
			</p>
		</div>
	);
}

export function PrioritySliders() {
	return (
		<div className="space-y-4">
			<Priorities />
			<div className="border-t pt-3">
				<RainScenario />
			</div>
		</div>
	);
}

function Priorities() {
	const headingId = useId();
	const groupRef = useRef<HTMLDivElement>(null);
	const priorities = usePrioritiesStore((state) => state.priorities);
	const resetPriorities = usePrioritiesStore((state) => state.resetPriorities);
	const changed = PRIORITIES.some(
		(priority) => priorities[priority] !== DEFAULT_PRIORITIES[priority],
	);
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
		</div>
	);
}
