<!-- AI-assisted: compiled with Claude, reviewed by Angel Balderas. -->

# The data and config files

**These files were compiled with AI.** Claude collected the values in a research run on 2026-11-14 ([research/2026-11-14-crop-values.md](../research/2026-11-14-crop-values.md)). Before a value was loaded, a second AI check (the project's `data-verifier`) opened its source again and confirmed it. Angel Balderas reviews the files. JSON has no comments, so this page is where the acknowledgement lives.

## What each file holds

| File | Shape in `lib/types.ts` | Holds |
| --- | --- | --- |
| `data/crops.json` | `Crop[]` | Crop coefficients, growth-stage lengths, heat-sensitive months, nitrogen fixing, residue and rooting depth for six crops |
| `data/calendar.json` | `CropCalendar` | Usual Kansas planting and harvest windows |
| `data/rotations.json` | `Rotation[]` | The six rotations compared so far, with their sourced benefits and risks |
| `config/scoring.json` | `ScoringConfig` | Constants the tool chose: caps, points, penalties and which indicators each slider weighs |
| `data/glossary.json` | `GlossaryEntry[]`, in `lib/glossary.ts` | The glossary: each term with a plain-language definition and its source, or marked as the tool's own |
| `data/sources.json` | `SourceEntry[]`, in `lib/about.ts` | Every source the About the data tab lists, with its links and, where it is not worked out from the values that cite it, its purpose |
| `data/kansas-county-centroids.csv` | `fips`, `county`, `latitude`, `longitude` | The 105 Kansas counties with their centroids, from the U.S. Census Bureau's TIGERweb service. Written by `scripts/kansas_county_centroids.py`. The app does not read it yet |
| `data/appeears-smap-request.json` | An AppEEARS point request | The request for NASA SMAP soil moisture at those 105 centroids, 2015 to now. **Never submitted**: it needs an Earthdata Login. Written by the same script |

`lib/library.ts` reads the first four files and checks their shape when the app is built and when the tests run. `lib/glossary.ts` and `lib/about.ts` do the same for the glossary and the source list.

## How to read a value

- `{ "value": ..., "source": "..." }` is a published value with where it is printed. Every source has a link.
- An extra `"assumption"` means the value is **the tool's own pick** among published numbers, or is worked out from them. It says what the source prints and what the tool did. The app shows such a value as a tool assumption.
- `null` means **not sourced yet**. Nothing is filled in for it, and whatever depends on it has no score.

## Where the values come from

| Value | Source | Tool's own pick? |
| --- | --- | --- |
| Crop coefficients (`kc`) | FAO Irrigation and Drainage Paper 56, Table 12 | Yes, where the table prints a range, a group value or several rows |
| Growth-stage lengths (`stageDays`) | FAO-56, Table 11 | Yes: one row per crop, then scaled to the Kansas season |
| Planting and harvest windows | USDA NASS, Usual Planting and Harvesting Dates (Handbook 628, 2010), Kansas, "most active" dates | No |
| Heat-sensitive months | K-State production handbooks for the stage; USDA NASS Kansas Crop Progress 2026 (statewide five-year averages) for when the stage happens. Wheat's month, June, is from the K-State handbook's own text | Yes: for corn, sorghum and soybeans, the month in which the statewide average passes half of the crop; for wheat, reading June from two places in the handbook |
| Nitrogen fixing | K-State handbooks (soybeans, alfalfa), UC Davis (wheat), University of Nebraska (corn), K-State MF2586 (sorghum) | Sorghum only |
| Residue class | K-State MF2604; USDA NRCS Nebraska Conservation Planning Sheet No. 4 | No |
| Rooting depth class | K-State L904, Table 2; K-State C683 for alfalfa | Yes, except alfalfa: the table gives depths, not classes |
| Benefits and risks of a rotation | K-State and USDA NRCS publications, one source per sentence | No |
| Usable share of rain | K-State MF3066, Table 9, a simulated water budget | Yes |
| Fallow efficiency | Nielsen and Vigil (2010), USDA-ARS | Yes: one published average used for every bare period |

Several sources are from outside Kansas and are labelled where they are used. FAO-56 is a worldwide handbook, and the stage-length rows the tool uses were recorded in Idaho, in Spain and California, in the United States, Pakistan and the Mediterranean, and in the central United States. The residue classes come from a USDA NRCS sheet written for Nebraska, and the fallow efficiency from USDA-ARS work at Akron, Colorado.

The rotations themselves (which crops, in what order, dryland or irrigated, and the part of Kansas each is usual in) come from the rotation library table in [SPEC.md](../SPEC.md). That table is this project's own design, not a published source.

## The constants in `config/scoring.json`

None of these is a published fact. Each is a choice this tool made, kept in one file so that it can be shown and changed.

| Constant | Value | What it does, and why this value |
| --- | --- | --- |
| `hotDayF` | 95 | A day counts as hot at or above 95°F (SPEC.md) |
| (in the code) | 10 years | `RECENT_YEARS` in `lib/scoring.ts`: water fit and heat exposure use the last 10 full years (SPEC.md, formulas 2 and 4). It is shown on the About the data tab with the rules that have no constant |
| `growingSeasonMonths` | April to September | The months of "growing season rain". No public source defines them for Kansas |
| `regionRainBandsIn` | 23.1 and 31.6 in | A field is west, central or east by its average yearly rain. The edges are halfway between K-State's long-term averages for the western, middle and eastern thirds of Kansas: 20.2, 26.0 and 37.2 in, 1895 to 2015 ([MF3335](https://bookstore.ksre.ksu.edu/pubs/MF3335.pdf)) |
| `irrigationNeedCapIn` | 24 in a year | An irrigated rotation that needs this much or more scores 0 on water fit, and one that needs none scores 100. Two feet of water a year; a round number, not a measured limit. By Angel's decision of 2026-11-14 an irrigated rotation also never scores higher than it would on rain alone, so its water fit is the lower of the two |
| `hotDaysCap` | 31 | A crop with 31 or more hot days in its sensitive month scores 0 on heat exposure; 31 is the length of the longest month |
| `risingTrendPenalty` | 10 points | Taken off the heat score where hot days are likely rising |
| `erosion.kTimesSlopeCap` | 4 | Water erosion risk is the soil's K factor times its slope in percent, and counts as highest at 4 or more, for example a K factor of 0.4 on a 10 percent slope |
| `erosion.windIndexCap` | 100 | Wind erosion risk counts as highest at a wind erodibility index of 100 tons per acre per year or more |
| `soilBuildingPoints` | 25 each | Points for a nitrogen-fixing crop, a high-residue crop, a cover crop and a deep-rooted crop |
| `marketScores` | 100, 50, 0 | Local elevator, regional buyer, contract only |
| `simplicity` | 20 per extra crop, 30 without no-till equipment | Taken off 100 |
| `priorityIndicators` | see the file | Save water weighs water fit. Protect soil weighs soil protection and soil building. Income weighs heat exposure, pest break and market fit. Simplicity weighs simplicity |

Each crop's `market` in `crops.json` is also a tool assumption: the four grains go to a local elevator, and alfalfa needs a regional buyer. A cover crop is not sold: its `market` entry is there only because the shape requires one, and the scoring ignores it.

## The glossary and the source list

Added in Phase 5, on 2026-11-14, and written with AI like the rest.

- An entry of `data/glossary.json` with `"own": false` is a published definition, reworded in plain language. Its `source` names the publication, quotes the passage it was reworded from and links to it. `here` says what this tool does with the term, and `note` holds a caution about the term itself.
- An entry with `"own": true` is a term or a rule of the tool's own. Its text says what the code does, and it was checked against the code, not against a publication.
- A number in an entry is written as a name in braces, such as `{hotDayF}`, and filled in from `config/scoring.json` and the constants in the code when the app is built. The list of names is `GLOSSARY_VALUES` in `lib/glossary.ts`.
- Seven soil definitions come from the USDA soil survey's own descriptions of its attributes. They have no page of their own: they are rows of the table `sdvattribute` in Soil Data Access. To read them again, paste this into the [query page](https://sdmdataaccess.sc.egov.usda.gov/Query.aspx): `SELECT attributename, attributedescription FROM sdvattribute WHERE attributename IN ('Surface Texture', 'Organic Matter', 'Representative Slope', 'Available Water Supply, 0 to 100 cm', 'K Factor, Whole Soil', 'Wind Erodibility Index', 'Hydrologic Soil Group')`.
- The slope the app shows is the survey's value for the whole map unit (column `slopegradwta`). No description of that column was found, so the glossary cites the survey's definition of slope gradient and says only that the figure is for the map unit.
- `data/sources.json` holds every link that a value, a sentence or a definition cites. A test fails when one is missing. For a publication behind crop values, what it is used for is not written by hand: `lib/about.ts` works it out from the values that cite it.
- Two terms that SPEC.md lists are not in the glossary: soil moisture anomaly and NDVI. Nothing on screen uses them yet.

## Not loaded yet

- Alfalfa's stage lengths, heat-sensitive months, residue class and usual dates; everything for cover crops.
- Four of the ten rotations in SPEC.md: corn-wheat, corn-soybean-wheat with double-crop soybean, wheat-cover crop-sorghum, and alfalfa then corn or wheat.
- Which rotations need no-till equipment: every rotation has `needsNoTill: false` until a source says otherwise.
