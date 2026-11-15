# Phase 4: Full UI. Task

Date: 2026-11-14. Source: SPEC.md, "Build phases for Fable" > "Phase 4: Full UI", with "User flow", "Features" (2, 3, 7, 8, 9) and "UI rules for Fable".

## Problem

The panel ranks rotations, but a farmer cannot yet read why a rotation is suggested, what backs it, what the tool cannot see, or what to check before changing anything. The field's irrigation cannot be set, only one climate chart exists, and the months a rotation leaves the ground bare are computed but not drawn.

## Acceptance criteria (copied from SPEC.md)

- [ ] Rotation cards with the five fields; priority sliders and toggles
- [ ] All conditions charts with trend labels
- [ ] Field calendar, one 12-month row per year of the rotation
- [ ] "Use my location", and the disclaimer banner on every view
- [ ] Last, and skipped if late: one NASA GIBS vegetation layer toggle with a legend and date picker

Done when: user flow steps 1 to 7 work on desktop and at phone width.

## The user flow steps this phase must cover (SPEC.md)

1. Land on the map: one line on what the tool does, the banner, "Use my location" and three sample fields.
2. Pick a field: click anywhere, or pick a sample field.
3. See the field summary: rotation chips for the last 8 years, soil texture, water holding capacity and erosion risk.
4. Read the rotation cards: the existing rotation plus the top three candidates, ranked by score. Each card shows the score breakdown and the five fields: why suggested, evidence, benefits, information gaps, risks to verify locally.
5. Adjust priorities: sliders and toggles. Cards re-rank instantly.
6. Dig into conditions: growing season rain, hot days and last spring frost since 1981, each with a trend arrow and a confidence label. (Soil moisture and groundwater belong to Phase 6.)
7. Check the field calendar: one 12-month row per year of the cycle, crop months against bare months, with typical heat, dry and frost windows laid over it.

## Features and their "done when" (SPEC.md)

- 2: charts from 1981 to the last full year: growing season rain (in), days at or above 95°F, last spring freeze date.
- 3: every climate chart shows change per decade and a confidence label.
- 7: moving a slider re-ranks cards instantly; the irrigation toggle hides irrigated-only rotations.
- 8: existing rotation plus top 3 shown; each has why suggested, evidence, benefits, gaps, risks, and a verify-locally line.
- 9: one 12-month row per year of the rotation showing crop against bare months, with heat, dry and frost windows from POWER climatology.

## Decisions that bind this phase (Angel, 2026-11-14)

- Water fit on an irrigated field: the pumping score stays, but an irrigated rotation never scores higher than it would on rain alone.
- Switches: irrigation only for now. The no-till switch appears once a loaded rotation needs no-till. The market switch waits for a definition.

## Rules that apply (CLAUDE.md)

- Rule 6: semantic colour tokens only, one accent, loading, empty and error states for every panel, 390 px, keyboard.
- Rule 1: a threshold the tool chose is a tool assumption in `config/scoring.json`. The calendar's windows are therefore worked out by rules that need no chosen number.
- Rule 9: the disclaimer banner on every view. Rule 7: no logos, no images of people.
- Rule 11: both sanity checks stay as tests.

## Carried over from Phase 3

- The water-fit sentence should not total demand "per cycle".
- The trend of crop water demand (SPEC.md formula 2).
- "Any computed advantage" in a card's benefits.
- A source badge on the scores.
