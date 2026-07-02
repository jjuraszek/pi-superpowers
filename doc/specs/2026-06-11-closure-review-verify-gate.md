# Spec: closure-review gate on verify completion

## Context

All three verify-owning skills (`subagent-driven-development`, `executing-plans`, `verification-before-completion`) mandate a `conformance-reviewer` dispatch — the closing loop — before the verify phase completes. Compliance is prompt-level only: `phase_tracker({ action: "complete", phase: "verify" })` accepts unconditionally.

Observed failure (consumer-repo session, 2026-06-10): the SDD skill text containing the closing-loop step was replaced by a lossy pruner summary mid-session; ~50 min later the model completed verify off a code-reviewer SHIP verdict alone. The conformance-reviewer was never dispatched. Root cause aside (fixed separately in pi-context-prune via path-based prune protection), the invariant itself was unenforced — attention decay, context loss, or plain non-compliance can all reproduce the skip.

This change makes the skip impossible: `phase-tracker.ts` rejects `complete verify` unless a successful `conformance-reviewer` dispatch has been observed since the last reset.

## Scope

| Item | Path | Action |
|---|---|---|
| Gate + dispatch tracking | `extensions/phase-tracker.ts` | edit |
| Wire Step 5 to the phase tracker (`start verify` before the audit, `complete verify` after the conformance verdict, `skip` on user waiver) | `skills/executing-plans/SKILL.md` | edit |
| Extension config table (phase-tracker becomes configurable) + `closureReview` config docs: `enforce` row added next to the existing `model` row | `README.md` | edit |
| Extension table: phase-tracker row changes from `Configurable: No` to `Configurable: Yes`, settings key `piGauntlet.closureReview` (key: `enforce`) | `AGENTS.md` | edit |
| Changelog | `CHANGELOG.md` | edit (minor bump) |

## Non-goals

- **No changes to what skills mandate.** Skills already require the dispatch; this enforces it. One structural edit to `executing-plans` wires its Step 5 to the phase tracker (it dispatched the reviewer but never called `start`/`complete verify`, so the gate could not fire on that path) — the mandate itself is unchanged. Plugin-shipped skills are not altered per-consumer.
- **No verdict validation.** The gate checks that the reviewer *ran*, not what it said or what task content it received. Acting on the verdict stays prompt-level.
- **No auto-dispatch.** The gate rejects and instructs; it never dispatches the reviewer itself.
- **No `force` bypass on `complete`.** A user waiver is recorded via the existing `skip` action with a reason — verify then shows as skipped, not complete. Done-pressure must not have a soft door.
- **No gating of other phases.** Only `complete` targeting `verify`.

## Behavior

On `phase_tracker({ action: "complete", phase: "verify" })`:

1. Read `piGauntlet.closureReview.enforce` from settings at gate-time. Absent/undefined → `true`. `false` → gate disabled, complete proceeds as today.
2. If enforcing and no qualifying dispatch observed since the last `reset`: return an error result (existing guard pattern — state unchanged):

```
Error: cannot complete 'verify': no conformance-reviewer dispatch observed.
The closing loop is required before verify completes. Either:
- dispatch subagent({ agent: "conformance-reviewer", ... }) with the spec, the
  user's verbatim request, and the full diff (model from
  piGauntlet.closureReview.model), then complete verify after its verdict, or
- if the user explicitly waived closure review, record it:
  phase_tracker({ action: "skip", phase: "verify", reason: "<user waiver>" })
```

3. Otherwise: complete proceeds as today.

`complete` for any other phase, and all other actions, are unchanged.

## Qualifying dispatch

A `subagent` tool call in **execution mode** (`input.action` absent) whose result shows a successful `conformance-reviewer` child run.

- **Success signal is per-child, not top-level `isError`.** Per pi-cohort `src/shared/types.ts`, the tool result's `details` is `{ mode, results: SingleResult[], asyncId? }` with `SingleResult { agent, exitCode, ... }`. Qualifies iff `details.results[]` contains an entry with `agent === "conformance-reviewer"` and `exitCode === 0`. (A failed child can return `isError: false` at the top level with `exitCode: 1` in the child entry.)
- **Management mode never qualifies** — `action: "list"`/`"get"`/etc. return `mode: "management", results: []`; merely listing the agent catalog must not satisfy the gate (exactly the false signal present in the observed failed session).
- **Async never qualifies** — a dispatch with `details.asyncId` present returns before the child runs (`results: []`); the closing loop requires a foreground dispatch whose verdict exists when the gate is checked.
- **Exact match** — case-sensitive `===` on the `agent` field of `details.results[]` entries, no substring/regex. A task description merely mentioning "conformance-reviewer" does not qualify — qualification is decided solely on the result's `details.results[]`.
- **Window: since the last `phase_tracker reset`** — not "since verify started". An eager-but-legit dispatch shortly before `start verify` must not false-reject; the threat is "never dispatched", not "dispatched slightly early".
- The canonical flow is a single-mode own-call dispatch (per `AGENTS.md`); chain/tasks detection is leniency in the *gate*, not an endorsement of fusing the review into other calls.

## State tracking

Two paths, mirroring patterns already in the extension:

- **Live (within a session):** a single `tool_result` listener — the event carries `toolName`, `input`, and `details` together (pi `CustomToolResultEvent`), so no call/result pending-set correlation is needed. A `subagent` result whose `details` satisfies [Qualifying dispatch](#qualifying-dispatch) sets `conformanceDispatched = true`. A `phase_tracker reset` sets it back to `false`. (Management and async results carry `results: []`, so the qualification rule alone excludes them — no input pre-filter required.)
- **Reconstruction (resume/branching):** extend the existing branch-replay that rebuilds phase state. In branch order: a `subagent` toolResult satisfying the qualification rule → flag true; a `phase_tracker` reset toolResult → flag false. Replay end state is the flag.

No new persistence — the session branch is the single source of truth, same as phase state today.

Message shapes: tool result `details` per pi-cohort `Details`/`SingleResult` (`src/shared/types.ts`); session message shapes per the existing branch-replay code in `phase-tracker.ts`; event subscription per `verify-before-ship.ts`.

## Config

| Key | Type | Default | Meaning |
|---|---|---|---|
| `piGauntlet.closureReview.enforce` | boolean | `true` | Gate `complete verify` on an observed conformance-reviewer dispatch |

Lives under the existing `closureReview` key (which already carries `model`, consumed by skills). Default-on is deliberate: pi-cohort is mandatory for consumers, and an opt-in default would let a preset silently re-inherit the observed failure.

## Verification

No test infrastructure in this repo (extensions are loaded directly by pi). Manual verification in a consumer session:

1. `enforce` unset: `reset` → `start verify` → `complete verify` → expect rejection with the instructive error.
2. Dispatch `conformance-reviewer` (single mode) → `complete verify` → expect success.
3. `skip verify` with reason instead of dispatch → expect success (skipped state).
4. Resume the session mid-flow → `complete verify` → flag state must survive reconstruction.
5. `enforce: false` in settings → `complete verify` with no dispatch → expect success.
6. Negative signals: `subagent({ action: "list" })` (management) and an async conformance-reviewer dispatch → `complete verify` → expect rejection for both.
7. `executing-plans` flow: Step 5 now starts verify, dispatches the reviewer, and completes verify — confirm the gate passes on that path.

## Open questions

None.
