// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// A small in-memory cache for the API routes. It holds promises, so two requests for the
// same key share one upstream call, and a failed call is forgotten at once so the next
// request tries again.
//
// On Vercel this lives only as long as one server instance stays warm. The cache that holds
// across instances is the CDN, driven by the Cache-Control header the route sets.

export type MemoryCache<T> = {
	/** Returns the cached value for `key`, or runs `load` and caches what it resolves to. */
	get(key: string, load: () => Promise<T>): Promise<T>;
	clear(): void;
	size(): number;
};

export function createMemoryCache<T>(options: {
	ttlMs: number;
	maxEntries: number;
	now?: () => number;
}): MemoryCache<T> {
	const { ttlMs, maxEntries, now = Date.now } = options;
	const entries = new Map<string, { expiresAt: number; value: Promise<T> }>();

	return {
		get(key, load) {
			const hit = entries.get(key);
			if (hit && hit.expiresAt > now()) return hit.value;
			entries.delete(key);

			const entry = { expiresAt: now() + ttlMs, value: load() };
			entries.set(key, entry);
			entry.value.catch(() => {
				if (entries.get(key) === entry) entries.delete(key);
			});

			// A Map keeps insertion order, so the first key is the oldest entry.
			while (entries.size > maxEntries) {
				const oldest = entries.keys().next().value;
				if (oldest === undefined) break;
				entries.delete(oldest);
			}
			return entry.value;
		},
		clear() {
			entries.clear();
		},
		size() {
			return entries.size;
		},
	};
}
