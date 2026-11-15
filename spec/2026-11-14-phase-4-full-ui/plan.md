# Phase 4: Full UI. Plan

Date: 2026-11-14. Normal mode, one session. Each slice is committed on its own. Nothing is pushed.

## Slice 1: irrigation switch and the water-fit rule

1. `lib/scoring.ts`: an irrigated rotation's water fit is the lower of its pumping score and what it would score on rain alone. Reword the water-fit sentence so it gives a share and inches per crop, not a total per cycle.
2. Tests: the new rule by hand, and the rule 11 sweep again.
3. `lib/priorities-store.ts` holds the farmer's constraints. An irrigation switch beside the sliders; the no-till switch only when a loaded rotation needs no-till.
4. `RotationRanking` scores with the store's constraints, so the switch shows the irrigated rotations and re-scores the field's own.

## Slice 2: rotation cards

1. `lib/card-text.ts`: computed advantages for the benefits, and a source splitter that turns a source string into text and links. Tested on the real data files.
2. `components/RotationCard.tsx`: score, breakdown, and the five fields. Explicit wording when a rotation has no sourced benefit or risk. A verify-locally line on every card. Source badges on the scores.
3. The list shows the field's own rotation and the top three; the rest sit behind a disclosure.

## Slice 3: field calendar

1. `lib/climate-windows.ts`: the heat, dry and frost months of a field, by rules that need no chosen number, with tests.
2. `components/FieldCalendar.tsx`: one 12-month row per year of the cycle, crop against bare, with the three windows above the same month columns and a legend that states the rules.

## Slice 4: conditions charts

1. Growing-season rain and last spring freeze beside hot days, each with its trend arrow, label and sentence, its average line and its table.
2. Freeze dates are days of the year: no bars from zero, dates on the axis, years with no freeze left as gaps.

## Slice 5: location and the phone flow

1. "Use my location": inside Kansas it selects the point; denied, unavailable, timed out and outside Kansas each get their own message.
2. On a phone, picking a field brings the panel into view, with a way back to the map.

## Slice 6: what is left, in this order, as time allows

1. The trend of crop water demand as an evidence line.
2. One NASA GIBS vegetation layer with a legend and a date picker.

## Finish

1. Typecheck, lint, tests, build; show the output.
2. Browser checks on the production build, with the pane shown: the three samples, a live click, the switch, the cards, the calendar, the charts, 375 px, keyboard.
3. `ui-reviewer` once. `data-verifier` only if new claim text is written.
4. `implementation.md`, README. Commit. Do not push. Stop for Angel's review.
