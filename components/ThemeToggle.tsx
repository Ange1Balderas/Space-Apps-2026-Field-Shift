"use client";

// AI-assisted: written with Claude, reviewed by Angel Balderas.
//
// The light/dark switch in the header, as in Stragents. One button, named for what it will
// do. On paper the page is always light: the printable summary is laid out for white paper,
// so the dark class is lifted for the print and put back after.

import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/lib/theme-store";

export function ThemeToggle() {
	const theme = useThemeStore((state) => state.theme);
	const setTheme = useThemeStore((state) => state.setTheme);
	const syncFromPage = useThemeStore((state) => state.syncFromPage);

	// The page may already be dark from the saved choice applied before the first paint.
	useEffect(() => {
		syncFromPage();
	}, [syncFromPage]);

	useEffect(() => {
		let wasDark = false;
		const before = () => {
			wasDark = document.documentElement.classList.contains("dark");
			if (wasDark) document.documentElement.classList.remove("dark");
		};
		const after = () => {
			if (wasDark) document.documentElement.classList.add("dark");
		};
		window.addEventListener("beforeprint", before);
		window.addEventListener("afterprint", after);
		return () => {
			window.removeEventListener("beforeprint", before);
			window.removeEventListener("afterprint", after);
		};
	}, []);

	const next = theme === "dark" ? "light" : "dark";
	return (
		<Button
			type="button"
			variant="outline"
			size="icon"
			className="size-9"
			aria-label={`Switch to ${next} mode`}
			title={`Switch to ${next} mode`}
			onClick={() => setTheme(next)}
		>
			{theme === "dark" ? (
				<SunIcon aria-hidden="true" className="size-4" />
			) : (
				<MoonIcon aria-hidden="true" className="size-4" />
			)}
		</Button>
	);
}
