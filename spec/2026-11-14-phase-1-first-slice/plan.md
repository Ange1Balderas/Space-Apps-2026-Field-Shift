# Phase 1: First slice, one field end to end. Plan

Small steps, each with the check that shows it worked.

| # | Step | Check |
| --- | --- | --- |
| 1 | Time the NASA POWER daily request for 1981 to 2025 at a Finney County point and at three other Kansas points | Each time is recorded. Over 5 seconds means the route splits the request by decade; under 5 seconds means one request |
| 2 | Read the Next.js 16.4.6 docs bundled in `node_modules/next/dist/docs/` on route handlers and caching with Cache Components | The route follows the documented model: request data is read first, and no removed route config is used |
| 3 | Find a published worked example for the Mann-Kendall test with tied values | The source is opened and its numbers are re-added by hand before they become expected values in a test |
| 4 | `lib/units.ts`: millimetres to inches, °C to °F | Unit tests pass |
| 5 | `lib/indicators.ts`: hot days, growing-season rain and mean temperature per year, in metric, from daily records | Unit tests cover the 95°F boundary, the season months, leap years and years with missing days |
| 6 | `lib/trends.ts`: Mann-Kendall with the tie correction, Sen's slope, ordinary linear slope, and the three trend labels | Unit tests reproduce the published example and hand-checked cases |
| 7 | `lib/power.ts` and `lib/climate.ts`: build the POWER request, parse its response, assemble a `ClimateResponse` | Unit tests on a small fixture; `lib/types.ts` is unchanged |
| 8 | `app/api/climate/route.ts`: input checks, 15-second timeout, in-memory cache, `Cache-Control` for the CDN, clear errors, fallback to the cached sample | Route tests with a stubbed `fetch`; `npm run build` passes straight after the route exists |
| 9 | Cache the Finney County response in `public/data/samples/finney.json` from the real route | A test checks the file against the sample list and the contract |
| 10 | Mock mode: the route serves only cached samples when `NEXT_PUBLIC_DATA_MODE=mock` | Route test; `npm run dev:mock` makes no request to POWER |
| 11 | Store, map click, pin, sample button, Field panel with loading, empty, error and outside-Kansas states | Each state is seen in the browser |
| 12 | Hot days chart: bars per year, dashed long-term average, units on the axis, trend sentence, confidence label, source badge | Seen in a production run (`npm run build`, `npm start`) |
| 13 | Checks in the production run: the sample button, one live map click, one forced failure, one click outside Kansas, the page at 390 px wide | Each result is recorded in `implementation.md` |
| 14 | Run `typecheck`, `lint`, `test`, `build` | All exit 0; real output recorded in `implementation.md` |
| 15 | Run the `ui-reviewer` and `data-verifier` subagents | Must-fix findings are fixed and the four checks re-run |
| 16 | Write `implementation.md`, update the README, commit in slices. Do not push | `git status` clean; no AI credit line in any commit message |
| 17 | Tell Angel what to check on the public URL after pushing | Angel pushes, checks, and reviews before Phase 2 |
