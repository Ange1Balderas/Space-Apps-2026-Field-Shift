# Field Shift Kansas

NASA Space Apps Challenge 2026, Kansas City local event, team ANGEL. Challenge: Field Shift: Adapting Farms with NASA Data.

A decision support tool that uses NASA Earth data, USDA soil and crop data, and farmer priorities to compare crop rotations for Kansas fields. The tool supports farmer judgment. It does not replace it.

> **Status: Phase 1 (first slice).** Pick a point on the map of Kansas, or load the Finney County sample field, and the Field panel charts that place's hot days per year since 1981 from NASA POWER, with a trend label. Everything under a "Planned" heading below is not built yet. [SPEC.md](SPEC.md) is the build plan and the source of truth.

Live app: https://space-apps-2026-field-shift.vercel.app

## What works now

- Click anywhere on the map of Kansas, or press Enter while the map has keyboard focus, to choose a point. A point outside the state gets a short message instead of data.
- The Field panel shows the number of hot days in each year (daily high at or above 95°F) from 1981 to the last full year, the long-term average, a table of the same numbers, and a trend label: likely trend, possible trend or no clear trend.
- "Sample field: Finney County" loads a saved copy of the same data, so the demo works without a live connection to NASA.

How the trend is worked out: a Mann-Kendall test (with the correction for tied values) decides the label, with p below 0.05 as likely, 0.05 to 0.20 as possible and anything higher as no clear trend. The change per decade is Sen's slope. An ordinary least-squares slope is computed beside it for the comparison planned for the About the Data tab.

## What it will do (planned)

A Kansas farmer clicks a field and sees:

1. the rotation the field already runs, read from the USDA Cropland Data Layer;
2. how growing conditions on that field have shifted since 1981, from NASA POWER;
3. at least three rotations compared side by side and ranked by the farmer's own priorities, each with its evidence, its information gaps and the risks to verify locally.

## Run it locally

Needs Node.js 22 or newer.

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app at http://localhost:3000 |
| `npm run dev:mock` | Same, in mock mode (`NEXT_PUBLIC_DATA_MODE=mock`): the app calls no live service. The sample field works from its saved file, and any other point gets a message saying mock mode has no data for it |
| `npm run typecheck` | Generates route types, then runs `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run build` | Production build |

## Stack

Next.js 16 (App Router, strict TypeScript), Tailwind CSS 4, shadcn/ui components on Radix UI, MapLibre GL through react-map-gl with OpenFreeMap tiles, Recharts, Zustand. Deployed on Vercel. Python scripts will preprocess the heavier NASA data (Phase 6).

## Data sources

In use now:

- [NASA POWER](https://power.larc.nasa.gov/docs/services/api/): daily maximum and minimum temperature and precipitation from 1981 to the last full year, for the hot-day counts and their trend. The app reaches it through its own `/api/climate` route, never from the browser. POWER describes a grid cell roughly 30 miles across, so it is the area's climate, not a reading from one field.
- [OpenFreeMap](https://openfreemap.org/) Positron basemap (OpenMapTiles schema, OpenStreetMap data).
- [U.S. Census Bureau TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer): the Kansas bounding box, and the Finney County internal point used as a provisional sample field until Phase 2 picks one checked against the Cropland Data Layer.

Planned, with the phase that adds each one (details in [SPEC.md](SPEC.md), "Data sources"):

- NASA POWER again: freeze dates and monthly climatology (Phase 2), reference evapotranspiration (Phase 3).
- [USDA NASS Cropland Data Layer](https://nassgeodata.gmu.edu/CropScape/devhelp/getexamples.html): the field's existing rotation (Phase 2).
- [USDA NRCS SSURGO through Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html): soil properties (Phase 2).
- NASA SMAP soil moisture through AppEEARS, GRACE/GRACE-FO water storage, MODIS vegetation through NASA GIBS (Phase 6 and stretch).

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
- [Stragents](https://github.com/Ange1Balderas/hack_the_midwest/tree/agent-flow), an earlier Hack the Midwest team project. Its design layer is reused here: colour tokens, fonts, UI primitives, and the layout, state and badge components. Each ported file names its source in a header comment.
- Libraries: Next.js, React, Tailwind CSS, shadcn/ui, Radix UI, MapLibre GL JS, react-map-gl, Recharts, Zustand, proj4, Sonner, Framer Motion, Lucide, and the Geist typeface through Fontsource.

## License

MIT. See [LICENSE](LICENSE).
