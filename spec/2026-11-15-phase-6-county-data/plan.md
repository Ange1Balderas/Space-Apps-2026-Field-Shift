# Phase 6: Preprocessed NASA data. Plan

Two sittings. The first, in the night of 2026-11-15 (00:16 to 00:20 CST), unattended, could not sign in to NASA and stopped at a request ready to send. The second, the evening of 2026-11-15 (from about 18:30 CST, on Angel's laptop, Angel present), builds everything that needs no login while the request runs, so the data drops into place the moment it arrives. Nothing is pushed by Claude.

## The night sitting, with no login

1. `scripts/kansas_county_centroids.py`, standard library only: read the 105 Kansas counties and their centroids from the U.S. Census Bureau's TIGERweb service, refuse the answer unless it has 105 counties with distinct Kansas FIPS codes and every centroid inside the Kansas rectangle, and write `data/kansas-county-centroids.csv`.
2. From the same list, write `data/appeears-smap-request.json`: the body of an AppEEARS point request for SMAP SPL3SMP_E v006 at every centroid, from the product's first day to today. The product, its layers and the request's shape are read from AppEEARS's own public listing and API documentation, not from memory. Nothing is sent.
3. Write Angel's steps for the morning, as exact commands.
4. Record what is not built and why.

## The evening sitting

In the order that gets the request to NASA soonest, then uses the wait.

1. **The submission, as a script Angel runs** (`scripts/appeears_request.py`). Standard library only. `submit` asks for the Earthdata username at the prompt and the password with `getpass`, signs in, sends the prepared request and keeps the task id and the 48-hour token in `data/raw/`, which Git ignores. `status`, `wait` and `download` follow. The endpoints come from the AppEEARS API documentation, read tonight. Angel types the login in the terminal; Claude never sees it.
2. **County outlines** (`scripts/kansas_county_outlines.py` → `public/data/counties.geojson`): the Census Bureau's generalized 1:5M county layer for Kansas, 105 polygons, four decimal places. Checked for 105 distinct FIPS codes and no vertex outside the Kansas rectangle.
3. **Which county a point is in** (`lib/counties.ts`): even-odd point-in-polygon over the outlines, fetched once per page. Tests place the three sample fields in Finney, Thomas and Brown counties and a Nebraska point in none.
4. **The sources first**, before any number is written: the SMAP user guide (NSIDC) for what is measured, the depth, the passes, the grid and the start date; AppEEARS's public product and quality listings for the valid range, the fill value and the quality flag's bits; NOAA's Climate Prediction Center for "near normal" as the middle third. Each goes into `data/sources.json`, and the choices the tool makes on top go into `config/scoring.json` as a sourced assumption (the 0.43 standard-deviation band) and a plain constant (5 readings a month).
5. **The county builder** (`scripts/build_county_json.py`): from the AppEEARS CSV, the monthly means per county from the 6 a.m. reading on days with a quality flag of 0 or 8, then the last full month set against the same month in the other years as a z-score. Writes `public/data/counties/{fips}.json` (`CountyMoisture` in `lib/types.ts`). Tried on a made-up CSV in the expected layout, written to a scratch folder, before any real data exists. The label itself is decided in the browser from the config, so the About tab and the label cannot disagree.
6. **The status on screen** (`components/SoilMoisture.tsx`, wired through `lib/field-client.ts` and `lib/field-store.ts` as a fourth fact that loads, fails and retries on its own, for sample fields too): the label, the month against its usual, "Short record", a source badge that opens the SMAP entry on the About tab, and the glossary term soil moisture anomaly. Loading, error, no-county and no-record states; the no-record state is what every county shows until the data is built.
7. **The About tab**: a new group of sources, "Prepared in advance"; SMAP's row in the resolution table with SPEC.md's wording; the two new tool assumptions; the rule for which month is shown.
8. Typecheck, lint, tests, build. `data-verifier` on the new facts, `ui-reviewer` on the card. Fix what they find.
9. When AppEEARS finishes: `download`, then `build_county_json.py`, then look at the three sample counties and two others on the local build, then commit the 105 files with the rest.

## Not in this phase

- GRACE/GRACE-FO (feature 14). SPEC.md says to cut it first; it needs `earthaccess`, `xarray` and the same login, and the deadline is tonight.
- The county outline drawn on the map. The file now exists; drawing it is a map change outside this slice.
- Soil moisture in any score. SPEC.md shows it as a status only.
