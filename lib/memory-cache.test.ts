// AI-assisted: written with Claude, reviewed by Angel Balderas.

import { describe, expect, it, vi } from "vitest";
import { createMemoryCache } from "@/lib/memory-cache";

describe("createMemoryCache", () => {
	it("runs the loader once per key while the entry is fresh", async () => {
		const cache = createMemoryCache<number>({ ttlMs: 1000, maxEntries: 10 });
		const load = vi.fn(async () => 42);
		expect(await cache.get("a", load)).toBe(42);
		expect(await cache.get("a", load)).toBe(42);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("shares one load between calls that arrive together", async () => {
		const cache = createMemoryCache<number>({ ttlMs: 1000, maxEntries: 10 });
		const load = vi.fn(
			() => new Promise<number>((resolve) => setTimeout(() => resolve(7), 5)),
		);
		const [first, second] = await Promise.all([
			cache.get("a", load),
			cache.get("a", load),
		]);
		expect([first, second]).toEqual([7, 7]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("loads again once the entry has expired", async () => {
		let clock = 0;
		const cache = createMemoryCache<number>({
			ttlMs: 1000,
			maxEntries: 10,
			now: () => clock,
		});
		const load = vi.fn(async () => clock);
		expect(await cache.get("a", load)).toBe(0);
		clock = 999;
		expect(await cache.get("a", load)).toBe(0);
		clock = 1000;
		expect(await cache.get("a", load)).toBe(1000);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("forgets a failed load, so the next call tries again", async () => {
		const cache = createMemoryCache<number>({ ttlMs: 1000, maxEntries: 10 });
		const load = vi
			.fn<() => Promise<number>>()
			.mockRejectedValueOnce(new Error("upstream down"))
			.mockResolvedValueOnce(5);
		await expect(cache.get("a", load)).rejects.toThrow("upstream down");
		expect(cache.size()).toBe(0);
		expect(await cache.get("a", load)).toBe(5);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("drops the oldest entry when it is full", async () => {
		const cache = createMemoryCache<string>({ ttlMs: 1000, maxEntries: 2 });
		await cache.get("a", async () => "A");
		await cache.get("b", async () => "B");
		await cache.get("c", async () => "C");
		expect(cache.size()).toBe(2);

		const reloadA = vi.fn(async () => "A again");
		expect(await cache.get("a", reloadA)).toBe("A again");
		expect(reloadA).toHaveBeenCalledTimes(1);
	});
});
