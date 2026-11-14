// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// One way to call a public data service from an API route (CLAUDE.md rule 4): a 15-second
// limit on the whole exchange, and failures turned into plain-language errors that name the
// service. Server only.

// CLAUDE.md rule 4: every external call has a 15-second timeout.
export const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Why a call failed:
 * "timeout" the service did not answer in time; "unavailable" it could not be reached or
 * answered with an error; "unexpected" its answer could not be read; "no-data" it answered,
 * and has nothing for this point.
 */
export type UpstreamErrorKind =
	| "timeout"
	| "unavailable"
	| "unexpected"
	| "no-data";

/** A failed call to a data service. `message` is plain language and safe to show to a person. */
export class UpstreamError extends Error {
	readonly kind: UpstreamErrorKind;

	constructor(kind: UpstreamErrorKind, message: string) {
		super(message);
		this.name = "UpstreamError";
		this.kind = kind;
	}
}

function isAbort(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		(error.name === "TimeoutError" || error.name === "AbortError")
	);
}

/**
 * Sends one request and returns the parsed JSON body. The 15-second limit covers the
 * headers and the body. `service` is the name used in error messages, for example
 * "NASA POWER".
 */
export async function fetchUpstreamJson(
	service: string,
	url: string,
	init: RequestInit = {},
): Promise<unknown> {
	const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
	const timedOut = `${service} did not answer within 15 seconds.`;

	let response: Response;
	try {
		response = await fetch(url, { ...init, signal });
	} catch (error) {
		if (isAbort(error)) throw new UpstreamError("timeout", timedOut);
		throw new UpstreamError("unavailable", `${service} could not be reached.`);
	}

	if (!response.ok) {
		throw new UpstreamError(
			"unavailable",
			`${service} answered with an error (HTTP ${response.status}).`,
		);
	}

	try {
		return await response.json();
	} catch (error) {
		if (isAbort(error)) throw new UpstreamError("timeout", timedOut);
		throw new UpstreamError(
			"unexpected",
			`${service} sent an answer this tool could not read.`,
		);
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
