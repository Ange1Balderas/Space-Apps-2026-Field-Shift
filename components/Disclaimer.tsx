// AI-assisted: written with Claude, reviewed by Angel Balderas.

// Shown on every view (CLAUDE.md rule 9). The wording comes from SPEC.md, user flow step 1.
export function Disclaimer() {
	return (
		<p
			role="note"
			className="border-b bg-secondary px-4 py-2 text-sm text-secondary-foreground"
		>
			This tool supports your judgment. It does not replace it.
		</p>
	);
}
