# Phase 2: Field facts. Plan

Small steps, each with the check that shows it worked. The order follows the phase's "done when": routes, samples and the Field summary first; freeze dates, monthly functions and the vegetation tile after.

| # | Step | Check |
| --- | --- | --- |
| 1 | Check that no other session is working on Phase 2, and that the repo is as Phase 1 left it | Linked sessions listed; `git status` clean |
| 2 | Call CropScape `GetCDLValue` and Soil Data Access with real requests and time them | Times and answers recorded. A service that cannot answer inside 15 seconds is not used as the live source |
| 3 | Confirm the meaning and unit of each SSURGO column in the soil query | Label and unit read from a USDA source, not from memory |
| 4 | `lib/cdl.ts`: CDL code to crop name, generated from USDA's own class table | A test checks the codes Kansas rotations use |
| 5 | Shared route pieces: point parsing, Kansas check, error and data responses, upstream errors | The Phase 1 climate route tests still pass after it moves onto them |
| 6 | `/api/history`: last 8 years with a real crop class at the point; timeout, cache, clear errors, sample fallback, mock mode | Route tests with a stubbed `fetch`; a live call in a production run |
| 7 | `/api/soil`: one Soil Data Access query for the map unit, its dominant component and surface layer | Route tests with a stubbed `fetch`; a live call in a production run; a point with no survey gives a clean error |
| 8 | `npm run build` as soon as both routes exist | Build passes |
| 9 | Pick one point each in Finney, Thomas and Brown counties with a crop class in all 8 years, by a written rule | The rule and each point's 8 years are recorded for Angel to confirm |
| 10 | Cache the climate, history and soil answers for each sample in `public/data/samples/` from the real routes | A test checks each file against the sample list and the contracts |
| 11 | Store and loader: climate, history and soil load and fail independently | Loader tests; seen in the browser with one service forced down |
| 12 | Field summary: 8 rotation chips the farmer can edit, soil facts with source badges, loading, empty and error states | Seen in a production run at desktop width and at 390 px |
| 13 | Freeze dates in `lib/indicators.ts` and in the climate answer; monthly climatology functions with tests | Unit tests; the sample climate files are regenerated and carry freeze dates |
| 14 | Confirm one NASA GIBS vegetation tile loads in Web Mercator | Layer name, tile URL and HTTP status recorded |
| 15 | Production-run checks: each sample under 5 seconds, a live click, a bad point, one service down, phone width | Each result recorded in `implementation.md` |
| 16 | Run `typecheck`, `lint`, `test`, `build` | All exit 0; real output recorded |
| 17 | Run the `ui-reviewer` and `data-verifier` subagents once | Must-fix findings fixed and the four checks re-run |
| 18 | Write `implementation.md`, update the README, commit in slices. Do not push | `git status` clean; no AI credit line |
| 19 | Tell Angel what to check on the public URL after pushing, with a live click first | Angel pushes, checks and reviews before Phase 3 |
