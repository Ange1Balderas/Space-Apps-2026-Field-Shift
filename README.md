# Field Shift Kansas

NASA Space Apps Challenge 2026, Kansas City local event, team ANGEL. Challenge: Field Shift: Adapting Farms with NASA Data.

A decision support tool that uses NASA Earth data, USDA soil and crop data, and farmer priorities to compare crop rotations for Kansas fields. The tool supports farmer judgment. It does not replace it.

> **Status: Phase 0 (setup).** The app shows a base map of Kansas beside an empty field panel. Everything under a "Planned" heading below is not built yet. [SPEC.md](SPEC.md) is the build plan and the source of truth.

Live app: https://space-apps-2026-field-shift.vercel.app

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
| `npm run dev:mock` | Same, with `NEXT_PUBLIC_DATA_MODE=mock` set. Cached sample data arrives in Phase 1; until then nothing reads the flag and it behaves like `npm run dev` |
| `npm run typecheck` | Generates route types, then runs `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run build` | Production build |

## Stack

Next.js 16 (App Router, strict TypeScript), Tailwind CSS 4, shadcn/ui components on Radix UI, MapLibre GL through react-map-gl with OpenFreeMap tiles, Recharts, Zustand. Deployed on Vercel. Python scripts will preprocess the heavier NASA data (Phase 6).

## Data sources

In use now:

- [OpenFreeMap](https://openfreemap.org/) Positron basemap (OpenMapTiles schema, OpenStreetMap data).
- [U.S. Census Bureau TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer): the Kansas bounding box for the first map view.

Planned, with the phase that adds each one (details in [SPEC.md](SPEC.md), "Data sources"):

- [NASA POWER](https://power.larc.nasa.gov/docs/services/api/): climate history since 1981 (Phase 1).
- [USDA NASS Cropland Data Layer](https://nassgeodata.gmu.edu/CropScape/devhelp/getexamples.html): the field's existing rotation (Phase 2).
- [USDA NRCS SSURGO through Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html): soil properties (Phase 2).
- NASA SMAP soil moisture through AppEEARS, GRACE/GRACE-FO water storage, MODIS vegetation through NASA GIBS (Phase 6 and stretch).

## AI use

The hackathon requires this disclosure, and it is kept current each phase.

- Claude (Anthropic), running in Claude Code, researched the data sources, proposed the architecture and scoring model written up in SPEC.md, and writes most of the code.
- Angel Balderas chose the challenge and the Kansas focus, decides each design choice, and reviews the code, data and results at the end of every build phase before the next phase starts.
- Files written or ported mostly by AI start with an `AI-assisted` comment. Each phase's `spec/<date>-<phase>/implementation.md` lists those files and what was verified.
- [research/2026-11-14-crop-values.md](research/2026-11-14-crop-values.md) is an AI-compiled list of sourced crop reference values waiting for Angel's review. Nothing from it is in the app yet, and only its USDA dates part was independently re-checked.
- Any AI-generated text shown in the app will be labeled as AI-generated. There is none yet.

## Other references

- [Stragents](https://github.com/Ange1Balderas/hack_the_midwest/tree/agent-flow), an earlier Hack the Midwest team project. Its design layer is reused here: colour tokens, fonts, UI primitives, and the layout, state and badge components. Each ported file names its source in a header comment.
- Libraries: Next.js, React, Tailwind CSS, shadcn/ui, Radix UI, MapLibre GL JS, react-map-gl, Recharts, Zustand, proj4, Sonner, Framer Motion, Lucide, and the Geist typeface through Fontsource.

## License

MIT. See [LICENSE](LICENSE).
