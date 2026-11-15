# Phase 6: Preprocessed NASA data. Task

Date: 2026-11-15. Source: SPEC.md, "Build phases for Fable" > "Phase 6: Preprocessed NASA data", with "Features" (12, 14), "Data sources", "Anomalies", "Risks and fallbacks" and "Tonight's prep and open decisions".

## Problem

The app's only NASA dataset is POWER. SPEC.md plans two more that have to be fetched in bulk and reduced to one small file per county before the app can show them: SMAP soil moisture, as this month against its own normal, and GRACE water storage, as a regional trend.

## Acceptance criteria (copied from SPEC.md)

- [ ] `appeears_request.py`: submit the SMAP point request for 105 county centroids at kickoff
- [ ] `grace_kansas.py`: Kansas-average water storage series
- [ ] `build_county_json.py`: write `public/data/counties/{fips}.json` when AppEEARS finishes
- [ ] Wire features 12 and 14 (SMAP anomaly, GRACE trend) into the UI

Done when: any county shows its soil moisture status.

## What SPEC.md says around it

- Saturday prep, not ticked: "Have Fable generate the 105 Kansas county centroids as a CSV" and "Submit the AppEEARS point request: SMAP SPL3SMP_E v006 at all county centroids, 2015 to now".
- Data sources: SMAP through AppEEARS and GRACE through `earthaccess` both need an Earthdata Login.
- Risks and fallbacks: "AppEEARS results late: SMAP and NDVI stay stretch features; hide them rather than show placeholders." "GRACE file wrangling eats time: cut it first; it is the lowest-confidence signal anyway."
- CLAUDE.md rule 8: Earthdata credentials stay in `~/.netrc` or environment variables. Rule 2: no placeholder success, no hardcoded results presented as real.

## What stands in the way

Checked on 2026-11-15 at 00:20 CST, by existence only, with nothing read:

- This machine has no `~/.netrc` and no environment variable for an Earthdata login. Only Angel can sign in.
- It has no Python environment for the project: no `.venv`, and none of `earthaccess`, `xarray`, `numpy`, `pandas` or `requests` is installed.
- Angel is asleep and asked for the work to go on unattended. The request to AppEEARS was never submitted, and AppEEARS answers a request in its own time.

So tonight this phase can deliver only what needs no login.
