# Project page: draft text for each field

**AI-written draft (Claude), for Angel to edit before anything is pasted into the project page.** Written unattended on 2026-11-15. Every statement is taken from the README or from what the app showed in the Phase 8 walk-through (`implementation.md` in this folder). The length limit of each field on the project page is not known here: check it when pasting.

SPEC.md's submission checklist was written before the build. It names four things the app does **not** use: SMAP, GRACE, NASS QuickStats and earthaccess. They are left out below on purpose. Listing them as used would be a false claim.

## Project name

Field Shift Kansas (the name in the app's header. SPEC.md still lists the project name as open, so confirm it.)

## High-level project summary

Field Shift Kansas is a web app for Kansas farmers and the people who advise them. Pick a point on the map of Kansas, or one of three sample fields, and it shows four things for that place: the crops grown there in each of the last 8 years (USDA Cropland Data Layer), the soil under it (USDA soil survey), how growing conditions there have changed since 1981 (NASA POWER), and the field's own rotation scored beside the rotations usual in that part of Kansas.

Four sliders set what matters to the farmer: saving water, protecting soil, income and simplicity. The rotation cards re-order as the sliders move. Each card gives seven scores, a field calendar of the months with a crop in the ground and the bare months, and five fields: why the rotation is suggested, the evidence, its benefits, the information gaps and the risks to verify locally, every sentence with its source.

It answers the challenge by putting NASA Earth data, local soil data, crop values and the farmer's own priorities into one comparison of at least three rotations, including the one the field already runs, and by saying what it does not know. A score compares rotations with each other. It is not a forecast of yield or price. The tool supports farmer judgment. It does not replace it.

## Detailed project description

**What it does**

- Click anywhere on the map of Kansas, use your location, or pick a sample field (Finney, Thomas or Brown County).
- Crops grown here: the crop at that point in each of the last 8 years. Any year can be changed by hand.
- Soil: the soil map unit under the point, with its texture, available water, organic matter, slope, erodibility by water and by wind, and hydrologic group.
- Rotations: the field's own rotation and the library rotations usual in that part of Kansas, each scored from 0 to 100 on seven indicators (water fit, heat and drought exposure, soil protection, soil building, pest and disease break, market fit, simplicity). Four sliders weigh them, and a switch says whether the field can be irrigated.
- Field calendar: for each year of a rotation, the months with a crop in the ground and the bare months, under the months that are usually hot, dry or frosty at that place.
- Conditions: four charts from 1981 to the last full year (hot days, growing-season rain, last spring freeze, first fall freeze), each with a trend label: likely trend, possible trend or no clear trend.
- Terms: each science word has a plain-language definition and its source, on hover, keyboard focus or tap.
- About the data: every source and what the tool takes from it, how fine each source is, a satellite record against a gauge on the farm, two ways to measure a trend side by side, how the scores are worked out with every number the tool chose, and the glossary.
- Vegetation from space: a switch on the map draws NASA's vegetation index (NDVI) in 16-day pictures going back to March 2000. It is a picture only: no score uses it.

**How it works**

The point chosen on the map goes to three routes of the app's own, one for each fact: NASA POWER for the weather, the USDA Cropland Data Layer for the crop history and the USDA soil survey for the soil. Each route has a 15-second timeout, a cache and a plain-language error, and if one fails the other two still show.

Crop water demand is reference evapotranspiration (FAO-56 Penman-Monteith, from NASA POWER weather) times the FAO-56 crop coefficient, added up over the crop's usual Kansas season. It is set against the rain in the season plus the rain banked on the bare field before planting, on the average of the last ten years. The other indicators use the hot days in each crop's sensitive month, the bare months of the rotation with the soil survey's erodibility and slope, and published crop traits.

A Mann-Kendall test decides each trend label, with p below 0.05 as likely, 0.05 to 0.20 as possible and anything higher as no clear trend. The change per decade is Sen's slope.

**What it showed on the three sample fields**

At all three the first fall freeze comes later than it did in 1981: about 3.3 days later per decade in Finney and Thomas counties and about 4.3 in Brown County, a likely trend each time. Hot days show no clear trend in Finney and Brown counties and a possible trend in Thomas County. The tool says so instead of rounding a weak signal up.

**Benefits**

- The public record for one field in one place, in inches and °F, with no GIS skill needed.
- Every number and sentence can be traced: a source badge opens its entry on the About the data tab.
- It names its own gaps on every card, and tells the farmer to check with the local K-State extension agent.

**Limits and what is next** (the README's "Limitations" and "What is not built" sections have the full list)

- It works from one point, not a field outline, and its weather is the record of an area roughly 35 miles across, not of the field.
- Six of the ten planned rotations are loaded.
- NASA SMAP soil moisture and GRACE groundwater are planned and not built. The request for SMAP at the 105 Kansas county centroids is written and has not been submitted.
- Not built: a rainfall and temperature scenario slider, county yields, a printable summary.

**Tools and languages**

TypeScript, Next.js 16 (App Router), React, Tailwind CSS 4, shadcn/ui on Radix UI, MapLibre GL JS through react-map-gl with OpenFreeMap tiles, Recharts, Zustand, proj4, Vitest. One Python script (standard library). Deployed on Vercel.

## Links

- Live app: https://space-apps-2026-field-shift.vercel.app (shows the last build pushed; push first)
- Code: https://github.com/Ange1Balderas/Space-Apps-2026-Field-Shift
- Demo deck: to add

## Use of AI

Claude (Anthropic), running in Claude Code, researched the data sources, proposed the architecture and the scoring model, and wrote most of the code, the glossary definitions and the About the data text. Angel Balderas chose the challenge and the Kansas focus, decided each design choice, and reviews the code, data and results.

Files written mostly by AI start with an "AI-assisted" comment, and the README's "AI use" section says what AI wrote and what Angel decided. The About the data tab says in the app that its explanations are AI-generated. No text is written by AI while the app runs: every sentence on a rotation card is fixed wording or a template filled with computed numbers.

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
