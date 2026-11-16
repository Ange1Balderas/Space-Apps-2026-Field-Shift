# Phase 7: Stretch. Implementation

Date: 2026-11-15, between about 00:20 and 00:55 CST, unattended (Angel's message is quoted at the end of `spec/2026-11-14-phase-5-explain/implementation.md`). Nothing was pushed.

## Status

**One stretch feature is built: NASA's vegetation layer on the map (feature 13).** The scenario slider, the LLM summary and the county yields were not started, each for a reason given below. The printable summary (feature 18) is not built yet either.

Commits: `4b7e715` (the layer), `e1de5a0` (what the source check and the first UI review asked for), `996bea7` (the date fold closed at first) and `05c1e00` (two faults in the gaps note, from the second UI review).

## What was built

A card on the map, bottom left, with a switch named "Vegetation from space". It is off when the app opens.

- **Switched on**, the app first asks NASA for one tile over the middle of Kansas, with a 15-second limit. If it comes, the pictures are drawn on the map, under the roads, borders and place names, and the map's credits line gains "NASA GIBS". If it does not come, the card says "NASA's vegetation pictures could not be loaded just now. The rest of the map still works." and offers "Try again". The map stays as it was.
- **If the first tile comes but later ones do not**, the card says "Some parts of this picture did not load, so it has gaps." and offers "Try again".
- **The legend** is NASA's own colour scale, drawn from the numbers in NASA's colour map (no NASA image is copied): 0.0 at one end, 1.0 at the other, and "NDVI (a ratio, no unit)". NDVI is a glossary term, so its definition and its source are one tap away.
- **The date picker** has a year and a date. It offers only the dates NASA lists for the layer: 613 pictures, from March 5, 2000 to October 16, 2026. Changing the year keeps the time of year. It starts folded, to leave room for the map (on every screen since the Phase 8 walk-through; before that, only on a phone).
- **The source badge** "NASA GIBS MODIS" opens the layer's entry on the About the data tab, like the other badges.
- The card says "No score uses it" off, and "A picture only: no score uses it." on. That is true: only the map, the card and the glossary read `lib/vegetation.ts`. No scoring code does.

### Where everything said about the layer comes from

`scripts/gibs-vegetation-layer.mjs` reads three documents from NASA GIBS and writes `data/vegetation-layer.json`: the layer's list of dates, its colour map, and NASA's description of it (title, product MOD13Q1, "16-Day", "250m"). The file records when it was read and from which addresses. `lib/vegetation.ts` checks the file when the app is built, so a broken file stops the build.

One limit follows from this: **the list of dates is as it was when the script ran** (00:25 CST on 2026-11-15). When NASA adds a newer picture, the app does not offer it until the script is run again (`node scripts/gibs-vegetation-layer.mjs`, no login).

### Files AI wrote (Claude), all for Angel to review

New: `scripts/gibs-vegetation-layer.mjs`, `data/vegetation-layer.json` (written by that script from NASA GIBS), `lib/vegetation.ts`, `lib/vegetation.test.ts`, `components/VegetationControl.tsx`, and the three files of this folder.

Changed: `components/MapView.tsx` (the layer, its first-tile check, and one column for all the controls on the map), `lib/units.ts` and its test (metres to feet), `lib/glossary.ts` and its test (two values the NDVI entry uses), `lib/about.ts` and its test (the new badge), `data/glossary.json` (the NDVI entry), `data/sources.json` (the layer's entry), `README.md`, `data/README.md`, and a note at the end of the Phase 5 `implementation.md`.

## Choices made tonight, for Angel to confirm or change

1. **The tiles come straight from NASA, not through an API route.** SPEC.md's architecture says so ("NASA GIBS vegetation tiles, loaded directly by MapLibre"). CLAUDE.md rule 4 says every external call goes through a route with a timeout and a cache. SPEC.md was followed, as CLAUDE.md says it is the source of truth, and the spirit of rule 4 was kept where it could be: the first tile has a 15-second limit, a failure gives a clear message and never a blank map. There is no cache of ours; the browser keeps NASA's tiles as NASA's headers allow. If you want the tiles behind a route, that is a change to SPEC.md first.
2. **The picture is drawn solid, not see-through.** A see-through picture would not match the legend's colours. It sits under the basemap's lines and names (roads, borders, towns), so the map can still be read. It hides the basemap's land colours while it is on. NASA's colour map leaves readings of zero or below clear, so the basemap shows through there.
3. **It opens on the newest picture NASA lists** (October 16, 2026 tonight).
4. **The date label says "16-day picture", not "16 days starting".** NASA's description of the layer gives each picture a date and says "16-Day". Which day of the 16 the date is was not found there, so the app does not say.
5. **"About 820 ft (250 m)" in the NDVI definition and the About entry**, not on the card. NASA gives 250 m as the size straight below the satellite, where the picture is sharpest. GIBS serves this layer down to zoom level 9; zoomed in further, the map stretches the same tiles, so a single field shows as a few blurred squares. That is the data, not a fault.
6. **The NDVI glossary entry** is new text: its definition is from NASA Earth Observatory's article on measuring vegetation, with the quotation stored beside it.

## Source check (run 3, `data-verifier`, about 70,000 tokens)

Given only the new published sentences and the saved NASA documents. What it found, all applied before this commit:

| Finding | What was done |
|---|---|
| "One picture for each 16 days" is not exact: the schedule starts again each 1 January, so the last picture of a year is followed sooner | "About one picture every 16 days", and "16-day pictures" |
| The date was called the first day of the 16 days; NASA's description does not say which day it is | "Picture dated ..." everywhere |
| "250 m" alone broke rule 5 (display imperial) and hid that it is the sharpest case | "about 820 ft (250 m) ... at its sharpest", worked out in `lib/vegetation.ts` from NASA's "250m" |
| A tile that failed after the first one left a silent gap | The gaps note and "Try again" |
| The picture was drawn 75% solid while the legend was fully solid, so the colours did not match | Drawn fully solid, under the first line layer of the basemap |

Not sent to the verifier afterwards: the card's wording changed only by removing words ("A picture only: no score uses it.", "16-day picture"), and no new fact was added.

## UI review (`ui-reviewer` on `4b7e715`, about 40,000 tokens)

No must-fix. What it asked for, and what was done:

1. The card could cover the sample buttons on a short map. Now all the map's controls share one column; the card gives way and scrolls inside itself.
2. The source badge was inside the fold. It is always visible while the layer is on.
3. "Try again" removed itself and lost keyboard focus. Focus now goes to the switch.
4. The legend showed while there was no picture. It is hidden when the picture failed.
5. The fold's hidden label promised more than the fold holds. It now says ": choose another date".
6. Later tile failures were silent (also a source-check finding). Fixed as above.
7. Switching off and on again could show an old answer for a moment. The answer is cleared on every switch.
8. Small text in the two pickers makes a phone's browser zoom the page. On a phone they have 16 px text and are 36 px tall.
9. The card overlapped the map's credits. The column now stops above them: two lines of credits on a phone, one on a wider screen.
10. Record the choice to load tiles straight from NASA: choice 1 above.

Smaller points, also done: the first tile is no longer read to the end (only NASA's answer is wanted); the line that announces "Asking NASA..." and "Showing..." is always on the page so a screen reader hears the first change; the browser's own triangle on the fold is removed, since the card draws one; the size of a reading left the card (it is in the NDVI definition and the About entry). The card is also a little tighter on a phone, so that the open date picker fits on a map 447 px tall.

One idea was **not** taken: a sentence on the card saying what the colours mean ("greener means denser green leaves"). It would be a new published claim after the source check. The meaning is in the NDVI definition, which is sourced.

## Second UI review (`ui-reviewer` on the result, about 42,000 tokens)

Run at about 01:13 CST, after the Phase 8 walk-through, and asked only to check the fixes above and what they might have broken. No must-fix. Four should-fix items:

| Item | What was done |
|---|---|
| The gaps note arrived on the page with its words already inside a `role="status"`, which a screen reader often does not read out | The line that is always on the page now announces it ("Showing the picture dated ..., with gaps: some parts of it did not load."). The note itself is plain text with its button |
| The gaps were remembered by date and try, so going to another date and back showed the note before any tile had failed. A late report about the old picture could also be counted against the new one | The memory is cleared when the date changes and on "Try again". A report that names the address that failed counts only if the address is the current date's (`isVegetationTileError`, with a test) |
| On a very short map the card can shrink to a sliver | **Not changed.** A floor on the card's height would push it over the map's credits instead. See the limit below |
| On a phone, the fold's row and the two "Try again" buttons are 24 px tall | "Try again" is 36 px tall on a phone. The fold's row stays 24 px: it is as wide as the card, and 12 px more would bring back the scrolling inside the card on a 375 by 812 screen |

Checked in the browser afterwards, on the rebuilt app: gaps on one date; another date with no note; back to the first date with no note and 18 tiles answered 200; "Try again" clearing the note with focus on the switch; one status region only; no console messages. 420 tests pass.

**A limit to know, not fixed.** The card needs about 150 px while the layer is on (82 px off). On a phone the map is 55% of the window's height, and at 375 px wide the sample buttons and "Use my location" take 162 px of it. By that arithmetic, where the visible window is shorter than about 700 px the card scrolls inside itself while the layer is on, and its last row, the date fold, starts out of view. It was measured only at 375 by 812, where everything fits. Worth a look on a real phone.

## Verification

The results below are from before the second UI review, except where a later section says otherwise. All on the production build (`npm run build`, then `npm run start`), in the app's browser pane, driven by script.

- `npm run typecheck`, `npm run lint`: clean. `npm run test`: 30 files, 419 tests pass. `npm run build`: compiles, 6 pages. Last run at 00:52 CST.
- **On**: "Asking NASA for the picture dated October 16, 2026." then "Showing the picture dated October 16, 2026." The first request is the one tile over Kansas; 17 tile requests followed, all answered 200. The credits line read "NASA GIBS | MapLibre | OpenFreeMap © OpenMapTiles Data from OpenStreetMap".
- **Off**: the credits line lost "NASA GIBS", the legend and the date picker went. On again asked NASA again.
- **Another year**: 2012 gave October 15, 2012 (the nearest picture to October 16), with 23 dates on offer. July 11, 2012: 17 tiles, all 200, no gaps note.
- **NASA unreachable** (the page's `fetch` made to fail for NASA's address): the message above, no legend, the badge still there, the map's credits without "NASA GIBS". "Try again" while still unreachable: the message again, focus on the switch. With NASA back: "Showing the picture dated July 27, 2012.", the legend back.
- **First tile comes, the rest fail** (same method, letting only the first tile through): 16 tiles refused, the gaps note appeared. With NASA back, "Try again" cleared it and 18 tiles came, all 200. Off and on again left no old note.
- **375 px wide, 812 px tall**: the card is 82 px tall off, 150 px on, 208 px with the date picker open, with nothing to scroll inside it. It stays 9 px below the controls above it and 2 px above the credits. The page does not scroll sideways. On a shorter map than this one the card scrolls inside itself; that was seen before the card was tightened (254 px of content in 207 px).
- **The badge** opened "NASA GIBS, Vegetation Index (16-Day, MODIS, Terra)" on the About the data tab with focus on the entry; "Back to where you were" returned to the Field tab with focus on the badge.
- **Keyboard order** on the map: the three samples, "Use my location", the switch, NDVI, the badge, the fold, the two pickers, the map, zoom in, zoom out, the credits.
- **Console**: no messages.
- **Seen on screen twice, briefly.** The browser pane would not draw for most of the night, so most checks are by script. At about 00:50 CST it drew at phone width: the green picture over Kansas and its neighbours, with state lines, roads and town names above it, and the card with the legend. The colours of the picture and the legend agreed by eye. During the Phase 8 walk-through, at about 01:02 CST, it was seen once more at 1280 px wide, with the Finney County marker drawn above the picture. After Angel's push it was seen on the public URL at about 09:50 CST, at 1280 px wide, with 17 tiles from NASA all answered 200. It has **not** been seen on a real phone.

## Not built, and why

| Item | Why it was left |
|---|---|
| Scenario slider (feature 15) | The rainfall half could be built from what the app holds. The temperature half needs each day's temperatures in the browser to work the water demand again, and `ClimateResponse` does not carry them. That changes a shared type and what the climate route returns, which is a decision for Angel, and a slider with only one of its two halves would not be the feature SPEC.md describes. |
| LLM summary (feature 16) | Needs an API key for a language model. There are no keys in this run and rule 8 keeps them out of the repo. It could not be checked tonight. |
| NASS county yields (feature 17) | Needs a USDA NASS Quick Stats API key. |
| Printable summary (feature 18) | Needs no login. It is next on the list if there is time after the Phase 8 walk-through. |
| Field outline from Crop Sequence Boundaries, "Soils in this field" table, drawing a field outline | Each needs a field's shape. The app works from a point. The Crop Sequence Boundaries are a large download that would need preprocessing and a place to host it. |
| More GIBS layers | Which layers is Angel's choice. One layer is what feature 13 asks for. |
| More rotations | Three of the candidates need a decision or a new sourced value each. The fourth, corn-wheat, would reshuffle rankings Angel has already reviewed. |

"Cut whatever is not done by noon Sunday" (SPEC.md): by that rule the first three rows are cut unless Angel decides otherwise in the morning.

---

# The printable summary (feature 18): implementation, the evening of 2026-11-15

Built at Angel's request while the Phase 6 AppEEARS request sat in NASA's queue. Angel present; nothing pushed by Claude.

## What was built

- **`lib/use-ranking.ts`** (new): `useFieldRanking(climate, history, soil, cropEdits)`, the scoring and ranking that `components/RotationRanking.tsx` used to do inline: the farmer's priorities and switches from their store, the field's own rotation from the detected years and the corrections, `scoreField` once per field and switch, `rank` on every slider move, and the climate windows. `RotationRanking` now calls it; its own code is otherwise unchanged. While the crop history is still loading the hook works nothing out: the cards show a skeleton then anyway, and it keeps `new Date()` out of the server prerender of the printable summary, which Next.js (cache components) refuses in a client component. That refusal showed in the dev log on the first run and the production build; moving the call behind the loading check cleared it.
- **`components/PrintSummary.tsx`** (new): the page on paper, `hidden` on screen and `print:block` on paper, rendered from `app/page.tsx` beside the app, whose root is `print:hidden`. Everything on it is computed from the same stores and the same hook as the panel, so it prints what was on screen: the field name and point, the county when known; the disclaimer sentence (CLAUDE.md rule 9); the crop years with "(yours)" on corrected ones; the soil map unit and its values, "not sourced yet" where a value is null; the four priorities and whether the irrigation switch was on; the own rotation and the three best matches as one table (total and seven scores, "—" for a score that could not be worked out, the best marked, the own rotation's left-out years noted), the "why suggested" sentence of the best, and how many more rotations were scored and left off; the four climate series as a table of long-term average, trend label and the same trend sentence the charts show; the county's SMAP status when the app has it; a footer with the sources used on the page, the scoring caveat, the AI note and "Check with your local K-State extension agent". No chart is printed. Each state the panel can be in has its sentence: climate still loading, climate failed (no scores), soil failed, crop history failed with no years filled in.
- **`components/FieldPanel.tsx`**: a "Print summary" button with a printer icon beside "Back to the map", shown once a field is selected; it calls `window.print()`.
- **`app/globals.css`**: `@media print { @page { margin: 0.5in } html, body { height: auto; overflow: visible } }`.

## Verified

- `npm run typecheck`, `npm run lint`, `npm run test` (437): clean. `npm run build`: see the last line of this section.
- In the app's browser pane on the dev server, Finney County sample: the "Print summary" button is in the panel; the summary element is in the page and hidden. Forced visible by script at 720 px wide (a letter page inside half-inch margins at 96 dpi), it read correctly from top to bottom (crops, soil, priorities, the four-row rotation table with the same scores as the cards, the conditions table with the same averages and trend sentences as the charts) and measured 748 px tall, under the 960 px of a 10 in page, with the soil moisture row absent because no county file is built yet. The print dialog itself cannot be opened from the pane; the layout on paper rests on Tailwind's `print:` variant and the measurement above.
- The review workflow's findings and what was done with them follow in the next section once it has run.

## The review workflow, and the public URL

Three reviewers in parallel (the `ui-reviewer` on the page and the button, the `data-verifier` on every sentence and number, a general agent on the refactor), each of their 29 findings put to two refuters who had to point at the line to keep it; 14 survived, 15 were refuted (among them: that the nine-column table is too tight, that one page is not guaranteed, that the hook re-scores on every slider move, that the sources sentence is incomplete). About 6 million tokens across 61 agents. All 14 were applied before the commit: a page with the title, the disclaimer and "Pick a field on the map" when nothing is chosen (Ctrl+P had printed a blank sheet, and CLAUDE.md rule 9 wants the disclaimer on every view); three type sizes instead of four, the tables at 11 px rather than 9; a loading sentence for the crop years, and "Not from the Cropland Data Layer" when they were filled in by hand; "Not available" for a soil value the survey lacks, as the panel says, with the whole-unit caveat; the best match marked and explained only when it has a score; the same waiting rule as the cards, and the same "no monthly climate" sentence; a note under the conditions table that the season, the hot-day line and the freeze windows are the tool's choices; a sentence instead of an empty table when there are no years; the trend minimum quoted from the code; the AI note reworded to claim no review; the print CSS comment corrected and its no-op `height: auto` dropped; `withUnit` kept as a copy of the panel's, with the same words.

After the fixes the forced-visible page measured about 947 px of the 960 px a 10 in page allows at 96 px to the inch, with no soil moisture row. A field with more corrected years or a long map unit name could run to a second page; nothing guards that, and the type was not made smaller to buy room.

Angel answered "Yes, push now" at about 20:20 CST. `git push origin main` sent `bdc98ad..d8fe439` (Phase 6 and this feature). Vercel served the new build about 40 s later: `public/data/counties.geojson` answered 200 on the public URL, `public/data/counties/20055.json` 404 as expected. In the app's browser pane on the public URL, the Finney sample loaded, the "Print summary" button was in the panel, the hidden page held both tables and began "Finney County sample · 37.965°N, 100.723°W · Printed November 15, 2026", and the soil moisture card was absent. The console held one 404, the missing county file. The print dialog itself was not opened on the public URL.
