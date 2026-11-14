// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// SPEC.md, "UI rules": every number carries a small source badge that opens its About the
// Data entry. That tab arrives in Phase 5. Until then the badge opens the provider's own page.
const SOURCE_LINKS = {
	"NASA POWER": "https://power.larc.nasa.gov/",
	"USDA NASS CDL":
		"https://www.nass.usda.gov/research-and-science/cropland/sars1a",
	"USDA NRCS SSURGO":
		"https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo",
} as const;

export type SourceName = keyof typeof SOURCE_LINKS;

export function SourceBadge({ source }: { source: SourceName }) {
	return (
		<Badge asChild variant="outline" className="min-h-6">
			<a href={SOURCE_LINKS[source]} target="_blank" rel="noreferrer">
				<span className="sr-only">Source: </span>
				{source}
				<ExternalLinkIcon aria-hidden="true" />
				<span className="sr-only"> (opens in a new tab)</span>
			</a>
		</Badge>
	);
}
