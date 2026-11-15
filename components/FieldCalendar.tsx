// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The field calendar of one rotation (SPEC.md, user flow step 7 and feature 9): one row of
// twelve months for each year of the cycle, filled where a crop is in the ground and empty
// where the field is bare, under three rows that mark the months this field is usually hot,
// dry or frosty. The windows' rules are in lib/climate-windows.ts.
//
// It is a real table, so a screen reader can read it by row and by month. Colour carries
// nothing by itself: a crop month holds the crop's letter and a bare month is empty.

import type { RotationCalendar } from "@/lib/calendar";
import type { ClimateWindows } from "@/lib/climate-windows";
import { LIBRARY } from "@/lib/library";
import type { CropId } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

const CROP_CODES: Record<CropId, string> = {
	winter_wheat: "W",
	corn: "C",
	grain_sorghum: "S",
	soybean: "Sb",
	alfalfa: "A",
	cover_crop: "Cc",
};

const WINDOWS = [
	{ key: "hot", label: "Hot" },
	{ key: "dry", label: "Dry" },
	{ key: "frost", label: "Frost" },
] as const;

const cropName = (id: CropId) =>
	(LIBRARY.crops.find((crop) => crop.id === id)?.name ?? id).toLowerCase();

export function FieldCalendar({
	calendar,
	windows,
	rotationName,
}: {
	calendar: RotationCalendar;
	windows: ClimateWindows;
	rotationName: string;
}) {
	// Years that look the same are drawn once: corn every year is one row, not eight.
	const rows: { first: number; last: number; months: RotationCalendar["months"] }[] = [];
	for (let year = 1; year <= calendar.cycleYears; year += 1) {
		const months = calendar.months.filter((month) => month.year === year);
		const pattern = (list: RotationCalendar["months"]) =>
			list.map((month) => (month.unknown ? "?" : month.crops.join("+"))).join("|");
		const previous = rows[rows.length - 1];
		if (previous && pattern(previous.months) === pattern(months)) previous.last = year;
		else rows.push({ first: year, last: year, months });
	}
	const rowLabel = (row: { first: number; last: number }) =>
		row.first === row.last
			? `Year ${row.first}`
			: row.first === 1 && row.last === calendar.cycleYears
				? "Every year"
				: `Years ${row.first} to ${row.last}`;
	const crops = [...new Set(calendar.months.flatMap((month) => month.crops))];
	const hasWindows = WINDOWS.some(({ key }) => windows[key].length > 0);
	const hasUnknown = calendar.months.some((month) => month.unknown);

	return (
		<div className="space-y-2">
			<table className="w-full table-fixed border-separate border-spacing-0.5 text-center text-xs">
				<caption className="sr-only">
					Field calendar for {rotationName}: the months with a crop in the ground
					and the bare months in each year of the cycle
					{hasWindows ? ", under the months that are usually hot, dry or frosty here" : ""}.
				</caption>
				<thead>
					<tr>
						<td className="w-14" />
						{MONTH_NAMES.map((name) => (
							<th key={name} scope="col" className="font-normal text-muted-foreground">
								<abbr title={name} className="no-underline">
									{name.charAt(0)}
								</abbr>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{hasWindows
						? WINDOWS.map(({ key, label }) => (
								<tr key={key}>
									<th scope="row" className="text-left font-normal text-muted-foreground">
										{label}
									</th>
									{MONTH_NAMES.map((name, index) => {
										const marked = windows[key].includes(index + 1);
										return (
											<td key={name} className="py-0.5">
												<span
													className={cn(
														"block h-1.5 rounded-full",
														marked ? "bg-chart-3" : "bg-transparent",
													)}
												/>
												<span className="sr-only">{marked ? "yes" : "no"}</span>
											</td>
										);
									})}
								</tr>
							))
						: null}
					{rows.map((row) => (
						<tr key={row.first}>
							<th
								scope="row"
								className="text-left font-normal text-muted-foreground"
							>
								{rowLabel(row)}
							</th>
							{row.months.map((month) => (
									<td
										key={month.month}
										className={cn(
											"h-6 rounded-sm",
											month.unknown && "border border-dashed text-muted-foreground",
											month.bare && "border bg-background",
											!month.unknown && !month.bare && "bg-chart-3 font-medium text-card",
										)}
									>
										{month.unknown ? (
											<>
												<span aria-hidden="true">?</span>
												<span className="sr-only">not known</span>
											</>
										) : month.bare ? (
											<span className="sr-only">bare</span>
										) : (
											<>
												<span aria-hidden="true">{CROP_CODES[month.crops[0]]}</span>
												<span className="sr-only">
													{month.crops.map(cropName).join(" and ")}
												</span>
											</>
										)}
									</td>
								))}
						</tr>
					))}
				</tbody>
			</table>
			<p className="text-xs text-muted-foreground">
				{crops.length > 0
					? `A filled month has a crop in the ground for at least half of it: ${crops.map((id) => `${CROP_CODES[id]} ${cropName(id)}`).join(", ")}. An empty month is bare. `
					: "No crop of this rotation could be placed in the year. "}
				{hasUnknown ? "A month marked ? is in a year whose crop the tool does not know. " : ""}
				{hasWindows
					? `Hot: a 95°F day in most of the last ten years. Dry: the air asks for more water beyond rain than in this field's average month. Frost: between the average first fall freeze and the average last spring freeze. These three rows follow the tool's own rules, from NASA POWER.`
					: ""}
			</p>
		</div>
	);
}
