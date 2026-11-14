# Phase 1: First slice, one field end to end. Implementation

Date: 2026-11-14.

**Status: deployed, and checked on the public URL. Approved by Angel on 2026-11-14.** Angel approved the phase and then pushed `main`. Between 13:11 and 13:13 CST the five checks under "Deployment" passed on https://space-apps-2026-field-shift.vercel.app, so the phase's "done when" is met: the Finney County sample shows hot days since 1981 with a trend label there, and the label is "No clear trend". The checks were made in Claude's own browser, signed in to nothing, with the phone check at an emulated 390 x 844 size. A real phone and a private window on Angel's own machine have not been tried.

**The result for the Finney County sample:** hot days per year from 1981 to 2025 are charted, and the trend label is **No clear trend**. Sen's slope is +1.43 hot days per decade, the least-squares slope is +1.71, and the Mann-Kendall p-value is 0.25. The panel says "Best estimate: about 1.4 more hot days per decade. The years vary too much to call that a trend." The average is 41 days a year, the fewest is 14 (1992) and the most is 75 (2011).

## What was built

- `GET /api/climate?lat=&lon=`: NASA POWER daily data from 1981 to the last full year for a Kansas point, returned in the `ClimateResponse` shape. `lib/types.ts` is unchanged.
- Yearly indicators in metric (`lib/indicators.ts`): hot days, growing-season rain, mean temperature.
- Trend maths (`lib/trends.ts`): Mann-Kendall with the tie correction, Sen's slope, an ordinary least-squares slope, and the three labels.
- A map click, Enter on the focused map, or the "Sample field: Finney County" button opens the Field panel with one chart: hot days per year, the long-term average as a dashed line, a table view, the trend label with a plain sentence, and a NASA POWER source badge.
- Panel states: nothing selected, outside Kansas, loading skeleton, error with "Try again", and the chart. A cached-data notice and toast appear when the route falls back to the sample.
- Mock mode: under `npm run dev:mock` the route never calls POWER. It serves the cached Finney County answer at that point and a plain 404 message anywhere else, and the header shows "Mock data: cached samples only".
- `public/data/samples/finney.json`: the real route answer for the Finney County point, saved on 2026-11-14.

## ClimateResponse: what Phase 1 fills and what waits

| Field | Phase 1 | Waits for |
| --- | --- | --- |
| `lat`, `lon` | The requested point at two decimal places | |
| `elevationM` | The value POWER returns. It is the MERRA-2 grid-cell average, not the point's own elevation (POWER's CSV header: "Average for 0.5 x 0.625 degree lat/lon region") | Phase 3 uses elevation for reference ET and should know this |
| `years[].hotDays` | Days with `T2M_MAX` at or above 35°C (95°F) | |
| `years[].seasonRainIn` | `PRECTOTCORR` summed over April to September, in inches. The months are a tool assumption (Open item 1), so the UI does not show it yet | Angel's decision on the months |
| `years[].meanTempF` | Mean of each day's (max + min) / 2, in °F (Open item 3) | |
| `years[].lastSpringFreezeDoy`, `firstFallFreezeDoy` | `null` | Phase 2, "Freeze dates and monthly climatology" |
| `monthlyByYear`, `monthlyNormals` | Empty arrays. Their rows need `et0In`, which is not nullable | Phase 2 (monthly climatology) and Phase 3 (reference ET) |
| `trends` | `hotDays`, `seasonRainIn`, `meanTempF`. Each slope is in that field's unit per decade | Phase 2 adds the two freeze dates |
| `source`, `fetchedAt` | "NASA POWER" and the time the POWER answer was read | |

A year is used only when every one of its days has all three values. POWER had no missing values for 1981 to 2025 at the Finney point, so no year was dropped.

## Decisions made in this phase

1. **One POWER request, not five.** Timed on 2026-11-14 with `curl`, 1981-01-01 to 2025-12-31:

   | Request | Time | Size |
   | --- | --- | --- |
   | Finney point, 3 parameters, two runs | 0.97 s, 0.81 s | 805 KB |
   | Three other Kansas points, 3 parameters | 0.80 s, 0.77 s, 0.79 s | about 806 KB |
   | Finney point, the 7 parameters Phase 3 needs | 1.41 s | 1.9 MB |

   All are far under the 5-second line in SPEC.md, so the route sends one request. Through the route in a production run the first answer took 0.89 s and a repeat took 0.005 s.
2. **Caching.** The route keeps answers in memory for a day, keyed by the rounded point and the last full year, and sets `Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800` on live answers so Vercel's CDN can hold them. Errors and the sample fallback are `no-store`. The Next.js 16 docs say `use cache` in memory generally does not persist between requests on serverless hosts, and they do not say how a thrown error crosses that boundary, so a small cache of its own (`lib/memory-cache.ts`) is used instead. On Vercel the CDN header is the cache that counts.
3. **Two decimal places for the request point** (about 1 km). POWER serves one grid cell about half a degree across, so nearby clicks share an answer and a cache key. The panel still shows the clicked point to three decimals.
4. **Timeout and errors.** POWER has 15 seconds for the whole exchange. The route answers 400 (bad or out-of-state point), 404 (mock mode has no data), 502 (POWER failed) or 504 (POWER timed out), each with a plain-language `error`. `maxDuration` is 30 seconds.
5. **Sample fields read their cached file directly**, never the route, so the sample works even when POWER or the route is down (SPEC.md, user flow step 2). The route also falls back to the same file when POWER fails at a sample field.
6. **Keyboard reach.** A mouse can click any point; a keyboard could not. Enter on the focused map now chooses the point under a crosshair at its center. This is not in SPEC.md by name; it applies CLAUDE.md rule 6.
7. **Outside Kansas** is decided by the Census bounding box, in the browser and again in the route. The true border waits for the county boundary file.

## The published worked example, and a slip in it

Source: U.S. EPA, "Guidance for Data Quality Assessment: Practical Methods for Data Analysis", EPA QA/G-9, QA00 update, EPA/600/R-96/084, July 2000, section 4.3. https://www.epa.gov/sites/default/files/2015-06/documents/g9-final.pdf

| Test value | Where it comes from |
| --- | --- |
| Box 4-10 (11 values with ties): S = 22, V(S) = 155.33 | Printed in the box. The tests assert both |
| Box 4-10: Z = 1.685 | **Not the printed value.** The box prints "22 - 1 = 20" and so reports Z = 1.605 and "H0 is not rejected". 22 - 1 is 21, and 21 / 12.463 = 1.685, which is above the box's own 1.645 critical value. The test uses the box's formula and says so in a comment |
| Box 4-8 (5 values): S = 6 | Printed in the box |
| Normal percentiles 0.524 to 2.576 | Printed in Table A-1, last row. The formula behind the p-values (Abramowitz and Stegun 26.2.17) is cited from the handbook, which was not opened for this project. It is checked two ways instead: against these percentiles, and against direct numerical integration of the normal curve, where the largest difference measured was 7.5e-8 |
| At least 10 values for a trend | Printed in Box 4-9 |
| Sen's slope = 1.125 for the Box 4-8 data | **Worked by hand** from the definition in section 4.3.3.1. The document gives no worked Sen's slope example ("directions are not given in this document"), so this is not a published value |
| Least-squares slopes | Worked by hand |

The EPA boxes test one direction. The tool reports the two-sided p-value, because it does not know the direction in advance. That is this tool's choice and belongs on the About the Data tab.

Two published sources could not be used: the newer EPA QA/G-9S is too large for the fetch tool, and USGS "Statistical Methods in Water Resources" returned HTTP 403. A published Sen's slope example is still worth adding if Angel has one.

## Files

### Written by AI (Claude) in this phase

| File | Purpose |
| --- | --- |
| `app/api/climate/route.ts` | The climate route |
| `lib/power.ts` | POWER request, timeout, parsing |
| `lib/indicators.ts` | Yearly indicators, metric |
| `lib/trends.ts` | Mann-Kendall, Sen's slope, least squares, labels |
| `lib/climate.ts` | Builds `ClimateResponse`; shape check; request point |
| `lib/units.ts` | mm to in, °C to °F |
| `lib/kansas.ts` | Kansas bounding box and the in-bounds check (moved from `MapView.tsx`) |
| `lib/samples.ts`, `lib/sample-data.ts` | Sample field list; server-side access to the cached file |
| `lib/memory-cache.ts`, `lib/data-mode.ts` | In-memory cache; mock mode flag |
| `lib/climate-client.ts`, `lib/field-store.ts` | Browser-side loading; panel state (Zustand) |
| `lib/trend-text.ts` | Sentence templates for trends and coordinates |
| `components/FieldPanel.tsx`, `components/ConditionsCharts.tsx`, `components/SourceBadge.tsx` | Panel, chart, source badge |
| `components/MapView.tsx`, `app/page.tsx` | Changed: click, Enter, pin, sample button; panel wired in |
| `public/data/samples/finney.json` | Cached route answer (data, produced by the route) |
| `lib/*.test.ts`, `app/api/climate/route.test.ts`, `lib/test-fixtures.ts` | 138 unit tests in 12 files, and their made-up weather |
| `README.md`, `spec/2026-11-14-phase-1-first-slice/*.md` | Docs |

### Ported file changed

`components/states.tsx`: `EmptyState` takes an optional `headingLevel` (default 2, as before), so its title can be an h3 under the panel's h2. No styling changed. Its header comment records this.

### Not in SPEC.md's file list

`FieldPanel.tsx`, `SourceBadge.tsx` and the `lib/` helpers other than `indicators`, `trends` and `units`. They keep components small and the maths testable.

## Additions beyond SPEC.md

Each is small and serves a rule in CLAUDE.md, but none is named in SPEC.md, so Angel should confirm or cut them.

| Addition | Why |
| --- | --- |
| Enter on the focused map chooses the point at its center, with a crosshair and a hint shown only on keyboard focus | Rule 6, keyboard accessible: a map click had no keyboard equivalent |
| "Show the numbers as a table" under the chart | Rule 6: the chart's values in a form a screen reader and a keyboard can read |
| "Mock data: cached samples only" badge in the header under `npm run dev:mock` | Rule 2: mock data must not pass for live data |
| "Load the Finney County sample" button inside the empty state and the outside-Kansas notice | The same action as the map's sample button, within reach of the panel, which sits below the map on a phone |
| "Fewest" and "Most" line under the chart | A text summary of the chart for readers who cannot use it |
| The route rejects points outside the Kansas box, and the browser checks before asking | SPEC.md feature 1 ("a click outside Kansas shows a friendly message") is not listed under Phase 1, but point select without it would chart other states |

## Verification

Run on Windows with Node 26.13.0 and npm 11.20.0, at 13:02 on 2026-11-14, on the tree of the commit "Phase 1: make the data loader work on older browsers, and test it", which is the last commit that changes code. Each exited 0. Output is verbatim, except that the local folder path is removed from the Vitest `RUN` line. The four commands also passed at 12:54, before that commit, with 126 tests.

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


 Test Files  12 passed (12)
      Tests  138 passed (138)
   Start at  13:02:21
   Duration  424ms (import 41%, tests 25%, transform 24%, worker 9%)
```

`npm run build`

```text
> field-shift@0.1.0 build
> next build

▲ Next.js 16.4.6 (Turbopack)
✓ Running next.config.ts took 39ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 1565ms
  Running TypeScript ...
  Finished TypeScript in 3.2s ...
  Collecting page data using 5 workers ...
  Generating static pages using 5 workers (0/4) ...
  Generating static pages using 5 workers (1/4) 
  Generating static pages using 5 workers (2/4) 
  Generating static pages using 5 workers (3/4) 
✓ Generating static pages using 5 workers (4/4) in 598ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /api/climate


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Checks beyond the four commands. Unless a row says otherwise, they were done in a browser against a production run (`npm run build`, then `next start`).

Which build each check ran on: the production build was remade several times after the UI was first complete. On the build that includes the loader change (the last change to code that runs), these were repeated: the sample button, a live map click, the click outside Kansas and the 390 px measurements. On the build after the review fixes: focus after a panel button, headings and landmarks, and the chart's name. The remaining rows (POWER unreachable, the cached-data notice, hover, Tab and Enter on the map, mock mode, and the screenshots) ran on the build before the review fixes and were not repeated. The commit after the loader change altered one comment and added a test only.

| Check | How | Result |
| --- | --- | --- |
| Finney County sample shows the chart and a trend label | Clicked "Sample field: Finney County" | Chart with 45 bars, "No clear trend", the best-estimate sentence, average 41, NASA POWER badge. The only data request was `/data/samples/finney.json` (200). No console messages |
| Hot-day counts are right | A separate script counted `T2M_MAX >= 35` per year from a raw POWER download | All 45 yearly counts equal the route's |
| Live map click | Clicked a point in central Kansas (38.327°N, 97.325°W) | `GET /api/climate?lat=38.33&lon=-97.32` returned 200; the pin moved; the chart showed that point (average 30, most 70 in 2011) |
| Route headers | `curl -D` on the route | Live: the `Cache-Control` above and `x-field-shift-data: live`. Errors: `no-store` |
| Memory cache | Two `curl` calls for the same point | 0.89 s, then 0.005 s with the same `fetchedAt` |
| Bad input | `curl` with `lat=abc`, with no query, and with `lat=41.2` | 400 each time, with a plain message |
| Click outside Kansas | Clicked in Nebraska | "That spot is outside Kansas" notice, no request, pin removed |
| POWER unreachable | Started the production server with `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9`, so its requests to POWER fail, then clicked the map | Error notice "The climate history could not be loaded. NASA POWER could not be reached. Try again in a moment." with "Try again". Route: 502 for that point; 200 with `x-field-shift-data: cached-sample` for the Finney point |
| Cached-data notice and toast | Same server. A debugging-only script in the page pointed the next request at the Finney point, because a mouse cannot hit one 1 km cell at state zoom | "Showing cached data" notice and the toast "Live data unavailable, showing cached data" |
| Phone width | Viewport 390 x 844 and 390 x 540 | `scrollWidth` is 390, nothing overflows, the chart is 324 px wide with 45 bars and four year labels. The panel stacks under the map and starts 638 px down the page |
| Hover | Hovered a bar | "2003, 47 hot days" |
| Keyboard | Tab, Tab, Enter | Focus goes to the sample button, then the map, where the crosshair and "Press Enter to choose this point" appear; Enter loaded the center point through the route |
| Focus after a panel button | Focused "Load the Finney County sample" and pressed Enter | Focus moved to the panel, not to the page body |
| Headings and landmarks | Read from the page | h1, h2 "Field", h3 for the chart or the empty state; one region for the panel |
| Chart for assistive technology | Read from the page | The plot has a name and is a keyboard stop; the table view lists all 45 years |
| Mock mode | `npm run dev:mock` | Header badge shown; sample loads; a map click gets 404 in 43 ms with the mock-mode message; the route tests assert POWER is never called |
| Sample file agrees with the code | Unit test | The cached hot-day trend equals what `lib/trends.ts` gives for the cached counts |

Not verified by these local checks: the public URL (checked later, see "Deployment"), any real phone, a screen reader, and automated accessibility tests (Playwright and axe are not set up).

## Deployment

Angel pushed `main` on 2026-11-14 at about 13:10 CST. GitHub's `main` and the local `main` then pointed at the same commit, "Phase 1: record Angel's approval, and that it is not deployed yet", and Vercel published it. Before the push the public URL served the Phase 0 page and `/api/climate` answered 404 there.

Checked on https://space-apps-2026-field-shift.vercel.app between 13:11 and 13:13 CST:

| # | Check | Result |
| --- | --- | --- |
| 1 | Clicked **Sample field: Finney County** | 45 bars for 1981 to 2025, "No clear trend", "Best estimate: about 1.4 more hot days per decade. The years vary too much to call that a trend.", "Average, 1981 to 2025: 41 days a year", "Fewest: 14 in 1992. Most: 75 in 2011.", and the NASA POWER badge. The only data request was `/data/samples/finney.json` (200). This is the phase's "done when" |
| 2 | Clicked another spot in Kansas (38.327°N, 95.832°W) | `GET /api/climate?lat=38.33&lon=-95.83` returned 200 and the chart for that point appeared. This is the step that goes through NASA POWER from Vercel |
| 3 | Requested `/api/climate?lat=38.05&lon=-100.74` three times | 200 with 45 `years` each time. First: 0.99 s, `X-Vercel-Cache: MISS`. Second and third: 0.22 s, `HIT`, with the same `fetchedAt`. The answer equals the cached sample file apart from `fetchedAt`. Browsers receive `Cache-Control: public, max-age=300`; Vercel keeps the `s-maxage` part for its own cache |
| 4 | Clicked outside Kansas | "That spot is outside Kansas" notice, and the pin was removed. The route itself answers 400 for an out-of-state point and for bad input |
| 5 | Phone width, emulated at 390 x 844 | No sideways scroll; the chart is 324 px wide with 45 bars. Right after the tap, the top of the panel down to the trend label is in view under the map |
| | Browser console | No messages |
| | The published code is the last code commit | The published script holds the hand-built timeout and no `AbortSignal.any` |

Still not tried: a real phone, a private window on Angel's own machine, and a screen reader.

If a live click ever fails while the sample works, the route or POWER is the problem, and the Vercel function log will show a line starting `[api/climate]`.

This section was written after the push, so its commit is ahead of GitHub until the next push.

## UI review

The `ui-reviewer` subagent reviewed the UI commit from the code (no browser). No must-fix findings.

| # | Finding | Level | What was done |
| --- | --- | --- | --- |
| 1 | The chart is a keyboard stop with no name and no authored focus style | Should fix | Fixed: `aria-label` on the plot and a focus outline |
| 2 | A panel button that replaces the panel dropped focus to the page body | Should fix | Fixed: focus moves to the panel first |
| 3 | The empty state's title was an h2 inside the panel's h2 | Should fix | Fixed: `EmptyState` takes `headingLevel`; the panel passes 3 |
| 4 | Warning and info colours were used for cached data, outside Kansas and mock mode | Should fix | Fixed: all three are neutral; status colour now means trend direction only |
| 5 | The source badge and the table disclosure were under 24 px tall | Should fix | Fixed: both are 24 px |
| 6 | The dashed average line faded where it crossed dark bars | Polish | Fixed: a wider line in the surface colour sits under it |
| 7 | `aria-pressed` on the sample button promised a toggle | Polish | Fixed: `aria-current` |
| 8 | The sticky table header lost its rule when scrolled | Polish | Fixed |
| 9 | The panel was a region inside a labelled aside, announced twice | Polish | Fixed: the wrapper is a plain `div` |
| 10 | On a phone there is no cue that the panel below the map has changed | Polish | Not changed. See Open item 8 |
| 11 | `ToneBadge` would cut off a long label | Polish | Not changed. The three labels are short |

## Data check

The `data-verifier` subagent opened each source it was given. Verified: the NIST conversion factors; every EPA value in the table above, including the slip and the page labels; the hand-worked Sen's slope; the Finney County point and the Kansas box against TIGERweb; POWER's units, fill value and grid-cell elevation note; the 15-second message; and that no user-facing text shows growing-season rain. It marked nothing as a mismatch or a broken link. The POWER timing is a dated measurement, not a sourced fact. Its notes are Open items 2, 4, 5 and 9.

Outside what it checked: the Abramowitz and Stegun formula (see "The published worked example"), and the README, which was edited after the check. The README repeats claims that were verified in the code (the 95°F threshold, the EPA and NIST references, "roughly 30 miles"), but its text was not itself reviewed.

## Found in the final review

`lib/climate-client.ts` combined its timeout with the caller's cancel through `AbortSignal.any`, which browsers older than early 2024 do not have (Safari before 17.4). On such a phone the sample button would have shown "could not be reached". The timeout is now built by hand, and the loader has 11 tests of its own. This was found by reading the code, not on a device, so it has not been tried on an old phone.

## Open items for Angel

1. **Growing-season months.** SPEC.md asks for growing-season rain but does not define the season, and no public source for a Kansas definition was found in the time allowed (the NOAA Kansas climate summary says only "warm-season months"). April to September is a default in `lib/indicators.ts`, labelled a tool assumption. It is in the API answer and the sample file but not in the UI. `ScoringConfig` has no field for it, so it cannot be listed as a tool assumption without a shape change. Please confirm the months and where they should live. **Settled on 2026-11-14:** Angel chose April to September as a tool assumption, and `ScoringConfig` gained `growingSeasonMonths` for it (see Phase 2's `implementation.md`, "Decisions after the review").
2. **The 95°F threshold has no public source link.** SPEC.md gives its basis as "common crop heat stress threshold". Under CLAUDE.md rule 1 it needs a K-State or USDA link, or it goes into `config/scoring.json` as a tool assumption when Phase 3 creates that file. Today it is `HOT_DAY_F` in `lib/indicators.ts`.
3. **Mean temperature** is the mean of each day's (max + min) / 2. POWER also offers `T2M`, the mean of hourly values, which SPEC.md's parameter list does not include. Say if you prefer `T2M`.
4. **Two-sided p-values.** See "The published worked example". The labels use p below 0.05 and 0.05 to 0.20 on the two-sided value.
5. **Units in the sample file.** `finney.json` holds inches and °F because it is a copy of the API answer, whose contract in SPEC.md is imperial. SPEC.md also says "metric inside data files". Options: accept the exception for cached answers, or store metric in the file and convert when it loads.
6. **The Finney County point is provisional**: the Census internal point for the county (38.0498, -100.7400), not a field checked against the Cropland Data Layer. Phase 2 picks the real one, and the sample file is regenerated then.
7. **Accent colour.** SPEC.md asks for one accent for the field pin but names no token, and the palette's `accent` token is almost the page colour. The pin uses `chart-1`, the palette's one vivid hue. The bars use the neutral `chart-2`.
8. **Phone layout.** The panel stacks under the map; SPEC.md wants a bottom sheet. After a tap on the map only the top of the panel is in view. Auto-scrolling was left out because it would hide the map and the sheet will replace it.
9. **"Roughly 30 miles"** in the chart note follows SPEC.md's "about 50 km grid". POWER's own 0.5 x 0.625 degree cell is nearer 34 miles at this latitude, so "about 35 miles" would also be fair.
10. **The source badge opens power.larc.nasa.gov** until the About the Data tab exists (Phase 5). Science terms in the panel have no glossary tooltips until then.
11. **Trend wording** uses one decimal ("about 1.4 more hot days per decade"). SPEC.md's example is a whole number ("about 2").
12. **The EPA slip**, in case the worked example is quoted in the deck or README.
13. **Known limit of the trend test:** it treats years as independent. Some year-to-year persistence would make a trend look slightly more certain than it is. Worth one line on the About the Data tab.
14. **POWER's highs can sit just under the threshold.** At the test click in central Kansas (38.33, -97.32) the chart says "Fewest: 0 in 2019". That is what POWER holds: its highest daily maximum there in 2019 is 34.92°C (94.9°F), on 20 August, with 18 days at or above 90°F. A grid-cell value is smoother than a station reading, so a farmer may remember 95°F days that the chart does not count. The check on the public URL showed the same thing further east: at 38.33, -95.83 the chart reads "Fewest: 0 in 1985 and 8 other years", nine years of 45 with no hot day. This is a credibility risk for the chart. Options: say so in the chart note, or compare with Kansas Mesonet stations (a stretch goal in SPEC.md).
