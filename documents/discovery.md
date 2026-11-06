# Discovery

**Status:** goal-gate
**Updated:** 2026-09-18T18:51:00Z

## Goal

- **Artifact (Y):** `documents/Figma-Comparison-Findings.md` — a comparison of the public Figma Make “Cuebox Mobile” prototype vs the `feature/mobile-ui` homepage and overall mobile UI, then a decision log of current-vs-prototype preferences, ending in a merged “perfect design” view.
- **Save path (Y):** `documents/Figma-Comparison-Findings.md`
- **Used for (Z):** You review and own the merged target design. A later agent uses the same file as the starting point to create tickets (this discovery does not create the tickets).
- **Persona (X):** You (product owner) as primary reader; downstream consumer is another agent slicing the merged design into tickets.
- **Greatest Y looks like:** _unfilled_
- **100% done when:** _unfilled_ (provisional: comparison of real differences; one locked preference per aspect; a merged perfect-design view an agent can ticket from)
- **Draft mode:** draft-in-repo (write the comparison first, then update the same file as decisions lock)
- **Context sources:**
  - Figma Make prototype: https://www.figma.com/make/BPNMmiDcofEVbYLHOCfVJz (public Cuebox Mobile home preview)
  - `feature/mobile-ui` branch — homepage and overall mobile UI
  - `documents/ui-mobile-product-brief.md` — current locked Cuebox mobile product IA (amendable; not treated as untouchable)
  - Comparison scope: **both, kept separate** — visual/layout diffs vs product-IA diffs; preference questions follow that split

## Agenda

_Not proposed yet (goal gate incomplete)._

## Decision log

### G1 — Artifact, path, use, draft mode
- **Status:** locked (from request)
- **Choice:** Findings doc at `documents/Figma-Comparison-Findings.md`; draft in repo; used to define the merged target design.

### G2 — Comparison scope
- **Status:** locked
- **Choice:** Both, kept separate. Visual/layout diffs and product-IA diffs live in different sections. Preference questions do not mix taste (e.g. coral CTA) with product job changes (e.g. share from list). Existing mobile product brief is context, not a hard freeze.

### G3 — Persona and use
- **Status:** locked
- **Choice:** Primary audience is you (product owner). Secondary use is a later agent creating tickets from the findings. Do not write the tickets in this pass.

## Coverage / open questions

- Greatest-Y framing and 100% done criteria

## Artifact

- **Path:** `documents/Figma-Comparison-Findings.md`
- **Written:** no
