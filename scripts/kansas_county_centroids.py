# AI-assisted: written with Claude, reviewed by Angel Balderas.
"""The 105 Kansas county centroids, and the NASA AppEEARS request built from them.

SPEC.md, "Saturday, 9:30 AM, before kickoff": "Have Fable generate the 105 Kansas county
centroids as a CSV" and "Submit the AppEEARS point request: SMAP SPL3SMP_E v006 at all
county centroids, 2015 to now". This script does the first and prepares the second. It
submits nothing: submitting needs an Earthdata Login, which only Angel has.

It writes two files:
  data/kansas-county-centroids.csv   fips, county, latitude, longitude
  data/appeears-smap-request.json    the request body for POST /task of the AppEEARS API

Sources:
  Counties and centroids: U.S. Census Bureau TIGERweb, State_County map service, layer 1
  ("Counties"), fields GEOID, NAME, CENTLAT and CENTLON.
  https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1
  Request format: AppEEARS API documentation, "Submit task" and "Task object".
  https://appeears.earthdatacloud.nasa.gov/api/
  Product and layer names: the AppEEARS product listing, read on 2026-11-15.
  https://appeears.earthdatacloud.nasa.gov/api/product/SPL3SMP_E.006

Run from the repo root. It needs Python 3.9 or newer and nothing else:
  python scripts/kansas_county_centroids.py
"""

import csv
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

TIGERWEB_COUNTIES = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"
)
KANSAS_STATE_FIPS = "20"
KANSAS_COUNTIES = 105

# The same rectangle as lib/kansas.ts: the extent of Kansas in the TIGERweb States layer.
WEST, SOUTH, EAST, NORTH = -102.051769, 36.993016, -94.588387, 40.003166

# AppEEARS product listing: "Enhanced L3 Radiometer Soil Moisture", 9000 m, daily,
# 2015-03-31 to present.
SMAP_PRODUCT = "SPL3SMP_E.006"
SMAP_FIRST_DAY = date(2015, 3, 31)
# The morning and the evening soil moisture, each with the flag that says how good the
# reading is. Which of them the app uses is decided when the county files are built.
SMAP_LAYERS = [
    "Soil_Moisture_Retrieval_Data_AM_soil_moisture",
    "Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag",
    "Soil_Moisture_Retrieval_Data_PM_soil_moisture_pm",
    "Soil_Moisture_Retrieval_Data_PM_retrieval_qual_flag_pm",
]

TIMEOUT_SECONDS = 60


def fetch_counties() -> list[dict]:
    """Every Kansas county from TIGERweb, in order of its FIPS code."""
    query = urllib.parse.urlencode(
        {
            "where": f"STATE='{KANSAS_STATE_FIPS}'",
            "outFields": "GEOID,NAME,CENTLAT,CENTLON",
            "returnGeometry": "false",
            "orderByFields": "GEOID",
            "f": "json",
        }
    )
    with urllib.request.urlopen(f"{TIGERWEB_COUNTIES}?{query}", timeout=TIMEOUT_SECONDS) as answer:
        body = json.load(answer)
    if "error" in body:
        raise RuntimeError(f"TIGERweb answered with an error: {body['error']}")
    if body.get("exceededTransferLimit"):
        raise RuntimeError("TIGERweb cut the answer short, so the list is not complete.")
    return [
        {
            "fips": feature["attributes"]["GEOID"],
            "county": feature["attributes"]["NAME"],
            "latitude": float(feature["attributes"]["CENTLAT"]),
            "longitude": float(feature["attributes"]["CENTLON"]),
        }
        for feature in body["features"]
    ]


def problems(counties: list[dict]) -> list[str]:
    """What is wrong with the list, in plain words. An empty list means it is sound."""
    found = []
    if len(counties) != KANSAS_COUNTIES:
        found.append(f"expected {KANSAS_COUNTIES} counties, found {len(counties)}")
    codes = [county["fips"] for county in counties]
    if len(set(codes)) != len(codes):
        found.append("a FIPS code appears twice")
    for county in counties:
        code = county["fips"]
        if len(code) != 5 or not code.isdigit() or not code.startswith(KANSAS_STATE_FIPS):
            found.append(f"{county['county']}: {code!r} is not a Kansas county FIPS code")
        inside = WEST <= county["longitude"] <= EAST and SOUTH <= county["latitude"] <= NORTH
        if not inside:
            found.append(f"{county['county']}: its centroid is outside the Kansas rectangle")
    return found


def appeears_request(counties: list[dict], last_day: date) -> dict:
    """The body of an AppEEARS point request for every centroid, 2015-03-31 to `last_day`."""
    return {
        "task_type": "point",
        "task_name": "field-shift-kansas-smap",
        "params": {
            # AppEEARS writes its dates as month-day-year.
            "dates": [
                {
                    "startDate": SMAP_FIRST_DAY.strftime("%m-%d-%Y"),
                    "endDate": last_day.strftime("%m-%d-%Y"),
                }
            ],
            "layers": [{"product": SMAP_PRODUCT, "layer": layer} for layer in SMAP_LAYERS],
            "coordinates": [
                {
                    "id": county["fips"],
                    "category": county["county"],
                    "latitude": county["latitude"],
                    "longitude": county["longitude"],
                }
                for county in counties
            ],
        },
    }


def main() -> int:
    data = Path("data")
    if not data.is_dir():
        print("Run this from the repo root: no data/ folder here.", file=sys.stderr)
        return 2

    counties = fetch_counties()
    found = problems(counties)
    if found:
        print("The county list from TIGERweb is not what was expected:", file=sys.stderr)
        for line in found:
            print(f"  {line}", file=sys.stderr)
        return 1

    centroids = data / "kansas-county-centroids.csv"
    with centroids.open("w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=["fips", "county", "latitude", "longitude"])
        writer.writeheader()
        writer.writerows(counties)

    request = data / "appeears-smap-request.json"
    request.write_text(
        json.dumps(appeears_request(counties, date.today()), indent=2) + "\n", encoding="utf-8"
    )

    print(f"{len(counties)} counties, every centroid inside the Kansas rectangle.")
    print(f"Wrote {centroids.as_posix()} and {request.as_posix()}.")
    print("Nothing was sent to AppEEARS.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
