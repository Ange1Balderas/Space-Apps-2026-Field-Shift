# CLAUDE.md

## Read first

1. `SPEC.md` is the source of truth for what to build, in what order, and how it is judged. If this file and SPEC.md disagree, stop and ask Angel.
2. Work one phase at a time, in the order SPEC.md lists. Stop at the end of each phase for Angel's review. Never start the next phase on your own.
3. Phase 1 is a thin end-to-end slice (one field, one chart, deployed). Keep something working on the public URL at all times and widen from there.

## Project in one paragraph

A web app for the NASA Space Apps Challenge 2026 (Field Shift: Adapting Farms with NASA Data), Kansas City local event, team ANGEL. A Kansas farmer clicks a field and sees the rotation they already run, how growing conditions there have shifted since 1981, and at least three crop rotations compared and ranked by their own priorities, each with its evidence, information gaps and risks. The tool supports farmer judgment and never replaces it.

## Stack

Next.js (App Router) with strict TypeScript, Tailwind, shadcn/ui, MapLibre GL via react-map-gl with OpenFreeMap tiles, Recharts, Zustand. Python scripts for preprocessing NASA data. Deployed on Vercel. The design layer is ported from Angel's Stragents project (see SPEC.md, "Reuse from Stragents").

## Commands

- `npm run dev`: local app
- `npm run dev:mock`: local app on cached sample fields, no live API calls
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
- `python scripts/<name>.py`: preprocessing, run from the repo root inside `.venv`

Keep these script names in `package.json` so the commands above always work.

## Workflow for every phase

1. Create `spec/YYYY-MM-DD-<phase-name>/` with:
   - `task.md`: the problem and acceptance criteria, copied from SPEC.md
   - `plan.md`: small, verifiable steps
   - `implementation.md`: what was built, which files AI wrote, what was verified and how
2. Build the smallest complete change that meets the acceptance criteria.
3. Run typecheck, lint, tests and build. Show the real output.
4. Commit with a clear message. Do not push; Angel pushes to deploy.
5. Stop and summarize for Angel: what works, what does not, what was cut.

## Ultracode and workflows

- Use a workflow only where work splits into independent pieces: the history and soil routes, glossary and About content, preprocessing scripts, and the final review. Sequential work (scaffold, the Phase 1 slice, water and scoring, UI) runs in normal mode.
- In a fan-out, every agent owns its own files or folder. No two agents edit the same file.
- Build against `lib/types.ts`. Never change a shared type inside a fan-out; change it in normal mode first.
- Use a smaller model for simple stages such as glossary text and test runs.

## Subagents

- `data-verifier`: after any change to `data/`, `config/` or user-facing text with a number or claim in it.
- `ui-reviewer`: after any UI change, before the phase review.
- `test-runner`: to run typecheck, lint, tests and build and report results.

## Rules

1. **Data first.** Before writing any fact, threshold, crop value or rotation claim, find a public source (NASA, USDA, NOAA, K-State, FAO) and store its link with the value. A published fact with no source yet is `null` and the UI shows "not sourced yet". A tuning constant we chose ourselves (a cap, weight or penalty) is not a fact: store it as a tool assumption in `config/scoring.json` so it appears on the About the Data tab. Never guess a number.
2. **No fake implementations.** No placeholder success, no hardcoded results presented as real, no TODOs in a feature called done.
3. **No false completion claims.** Never say a test, build or deploy passed unless you saw its output.
4. **Every external call** goes through an API route with a 15-second timeout and a cache. On failure, fall back to cached sample data or show a clear error. Never a blank screen.
5. **Units:** store metric, display imperial (inches, °F).
6. **Design:** semantic color tokens only, one accent color, loading, empty and error states for every panel, layout works at 390 px wide, keyboard accessible. Follow SPEC.md "Design direction".
7. **No NASA logos, insignia or mission patches, and no images of people** anywhere in the app or demo.
8. **No secrets in the repo.** Earthdata credentials stay in `~/.netrc` or environment variables.
9. **Disclaimer banner** on every view: the tool supports farmer judgment and does not replace it.
10. **Preserve scope.** Do not add features that are not in SPEC.md.
11. **Scoring sanity.** With "save water" at maximum, continuous irrigated corn must never rank first, and on a dry western field wheat-fallow must beat continuous wheat on water fit. Keep these as tests.

## AI disclosure (required by the hackathon)

- Every file written mostly by AI starts with a comment: `// AI-assisted: written with Claude, reviewed by Angel Balderas.` (use `#` in Python).
- Keep the README's "AI use" section current: what AI wrote, what Angel decided and reviewed.
- Any AI-generated text shown in the app is labeled as AI-generated.
- Record AI-written files in each phase's `implementation.md`.
