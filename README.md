# Field Shift Kansas

NASA Space Apps Challenge 2026, Kansas City local event, team ANGEL. Challenge: Field Shift: Adapting Farms with NASA Data.

A decision support tool that uses NASA Earth data, USDA soil and crop data, and farmer priorities to compare crop rotations for Kansas fields. The tool supports farmer judgment. It does not replace it.

> **Status: Phase 2 (field facts).** Pick a point on the map of Kansas, or one of three sample fields, and the panel shows the crops grown there in the last 8 years, the soil, and the hot days per year since 1981 with a trend label. Everything under a "Planned" heading below is not built yet. [SPEC.md](SPEC.md) is the build plan and the source of truth.

Live app: https://space-apps-2026-field-shift.vercel.app

## What works now

- Click anywhere on the map of Kansas, or press Enter while the map has keyboard focus, to choose a point. A point outside the state gets a short message instead of data.
- **Crops grown here:** the crop at that point in each of the last 8 years, read from the USDA Cropland Data Layer. Any year can be changed by hand, a changed year is marked as yours, and one button brings the detected crops back.
- **Soil:** the soil map unit under the point from the USDA soil survey (SSURGO), with its texture, available water, organic matter, slope, erodibility by water and by wind, and hydrologic group.
- **Conditions:** the number of hot days in each year (daily high at or above 95°F) from 1981 to the last full year, the long-term average, a table of the same numbers, and a trend label: likely trend, possible trend or no clear trend.
- The three facts come from three services and load on their own. If one fails, the other two still show, and the failed one says so and offers a retry. If the crop history fails, the 8 years can be filled in by hand.
- Three sample fields (Finney, Thomas and Brown counties) load saved copies of all three facts, so the demo works without a live connection to NASA or USDA.

How the trend is worked out: a Mann-Kendall test (with the correction for tied values) decides the label, with p below 0.05 as likely, 0.05 to 0.20 as possible and anything higher as no clear trend. The change per decade is Sen's slope. An ordinary least-squares slope is computed beside it for the comparison planned for the About the Data tab.

## What is planned

- The other climate charts: growing-season rain and the last spring and first fall freeze dates, each with a trend label. The freeze dates are already computed; only their charts are missing.
- At least three rotations compared side by side and ranked by the farmer's own priorities, each with its evidence, its information gaps and the risks to verify locally.
- A field calendar showing the crop months and bare months of each rotation.
- A glossary for the science terms and an About the Data tab.

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

- [NASA POWER](https://power.larc.nasa.gov/docs/services/api/): daily maximum and minimum temperature and precipitation from 1981 to the last full year, for the hot-day counts, the last spring and first fall freeze dates, and their trends. Route: `/api/climate`. POWER describes a grid cell roughly 30 miles across, so it is the area's climate, not a reading from one field.
- [USDA NASS Cropland Data Layer](https://www.nass.usda.gov/research-and-science/cropland/sars1a): the crop class at the point in each of the last 8 years. Route: `/api/history`. It is read from [USDA's CDL image service](https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer), the layer behind USDA's own [CroplandCROS](https://croplandcros.scinet.usda.gov/) viewer, in one request. SPEC.md planned to use CropScape for this; it was too slow and then stopped answering on the day the route was built.
- [USDA NRCS SSURGO through Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html): the soil map unit under the point and its properties. Route: `/api/soil`.
- [OpenFreeMap](https://openfreemap.org/) Positron basemap (OpenMapTiles schema, OpenStreetMap data).
- [U.S. Census Bureau TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer): the Kansas bounding box, and the county boxes inside which the three sample fields were chosen.

The browser never calls these services. It calls the app's own three routes, each with a 15-second timeout, a cache and a plain-language error.

Planned, with the phase that adds each one (details in [SPEC.md](SPEC.md), "Data sources"):

- NASA POWER again: reference evapotranspiration and monthly climatology (Phase 3).
- NASA SMAP soil moisture through AppEEARS and GRACE/GRACE-FO water storage (Phase 6).
- MODIS vegetation through NASA GIBS, as a map layer (stretch). The layer `MODIS_Terra_L3_NDVI_16Day` was confirmed to load in Web Mercator in Phase 2.

## AI use

The hackathon requires this disclosure, and it is kept current each phase.

- Claude (Anthropic), running in Claude Code, researched the data sources, proposed the architecture and scoring model written up in SPEC.md, and writes most of the code.
- Angel Balderas chose the challenge and the Kansas focus, decides each design choice, and reviews the code, data and results at the end of every build phase before the next phase starts.
- Files written or ported mostly by AI start with an `AI-assisted` comment. Each phase's `spec/<date>-<phase>/implementation.md` lists those files and what was verified.
- [research/2026-11-14-crop-values.md](research/2026-11-14-crop-values.md) is an AI-compiled list of sourced crop reference values waiting for Angel's review. Nothing from it is in the app yet, and only its USDA dates part was independently re-checked.
- Any text a language model generates while the app runs will be labeled as AI-generated. There is none yet: the sentences in the Field panel are fixed templates filled with computed numbers. The templates, like the rest of the code, were written with AI and are reviewed by Angel.

## Other references

- [U.S. EPA QA/G-9, Guidance for Data Quality Assessment (QA00 update, July 2000)](https://www.epa.gov/sites/default/files/2015-06/documents/g9-final.pdf), section 4.3: the Mann-Kendall formulas, the definition of Sen's slope, and the worked examples (Boxes 4-8 and 4-10) that the unit tests reproduce.
- [NIST Special Publication 811, Appendix B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8): the inch and Fahrenheit conversion factors.
- Abramowitz and Stegun, Handbook of Mathematical Functions (National Bureau of Standards, 1964), formula 26.2.17: the normal distribution approximation behind the p-values.
- [National Weather Service glossary, "Freeze"](https://forecast.weather.gov/glossary.php?word=freeze): the 32°F threshold used for the freeze dates.
- [Stragents](https://github.com/Ange1Balderas/hack_the_midwest/tree/agent-flow), an earlier Hack the Midwest team project. Its design layer is reused here: colour tokens, fonts, UI primitives, and the layout, state and badge components. Each ported file names its source in a header comment.
- Libraries: Next.js, React, Tailwind CSS, shadcn/ui, Radix UI, MapLibre GL JS, react-map-gl, Recharts, Zustand, proj4, Sonner, Framer Motion, Lucide, and the Geist typeface through Fontsource.

## License

MIT. See [LICENSE](LICENSE).
