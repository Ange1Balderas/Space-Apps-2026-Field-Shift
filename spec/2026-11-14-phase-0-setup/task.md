# Phase 0: Setup. Task

Date: 2026-11-14. Source: SPEC.md, "Build phases for Fable", "Phase 0: Setup (45 min)", plus the kickoff prompt.

## Problem

The repo held planning files only. Before any feature work it needs a running Next.js app on the spec's stack, the Stragents design layer, the shared data contracts and a deployable placeholder page, so that every later phase ships on top of a working public URL.

## Acceptance criteria (copied from SPEC.md, Phase 0)

- Next.js app with TypeScript, App Router, Tailwind and shadcn/ui; install `maplibre-gl`, `react-map-gl`, `recharts`, `proj4`, `zustand`
- README skeleton with an AI disclosure section
- Deploy a placeholder Kansas map to Vercel
- Port the Stragents design layer: tokens and fonts from `styles.css`, `components/ui/`, `layout/page.tsx`, `states.tsx`, `tone-badge.tsx`, `lib/motion.ts`, `lib/feedback.ts`
- `lib/types.ts` from the Data contracts section

Done when: the public URL loads a Kansas map in a private window.

## Steps asked for in the kickoff prompt

1. Commit the starter files (SPEC.md, CLAUDE.md, .claude/) if they are not committed yet.
2. Scaffold the Next.js app per the spec's stack and folder structure.
3. Port the Stragents design layer listed in SPEC.md from github.com/Ange1Balderas/hack_the_midwest (agent-flow branch): clone it to a temp folder outside this repo and copy only the listed files.
4. Create `lib/types.ts` from the Data contracts section.
5. Add a placeholder page with a MapLibre map of Kansas using the OpenFreeMap Positron style.
6. Create `spec/2026-11-14-phase-0-setup/` with `task.md`, `plan.md` and `implementation.md`.
7. Run typecheck and build, show the real output, and commit.

Then stop, hand Angel the steps to push and import the repo into Vercel, and do not start Phase 1.

## Rules that apply to this phase (from CLAUDE.md)

- Keep the script names `dev`, `dev:mock`, `typecheck`, `lint`, `test`, `build` in `package.json`.
- Semantic colour tokens only; loading, empty and error states for every panel; layout works at 390 px wide; keyboard accessible.
- Disclaimer banner on every view.
- No NASA logos, insignia or mission patches, and no images of people.
- No secrets in the repo.
- Every file written mostly by AI starts with the `AI-assisted` comment, and the README's AI use section is current.
- Commit, do not push. Angel pushes to deploy.

## Out of scope

Everything in Phase 1 and later: API routes, climate charts, field selection, sample fields, mock data, the county overlay, and any data or config files.
