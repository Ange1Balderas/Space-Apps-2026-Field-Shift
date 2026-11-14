# Phase 3: Water, calendar and scoring. Plan

Date: 2026-11-14. Normal mode, one session, as SPEC.md asks for this phase. Each slice is committed on its own.

## Before any value is loaded

1. Run the `data-verifier` on every source this phase will load from, by value: the FAO-56 tables and worked example, the USDA dates, the K-State stage, nitrogen, residue and root-depth statements, the fallow and water-budget figures. It runs in the background while slice A is built.
2. Nothing goes into `data/` or `config/` until its line in that report says "confirmed". A value it could not open stays `null`.

## Slice A: reference ET and monthly climate

1. Probe NASA POWER once with all seven parameters: units, and which years have gaps.
2. `lib/et.ts`: the FAO-56 Penman-Monteith steps as small functions, and one function for a day's reference ET.
3. Tests from the FAO-56 daily worked example (Chapter 4, Example 18), using the numbers the verifier reads from the page, plus one check of vapour pressure from dewpoint.
4. `lib/power.ts` asks for the four extra parameters. The yearly completeness rule keeps using only temperature and rain, so the deployed yearly series and trends do not change.
5. `lib/indicators.ts` and `lib/climate.ts`: monthly rain, reference ET and hot days per year, and monthly normals, in the `ClimateResponse` shape.
6. Regenerate the three sample files from the running app and compare `years` and `trends` with the committed files: they must be the same.
7. Typecheck, lint, tests. Commit.

## Contract question for Angel (after slice A)

The formulas need constants that `ScoringConfig` has no fields for, and many crop values are the tool's pick among published numbers. One question, with the exact change, before `lib/types.ts` is touched.

## Slice B: data files

1. `data/crops.json`, `data/calendar.json`, `data/rotations.json` (six rotations) and `config/scoring.json`, in the SPEC.md shapes.
2. `lib/library.ts`: loads them and checks their shape, including that every published value has a source. Tests run those checks on the real files.
3. `data/README.md`: what each file holds, where its values come from, and that it was compiled with AI.

## Slice C: calendar, water and scoring

1. `lib/calendar.ts`: a rotation as a month grid over the whole cycle; crop months and bare months.
2. `lib/crop-water.ts`: the crop coefficient curve by month, and potential demand from monthly reference ET.
3. `lib/scoring.ts`: the seven indicators, the weighted score, the ranking, the field's own rotation from its detected years, and the card text templates.
4. Tests for each formula on small hand-worked cases, and the two sanity checks of rule 11 as a sweep over the three sample fields and the slider range.

## Slice D: the ranked list in the panel

1. A Rotations section: the field's own rotation and the library rotations, each with its score and the seven indicator scores.
2. Four priority sliders that re-order the list.
3. Loading, empty and error states; 390 px; keyboard.

## Finish

1. Typecheck, lint, tests, build; show the output.
2. Browser check on the three sample fields and one live click.
3. `ui-reviewer`, and the `data-verifier` again on the loaded files.
4. `implementation.md`, README. Commit. Do not push. Stop for Angel's review.

## Left for later phases

- The four rotations beyond the first six (corn-wheat, double-crop soybean, cover crop, alfalfa).
- Rotation cards, the toggles and the calendar strip (Phase 4).
- The yearly trend of crop water demand (Phase 4, with the cards).
