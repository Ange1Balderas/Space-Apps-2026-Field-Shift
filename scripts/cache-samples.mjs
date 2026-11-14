// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// Saves the three route answers (climate, crop history, soil) for every sample field into
// public/data/samples/{id}.json, so the samples work without a live service.
//
// Run it against a running copy of the app, from the repo root:
//   npm run build
//   npm run start
//   node scripts/cache-samples.mjs http://localhost:3000
//
// It refuses to save an answer that is not live. Without that check a failed service would
// make the route fall back to the old sample, and the script would save a copy of a copy.

import { writeFileSync } from "node:fs";
import { SAMPLE_FIELDS } from "../lib/samples.ts";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

async function live(path) {
	const response = await fetch(`${baseUrl}${path}`);
	const origin = response.headers.get("X-Field-Shift-Data");
	if (!response.ok || origin !== "live") {
		throw new Error(
			`${path} answered HTTP ${response.status} with origin "${origin}". Expected a live 200.`,
		);
	}
	return response.json();
}

/** One object on one line, with a space after each comma and colon. */
function oneLine(value) {
	return JSON.stringify(value)
		.replace(/,"/g, ', "')
		.replace(/":/g, '": ')
		.replace(/^\{/, "{ ")
		.replace(/\}$/, " }");
}

function rows(list, indent) {
	return list.map((row) => `${indent}${oneLine(row)}`).join(",\n");
}

function render(sample, climate, history, soil) {
	const trends = Object.entries(climate.trends)
		.map(([name, trend]) => `      ${JSON.stringify(name)}: ${oneLine(trend)}`)
		.join(",\n");
	const soilLines = Object.entries(soil)
		.map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
		.join(",\n");
	return `{
  "id": ${JSON.stringify(sample.id)},
  "name": ${JSON.stringify(sample.name)},
  "lat": ${sample.lat},
  "lon": ${sample.lon},
  "climate": {
    "lat": ${climate.lat},
    "lon": ${climate.lon},
    "elevationM": ${climate.elevationM},
    "years": [
${rows(climate.years, "      ")}
    ],
    "monthlyByYear": ${JSON.stringify(climate.monthlyByYear)},
    "monthlyNormals": ${JSON.stringify(climate.monthlyNormals)},
    "trends": {
${trends}
    },
    "source": ${JSON.stringify(climate.source)},
    "fetchedAt": ${JSON.stringify(climate.fetchedAt)}
  },
  "history": {
    "years": [
${rows(history.years, "      ")}
    ],
    "source": ${JSON.stringify(history.source)}
  },
  "soil": {
${soilLines}
  }
}
`;
}

for (const sample of SAMPLE_FIELDS) {
	const query = `?lat=${sample.lat}&lon=${sample.lon}`;
	const [climate, history, soil] = await Promise.all([
		live(`/api/climate${query}`),
		live(`/api/history${query}`),
		live(`/api/soil${query}`),
	]);
	const text = render(sample, climate, history, soil);

	// The file must read back as exactly what the routes answered.
	const back = JSON.parse(text);
	for (const [name, answer] of [["climate", climate], ["history", history], ["soil", soil]]) {
		if (JSON.stringify(back[name]) !== JSON.stringify(answer)) {
			throw new Error(`${sample.id}: the saved ${name} differs from the route's answer.`);
		}
	}
	writeFileSync(new URL(`../public/data/samples/${sample.id}.json`, import.meta.url), text);
	console.log(
		`${sample.id}: ${climate.years.length} climate years, ${history.years.map((row) => row.crop).join(", ")}; ${soil.mapUnitName}`,
	);
}
