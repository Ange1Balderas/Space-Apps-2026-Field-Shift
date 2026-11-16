// AI-assisted: written with Claude, reviewed by Angel Balderas.

import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
	title: "Field Shift Kansas",
	description:
		"Compare crop rotations for a Kansas field using NASA Earth data, USDA soil and crop data, and your own priorities.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		// suppressHydrationWarning: the script below may add the `dark` class before React runs.
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* The saved light/dark choice, applied before the first paint so nothing flashes
				    (lib/theme-store.ts). With no saved choice the page follows the device. */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed, inline, dependency-free script
					dangerouslySetInnerHTML={{
						__html:
							"(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();",
					}}
				/>
			</head>
			<body>
				{/* The glossary tooltips (components/Glossary.tsx) share this provider. */}
				<TooltipProvider>{children}</TooltipProvider>
				<Toaster />
			</body>
		</html>
	);
}
