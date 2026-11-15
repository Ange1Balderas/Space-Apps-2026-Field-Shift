# Phase 6: Preprocessed NASA data. Implementation notes

Date: 2026-11-15 (Sunday), 00:16 to 00:20 CST, unattended. Status: **blocked, not done.** One piece is delivered: the county centroids and a request ready for Angel to submit. No county shows a soil moisture status, which is this phase's "done when". Committed locally, not pushed.

## Why it is blocked

SMAP comes through NASA AppEEARS and GRACE through `earthaccess`. Both need an Earthdata Login, and this machine has none set up: no `~/.netrc` and no environment variable (checked by existence only, nothing read). It also has no Python environment for the project. SPEC.md's own fallback is to hide SMAP rather than show placeholders, and to cut GRACE first.

## What was built

- `scripts/kansas_county_centroids.py`. It asks the U.S. Census Bureau's TIGERweb service for every county of state 20 with its centroid, and refuses the answer unless it holds 105 counties, each with its own Kansas FIPS code and a centroid inside the Kansas rectangle of `lib/kansas.ts`. It needs Python 3.9 or newer and no package. It sends nothing to NASA.
- `data/kansas-county-centroids.csv`: `fips`, `county`, `latitude`, `longitude`, 105 rows. SPEC.md's Saturday prep asks for this file.
- `data/appeears-smap-request.json`: the body of an AppEEARS point request for all 105 centroids, 31 March 2015 to 15 November 2026, four layers of `SPL3SMP_E.006`: the morning and the evening soil moisture, each with its quality flag. **It was never submitted.**

AI wrote the script. The two data files are its output.

## Verified

- The script ran on 2026-11-15 at about 00:19 CST and printed "105 counties, every centroid inside the Kansas rectangle."
- The CSV has 105 rows and 105 distinct FIPS codes, from 20001 (Allen County) to 20209 (Wyandotte County). Latitudes run from 37.15 to 39.83 and longitudes from -101.81 to -94.76. The three sample counties are in it: Finney 20055, Thomas 20193, Brown 20013.
- The product is real and available. AppEEARS's public product listing, read the same night, gives `SPL3SMP_E.006` as "Enhanced L3 Radiometer Soil Moisture", 9000 m, daily, from 2015-03-31 to the present, from the NSIDC DAAC (https://doi.org/10.5067/M20OXIZHY3RJ). Its layer listing holds the four layer names used, with soil moisture valid from 0.02 to 0.5 and -9999 for no value.
- The request's shape follows AppEEARS's API documentation, "Submit task" and "Task object": `task_type`, `task_name`, `params.dates` as month-day-year, `params.layers` as product and layer, `params.coordinates` as latitude and longitude with an optional `id` and `category`.

Not verified: that AppEEARS accepts this request, how long it takes, and what the result file looks like. None of that can be known without signing in.

## For Angel, in the morning

These three commands are AppEEARS's own examples with this project's file. The first asks for your Earthdata password at the prompt and stores nothing.

1. Sign in and get a token. Put your Earthdata username in place of `YOUR_USERNAME`:

```bash
curl --request POST --user YOUR_USERNAME --header "Content-Length: 0" "https://appeears.earthdatacloud.nasa.gov/api/login"
```

2. Submit the request, from the repo root, with the token from step 1 in place of `YOUR_TOKEN`. The answer holds a `task_id`:

```bash
curl --request POST --data @data/appeears-smap-request.json --header "Content-Type: application/json" --header "Authorization: Bearer YOUR_TOKEN" "https://appeears.earthdatacloud.nasa.gov/api/task"
```

3. Ask how it is going, with the `task_id` from step 2. The request is also listed on the AppEEARS website, under Explore, once you are signed in there:

```bash
curl --header "Authorization: Bearer YOUR_TOKEN" "https://appeears.earthdatacloud.nasa.gov/api/task/YOUR_TASK_ID"
```

When it is done, download the results file (a `.csv`) into `data/raw/`, which Git ignores, and say so. Do not paste the token or the password into the chat or into a file in the repo.

## What is left of this phase, once the results exist

1. `scripts/build_county_json.py`: from the daily values, the mean of each month in each county, and this month set against the same month in the other years (SPEC.md, "Anomalies"). Then `public/data/counties/{fips}.json`.
2. A decision for Angel: SPEC.md names the three labels (wetter than usual, about normal, drier than usual) but not where one ends and the next begins. That cut-off is a tool assumption for `config/scoring.json`. Also which reading to use, morning or evening, and which quality flags to keep.
3. Which county a point is in. That needs the county outlines (`public/data/counties.geojson`), which are not in the repo yet.
4. The status on screen with "short record" beside it, a source badge, the glossary term soil moisture anomaly, and SMAP's row in the resolution table.
5. GRACE, if at all: `grace_kansas.py` needs a Python environment with `earthaccess` and `xarray`, and the login.

## Left alone

- No soil moisture from another dataset in SMAP's place.
- No screen, card or badge for SMAP or GRACE.
- The county outline on the map, which SPEC.md's layout mentions. It needs the outline file and is not part of this slice.
