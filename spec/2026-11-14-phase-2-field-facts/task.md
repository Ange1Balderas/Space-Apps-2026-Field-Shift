# Phase 2: Field facts. Task

Date: 2026-11-14. Source: SPEC.md, "Build phases for Fable", "Phase 2: Field facts". Angel approved Phase 1, pushed it, and said to keep going.

## Problem

After Phase 1 a click on the map shows one climate chart. The farmer still sees nothing about the field itself. Phase 2 adds the two facts that make the tool about their field: the crops it has grown for the last 8 years, read from the Cropland Data Layer, and its soil, read from SSURGO. It also fills the freeze dates left empty in Phase 1 and fixes the three sample fields.

## Acceptance criteria (copied from SPEC.md, Phase 2)

- `/api/history`: CDL value for the last 8 available years, fetched in parallel; lat/lon converted to EPSG:5070; CDL codes mapped to crop names
- `/api/soil`: SDA point query returning texture, available water storage, organic matter, erodibility, wind erodibility and slope
- Field summary in the panel: rotation chips the farmer can edit, and soil facts
- Freeze dates and monthly climatology added to the indicators
- Pick the 3 sample fields and cache all three responses for each in `public/data/samples/`
- Confirm one NASA GIBS vegetation tile loads in Web Mercator, and record the layer name

Done when: each sample field shows its 8-year rotation and soil in under 5 seconds, and a bad point returns a clean error.

## Related text in SPEC.md

- Feature 4: "Last 8 years of crops at the point shown as named chips; farmer can edit them."
- Feature 5: "Texture, available water capacity, organic matter, erodibility and slope shown; missing data handled without crashing."
- Sample fields: one point each in Finney, Thomas and Brown counties where the Cropland Data Layer shows cropland in all 8 years; Angel confirms them on the map.
- Thresholds: a freeze day is a daily minimum at or below 32°F; the last spring freeze is the last freeze day from January to June; the first fall freeze is the first from July to December.
- Risks: CropScape slow, down or with SSL errors falls back to cached sample fields and the farmer picking crops; Soil Data Access slow gets a 15-second timeout, cached samples and a "soil data unavailable" note.
- Data contracts: `HistoryResponse` and `SoilResponse` in `lib/types.ts`.

## Rules that apply to this phase (from CLAUDE.md)

- Data first: every fact, threshold or claim has a public source stored with it. Never guess a number.
- No fake implementations and no false completion claims.
- Every external call goes through an API route with a 15-second timeout and a cache. On failure, fall back to cached sample data or show a clear error. Never a blank screen.
- Store metric, display imperial.
- Semantic colour tokens only, one accent colour; loading, empty and error states for every panel; layout works at 390 px wide; keyboard accessible.
- No NASA logos, insignia or mission patches, and no images of people. Disclaimer banner on every view.
- Preserve scope. No AI credit in Git. AI-written files carry the `AI-assisted` header, and the README's AI use section stays current.
- Commit, do not push. Stop at the end of the phase for Angel's review.

## Mode

SPEC.md suggests a workflow for this phase (one agent per route plus a verifier). Angel's plan allowance is tight and no workflow was asked for, so the phase runs in normal mode in one session.

## Out of scope

Everything in Phase 3 and later: reference ET (so the monthly arrays of `ClimateResponse` stay empty), the crop and rotation library, scoring, rotation cards, the field calendar, the other climate charts, the county overlay, "Use my location", the vegetation layer on the map, the glossary and the About the Data tab.
