# Project page: draft text for each field

**AI-written draft (Claude), for Angel to edit before anything is pasted into the project page.** First written unattended on 2026-11-15. Reworded the same afternoon, at Angel's request, into simpler first-person words; the facts are the same. Every statement is taken from the README or from what the app showed in the Phase 8 walk-through (`implementation.md` in this folder). The length limit of each field on the project page is not known here: check it when pasting.

SPEC.md's submission checklist was written before the build. It names four things the app does **not** use: SMAP, GRACE, NASS QuickStats and earthaccess. They are left out below on purpose. Listing them as used would be a false claim.

## Project name

Field Shift Kansas (the name in the app's header. SPEC.md still lists the project name as open, so confirm it.)

## High-level project summary

Field Shift Kansas is a web app for Kansas farmers and the people who advise them. You pick a point on the map of Kansas, or one of three sample fields, and it shows four things for that place: the crops grown there in each of the last 8 years (USDA Cropland Data Layer), the soil under it (USDA soil survey), how growing conditions there have changed since 1981 (NASA POWER), and the field's own rotation scored next to the rotations usual in that part of Kansas.

Four sliders let the farmer say what matters most: saving water, protecting soil, income and simplicity. The rotation cards re-order as the sliders move. Each card shows seven scores, a calendar of the months with a crop in the ground and the bare months, and five short parts: why the rotation is suggested, the evidence, its benefits, the information gaps and the risks to check locally. Every sentence has its source.

I built it to answer the challenge this way: it puts NASA Earth data, local soil data, crop values and the farmer's own priorities into one comparison of at least three rotations, including the one the field already runs. It also says what it does not know. A score compares rotations with each other. It is not a forecast of yield or price. The tool supports farmer judgment. It does not replace it.

## Detailed project description

**What it does**

- Click anywhere on the map of Kansas, use your location, or pick a sample field (Finney, Thomas or Brown County).
- Crops grown here: the crop at that point in each of the last 8 years. You can change any year by hand.
- Soil: the soil mapped under the point, with its texture, available water, organic matter, slope, how easily water and wind erode it, and its hydrologic group.
- Rotations: the field's own rotation and the rotations usual in that part of Kansas. Each one gets seven scores from 0 to 100: water fit, heat and drought exposure, soil protection, soil building, pest and disease break, market fit and simplicity. Four sliders weigh them, and a switch says whether the field can be irrigated.
- Field calendar: for each year of a rotation, the months with a crop in the ground and the bare months, under the months that are usually hot, dry or frosty at that place.
- Conditions: four charts from 1981 to the last full year (hot days, growing-season rain, last spring freeze, first fall freeze). Each has a trend label: likely trend, possible trend or no clear trend.
- Terms: each science word has a plain-language definition and its source. You see it on hover, keyboard focus or tap.
- About the data: every source and what the tool takes from it, how fine each source is, a satellite record compared with a gauge on the farm, two ways to measure a trend side by side, how the scores are worked out with every number the tool chose, and the glossary.
- Vegetation from space: a switch on the map draws NASA's vegetation index (NDVI) in 16-day pictures going back to March 2000. It is a picture only. No score uses it.
- County outlines on the map, with the chosen point's county marked.
- Each crop's potential water demand comes with its trend since 1984, tested like the climate charts.
- What if the rain changes? A slider scores the rotations with 30% less to 10% more rain in every month of the recent average. Only water fit changes, and the ranking says when a scenario is on.
- Print summary: one button prints a one-page sheet for the field, with the crops grown, the soil, my priorities as I set them, my current rotation and the three best matches with their seven scores, the four climate trends and the sources. What prints is what was on screen.

**How it works**

The point you pick goes to three routes of the app's own, one for each fact: NASA POWER for the weather, the USDA Cropland Data Layer for the crop history and the USDA soil survey for the soil. Each route has a 15-second timeout, a cache and a plain-language error. If one fails, the other two still show.

How much water a well-watered crop would use (its potential demand) is worked out with the FAO-56 method: reference evapotranspiration (Penman-Monteith, from NASA POWER weather) times the FAO-56 crop coefficient, added up over the crop's usual Kansas season. That is set against the rain in the season plus the rain stored on the bare field before planting, on the average of the last ten years. The other scores use the hot days in each crop's sensitive month, the bare months of the rotation with the soil survey's erodibility and slope, and published crop traits.

A Mann-Kendall test decides each trend label: p below 0.05 is likely, 0.05 to 0.20 is possible, and anything higher is no clear trend. The change per decade is Sen's slope.

**What I saw on the three sample fields**

At all three, the first fall freeze comes later than it did in 1981: about 3.3 days later per decade in Finney and Thomas counties and about 4.3 in Brown County. It is a likely trend each time. Hot days show no clear trend in Finney and Brown counties and a possible trend in Thomas County. The tool shows each of those labels as it is.

**Benefits**

- The public record for one field in one place, in inches and °F, from one click on a map.
- Every sentence on a card has its source, and every number the tool chose is listed on the About the data tab. A source badge opens its entry there.
- It names its own gaps on every card, and tells the farmer to check with the local K-State extension agent.

**Limits and what is next** (the README's "Limitations" and "What is not built" sections have the full list)

- It works from one point, not a field outline. Its weather is the record of an area roughly 35 miles across, not of the field.
- Seven of the ten planned rotations are loaded.
- NASA SMAP soil moisture is built up to the data: the county lookup, the script that turns NASA's answer into one small file per county, and a "Soil moisture now" card that labels the county's last month wetter, about normal or drier than usual. I sent the request for all 105 Kansas county centroids to NASA AppEEARS, and NASA had not finished it by the deadline, so the card stays hidden until the files exist. GRACE groundwater is not built.
- Not built: the temperature half of the scenario slider, a summary written by a language model, county yields.

**Tools and languages**

TypeScript, Next.js 16 (App Router), React, Tailwind CSS 4, shadcn/ui on Radix UI, MapLibre GL JS through react-map-gl with OpenFreeMap tiles, Recharts, Zustand, proj4, Vitest. One Python script (standard library). Deployed on Vercel.

## Links

- Live app: https://space-apps-2026-field-shift.vercel.app (shows the last build pushed; push first)
- Code: https://github.com/Ange1Balderas/Space-Apps-2026-Field-Shift
- Demo deck (7 slides, PDF): https://github.com/Ange1Balderas/Space-Apps-2026-Field-Shift/blob/main/docs/Field-Shift-Kansas-demo-deck.pdf

## Use of AI

I used Claude (Anthropic), running in Claude Code. Claude researched the data sources, proposed the architecture and the scoring model, and wrote most of the code, the glossary definitions, the About the data text and the first draft of the text on this page. I chose the challenge and the Kansas focus, decided each design choice, and review the code, data and results at the end of each build phase. When this draft was written, I had not yet reviewed the work Claude did unattended on the night of 2026-11-15, or the glossary and About the data text.

Files written mostly by AI start with an "AI-assisted" comment, and the README's "AI use" section says what AI wrote and what I decided. The About the data tab says in the app that its explanations are AI-generated. No text is written by AI while the app runs: every sentence on a rotation card is fixed wording or a template filled with computed numbers.

The published crop values were checked against their sources by a second AI pass before they were loaded. The glossary, the source list and the About the data text were checked against their sources by further AI passes, and what those found was corrected.

(Before pasting: the README says today which work Angel has not reviewed yet. Bring this field and that section into line with what is true when you submit.)

## NASA data

- NASA POWER (Prediction Of Worldwide Energy Resources), daily data through its API: daily maximum and minimum temperature, precipitation, sunlight, dew point, humidity and wind from 1981 to the last full year. https://power.larc.nasa.gov/docs/services/api/ and its methodology, https://power.larc.nasa.gov/docs/methodology/
- NASA GIBS (Global Imagery Browse Services), layer `MODIS_Terra_L3_NDVI_16Day`: the vegetation index (NDVI) from the MODIS instrument on the Terra satellite, product MOD13Q1, as map tiles. https://nasa-gibs.github.io/gibs-api-docs/
- NASA Earth Observatory, "Measuring Vegetation (NDVI & EVI)": the definition of NDVI in the glossary. https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/

## Space agency partner data and other references

No data from a partner space agency is used.

- USDA NASS Cropland Data Layer: https://www.nass.usda.gov/research-and-science/cropland/sars1a , read from USDA's CDL image service, https://pdi.scinet.usda.gov/image/rest/services/CDL_WM/ImageServer
- USDA NRCS SSURGO through Soil Data Access: https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html
- FAO Irrigation and Drainage Paper 56 (Allen, Pereira, Raes and Smith, 1998): https://www.fao.org/4/X0490E/x0490e07.htm (Chapter 3), https://www.fao.org/4/X0490E/x0490e08.htm (Chapter 4), https://www.fao.org/4/X0490E/x0490e0b.htm (Chapter 6)
- USDA NASS, Field Crops Usual Planting and Harvesting Dates (Agricultural Handbook 628, 2010): https://esmis.nal.usda.gov/sites/default/release-files/vm40xr56k/dv13zw65p/w9505297d/planting-10-29-2010.pdf
- K-State Research and Extension publications, USDA NASS Kansas Crop Progress reports, a USDA NRCS residue sheet and a USDA-ARS fallow study: listed value by value in `data/README.md` and on the About the data tab.
- U.S. EPA QA/G-9, Guidance for Data Quality Assessment: https://www.epa.gov/sites/default/files/2015-06/documents/g9-final.pdf
- National Weather Service glossary: https://forecast.weather.gov/glossary.php?word=freeze
- NIST Special Publication 811, Appendix B.8: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8
- U.S. Census Bureau TIGERweb: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer
- OpenFreeMap basemap (OpenMapTiles schema, OpenStreetMap data): https://openfreemap.org/
- Stragents, an earlier team project whose design layer is reused: https://github.com/Ange1Balderas/hack_the_midwest/tree/agent-flow
- Libraries: Next.js, React, Tailwind CSS, shadcn/ui, Radix UI, MapLibre GL JS, react-map-gl, Recharts, Zustand, proj4, Sonner, Framer Motion, Lucide, and the Geist typeface through Fontsource.
