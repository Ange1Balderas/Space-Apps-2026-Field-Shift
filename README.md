# Field Shift Kansas

NASA Space Apps Challenge 2026, Kansas City local event, team ANGEL. Challenge: Field Shift: Adapting Farms with NASA Data.

A decision support tool that uses NASA Earth data, USDA soil and crop data, and farmer priorities to compare crop rotations for Kansas fields. The tool supports farmer judgment. It does not replace it.

> **Status: Phase 5 (explain), built and not yet deployed.** Pick a point on the map of Kansas, use your location, or pick one of three sample fields, and the panel shows the crops grown there in the last 8 years, the soil, rotation cards scored for that field, and four climate charts since 1981 with trend labels. Science terms have tooltips, and an About the data tab lists every source, every number the tool chose and the glossary. The live app below shows Phase 3 until the next push. Everything under a "Planned" heading below is not built yet. [SPEC.md](SPEC.md) is the build plan and the source of truth.

Live app: https://space-apps-2026-field-shift.vercel.app

## What works now

- Click anywhere on the map of Kansas, or press Enter while the map has keyboard focus, to choose a point. "Use my location" chooses the point where the device is, once the browser allows it. A point outside the state gets a short message instead of data.
- **Crops grown here:** the crop at that point in each of the last 8 years, read from the USDA Cropland Data Layer. Any year can be changed by hand, a changed year is marked as yours, and one button brings the detected crops back.
- **Soil:** the soil map unit under the point from the USDA soil survey (SSURGO), with its texture, available water, organic matter, slope, erodibility by water and by wind, and hydrologic group.
- **Rotations:** the field's own rotation and the library rotations usual in that part of Kansas, each scored from 0 to 100 on seven indicators (water fit, heat and drought exposure, soil protection, soil building, pest and disease break, market fit, simplicity) and shown as cards: the field's own rotation, then the three best matches, with the rest behind a disclosure. Each card has the seven scores, a field calendar, and five fields: why it is suggested, the evidence, its benefits, the information gaps and the risks to verify locally, every sentence with its source. Four sliders (save water, protect soil, income, simplicity) set how much each indicator counts, and a switch says whether the field can be irrigated; the cards re-order as they change. Six of the ten planned rotations are loaded. A year of the field's own rotation whose crop the tool has no values for is named and left out of its score.
- **Field calendar:** on each card, one row of twelve months for each year of the rotation, filled where a crop is in the ground and empty where the field is bare, under rows that mark the months the field is usually hot, dry or frosty.
- **Conditions:** four charts from 1981 to the last full year: hot days (daily high at or above 95°F), growing-season rain, and the dates of the last spring freeze and the first fall freeze. Each has its long-term average, a table of the same numbers, and a trend label: likely trend, possible trend or no clear trend.
- **Terms:** each science word in the panel (evapotranspiration, K factor, Mann-Kendall trend test, the seven indicators and others) is underlined with dots. Pointing at it, reaching it with the keyboard or tapping it shows its definition and where the definition comes from.
- **About the data:** the panel's second tab. Every source with its link and what the tool takes from it; how fine each source is and how far to trust it for one field; a satellite record against a gauge on the farm; Sen's slope beside a linear regression slope for the selected field; how the seven scores are worked out, with every number and rule the tool chose; and the glossary, with a source for each published definition. A source badge in the panel opens its entry there, and one press leads back.
- The three facts come from three services and load on their own. If one fails, the other two still show, and the failed one says so and offers a retry. If the crop history fails, the 8 years can be filled in by hand.
- Three sample fields (Finney, Thomas and Brown counties) load saved copies of all three facts, so the demo works without a live connection to NASA or USDA.

How a rotation is scored: crop water demand is reference evapotranspiration (FAO-56 Penman-Monteith, from NASA POWER weather) times the FAO-56 crop coefficient, added up over the crop's usual Kansas season. That is potential demand, what a well-watered crop would use. It is set against the rain in the season plus the rain banked on the bare field before planting, on the average of the last ten years. The other indicators use the hot days in each crop's sensitive month, the bare months of the rotation with the soil survey's erodibility and slope, and published crop traits. The scores compare rotations; they do not forecast a yield or a price. [data/README.md](data/README.md) lists every source and every constant the tool chose.

How the trend is worked out: a Mann-Kendall test (with the correction for tied values) decides the label, with p below 0.05 as likely, 0.05 to 0.20 as possible and anything higher as no clear trend. The change per decade is Sen's slope. An ordinary least-squares slope is computed beside it, and the About the data tab shows the two side by side for the selected field.

## What is planned

- Switches for no-till equipment and market access. The no-till switch is built and appears once a loaded rotation needs no-till; the market switch is not defined yet.
- The four remaining rotations: corn-wheat, corn-soybean-wheat with double-crop soybean, wheat-cover crop-sorghum, and alfalfa then corn or wheat.
- A NASA vegetation layer on the map (MODIS through NASA GIBS), and the trend of each crop's water demand.
- Glossary entries for soil moisture anomaly and NDVI. Nothing on screen uses either term yet; each arrives with the feature that does (NASA SMAP soil moisture, and the vegetation layer).

## Run it locally

Needs Node.js 22 or newer.

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app at http://localhost:3000 |
| `npm run dev:mock` | Same, in mock mode (`NEXT_PUBLIC_DATA_MODE=mock`): the app calls no live service. The sample fields work from their saved files, and any other point gets a message saying mock mode has no data for it |
| `npm run typecheck` | Generates route types, then runs `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run build` | Production build |
| `node scripts/cache-samples.mjs http://localhost:3000` | With the app running, saves the live answers of the three routes for each sample field into `public/data/samples/` |

## Stack

Next.js 16 (App Router, strict TypeScript), Tailwind CSS 4, shadcn/ui components on Radix UI, MapLibre GL through react-map-gl with OpenFreeMap tiles, Recharts, Zustand. Deployed on Vercel. Python scripts will preprocess the heavier NASA data (Phase 6).

## Data sources

In use now:

- [NASA POWER](https://power.larc.nasa.gov/docs/services/api/): daily maximum and minimum temperature and precipitation from 1981 to the last full year, for the hot-day counts, the last spring and first fall freeze dates, and their trends; and sunlight, dew point, humidity and wind, for reference evapotranspiration. In the answers received so far POWER's sunlight value is missing before 1984, so the monthly rain and evapotranspiration figures start in 1984. Route: `/api/climate`. POWER gives its weather values on a grid of 1/2 degree latitude by 5/8 degree longitude ([methodology](https://power.larc.nasa.gov/docs/methodology/)), about 35 miles on a side in Kansas, so it is the area's climate, not a reading from one field.
- [USDA NASS Cropland Data Layer](https://www.nass.usda.gov/research-and-science/cropland/sars1a): the crop class at the point in each of the last 8 years. Route: `/api/history`. It is read from [USDA's CDL image service](https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer), the layer behind USDA's own [CroplandCROS](https://croplandcros.scinet.usda.gov/) viewer, in one request. The first plan was CropScape; it was too slow and then stopped answering on the day the route was built, and Angel decided on 2026-11-14 to keep the image service.
- [USDA NRCS SSURGO through Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html): the soil map unit under the point and its properties. Route: `/api/soil`.
- [OpenFreeMap](https://openfreemap.org/) Positron basemap (OpenMapTiles schema, OpenStreetMap data).
- [U.S. Census Bureau TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer): the Kansas bounding box, and the county boxes inside which the three sample fields were chosen.

- FAO Irrigation and Drainage Paper 56 (Allen, Pereira, Raes and Smith, 1998): the Penman-Monteith method for reference evapotranspiration ([Chapter 3](https://www.fao.org/4/X0490E/x0490e07.htm) and [Chapter 4](https://www.fao.org/4/X0490E/x0490e08.htm)), and the crop coefficients and growth-stage lengths in `data/crops.json` ([Chapter 6](https://www.fao.org/4/X0490E/x0490e0b.htm)).
- [USDA NASS, Field Crops Usual Planting and Harvesting Dates](https://esmis.nal.usda.gov/sites/default/release-files/vm40xr56k/dv13zw65p/w9505297d/planting-10-29-2010.pdf) (Agricultural Handbook 628, 2010): the Kansas planting and harvest windows in `data/calendar.json`.
- K-State Research and Extension publications, USDA NASS Kansas Crop Progress reports, a USDA NRCS residue sheet and a USDA-ARS fallow study: crop traits, heat-sensitive months, and the benefits and risks of each rotation. [data/README.md](data/README.md) lists them value by value.
- The glossary definitions in `data/glossary.json`: K-State MF3066, [FAO-56 Chapter 1](https://www.fao.org/4/X0490E/x0490e04.htm), the USDA soil survey's own descriptions of its attributes (through [Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/Query.aspx)), EPA QA/G-9 and the National Weather Service glossary. `data/sources.json` is the full list the About the data tab shows.

The browser never calls these services. It calls the app's own three routes, each with a 15-second timeout, a cache and a plain-language error.

Planned, with the phase that adds each one (details in [SPEC.md](SPEC.md), "Data sources"):

- NASA SMAP soil moisture through AppEEARS and GRACE/GRACE-FO water storage (Phase 6).
- MODIS vegetation through NASA GIBS, as a map layer (stretch). The layer `MODIS_Terra_L3_NDVI_16Day` was confirmed to load in Web Mercator in Phase 2.

## AI use

The hackathon requires this disclosure, and it is kept current each phase.

- Claude (Anthropic), running in Claude Code, researched the data sources, proposed the architecture and scoring model written up in SPEC.md, and writes most of the code.
- Angel Balderas chose the challenge and the Kansas focus, decides each design choice, and reviews the code, data and results at the end of every build phase before the next phase starts.
- Files written or ported mostly by AI start with an `AI-assisted` comment. Each phase's `spec/<date>-<phase>/implementation.md` lists those files and what was verified.
- After reviewing Phase 2, Angel made six decisions on 2026-11-14: the crop history source, the three sample fields, the list of crops, how a field's detected crops are matched to that list, the growing-season months, and how researched values get into the app. Claude laid out the options for each; Angel chose. They are recorded in [SPEC.md](SPEC.md), "Decisions made on 2026-11-14, after Phase 2".
- [research/2026-11-14-crop-values.md](research/2026-11-14-crop-values.md) is an AI-compiled list of sourced crop reference values. Angel's rule for it: the source of each value is opened again and checked before the value is loaded, a value the research marked as an inference is not loaded as a fact, and Angel then reviews the data files. In Phase 3 the values the tool needs were loaded that way into `data/` and `config/`: a second AI check opened each source and confirmed each value first. Where a value is the tool's own pick among published numbers, the file says so in an `assumption` note. [data/README.md](data/README.md) carries the acknowledgement that these data files were compiled with AI. Angel's review of them is the next step.
- The scoring model (which indicators, how they combine) was proposed by Claude in SPEC.md and built by Claude. The constants in `config/scoring.json` were chosen by Claude and are listed in [data/README.md](data/README.md) for Angel to confirm or change.
- The glossary definitions (`data/glossary.json`), the source list (`data/sources.json`) and the wording of the About the data tab were written by Claude from the sources linked beside them. A second AI check compared each definition in the two data files with its source, and those corrections were applied. A further check of the About tab's own sentences found 27 places that say more than their evidence supports. They are listed in `spec/2026-11-14-phase-5-explain/implementation.md` and are not applied yet. The tab says in the app that its text is AI-generated, and claims no review. Angel reviews it with the phase.
- Any text a language model generates while the app runs will be labeled as AI-generated. There is none yet: the sentences in the Field panel are fixed templates filled with computed numbers. The templates, like the rest of the code, were written with AI and are reviewed by Angel.

## Other references

- [U.S. EPA QA/G-9, Guidance for Data Quality Assessment (QA00 update, July 2000)](https://www.epa.gov/sites/default/files/2015-06/documents/g9-final.pdf), section 4.3: the Mann-Kendall formulas, the definition of Sen's slope, and the worked examples (Boxes 4-8 and 4-10) that the unit tests reproduce.
- [FAO Irrigation and Drainage Paper 56, Chapter 4, Example 18](https://www.fao.org/4/X0490E/x0490e08.htm): the daily worked example (Brussels, 6 July, 3.88 mm) that the reference evapotranspiration tests reproduce step by step.
- [NIST Special Publication 811, Appendix B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8): the inch and Fahrenheit conversion factors.
- Abramowitz and Stegun, Handbook of Mathematical Functions (National Bureau of Standards, 1964), formula 26.2.17: the normal distribution approximation behind the p-values.
- [National Weather Service glossary, "Freeze"](https://forecast.weather.gov/glossary.php?word=freeze): the 32°F threshold used for the freeze dates.
- [Stragents](https://github.com/Ange1Balderas/hack_the_midwest/tree/agent-flow), an earlier Hack the Midwest team project. Its design layer is reused here: colour tokens, fonts, UI primitives, and the layout, state and badge components. Each ported file names its source in a header comment.
- Libraries: Next.js, React, Tailwind CSS, shadcn/ui, Radix UI, MapLibre GL JS, react-map-gl, Recharts, Zustand, proj4, Sonner, Framer Motion, Lucide, and the Geist typeface through Fontsource.

## License

MIT. See [LICENSE](LICENSE).
