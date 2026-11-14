# Phase 2: Field facts. Implementation

Date: 2026-11-14.

**Status: deployed, and checked on the public URL.** Angel asked Claude to push `main`. It was pushed at about 16:14 CST on 2026-11-14 and Vercel published it. Between 16:15 and 16:17 CST the checks under "Deployment" passed on https://space-apps-2026-field-shift.vercel.app, and both USDA services answer Vercel's servers.

The phase's "done when" is met on the public URL: each of the three sample fields shows its 8-year rotation and its soil in about 0.1 to 0.2 seconds, and a bad point gets a clean error (400 from each route, and a notice in the panel). The checks were made in Claude's own browser, with the phone check at an emulated 390 x 844 size. A real phone has not been tried.

The build was interrupted once by a usage limit and finished after it reset. An earlier version of this file said "not finished"; this version replaces it.

## What was built

- `GET /api/history?lat=&lon=`: the newest 8 years of Cropland Data Layer classes at a point, in the `HistoryResponse` shape.
- `GET /api/soil?lat=&lon=`: the SSURGO map unit under a point with its texture, available water, organic matter, K factor, wind erodibility index, slope and hydrologic group, in the `SoilResponse` shape.
- One shared way to run a data route (`lib/api-route.ts`, `lib/upstream.ts`): point checks, 15-second timeout, memory cache, CDN header, plain errors, sample fallback, mock mode. `/api/climate` now uses it too.
- The Field section of the panel: 8 rotation chips the farmer can change, and the soil facts, each with a source badge. The chart moved into its own Conditions section.
- Freeze dates in the climate answer (last spring freeze, first fall freeze) with their trends, and monthly climatology functions in `lib/indicators.ts`.
- Three sample fields, cached from the real routes: Finney, Thomas and Brown counties.
- `lib/types.ts` is unchanged.

## The three sample fields

They were proposals when the phase ended. Angel confirmed all three on 2026-11-14 (see "Decisions after the review"). The rule they were chosen by is in `lib/samples.ts`.

| | Finney County | Thomas County | Brown County |
| --- | --- | --- | --- |
| Point | 37.96548, -100.72299 | 39.43677, -101.1914 | 39.84979, -95.47566 |
| Crops, 2018 to 2025 | Corn in all 8 years | Winter wheat and fallow in turn, then sorghum in 2025 | Corn and soybeans in turn |
| Soil map unit | Ulysses silt loam, 1 to 3 percent slopes | Keith silt loam, 0 to 1 percent slopes | Aksarben silty clay loam, 6 to 11 percent slopes |
| Available water, top 39 in | 8.81 in | 8.22 in | 6.2 in |
| Slope | 2% | 1% | 7.7% |
| Hot days a year, average | 41 | 31 | 15 |
| Hot days trend | No clear trend (+1.4 per decade, p = 0.25) | Possible trend (+2.0 per decade, p = 0.12) | No clear trend (+0.5 per decade, p = 0.54) |
| First fall freeze trend | Likely: 3.3 days later per decade (p = 0.02) | Likely: 3.3 days later per decade (p = 0.03) | Likely: 4.3 days later per decade (p = 0.001) |
| Last spring freeze trend | No clear trend | No clear trend | No clear trend |

How each point was picked: a 6 by 6 grid inside the county's bounding box was sent to the crop history service, three requests at a time. A point qualified when each of its 8 years was a crop from SPEC.md's rotation library, one of their double crops, or fallow. Fallow counts as cropland here: its class is named "Fallow/Idle Cropland", and fallow years are part of the library's wheat rotations. Finney had 22 qualifying points of 36, Thomas 11 and Brown 17. The one that best fit SPEC.md's description of the county was taken, then moved up to 260 m until the four points 60 m around it showed the same 8 years, so it sits inside a field. The Cropland Data Layer does not show irrigation, so the Finney sample is not labelled irrigated, although SPEC.md describes it that way.

The freeze trends are computed and cached but not shown in the panel yet; their charts are Phase 4 work.

## Deviations for Angel to review

1. **Crop history does not use CropScape.** SPEC.md names CropScape's `GetCDLValue`, one request per year in Albers coordinates. Measured on 2026-11-14 and not repeated: the first request took 27 s; of nine parallel requests, seven answered in 0.4 to 3.1 s, the one for 2026 was refused ("The year must be between 1997 and 2025"), and the one for 2025 had not answered after 60 s; the next seven single requests all timed out at 20 to 25 s. That last part may have been throttling after the burst of nine. The route uses USDA's CDL image service instead, `https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer`: one `identify` request returns every year at the point in about 0.5 s. It is the layer behind USDA's own CroplandCROS viewer, whose web map lists it by that URL. At the one point where both were compared (38.0498, -100.74) they gave the same class for 2018 to 2024. So "fetched in parallel" and "converted to EPSG:5070" in the acceptance criteria no longer apply, and `proj4` is installed but unused. There is no second live source: if the service fails, the farmer fills the years in by hand, which is SPEC.md's own fallback for CropScape trouble. SPEC.md itself was not edited.
2. **The monthly arrays stay empty.** Every row of `monthlyByYear` and `monthlyNormals` needs `et0In`, which is not nullable and arrives with reference ET in Phase 3. The monthly rain, hot-day and temperature functions exist in `lib/indicators.ts` and are tested, so "monthly climatology added to the indicators" is met in the library but not in the API answer.
3. **Rotation chips are not coloured.** SPEC.md's user flow says "colored chips"; its UI rules allow one accent colour and status colours only for trends. The chips are neutral with the crop name. If you want colour, the Cropland Data Layer publishes a colour per class.
4. **Six class names are shortened on the chips**, for example "Fallow" for "Fallow/Idle Cropland" and "Wheat then soybeans" for "Dbl Crop WinWht/Soybeans". The list is in `lib/rotation-edit.ts`; USDA's names are in `lib/cdl.ts` and in the API answer.
5. **What the farmer can choose** when changing a year: corn, sorghum, soybeans, winter wheat, alfalfa, wheat then soybeans, fallow, grass or pasture, plus whatever was detected. A changed year is stored as a Cropland Data Layer class code.
6. **Hand entry when the crop history fails** offers the 8 years before the current one, taken from the clock.
7. **Soil shows facts, not an "erosion risk".** SPEC.md's user flow mentions erosion risk; the panel shows the K factor, the wind erodibility index and the slope. The combined risk is the soil protection indicator in Phase 3.
8. **Crop history and soil requests keep five decimal places** (about 1 m). Climate keeps two. A crop pixel is 30 m across, so the Phase 1 rounding would have moved the point up to 500 m.
9. **Normal mode.** SPEC.md suggests a workflow for this phase; it was built in one session because the plan allowance is tight.
10. **`scripts/cache-samples.mjs`** is a Node script, added to regenerate the sample files from the running app. SPEC.md's `scripts/` folder lists Python scripts only. It refuses to save an answer that is not live.
11. **The Phase 1 Finney sample point was replaced.** It turned out to be dryland wheat, sorghum and fallow, converted from grass in 2016.
12. **Additions beyond SPEC.md:** the "Back to detected crops" and "Clear my entries" buttons, the "Yours" mark on a changed year, and the visible mark on the chosen sample button.

## Measurements

| What | Result |
| --- | --- |
| CDL image service, `identify` at one point, all years | 0.46 s |
| Soil Data Access, the soil query | 0.41 s, 0.32 s |
| `/api/history` in a production run | 0.42 s live, 0.004 s repeat |
| `/api/soil` in a production run | 0.32 s live, 0.003 s repeat |
| `/api/climate` in a production run, with freeze dates | 0.87 s live |
| A sample field, from click to rotation, soil and chart on screen | 34 to 94 ms |

Soil Data Access answers `{}` where no survey covers the point and HTTP 400 with XML for a bad query. Both are handled and tested.

## NASA GIBS vegetation tile

Confirmed for the stretch map layer. Nothing in the app uses it yet.

| Item | Value |
| --- | --- |
| Layer | `MODIS_Terra_L3_NDVI_16Day`, titled "Vegetation Index (16-Day, MODIS, Terra)" |
| Projection | Web Mercator, through the `epsg3857` endpoint, tile matrix set `GoogleMapsCompatible_Level9` |
| Format | `image/png` |
| Tile URL | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_16Day/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png` |
| Dates | Every 16 days from 2000-03-05; the default on 2026-11-14 was 2026-10-16 |
| Checked | Tiles `6/24/14` and `7/49/28` (central Kansas) for 2026-10-16 and 2026-07-12: each HTTP 200, `image/png`, 256 x 256, about 50 KB, in about 0.5 s. The July tile was looked at and shows green vegetation, sparser to the west |

`MODIS_Terra_NDVI_8Day` (rolling 8 days) is also offered in Web Mercator.

## Files

### Written by AI (Claude) in this phase

| File | Purpose |
| --- | --- |
| `app/api/history/route.ts`, `app/api/soil/route.ts` | The two new routes |
| `app/api/climate/route.ts` | Changed: now built on the shared route helper |
| `lib/api-route.ts`, `lib/upstream.ts` | Shared route behaviour; fetch with a timeout and plain errors |
| `lib/cropland.ts` | The crop history request and its parsing |
| `lib/cdl.ts` | Class codes and names, generated from USDA's class table |
| `lib/soil.ts` | The soil query, its parsing, and what each column means |
| `lib/contracts.ts` | Shape checks for `HistoryResponse` and `SoilResponse` |
| `lib/rotation-edit.ts` | The rotation as shown: detected crops with the farmer's changes over them |
| `lib/field-client.ts` | Browser-side loading of the three facts (renamed from `lib/climate-client.ts`) |
| `lib/field-store.ts`, `lib/samples.ts`, `lib/sample-data.ts`, `lib/indicators.ts`, `lib/climate.ts`, `lib/power.ts`, `lib/kansas.ts`, `lib/units.ts` | Changed |
| `components/FieldSummary.tsx` | Rotation chips and soil facts |
| `components/FieldPanel.tsx`, `components/MapView.tsx`, `components/SourceBadge.tsx` | Changed |
| `public/data/samples/finney.json`, `thomas.json`, `brown.json` | Cached route answers (data, produced by the routes) |
| `scripts/cache-samples.mjs` | Regenerates the sample files |
| `lib/*.test.ts`, `app/api/*/route.test.ts` | 218 unit tests in 17 files |
| `README.md`, `spec/2026-11-14-phase-2-field-facts/*.md` | Docs |

No ported design-layer file was changed in this phase.

## Verification

Run on Windows with Node 26.13.0 and npm 11.20.0, at 16:02 on 2026-11-14, on the tree of the commit "Phase 2: tighten three source comments after the data check", which is the last commit that touches code. Each exited 0. Output is verbatim, except that the local folder path is removed from the Vitest `RUN` line.

`npm run typecheck`

```text
> field-shift@0.1.0 typecheck
> next typegen && tsc --noEmit

Generating route types...
✓ Types generated successfully
```

`npm run lint`

```text
> field-shift@0.1.0 lint
> eslint
```

ESLint printed nothing after its banner, which means no findings.

`npm run test`

```text
> field-shift@0.1.0 test
> vitest run


 RUN  v5.1.0


 Test Files  17 passed (17)
      Tests  218 passed (218)
   Start at  16:02:51
   Duration  640ms (import 41%, tests 30%, transform 20%, worker 9%)
```

`npm run build`

```text
> field-shift@0.1.0 build
> next build

▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 34ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 1557ms
  Running TypeScript ...
  Finished TypeScript in 2.6s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/6) ...
  Generating static pages using 7 workers (1/6) 
  Generating static pages using 7 workers (2/6) 
  Generating static pages using 7 workers (4/6) 
✓ Generating static pages using 7 workers (6/6) in 603ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/climate
├ ƒ /api/history
└ ƒ /api/soil


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Checks beyond the four commands, in a browser against a production run (`npm run build`, then `next start`) unless a row says otherwise.

Which build each check ran on: build A is the code with freeze dates and the re-saved samples, before the chip and review fixes. Build B adds those fixes and is the last build with a change to code that runs. "Final" is the build of the last code commit, which differs from build B in comments only; the two checks behind the phase's "done when" were repeated on it.

| Check | Build | How | Result |
| --- | --- | --- | --- |
| Each sample under 5 seconds | A, final | Clicked each sample button and timed until the rotation, the soil and the chart were all on screen | Final: Finney 79 ms, Thomas 37 ms, Brown 34 ms. Build A: 94, 62 and 49 ms |
| Live map click | final | Clicked a point in central Kansas (38.374°N, 98.945°W) once the map had loaded | Three requests, each 200: climate at two decimals, history and soil at five. Eight years of crops, the soil map unit and the chart shown, with no error notice |
| Routes live | A | `curl` | History and soil answers as in "Measurements". The live climate answer has freeze dates for all 45 years and empty monthly arrays |
| A bad point | A | `curl` with `lat=north`, with no longitude, and with points south and west of Kansas, on both new routes | 400 each time, in about 3 ms, with a plain message |
| A point with no soil facts | A, final | `curl` at a reservoir (37.76, -97.84) on build A. On the final build a debugging-only script in the page pointed the soil request at that point | Route: map unit "Water" with every fact null, and "Open Water" in all 8 years of crop history. Panel: "Water", with "Not available" for all seven facts |
| Soil service down, the others up | A | Started the server so that only Soil Data Access was unreachable, then clicked the map | Crops and chart shown; the soil block says "Soil data unavailable" with "Try again". The route answers 502, and 200 with the cached copy at a sample field |
| Crop history service down, the others up | A, final | Same, with only the CDL service unreachable | Error notice with "Try again", 8 empty chips for 2018 to 2025, and the note "these years are yours to fill in". Soil and chart shown |
| Filling the years in by hand | final | On that server, chose a crop for 2025, then pressed "Clear my entries" with the keyboard | The chip shows the chosen name with "Yours" and a dashed border. After clearing, all 8 chips are empty again and focus is on the panel |
| Saved-copy note | final | On that server, a debugging-only script pointed the crop history request at the Finney sample point, where the route falls back to its cached copy | The note "The crop history could not be fetched just now. Showing the copy saved for this sample field." It is not an alert. The toast "Live data unavailable, showing cached data" appeared |
| Click outside Kansas | final | Clicked north of the state line | "That spot is outside Kansas" notice with the three sample buttons and no pin. Pressing "Brown County" in the notice loaded that sample and moved focus to the panel |
| Changing a crop | first, B | Changed a year by script on the first build that had the Field summary (before freeze dates were added), and with the arrow keys on build B | The chip says "Yours" with a dashed border, the caption counts the changed years, and "Back to detected crops" restores them |
| Chip names | B | Screenshot at desktop width | Names wrap ("Winter Wheat", "Wheat then soybeans") instead of being cut off |
| Keyboard | B | Tab from the source badge, arrow down, then Enter on "Back to detected crops" | The chip takes focus with a solid 2 px outline; the arrow key changes the crop; after the reset, focus is on the panel, not the page body |
| The chosen sample is marked | B | Read the button's style | Darker background and border, and `aria-current` |
| Headings and landmarks | A, B | Read from the page | h1; h2 Field with h3 Crops grown here and h3 Soil; h2 Conditions with h3 Hot days each year. Two regions (Field, Conditions), two groups inside Field |
| Phone width | B | Viewport 390 x 844 | No sideways scroll. Chips and soil facts in two columns. Sample buttons are 40 px tall and clear of the zoom control |
| Mock mode | B (dev server) | `npm run dev:mock` | Header badge shown. A sample loads all three facts. A map click gets 404 from all three routes with the mock-mode message |
| Sample files agree with the code | n/a | Unit tests | Each file matches the sample list, passes the three shape checks, has 8 library crops named as USDA names them, and has a hot-day trend equal to what the trend maths gives |

Not verified by these local checks: the public URL and whether USDA's services answer Vercel's servers (both checked later, see "Deployment"), any real phone, a screen reader, automated accessibility tests (Playwright and axe are not set up), and the soil-down panel after build A.

One thing these checks do not cover, carried over from Phase 0: if the map itself never finishes loading, its placeholder stays up with no message. The sample buttons still work in that case.

## Deployment

Angel asked Claude to push. `main` was pushed at about 16:14 CST on 2026-11-14; GitHub's `main` and the local `main` then pointed at the same commit, "Phase 2: record the last browser checks on the final build", and Vercel published it within about a minute.

Checked on https://space-apps-2026-field-shift.vercel.app between 16:15 and 16:17 CST:

| # | Check | Result |
| --- | --- | --- |
| 1 | Clicked a spot in Kansas that is not a sample field (38.327°N, 98.983°W) | Three requests, each 200. Eight years of crops (winter wheat, alfalfa, sorghum), the soil map unit "Harney silt loam, 1 to 3 percent slopes" with its seven facts, and the chart, with no error notice. So both USDA services answer Vercel's servers |
| 2 | The routes, by `curl` | `/api/history`: 200 in 0.64 s, then served by the CDN (`X-Vercel-Cache: HIT`). `/api/soil`: 200 in 0.48 s (`MISS`), then 0.23 s (`HIT`). `/api/climate?lat=37.97&lon=-100.72`: 200 in 1.21 s with 45 years; its first year has `lastSpringFreezeDoy` 130 and `firstFallFreezeDoy` 295, so the published answer carries freeze dates. The monthly arrays are empty |
| 3 | Clicked each sample button | Finney 156 ms, Thomas 101 ms, Brown 100 ms until the rotation, soil and chart were on screen, with the crops and soils in the table above. The live crop history and soil answers at each sample point, fetched from the public URL, equal the saved sample files |
| 4 | Changed one year's crop (Brown County, 2019, to sorghum) | "Yours" on the chip and "1 of 8 years changed by you" in the caption. "Back to detected crops" restored it |
| 5 | Clicked outside Kansas | "That spot is outside Kansas" notice with the three sample buttons, and no pin. The routes answer 400 for a point that is not a number or is outside the state |
| 6 | Phone width, emulated at 390 x 844 | No sideways scroll. Chips in two columns. Sample buttons 40 px tall. The top of the panel is in view under the map right after a tap |
| | A reservoir point, by `curl` | Soil map unit "Water" with every fact null |
| | Browser console | No messages |

Still not tried: a real phone, a private window on Angel's own machine, and a screen reader.

If a live click ever fails while the samples work, the failing block will say which service it was, and the Vercel function log will show a line starting `[api/history]`, `[api/soil]` or `[api/climate]`.

This section was written after the push, so its commit is ahead of GitHub until the next push.

## UI review

The `ui-reviewer` subagent reviewed the UI from the code (no browser).

| # | Finding | Level | What was done |
| --- | --- | --- | --- |
| 1 | "Back to detected crops" disappears when pressed, so keyboard focus dropped to the page top | Must fix | Fixed: focus moves to the panel first |
| 2 | The chosen sample was marked only for screen readers | Should fix | Fixed: darker background and border |
| 3 | Saved-copy notices were alerts, and several could speak at once | Should fix | Fixed: one quiet note, not an alert |
| 4 | Soil placeholder had 6 cells for 7 facts | Should fix | Fixed |
| 5 | Chip placeholder had a fixed height, chips could grow | Should fix | Fixed: both share a minimum height |
| 6 | Keyboard focus on a chip was a faint ring that disappears in forced-colours mode | Should fix | Fixed: a solid outline |
| 7 | Small touch targets on phones | Should fix | Partly: sample buttons are 40 px on phones and the reset button 32 px. Source badges stay at 24 px, the WCAG 2.2 minimum |
| 8 | A changed chip lost its chevron | Polish | Fixed |
| 9 | The fieldset over the map blocked clicks in its gaps | Polish | Fixed |
| 10 | The two halves of the Field section were extra landmarks | Polish | Fixed: they are groups |
| 11 | Hand-filled years could not be cleared | Polish | Fixed: "Clear my entries" |
| 12 | A long map unit name could overflow | Polish | Fixed |
| 13 | The current year is read during render | Polish | Not changed. The component is client-only |

Before the review, one flaw was found by eye and fixed: long crop names were cut off inside the chips.

## Data check

The `data-verifier` subagent checked the sources it was given. Soil Data Access only answers POST requests, which it cannot send, so for the soil columns it read a saved copy of that service's own answers.

Verified: the label and unit of each SSURGO column; the cm to inch conversion; twelve class names and the count of 134 in `lib/cdl.ts`; that CroplandCROS's web map lists the CDL service; the service's time extent (1997 to 2025) and pixel size (30 m); the 8 years of all three sample fields against the service; that nothing claims a field is irrigated; the Finney soil block; the freeze months against SPEC.md; the NASA POWER and NASS badge links; and that the GIBS tile is a real image.

What it flagged, and what was done:

| Flag | Done |
| --- | --- |
| The code said the National Weather Service defines a freeze "the same way". Its definition is broader (a widespread area, a significant period) | Comment reworded: the tool uses that definition's 32°F threshold with a simpler one-day rule |
| "Erodibility by water" was not in the evidence it was given | The comment now quotes Soil Data Access's own description of the K factor, which says so |
| The slope column is not in the metadata table; 0.94 rounds to the stored 0.9 | The comment now says its meaning is inferred from that cross-check |
| It could not see the CroplandCROS banner (the page is drawn by script) | The comment now says the banner was read in a browser |
| The NRCS SSURGO page timed out for it | It loads in a browser (checked), but slowly or not at all for automated fetches. The badge still links to it |

Not checked by it: the Thomas and Brown soil blocks, which came through the same route as the verified Finney one; the CropScape timings and the sample selection, which are one day's measurements; and the README.

## Decisions after the review

On 2026-11-14, after Phase 2 was deployed, Angel answered six questions that Phase 3 depends on, and took the recommended option each time. SPEC.md records them under "Decisions made on 2026-11-14, after Phase 2". The sections above describe the phase as it ended and were left as they were, apart from one line about the sample fields.

| | Question | Angel's decision | What changed |
| --- | --- | --- | --- |
| 1 | Crop history source (deviation 1) | Keep USDA's CDL image service | SPEC.md's data-sources row names it, with the date. Other mentions of CropScape in SPEC.md describe the earlier plan |
| 2 | The three sample points | Confirmed as they are | A line in SPEC.md "Sample fields"; the comment in `lib/samples.ts` |
| 3 | `CropId` | The six ids are confirmed. Double-crop soybean is decided when its rotation is added | SPEC.md's data contracts now define `CropId`; the comment in `lib/types.ts` |
| 4 | The 311 researched crop values | Verify, load, then review | No data file yet. Order of work in Phase 3: the `data-verifier` opens the source of each value again before it is loaded; a value the research marked as an inference is not loaded as a fact; Angel then reviews the data files |
| 5 | Turning a field's own years into `CropId`s | Score what can be scored | The mapping is in SPEC.md by class code. A year with an unmapped class is named on the existing rotation card and left out of its score, and the card says how many of the 8 years were scored |
| 6 | Growing-season months | April to September, as a tool assumption | `ScoringConfig` gained `growingSeasonMonths` in SPEC.md and `lib/types.ts`; the comment in `lib/indicators.ts` |

**One contract changed.** `ScoringConfig` has a new required field, `growingSeasonMonths: [number, number]`. Nothing reads `ScoringConfig` yet, because `config/scoring.json` arrives in Phase 3, so no code changed with it. `CropId` is the same six ids as before. The other code edits are comments.

Files edited for these decisions: `SPEC.md`, `README.md`, `lib/types.ts`, `lib/indicators.ts`, `lib/samples.ts`, this file, and one line in Phase 1's `implementation.md`.

Checked after the edits, at 16:37 CST: `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run test` 17 files and 218 tests passed. The build was not run again: nothing but comments and one type changed. No data file, config file or text in the app changed, so the `data-verifier` and the `ui-reviewer` were not run.

Two points in decision 5 are Claude's reading of it. Angel, please correct them if they are wrong:

- The question spoke of "the three wheat double-crop classes". The Cropland Data Layer has four classes that start with winter wheat. The three meant are the ones whose second crop has a `CropId`: 26 (soybeans), 225 (corn) and 236 (sorghum). Class 238 (winter wheat then cotton) is not mapped. Class 241 (corn then soybeans) was not in the question and is not mapped either, although both of its crops have an id.
- For class 26 the second crop is the ordinary `soybean` id, because double-crop soybean has no id of its own yet (decision 3). If that is still so when Phase 3 loads the crop values, such a year is scored with full-season soybean values, and the card should say so.

## Open items for Angel

Items 1 and 2 and most of item 4 were settled on 2026-11-14 (see "Decisions after the review").

1. Settled: the three sample points are confirmed, with continuous corn as the Finney sample.
2. Settled: the CDL image service stays as the crop history source.
3. Still open: colour for the rotation chips, or not (deviation 3).
4. Settled: `CropId`, the growing-season months, and the mapping from Cropland Data Layer codes to `CropId`. Still open: the 95°F threshold has no public source link (Phase 1, open item 2). Unless a source is stored first, it goes into `config/scoring.json` as a tool setting when Phase 3 creates that file.
5. A finding worth a look for the deck: at all three sample fields the first fall freeze is likely arriving later, by 3 to 4 days per decade since 1981, while hot days show no clear trend at two of the three.
6. The other open items from Phase 1 are unchanged (see that phase's `implementation.md`); its item 1, the growing-season months, is settled. Item 14 there (NASA POWER's highs sitting just under 95°F) still applies to the hot-day numbers above.
