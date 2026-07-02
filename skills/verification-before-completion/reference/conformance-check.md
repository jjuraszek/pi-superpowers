# Deliverable Conformance Check

Tests passing proves the code runs. It does **not** prove the code does what was
asked. This check confronts deliverables (code **and** docs) against the
requirements.

## Why this is distinct from code review

Work flows `prompt/spec → plan → code/doc`. Each hop is lossy: the plan can
drop or reinterpret a requirement, and code can drift from the plan. Reviewing
**plan vs code** (what `/skill:requesting-code-review` does) is *single-step*
verification — it confirms the last hop, but inherits any drift the plan already
introduced.

This check is the **closing loop**: confront the final outcome (code + doc)
against the *origin* (spec + original prompt), skipping the plan. It catches
requirements lost anywhere in the chain, not just in the last step. Run it even
when plan-vs-code review passed clean — they measure different things against
different reference points.

## Dispatch a fresh reviewer (primary path)

The main session built the thing — it has confirmation bias. Delegate the check
to a fresh-context **`conformance-reviewer`** — a persona built for exactly this
gate: its priorities are requirement coverage and intent fidelity, not code
quality, and it emits a per-requirement coverage verdict rather than a bug list.
It reads the requirements vs the diff cold and cannot see session history, so
pass in:

- The **spec** (path).
- The **original prompt** (verbatim — it holds inline requirements + any ticket ref).
- The **diff** to audit (code + docs).

Dispatch it as its **own** call — do not fold the conformance check into the
whole-PR code-quality review. Fusing the two subordinates intent-coverage to a
code-quality system prompt and compresses the conformance result to an
afterthought. Code quality is one dispatch; conformance is another.

The persona ships model-free. Read the active preset's settings at
`$PI_CODING_AGENT_DIR/settings.json` for `piGauntlet.closureReview.model` and
inject it **call-site** on the dispatch (`model:` if set, else omit to inherit the
parent's model) — the same mechanism the spec-council chair uses. If the configured
model is unreachable, retry once with the inherited model. Point it at the strongest
reasoning model the preset can reach — this is the last correctness gate.
`thinking` stays frontmatter-pinned at `xhigh` and is not call-site overridable, so
the config supplies only `model`.

Self-checking in the main session is the fallback when delegation isn't possible.

## Source of truth (priority order)

| Order | Source | Why |
|---|---|---|
| 1 | The written spec (`doc/specs/…`) | Canonical. Brainstorm already fetched the ticket, reconciled its ACs, recorded deviations here. |
| 2 | Original prompt | Catches inline requirements never folded into the spec. |
| 3 | Re-fetch the ticket | **Fallback only**, when no spec exists. Skip when a spec exists — the live ticket may have drifted. |

Project's issue-tracker skill (for the fallback) is named in `.pi/gauntlet-overrides.md`.

## Drift = red flag

Spec vs prompt/ticket disagree → **STOP and reconcile**, do not absorb silently.

- Intentional, recorded deviation → spec wins (it was review-gated).
- Unrecorded divergence → spec silently dropped/altered a requirement = conformance
  failure. Fix spec or code, re-verify. No completion claim over unreconciled drift.

## Coverage rule

Default: **1 requirement source = 1 spec = code covering every requirement.**
The requirement source is whatever sits at the top of the priority table — a
ticket if there is one, otherwise the spec + original prompt. No ticket is fine;
spec + prompt is a first-class source, not a degraded one. "Every requirement" =
explicit acceptance criteria / spec clauses **+** implicit notes (ticket body,
comments, or inline in the prompt). Source and solution must end in sync.

Multi-spec effort → allowed **only if the spec explicitly says** it covers a
defined subset and names the deferred requirements. Silent partial coverage = failure.

## When the check finds gaps

The reviewer **proposes, it does not dispose.** It emits structured gap blocks
(see `agents/conformance-reviewer.md`); the orchestrator (the main session running
the verify gate) drives disposition, fixes, and re-audit. The reviewer never edits,
dispatches, or re-audits itself.

### CONFORMS

Record the verdict in the completion summary's closure section and proceed.

### GAPS — disposition menu

Do **not** auto-proceed and do **not** auto-fix. Render the enumerated gap list —
each as `Gn [VERDICT] origin — remediation (recommended: fix|accept|rescope)` — then
a numbered prompt (a chat turn cannot express a bare keystroke):

```
[1] apply all recommended dispositions
[2] review per-gap (override fix/accept/rescope before applying)
```

`[1]` applies each gap's `recommended` disposition, **except** any gap whose
`recommended` is `accept` or `rescope`: list those and require an explicit confirming
reply before their spec edits land (accept/rescope rewrite the origin — never on the
unconfirmed fast path). `[2]` prompts a per-gap override, then applies.

Disposition semantics:

- `fix` — dispatch a remediation unit (below), then re-audit. For an `UNAUTHORIZED`
  gap, "fix" = **remove** the unrequested code.
- `accept` — the **main session** (not a subagent) folds the deviation into the spec as
  a dated decision (template below). For `UNAUTHORIZED`, accept = keep the behavior,
  document it as intended.
- `rescope` — the main session records the requirement in the spec as an explicit
  out-of-scope / deferred item, dated.

Dated-decision template (append to the spec's decisions/deviations section):

```
- YYYY-MM-DD accept|rescope Gn: <requirement/behavior> — <one-line rationale> (conformance gate)
```

**Commit accept/rescope spec edits BEFORE any fix wave dispatches:** pi-cohort
rejects a dirty tree on a `worktree: true` dispatch, and the re-audit must read the
amended spec. If a round has only accept/rescope and no `fix`, the edits land, the
verdict is recorded, and no re-audit runs.

### Fix dispatch — reuse dispatching-parallel-agents mechanics

Fixes reuse the `dispatching-parallel-agents` fan-out primitive. Invoke **no**
`phase_tracker` / `plan_tracker` calls and do **not** enter `subagent-driven-development`
Parallel-Wave Mode (that mode opens with `phase_tracker({ phase: "implement" })`, which
errors while the verify phase is `in_progress`, and needs a plan the fix loop lacks).

**Precondition — worktree required.** Fix-via-dispatch needs a worktree HEAD to branch
from. On the ad-hoc `finishing-a-development-branch` paths that run in a normal repo
(`GIT_DIR == GIT_COMMON`) or detached HEAD, there is no such HEAD: the menu offers
`accept` / `rescope` and **manual fix-in-place** only; unresolved gaps route to escalation.
The loop below applies only when the gate already runs inside a worktree.

**Wave grouping** comes from the reviewer's `Parallel-safe:` line: `disjoint` gaps form
one parallel wave; any `conflicts` pair splits into separate serial waves. A pair conflicts
on **file OR runtime-resource** overlap - two gaps whose fixes touch disjoint files but whose
verification shares a `touched-resources` entry (DB/schema, port, fixture, external service,
shared temp path) are **not** parallel-safe and run in separate serial waves, identical to
planned-execution wave grouping. This is why the reviewer certifies both axes.

**Dispatch shape** (mirrors `dispatching-parallel-agents`):

```ts
subagent({
  context: "fresh",
  worktree: true,
  cwd: "<abs worktree path, from git rev-parse --show-toplevel>",
  tasks: [
    { agent: "implementer",
      task: "Close conformance gap G1. Origin requirement: <origin>. What's missing: " +
            "<remediation>. Satisfy the requirement; do not expand scope. " +
            "Ownership boundary — modify only: <touched-files>." },
    // one task per disjoint gap in this wave
  ],
})
```

- Unit = `implementer`, fresh context, `worktree: true`, `cwd` = the conformance
  worktree. Pass `touched-files` as an explicit ownership boundary.
- **Integrate** serially via `git apply` back onto the worktree HEAD — the fix ships in
  the same worktree and rides `finishing-a-development-branch`'s squash. No new merge machinery.
- **Failure handling is inherited verbatim** from `dispatching-parallel-agents`
  "Review and Integrate": textual conflict → re-run one agent sequentially with the
  other's integrated changes as context; semantic conflict (applies clean, suite fails)
  → re-run the offending task sequentially on integrated HEAD; a failed agent → integrate
  the successes, then retry the failure with fresh context including the integrated changes.
  A `BLOCKED` / `NEEDS_CONTEXT` return surfaces to the user.
- **`code-reviewer` over the integrated fix delta, once per round** (not per gap) — gap
  fixes land after the branch's final code review, so review the round's cumulative diff.
- **`spec-reviewer` is excluded** — plan-vs-code is the wrong reference point; the re-audit
  checks fixes against the origin.
- **Test gate** on the integrated tree after the round's waves apply, using the project's
  canonical test command. A failure re-enters the failure-handling rules above.

One round = dispatch waves → serial integrate → `code-reviewer` on round delta → test
gate → re-audit.

### Delta re-audit + cap

Re-dispatch `conformance-reviewer` for a delta-scoped re-audit. Pass:

- the **full prior conformance report** — every row including DELIVERED rows and their
  `evidence` `file:line` (needed for the regression guard), not just gap IDs;
- the **fix diff** for the round.

The reviewer (not the orchestrator) computes the regression intersection: it re-verifies
the gaps marked `fix` this round **plus** any previously-DELIVERED requirement whose
`evidence` file appears in the fix diff. It reuses `G1..Gn`, marking each `DELIVERED`,
still-open with its prior verdict, or introducing `Gn+1`.

- The re-audit dispatch carries the **same call-site `model:` injection** as the initial
  audit (when `piGauntlet.closureReview.model` is set, the phase-tracker closure guard
  requires every `conformance-reviewer` dispatch to specify `model:`).
- New or still-open gaps within the cap re-enter the menu above.
- **Cap: read `piGauntlet.closureReview.maxFixRounds`** (default `2`; missing/non-integer
  → `2`; `< 0` → `0`). `0` = audit-only: `GAPS` renders an accept/rescope-only menu and any
  unresolved gap escalates instead of dispatching a fix.
- **On non-convergence** (cap reached with open gaps): **escalate to human** with the
  per-gap round-by-round verdict trail. No silent re-loop, no auto-ship.

No completion claim stands over a gap that is neither fixed, accepted, nor rescoped.
"Surface, don't auto-fix": the orchestrator presents options, the user decides.

## Checklist

- [ ] Located canonical requirements (spec → prompt → ticket fallback)
- [ ] Enumerated every requirement: explicit ACs / spec clauses + implicit notes + inline prompt reqs
- [ ] Checked spec ↔ prompt/ticket drift; reconciled any divergence
- [ ] Each requirement mapped to where it's satisfied (code/doc) + evidence
- [ ] Multi-spec? Subset declared in spec; deferred ACs noted as out of scope
- [ ] Gaps reported, or all rows satisfied

Can't check all boxes (or unreconciled drift)? Not complete. Report the gap.
