// AI-assisted: written with Claude, reviewed by Angel Balderas.

import type { ReactNode } from "react";
import { splitSource } from "@/lib/card-text";

/**
 * A citation or a note from the data files, with each link in it shown as a link. A link
 * shows the site it leads to. For a screen reader its name also carries the publication,
 * because a list of links would otherwise repeat one site name.
 */
export function LinkedText({ text, prefix }: { text: string; prefix?: ReactNode }) {
	const parts = splitSource(text);
	// The publication is what stands before the first colon or quotation mark: the quoted
	// passage itself would make a link's name far too long to listen to.
	const citationBefore = (index: number): string => {
		for (let back = index - 1; back >= 0; back -= 1) {
			const part = parts[back];
			if ("text" in part && part.text.length > 3) {
				return part.text.split(/[:"]/)[0].trim();
			}
		}
		return "";
	};
	return (
		<>
			{prefix ? <>{prefix} </> : null}
			{parts.map((part, index) =>
				"url" in part ? (
					<a
						// The parts of one fixed string: their position is their identity.
						key={index}
						href={part.url}
						target="_blank"
						rel="noreferrer"
						className="rounded-sm break-words underline underline-offset-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
					>
						{part.host}
						<span className="sr-only">
							{citationBefore(index) ? `, ${citationBefore(index)}` : ""} (opens in a
							new tab)
						</span>
					</a>
				) : (
					// Words after a link start with a space. A bracket or a full stop that closes
					// the sentence around the link does not.
					<span key={index}>
						{index > 0 && !/^[).,;:]/.test(part.text) ? " " : ""}
						{part.text}{" "}
					</span>
				),
			)}
		</>
	);
}
