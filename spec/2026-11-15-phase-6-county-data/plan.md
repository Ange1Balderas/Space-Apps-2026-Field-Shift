# Phase 6: Preprocessed NASA data. Plan

Date: 2026-11-15. Normal mode, unattended. Nothing is pushed.

## Tonight, with no login

1. `scripts/kansas_county_centroids.py`, standard library only: read the 105 Kansas counties and their centroids from the U.S. Census Bureau's TIGERweb service, refuse the answer unless it has 105 counties with distinct Kansas FIPS codes and every centroid inside the Kansas rectangle, and write `data/kansas-county-centroids.csv`.
2. From the same list, write `data/appeears-smap-request.json`: the body of an AppEEARS point request for SMAP SPL3SMP_E v006 at every centroid, from the product's first day to today. The product, its layers and the request's shape are read from AppEEARS's own public listing and API documentation, not from memory. Nothing is sent.
3. Write Angel's steps for the morning, as exact commands.
4. Record what is not built and why.

## Not tonight

- Submitting the request, and everything after it: `build_county_json.py`, the county files, the soil moisture status on screen, its glossary term and its row in the resolution table.
- GRACE. SPEC.md says to cut it first, and it needs a login and a Python environment.
- No soil moisture from another source in SMAP's place. Choosing a different dataset is Angel's call, as the change of crop history service was.
- No screen for data that does not exist. SPEC.md: hide it rather than show placeholders.
