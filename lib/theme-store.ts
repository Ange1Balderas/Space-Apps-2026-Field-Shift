// AI-assisted: written with Claude, reviewed by Angel Balderas.

"use client";

// Light or dark, as in Stragents (Angel's request of 2026-11-15). The choice is kept in
// localStorage and applied as the `dark` class on <html>, which app/globals.css's tokens
// and Tailwind's dark variant read. app/layout.tsx applies the saved choice before the
// first paint, so the page does not flash; this store catches up on mount.

import { create } from "zustand";

export type Theme = "light" | "dark";

export const THEME_KEY = "theme";

/** The theme the page is showing now, from the class on <html>. */
export function themeOnPage(): Theme {
	if (typeof document === "undefined") return "light";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("dark", theme === "dark");
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {
		// Private windows and blocked storage: the choice lasts for this page only.
	}
}

type ThemeStore = {
	theme: Theme;
	/** Applies and remembers a theme. */
	setTheme: (theme: Theme) => void;
	/** Reads the theme the page already shows, once, on mount. */
	syncFromPage: () => void;
};

export const useThemeStore = create<ThemeStore>()((set) => ({
	// The server renders light; the page may already be dark by the time this runs.
	theme: "light",
	setTheme: (theme) => {
		applyTheme(theme);
		set({ theme });
	},
	syncFromPage: () => set({ theme: themeOnPage() }),
}));
