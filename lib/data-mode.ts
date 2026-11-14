// AI-assisted: written with Claude, reviewed by Angel Balderas.

/**
 * True under `npm run dev:mock`, which sets NEXT_PUBLIC_DATA_MODE=mock. In mock mode the
 * app makes no call to a live service and serves only the cached sample fields.
 */
export function isMockMode(): boolean {
	return process.env.NEXT_PUBLIC_DATA_MODE === "mock";
}
