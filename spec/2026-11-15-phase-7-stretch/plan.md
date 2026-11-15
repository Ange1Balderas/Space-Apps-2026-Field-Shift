# Phase 7: Stretch. Plan

Date: 2026-11-15. Normal mode, unattended. Nothing is pushed.

## The vegetation layer (feature 13)

1. Read the layer from NASA GIBS itself before writing anything: its entry in the WMTS capabilities (name, title, tile matrix set, dates, legend and colour map), its description (product, period, resolution), its colour map, and one tile over Kansas for three dates. Save them as evidence.
2. `scripts/gibs-vegetation-layer.mjs` writes `data/vegetation-layer.json` from those documents: the periods the layer has, the colour scale, NASA's description. No login.
3. `lib/vegetation.ts`: check the file when the app is built; work out every date the layer has, the tile address for a date, one tile to ask for first, and the legend's gradient. Tests.
4. A glossary entry for NDVI from a NASA page, and a source entry for the layer, so the badge on the map opens it on the About tab.
5. `components/VegetationControl.tsx` and `components/MapView.tsx`: a switch on the map, off at first. Switched on, one tile over the middle of Kansas is asked for with a 15-second limit. If it comes, the pictures are drawn under the place names; if not, the control says so, offers another try, and the map stays as it was. A date picker that offers only the dates NASA has. The legend, with its two end labels and "no unit". The words "no score uses it".
6. Check on the built app: on, off, another year, another date, NASA unreachable and back, the badge and its entry, 375 px, the keyboard order, the console.
7. One `data-verifier` run on the new published sentences only, with the evidence files. One `ui-reviewer` run.

## Left for Angel

Recorded in `implementation.md` with the reason for each: the scenario slider, the LLM summary, the county yields, the unnumbered stretch items.
