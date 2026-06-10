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
`$PI_CODING_AGENT_DIR/settings.json` for `piSuperpowers.closureReview.model` and
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

Project's issue-tracker skill (for the fallback) is named in `.pi/superpowers-overrides.md`.

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

The reviewer **proposes, it does not dispose.** It reports coverage plus a
remediation *direction* per gap; it never edits and never decides what happens
next. Disposition is the user's call, surfaced by the orchestrator:

- **CONFORMS** → record the verdict in the completion summary's closure section and proceed.
- **GAPS** → do **not** auto-proceed and do **not** auto-fix. Surface each gap to
  the user with the reviewer's proposed remediation, and let them choose per gap:
  - **Fix now** — dispatch an implementer with the gap as the task, then re-run the check.
  - **Accept + record** — fold the deviation into the spec as a deliberate, dated decision; once recorded it is no longer drift.
  - **Rescope / defer** — record it in the spec as an explicit out-of-scope / deferred requirement.

No completion claim stands over an unreconciled gap. "Surface, don't auto-fix":
the orchestrator presents options, the user decides.

## Checklist

- [ ] Located canonical requirements (spec → prompt → ticket fallback)
- [ ] Enumerated every requirement: explicit ACs / spec clauses + implicit notes + inline prompt reqs
- [ ] Checked spec ↔ prompt/ticket drift; reconciled any divergence
- [ ] Each requirement mapped to where it's satisfied (code/doc) + evidence
- [ ] Multi-spec? Subset declared in spec; deferred ACs noted as out of scope
- [ ] Gaps reported, or all rows satisfied

Can't check all boxes (or unreconciled drift)? Not complete. Report the gap.
