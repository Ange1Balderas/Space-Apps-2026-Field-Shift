# Phase 5: Explain. Implementation notes

Date: 2026-11-14 (Saturday), about 22:00 to 23:10 CST. Status: built, checked on the production build, committed locally. **Not pushed.** Waiting for Angel's review. The public URL still shows Phase 3.

SPEC.md suggests a multi-agent workflow for this phase. It was done in normal mode, with one `data-verifier` run and one `ui-reviewer` run, because the plan allowance is tight.

## What was built

1. **A glossary of 33 terms** in `data/glossary.json`. 18 are published definitions, reworded in plain language, each with the passage it was reworded from and a link. 15 are the tool's own terms and rules (the seven indicators, hot day, growing-season rain, the trend label, the three calendar windows, erosion risk, dryland) and say what the code does.
2. **Tooltips** on the science words of the Field tab. A term is underlined with dots. Pointing at it, reaching it with the keyboard or tapping it shows the definition, what the tool does with it, and the name of its source. Escape, a second press or a press elsewhere hides it.
3. **An About the data tab**, the second tab of the panel:
   - what the tool is, what it cannot tell you, and how the text was written;
   - 26 sources with 37 links, in four groups: read for each field, methods, crop and rotation values, map. For a publication behind crop values, what it is used for is worked out from the values that cite it;
   - the resolution table for the three sources in use;
   - satellite and ground;
   - Sen's slope beside a linear regression slope for each yearly series of the selected field, with what EPA says about each and what the test takes for granted;
   - how the scores are worked out: the seven indicators, the 13 constants of `config/scoring.json` with what each does, and 9 rules that have no constant;
   - the glossary, each entry with its source and link.
4. **Source badges** open their entry on the About tab instead of the provider's site, and the entry offers "Back to where you were", which returns keyboard focus and the page to the badge. The provider's link is inside the entry.
5. **A link on every card**, in "How these scores were worked out", to the scoring section of the About tab (SPEC.md, "a 'how we calculated this' link on every card").

## Acceptance criteria

- [x] **Glossary with at least 8 terms.** 33. Of the nine SPEC.md names, seven are in: evapotranspiration; frost risk (as Frost window, with Freeze); water balance; available water capacity (as Available water); erodibility (K factor, wind erodibility index and erosion risk); trend confidence; fallow. Two are not: **soil moisture anomaly** and **NDVI**. Nothing on screen uses either word, because SMAP and the vegetation layer are not built.
- [x] **About the Data tab**: every source with link and purpose; the resolution table (three rows: the SMAP and GRACE rows of SPEC.md are left out with their features); Sen's against linear slope; satellite against ground.
- [x] **Done when every science word in the UI has a tooltip.** Marked: the seven soil facts; the seven indicator names, on each card and under the sliders; the trend label, "Mann-Kendall trend test", the p-value and "Sen's slope" on each chart; the Hot, Dry and Frost rows of each calendar; and in the sentences of a card: potential water demand, reference evapotranspiration, evapotranspiration, dryland, fallow, erosion risk, hot days, freeze, K factor, available water, organic matter, crop coefficient, water balance and growing-season rain, wherever a sentence uses them. Each is marked once in a block of sentences, at its first use. See choice 9 below for the words that are left unmarked.

## Files written by AI in this phase

New: `data/glossary.json`, `data/sources.json`, `lib/glossary.ts`, `lib/glossary.test.ts`, `lib/about.ts`, `lib/about.test.ts`, `lib/view-store.ts`, `components/Glossary.tsx`, `components/AboutData.tsx`, `components/SidePanel.tsx`, `components/LinkedText.tsx`, and this folder's three notes.

Changed: `app/page.tsx`, `app/layout.tsx`, `components/SourceBadge.tsx`, `components/FieldPanel.tsx`, `components/RotationCard.tsx`, `components/RotationRanking.tsx`, `components/ConditionsCharts.tsx`, `components/FieldSummary.tsx`, `components/FieldCalendar.tsx`, `components/PrioritySliders.tsx`, `components/layout/page.tsx`, `lib/card-text.ts`, `README.md`, `data/README.md`.

## Choices made here, for Angel to confirm or change

1. **Two terms SPEC.md lists are left out**: soil moisture anomaly and NDVI. A definition of something the app does not show would be decoration. They belong with Phase 6 and with the vegetation layer.
2. **About is a second tab of the panel**, not a page. Both tabs stay in the page and the one not chosen is hidden, so the cards a reader opened, the chart they chose and their place are kept. Choosing a field while About is open brings the Field tab forward.
3. **A source badge no longer leaves the app.** It opens the entry, which holds the provider's links. SPEC.md asks for exactly this; it is listed because it changes what a click did in Phases 1 to 4.
4. **"Potential demand" keeps its name, with a caution.** FAO-56, Chapter 1, says: "The use of other denominations such as potential ET is strongly discouraged due to ambiguities in their definitions." SPEC.md calls the quantity potential demand, so the name stays, and its About entry now says what FAO advises and that the tool means FAO's crop evapotranspiration under standard conditions. A different name, such as full water demand, is Angel's call.
5. **"Roughly 30 miles" became "roughly 35 miles"** in three sentences that were already on screen (under each chart, in a card's information gaps, in the README). NASA POWER's methodology page gives its weather values on a grid of ½° latitude by ⅝° longitude. In Kansas that is about 55 km on a side: 0.5° of latitude is 55.6 km, and 0.625° of longitude is 53 to 56 km between 40°N and 37°N. That is 34 miles. SPEC.md's "about 50 km grid" is kept as the first words of the resolution, with the exact grid after it. The same page puts POWER's radiation values, sunlight among them, on a coarser grid of 1° by 1°, and the About tab says so.
6. **The sentence about 1984 says what was observed.** "In the answers the tool has received, sunlight is missing before 1984." No NASA page was opened that states a start date.
7. **How the AI label rule is met.** CLAUDE.md: "Any AI-generated text shown in the app is labeled as AI-generated." The About tab says so under "How this text was written": "AI-generated: the explanations on this tab and in the term tooltips were written by Claude, an AI assistant, from the sources linked beside them." A tooltip does not repeat the label; it points to the About tab. The label claims no review. A first version said "and reviewed by Angel Balderas", which would have been shown to the public before it was true, so it was taken out. Angel can add a review clause after reading the tab and the glossary.
8. **The comparison table has a fifth row, the average temperature of the year.** The tool computes that trend (SPEC.md lists the series) but draws no chart for it.
9. **Words left without a tooltip.** Headings, tab names, rotation names, links and the titles of the folding parts are never marked. Nor are: nitrogen-fixing, high-residue, cover crop, deep-rooted, no-till, irrigated, heat-sensitive, grid cell, soil map unit and Cropland Data Layer. The first seven are farm words or explain themselves; the last three are explained in the sentence that uses them or by the badge beside them. Any of them can be added: each needs a source or a sentence saying what the tool means by it.
10. **The glossary's shape is defined in `lib/glossary.ts`, and the source list's in `lib/about.ts`**, not in `lib/types.ts`. That file mirrors SPEC.md's contracts, and these two files are not among them.
11. **One number is written once.** An entry writes `{hotDayF}`, not 95, and the value is filled from `config/scoring.json` or the code when the app is built. A changed constant changes the glossary, the About tab and the tooltips together.
12. **`RECENT_YEARS` (10) is a constant in the code, not in the config.** It is shown on the About tab under the rules. Moving it into `config/scoring.json` would change a shared type, which needs SPEC.md first.
13. **The trend caveats quote EPA.** That Sen's slope is "insensitive to outliers" and regression "very sensitive to extreme values (outliers)" (sections 4.3.3.1 and 4.3.2.1), and that tests on correlated data tend to have a false-alarm rate above the stated one (section 4.8). The sentence "Weather in one year is not wholly independent of the year before" is the tool's own reading and is not measured for any field.
14. **One example on the About tab is from a single point.** "At one point in central Kansas, its hottest day of 2019 was 94.9°F." Asked again on 2026-11-14 at about 22:25 CST: at 38.33°N, 97.32°W, NASA POWER's highest daily maximum of 2019 is 34.92°C (94.86°F) on 20 August, with no day at or above 95°F and 18 at or above 90°F.
15. **A slope's description is narrower than before.** The soil survey's column for the slope shown (`slopegradwta`) has no description that could be found, so the glossary says only that the figure is "the soil survey's value for the whole map unit".

## What the source check found

One `data-verifier` run on the first version of the two data files, about 13 minutes, 163k tokens. It read the saved texts of EPA QA/G-9 and K-State MF3066 and the saved answers of Soil Data Access, opened FAO-56 Chapter 1, the National Weather Service glossary and NASA POWER's pages, and read the code for the tool's own terms.

Confirmed as written: every quoted passage of the 18 published entries, word for word; the 15 own entries against the code; the names of all 26 sources against the data files and title pages.

| Finding | What was done |
| --- | --- |
| Fallow, "here": wrong. In a year with no planting the calendar is not all bare: wheat planted the fall before is in the ground until June | Reworded: a year in which nothing is planted is a fallow year, and a month with no crop in the ground is shown as bare |
| Mann-Kendall: the second quotation is in section 4.3.4.1, not 4.3.4 | "sections 4.3.4 and 4.3.4.1" |
| Wind erodibility: "closely tied to the texture of the surface layer" is said of wind erosion, not of the index, and its sentence was not quoted | Reworded, and the sentence added to the quotation |
| Linear regression: "least squares" is not EPA's phrase | The term is "Linear regression slope"; least squares is given as what the tool does |
| NASA POWER's grid: the "0.5 by 0.625 degree" phrase in the answer describes the elevation, the grid is finer than "30 miles" suggests, and sunlight is on another grid | Rewritten from POWER's methodology page. See choice 5 |
| NASA POWER, 1984: shown at test points, not stated by NASA | See choice 6 |
| FAO-56: "recorded outside Kansas" is not shown for the sorghum and soybean rows, which say "USA" and "Central USA" | "none of the stage lengths the tool uses is given for Kansas" |
| Potential demand: FAO discourages the name potential ET | See choice 4 |
| Freeze: "significant length of time" loosened the source | The source's own phrase is used |
| Organic matter: "of the soil's weight" shortened the source | "by weight, of the soil material finer than 2 millimeters" |
| Slope: the quoted definition is of a soil's representative slope, and the column shown is the map unit's | See choice 15 |
| Available water: the survey's attribute is available water supply | The term is renamed, and the survey's sentence linking it to available water capacity is quoted |
| Heat exposure: "31 such days" lacked "in that month"; the penalty follows the yearly count of hot days | Reworded |
| Simplicity: the score cannot go below 0, which was not said | Added |
| Reference ET: latitude and elevation were not mentioned | Added |
| Soil texture: the loam figures stood outside the quotation | Added to the citation |
| U.S. Census: the link was a home page | The query the rectangle came from is linked too |
| K-State MF3335: no date in its name | "April 2017", from its title page |
| USDA soil survey page: the checker could not reach it | Opened in the browser pane: it loads, titled "Soil Survey Geographic Database (SSURGO)" |
| Market fit, "a tool assumption": not written in `data/crops.json` | No change. The About tab states it, from the crop file, under Market scores |

Not covered by that run, and said so by it: the K-State handbooks other than MF3066 and MF3335, the Nielsen and Vigil article and the USDA NASS reports were checked by name and link only (their values were checked in Phase 3); FAO-56 chapters 3, 4 and 6 were not opened again.

**The corrections were not sent back to the verifier.** Claude checked the ones that rest on a page: the FAO sentence about potential ET and the NASA POWER grid sentence were each found in the page as fetched; a NASA POWER answer for sunlight names its source as "SRB" and is empty through 31 December 1983 at 37.97°N, 100.72°W; K-State MF3335's text reads "20.2 inches, 26.0 inches, and 37.2 inches".

## Verification

Final run on 2026-11-14 at 23:06 to 23:07 CST, after the last code change:

```text
$ npm run typecheck
> next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

$ npm run lint
> eslint
(no output: no problems)

$ npm run test
 Test Files  29 passed (29)
      Tests  394 passed (394)

$ npm run build
✓ Generating static pages using 7 workers (6/6) in 748ms
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/climate
├ ƒ /api/history
└ ƒ /api/soil
```

Browser checks on the production build (`next start`, port 3000), in the app's browser pane, 750 to 870 px wide unless noted, between 22:45 and 23:05 CST. The build was remade and the checks repeated after each fix. The pane was not always drawn, so only some steps used a real pointer: the first sample, the hover, one badge and the tab. The rest were driven by script, with the events a finger, a mouse or a key would send.

| Check | Result |
| --- | --- |
| The page | Two tabs above the panel, Field and About the data. The banner stays above both |
| Finney sample, Field tab | 113 term buttons in the page. Soil labels, indicator names, calendar rows, trend box and card sentences carry them |
| Hover on "Texture", with the real pointer | Tooltip: the term, the definition, what the tool does, "Source: USDA NRCS soil survey. More under About the data." 320 px wide, dark on light. Done on an earlier build of this phase; later the pane would not take a real pointer |
| Hover on the last build, as the events a mouse sends | Fresh load, Finney sample, no tap before it: "Wind erodibility index" goes from closed to open with its definition, a mouse click closes it, and hovering again opens it |
| Tap, as the events a finger sends | First tap opens, second closes, third opens, a tap on another term moves the tooltip, a tap elsewhere closes. Repeated on the last build with the full sequence, leaving included |
| What a screen reader is given | Closed: the button is described by its definition, "Definition: ...", with the source. Open: the same, then "The definition is on screen." 33 hidden definitions in the page |
| Target sizes | Soil labels, indicator names, calendar row labels and the card's link to the scores are each 24 px high |
| Keyboard | Focus opens the tooltip, Escape closes it and focus stays, Enter opens and closes, leaving closes |
| Source badge to its entry | About opens with the entry 12 px from the top and keyboard focus on it. The first stop inside is "Back to where you were" |
| Back | Field tab, focus on the same badge, the badge in the middle of the screen, and the Back button gone |
| A card's link to the scores | Opens About with the section "How the scores are worked out" 12 px from the top and focus on it. Back returns to the link, with the folding part still open |
| About with no field | "No field selected", with what to do. Choosing a sample from About brings the Field tab forward |
| Two slopes, Finney | Five rows. Hot days +1.43 against +1.71 days, no clear trend, p = 0.25. First fall freeze +3.33 against +3.53 days, likely trend, p = 0.02. "In a record of 45 years there are 990 pairs of years, and any one year is part of only 44 of them" |
| Two slopes, Brown | Five rows. Hot days +0.46 against +0.02 days, no clear trend, p = 0.54: the widest gap seen between the two slopes. First fall freeze +4.29 against +4.61 days, likely trend, p = 0.001 |
| Two slopes, Thomas | Five rows. Hot days +2.00 against +2.08 days, possible trend, p = 0.12. First fall freeze +3.33 against +3.34 days, likely trend, p = 0.03 |
| A live point, not a sample (38.514°N, 98.320°W, chosen with Enter on the map) | The three routes answered 200 (climate 1.5 s, crop history 0.6 s, soil 4.0 s). Field tab: the field's own rotation and three ranked cards, 114 terms. About: five rows, with the average temperature a likely trend (+0.50 against +0.49 °F, p = 0.006). No error or warning. The caption read "at Selected point"; it now reads "at the selected point" |
| 375 px wide | Field tab with every folding part open, and About: no sideways scroll. Both tables fit |
| Console | No error and no warning through a field load, a badge, Back and a chart tab |
| Thomas sample, first card | Wheat-fallow, 68. Sixteen terms in the card with every part open |

Found by these checks and fixed:

- The jump to an About entry did nothing: the entry did not exist yet when the jump ran. Both tabs now stay mounted.
- Escape did not close a tooltip while another one was still fading out. The term now closes its own tooltip on Escape.
- Twelve console warnings from the charts each time About opened, because a chart tried to measure a hidden tab. A chart is now drawn only while its tab is on screen.
- At 375 px the About tab made the whole page 31 px too wide: the slope table would not shrink. The two halves of the page can no longer be widened by their content, and the table's cells are narrower.
- A space before a closing bracket after a link, in citations.
- The trend label's focus ring was clipped by its badge. Keyboard focus now inverts the label's colours.

Not checked: the public URL (nothing is pushed), a real phone or a real finger, a screen reader (what it is given was read from the page, not heard), how the hover delay feels, the dark colour scheme, and "Use my location" (unchanged since Phase 4, where only the denied path could be exercised). In one screenshot the map was blank for a moment after the tab changed; the next one showed it, and the map code is untouched.

## UI review

One `ui-reviewer` run. It reads the code and does not run a browser or a screen reader. It found nothing that must be fixed: no raw colour, no second accent, no image or logo, the banner above both tabs, and no term inside a heading, a link, a label or a folding part's title.

| Should fix | What was done |
| --- | --- |
| The seven indicator names on a card and the three calendar row labels were 16 px high, under the 24 px a target needs | They are 24 px high now, like the soil labels |
| The two tables sit in boxes that can scroll sideways but could not take keyboard focus | Both boxes are named regions that take focus and show a focus ring |
| A screen reader hears "Water fit, button" with no hint of a definition: the tooltip only describes the button once it is open | Every definition is in the page once, hidden, and each term button is described by it at all times. While the tooltip is open it adds one sentence, "The definition is on screen." |
| The scores section took focus as a plain box, so a screen reader might read all of it | The section itself takes the focus and reads as its title. Each source and glossary entry is named by its heading |
| The card's link to the scores was 16 px high | 24 px |

Notes it made, and what was done:

- A press that starts on a term and is dragged off left a stale value behind. Forgotten now for a mouse that leaves the term and for a touch the browser cancels. A finger "leaves" between lifting and the click on every tap, so leaving is not used for touch: the first version of this fix would have made a second tap open the tooltip again, and a tap with the full sequence of events caught it.
- The source badge's hover was almost the colour of the page. Its border darkens on hover now.
- The tabs were named "Panel". Now "Panel views".
- The loading state of the two-slope table is announced, and its error sentence always ends its first sentence with a full stop.
- The chart code inside its new condition is indented.

Left as they are: the tooltip names the About tab but cannot link to it, because a tooltip must not hold a control; a long trend label would be cut off inside its badge, and the three labels are short; the tab bar is not sticky, so on a long Field tab the way to About is a scroll up or a source badge; the bottom sheet on phones, which is older than this phase.

## Open items

1. Angel's review of the glossary and the About text. The tab's label says AI-generated and claims no review.
2. Choices 1, 4, 5, 7 and 9 above.
3. Carried over, unchanged: the four rotations not loaded, the market switch's meaning, the bottom sheet on phones, the vegetation layer, the trend of crop water demand, the 12 px text on cards.
4. Nothing since Phase 3 is deployed. SPEC.md's Saturday checkpoint, "MVP live" at 11:30 PM, needs a push of Phases 4 and 5, which is Angel's to do or to ask for.
