# Phase 0: Setup. Plan

Small steps, each with the check that shows it worked.

| # | Step | Check |
| --- | --- | --- |
| 1 | Check the machine: `node -v`, `python --version`, `git --version` | Node 22 or newer, Python 3.11 or newer, Git present |
| 2 | Copy `SPEC.md`, `CLAUDE.md` and `.claude/` from the starter zip into the repo root and commit them | `git status` lists exactly six new files; file hashes match the zip |
| 3 | Run `create-next-app` in a temp folder (TypeScript, App Router, Tailwind, ESLint, no `src/`, alias `@/*`) and copy its config and `app/` files in | README, LICENSE, `.gitignore` and CLAUDE.md are not overwritten |
| 4 | Extend `.gitignore` for Node and Next.js before the first `git add` | `git status` shows no `node_modules`, `.next` or env files |
| 5 | Install the spec's packages (`maplibre-gl`, `react-map-gl`, `recharts`, `proj4`, `zustand`) and what the design layer needs | `npm ls --depth=0` is clean, no `--force` |
| 6 | Add the six script names from CLAUDE.md to `package.json` | Each script runs |
| 7 | Clone Stragents (agent-flow) to a temp folder outside the repo; copy only the listed files; point imports at `@/`; add `"use client"` where Next.js needs it | Each ported file equals its source apart from the header, alias and directive; no `"cn"` or `#/` imports remain |
| 8 | Build `app/globals.css` from Stragents `styles.css` | Colour tokens unchanged; the browser reports Geist as the body font |
| 9 | Write `lib/types.ts` from the SPEC data contracts | Text equals the SPEC block once `export` is removed |
| 10 | Placeholder page: header, disclaimer banner, Kansas map (OpenFreeMap Positron) and an empty field panel | Map loads in a production run; style and tile requests return 200; console is clean |
| 11 | Check the layout at 390 px wide | Panel stacks under the map; no sideways scroll |
| 12 | README skeleton with the AI use section | Section present and accurate |
| 13 | Run `typecheck`, `lint`, `test`, `build` | All exit 0; real output recorded in `implementation.md` |
| 14 | UI review against `.claude/agents/ui-reviewer.md` | Must-fix findings fixed before the commit |
| 15 | Commit. Do not push | `git status` clean; branch ahead of `origin/main` |
| 16 | Hand Angel the push and Vercel import steps | Angel deploys and opens the public URL in a private window |
