// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Data contracts, transcribed from SPEC.md ("Contracts and formulas" > "Data contracts").
// The shapes are fixed there: change SPEC.md first, then this file, and never inside a
// parallel fan-out. Apart from the layout of CropId, this is the SPEC text with `export` added.

// Confirmed by Angel on 2026-11-14, and defined in SPEC.md since then. Fallow has no id: a
// year with no planting is fallow. Double-crop soybean gets its own decision when its
// rotation is added.
export type CropId =
  | "winter_wheat"
  | "corn"
  | "grain_sorghum"
  | "soybean"
  | "alfalfa"
  | "cover_crop";

// /api/climate?lat=&lon=
export type ClimateResponse = {
  lat: number; lon: number; elevationM: number;
  years: { year: number; seasonRainIn: number; hotDays: number;
           lastSpringFreezeDoy: number | null; firstFallFreezeDoy: number | null;
           meanTempF: number }[];
  // 12 entries per year, used for the water budget and the calendar overlays
  monthlyByYear: { year: number; month: number; rainIn: number; et0In: number; hotDays: number }[];
  monthlyNormals: { month: number; rainIn: number; tmaxF: number; tminF: number; et0In: number }[];
  trends: Record<string, { perDecade: number; linearPerDecade: number; pValue: number;
                           label: "likely" | "possible" | "none" }>;
  source: "NASA POWER"; fetchedAt: string;
};
// Crop water demand is computed in the browser from monthlyByYear and crops.json,
// so the API route does not depend on the crop library.

// /api/history?lat=&lon=
export type HistoryResponse = {
  years: { year: number; cdlCode: number; crop: string }[];
  source: "USDA NASS Cropland Data Layer";
};

// /api/soil?lat=&lon=  (SSURGO columns to verify against the SDA docs)
export type SoilResponse = {
  mukey: string; mapUnitName: string; texture: string | null;
  availableWaterIn: number | null;   // muaggatt.aws0100wta, cm to in
  organicMatterPct: number | null;   // chorizon.om_r, surface layer
  kFactor: number | null;            // chorizon.kwfact, surface layer
  windErodibilityIndex: number | null; // component.wei
  slopePct: number | null;           // muaggatt.slopegradwta
  hydrologicGroup: string | null;    // component.hydgrp
  source: "USDA NRCS SSURGO";
};

// A published value always travels with its source. `assumption` is set when the value is
// the tool's own pick among published numbers (one row of a table, one end of a printed
// range) or is worked out from them: it says what the source prints and what the tool did.
// Such a value is shown as a tool assumption. (`assumption` approved by Angel, 2026-11-14.)
export type Sourced<T> = { value: T; source: string; assumption?: string } | null;

// data/crops.json
export type Crop = {
  id: CropId; name: string; kind: "summer" | "winter" | "perennial" | "cover";
  kc: Sourced<{ ini: number; mid: number; end: number }>;
  stageDays: Sourced<{ ini: number; dev: number; mid: number; late: number }>;
  heatSensitiveMonths: Sourced<number[]>;
  nFixing: Sourced<boolean>;
  residue: Sourced<"low" | "medium" | "high">;
  rootDepth: Sourced<"shallow" | "medium" | "deep">;
  market: "local" | "regional" | "contract"; // tool assumption, listed in config
};

// data/calendar.json: usual Kansas dates, month-day strings such as "09-25"
export type CropCalendar = Record<CropId, Sourced<{ plantStart: string; plantEnd: string;
                                             harvestStart: string; harvestEnd: string }>>;

// data/rotations.json
export type Rotation = {
  id: string; name: string;
  // One entry per crop planting in the cycle. plantYear is 1-based within the cycle;
  // a winter crop planted in the fall of year 1 is harvested in year 2.
  // Years with no planting are fallow. Two plantings in one year = double crop or cover crop.
  cycleYears: number;
  plantings: { crop: CropId; plantYear: number }[];
  water: "dryland" | "irrigated" | "either"; regions: ("west" | "central" | "east")[];
  needsNoTill: boolean;
  benefits: { text: string; source: string }[]; risks: { text: string; source: string }[];
};

// The farmer's four priority sliders and the seven indicators a rotation is scored on.
export type Priority = "saveWater" | "protectSoil" | "income" | "simplicity";
export type IndicatorId = "waterFit" | "heatExposure" | "soilProtection" | "soilBuilding"
                        | "pestBreak" | "marketFit" | "simplicity";

// config/scoring.json: tool assumptions, all shown on the About the Data tab
export type ScoringConfig = {
  hotDayF: number; regionRainBandsIn: [number, number];
  growingSeasonMonths: [number, number]; // first and last month of "growing season rain"; tool assumption, April to September
  effectiveRainFraction: Sourced<number>; fallowEfficiency: Sourced<number>;
  irrigationNeedCapIn: number; hotDaysCap: number; risingTrendPenalty: number;
  // The five fields below were approved by Angel on 2026-11-14: constants that formulas 5 to 9
  // and the sliders need.
  erosion: { kTimesSlopeCap: number; windIndexCap: number };          // formula 5: where each risk reaches its maximum
  soilBuildingPoints: { nFixing: number; highResidue: number; coverCrop: number; deepRoots: number }; // formula 6
  marketScores: { local: number; regional: number; contract: number }; // formula 8
  simplicity: { perExtraCrop: number; missingNoTillPenalty: number };  // formula 9
  priorityIndicators: Record<Priority, IndicatorId[]>;                 // which indicators each slider weighs
  // Added for Phase 6 on 2026-11-15 (SPEC.md, "Anomalies"): how a county's soil moisture
  // month is labelled against the same month in the other years of the record.
  soilMoisture: {
    nearNormalZ: Sourced<number>;  // |z| below this is "about normal"; the middle third of a normal distribution
    minDaysPerMonth: number;       // a month with fewer good readings than this is left out
  };
};

// public/data/counties/{fips}.json, written by scripts/build_county_json.py from the AppEEARS
// point sample of SMAP SPL3SMP_E at the county's centroid (SPEC.md, feature 12 and "Anomalies").
// Soil moisture is a volume fraction, cm³ of water per cm³ of soil. `z` is this month's mean
// against the mean and standard deviation of the same calendar month in the other years.
export type CountyMoisture = {
  fips: string; county: string;
  source: "NASA SMAP"; product: string; layer: string;
  /** The first and last day of the record that was read, as YYYY-MM-DD. */
  firstDate: string; lastDate: string;
  /** How a day was kept: the quality rule applied, in words. */
  qualityRule: string;
  /** Every month with enough good readings, oldest first. `mean` is the volume fraction. */
  months: { year: number; month: number; mean: number; days: number }[];
  /** The last full calendar month with enough readings, set against the same month before it. */
  latest: {
    year: number; month: number; mean: number; days: number;
    /** Mean and standard deviation of the same month in the other years, and how many years. */
    normalMean: number | null; normalStd: number | null; normalYears: number;
    /** Null when fewer than three other years have the month, or when they do not vary. */
    z: number | null;
  } | null;
  /** When the file was written, as an ISO time. */
  builtAt: string;
};
