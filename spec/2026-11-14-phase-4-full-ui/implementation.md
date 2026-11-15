# Phase 4: Full UI. Implementation

Date: 2026-11-14.

**Status: accepted by Angel, built and committed on local `main`. Not pushed, so not deployed.** The public URL still shows Phase 3.

After the summary of this phase, with its choices to confirm, its cuts and what was not verified, Angel wrote "All right, let's continue working." at about 21:58 CST on 2026-11-14. Claude took that as approval of the phase as built and as the go-ahead for Phase 5. It did not settle the choices listed below one by one; any of them can still be changed.

User flow steps 1 to 7 work on a local run at desktop size and at an emulated 375 x 812 phone size, with the limits listed under "What was cut" and "Not checked". Step 6's soil moisture and groundwater belong to Phase 6.

## What was built

- **Rotation cards** (`components/RotationCard.tsx`): the score, the seven indicator scores, the field calendar and the five fields of SPEC.md: why suggested, evidence, benefits, information gaps, risks to verify locally. Every sentence carries its source, with links. A rotation with no sourced benefit or risk says so. Every card ends with the verify-locally line.
- **The list** (`components/RotationRanking.tsx`): the field's own rotation and the three best matches for its part of Kansas. The other rotations the tool scored sit behind a disclosure.
- **An irrigation switch** beside the four sliders. It adds the rotations that need irrigation and scores the field's own rotation as irrigated.
- **The field calendar** (`components/FieldCalendar.tsx`, `lib/climate-windows.ts`): one row of twelve months per year of the cycle, crop months filled and bare months empty, under three rows for the months the field is usually hot, dry or frosty.
- **Four climate charts in tabs** (`components/ConditionsCharts.tsx`): hot days, growing-season rain, the last spring freeze and the first fall freeze, each with a trend arrow, a confidence label, the long-term average and a table.
- **"Use my location"** on the map (`lib/location.ts`).
- **On a phone**, choosing a field brings the panel into view, and a "Back to the map" link sits at its top.

## Acceptance criteria

| Criterion (SPEC.md, Phase 4) | Status | Note |
| --- | --- | --- |
| Rotation cards with the five fields; priority sliders and toggles | Met, with one switch of three | By Angel's decision only the irrigation switch is shown (see below) |
| All conditions charts with trend labels | Met | The three charts feature 2 names, and the first fall freeze (choice 9) |
| Field calendar, one 12-month row per year of the rotation | Met | Years that look the same are drawn once |
| "Use my location", and the disclaimer banner on every view | Met | The app has one view; the banner was already on it |
| One NASA GIBS vegetation layer toggle (last, skipped if late) | **Skipped** | SPEC.md allows it. The layer name was confirmed in Phase 2 |

Features: 7 (the irrigation switch hides and shows the irrigated rotation) and 8 (own rotation plus top 3, five fields, verify-locally line) are met; 9 is met with the windows defined as below; 2 and 3 are met.

## Decisions Angel made before this phase

1. **Water fit on an irrigated field.** An irrigated rotation keeps its pumping score but never scores higher than the same rotation would on rain alone. At the Thomas sample the field's own rotation stays at 45 with irrigation on (it was 60); Finney's corn drops from 39 to 14. All three options put to Angel passed the rule 11 sweep.
2. **Switches.** Irrigation only for now. The no-till switch is built and shows by itself once a loaded rotation has `needsNoTill: true`. The market switch is not built: SPEC.md does not say what it should change.

Both are in SPEC.md ("Decisions made on 2026-11-14, after Phase 2", items 8 and 9, and formula 3).

## Choices Claude made, for Angel to review

1. **The calendar's hot, dry and frost windows.** SPEC.md asks for them and does not define them. A threshold picked by the tool would be a tuning constant, so each window follows a rule that needs no chosen number (`lib/climate-windows.ts`):
   - Hot: a day at or above 95°F occurred in that month in more than half of the last ten years.
   - Dry: reference ET exceeds rain in that month by more than in the field's own average month, on the last ten years.
   - Frost: from the average first fall freeze to the average last spring freeze.
   The rules are stated under every calendar. No score uses them.
2. **The windows sit above the months, not on the cells.** SPEC.md says "laid over it". Three thin rows share the month columns with the year rows, which keeps a 20 px cell readable on a phone.
3. **Crop months carry a letter** (W, C, S, Sb, A), not a colour per crop: SPEC.md's UI rules allow one accent and status colours only.
4. **Top three, then a disclosure.** The fourth-ranked rotation and the ones usual in other parts of Kansas are behind "N more rotations scored for this field".
5. **Sections of a card open and close.** The field calendar is open on the field's own card and on the best match; everything else starts closed, so the list stays readable.
6. **Computed advantages** are two, both plain differences from the field's own rotation: fewer bare months, and less irrigation when both are irrigated.
7. **The freeze chart is points on a date axis**, not bars: a day of the year has no meaningful zero. Its axis spans the dates on record. Dates are read on a 365-day year.
8. **Which direction takes the warning colour**: more hot days, less rain, a later last spring freeze, an earlier first fall freeze.
9. **First fall freeze has a chart, which SPEC.md's feature list does not ask for.** Feature 2 names three charts; SPEC.md's trend detection lists the fall freeze among its series. Its trend is the clearest finding at all three samples (likely later by 3 to 4 days per decade), and the chart is one entry in a list. Remove the entry in `components/ConditionsCharts.tsx` if you do not want it.
10. **"Use my location"** asks for a coarse position once, accepts one up to an hour old, and gives up after 15 seconds. It jumps the map to the point without animation.
11. **Phone layout.** SPEC.md asks for a bottom sheet. The panel still sits under the map; choosing a field scrolls to it, and "Back to the map" returns.
12. **A line names what the irrigation switch added.** At a field whose own rotation is not the irrigated one, the switch adds continuous corn, which ranks low and sits behind the disclosure. Without the line the switch would look as if it did nothing.
13. **The water-fit sentence** now gives a share and inches per crop ("cover about 39 percent of potential crop demand: on average 13.1 of 33.8 in per crop"), not a total per cycle.

## What was cut

- **The NASA GIBS vegetation layer** (feature 13). Skipped for time, as SPEC.md allows.
- **The trend of crop water demand** (SPEC.md formula 2, "plus its trend"). Carried over from Phase 3 and still not computed.
- **The no-till and market switches on screen**, by Angel's decision.
- **A true bottom sheet on phones.**
- **A source badge on each of the seven scores.** Each card names its sources once, under "How these scores were worked out", with the NASA POWER and SSURGO badges; every evidence, benefit and risk line carries its own source.
- **Glossary tooltips**: Phase 5.

## Files

### Written by AI (Claude) in this phase

- `components/RotationCard.tsx`, `components/FieldCalendar.tsx`
- `lib/climate-windows.ts`, `lib/climate-windows.test.ts`
- `lib/location.ts`, `lib/location.test.ts`
- `lib/trend-text-series.test.ts`
- `spec/2026-11-14-phase-4-full-ui/task.md`, `plan.md`, `implementation.md`

### Changed

- `components/RotationRanking.tsx`, `components/PrioritySliders.tsx`, `components/ConditionsCharts.tsx`, `components/MapView.tsx`, `components/FieldPanel.tsx`
- `lib/scoring.ts`, `lib/scoring.test.ts`, `lib/priorities-store.ts`, `lib/card-text.ts`, `lib/card-text.test.ts`, `lib/trend-text.ts`
- `SPEC.md` (decisions 8 and 9, formula 3)
- `README.md`

## Verification

Run on 2026-11-14 at 21:51 CST, after the last code change:

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test` | 27 files, 340 tests passed (319 before this phase) |
| `npm run build` | exit 0 |

The two sanity rules of CLAUDE.md rule 11 still hold as tests under the new water-fit rule, and a new test checks at all three samples that switching irrigation on never raises the water fit of the field's own rotation.

In the browser, on the production build (`next start`), with the pane shown, about 21:46 to 21:50 CST. These checks ran after the UI review's fixes:

| Check | Result |
| --- | --- |
| Finney sample | Its own rotation 60, then wheat-fallow 68, wheat-sorghum-fallow 63, continuous wheat 62; "2 more rotations" behind the disclosure. The calendar is open on the field's own card and on the best match |
| Irrigation switch on | The field's own corn is scored as irrigated: water fit 14, total 54 with the sliders at 50. The sentence says irrigating would take about 20.7 in a year |
| Sliders at 0, 100, 0, 0 with the switch on | Continuous wheat becomes the best match. An Evidence section opened by hand on it stayed open, and its calendar did not open by itself |
| Calendar table | Column headers read as full month names; the first column is named; a marked month reads "usually hot" and an unmarked one "not"; corn every year is one row, "Every year" |
| A source link | Its name carries the site and the publication, for example "bookstore.ksre.ksu.edu, K-State, Efficient Crop Water Use in Kansas (MF3066, August 2012)..." |
| Chart tabs | Hot days, Rain, Spring freeze and Fall freeze. Rain: possible trend, about 0.6 more inches per decade. Fall freeze: likely trend, about 3.3 days later per decade (p = 0.02) |
| Use my location | The browser pane refuses location requests, so the denied sentence showed and no point was chosen. A granted location, a timeout and an unavailable position were not exercised; their sentences are unit-tested |
| Brown sample | Its own rotation 73; one candidate, continuous wheat 77; three more behind the disclosure |
| 375 x 812 | No sideways scrolling. Choosing a field scrolled to the panel, with "Back to the map" at its top and keyboard focus on the panel. The four tabs fit on one line |
| Console | No errors |

Three more checks, on the last build, about 21:51 to 21:53 CST, with real pointer clicks:

| Check | Result |
| --- | --- |
| A click on the map at 38.431, -99.253 (not a sample) | Three live routes answered 200. Central Kansas, 26 in of rain. The point is pasture, so a note says its own rotation is not scored; three ranked cards, each with its calendar; four chart tabs |
| Both freeze charts, after the date axis was widened | Each axis label sits on one line ("Nov 26", "Oct 27", "Apr 10"). At that point the first fall freeze shows a likely trend, about 3.5 days later per decade (p = 0.01) |
| The irrigation switch at the Thomas sample | Continuous corn joins the list, ranked 5 with a score of 54, behind the disclosure ("3 more rotations"). A line above the cards says "Included because this field can be irrigated: Continuous corn (ranked 5)." The field's own water fit stays at 45 |

Earlier, on the development server and before the review fixes: the irrigation switch, the five fields of the best card (evidence, benefits, gaps, risks, how the scores were worked out) and the rain and spring-freeze charts were read and looked at.

Not checked: the public URL, a real phone, a screen reader, automated accessibility tests. "Use my location" was exercised on the denied path only: it needs one try in a real browser or on a phone, which only Angel can do.

## Data check

The `data-verifier` was not run in this phase. No value in `data/` or `config/` changed. `data/README.md` gained one sentence, in the row for the irrigation cap, stating Angel's decision that an irrigated rotation never scores above what it would on rain alone. Every new number on screen is computed from values that were verified in Phase 3. One sentence under the rain chart was reworded from "no public source defines" a growing season to "no public definition for Kansas was found", which is what is known.

## UI review

The `ui-reviewer` subagent read the code (it does not run a browser).

Must fix, all fixed except the last, which is Phase 5:

| Finding | Done |
| --- | --- |
| Month headers were single letters in `<abbr title>`, which screen readers do not reliably read | The letter is hidden from screen readers and the full month name is read |
| The calendar's first column had no header | Named "Year or climate window" |
| A window cell read "yes" or "no" | Now "usually hot", "usually dry", "frost possible", or "not" |
| A month shared by two crops showed one letter | A + follows the letter, and the legend says what it means |
| No glossary tooltips on science terms | Not done: the glossary is Phase 5. Mann-Kendall, Sen's slope, evapotranspiration and potential demand are plain text until then |

Should fix, fixed:

- A card section's open state now belongs to the reader; a slider move no longer opens or closes it.
- A rotation's name is a heading, so heading navigation reaches each card.
- A source link's accessible name carries the publication, not only the site.
- The freeze charts' hover line uses a theme colour, and their dots are smaller.
- "Use my location" keeps keyboard focus while it waits, says "Finding your location", and clears an old message when a point is chosen.
- After the automatic scroll on a phone, keyboard focus moves to the panel.
- "Best match" reads "Best match of those compared", since a best match can still have a low score.
- The calendar legend states its rules in plainer words.
- Section toggles are taller, for touch.

Not done:

- **Text size.** Most card text is 12 px, which the reviewer calls small for a phone. SPEC.md allows three sizes per view and the panel uses three.
- **"Back to the map" adds `#map` to the browser history.** It is a plain link, so it works without script; the Back button then returns to the panel first.

## Open items for Angel

1. **The window rules of the calendar** (choice 1) are the tool's own. Say if you want different ones.
2. **The market switch** needs a definition before it can be built.
3. **First fall freeze** as a fourth chart: keep it or drop it (choice 9).
4. **The four rotations not loaded** (from Phase 3): corn-wheat can be added at once.
5. Still open from earlier phases: a public source for the 95°F threshold, colour for the rotation chips, the mean temperature definition, the pin's accent token.
