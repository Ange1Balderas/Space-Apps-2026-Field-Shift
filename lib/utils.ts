// Ported from Stragents (github.com/Ange1Balderas/hack_the_midwest, agent-flow branch): fe/src/lib/utils.ts
// AI-assisted: ported with Claude (copied unchanged), reviewed by Angel Balderas.

import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
