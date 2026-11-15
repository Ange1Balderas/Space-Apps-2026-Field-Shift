# Phase 8: Polish and verify. Implementation

Date: 2026-11-15, between about 00:55 and 01:20 CST, unattended (Angel's message is quoted at the end of `spec/2026-11-14-phase-5-explain/implementation.md`). Nothing was pushed.

## Status

| Criterion (SPEC.md) | Status |
|---|---|
| Walk the full user flow on all three sample fields and two random points | **Done**, on a local production build |
| Test the public URL in a private window and on a phone | **Not done.** The public URL shows an older build until Angel pushes |
| Take screenshots for the deck | **Not done.** The browser pane returns a 640 by 400 picture of a 1280 by 800 window, too small for a slide. A shot list is below |
| Final README: what it does, how it works, data used, limitations, AI disclosure | **Done**, for Angel to review |

The submission checklist is not ticked: it is Angel's (account, project page, deck).

## The walk-through

On the production build (`npm run build`, `npm run start`), in the app's browser pane, driven by script. Priorities at 50, field not irrigated, unless said.

### The three sample fields, 1280 px wide

| Sample | Crops, 2018 to 2025 | Soil | Rain a year | Own rotation | Ranked for its part of Kansas |
|---|---|---|---|---|---|
| Finney County | Corn in all 8 years | Ulysses silt loam, 1 to 3 percent slopes | About 21 in, western | 60 | Wheat-fallow 68, wheat-sorghum-fallow 63, continuous winter wheat 62, and 2 more behind the disclosure |
| Thomas County | Winter wheat and fallow in turn, sorghum in 2025 | Keith silt loam, 0 to 1 percent slopes | About 20 in, western | 63 | Wheat-fallow 68, wheat-sorghum-fallow 63, continuous winter wheat 63, and 2 more |
| Brown County | Corn and soybeans in turn | Aksarben silty clay loam, 6 to 11 percent slopes | About 35 in, eastern | 73 | Continuous winter wheat 77, and 3 more from other parts of Kansas |

The four charts of each sample, as the app labels them:

| Sample | Hot days | Growing-season rain | Last spring freeze | First fall freeze |
|---|---|---|---|---|
| Finney | No clear trend, p = 0.25 | Possible trend, p = 0.16 (about 0.6 in more per decade) | No clear trend, p = 0.59 | **Likely trend**, p = 0.02 (about 3.3 days later per decade) |
| Thomas | Possible trend, p = 0.12 (about 2 more hot days per decade) | No clear trend, p = 0.88 | No clear trend, p = 0.75 | **Likely trend**, p = 0.03 (about 3.3 days later per decade) |
| Brown | No clear trend, p = 0.54 | No clear trend, p = 0.60 | No clear trend, p = 0.98 | **Likely trend**, p = 0.001 (about 4.3 days later per decade) |

Every sample showed the banner, a field calendar on each card, and no "undefined", "NaN" or empty value anywhere in its text.

### The controls, on the Finney County sample

- **Irrigation switch on**: the field's own rotation (corn every year) is then "Scored as irrigated" and falls from 60 to 54.
- **Save water at 100, irrigation on**: own rotation 46; wheat-fallow 64, wheat-sorghum-fallow 60, wheat-corn-fallow 59. Irrigated corn every year is not first (CLAUDE.md rule 11, seen on screen as well as in the tests).
- **Save water at 0, irrigation still on**: wheat-fallow 73, continuous winter wheat 71, wheat-sorghum-fallow 68. The list re-orders as the slider moves.
- **A crop year changed by hand** (2024 to fallow, 2025 to winter wheat): both years are marked "Yours", the panel says "2 of 8 years changed by you. The rest are from the Cropland Data Layer.", and the own rotation becomes corn and winter wheat. "Back to detected crops" restores corn in all 8 years.
- **Disclosures**: Evidence, Information gaps, Risks to verify locally, How these scores were worked out, the field calendar, "2 more rotations scored for this field" and "Show the numbers as a table" each opened with their content.
- **About the data tab**: 27 sources, 34 glossary terms, 66 links to outside sources, the AI-generated label, and the slope table for the selected sample (for Finney: Sen's slope +1.43 hot days a decade beside a regression slope of +1.71; average temperature of the year +0.41°F a decade, likely trend, p = 0.002).

### Points that are not samples

Chosen by clicking the map. Four points in all. The two in the table were read at the default settings; they loaded with no error on screen.

| Point | Crops found | Soil | Own rotation | Ranked |
|---|---|---|---|---|
| 38.959°N, 100.715°W (west) | Fallow, winter wheat and sorghum | not read back in this pass | Winter wheat, grain sorghum: 61 | Wheat-fallow 69, wheat-sorghum-fallow 64, wheat-corn-fallow 63 |
| 37.953°N, 95.617°W (east) | Soybeans, with wheat then soybeans in one year | not read back in this pass | Soybeans, winter wheat: 70 | Continuous winter wheat 80, corn-soybean 76 |

Two more points were walked first with the irrigation switch still on and "save water" at 0 from the test before, so their scores are not the default ones: 38.964°N, 100.719°W (Ulysses silt loam, about 21 in of rain) and 37.953°N, 95.701°W (Bates loam, 1 to 3 percent slopes, about 42 in of rain). Both loaded crops, soil, cards and all four charts with no error, and for both the three routes answered 200: the climate route in about 1.5 s, the other two in under 0.7 s.

### 375 px wide

The three samples with every disclosure open, and the About the data tab: the page does not scroll sideways, nothing reaches past the right edge, and the banner is on each. The console had no messages after this pass, nor after the last check at 1024 px. It was not read during the 1280 px pass.

### Checks

`npm run typecheck`, `npm run lint`: clean. `npm run test`: 30 files, 420 tests pass. `npm run build`: compiles, 6 pages. Run after the last change of this phase.

## What the walk changed

**The vegetation card's date picker now starts folded on every screen.** With the layer switched on and the two pickers open, the card stood 216 px tall over the south-west of the map. In the 1280 px screenshot its top edge was level with Dodge City, so the south-west corner of Kansas was under it and a field there could not be clicked without dragging the map. Folded, the card is 162 px tall. At 1024 by 768 the Finney County marker then stays 77 px above it. One tap on "Picture dated ..." opens the pickers.

What is left of this for Angel to know: going by the pixel positions, with the layer on the folded card still covers a thin strip at the far south-west of the state on a laptop screen. Dragging the map uncovers it. With the layer off, the card sat below Kansas's southern border in the 1280 px screenshot.

**A second UI review of the vegetation card**, run on the result of the first one's fixes, found two faults in the new gaps note (it could come back for a date that had loaded whole, and a screen reader might not announce it). Both are fixed and were checked in the browser. What it found and what was left is in `spec/2026-11-15-phase-7-stretch/implementation.md`, "Second UI review", with one limit to look at on a real phone: on a short screen the card scrolls inside itself while the layer is on.

`lib/data-mode.ts`: a comment said mock mode calls no live service. The three data routes call none; the map still loads its tiles. The comment and the README row now say so.

## The README

Restructured, not rewritten: What it does, How it works, Limitations, What is not built, Run it locally, Stack, Data used, AI use, Other references.

- **Limitations** is new as a section. Every line is a sentence the app already shows and that the Phase 5 source checks passed (the About tab's "What it cannot tell you", the cards' information gaps, the notes under the crops and the soil), plus two facts about the build: the vegetation layer's list of dates is as old as the last run of its script, and SMAP and GRACE are not built.
- **AI use** now says what was true tonight: the work of 2026-11-15 was done unattended at Angel's instruction and has not been reviewed yet, the Phase 5 text has not either, and the words "reviewed by Angel Balderas" in the header of tonight's files describe a review still to do.
- The status line says Phase 6 is not built and that this build was checked locally only.
- Three stale lines were corrected: mock mode, the Python scripts, and the Census entry (which now also names the county centroids).

## For Angel: what only you can do

1. **Push**, then open the public URL in a private window and on a phone. Every commit since Phase 3 is waiting. Things worth a look on the phone: the vegetation card under the sample buttons, a term's definition on tap, and "Use my location".
2. **Review** the night's work: `spec/2026-11-15-phase-6-county-data/`, `spec/2026-11-15-phase-7-stretch/` and this folder each list the choices that are yours.
3. **The header still says "Early preview".** Your call whether it stays for the submission.
4. **Screenshots for the deck**, from your own screen. Suggested shots, by the slides SPEC.md lists:

| Slide (SPEC.md) | Shot | How to get it |
|---|---|---|
| 2, the problem | A trend the data supports | Brown County sample, Conditions, "Fall freeze": Likely trend, about 4.3 days later per decade, p = 0.001 |
| 3, what it does | The map and the panel | Thomas County sample, window at least 1280 px wide |
| 3, what it does | Priorities and ranked cards | Same sample, panel scrolled to "Your priorities" |
| 5, evidence | One card, opened | Finney County sample, "1. Wheat-fallow", with Evidence, Information gaps and Risks to verify locally open |
| 4, how it works | NASA data on the map | "Vegetation from space" switched on |
| 7, links | Sources and the AI label | The About the data tab, top |

Two cautions for the deck, from what the app actually shows:

- **Slide 2 should not use the hot-day trend.** SPEC.md suggests it, but at the three samples it is "no clear trend" twice and "possible trend" once. The first fall freeze is a likely trend at all three, and so is the average temperature of the year at Finney County (+0.41°F a decade, p = 0.002).
- **Slide 4 should name only the NASA data the app uses**: NASA POWER and the MODIS vegetation index through NASA GIBS. SPEC.md's slide also names SMAP and GRACE, which are not built.

5. **The project page.** `submission-draft.md` in this folder is a draft of each text field, put together from the README and from this walk-through. It is AI-written and yours to edit. It leaves out SMAP, GRACE, NASS QuickStats and earthaccess, which SPEC.md's checklist names and the app does not use.

## Files AI wrote or changed in this phase (Claude), for Angel to review

`README.md`, `components/VegetationControl.tsx` (the fold and the gaps note), `components/MapView.tsx`, `lib/vegetation.ts` and its test (the gaps note), `lib/data-mode.ts` (a comment), two sentences of `spec/2026-11-15-phase-7-stretch/implementation.md`, and the files of this folder, `submission-draft.md` among them.
