# Phase 1: First slice, one field end to end. Task

Date: 2026-11-14. Source: SPEC.md, "Build phases for Fable", "Phase 1: First slice, one field end to end (live by about 1:30 PM)", plus the kickoff prompt for this phase.

## Problem

After Phase 0 the public URL shows a map of Kansas and an empty panel. Nothing reads NASA data yet. Phase 1 builds one thin path through every layer (NASA POWER, an API route, the indicator and trend maths, the map, the panel and one chart), so that every later phase widens something that already works on the public URL.

## Acceptance criteria (copied from SPEC.md, Phase 1)

- `/api/climate`: POWER daily data, 1981 to the last full year, for a point. Time the request first; if it runs over 5 seconds, split it into parallel decade requests and cache the result
- `lib/indicators.ts` (season rain, hot days) and `lib/trends.ts` (Mann-Kendall with tie correction, Sen's slope, linear slope for comparison), unit-tested against a published worked example
- Map click and one sample field button open the panel with one climate chart, its trend label and a source badge
- Mock mode serving a cached sample response
- Deploy

Done when: on the public URL, the Finney County sample shows hot days since 1981 with a trend label.

## Steps asked for in the kickoff prompt

1. `app/api/climate/route.ts`: NASA POWER daily data from 1981 to the last full year for a lat/lon, returning the `ClimateResponse` shape in `lib/types.ts`. Time the POWER request first; if it takes over 5 seconds, split it into parallel decade requests. Use a 15-second timeout and a cache, and return a clear error on failure (CLAUDE.md rule 4). Fill only the fields Phase 1 can compute honestly; say in the notes which fields wait for Phase 2 or 3.
2. `lib/indicators.ts` (growing-season rain, days at or above 95°F) and `lib/trends.ts` (Mann-Kendall with the tie correction, Sen's slope, and an ordinary linear slope for comparison). Unit-test the trend maths against a published worked example and cite it.
3. In `components/MapView.tsx` and `app/page.tsx`: a map click and one sample-field button (Finney County) open the Field panel with one chart, hot days per year since 1981, with its trend label (likely, possible, no clear trend) and a source badge. Loading, empty and error states for the panel; layout still works at 390 px.
4. Mock mode: make `npm run dev:mock` serve a cached sample response for the Finney County point, so UI work never needs the live API.
5. Create `spec/2026-11-14-phase-1-first-slice/` with `task.md`, `plan.md` and `implementation.md`.
6. Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` and show the real output. Open the production build in a browser and confirm the chart renders. Run the `ui-reviewer` subagent after the UI change. Commit with clear messages and no AI credit line. Do not push.

Done when (kickoff prompt): the Finney County sample shows hot days since 1981 with a trend label in a local production run, everything is committed, and Angel has been told exactly what to check on the public URL after pushing. Then stop for Angel's review.

## Rules that apply to this phase (from CLAUDE.md)

- Data first: every fact, threshold or claim has a public source stored with it; a constant we chose ourselves is a tool assumption, not a fact. Never guess a number.
- No fake implementations and no false completion claims.
- Every external call goes through an API route with a 15-second timeout and a cache. On failure, fall back to cached sample data or show a clear error. Never a blank screen.
- Store metric, display imperial (inches, °F).
- Semantic colour tokens only, one accent colour; loading, empty and error states for every panel; layout works at 390 px wide; keyboard accessible.
- No NASA logos, insignia or mission patches, and no images of people.
- Disclaimer banner on every view.
- Preserve scope: nothing that is not in SPEC.md.
- No AI credit in Git. AI-written files carry the `AI-assisted` header, and the README's AI use section stays current.
- Commit, do not push. Angel pushes to deploy.
- Do not change the shapes in `lib/types.ts` without asking Angel first (kickoff prompt).

## Out of scope

Everything in Phase 2 and later: the CropScape and soil routes, freeze dates and monthly climatology, the three CDL-checked sample fields, reference ET, the rotation library and scoring, the other climate charts, the county overlay, "Use my location", the glossary and the About the Data tab.
