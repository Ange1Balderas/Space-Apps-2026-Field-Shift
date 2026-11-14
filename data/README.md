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

`lib/library.ts` reads the four files and checks their shape when the app is built and when the tests run.

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
| Heat-sensitive months | K-State production handbooks for the stage; USDA NASS Kansas Crop Progress 2026 for when the stage happens | Yes: the month in which the five-year average passes half of the crop |
| Nitrogen fixing | K-State handbooks (soybeans, alfalfa), UC Davis (wheat), University of Nebraska (corn), K-State MF2586 (sorghum) | Sorghum only |
| Residue class | K-State MF2604; USDA NRCS Nebraska Conservation Planning Sheet No. 4 | No |
| Rooting depth class | K-State L904, Table 2; K-State C683 for alfalfa | Yes, except alfalfa: the table gives depths, not classes |
| Benefits and risks of a rotation | K-State and USDA NRCS publications, one source per sentence | No |
| Usable share of rain | K-State MF3066, Table 9, a simulated water budget | Yes |
| Fallow efficiency | Nielsen and Vigil (2010), USDA-ARS | Yes: one published average used for every bare period |

Two sources are from outside Kansas and are labelled where they are used: the residue classes come from a USDA NRCS sheet written for Nebraska, and the fallow efficiency from USDA-ARS work at Akron, Colorado.

## The constants in `config/scoring.json`

None of these is a published fact. Each is a choice this tool made, kept in one file so that it can be shown and changed.

| Constant | Value | What it does, and why this value |
| --- | --- | --- |
| `hotDayF` | 95 | A day counts as hot at or above 95°F (SPEC.md) |
| `growingSeasonMonths` | April to September | The months of "growing season rain". No public source defines them for Kansas |
| `regionRainBandsIn` | 23.1 and 31.6 in | A field is west, central or east by its average yearly rain. The edges are halfway between K-State's long-term averages for the western, middle and eastern thirds of Kansas: 20.2, 26.0 and 37.2 in, 1895 to 2015 ([MF3335](https://bookstore.ksre.ksu.edu/pubs/MF3335.pdf)) |
| `irrigationNeedCapIn` | 24 in a year | An irrigated rotation that needs this much or more scores 0 on water fit. Two feet of water a year; a round number, not a measured limit |
| `hotDaysCap` | 31 | A sensitive month in which every day is hot scores 0 on heat exposure |
| `risingTrendPenalty` | 10 points | Taken off the heat score where hot days are likely rising |
| `erosion.kTimesSlopeCap` | 4 | Water erosion risk is the soil's K factor times its slope in percent, and counts as highest at 4 or more, for example a K factor of 0.4 on a 10 percent slope |
| `erosion.windIndexCap` | 100 | Wind erosion risk counts as highest at a wind erodibility index of 100 tons per acre per year or more |
| `soilBuildingPoints` | 25 each | Points for a nitrogen-fixing crop, a high-residue crop, a cover crop and a deep-rooted crop |
| `marketScores` | 100, 50, 0 | Local elevator, regional buyer, contract only |
| `simplicity` | 20 per extra crop, 30 without no-till equipment | Taken off 100 |
| `priorityIndicators` | see the file | Save water weighs water fit. Protect soil weighs soil protection and soil building. Income weighs heat exposure, pest break and market fit. Simplicity weighs simplicity |

Each crop's `market` in `crops.json` is also a tool assumption: the four grains go to a local elevator, alfalfa needs a regional buyer, and a cover crop is not sold.

## Not loaded yet

- Alfalfa's stage lengths, heat-sensitive months, residue class and usual dates; everything for cover crops.
- Four of the ten rotations in SPEC.md: corn-wheat, corn-soybean-wheat with double-crop soybean, wheat-cover crop-sorghum, and alfalfa then corn or wheat.
- Which rotations need no-till equipment: every rotation has `needsNoTill: false` until a source says otherwise.
