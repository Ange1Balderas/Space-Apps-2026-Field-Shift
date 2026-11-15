# Phase 5: Explain. Plan

Date: 2026-11-14. Normal mode, one session. SPEC.md suggests a workflow for this phase; Angel's plan allowance is tight, so the source check is one `data-verifier` run in the background and the rest is done in line. Each slice is committed on its own. Nothing is pushed.

## Slice 1: the glossary and the source list, as data

1. Collect the wording of each definition from a source: K-State MF3066 and EPA QA/G-9 (text already on disk), the USDA soil survey's own attribute descriptions (one Soil Data Access query, saved), FAO-56 Chapter 1 (opened through the table of contents, not from a guessed link), the National Weather Service glossary.
2. `data/glossary.json`: one entry per term. A published definition carries its source with a link. A term or rule that is the tool's own is marked so and says what the code does.
3. `data/sources.json`: every publication and service the tool draws on, with its name, links and what it is for.
4. `lib/glossary.ts` and `lib/about.ts` read and check both files when the app is built and when the tests run. Tests: every published entry has a source with a link; every link in `data/`, `config/` and the glossary is in the source list; every constant in `config/scoring.json` has an explanation; the explanations of the constants quote the values in the file.
5. Start the `data-verifier` in the background on the two files, with the saved texts. Apply what it finds before the phase is called done.

## Slice 2: the About the Data tab

1. The panel gets two tabs, Field and About the data. The Field tab stays mounted while About is open, so nothing the reader opened is lost.
2. `components/AboutData.tsx`, built from the files above and from the selected field's trends:
   - what the tool is and is not, and how the text was written;
   - sources: each with its link and purpose;
   - the resolution table, for the three sources in use;
   - satellite and ground;
   - two slopes for every trend at the selected field, Sen's and least squares, with what EPA says about each. Empty, loading and error states;
   - how the scores are worked out: the seven indicators, the sliders, the constants the tool chose and the rules that have no constant;
   - the glossary, each term with its source and link.
3. A source badge opens its entry on the About tab and offers a way back to where the reader was. The provider's link moves into the entry.
4. Each card's "How these scores were worked out" gets a link to the About tab.

## Slice 3: tooltips

1. `components/Glossary.tsx`: a term is a button. Hover or keyboard focus shows the definition; a tap shows it on a phone; Escape, a second tap or a tap elsewhere hides it.
2. `lib/glossary.ts`: a tested function that finds the terms in a run of text, longest first, and marks only the first use in each block.
3. Terms are marked on: the seven soil facts, the seven indicator names on a card and under the sliders, the trend label, the trend test line, the three calendar windows, and the sentences of a card (lines, evidence, benefits, gaps, risks, how the scores were worked out). Never on a heading, a rotation name, a tab, a link or a disclosure's title.

## Finish

1. Typecheck, lint, tests, build; show the output.
2. `ui-reviewer` once.
3. Browser checks on the production build: a sample field, a tooltip by hover, by keyboard and by tap, a badge to its entry and back, About with no field selected, the slope table at a field, 375 px, the console.
4. `implementation.md`, README. Commit. Do not push. Stop for Angel's review.
