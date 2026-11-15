// AI-assisted: written with Claude, reviewed by Angel Balderas.

/**
 * True under `npm run dev:mock`, which sets NEXT_PUBLIC_DATA_MODE=mock. In mock mode the
 * three data routes make no call to a live service and serve only the cached sample fields.
 * The map still loads its own tiles.
 */
export function isMockMode(): boolean {
	return process.env.NEXT_PUBLIC_DATA_MODE === "mock";
}
