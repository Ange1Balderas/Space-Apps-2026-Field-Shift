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
		<html lang="en">
			<body>
				{/* The glossary tooltips (components/Glossary.tsx) share this provider. */}
				<TooltipProvider>{children}</TooltipProvider>
				<Toaster />
			</body>
		</html>
	);
}
