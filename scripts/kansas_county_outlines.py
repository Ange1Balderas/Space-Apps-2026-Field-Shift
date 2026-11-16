# AI-assisted: written with Claude, reviewed by Angel Balderas.
"""
Write public/data/counties.geojson: the outline of each of the 105 Kansas counties.

    python scripts/kansas_county_outlines.py

Needs Python 3.9 or newer and no package. It sends nothing to NASA and needs no login.

Source: U.S. Census Bureau TIGERweb, Generalized_ACS2023/State_County map service, layer 12
"Counties 5M" (the generalized 1:5,000,000 cartographic boundaries), state 20 = Kansas,
in WGS 84 (outSR=4326), as GeoJSON:
https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer/12

The 5M layer (its maxScale is 5,000,000) gives the simplified outlines SPEC.md asks for
("Kansas counties, simplified"): 2,519 vertices and about 60 KB at four decimal places. The
500K layer (layer 11), measured the same way when this script was written on 2026-11-15, had
9,682 vertices and about 200 KB. Four decimal places are a step of about 11 m north-south
and 9 m east-west at this latitude. The file is used to find the county a chosen point is
in, so the county's soil moisture record can be shown; the record is a 9 km grid cell at the
county's center, so a generalized border a short distance from the surveyed one changes
nothing a farmer would see. Only the outline is simplified: the point the farmer chose keeps
its five decimals.

The script refuses an answer that does not hold exactly 105 counties with distinct Kansas
FIPS codes, or any outline with a vertex outside the Kansas rectangle of lib/kansas.ts.
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

SERVICE = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer/12/query"
)
PARAMS = {
    "where": "STATE='20'",
    "outFields": "GEOID,NAME,BASENAME",
    "outSR": "4326",
    "f": "geojson",
}
ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "public" / "data" / "counties.geojson"
DECIMALS = 4
EXPECTED_COUNTIES = 105
# lib/kansas.ts KANSAS_BOUNDS, with a 0.01 degree margin for the generalized lines.
WEST, SOUTH, EAST, NORTH = -102.051769 - 0.01, 36.993016 - 0.01, -94.588387 + 0.01, 40.003166 + 0.01


def fetch():
    url = SERVICE + "?" + urllib.parse.urlencode(PARAMS)
    req = urllib.request.Request(url, headers={"Accept": "application/geo+json, application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def rounded(coordinates):
    return [[[round(x, DECIMALS), round(y, DECIMALS)] for x, y in ring] for ring in coordinates]


def main():
    answer = fetch()
    features = answer.get("features")
    if not isinstance(features, list):
        sys.exit("TIGERweb did not answer with features: %s" % json.dumps(answer)[:300])
    out = []
    fips_seen = set()
    for feature in features:
        props = feature["properties"]
        fips = str(props["GEOID"])
        if not (fips.startswith("20") and len(fips) == 5):
            sys.exit("Not a Kansas county FIPS code: %s" % fips)
        if fips in fips_seen:
            sys.exit("FIPS code listed twice: %s" % fips)
        fips_seen.add(fips)
        geometry = feature["geometry"]
        if geometry["type"] == "Polygon":
            polygons = [geometry["coordinates"]]
        elif geometry["type"] == "MultiPolygon":
            polygons = geometry["coordinates"]
        else:
            sys.exit("Unexpected geometry %s for %s" % (geometry["type"], fips))
        for polygon in polygons:
            for ring in polygon:
                for x, y in ring:
                    if not (WEST <= x <= EAST and SOUTH <= y <= NORTH):
                        sys.exit("Vertex outside Kansas for %s: %s, %s" % (fips, y, x))
        coords = [rounded(polygon) for polygon in polygons]
        out.append(
            {
                "type": "Feature",
                "properties": {"fips": fips, "name": str(props["NAME"]), "county": str(props["BASENAME"])},
                "geometry": {"type": "MultiPolygon", "coordinates": coords}
                if len(coords) > 1
                else {"type": "Polygon", "coordinates": coords[0]},
            }
        )
    if len(out) != EXPECTED_COUNTIES:
        sys.exit("Expected %d counties, got %d" % (EXPECTED_COUNTIES, len(out)))
    out.sort(key=lambda f: f["properties"]["fips"])
    collection = {
        "type": "FeatureCollection",
        "name": "Kansas counties, U.S. Census Bureau TIGERweb Generalized_ACS2023 Counties 5M, WGS 84, 4 decimals",
        "features": out,
    }
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    with TARGET.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(collection, handle, separators=(",", ":"))
        handle.write("\n")
    vertices = sum(
        len(ring)
        for f in out
        for polygon in ([f["geometry"]["coordinates"]] if f["geometry"]["type"] == "Polygon" else f["geometry"]["coordinates"])
        for ring in polygon
    )
    print("%d counties, %d vertices, %s bytes -> %s" % (len(out), vertices, format(TARGET.stat().st_size, ","), TARGET.relative_to(ROOT)))


if __name__ == "__main__":
    main()
