# AI-assisted: written with Claude, reviewed by Angel Balderas.
"""
Turn the AppEEARS point sample of SMAP soil moisture into one small file per Kansas county.

    python scripts/build_county_json.py [data/raw/<results>.csv] [<output folder>]

Reads the results CSV that scripts/appeears_request.py downloaded (the newest *.csv in
data/raw/ when no path is given) and writes public/data/counties/{fips}.json, the shape
CountyMoisture in lib/types.ts. A second argument writes the files somewhere else instead,
for a dry run. Needs Python 3.9 or newer and no package.

What it does, per county (SPEC.md, "Anomalies"):
  1. Keeps the AM (6 a.m. descending overpass) soil moisture of SPL3SMP_E v006 on each day
     where the AM retrieval quality flag is 0 or 8. The product's user guide (NSIDC, version
     6, printed page 13): "A retrieval_qual_flag value of either 0 or 8 indicates high-quality
     retrievals (8 because a failed F/T retrieval does not affect soil moisture retrieval)."
     Bit 0 is "Recommended Quality" (AppEEARS's decoding of the flag,
     https://appeears.earthdatacloud.nasa.gov/api/quality/SPL3SMP_E.006/Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag).
     The value also has to be inside the valid range AppEEARS lists for the layer, 0.02 to
     0.5 m3/m3 (fill value -9999; https://appeears.earthdatacloud.nasa.gov/api/product/SPL3SMP_E.006).
     The PM (6 p.m.) reading is in the request but not used: the user guide states no
     preference between the two, and one reading a day keeps the months comparable. That is
     the tool's own choice.
  2. Averages the kept days of each calendar month. A month with fewer kept days than
     config/scoring.json soilMoisture.minDaysPerMonth is left out.
  3. Takes the last full calendar month (the month before the record's last day, or that
     month itself when the record ends on its last day) that has enough days, and sets its
     mean against the mean and standard deviation of the same calendar month in the other
     years: z = (this mean - their mean) / their standard deviation (sample, n - 1). With
     fewer than three other years, or no spread, z is null. The label (wetter than usual,
     about normal, drier than usual) is not decided here: the app reads z and the cut-off in
     config/scoring.json, so the About the data tab and the label cannot disagree.

Columns are found by name, not position: the ID column (the county FIPS code the request
gave each point), the Date column (YYYY-MM-DD), and the two layer columns whose names end in
"AM_soil_moisture" and "AM_retrieval_qual_flag". The PM layers in the request are read for
the count printed at the end but not used.
"""

from __future__ import annotations

import csv
import json
import math
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "public" / "data" / "counties"
CENTROIDS = ROOT / "data" / "kansas-county-centroids.csv"
CONFIG = ROOT / "config" / "scoring.json"
PRODUCT = "SPL3SMP_E.006"
LAYER = "Soil_Moisture_Retrieval_Data_AM_soil_moisture"
FLAG = "Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag"
VALID_MIN, VALID_MAX = 0.02, 0.5
GOOD_FLAGS = (0, 8)
QUALITY_RULE = (
    "6 a.m. reading on days whose retrieval quality flag is 0 or 8, the two values the user "
    "guide calls high quality, with a value from 0.02 to 0.5 m3/m3"
)


def pick_csv(argv):
    if len(argv) > 1:
        return Path(argv[1])
    candidates = sorted(RAW_DIR.glob("*.csv"), key=lambda p: p.stat().st_mtime)
    if not candidates:
        sys.exit("No CSV in data/raw/. Run scripts/appeears_request.py download first.")
    return candidates[-1]


def find_column(names, suffix, exact_only=False):
    """The one column whose name ends with the suffix. Exact match first; refuses two matches."""
    exact = [n for n in names if n == suffix or n.endswith("_" + suffix)]
    if len(exact) == 1:
        return exact[0]
    if exact_only:
        sys.exit("Expected one column for %s, found %s" % (suffix, exact))
    loose = [n for n in names if n.endswith(suffix) and "_Description" not in n]
    if len(loose) != 1:
        sys.exit("Expected one column ending in %s, found %s" % (suffix, loose))
    return loose[0]


def county_names():
    names = {}
    with CENTROIDS.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            names[row["fips"]] = row["county"]
    return names


def main(argv):
    source = pick_csv(argv)
    with CONFIG.open(encoding="utf-8") as handle:
        min_days = json.load(handle)["soilMoisture"]["minDaysPerMonth"]
    names = county_names()

    # fips -> (year, month) -> list of kept values
    kept = defaultdict(lambda: defaultdict(list))
    first_date, last_date = None, None
    rows = good = 0
    with source.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        id_col = "ID" if "ID" in columns else find_column(columns, "ID", exact_only=True)
        date_col = "Date" if "Date" in columns else find_column(columns, "Date", exact_only=True)
        value_col = find_column(columns, LAYER)
        flag_col = find_column(columns, FLAG)
        print("Reading %s\n  id: %s\n  date: %s\n  value: %s\n  flag: %s" % (source, id_col, date_col, value_col, flag_col))
        for row in reader:
            rows += 1
            fips = str(row[id_col]).strip().zfill(5)
            date = row[date_col].strip()[:10]
            if first_date is None or date < first_date:
                first_date = date
            if last_date is None or date > last_date:
                last_date = date
            try:
                value = float(row[value_col])
                flag = int(float(row[flag_col]))
            except (TypeError, ValueError):
                continue
            if flag not in GOOD_FLAGS:
                continue
            if not (VALID_MIN <= value <= VALID_MAX):
                continue
            good += 1
            year, month = int(date[0:4]), int(date[5:7])
            kept[fips][(year, month)].append(value)

    if rows == 0:
        sys.exit("The CSV has no rows.")
    if first_date is None or last_date is None:
        sys.exit("No dates were read.")

    # The last full calendar month in the record.
    last_year, last_month, last_day = int(last_date[0:4]), int(last_date[5:7]), int(last_date[8:10])
    days_in_last = [31, 29 if last_year % 4 == 0 and (last_year % 100 != 0 or last_year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][last_month - 1]
    if last_day < days_in_last:
        last_month -= 1
        if last_month == 0:
            last_month, last_year = 12, last_year - 1

    out_dir = Path(argv[2]) if len(argv) > 2 else OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    built_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    written = with_z = 0
    labels_check = []
    for fips in sorted(names):
        by_month = kept.get(fips, {})
        months = [
            {"year": y, "month": m, "mean": round(statistics.fmean(values), 4), "days": len(values)}
            for (y, m), values in sorted(by_month.items())
            if len(values) >= min_days
        ]
        latest = None
        # Walk back from the last full month to the newest month that has enough days.
        y, m = last_year, last_month
        for _ in range(12):
            this = next((row for row in months if row["year"] == y and row["month"] == m), None)
            if this:
                others = [row["mean"] for row in months if row["month"] == m and row["year"] != y]
                normal_mean = round(statistics.fmean(others), 4) if others else None
                normal_std = round(statistics.stdev(others), 4) if len(others) >= 2 else None
                z = None
                if len(others) >= 3 and normal_std and normal_std > 0:
                    z = round((this["mean"] - normal_mean) / normal_std, 2)
                    with_z += 1
                    labels_check.append(z)
                latest = {
                    **this,
                    "normalMean": normal_mean,
                    "normalStd": normal_std,
                    "normalYears": len(others),
                    "z": z,
                }
                break
            m -= 1
            if m == 0:
                m, y = 12, y - 1
        record = {
            "fips": fips,
            "county": names[fips],
            "source": "NASA SMAP",
            "product": PRODUCT,
            "layer": LAYER,
            "firstDate": first_date,
            "lastDate": last_date,
            "qualityRule": QUALITY_RULE,
            "months": months,
            "latest": latest,
            "builtAt": built_at,
        }
        with (out_dir / ("%s.json" % fips)).open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(record, handle, separators=(",", ":"))
            handle.write("\n")
        written += 1

    print("\n%d rows read, %d kept (%.0f%%), %s to %s." % (rows, good, 100.0 * good / rows, first_date, last_date))
    print("Last full month: %04d-%02d. Minimum days per month: %d." % (last_year, last_month, min_days))
    print("%d county files written to %s, %d with a z-score." % (written, out_dir, with_z))
    if labels_check:
        drier = sum(1 for z in labels_check if z < -0.43)
        wetter = sum(1 for z in labels_check if z > 0.43)
        print("At a 0.43 cut-off: %d drier, %d about normal, %d wetter." % (drier, len(labels_check) - drier - wetter, wetter))
    missing = [fips for fips in names if fips not in kept]
    if missing:
        print("No kept readings at all for %d counties: %s" % (len(missing), ", ".join(missing)))


if __name__ == "__main__":
    main(sys.argv)
