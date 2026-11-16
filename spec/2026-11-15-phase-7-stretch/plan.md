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

## The printable summary (feature 18), added the evening of 2026-11-15

Angel's choice, while NASA's AppEEARS queue held the Phase 6 request. SPEC.md: "One-page print view of the field, conditions and top rotations."

1. Move the scoring that `components/RotationRanking.tsx` did in `useMemo` into one hook, `lib/use-ranking.ts`, so the page on paper and the cards on screen come from the same ranking.
2. `components/PrintSummary.tsx`: a print-only element in `app/page.tsx` (`hidden print:block`, the app root `print:hidden`). The field and its point; the eight crop years, with the farmer's corrections marked; the soil map unit and its seven values; the four priorities and the irrigation switch; the field's own rotation and the three best matches in one table of their total and seven scores, with why the best is suggested and how many more were scored; the four climate series as a table of average, trend label and the trend sentence; the county's soil moisture when the app has it; the disclaimer, the sources and the AI note. Text and tables only, no charts, sized to fit one letter page with half-inch margins.
3. A "Print summary" button beside "Back to the map" in the Field panel, calling the browser's print dialog.
4. `app/globals.css`: `@page` margins and `html, body { height: auto }` on paper, so the viewport-height layout does not clip the page.
5. Typecheck, lint, tests, build; force the summary visible in the browser pane to read it and measure its height; a review workflow (UI, wording and facts, the refactor) with every finding put to two refuters.
