// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Reads what the app needs to draw NASA's vegetation layer (SPEC.md, feature 13) from NASA
// GIBS itself, and saves it as data/vegetation-layer.json: the dates the layer has, its
// colour scale, and how NASA describes it. Nothing here is typed from memory.
//
// Run it from the repo root. It needs Node.js 22 or newer and no login:
//   node scripts/gibs-vegetation-layer.mjs
//
// Three documents are read, all public:
//   the layer's time domain   .../1.0.0/{layer}/default/{TileMatrixSet}/all/2000-01-01.xml
//   its colour map            https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml
//   its description           https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/{layer}.json
// The layer's name, its tile matrix set and its colour map are the ones GIBS lists for it in
// https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities

import { writeFileSync } from "node:fs";

const LAYER = "MODIS_Terra_L3_NDVI_16Day";
const TILE_MATRIX_SET = "GoogleMapsCompatible_Level9";
// The tile matrix set's name says how deep it goes: zoom levels 0 to 9.
const MAX_ZOOM = 9;
const BASE = "https://gibs.earthdata.nasa.gov";
const DOMAINS_URL = `${BASE}/wmts/epsg3857/best/1.0.0/${LAYER}/default/${TILE_MATRIX_SET}/all/2000-01-01.xml`;
const COLOR_MAP_URL = `${BASE}/colormaps/v1.3/MODIS_L3_NDVI.xml`;
const DESCRIPTION_URL = `${BASE}/layer-metadata/v1.0/${LAYER}.json`;
const TIMEOUT_MS = 15_000;

async function read(url) {
	const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}.`);
	return response.text();
}

/** "2000-03-05/2000-12-18/P16D,2001-01-01/..." as a list of first day, last day and step. */
function periodsOf(domainsXml) {
	const domain = /<Domain>([^<]+)<\/Domain>/.exec(domainsXml)?.[1];
	if (!domain) throw new Error("The time domain document has no <Domain>.");
	return domain.split(",").map((part) => {
		const match = /^(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})\/P(\d+)D$/.exec(part.trim());
		if (!match) throw new Error(`Unexpected period in the time domain: "${part}".`);
		return { start: match[1], end: match[2], stepDays: Number(match[3]) };
	});
}

/**
 * The colour scale from the colour map's own legend: the entries GIBS marks with a tick,
 * with the first and the last one, each with the lower end of its range.
 */
function legendOf(colorMapXml) {
	const legend = /<Legend type="continuous" minLabel="([^"]+)" maxLabel="([^"]+)">([\s\S]*?)<\/Legend>/.exec(
		colorMapXml,
	);
	if (!legend) throw new Error("The colour map has no continuous legend.");
	const entries = [...legend[3].matchAll(/<LegendEntry ([^>]*)\/>/g)].map((match) => {
		const attributes = match[1];
		const rgb = /rgb="(\d+),(\d+),(\d+)"/.exec(attributes);
		const tooltip = /tooltip="([^"]+)"/.exec(attributes)?.[1] ?? "";
		const value = Number.parseFloat(tooltip);
		if (!rgb || !Number.isFinite(value)) {
			throw new Error(`Unexpected legend entry in the colour map: ${attributes}`);
		}
		return {
			value,
			rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])],
			tick: /showTick="true"/.test(attributes),
		};
	});
	const stops = entries
		.filter((entry, index) => entry.tick || index === 0 || index === entries.length - 1)
		.map(({ value, rgb }) => ({ value, rgb }));
	// The values at or below zero are drawn clear: the colour map marks them transparent.
	const clearBelow = /<ColorMapEntry [^>]*transparent="false"[^>]*value="\[([\d.-]+),/.exec(
		colorMapXml,
	)?.[1];
	return {
		minLabel: legend[1],
		maxLabel: legend[2],
		stops,
		clearBelow: clearBelow === undefined ? null : Number(clearBelow),
	};
}

const [domainsXml, colorMapXml, descriptionJson] = await Promise.all([
	read(DOMAINS_URL),
	read(COLOR_MAP_URL),
	read(DESCRIPTION_URL),
]);

const description = JSON.parse(descriptionJson);
const newest = description.conceptIds?.at(-1);
const periods = periodsOf(domainsXml);

const layer = {
	layer: LAYER,
	title: description.title,
	subtitle: description.subtitle,
	measurement: description.measurement,
	period: description.layerPeriod,
	resolution: description.resolutionAtNadir,
	product: newest ? { shortName: newest.shortName, title: newest.title } : null,
	tileUrl: `${BASE}/wmts/epsg3857/best/${LAYER}/default/{date}/${TILE_MATRIX_SET}/{z}/{y}/{x}.png`,
	maxZoom: MAX_ZOOM,
	periods,
	legend: legendOf(colorMapXml),
	readAt: new Date().toISOString(),
	readFrom: [DOMAINS_URL, COLOR_MAP_URL, DESCRIPTION_URL],
};

// One period on one line, so the file stays short enough to read.
const text = JSON.stringify(layer, null, 2)
	.replace(/\{\s+"start": ("[^"]+"),\s+"end": ("[^"]+"),\s+"stepDays": (\d+)\s+\}/g, '{ "start": $1, "end": $2, "stepDays": $3 }')
	.replace(/\{\s+"value": ([\d.-]+),\s+"rgb": \[\s+(\d+),\s+(\d+),\s+(\d+)\s+\]\s+\}/g, '{ "value": $1, "rgb": [$2, $3, $4] }');
writeFileSync("data/vegetation-layer.json", `${text}\n`);

console.log(
	`${LAYER}: ${periods.length} periods, ${periods[0].start} to ${periods.at(-1).end}; ${layer.legend.stops.length} colour stops; ${layer.resolution}, ${layer.period}.`,
);
console.log("Wrote data/vegetation-layer.json.");
