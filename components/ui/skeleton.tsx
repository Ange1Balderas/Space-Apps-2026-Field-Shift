// Ported from Stragents (github.com/Ange1Balderas/hack_the_midwest, agent-flow branch): fe/src/components/ui/skeleton.tsx
// AI-assisted: ported with Claude (cn import now @/lib/utils), reviewed by Angel Balderas.

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn("animate-pulse rounded-md bg-accent", className)}
			{...props}
		/>
	);
}

export { Skeleton };
