# Space Apps 2026 Build Spec: Field Shift Kansas

Nov 13, 2026 · Angel Balderas

## Overview

A web app where a Kansas farmer clicks their field and sees three things: the rotation they are already running, how growing conditions on that field have shifted since 1981, and at least three rotations compared side by side and ranked by the farmer's own priorities, each with its evidence, gaps and risks.

**User:** a Kansas farmer or ag advisor with little GIS experience, on a laptop or phone. **Scope:** all of Kansas, any point. **Team:** ANGEL. **Project name:** still open.

| Challenge asks for | Feature that covers it |
| --- | --- |
| NASA Earth observations | POWER climate history (live); MODIS vegetation layer on the map from NASA GIBS; SMAP soil moisture and GRACE water storage (preprocessed) |
| Local soil information | SSURGO soil properties at the clicked point |
| Crop characteristics | Rotation library with per-crop attributes cited to FAO-56, USDA and K-State Research and Extension |
| Farmer priorities and constraints | Priority sliders plus toggles for irrigation, equipment and market access |
| At least three rotations, including the existing one | Existing rotation read from Cropland Data Layer history, plus the top candidates from the library |
| Why suggested, evidence, benefits, gaps, risks | One rotation card per strategy with those five labeled fields |
| Bare-field periods and vulnerable seasons | Multi-year field calendar: crop months vs bare months across the whole rotation, with heat, frost and dry windows overlaid |
| Plain-language science terms | Glossary tooltips and an About the Data tab |
| Satellite vs ground measurements | About the Data tab explains the difference; ground comparison is a stretch goal |
| SI or statistical pattern detection with uncertainty | Trend tests with significance and confidence labels, plus soil moisture anomaly scores |
| Supports, not replaces, farmer judgment | Persistent banner, and a "verify locally" note on every card |
| Interactive maps and scenario sliders | MapLibre map with county overlay; rainfall and temperature scenario slider as a stretch goal |

## Design decisions

Nine of ten decisions have a default so Fable can start building at kickoff; only the names are open. Flip the status as you confirm or change each one.

| Decision | Default | Why | Status |
| --- | --- | --- | --- |
| Scope | All of Kansas, click any point | Serves every farmer instead of one persona | Default |
| Existing rotation | Read the last 8 years of crops at the point from the Cropland Data Layer; farmer can edit it | Real data, no typing, satisfies the "include the existing rotation" ask | Default |
| Candidate rotations | Curated library of 10 Kansas rotations, filtered by region and irrigation, ranked by score | Explainable, and avoids inventing agronomy | Default |
| Scoring | Transparent weighted score; weights come from the farmer's sliders | Judges and farmers can audit every number | Default |
| SI layer | Trend tests (Mann-Kendall with Sen's slope) and soil moisture anomaly scores; LLM plain-language summary is a stretch goal | Explainable, cheap, and reports uncertainty | Default |
| Stack | Next.js with TypeScript, MapLibre GL with free OpenFreeMap tiles, shadcn/ui and Tailwind, Recharts, Zustand, deployed on Vercel | Fast to build, already familiar | Default |
| Heavy NASA data | Python scripts preprocess into one small JSON file per county (105 counties) | Fast demo, no raster work at runtime | Default |
| Units | Inches and °F in the UI, metric inside data files | Kansas farmers think in inches of rain | Default |
| Demo format | 7-slide deck built from app screenshots | Lower risk than a 30-second video when solo | Default |
| Project and team name | Team: ANGEL. Project name not chosen yet | Project name is needed for the submission page | Open |

### Decisions made on 2026-11-14, after Phase 2

Angel made these with Claude before Phase 3. Where they change text elsewhere in this document, that text has been edited and says so.

1. **Crop history source.** The tool reads the Cropland Data Layer from USDA's CDL image service, not CropScape. CropScape took 27 seconds for one request and then stopped answering on the day the route was built. Mentions of CropScape, parallel year requests and EPSG:5070 in the architecture, repo structure, Phase 2 checklist and risks sections describe the earlier plan.
2. **Sample fields.** The three points are confirmed (see "Sample fields").
3. **`CropId`.** The six ids are confirmed (see "Data contracts"). Double-crop soybean is decided when its rotation is added.
4. **Crop values.** Order of work in Phase 3: the `data-verifier` re-opens the source of each researched value before it is loaded; a value the research marked as an inference is not loaded as a fact (it becomes a tool assumption or stays "not sourced yet"); Angel then reviews the data files.
5. **The field's own rotation from CDL classes.** By class code: 1 Corn is `corn`, 4 Sorghum is `grain_sorghum`, 5 Soybeans is `soybean`, 24 Winter Wheat is `winter_wheat`, 36 Alfalfa is `alfalfa`, and 61 Fallow/Idle Cropland is a fallow year. Three double-crop classes are winter wheat plus a second crop in the same year: 26 (winter wheat then soybeans), 225 (winter wheat then corn) and 236 (winter wheat then sorghum). Every other class has no `CropId`. That includes the other double-crop classes, such as 238 (winter wheat then cotton) and 241 (corn then soybeans). A year whose class has no `CropId` is named on the existing rotation card and left out of its score, and the card says how many of the 8 years were scored.
6. **Growing season.** April through September, as a tool assumption in `config/scoring.json` (`growingSeasonMonths`), listed on the About the Data tab. No public source defines it.

## User flow

In the first 30 seconds the farmer clicks a field and sees their detected rotation, their soil, and ranked rotation cards; everything after that is depth for those who want it.

1. **Land on the map.** Kansas map, one line on what the tool does, and a banner: "This tool supports your judgment. It does not replace it." Buttons for "Use my location" and three sample fields.
2. **Pick a field.** Click anywhere, or pick a sample field: Finney County (southwest, irrigated), Thomas County (northwest, dryland wheat), Brown County (northeast, corn and soybeans). Sample fields have cached data so the demo never depends on a live API.
3. **See the field summary within about 3 seconds.** Detected rotation as colored chips for the last 8 years, soil texture, water holding capacity and erosion risk.
4. **Read the rotation cards.** Existing rotation plus the top three candidates, ranked by score. Each card shows the score breakdown and the five fields: why suggested, evidence, benefits, information gaps, risks to verify locally.
5. **Adjust priorities.** Sliders for save water, protect soil, income and simplicity; toggles for irrigation available, no-till equipment and local market access. Cards re-rank instantly.
6. **Dig into conditions.** Growing season rain, hot days and last spring frost since 1981, each with a trend arrow and a confidence label; this season's soil moisture against normal; the regional groundwater trend.
7. **Check the field calendar.** A calendar for each rotation, one 12-month row per year of the cycle, showing crop months vs bare months, with typical heat, dry and frost windows laid over it.
8. **Learn the terms.** Glossary tooltips on every science word, and an About the Data tab explaining each source, satellite vs ground measurement, and the tool's limits.

## Design direction

It should look like a calm, trustworthy public tool, not a hackathon dashboard: a muted map, one panel, one accent color, and every number labeled with its source.

### Patterns borrowed from existing tools

| Reference | What it does well | What we take |
| --- | --- | --- |
| [PSA Cover Crop Species Selector](https://github.com/precision-sustainable-ag/dst-selector) (open source, MIT) | Farmers enter goals and constraints, then get ranked options with detail cards; the calculations are public | Goal priorities that re-rank results, detail cards, and a "how we calculated this" link on every card |
| [NOAA Climate Explorer](https://github.com/nemac/climate-explorer) (open source) | Observed climate graphs for every U.S. county | County as the unit for preprocessed data; history charts with a clear long-term normal line |
| [OpenFreeMap](https://github.com/hyperknot/openfreemap) with MapLibre GL | Free vector basemap with no API key and no request limits | The Positron style: light and muted, so our data stands out |
| [2025 Space Apps agriculture winners](https://www.spaceappschallenge.org/2025/meet-the-2025-global-winners/) | Strong storytelling around farmers | Tell the demo through one sample farmer's field |

### UI rules for Fable

- **Layout:** map on the left (about 60%), panel on the right on desktop; the panel becomes a bottom sheet on phones.
- **Basemap:** OpenFreeMap Positron (`tiles.openfreemap.org/styles/positron`); thin gray county outlines; selected county and field pin in the accent color.
- **Components:** shadcn/ui cards, tabs, sliders, tooltips and badges only; no other component library.
- **Color:** Stragents' warm sand palette (see below) plus one accent for the field pin and the top-ranked card; status colors only for wetter or drier and for trend direction.
- **Type:** one sans-serif family (Inter or Geist), at most three sizes per view.
- **Loading:** skeleton placeholders shaped like the final content, never a blank panel or a lone spinner.
- **Charts:** minimal axes, light gridlines, the long-term average as a dashed line, units in every axis title.
- **Sources:** every number carries a small badge (POWER, SMAP, SSURGO) that opens its About the Data entry.
- **Motion:** the panel slides in and cards re-order with a short animation when sliders move; nothing else animates.

### Reuse from Stragents (Hack the Midwest)

Port Angel's existing design layer from the [Hack the Midwest repo](https://github.com/Ange1Balderas/hack_the_midwest) in Phase 0 instead of styling from scratch; it already follows these rules, and its warm sand palette suits a farm tool.

| Piece | Where it lives in Stragents | Use here |
| --- | --- | --- |
| Color tokens: sand background, near-black primary, success, warning, info, light and dark | `fe/src/styles.css` | Copy the `:root` and `.dark` blocks as-is |
| Geist Sans and Geist Mono via fontsource | `fe/src/styles.css` imports | Same fonts |
| shadcn/ui primitives: button with press feedback, card, tabs, slider, tooltip, skeleton, sheet, switch | `fe/src/components/ui/` | Copy, fix the import alias |
| `PageHeader` and `Section` (titled bordered panel) | `fe/src/components/layout/page.tsx` | Panel sections: Field, Conditions, Rotations |
| `ToneBadge` (colored dot, optional pulse) | `fe/src/components/tone-badge.tsx` | Confidence labels and wetter or drier badges |
| Loading, empty and error states | `fe/src/components/states.tsx` | Skeletons for every panel |
| Motion helpers that respect reduced motion | `fe/src/lib/motion.ts` | Panel fade and card re-order |
| Toast wrapper on Sonner | `fe/src/lib/feedback.ts` | "Live data unavailable, showing cached data" |
| Two-column grid with a sticky side panel | `fe/src/components/agents/agent-detail.tsx` | Map plus sticky panel |

List the repo under "Other References" on the submission form, since it is earlier code from a team project. Check with the teammates who wrote those files before reusing them.

### Map patterns from farm apps

Commercial farm map apps converge on the same few patterns; we copy the patterns, never their designs, names or assets.

| App | Pattern worth copying | Our version |
| --- | --- | --- |
| [OneSoil](https://futurefarming.com/smart-farming/tools-data/onesoil-a-handy-free-fieldmap-and-scouting-app) | Detects field boundaries and crops from satellite imagery and tracks greenness over time | A click snaps to the real field outline from Crop Sequence Boundaries, with 8 years of crop chips |
| [EOSDA Crop Monitoring](https://eos.com/products/crop-monitoring/) | Field list beside the map, vegetation layers and weather history per field | Panel beside the map, NASA layers, POWER history charts |
| [AcreValue](https://acrevalue.com/resources/feature-insights/soil-maps-productivity) | Soil map clipped to the field, with a table of soil types and their share of the field | "Soils in this field" table from a Soil Data Access polygon query |
| [Climate FieldView](https://www.climate.com/blog/field-health-imagery-beyond-the-end-rows) | Field health imagery you flip through by date | A date picker on the NASA layer overlay |

### Open source map pieces to plug in

| Piece | What it does | Tier |
| --- | --- | --- |
| MapLibre GL JS with react-map-gl | The map itself | MVP, already in the stack |
| OpenFreeMap Positron | Muted basemap | MVP |
| [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/map-library-usage) map tiles | Live NASA imagery as map layers (MODIS vegetation, SMAP soil moisture, GRACE) by date, with no download or preprocessing | MVP for one layer; confirm each layer is offered in Web Mercator, otherwise fall back to the county data |
| [PMTiles](https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/) | Reads one large tiles file straight over HTTP | Stretch: Crop Sequence Boundaries field outlines |
| [Terra Draw](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/) | Lets the farmer draw or fix their own field outline | Stretch |
| Turf.js | Field area, center point, point-in-field checks | With field outlines |
| [farmOS-map](https://www.github.com/farmOS/farmOS-map) | Open source farm mapping on OpenLayers | Ideas only; different map library |

Every NASA layer on the map shows a legend with units, its date, and a source badge.

## Features

Eleven MVP features must work by Saturday night; seven stretch features get built Sunday morning in the order listed, and any not done by noon Sunday get cut.

| # | Feature | Tier | Done when |
| --- | --- | --- | --- |
| 1 | Map, point select, sample fields | MVP | Click anywhere in Kansas returns lat/lon; three sample buttons load cached data; a click outside Kansas shows a friendly message |
| 2 | Climate history from POWER | MVP | Charts from 1981 to last full year: growing season rain (in), days at or above 95°F, last spring freeze date; loads in under 5 seconds |
| 3 | Trend detection | MVP | Every climate chart shows change per decade and a confidence label (likely trend, possible trend, no clear trend) |
| 4 | Existing rotation from CDL | MVP | Last 8 years of crops at the point shown as named chips; farmer can edit them |
| 5 | Soil summary from SSURGO | MVP | Texture, available water capacity, organic matter, erodibility and slope shown; missing data handled without crashing |
| 6 | Rotation library and scoring | MVP | Six core rotations first, then all 10, in one JSON file; every published value carries a source; every rotation gets a score with a visible breakdown |
| 7 | Priority sliders and constraints | MVP | Moving a slider re-ranks cards instantly; irrigation toggle hides irrigated-only rotations |
| 8 | Rotation cards | MVP | Existing rotation plus top 3 shown; each has why suggested, evidence, benefits, gaps, risks, and a verify-locally line |
| 9 | Field calendar | MVP | One 12-month row per year of the rotation showing crop vs bare months, with heat, dry and frost windows from POWER climatology |
| 10 | Glossary, About the Data, disclaimer | MVP | At least 8 terms explained; every source listed with link and purpose; banner visible on every view |
| 11 | Deployed on Vercel | MVP | Public URL works in a private window; FortiGuard classification request filed |
| 12 | SMAP soil moisture anomaly | Stretch | Per county: this month vs the 2015-to-now normal, shown as wetter or drier than usual |
| 13 | MODIS vegetation map layer (NASA GIBS) | Stretch | Toggle on the map with a legend, units and a date picker; first stretch item, built at the end of Phase 4 if time allows |
| 14 | GRACE water storage trend | Stretch | Kansas regional chart from 2002 to now with its trend label |
| 15 | Scenario slider | Stretch | Rainfall -30% to +10% and temperature +0 to +3°F; cards re-score live |
| 16 | LLM plain-language summary | Stretch | Summary written only from computed evidence, labeled as AI-generated |
| 17 | County yield context from NASS | Stretch | Yield history for crops in the rotation, for that county |
| 18 | Printable summary | Stretch | One-page print view of the field, conditions and top rotations |

## Data sources

Three sources run live through server-side API routes (POWER, CropScape, soil survey); everything raster-based is preprocessed once into per-county JSON. POWER alone satisfies the "at least one NASA dataset" rule for global awards.

| Source | Used for | Access | Mode | Endpoint or product |
| --- | --- | --- | --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/docs/services/api/) | Rain, heat days, frost dates, climatology for the field calendar | No login | Live, cached for sample fields | `power.larc.nasa.gov/api/temporal/daily/point`, community `AG`, parameters `T2M_MAX, T2M_MIN, PRECTOTCORR, ALLSKY_SFC_SW_DWN`, T2MDEW, RH2M, WS2M |
| [Cropland Data Layer](https://www.nass.usda.gov/research-and-science/cropland/sars1a), through USDA's CDL image service (the layer behind [CroplandCROS](https://croplandcros.scinet.usda.gov/)) | Existing rotation | No key | Live via API route | `pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer/identify` with `returnCatalogItems=true`: one request returns every year at a lat/lon point. Changed on 2026-11-14 by Angel's decision. The plan was CropScape `GetCDLValue`, which was timing out |
| [SSURGO via Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html) | Texture, available water capacity, organic matter, erodibility, slope | No key | Live via API route | POST SQL to `sdmdataaccess.sc.egov.usda.gov/tabular/post.rest`; point to map unit with `SDA_Get_Mukey_from_intersection_with_WktWgs84('point(lon lat)')` |
| [SMAP SPL3SMP\_E v006 via AppEEARS](https://www.earthdata.nasa.gov/data/alerts-outages/appeears-version-3-58-released-adding-new-versions-smap-products) | Soil moisture anomaly | Earthdata Login | Preprocessed | AppEEARS point sample at 105 county centroids, 2015 to now, CSV out |
| MODIS vegetation index via NASA GIBS | Vegetation layer on the map | No login | Live map tiles | WMTS tiles from gibs.earthdata.nasa.gov; layer name and Web Mercator support confirmed in Phase 2 |
| GRACE/GRACE-FO JPL mascons | Regional water storage trend | Earthdata Login | Preprocessed | `TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4` via `earthaccess` and `xarray`, averaged over Kansas |
| NASS QuickStats | County yield history (stretch) | Free API key | Preprocessed | `quickstats.nass.usda.gov/api/api_GET/` |
| K-State Research and Extension | Rotation benefits and risks, heat-sensitive crop stages, fallow efficiency | Public pages | Compiled with a source link per value; Angel reviews | Rotation library JSON, `source` field per attribute |
| USDA NASS Usual Planting and Harvesting Dates handbook | Field calendar windows | Public report | Compiled into calendar.json | Kansas rows only |
| Census county boundaries | County overlay and centroids | Public | Static GeoJSON | Kansas counties, simplified |

CropScape's server has had SSL certificate problems, which is another reason every live call goes through a Next.js API route rather than the browser. AppEEARS requests run asynchronously, so submit them first thing Saturday.

### More public sources (answer the agronomy questions with data, not guesses)

| Source | Answers | Mode | Tier |
| --- | --- | --- | --- |
| [FAO-56 Crop Evapotranspiration](https://www.fao.org/docrep/X0490E/X0490E00.htm) | The standard method and published crop coefficients for computing crop water use from weather | Formulas and tables in `crops.json` | MVP |
| [NASS Kansas Crop Progress](https://www.nass.usda.gov/statistics_by_State/Kansas/Publications/Crop_Progress_and_Condition/current-ks.pdf) (weekly; also in QuickStats) | Recent actual planting and harvest timing, to refine the handbook's usual dates (needs the QuickStats key) | Preprocessed into `calendar.json` | Stretch |
| [Census of Agriculture, Kansas county tables](https://www.NASS.USDA.gov/Publications/AgCensus/2017/Full_Report/Volume_1,_Chapter_2_County_Level/Kansas/st20_2_0041_0041.pdf) (also in QuickStats) | How many acres in each county use cover crops and no-till | Preprocessed per county | Stretch |
| [Kansas Mesonet](https://dev.mesonet.ksu.edu/ag/et) (K-State stations; [Python package](https://pypi.org/project/ksmesopy/)) | Ground truth for rain, temperature and ET, to check POWER | Preprocessed comparison for sample fields | Stretch |
| [Crop Sequence Boundaries](https://gee-community-catalog.org/projects/csb/) (USDA NASS) | Real field outlines with each field's crops for 2018 to 2025 | Field outline on the map; history for sample fields | Stretch |
| [KGS High Plains aquifer data](https://www.kgs.ku.edu/HighPlains/data/index.shtml) | Measured groundwater levels from western Kansas wells | Preprocessed, next to the GRACE trend | Stretch |
| [ARS Crop Sequence Calculator](https://www.ars.usda.gov/plains-area/mandan-nd/ngprl/docs/crop-sequence-calculator/) | Research on how the previous crop affects the next one | Reference for rotation benefit text only; built for the northern Great Plains, so labeled as such | Reference |

Crop Sequence Boundaries also has a ready-made [national map tiles file](https://source.coop/fiboa/us-usda-cropland) that MapLibre can read directly, which is the fastest way to draw field outlines.

## Architecture and repo structure

One Next.js app on Vercel: three API routes proxy the live services, and static JSON files carry everything that was preprocessed.

```text
Live path (every field click):
  Browser: Next.js UI (map, field panel, cards; scoring re-ranks on every slider move)
    -> API routes on Vercel: /api/climate (POWER), /api/history (CropScape), /api/soil (Soil Data Access)
      -> Live public services: NASA POWER, USDA CropScape CDL, USDA Soil Data Access
  Browser map layer: NASA GIBS vegetation tiles, loaded directly by MapLibre

Preprocessing path (runs once on Saturday):
  Bulk data sources: AppEEARS (SMAP soil moisture), GRACE/GRACE-FO mascons, NASS QuickStats (stretch)
    -> Python preprocessing (samples county centroids, writes small JSON files)
      -> Static JSON in /public (105 county files, rotation library, sample field cache)
        -> read by the browser at load
```

The browser runs the scoring itself, so slider changes never wait on the network; only a new field click calls the API routes.

```text
field-shift/
  app/
    page.tsx                  map + panels
    api/climate/route.ts      POWER proxy with cache
    api/history/route.ts      CropScape proxy, lat/lon to EPSG:5070
    api/soil/route.ts         Soil Data Access proxy
  components/
    MapView.tsx               MapLibre, county overlay, sample buttons
    FieldSummary.tsx          rotation chips, soil facts
    ConditionsCharts.tsx      Recharts + trend labels
    FieldCalendar.tsx         12-month crop vs bare strip
    RotationCard.tsx          score breakdown + five fields
    PrioritySliders.tsx
    Glossary.tsx  AboutData.tsx  Disclaimer.tsx
  lib/
    scoring.ts                rotation scoring
    trends.ts                 Mann-Kendall + Sen's slope
    indicators.ts             heat days, frost dates, season totals; et.ts (FAO-56 reference ET); calendar.ts (bare months); types.ts (data contracts)
    cdl.ts                    CDL code to crop name
    units.ts                  mm to in, C to F
  data/
    rotations.json            rotation library, sourced
    crops.json                per-crop attributes, sourced
    calendar.json             Kansas planting and harvest windows
  public/data/
    counties.geojson
    counties/{fips}.json      SMAP, GRACE, NASS per county
    samples/{id}.json         cached responses for 3 sample fields
  scripts/
    appeears_request.py       submit and download SMAP
    build_county_json.py      aggregate to per-county JSON
    grace_kansas.py
    nass_yields.py
  README.md                   includes the AI-use disclosure
  SPEC.md                     this document, exported
```

## Rotation library and scoring model

Ten common Kansas rotations live in `rotations.json`; each is scored 0 to 100 on seven indicators, and the farmer's sliders set the weights. Crop water use is computed per field with the FAO-56 method from POWER weather; every other crop attribute is compiled from published sources (FAO-56 tables, the USDA Usual Planting and Harvesting Dates handbook, K-State Research and Extension) with a source link on each value, and Angel reviews them; any value not yet sourced is stored as `null` and shown as "not sourced yet", never guessed.

### Rotation library

| Rotation | Typical region | Water | Why it is in the library |
| --- | --- | --- | --- |
| Continuous winter wheat | Statewide | Dryland | Very common baseline; weed and disease buildup risk |
| Wheat-fallow | West | Dryland | Fallow stores moisture but leaves the field bare for long stretches |
| Wheat-sorghum-fallow | West, central | Dryland | Classic three-year option; sorghum handles drought better than corn |
| Wheat-corn-fallow | West, central | Dryland | Higher yield potential where moisture allows |
| Continuous corn | West | Irrigated | Highest water demand; the main groundwater pressure |
| Corn-wheat | West, central | Irrigated | Cuts irrigation demand by adding a winter crop |
| Corn-soybean | East | Rainfed | Soybean fixes nitrogen and breaks the corn rootworm cycle |
| Corn-soybean-wheat with double-crop soybean | East, central | Rainfed | More months of living cover |
| Wheat-cover crop-sorghum | Central, east | Dryland | Soil building; cover uses water, a risk in the dry west |
| Alfalfa then corn or wheat | Statewide | Either | Nitrogen fixing, deep roots, forage income; needs a buyer |

Region is decided from the point's long-term average precipitation from POWER, with band edges stored in config and cited, not by county lists.

### Indicators

| Indicator | Computed from | Higher score means |
| --- | --- | --- |
| Water fit | Dryland: crop water demand (FAO-56 from POWER weather) vs effective rain plus stored soil moisture, including moisture stored during fallow. Irrigated: how much irrigation the rotation needs | Demand fits what the field gets; on irrigated fields, less pumping |
| Heat and drought exposure | Hot days in each crop's sensitive window (POWER climatology) and the trend direction | Crops avoid the field's worst windows |
| Soil protection | Bare months per year times the higher of water erosion risk (SSURGO erodibility and slope) and wind erosion risk (SSURGO wind erodibility index) | Less bare soil where erosion risk is high |
| Soil building | Nitrogen fixing, residue level, cover crops, deep roots | More organic matter and structure over time |
| Pest and disease break | Number of distinct crops and longest run of the same crop | Pest cycles are interrupted |
| Market fit | Qualitative library field: local elevator market, or needs a buyer | Easy to sell locally |
| Simplicity | Number of crops and equipment needs vs the no-till toggle | Easier to run with current equipment |

```latex
\text{Score} = \frac{\sum_i w_i \, s_i}{\sum_i w_i}
```

Here s is an indicator score from 0 to 100 and w is its weight from the sliders. The existing rotation is always shown, even when it ranks last.

### How each card's five fields are written

Cards are filled from templates, not free text, so every claim traces to a number.

- **Why suggested:** the two indicators where this rotation beats the existing one by the most.
- **Evidence:** the actual values with a source chip, such as average growing season rain since 1981 from NASA POWER.
- **Benefits:** library benefits plus any computed advantage.
- **Information gaps:** what the tool cannot see: local prices, field history, irrigation rights, insurance rules, local disease pressure, and the coarse resolution of SMAP and GRACE.
- **Risks to verify locally:** library risks plus computed ones, such as a rising trend in July heat days during corn pollination, each ending with "check with your local K-State extension agent."

## Contracts and formulas

Every threshold, formula and data shape Fable needs is fixed here so nothing gets invented mid-build. Tuning constants live in `config/scoring.json` and are listed on the About the Data tab as "tool assumptions".

### Thresholds

| Name | Default | Basis |
| --- | --- | --- |
| Hot day | Daily max at or above 95°F | Common crop heat stress threshold; configurable |
| Freeze day | Daily min at or below 32°F | Standard freeze definition |
| Last spring freeze | Last freeze day from January to June | Derived from POWER daily data |
| First fall freeze | First freeze day from July to December | Derived from POWER daily data |
| Crop seasons | Usual planting and harvest dates for Kansas | USDA NASS Usual Planting and Harvesting Dates handbook; Crop Progress as a stretch refinement |
| Region (west, central, east) | Long-term average annual rain at the point, band edges in config | POWER; edges cited from K-State |
| Analysis window | 1981 to the last full year | POWER record start |
| Trend labels | p below 0.05 likely, 0.05 to 0.20 possible, else none | See SI layer |

### Formulas

1. **Reference ET:** FAO-56 Penman-Monteith, daily, from POWER `T2M_MAX`, `T2M_MIN`, `WS2M`, `ALLSKY_SFC_SW_DWN` and the point's elevation. Actual vapor pressure comes from dewpoint (`T2MDEW`), FAO-56's preferred method, with `RH2M` as the fallback. Unit-tested against the FAO-56 daily worked example.
2. **Crop water demand:** daily reference ET is summed to months on the server; demand is each month's ET times that month's average crop coefficient from the FAO-56 curve (initial, mid and end values and stage lengths from FAO-56; planting dates from the USDA handbook), summed over the season, in inches. Reported as the 10-year average plus its trend. FAO-56 coefficients describe a well-watered crop, so this is potential demand, and the card says so.
3. **Water fit:** for each crop year, supply is effective rain during the crop's season plus stored soil moisture at planting. Stored moisture is the rain that fell during the bare period before planting times a fallow efficiency, capped at the soil's available water storage. **Dryland:** score is 100 times (1 minus the shortfall as a share of demand), averaged over crop years. **Irrigated:** score falls as irrigation need rises, where irrigation need is demand minus supply in inches per year, averaged over the whole cycle and scaled against a cap in config, so the rotation that needs less pumping scores higher. Effective rain fraction and fallow efficiency come from K-State or USDA research with a source link, or are stored as tool assumptions. Stated limit: this is a seasonal water budget, not a daily soil water model.
4. **Heat and drought exposure:** average hot days inside each crop's sensitive window (from `crops.json`) over the last 10 years, scaled against a cap in config; a likely rising trend lowers the score by a configured penalty.
5. **Soil protection:** share of the whole rotation cycle the field is bare, times erosion risk, where erosion risk is the higher of water risk (erodibility times slope, normalized) and wind risk (wind erodibility index, normalized). Score is 100 times (1 minus that product).
6. **Soil building:** points for a nitrogen-fixing crop, high residue, a cover crop and a deep-rooted crop, from library attributes, capped at 100.
7. **Pest and disease break:** rises with the number of distinct crops and falls with the longest run of the same crop.
8. **Market fit:** local elevator market scores highest, regional buyer middle, contract-only lowest.
9. **Simplicity:** falls with each extra crop, and drops further when the rotation needs no-till equipment the farmer does not have.
10. **Field calendar and bare months:** lay each crop's usual planting-to-harvest window (from `calendar.json`) on a month grid covering every year of the cycle; a month with no crop growing is bare. Wheat-sorghum-fallow, for example, is a 36-month grid with two long bare stretches.

### Data contracts

```ts
// /api/climate?lat=&lon=
type ClimateResponse = {
  lat: number; lon: number; elevationM: number;
  years: { year: number; seasonRainIn: number; hotDays: number;
           lastSpringFreezeDoy: number | null; firstFallFreezeDoy: number | null;
           meanTempF: number }[];
  // 12 entries per year, used for the water budget and the calendar overlays
  monthlyByYear: { year: number; month: number; rainIn: number; et0In: number; hotDays: number }[];
  monthlyNormals: { month: number; rainIn: number; tmaxF: number; tminF: number; et0In: number }[];
  trends: Record<string, { perDecade: number; linearPerDecade: number; pValue: number;
                           label: "likely" | "possible" | "none" }>;
  source: "NASA POWER"; fetchedAt: string;
};
// Crop water demand is computed in the browser from monthlyByYear and crops.json,
// so the API route does not depend on the crop library.

// /api/history?lat=&lon=
type HistoryResponse = {
  years: { year: number; cdlCode: number; crop: string }[];
  source: "USDA NASS Cropland Data Layer";
};

// /api/soil?lat=&lon=  (SSURGO columns to verify against the SDA docs)
type SoilResponse = {
  mukey: string; mapUnitName: string; texture: string | null;
  availableWaterIn: number | null;   // muaggatt.aws0100wta, cm to in
  organicMatterPct: number | null;   // chorizon.om_r, surface layer
  kFactor: number | null;            // chorizon.kwfact, surface layer
  windErodibilityIndex: number | null; // component.wei
  slopePct: number | null;           // muaggatt.slopegradwta
  hydrologicGroup: string | null;    // component.hydgrp
  source: "USDA NRCS SSURGO";
};

// A published value always travels with its source.
type Sourced<T> = { value: T; source: string } | null;

// Confirmed by Angel on 2026-11-14. Fallow has no id: a year with no planting is fallow.
// Double-crop soybean gets its own decision when its rotation is added.
type CropId = "winter_wheat" | "corn" | "grain_sorghum" | "soybean" | "alfalfa" | "cover_crop";

// data/crops.json
type Crop = {
  id: CropId; name: string; kind: "summer" | "winter" | "perennial" | "cover";
  kc: Sourced<{ ini: number; mid: number; end: number }>;
  stageDays: Sourced<{ ini: number; dev: number; mid: number; late: number }>;
  heatSensitiveMonths: Sourced<number[]>;
  nFixing: Sourced<boolean>;
  residue: Sourced<"low" | "medium" | "high">;
  rootDepth: Sourced<"shallow" | "medium" | "deep">;
  market: "local" | "regional" | "contract"; // tool assumption, listed in config
};

// data/calendar.json: usual Kansas dates, month-day strings such as "09-25"
type CropCalendar = Record<CropId, Sourced<{ plantStart: string; plantEnd: string;
                                             harvestStart: string; harvestEnd: string }>>;

// data/rotations.json
type Rotation = {
  id: string; name: string;
  // One entry per crop planting in the cycle. plantYear is 1-based within the cycle;
  // a winter crop planted in the fall of year 1 is harvested in year 2.
  // Years with no planting are fallow. Two plantings in one year = double crop or cover crop.
  cycleYears: number;
  plantings: { crop: CropId; plantYear: number }[];
  water: "dryland" | "irrigated" | "either"; regions: ("west" | "central" | "east")[];
  needsNoTill: boolean;
  benefits: { text: string; source: string }[]; risks: { text: string; source: string }[];
};

// config/scoring.json: tool assumptions, all shown on the About the Data tab
type ScoringConfig = {
  hotDayF: number; regionRainBandsIn: [number, number];
  growingSeasonMonths: [number, number]; // first and last month of "growing season rain"; tool assumption, April to September
  effectiveRainFraction: Sourced<number>; fallowEfficiency: Sourced<number>;
  irrigationNeedCapIn: number; hotDaysCap: number; risingTrendPenalty: number;
};
```

### Sample fields

In Phase 2, Fable picks one point each in Finney, Thomas and Brown counties where the Cropland Data Layer shows cropland in all 8 years, records the coordinates in `public/data/samples/`, and Angel confirms them on the map.

Confirmed by Angel on 2026-11-14: Finney at 37.96548, -100.72299 (corn in all 8 years), Thomas at 39.43677, -101.1914 (winter wheat and fallow in turn), Brown at 39.84979, -95.47566 (corn and soybeans in turn).

## SI layer: trends, anomalies and uncertainty

The tool's SI is explainable statistics: a trend test on 45 years of POWER data per field, anomaly scores for soil moisture, and a confidence label on every number, with an optional LLM summary that can only restate computed values.

### Trend detection

- **Series:** one value per year, 1981 to the last full year: growing season rain, days at or above 95°F, last spring freeze date, first fall freeze date, annual mean temperature.
- **Method:** Mann-Kendall test (with the tie correction, since day counts repeat) for whether a trend exists, Sen's slope for how big it is, reported per decade in plain words ("about 2 more hot days per decade").
- **Labels:** p below 0.05 is "likely trend", 0.05 to 0.20 is "possible trend", above that is "no clear trend".
- **Comparing approaches:** the About the Data tab shows Sen's slope next to an ordinary linear regression slope, and explains why Sen's is less thrown off by one extreme year such as a severe drought. This covers the challenge's invitation to compare statistical approaches.

### Anomalies

- **SMAP soil moisture:** this month's county value as a z-score against the same month across 2015 to now, shown as "wetter than usual", "about normal" or "drier than usual".
- The record is only about 11 years long, so the card says "short record" next to it.

### Uncertainty on every number

| Source | Approximate resolution | Confidence shown to the farmer |
| --- | --- | --- |
| SSURGO soil | Field scale | High for soil type; the map unit can still mix soils |
| Cropland Data Layer | 30 m pixel | High; single-pixel misclassification is possible, so the farmer can edit |
| SMAP soil moisture | 9 km | Medium: an area average, not one field |
| NASA POWER | About 50 km grid | Medium: regional climate, not a field station |
| GRACE water storage | Hundreds of km | Low for a field; useful only as a regional signal |

### Satellite vs ground, in plain words

Satellites and models see large areas the same way every day, back decades, but they average over many fields. A rain gauge or soil probe is exact for one spot and nowhere else. The tool uses satellites for the long view and tells the farmer where a local gauge or probe would sharpen the answer.

### Stretch: LLM plain-language summary

A server route sends only the computed JSON for the field (indicators, trends, card fields) to an LLM with an instruction to write three sentences for a farmer using only those numbers. The output is labeled "AI-generated summary" in the UI and disclosed in the README.

## Build phases for Fable

Eight phases in order, each ending with a Vercel deploy so there is always a working version to submit. Angel reviews at the end of every phase and reviews the compiled agronomy values in Phase 3. Phase 1 is a thin end-to-end slice so something real is live by early afternoon.

### Build rules (paste these into CLAUDE.md)

- Read SPEC.md fully before writing code; build phases in order; deploy to Vercel at the end of each phase.
- Never invent agronomic or climate numbers. A published fact with no source yet is `null` and the UI shows "not sourced yet".
- Every external call goes through an API route with a 15-second timeout and a cache; on failure, fall back to the cached sample or show a clear error, never a blank screen.
- Store metric, display imperial (inches, °F).
- No NASA logos, insignia or mission patches; no images of people.
- Mark AI-written files with a header comment and keep the README's AI disclosure section current.
- TypeScript strict, small components, layout works at 390 px wide.
- Commit after each task with a clear message.

* Use the Stragents workflow: one `spec/YYYY-MM-DD-<phase>/` folder per phase with `task.md` (acceptance criteria), `plan.md` (steps) and `implementation.md` (what was built, what AI wrote, what was verified).
* No fake implementations and no false completion claims: never report a test, build or deploy as passing without seeing its output.
* Mock mode: `npm run dev:mock` serves the cached sample fields so UI work never waits on live APIs.

- Data first: before writing any fact, threshold, crop value or rotation claim, find a public source (NASA, USDA, NOAA, K-State, FAO) and link it. A tuning constant we chose ourselves (a cap, weight or penalty) is not a fact: store it as a tool assumption in `config/scoring.json` so it shows on the About the Data tab.

### Phase 0: Setup (45 min)

- [ ] Next.js app with TypeScript, App Router, Tailwind and shadcn/ui; install `maplibre-gl`, `react-map-gl`, `recharts`, `proj4`, `zustand`
- [ ] README skeleton with an AI disclosure section
- [ ] Deploy a placeholder Kansas map to Vercel

* [ ] Port the Stragents design layer: tokens and fonts from `styles.css`, `components/ui/`, `layout/page.tsx`, `states.tsx`, `tone-badge.tsx`, `lib/motion.ts`, `lib/feedback.ts`

- [ ] `lib/types.ts` from the Data contracts section

Done when: the public URL loads a Kansas map in a private window.

### Phase 1: First slice, one field end to end (live by about 1:30 PM)

- [ ] `/api/climate`: POWER daily data, 1981 to the last full year, for a point. Time the request first; if it runs over 5 seconds, split it into parallel decade requests and cache the result
- [ ] `lib/indicators.ts` (season rain, hot days) and `lib/trends.ts` (Mann-Kendall with tie correction, Sen's slope, linear slope for comparison), unit-tested against a published worked example
- [ ] Map click and one sample field button open the panel with one climate chart, its trend label and a source badge
- [ ] Mock mode serving a cached sample response
- [ ] Deploy

Done when: on the public URL, the Finney County sample shows hot days since 1981 with a trend label.

### Phase 2: Field facts

- [ ] `/api/history`: CDL value for the last 8 available years, fetched in parallel; lat/lon converted to EPSG:5070; CDL codes mapped to crop names
- [ ] `/api/soil`: SDA point query returning texture, available water storage, organic matter, erodibility, wind erodibility and slope
- [ ] Field summary in the panel: rotation chips the farmer can edit, and soil facts
- [ ] Freeze dates and monthly climatology added to the indicators
- [ ] Pick the 3 sample fields and cache all three responses for each in `public/data/samples/`
- [ ] Confirm one NASA GIBS vegetation tile loads in Web Mercator, and record the layer name

Done when: each sample field shows its 8-year rotation and soil in under 5 seconds, and a bad point returns a clean error.

### Phase 3: Water, calendar and scoring

- [ ] `lib/et.ts`: FAO-56 Penman-Monteith reference ET from POWER daily data, unit-tested against the FAO-56 daily worked example; the climate route then returns monthly ET
- [ ] JSON schemas for `crops.json`, `rotations.json` and `calendar.json`, with a `source` field on every published value
- [ ] Load the values compiled by the research run, each with its source link; Angel reviews and approves them
- [ ] Multi-year calendar per rotation: crop months and bare months across every year of the cycle
- [ ] `lib/scoring.ts`: seven indicators, weighted score, card field templates
- [ ] Sanity tests: with "save water" at maximum, continuous irrigated corn never ranks first; on a dry western field, wheat-fallow beats continuous wheat on water fit
- [ ] Start with six rotations (the four dryland wheat rotations, continuous corn, corn-soybean); add double-crop, cover crop and alfalfa once those pass

Done when: every sample field produces a ranked list with a visible breakdown, moving a weight reorders it, and the sanity tests pass.

### Phase 4: Full UI

- [ ] Rotation cards with the five fields; priority sliders and toggles
- [ ] All conditions charts with trend labels
- [ ] Field calendar, one 12-month row per year of the rotation
- [ ] "Use my location", and the disclaimer banner on every view
- [ ] Last, and skipped if late: one NASA GIBS vegetation layer toggle with a legend and date picker

Done when: user flow steps 1 to 7 work on desktop and at phone width.

### Phase 5: Explain

- [ ] Glossary with at least 8 terms: evapotranspiration, soil moisture anomaly, NDVI, frost risk, water balance, available water capacity, erodibility, trend confidence, fallow
- [ ] About the Data tab: every source with link and purpose, the resolution table, Sen's vs linear slope comparison, satellite vs ground explanation

Done when: every science word in the UI has a tooltip.

### Phase 6: Preprocessed NASA data (runs in parallel from kickoff)

- [ ] `appeears_request.py`: submit the SMAP point request for 105 county centroids at kickoff
- [ ] `grace_kansas.py`: Kansas-average water storage series
- [ ] `build_county_json.py`: write `public/data/counties/{fips}.json` when AppEEARS finishes
- [ ] Wire features 12 and 14 (SMAP anomaly, GRACE trend) into the UI

Done when: any county shows its soil moisture status.

### Phase 7: Stretch, in order

- [ ] Scenario slider (feature 15)
- [ ] LLM summary (feature 16)
- [ ] NASS county yields (feature 17)
- [ ] Printable summary (feature 18)

* [ ] Field outline on click from Crop Sequence Boundaries (PMTiles)
* [ ] "Soils in this field" table from a Soil Data Access polygon query
* [ ] Draw or fix your field outline (Terra Draw)
* [ ] More GIBS layers: SMAP soil moisture, GRACE

Cut whatever is not done by noon Sunday.

### Phase 8: Polish and verify

- [ ] Walk the full user flow on all three sample fields and two random points
- [ ] Test the public URL in a private window and on a phone
- [ ] Take screenshots for the deck
- [ ] Final README: what it does, how it works, data used, limitations, AI disclosure

Done when: the submission checklist below is fully ticked.

## Working with Fable

Use ultracode only where work fans out into independent pieces, stay in normal mode for sequential work, and run one workflow per phase with Angel's review in between. Ultracode spends far more of the plan's usage per request, so leaving it on all weekend risks hitting a limit on Sunday.

### Mode per phase

| Work | Mode | Why |
| --- | --- | --- |
| Compile sourced crop data (FAO-56 coefficients, usual planting and harvest dates, fallow efficiency, K-State attributes) | `/deep-research` in the background, started at kickoff | Cross-checks sources; this is the data-first rule |
| Phases 0 and 1: scaffold, Stragents port, first slice, `types.ts` | Normal | Sequential; everything else builds on it |
| Phase 2: history and soil routes | `ultracode:` one agent per route plus a verifier | Independent files, parallelizes cleanly |
| Phase 3: ET, calendar, scoring | Normal, Angel reviews | Core logic Angel must understand and defend |
| Phase 4: UI | Normal | Tightly connected components would collide |
| Phase 5: glossary and About the Data | `ultracode:` small, each item source-checked | Independent content |
| Phase 6: preprocessing scripts | `ultracode:` in the background | Runs while UI work continues |
| Phase 8: final check | `ultracode:` adversarial review, one agent per acceptance criterion, then "keep fixing until typecheck and tests pass" | Catches what a tired solo builder misses |

Trigger a single workflow by starting the prompt with `ultracode:`. Turn session-wide ultracode off with `/effort ultracode off` before quick UI tweaks.

### Setup that keeps parallel agents safe

1. **Contracts first.** The data contracts become `lib/types.ts` in Phase 0, so parallel agents build against the same shapes.
2. **One owner per file.** In a fan-out, each agent owns its own files or folder, or works in an isolated copy.
3. **One workflow per phase.** Runs can't take input mid-way, so phase boundaries are the review checkpoints; commit and deploy after each.
4. **Allow routine commands up front** in `.claude/settings.json` (npm scripts, tests, typecheck, git add and commit); `git push` always asks, so deploys stay Angel's call.
5. **Workflow size set to medium**, and check `/workflows` for per-agent token use.
6. **Cheaper models for simple stages**, such as glossary text and test runs; Fable for the hard parts.
7. **Three custom subagents** in `.claude/agents/`: `data-verifier` (every number has a source), `ui-reviewer` (design rules and accessibility), `test-runner` (typecheck, lint, tests, build; reports only).

### Files in the repo before kickoff

- `CLAUDE.md`: build rules, workflow, commands, AI disclosure rules
- `SPEC.md`: this document, exported
- `.claude/settings.json`: permission rules and workflow size
- `.claude/agents/data-verifier.md`, `ui-reviewer.md`, `test-runner.md`

These are planning and configuration files, not app code, so committing them tonight is fine.

### Kickoff prompts

Start the research run first, in the background:

```text
/deep-research For winter wheat, corn, grain sorghum, soybean and alfalfa in Kansas, find: (1) FAO-56 single crop coefficients (Kc ini, mid, end) and growth stage lengths most applicable to the U.S. Great Plains; (2) usual planting and harvesting dates for Kansas from the USDA NASS Usual Planting and Harvesting Dates for U.S. Field Crops handbook; (3) the heat-sensitive growth stage months in Kansas from K-State Research and Extension; (4) whether each crop fixes nitrogen, its residue level and its rooting depth; (5) fallow precipitation storage efficiency and effective rainfall fraction for dryland cropping in the central Great Plains, from K-State or USDA ARS research. Cite the exact source page for every value and mark anything not found as not found.
```

Then Phase 0 in the main session:

```text
Read SPEC.md and CLAUDE.md in full. Then do Phase 0 only, in normal mode:
1. Scaffold the Next.js app per the spec's stack and folder structure.
2. Port the Stragents design layer listed in SPEC.md from github.com/Ange1Balderas/hack_the_midwest (agent-flow branch): clone it to a temp folder outside this repo and copy only the listed files.
3. Create lib/types.ts from the Data contracts section.
4. Create spec/2026-11-14-phase-0-setup/ with task.md, plan.md and implementation.md.
5. Run typecheck and build, show me the output, and commit.
Then stop for my review. Do not start Phase 1.
```

## Timeline

The MVP has to be live on Vercel by 11:30 PM Saturday so Sunday is only explainers, extra data, polish and the submission.

| Day | Start | Block |
| --- | --- | --- |
| Sat Nov 14 | 9:30 AM | Prep: AppEEARS request, starter files in the repo |
| Sat Nov 14 | 10:00 AM | Kickoff; start the /deep-research run right after |
| Sat Nov 14 | 10:45 AM | Phase 0: setup, deploy |
| Sat Nov 14 | 11:30 AM | Phase 1: first slice live |
| Sat Nov 14 | 1:30 PM | Phase 2: field facts |
| Sat Nov 14 | 3:30 PM | Phase 3: water, calendar, scoring |
| Sat Nov 14 | 7:30 PM | Phase 4: full UI |
| Sat Nov 14 | 11:30 PM | Checkpoint: MVP live |
| Sun Nov 15 | 8:00 AM | Phase 5: explainers |
| Sun Nov 15 | 9:30 AM | Phase 6: county data |
| Sun Nov 15 | 11:00 AM | Phase 7: stretch goals |
| Sun Nov 15 | 12:00 PM | Checkpoint: cut unfinished stretch; Phase 8: polish, verify |
| Sun Nov 15 | 3:00 PM | Deck, README, form fields |
| Sun Nov 15 | 6:00 PM | First submission, then improve |
| Sun Nov 15 | 11:59 PM | Deadline |

Kickoff is 10:00 AM Saturday, inside the Prep block. Ask the Local Lead then when Kansas City's local judging happens, since it may come before the 11:59 PM global deadline; if it does, move the first submission earlier.

## Demo deck

Seven slides, the hard limit for global judging, built from real app screenshots; export to PDF and host it on GitHub or a public Google Drive link so judges never hit a login.

1. **Title:** project name and tagline, team name, Angel Balderas, challenge name (Field Shift: Adapting Farms with NASA Data), Kansas City local event.
2. **The problem:** Kansas farmers face shifting heat, less predictable rain and falling groundwater, and picking a rotation means guessing. One real number from a sample field, such as its hot-day trend since 1981.
3. **What it does:** screenshot of the map and ranked rotation cards, with the three-step flow: click a field, set priorities, compare rotations.
4. **How it works:** the architecture picture, simplified, with the NASA datasets named (POWER, SMAP, MODIS, GRACE) next to the USDA soil and crop data.
5. **Evidence, not black boxes:** close-up of one card showing evidence, gaps, risks and confidence labels; the line that it supports farmer judgment and does not replace it.
6. **Impact and what's next:** who it helps, then next steps such as field boundaries, local rain gauges and soil probes, other states, and review by K-State extension agents.
7. **Links:** live app URL, GitHub repo, data sources, AI-use note.

Everything in English, no images of anyone under 18, no NASA logos.

## Submission checklist

Every required field must be filled before "Submit for Judging" works; submit a rough version by 6 PM Sunday, then resubmit as often as needed before 11:59 PM Central.

### Account and hosting

- [ ] Team created under the Kansas City, KS local event, and you are a confirmed participant (not waitlisted)
- [ ] Profile Full Name set the way you want it on the certificate
- [ ] FortiGuard Web Filter Classification requested for the Vercel URL (category: web-based application, company name: N/A)

### Project page fields

- [ ] Project Name
- [ ] High-Level Project Summary: what you built, how it answers the challenge, why it matters
- [ ] Link to Project Demo: 7-slide PDF, public, opened in a private window to test
- [ ] Link to Final Project: Vercel URL and GitHub repo, both public
- [ ] Detailed Project Description: what it does, how it works, benefits, goals, tools and languages used
- [ ] Use of SI: describe it accurately. Claude researched data sources, proposed the architecture and scoring model, and wrote most of the code; Angel chose the challenge and the Kansas focus, confirmed each design decision, and reviewed the data and results. Note the LLM summary feature if built
- [ ] NASA Data: POWER, SMAP SPL3SMP\_E, MODIS vegetation index via GIBS, GRACE/GRACE-FO mascons, each with a link
- [ ] Space Agency Partner Data and Other References: Cropland Data Layer, SSURGO via Soil Data Access, NASS QuickStats, K-State Research and Extension, FAO-56, the USDA Usual Planting and Harvesting Dates handbook, Census boundaries, the Stragents repo, and libraries (Next.js, MapLibre GL, OpenFreeMap tiles, shadcn/ui, Recharts, proj4, earthaccess)

### Rules to double-check

- [ ] AI-generated code and text marked in the README and file headers; any LLM output labeled in the UI
- [ ] Everything in English, no images of anyone under 18, no NASA logos
- [ ] Demo stays within 7 slides
- [ ] Terms and Conditions box and "Confirm All Work is Original" box checked
- [ ] "Submit for Judging" clicked and the confirmation banner seen
- [ ] Participant certificate downloaded from your profile

## Risks and fallbacks

The biggest risk is a live service failing during judging, so the three sample fields always run from cached data and every live call degrades to a clear message.

| Risk | Fallback |
| --- | --- |
| CropScape slow, down, or SSL errors | Cached sample fields; farmer picks their crops from a dropdown instead |
| Soil Data Access slow | 15-second timeout, cached samples, "soil data unavailable" note on the card |
| POWER slow for 45 years of daily data | Not yet timed: test it first in Phase 1. Split into parallel decade requests, cache per point, and precompute annual indicators for the 105 county centroids as a backup |
| AppEEARS results late | SMAP and NDVI stay stretch features; hide them rather than show placeholders |
| GRACE file wrangling eats time | Cut it first; it is the lowest-confidence signal anyway |
| Agronomy values not sourced in time | Source the six core crops first (wheat, corn, sorghum, soybean, alfalfa, fallow); the rest show "not sourced yet" |
| Fable drifts from the spec | Review at the end of each phase; every phase is deployed and committed, so revert is one step |
| Judges' network blocks the site | FortiGuard request filed Saturday; README with screenshots as a backup link |
| Hitting usage limits on the plan | Keep prompts phase-sized; MVP phases first, stretch last |
| Solo fatigue | Sleep after the 11:30 PM MVP checkpoint; Sunday starts at 8 AM |

## Tonight's prep and open decisions

About 20 minutes of setup tonight means Fable can start Phase 0 the moment kickoff ends.

### Tonight

- [x] Create an Earthdata Login account and confirm AppEEARS sign-in
- [x] Create the GitHub repo (Space-Apps-2026-Field-Shift)
- [x] Create team ANGEL under the Kansas City, KS event (challenge: Field Shift)
- [ ] Unzip `field-shift-starter.zip` into the repo root (`SPEC.md`, `CLAUDE.md`, `.claude/`), commit and push
- [ ] Check that Vercel can see the repo
- [ ] Check the Full Name on your Space Apps profile
- [ ] Sleep

### Saturday, 9:30 AM, before kickoff

- [ ] Have Fable generate the 105 Kansas county centroids as a CSV
- [ ] Submit the AppEEARS point request: SMAP SPL3SMP\_E v006 at all county centroids, 2015 to now

### Still open

- [ ] Project name
- [ ] Confirm or change each row in Design decisions
- [ ] Confirm with Stragents teammates that reusing the frontend files is fine

## Sources

- Challenge statement and resources: spaceappschallenge.org challenge page for Field Shift (pasted by Angel)
- [Space Data Atlas: Field Shift datasets and starter code](https://spacedata.swapniltamse.com/challenges/field-shift-adapting-farms/)
- [NASA POWER API docs](https://power.larc.nasa.gov/docs/services/api/)
- [CropScape web service examples](https://nassgeodata.gmu.edu/CropScape/devhelp/getexamples.html)
- [Soil Data Access advanced queries](https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html)
- [AppEEARS adds SMAP SPL3SMP\_E v006](https://www.earthdata.nasa.gov/data/alerts-outages/appeears-version-3-58-released-adding-new-versions-smap-products)

* [PSA Cover Crop Species Selector repo](https://github.com/precision-sustainable-ag/dst-selector)
* [NOAA Climate Explorer repo](https://github.com/nemac/climate-explorer)
* [OpenFreeMap repo](https://github.com/hyperknot/openfreemap)

- [Stragents, Hack the Midwest repo (agent-flow branch)](https://github.com/Ange1Balderas/hack_the_midwest/tree/agent-flow)

* [FAO-56 Crop Evapotranspiration](https://www.fao.org/docrep/X0490E/X0490E00.htm)
* [K-State: Accessing ET for Kansas Irrigation Scheduling](https://bookstore.ksre.ksu.edu/pubs/MF2850.pdf)
* [Crop Sequence Boundaries (Earth Engine catalog page)](https://gee-community-catalog.org/projects/csb/)
* [Crop Sequence Boundaries on Source Cooperative](https://source.coop/fiboa/us-usda-cropland)
* [KGS High Plains aquifer data](https://www.kgs.ku.edu/HighPlains/data/index.shtml)
* [ARS Crop Sequence Calculator](https://www.ars.usda.gov/plains-area/mandan-nd/ngprl/docs/crop-sequence-calculator/)

- [NASA GIBS map library usage](https://nasa-gibs.github.io/gibs-api-docs/map-library-usage)
- [MapLibre PMTiles example](https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/)
- [MapLibre Terra Draw example](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/)
- [farmOS-map](https://www.github.com/farmOS/farmOS-map)
- [OneSoil review, Future Farming](https://futurefarming.com/smart-farming/tools-data/onesoil-a-handy-free-fieldmap-and-scouting-app)
- [EOSDA Crop Monitoring](https://eos.com/products/crop-monitoring/)
- [AcreValue soil maps](https://acrevalue.com/resources/feature-insights/soil-maps-productivity)

* [USDA NASS Usual Planting and Harvesting Dates for U.S. Field Crops](https://esmis.nal.usda.gov/concern/publications/vm40xr56k)
* [Claude Code docs: dynamic workflows and ultracode](https://code.claude.com/docs/en/workflows)
