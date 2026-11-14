# Phase 3: Water, calendar and scoring. Task

Date: 2026-11-14. Source: SPEC.md, "Build phases for Fable" > "Phase 3: Water, calendar and scoring", with the formulas in "Contracts and formulas" and the decisions in "Decisions made on 2026-11-14, after Phase 2".

## Problem

The field panel shows what a field grows, its soil and how hot its summers have been. It does not yet compare rotations. This phase adds the numbers a comparison needs: how much water a crop would use at this field, when the ground is covered and when it is bare, and a score for each rotation that the farmer's own priorities can re-order.

## Acceptance criteria (copied from SPEC.md)

- [ ] `lib/et.ts`: FAO-56 Penman-Monteith reference ET from POWER daily data, unit-tested against the FAO-56 daily worked example; the climate route then returns monthly ET
- [ ] JSON schemas for `crops.json`, `rotations.json` and `calendar.json`, with a `source` field on every published value
- [ ] Load the values compiled by the research run, each with its source link; Angel reviews and approves them
- [ ] Multi-year calendar per rotation: crop months and bare months across every year of the cycle
- [ ] `lib/scoring.ts`: seven indicators, weighted score, card field templates
- [ ] Sanity tests: with "save water" at maximum, continuous irrigated corn never ranks first; on a dry western field, wheat-fallow beats continuous wheat on water fit
- [ ] Start with six rotations (the four dryland wheat rotations, continuous corn, corn-soybean); add double-crop, cover crop and alfalfa once those pass

Done when: every sample field produces a ranked list with a visible breakdown, moving a weight reorders it, and the sanity tests pass.

## Formulas this phase implements (SPEC.md, "Formulas", items 1 to 10)

1. Reference ET: FAO-56 Penman-Monteith, daily, from POWER `T2M_MAX`, `T2M_MIN`, `WS2M`, `ALLSKY_SFC_SW_DWN` and the point's elevation; vapour pressure from dewpoint (`T2MDEW`), with `RH2M` as the fallback.
2. Crop water demand: monthly reference ET times the month's average crop coefficient from the FAO-56 curve; the 10-year average. It is potential demand, and the card says so.
3. Water fit: effective rain in the crop's season plus stored moisture at planting (rain in the bare period before planting times a fallow efficiency, capped at the soil's available water). Dryland: 100 times (1 minus the shortfall as a share of demand), averaged over crop years. Irrigated: falls as irrigation need rises, against a cap in config.
4. Heat and drought exposure: average hot days in each crop's sensitive window over the last 10 years against a cap; a likely rising trend lowers the score by a configured penalty.
5. Soil protection: bare share of the cycle times erosion risk (the higher of water risk and wind risk).
6. Soil building: points for a nitrogen-fixing crop, high residue, a cover crop and a deep-rooted crop, capped at 100.
7. Pest and disease break: rises with the number of distinct crops, falls with the longest run of the same crop.
8. Market fit: local elevator highest, regional buyer middle, contract-only lowest.
9. Simplicity: falls with each extra crop, and further when the rotation needs no-till equipment the farmer does not have.
10. Field calendar and bare months: each crop's usual planting-to-harvest window on a month grid covering every year of the cycle.

## Decisions that bind this phase (Angel, 2026-11-14)

- `CropId` is six ids; fallow has no id.
- Researched values: the `data-verifier` opens each source again before a value is loaded; a value the research marked as an inference is not loaded as a fact; Angel then reviews the data files.
- A field's own years map to `CropId` by Cropland Data Layer class code; a year with an unmapped class is named and left out of the score ("scored on N of 8 years").
- Growing season is April to September, a tool assumption in `config/scoring.json`.

## Rules that apply (CLAUDE.md)

- Rule 1, data first: a published value carries its source; a constant the tool chose is a tool assumption in `config/scoring.json`; nothing is guessed.
- Rule 11, scoring sanity: both sanity checks stay as tests.
- Rule 5: metric inside the calculations, inches and °F in what is shown.
