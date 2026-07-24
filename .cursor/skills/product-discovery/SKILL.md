---
name: product-discovery
description: >-
  Facilitated Socratic product discovery. Locks what 100% done looks like
  (artifact, save path, how it will be used, expert persona), then runs
  one-decision-at-a-time option+recommendation interviews, persisting state
  in discovery.md. Use when the user says "help me discover…", wants a
  product/design/tech brief via guided decisions, or does not yet know what
  they want until they see structured options. Ad-hoc and domain-agnostic;
  not tied to issue workflow stages.
---

# Product discovery

Turn an underspecified intent into a **locked artifact** through facilitated, sequential decision-making. Optimize for people who **do not know what they want until they see concrete options**.

This skill is **ad-hoc** and **domain-agnostic**. It is **not** part of the issue handoff workflow (`review-and-spec`, `planning`, labels, `workflow.state.json`).

## When to use

- User says **“help me discover…”** (or clear variants: facilitate decisions, Socratic discovery, lock a brief via options)
- User needs a deliverable but cannot specify it fully yet
- Taste/preference must be elicited by **contrast**, not open-ended “what do you want?”

## When not to use

- Requirements are already clear and the next step is implement / plan / spec from a complete issue → use the appropriate workflow skill instead
- User only wants brainstorming with no artifact or “done” definition
- Pure code execution with no discovery needed

## Hard interaction rules

1. **One decision question per assistant turn** (after the goal gate and after agenda approval). Do not batch decision prompts.
2. Each decision turn includes: **context → numbered options → recommendation → wait**.
3. Usual option count: **3–5**. Allow letter answers, mixes, or a custom variant.
4. The user may **ask a clarifying question before answering**. Answer the clarification, then **re-pose the same decision** (updated if needed)—do not advance the agenda.
5. **Mid-stream revisions are allowed.** If a later answer conflicts with an earlier lock, call it out, propose an amendment, update `discovery.md`, and continue.
6. **Never write the final artifact** until decisions are locked (or the user explicitly says **“enough, write now”** and accepts listed open gaps).
7. Always give a **recommendation** with a short why—do not dump neutral options only.
8. Drive questions and recommendations from the locked **expert persona (X)** doing **Z** with artifact **Y**.

## Phase 0 — Goal gate (must complete before discovery Q&A)

Do **not** start the decision agenda until these are explicit and recorded in `discovery.md`. Ask **one topic per turn** until the gate is complete (clarifying questions allowed). Persist each accepted lock immediately—use the provisional workspace-root `discovery.md` until **Save path (Y)** is locked, then relocate (see Location below).

### Required locks

| Field | Meaning |
|-------|---------|
| **Y — Artifact** | What is being produced (brief, ADR, plan, issue draft, checklist, etc.). Anything is allowed **if defined up front**. |
| **Save path (Y)** | Exact repo-relative path (or agreed external path) for the final artifact. **Verify** the parent directory exists or can be created; refuse to proceed on a vague “somewhere in docs.” |
| **Z — Use** | How Y will be used (e.g. hand to a UI designer, brief an implementer, decide build vs buy). |
| **X — Persona** | Expert in the field who will perform Z with Y (e.g. “senior product designer preparing a mobile UI pass”). Persona drives framing, options, and recommendations. |
| **100% done** | Observable acceptance criteria for Y (what must be true for discovery to be complete). |
| **Draft mode** | **Draft in repo** (write/update files as you go) vs **on request** (state in `discovery.md` only until user asks to write Y). |
| **Context sources** | Optional. Only read files/URLs/docs the user (or their prompt) points at. Do not assume a product repo layout. |

### Framing question (required once Y/Z are known enough)

Pose—and lock the answer to—this framing (wording may adapt; meaning must not):

> If I were **X** and planned to use **Y** to perform **Z**, what does the **greatest version of Y** look like?

Use the answer to sharpen **100% done** and to shape the agenda. If X is still fuzzy, help the user name a concrete expert persona before continuing.

### Goal-gate output check

Before Phase 1, `discovery.md` must include a filled **Goal** section. If save path is missing or invalid, stop and fix that first.

## Phase 1 — Propose agenda (hybrid model D)

1. From Goal (especially **how Y is used** and the “greatest Y” framing), propose a **short agenda**: ~6–12 decision **titles** only, ordered.
2. In **one turn**, show the agenda and ask the user to **approve / edit / drop / reorder**. Do not start Decision 1 in that same turn if they have not approved yet—unless they approve inline (“looks good, go”).
3. Record the approved agenda in `discovery.md`.
4. Run decisions **one at a time**.
5. After the last agenda item (or on **“enough, write now”**), run a **coverage mop-up**: as persona X, list any gaps that would keep Y from being “greatest” for Z. Ask zero or a few follow-up decisions—still one per turn—then proceed to Phase 2.

### Agenda guidance (not a rigid taxonomy)

Infer topics from Y + Z + persona. Examples of shapes (illustrative only):

- **UI / design brief** → nav, hierarchy, key surfaces, density/metaphor, motion/a11y, v1 scope, success criteria, …
- **Technical approach** → constraints, options, risks, rollout, success metrics, …
- **Product brief** → user/job, non-goals, primary loop, scope, success, …

Do **not** force a Cuebox or issue-workflow checklist.

## Phase 2 — Write the artifact

When decisions are locked (or early-stop with explicit open questions section):

1. Write **Y** to the agreed save path, structured for persona **X** to perform **Z**.
2. Include a **decision log** (summary table) and any **prerequisites / open questions**.
3. Update `discovery.md` to `status: complete` with a pointer to Y.
4. Respect draft mode: if **on request**, only write Y when the user asks; still keep `discovery.md` current throughout.

## `discovery.md` state file

### Location

Persistence must start on the **first accepted goal-gate answer**, even when **Save path (Y)** is not locked yet.

1. **Before Save path (Y) is locked:** write provisional state to **`discovery.md` at the workspace / repo root** (or an explicit path the user sets in that turn). Create the file if missing; keep updating it every turn.
2. **Once Save path (Y) is locked:** relocate state to the **canonical** location—**same directory as the artifact save path**, file name `discovery.md` (e.g. artifact `documents/foo-brief.md` → state `documents/discovery.md`). Move/rename the provisional file there (do not leave a stale root copy). If the parent directory does not exist yet, create it when relocating.
3. If the canonical path would collide with an unrelated file, use `{artifact-basename}-discovery.md` beside the artifact, or a path the user sets during the goal gate.
4. **Verify** the state-file path (provisional and canonical) the same way as Y’s save path.
5. On resume, look for `discovery.md` at the canonical path first; if absent, check the workspace-root provisional file.

### Update cadence

**After every accepted answer** (goal-gate field lock, agenda approval, each decision, each revision, mop-up, completion)—including answers given **before** Save path (Y) is known, using the provisional location above. In **draft in repo** mode, commit when that is already normal for the session; otherwise at least keep the working tree file current every turn.

### Suggested shape

```markdown
# Discovery

**Status:** goal-gate | agenda-pending | in-progress | mop-up | complete
**Updated:** <ISO8601>

## Goal

- **Artifact (Y):** …
- **Save path (Y):** …
- **Used for (Z):** …
- **Persona (X):** …
- **Greatest Y looks like:** …
- **100% done when:** …
- **Draft mode:** draft-in-repo | on-request
- **Context sources:** … (or none)

## Agenda

1. [ ] Decision title
2. [ ] …

## Decision log

### D1 — <title>
- **Status:** locked | amended
- **Choice:** …
- **Notes:** …

## Coverage / open questions

- …

## Artifact

- **Path:** …
- **Written:** no | yes
```

## Per-decision turn template

```markdown
**Decision N of M — <title>**

### Context
<Why this matters for X using Y to do Z; 2–5 sentences.>

### Options
1. …
2. …
3. …

### Recommendation
**<option>** — <one short why>

---

**Question:** …
```

After the user answers: update `discovery.md`, briefly confirm the lock (and amendments), then either stop for the next turn’s question or—only when appropriate—enter mop-up / write phase.

## Resume protocol

If continuing a prior discovery:

1. Locate and read `discovery.md` (canonical path beside Y’s save path if known; otherwise workspace-root provisional). Also read Y if partially written.
2. Branch on **Status**—never skip an incomplete earlier phase:
   - **`goal-gate`:** resume Phase 0 at the next unfilled Goal field (including framing). Do **not** propose or run the agenda.
   - **`agenda-pending`:** resume Phase 1 agenda proposal/approval. Do **not** start Decision 1 until the agenda is approved (or explicitly waived).
   - **`in-progress`:** resume at the first incomplete agenda item.
   - **`mop-up`:** continue coverage mop-up (still one question per turn).
   - **`complete`:** only reopen if the user wants to revisit, amend, or rewrite Y.
3. Do not re-ask locked decisions or completed goal-gate fields unless the user wants to revisit.

## Git / PR

- **Not workflow-tied.** No required `workflow.state.json`, issue labels, or handoff stages.
- **Draft in repo:** write `discovery.md` (and Y when due) into the working tree; commit/push/PR only as the surrounding session already expects or when the user asks.
- **On request:** maintain `discovery.md` when possible; write Y only when asked.

## Quality bar

Discovery succeeds when:

1. Goal gate fields are complete and paths verified
2. Agenda was approved (or explicitly waived)
3. Each locked decision has a recorded choice
4. Y meets the stated **100% done** criteria for persona X performing Z—or open gaps are explicitly listed in Y
5. Recommendations consistently reflect persona X, not generic advice
