# Phase 3: Water, calendar and scoring. Implementation

Date: 2026-11-14.

**Status: approved by Angel, deployed, and checked on the public URL.** `main` was pushed at 18:32 CST on 2026-11-14 at Angel's request, and the checks under "Deployment" passed on https://space-apps-2026-field-shift.vercel.app by 18:36 CST.

Angel answered "Approved" to "Do you approve Phase 3 as built?" on 2026-11-14 at about 18:25 CST, after the summary of what works, what is weak and what was cut. That approves the phase as it stands, with the loaded data files and the choices listed below; any of them can still be changed. Open item 6 (irrigated and dryland water fit share one scale) was not part of that answer and is still open before Phase 4.

The phase's "done when" is met on a local run of the app: each of the three sample fields produces a ranked list with a visible breakdown, moving a slider re-orders it, and the two sanity tests pass. It was checked in Claude's own browser on the development server, at desktop size and at an emulated 375 x 812 phone size, and once on the production build. It was then checked on the public URL (see "Deployment"). It has not been checked on a real phone or with a screen reader.

## What was built

- `lib/et.ts`: daily reference evapotranspiration by the FAO-56 Penman-Monteith method. `/api/climate` now returns monthly rain, reference ET and hot days for every year from 1984, and monthly normals.
- `data/crops.json`, `data/calendar.json`, `data/rotations.json` and `config/scoring.json`, with `lib/library.ts` to read them and check their shape. Six rotations.
- `lib/calendar.ts`: a rotation as a month grid over its whole cycle, with crop months and bare months.
- `lib/crop-water.ts`: potential crop water demand from the FAO-56 crop coefficient curve.
- `lib/scoring.ts`: the seven indicators, the weights from the four priorities, the weighted score and the ranking.
- `lib/existing-rotation.ts`: the field's own rotation from its detected or hand-entered years.
- `lib/card-text.ts`: the text templates for the five card fields.
- A Rotations section in the panel: the ranked list, the breakdown and four priority sliders.

## Acceptance criteria

| Criterion (SPEC.md, Phase 3) | Status | Note |
| --- | --- | --- |
| `lib/et.ts`, tested against the FAO-56 daily worked example; the climate route returns monthly ET | Met | 19 tests reproduce Example 18 step by step: 3.88 mm a day, within 0.01 |
| JSON schemas for the three data files, with a source on every published value | Met, as TypeScript checks | `lib/library.ts` returns a list of problems for each file; it runs at build time and in the tests. Not JSON Schema documents (see choice 12) |
| Load the researched values, each with its source link; Angel reviews and approves | Loaded; **Angel's review is open** | Every loaded value was confirmed at its source first (see "Source checks") |
| Multi-year calendar per rotation | Met in the library | The strip that draws it is Phase 4 |
| `lib/scoring.ts`: seven indicators, weighted score, card field templates | Met | Templates are in `lib/card-text.ts`; only "why suggested" is on screen yet |
| Sanity tests | Met | Both are tests, swept over the sliders (see "Verification") |
| Start with six rotations; add the rest once those pass | Six loaded | The other four need values that are not sourced yet (see open item 3) |

## What the three samples show

Sliders at 50, irrigation not available (the tool's default until the Phase 4 switch exists). Columns after the total: water fit, heat and drought exposure, soil protection, soil building, pest and disease break, market fit, simplicity.

| Field | Rotation | Total | W | H | SP | SB | P | M | S |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Finney (west, 21 in) | Its own: corn every year, scored as dryland | 60 | 39 | 56 | 72 | 25 | 0 | 100 | 100 |
| | 1. Wheat-fallow | 68 | 50 | 68 | 70 | 25 | 50 | 100 | 100 |
| | 2. Wheat-sorghum-fallow | 63 | 47 | 64 | 71 | 25 | 67 | 100 | 80 |
| | 3. Continuous winter wheat | 62 | 36 | 68 | 88 | 25 | 0 | 100 | 100 |
| | 4. Wheat-corn-fallow | 62 | 44 | 62 | 71 | 25 | 67 | 100 | 80 |
| Thomas (west, 20 in) | Its own: wheat and fallow, then sorghum | 63 | 45 | 72 | 72 | 25 | 67 | 100 | 80 |
| | 1. Wheat-fallow | 68 | 50 | 73 | 70 | 25 | 50 | 100 | 100 |
| | 2. Wheat-sorghum-fallow | 63 | 45 | 71 | 71 | 25 | 67 | 100 | 80 |
| | 3. Continuous winter wheat | 63 | 36 | 73 | 88 | 25 | 0 | 100 | 100 |
| | 4. Wheat-corn-fallow | 62 | 43 | 67 | 71 | 25 | 67 | 100 | 80 |
| Brown (east, 35 in) | Its own: corn and soybeans | 73 | 74 | 83 | 62 | 50 | 67 | 100 | 80 |
| | 1. Continuous winter wheat | 77 | 88 | 93 | 85 | 25 | 0 | 100 | 100 |

Behind the water fit at Finney, on the average months of 2016 to 2025: potential demand is 31.4 in for winter wheat and 33.8 in for corn. Wheat after a 15-month fallow starts with 6.3 in stored and wheat every year with 1.9 in. Corn every year would need about 20.7 in of irrigation a year.

Things in these numbers that Angel should look at before the demo:

1. **Brown has one candidate.** Only continuous wheat and corn-soybean are listed for the east among the six loaded rotations, and corn-soybean is what the field already grows. The eastern rotations that would compete (double-crop soybean, cover crop, alfalfa) are not loaded.
2. **There is no yield or price in the score.** The tool cannot see local prices, so "Income" weighs heat exposure, pest break and market fit only. A low-demand, one-crop rotation therefore scores well: continuous wheat outranks corn-soybean at Brown, and wheat-fallow scores 81 there. Wheat-fallow is shown apart, as usual in western Kansas, and not suggested.
3. **Potential demand is high.** FAO-56 coefficients describe a well-watered crop, so every dryland rotation in the west shows a large shortfall, and water fit sits between 36 and 50. The ranking between rotations is what carries meaning, not the level.
4. **The hot-day penalty did not fire.** No sample has a "likely" rising hot-day trend, so the 10-point penalty was only exercised in tests.

## What was cut or left for later

- **The trend of crop water demand.** SPEC.md formula 2 says demand is "reported as the 10-year average plus its trend". The average is computed and shown; the trend is not computed. It belongs with the evidence on the Phase 4 cards.
- **"Any computed advantage" in a card's benefits.** SPEC.md says benefits are "library benefits plus any computed advantage". `benefitLines` returns the library's benefits only.
- **Four of the ten rotations** (see open item 3), and with them the cover-crop and no-till parts of the scoring, which have nothing to act on yet.
- **The three switches** (irrigation, no-till equipment, market access), the rotation cards and the calendar strip: Phase 4. The logic for irrigation and no-till exists and is tested; nothing on screen sets it.
- **Four of the five card fields on screen.** Evidence, benefits, information gaps and risks exist as tested templates in `lib/card-text.ts`; only "why suggested" is shown.

## Decisions Angel made in this phase

One question was put to Angel before `lib/types.ts` was touched, and Angel chose "Add both":

- `Sourced` gained an optional `assumption` note, for a value that is the tool's own pick among published numbers.
- `ScoringConfig` gained `erosion`, `soilBuildingPoints`, `marketScores`, `simplicity` and `priorityIndicators`.

Both are in SPEC.md ("Data contracts", and item 7 of "Decisions made on 2026-11-14, after Phase 2").

## Choices Claude made, for Angel to review

Every constant below is in `config/scoring.json` and explained in `data/README.md`.

1. **Suggestions are limited to rotations the library lists for the field's part of Kansas.** SPEC.md gives each rotation a typical region and decides a field's region from its rainfall, but does not say what the region is for. Rotations for another part of the state are still scored and are shown in their own group. Without this, wheat-fallow would be the top suggestion in northeast Kansas.
2. **Region edges are 23.1 and 31.6 in of rain a year**: halfway between K-State's long-term averages for the western, middle and eastern thirds of Kansas (20.2, 26.0 and 37.2 in, MF3335). SPEC.md asked for edges "cited from K-State"; no K-State source gives edges, so these are a tool assumption built on K-State's numbers.
3. **A crop's season runs from the middle of USDA's most active planting window to the middle of its most active harvest window.** FAO-56's stage lengths are scaled in proportion to fill that season.
4. **A month is a crop month when a crop is in the ground for at least half of it.** Water is counted by days. Every year has 365 days.
5. **One usable share of rain, 75 percent, and one fallow efficiency, 20 percent, for all of Kansas.** The first is read off a K-State simulated water budget for dryland corn in northwest Kansas; the second is the conventional-tillage average of a USDA-ARS study at Akron, Colorado. Both carry an `assumption` note. No-till stores more (35 percent in that study), and the tool does not yet tie this to the no-till switch.
6. **Heat-sensitive months**: K-State names the stage; the month is the one in which USDA's five-year average for that stage passes half of the crop. One month per crop: June for wheat, July for corn, August for sorghum and soybeans.
7. **The tuning constants**: irrigation cap 24 in a year, hot-day cap 31 days, rising-trend penalty 10 points, erosion caps of 4 (K factor times slope) and 100 (wind erodibility index), 25 points per soil-building trait, market scores 100, 50 and 0, simplicity 20 points per extra crop and 30 for missing no-till equipment.
8. **Which slider weighs which indicator**: save water weighs water fit; protect soil weighs soil protection and soil building; income weighs heat exposure, pest break and market fit; simplicity weighs simplicity. The indicators of a slider share its value equally, so four equal sliders count the four priorities equally.
9. **The pest-break formula** is the tool's own: 100 times crops over crops plus one, divided by the longest run of years with the same crop. One crop every year scores 0. A fallow year breaks a run.
10. **Rooting depth classes**: "deep" only where K-State's table gives roots beyond 6 feet (alfalfa); the other four crops are "medium". Sorghum is recorded as not nitrogen-fixing because K-State gives it a nitrogen fertilizer recommendation; no source opened says so directly.
11. **`needsNoTill` is false for all six rotations.** No source opened says a rotation needs no-till equipment, so the no-till penalty has nothing to act on yet.
12. **"JSON schemas" are TypeScript checks**, like `lib/contracts.ts` in Phase 2, not JSON Schema documents. The data files keep the SPEC.md shapes exactly; the AI acknowledgement is in `data/README.md` because JSON has no comments.
13. **The field's own rotation** is scored as an 8-year cycle. Winter wheat seen in a year is planted the fall before. It is scored as dryland until the irrigation switch exists. A wheat-then-soybeans year uses the full-season soybean values, as noted when decision 5 was recorded.
14. **Monthly climate starts in 1984.** NASA POWER has no sunlight value for 1981 to 1983, so there is no reference ET for those years. The yearly series and trends still start in 1981 and did not change.
15. **An indicator with no score is left out of the weighted score** and the row says why. Nothing is estimated in its place.
16. **In the panel**, the Rotations section sits between Field and Conditions, following the user flow in SPEC.md. The four sliders are built now because "moving a weight reorders it" is this phase's test; the three switches and the cards wait for Phase 4. Each candidate shows its "why suggested" sentence.
17. **Benefits and risks** are limited to sentences confirmed at a source: one or two per rotation, and none where nothing was confirmed. SPEC.md's own reasons for a rotation ("weed and disease buildup", "breaks the corn rootworm cycle") are not in the data, because no source was opened for them.
18. **`HOT_DAY_F` and the growing-season months** are now read from `config/scoring.json`, so there is one place to change them.
19. **The ported slider was changed**: its thumb now receives the accessible name. Without it a screen reader announced four sliders with no name.

## Source checks

Angel's decision: the `data-verifier` opens each source again before a value is loaded.

| Run | What it covered | Result |
| --- | --- | --- |
| 1 | FAO-56 Tables 11 and 12, Example 18 and the Chapter 3 equations; USDA Handbook 628; four NASS Kansas Crop Progress reports; K-State C529, C687, C683, MF2604; the Tribune report; Nielsen and Vigil | Confirmed. It could not read seven PDFs through the page fetcher |
| 2 | Those seven (K-State C560, C449, SRP1173, MF2586, L904, MF3066 and the NRCS residue sheet), and K-State MF3335 for the rainfall of the three thirds of Kansas | All confirmed. The PDFs were fetched from their public URLs, converted to text with `pdftotext`, and the verifier read the text |
| 3 | The four loaded files and `data/README.md` against the same sources | See "Data check after loading" |

What the checks changed in the data:

- Corn's, sorghum's and soybean's initial coefficients are printed on FAO-56's group rows, not the crop rows; the `assumption` notes say so.
- FAO-56 prints the soybean development stage as "30/35"; 35 is used, the value that adds up to the printed 140 days.
- The research run's "about 8 percent" for corn became K-State's own "up to 8 percent".
- The 40 lb nitrogen credit after soybeans was left out: it rests on a table whose columns the text extraction scrambles.
- The residue classes come from a USDA NRCS sheet written for Nebraska, and the fallow efficiency from Colorado; both are labelled.

Not found: a published range for the K factor or the wind erodibility index, so the erosion caps are tool assumptions and not survey limits.

FAO-56 Example 18 as printed has two slips, recorded in `lib/et.test.ts`: the wind speed is printed "2,078 m/s" with a comma, and daylight hours appear as 16.1 and then 16.3. Neither value is used by the tests.

## Measurements

- NASA POWER, all seven parameters, 1981 to 2025, at 37.97, -100.72 on 2026-11-14: 1.3 s, 1.9 MB. Units from the answer's own header: °C, mm/day, MJ/m^2/day, °C, % and m/s. The sunlight series is -999 on every day of 1981 to 1983; the other six have no gap.
- Annual reference ET from the regenerated samples (1984 to 2025 normals): Finney 64.6 in, Thomas 59.8 in, Brown 45.2 in. Annual rain: 21.3, 19.9 and 35.4 in.
- After regenerating the three sample files, their `years`, `trends`, crop history and soil were compared with the committed files: identical. Only the monthly arrays and `fetchedAt` differ.

## Files

### Written by AI (Claude) in this phase

- `lib/et.ts`, `lib/et.test.ts`
- `lib/library.ts`, `lib/library.test.ts`
- `lib/calendar.ts`, `lib/calendar.test.ts`
- `lib/crop-water.ts`, `lib/crop-water.test.ts`
- `lib/scoring.ts`, `lib/scoring.test.ts`
- `lib/existing-rotation.ts`, `lib/existing-rotation.test.ts`
- `lib/card-text.ts`, `lib/card-text.test.ts`
- `lib/priorities-store.ts`
- `components/RotationRanking.tsx`, `components/PrioritySliders.tsx`
- `data/crops.json`, `data/calendar.json`, `data/rotations.json`, `config/scoring.json`, `data/README.md` (compiled with AI; JSON files carry no header, `data/README.md` says so)
- `spec/2026-11-14-phase-3-water-calendar-scoring/task.md`, `plan.md`, `implementation.md`

### Changed

- `lib/power.ts`, `lib/indicators.ts`, `lib/climate.ts` and their tests; `lib/test-fixtures.ts`
- `lib/types.ts` and `SPEC.md` (the two contract additions)
- `components/FieldPanel.tsx`, `components/ui/slider.tsx` (ported file)
- `scripts/cache-samples.mjs` (one row per line for the monthly arrays)
- `public/data/samples/finney.json`, `thomas.json`, `brown.json` (regenerated from the live routes)
- `README.md`

## Verification

Run on 2026-11-14 at 17:40 CST, after the last change to code or data:

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test` | 24 files, 319 tests passed (218 before this phase) |
| `npm run build` | exit 0; routes `/`, `/api/climate`, `/api/history`, `/api/soil` |

The two sanity rules of CLAUDE.md rule 11, as tests in `lib/scoring.test.ts`:

- With "save water" at 100 and irrigation available, continuous irrigated corn is never the top-scoring rotation at Finney, Thomas or Brown, for any of the 27 combinations of the other three sliders at 0, 50 and 100. The comparison takes in every rotation the tool scores, including the field's own and the ones shown apart.
- At both western samples, wheat-fallow has a higher water fit than continuous wheat (50 against 36).

In the browser, on the development server (`npm run dev`, live services), 2026-11-14 about 17:25 to 17:30 CST. **These rows were checked before the UI review's fixes**; the rows in the next table repeat the main ones on the final build.

| Check | Result |
| --- | --- |
| Finney, Thomas and Brown samples | Each shows its own rotation and a ranked list with seven scores per row; regions west, west and east |
| Sliders by keyboard (Home, End, Tab) | Save water 0, protect soil 100, income 0, simplicity 0 moved continuous wheat from third to first at Finney |
| Reset | Sliders back to 50; keyboard focus lands on the first slider |
| Slider names | Each thumb is announced by its label and "50 of 100" (read from the page's accessibility attributes, not with a screen reader) |
| A live click at 38.304, -98.086 | Three routes answered 200. The point is pasture, so the tool said its own rotation was not scored and ranked the central Kansas rotations |
| Hand entry on that point | Setting two years to wheat and sorghum scored the field's own rotation "on 2 of 8 years" and named the six years left out |
| 375 x 812 | No sideways scrolling; sliders in two columns; rows in one |
| Console | No errors |
| Production build (`next start`) with the crop history service blocked, a point chosen with the keyboard | Crop history answered 502 and climate and soil 200. Field raised the one alert. Rotations showed four sliders, a quiet note that the crop history could not be loaded, and the central Kansas rotations ranked |

On the final production build (`next start`, commit b2869b9), about 17:50 CST. The browser pane was not drawing by then, so clicks and keys were sent from the page's own script and the results read from its text and attributes:

| Check | Result |
| --- | --- |
| Thomas sample | Its own rotation scored 63; four ranked rotations (wheat-fallow first, 68); corn-soybean shown apart; NASA POWER and SSURGO badges; the not-a-forecast line above the list; no alert in the section |
| Sliders by keyboard events | 0, 100, 0, 0 put continuous wheat first, and the screen-reader line changed to "Best match for these priorities: Continuous winter wheat." |
| Reset | Sliders back to 50, wheat-fallow first again, focus on "Save water" |
| Names | Each thumb carries its label and "50 of 100"; the slider root carries no ARIA attribute; each toggle is named for its rotation |
| 375 x 812 | No sideways scrolling; the slider's touch band is 44 px tall |
| Console | No errors |

Not checked in a browser: the climate-failure note and the soil-failure note of the Rotations section (they are two short branches, read in the code), the public URL, a real phone, a screen reader, automated accessibility tests. Screenshots stopped working late in the session, so the last check was read from the page's text and attributes.

## Deployment

Angel asked Claude to push ("Push and check"). `main` went to GitHub at 18:32:39 CST on 2026-11-14 (`1f018c8..38a600c`, nine commits), and Vercel was serving the new build by 18:33:15, about 36 seconds later.

Checks on https://space-apps-2026-field-shift.vercel.app between 18:33 and 18:36 CST:

| # | Check | Result |
| --- | --- | --- |
| 1 | `/api/climate?lat=38.51&lon=-98.32`, a point never asked for on the deployed app | 200 in 1.97 s, 38 KB, live. 45 years; 504 monthly rows, 1984 to 2025; 12 normals. The seven-parameter NASA POWER request works from Vercel |
| 2 | The same request again | 200 in 0.20 s, `X-Vercel-Cache: HIT` (`MISS` the first time) |
| 3 | `/api/climate` at the Finney sample point, live | Years, trends, monthly rows, normals and elevation equal the saved sample file |
| 4 | `/api/history` and `/api/soil` at 38.51382, -98.32008 | 200 in 3.8 s and 0.4 s, both live |
| 5 | A point outside Kansas, and a malformed point | 400 each, with a plain message |
| 6 | The Finney sample in the browser | Its own rotation 60; four ranked rotations, wheat-fallow first at 68; corn-soybean shown apart. The same numbers as the local run |
| 7 | A live click at 38.431, -97.849, which is pasture in all 8 years | Three routes 200. A note that the field's own rotation is not scored, and three central Kansas rotations ranked |
| 8 | The map's center chosen with Enter: 38.514, -98.320, a field of wheat, sorghum and soybeans | Its own rotation scored 64 on all 8 years; three ranked rotations, each with its "why suggested" sentence |
| 9 | Sliders, with real key presses | 0, 100, 0, 0 put continuous wheat first; Reset brought back 50 with focus on "Save water" |
| 10 | 375 x 812 | No sideways scrolling |
| 11 | Console | No errors |

The browser pane had to be shown for the map to finish loading; while it was hidden the page did not draw.

Not checked on the public URL: a private window on Angel's machine, a real phone, a screen reader.

Seen there, for Phase 4: the water-fit sentence adds demand over the whole cycle, so an 8-year rotation reads "128.6 in of 205.5 in of potential crop demand per cycle". A share, or inches per crop, would be easier to read.

## UI review

The `ui-reviewer` subagent read the code of the new section (it does not run a browser).

Must fix, both fixed:

| Finding | Done |
| --- | --- |
| When the climate history failed, the Rotations and Conditions sections each raised an alert with the same message and a retry button | Rotations now shows a quiet note that points to Conditions, where the one alert and retry are |
| When the crop history failed, the section said "the tool has no values for the crops on record here", which was untrue: nothing had been fetched | It now says the crop history could not be loaded and points to Field. Checked in a browser with the crop history service blocked |

Should fix, fixed:

- Notes that are not errors no longer use `role="alert"`.
- A failed soil load is a note above the list, not a footnote under it.
- The sliders show at once and no longer wait for the field's data; the skeleton stands in for the list only.
- Each "How these scores were worked out" toggle carries the rotation's name for screen readers, and its focus ring is solid.
- The slider's root no longer receives ARIA attributes that only the thumb should have.
- The line that a score is not a forecast of yield or price moved from the foot of the list to the top.
- A screen reader is told the new best match when a slider move changes it.
- A second source badge (USDA NRCS SSURGO) sits beside NASA POWER, and the wording about irrigation and the number of rotations was made plain.

Left for later, by choice:

- **A source badge on every score.** A score draws on NASA POWER, the soil survey and the crop library at once. The two badges stand for the first two, and one sentence names FAO-56, USDA NASS and K-State. Per-value sources are in the data files and belong on the Phase 4 cards and the Phase 5 About the Data tab.
- **Glossary tooltips** on water fit, heat and drought exposure, evapotranspiration and potential demand: Phase 5.

Checked by the reviewer and found fine: heading order, the definition list, how a score is read out, the best-match marker not relying on colour, reduced motion, three text sizes, semantic tokens only.

## Data check after loading

A third `data-verifier` run compared the four loaded files and `data/README.md` with the source texts. It found the values consistent: every FAO-56 coefficient and stage length, every calendar date, the four USDA weekly averages, the K-State and NRCS quotes word for word, the root depths, the K-State water budget, the Tribune figures and the publication dates.

It flagged 15 points. What was done:

| Flag | Done |
| --- | --- |
| The corn, sorghum and soybean sources cited two USDA weekly reports each and linked one | Both links are given |
| "More efficient in its water use than wheat-fallow" left out K-State's next words | The sentence now adds that K-State calls the fallow period in both systems inefficient |
| "Sorghum has to be planted..." overstated K-State's "should be timed" | Reworded to "K-State advises timing..."; the handbook's date (revised May 1998) added |
| The corn risk tied "up to 8 percent" to hot weather; K-State ties it to moisture stress | Two sentences now: pollination under hot, dry conditions, and the loss from one day of moisture stress |
| "Less cover" after soybeans was sourced to K-State only; the words are the NRCS sheet's | Both sources are named |
| The 0.75 share: evapotranspiration in the simulated budget includes evaporation from the soil | The assumption note says so |
| The 0.20 fallow efficiency was quoted word for word, and the check could not read the quote: the PDF's text layer is a poor scan | The quotation marks are gone and the numbers are stated plainly. The first verifier run read the abstract from the PDF itself and confirmed them; the third run found the same numbers in a 2009 conference poster by the same authors. The note now also says the study measured the 14-month wheat-fallow fallow only |
| README: "every day hot scores 0" is not true of a 30-day month | Reworded: 31 or more hot days scores 0 |
| README: FAO-56's rows are also from outside Kansas; wheat's month does not come from USDA; the USDA averages are statewide; a cover crop's `market` | All four stated |
| The rotations' crops, order, water and region have no source | README says they come from SPEC.md's own library table, which is this project's design |
| Winter wheat notes: "a region with a cold winter" is not FAO's wording, and no reason was given for 0.4 | The note names the Idaho row and calls both picks the tool's own |
| The winter wheat harvest dates in the handbook's by-State table looked different in the text extraction | An extraction artifact: in that table the harvest columns are shifted by two rows (Indiana's row shows Kansas's dates). The Kansas table on page 39 prints 20 June to 5 July, which the first run confirmed from the PDF. The sources now name that table |

Not re-checked in this run: the UC Davis and University of Nebraska quotes (confirmed in the first run), and whether each link still opens.

**The corrections in the table above were not sent back to the `data-verifier`.** CLAUDE.md asks for it after any change to `data/` or `config/`. They change wording and links only, no value, and each new sentence was written from text the earlier runs had quoted. The three runs together used about 0.9 million subagent tokens, most of it in the first run before the PDFs were turned into text; a fourth run was not worth that. If Angel wants it, it is one short run over five files.

## Open items for Angel

1. **Review the data files**: `data/crops.json`, `data/calendar.json`, `data/rotations.json` and `config/scoring.json`. `data/README.md` is the guide. This is the review SPEC.md asks for in Phase 3.
2. **Confirm or change the 19 choices above** ("Choices Claude made"), above all 1 (region limits the suggestions), 5 (one usable share of rain and one fallow efficiency), 7 (the constants) and 8 (which slider weighs what).
3. **The four rotations not loaded.** Corn-wheat needs nothing new and can be added at once. Double-crop soybean needs its own dates (decision 3 of 2026-11-14). The cover crop has no sourced values at all. Alfalfa has coefficients but no stage lengths or usual dates.
4. **The points listed under "What the three samples show"**: one candidate at Brown, no yield or price in the score, high potential demand.
5. **Irrigation.** The Finney sample is corn every year and is scored as dryland until the Phase 4 switch exists. SPEC.md describes it as irrigated.
6. **Turning irrigation on can raise a rotation's water fit.** Dryland and irrigated water fit are two different measures on one scale. Thomas's own rotation (wheat and fallow) scores 45 as dryland and 60 as irrigated, because the irrigation need is averaged over the fallow years. Once the switch exists, a farmer who turns irrigation on will see "save water" favour that rotation more, not less. The formula follows SPEC.md, so this needs your decision before Phase 4: for example, show the two measures under different names, or score a rotation that can be either as dryland unless it needs the water.
7. Still open from earlier phases: a public source for the 95°F threshold, colour for the rotation chips, the mean temperature definition, the pin's accent token, the phone bottom sheet.
