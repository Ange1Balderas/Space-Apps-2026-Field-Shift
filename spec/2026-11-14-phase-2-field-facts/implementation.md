# Phase 2: Field facts. Implementation

Date: 2026-11-14.

**Status: NOT FINISHED.** The session building this phase reached its usage limit and stopped part-way. The code below is committed and its unit tests pass, but the phase's checks, reviews and write-up are not done. Nothing was pushed. Do not treat Phase 2 as complete until the "Left to do" list is finished.

## Done and committed

| Piece | State |
| --- | --- |
| `/api/history`: newest 8 years of Cropland Data Layer classes at a point | Built, unit-tested, and called live in a production run (0.42 s; repeat 0.004 s) |
| `/api/soil`: SSURGO map unit, texture, available water, organic matter, K factor, wind erodibility index, slope, hydrologic group | Built, unit-tested, and called live in a production run (0.32 s) |
| `lib/api-route.ts`, `lib/upstream.ts`: the checks, 15-second timeout, cache, clear errors, sample fallback and mock mode shared by all three routes | Built; `/api/climate` now uses them and its Phase 1 tests still pass |
| `lib/cdl.ts`: CDL code to class name | Generated from USDA's own class table, 134 classes |
| Three sample fields (Finney, Thomas, Brown) in `lib/samples.ts`, cached in `public/data/samples/` by `scripts/cache-samples.mjs` | Built. Each file holds climate, crop history and soil from the real routes |
| Field summary in the panel: 8 rotation chips the farmer can change, soil facts, source badges; Conditions section for the chart | Built. Seen working in a production run at desktop width only |
| Freeze dates in the climate answer, with trends; monthly climatology functions in `lib/indicators.ts` | Built and unit-tested. Sample files re-saved with freeze dates |

Last full run of the checks, on the tree of the commit "Phase 2: re-save the three sample fields with freeze dates": `npm run typecheck` and `npm run lint` passed, and `npm run test` reported 17 files and 218 tests passed. `npm run build` passed on the commit before it. The output was not saved verbatim, so run all four again before relying on this.

## Deviations found so far, for Angel

1. **Crop history does not use CropScape.** SPEC.md names CropScape's `GetCDLValue` (one request per year, Albers coordinates). On 2026-11-14 it took 27 s for one request, answered seven of nine parallel requests, hung on 2025 for 60 s, and then stopped answering for several minutes, which may have been throttling after that burst. The route uses USDA's CDL image service instead (`https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer`), one `identify` request that returns every year in about 0.5 s. USDA's own CDL viewer, CroplandCROS, draws this same service. At the one point compared (38.0498, -100.74) both gave the same class for 2018 to 2024. So "fetched in parallel" and "converted to EPSG:5070" no longer apply, and `proj4` is unused. There is no second live source: if this service fails, the farmer fills the years in by hand, which is SPEC.md's own fallback.
2. **Monthly arrays stay empty.** `monthlyByYear` and `monthlyNormals` rows need `et0In`, which is not nullable and arrives in Phase 3. The monthly rain and temperature functions exist and are tested.
3. **Sample fields are proposals.** The rule is in `lib/samples.ts`. Finney is corn in all 8 years, Thomas alternates winter wheat and fallow (sorghum in 2025), Brown alternates corn and soybeans. Fallow counts as cropland. The Cropland Data Layer does not show irrigation, so the Finney sample is not labelled irrigated. The Phase 1 Finney point was replaced.
4. **Rotation chips are not coloured.** SPEC.md says "colored chips"; the design rules allow one accent colour. They are neutral chips with the crop name.
5. **History and soil requests keep five decimal places** (about 1 m), not the two used for climate, because a crop pixel is 30 m across.
6. **Normal mode.** SPEC.md suggests a workflow for this phase; it was built in one session because the plan allowance is tight.
7. **`scripts/cache-samples.mjs`** is a Node script, added to regenerate the sample files. SPEC.md's `scripts/` folder lists Python scripts only.

## Left to do

1. **Confirm one NASA GIBS vegetation tile loads in Web Mercator, and record the layer name.** Not started.
2. **Production-run checks.** Only these were seen: the three samples load in about 0.1 s each, a live map click makes all three requests (200), editing a crop marks it and the reset button restores it. Not checked: the build made after freeze dates were added, one service down (so that crop history, soil and climate fail on their own), the hand-entry fallback when crop history fails, a bad point through the UI, phone width (390 px), keyboard use of the chips, mock mode with the new routes.
3. **Run the `ui-reviewer` and `data-verifier` subagents** and fix what they find. Not run for this phase. Facts that still need a source check: the SSURGO column labels and units (read from Soil Data Access's `sdvattribute` table, recorded in `lib/soil.ts`), the 32°F freeze definition (NWS glossary link in `lib/indicators.ts`), and the three source badge links.
4. **Run `typecheck`, `lint`, `test`, `build`** and record the real output here.
5. **Write this file properly** and update the README (status, data sources, the new routes, AI use).
6. **Tell Angel what to check on the public URL after pushing.** A live click comes first: USDA's servers may treat Vercel's addresses differently from this machine, and that is the only test of it. Also check that the deployed climate answer carries freeze dates.
7. **Open items carried from Phase 1** are unchanged (see that phase's `implementation.md`).
