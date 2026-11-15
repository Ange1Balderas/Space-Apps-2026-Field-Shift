# Phase 7: Stretch. Task

Date: 2026-11-15. Source: SPEC.md, "Build phases for Fable" > "Phase 7: Stretch, in order", with "Features" (13, 15 to 18) and "Phase 4: Full UI", whose last item was carried here.

## Problem

The MVP is built. SPEC.md lists stretch features to add in order while time allows, and says to cut whatever is not done by noon on Sunday. One of them, NASA's vegetation layer, was the last item of Phase 4 and was skipped there for time.

## Acceptance criteria (copied from SPEC.md)

From Phase 4:

- [ ] Last, and skipped if late: one NASA GIBS vegetation layer toggle with a legend and date picker

Feature 13, MODIS vegetation map layer (NASA GIBS): "Toggle on the map with a legend, units and a date picker; first stretch item, built at the end of Phase 4 if time allows."

Phase 7, in order:

- [ ] Scenario slider (feature 15): "Rainfall -30% to +10% and temperature +0 to +3°F; cards re-score live"
- [ ] LLM summary (feature 16): "Summary written only from computed evidence, labeled as AI-generated"
- [ ] NASS county yields (feature 17): "Yield history for crops in the rotation, for that county"
- [ ] Printable summary (feature 18): "One-page print view of the field, conditions and top rotations"

And, unnumbered: the field outline from Crop Sequence Boundaries, a "Soils in this field" table, drawing a field outline, more GIBS layers.

"Cut whatever is not done by noon Sunday."

## What SPEC.md says about the vegetation layer

- Data sources: "MODIS vegetation index via NASA GIBS. Vegetation layer on the map. No login. Live map tiles. WMTS tiles from gibs.earthdata.nasa.gov; layer name and Web Mercator support confirmed in Phase 2."
- Architecture: "Browser map layer: NASA GIBS vegetation tiles, loaded directly by MapLibre." So this one external call does not go through an API route.
- Glossary: NDVI is one of the nine terms Phase 5 names. It was left out there because nothing on screen used it.

## Rules that apply (CLAUDE.md)

- Rule 1: everything said about the layer comes from NASA's own documents, stored with their links.
- Rule 4: a timeout, and on failure a clear message. Never a blank screen.
- Rule 6: loading, empty and error states; 390 px; keyboard.
- Rule 7: no NASA logo. The legend is drawn from the colour map's numbers, not copied as NASA's legend picture.
- Rule 10: nothing beyond SPEC.md.

## What this run can and cannot build

Angel is asleep and asked for the work to go on (see the end of `spec/2026-11-14-phase-5-explain/implementation.md`). Built tonight: what SPEC.md lists, needs no login, no key and no change to SPEC.md, and can be checked tonight. That is the vegetation layer. The rest is left, each with its reason, in `implementation.md`.
