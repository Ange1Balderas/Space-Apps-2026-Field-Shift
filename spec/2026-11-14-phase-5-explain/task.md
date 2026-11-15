# Phase 5: Explain. Task

Date: 2026-11-14. Source: SPEC.md, "Build phases for Fable" > "Phase 5: Explain", with "User flow" step 8, "Features" (10), "UI rules for Fable" (Sources) and "SI layer: trends, anomalies and uncertainty".

## Problem

The panel shows science words (evapotranspiration, K factor, Mann-Kendall, Sen's slope, potential demand) with no explanation. A source badge leads away to the provider's site instead of to an account of what the tool takes from that source and how far to trust it. The constants the tool chose are listed in `data/README.md` but nowhere in the app. The second slope the tool computes for every trend is never shown.

## Acceptance criteria (copied from SPEC.md)

- [ ] Glossary with at least 8 terms: evapotranspiration, soil moisture anomaly, NDVI, frost risk, water balance, available water capacity, erodibility, trend confidence, fallow
- [ ] About the Data tab: every source with link and purpose, the resolution table, Sen's vs linear slope comparison, satellite vs ground explanation

Done when: every science word in the UI has a tooltip.

## What the rest of SPEC.md asks of this phase

- User flow step 8: "Glossary tooltips on every science word, and an About the Data tab explaining each source, satellite vs ground measurement, and the tool's limits."
- Feature 10: "At least 8 terms explained; every source listed with link and purpose; banner visible on every view."
- UI rules, Sources: "every number carries a small badge (POWER, SMAP, SSURGO) that opens its About the Data entry."
- Trend detection, Comparing approaches: "the About the Data tab shows Sen's slope next to an ordinary linear regression slope, and explains why Sen's is less thrown off by one extreme year such as a severe drought."
- Uncertainty on every number: the table of source, approximate resolution and the confidence shown to the farmer.
- Satellite vs ground, in plain words: the paragraph under that heading.
- `lib/types.ts`: the constants in `config/scoring.json` are "tool assumptions, all shown on the About the Data tab".
- Patterns borrowed: "a 'how we calculated this' link on every card".

## Rules that apply (CLAUDE.md)

- Rule 1, data first: a definition is a fact. Each glossary entry is either a published definition with its source and link, or is marked as the tool's own term or rule. Nothing is written from memory.
- Angel's decision 4 of 2026-11-14: the `data-verifier` re-opens the source of each value before it is loaded. Applied here to every published definition and to every claim on the About tab.
- Rule 2: no placeholder. A term with no source is left out, not filled in.
- Rule 6: semantic colour tokens, loading, empty and error states, 390 px, keyboard.
- Rule 9: the banner stays on every view, the About tab included.
- Rule 10: nothing beyond SPEC.md.
- AI disclosure: any AI-generated text shown in the app is labelled as AI-generated.

## Promised to this phase by earlier ones

- Phase 1: the two-sided p-value is the tool's choice; the trend test treats the years as independent; NASA POWER's highs can sit just under 95°F where a station read 95°F.
- Phase 1: the source badge opens the provider's page "until the About the Data tab exists".
- Phase 3 and 4: glossary tooltips on water fit, heat and drought exposure, evapotranspiration, potential demand, Mann-Kendall and Sen's slope; per-value sources on the About tab.

## Out of scope

- Soil moisture anomaly and NDVI as glossary terms: nothing on screen uses either word, because SMAP (Phase 6) and the vegetation layer (cut from Phase 4) are not built. They are added with the feature that needs them.
- The SMAP and GRACE rows of the resolution table, for the same reason.
- Phases 6 to 8.
