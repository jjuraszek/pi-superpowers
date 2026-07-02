# Conformance Remediation Loop

## Problem

The conformance gate (`conformance-reviewer` dispatched by `verification-before-completion` /
`subagent-driven-development` verify step / `finishing-a-development-branch`) is a strong
detector but a weak closer. Measured across 58 unique consumer-project full-flow sessions (71
`conformance-reviewer` dispatches, deduped across preset dirs):

- **50% gap rate** - 29/58 first verdicts were `GAPS`. The gate earns its keep.
- **Loop-back nearly absent** - only 3/29 gapped sessions re-reviewed after fixes. 26 shipped
  on an unverified "fixed" claim.
- **Post-gap handling ad hoc** - of the 28 gapped sessions whose next action was classifiable,
  18 main loops self-handled (re-argued the finding, sometimes silently fixed), 6 engaged the
  user, 4 dispatched fixes (one session's follow-up did not classify). No consistent menu despite
  `conformance-check.md` mandating "surface, don't auto-fix".
- **Unbounded looping exists** - one session ran 7 conformance dispatches; multi-round sessions
  ended with open issues 4/7 times.

Root causes in the current design:

1. The reviewer emits prose per-requirement rows with no machine-addressable identity, so the
   orchestrator cannot mechanically drive a menu or track a gap across rounds.
2. `conformance-check.md`'s "When the check finds gaps" section describes *dispositions* but no
   *protocol*: no enumerated menu, no recommended-default, no fix-dispatch shape, no re-audit
   loop, no round cap.
3. Fix work, when it happens, is ad hoc - not run as an isolated execution unit with review or a
   test gate, and not re-verified against the origin.

## Goal

Make the conformance gate a **read-only audit -> disposition menu -> isolated fix -> bounded
re-audit loop**. Turn the reviewer's output into a machine-addressable structured issue list,
give the orchestrator a mandated menu with a low-friction clean-case default, run fixes as
isolated execution units reusing the existing `dispatching-parallel-agents` fan-out mechanics
(fresh context, worktree isolation, serial integrate, test gate), re-audit the delta, and cap the
loop with human escalation on non-convergence.

## Scope discipline (hard constraint)

The execution phase must not be destabilized, and no new conditionals may be added to it. This
change:

- **Reuses `dispatching-parallel-agents`** - the documented "mechanic home for parallel fan-out"
  (that skill, line 16) - by *invoking* its fresh-context + `worktree: true` + serial-integrate
  mechanics. It does **not** invoke `subagent-driven-development` Parallel-Wave Mode: that mode
  opens with `phase_tracker({ phase: "implement" })`, which errors while the conformance loop's
  `verify` phase is `in_progress` (`extensions/phase-tracker.ts:427`), and it is bound to a plan
  document + `plan_tracker` wave encoding the fix loop has no plan for. The fix loop therefore
  targets the lower-level primitive that carries **no** phase/plan ceremony, keeping the execution
  path and its trackers untouched.
- Touches SDD / finishing-skill call sites only to **replace** their existing inline disposition
  prose with a pointer to the new protocol - no execution logic is duplicated or modified.
- Concentrates all new machinery in two files: `conformance-check.md` (the protocol) and
  `conformance-reviewer.md` (the output contract).

Out of scope: any change to how implementers run, how waves are grouped during planned execution,
how `writing-plans` emits its file-ownership blocks, how `finishing-a-development-branch` squashes,
or the `phase-tracker.ts` extension. The fix loop is a **consumer** of the fan-out primitive, not
an editor of the execution machinery.

## Design

### 1. Reviewer output contract (`agents/conformance-reviewer.md`)

The reviewer stays strictly read-only and keeps its "proposes, does not dispose" stance, its
per-requirement verdict, and its confidence line. Its gap output becomes machine-addressable.

Each non-DELIVERED row emits a structured gap block. Re-audit rounds (Section 4) additionally emit
`DELIVERED` blocks for gaps that closed, so the verdict vocabulary for a gap block is
`PARTIAL | MISSING | DRIFTED | UNAUTHORIZED | DELIVERED`. Fields:

| Field | Meaning |
|---|---|
| `id` | Stable gap ID (`G1`, `G2`, ...), durable across re-audit rounds |
| `verdict` | `PARTIAL` \| `MISSING` \| `DRIFTED` \| `UNAUTHORIZED` (\| `DELIVERED` in re-audit rounds) |
| `origin` | Requirement reference (spec clause / prompt line / ticket AC). For `UNAUTHORIZED` rows there is no origin requirement - use `none (scope creep)` |
| `evidence` | `file:line` (or `absent`) showing where the requirement is / isn't satisfied |
| `remediation` | Fix *direction* (not a diff) - what would close the gap |
| `touched-files` | Reviewer's best estimate of the file(s) a fix would modify, comma-separated (or `unknown`) |
| `touched-resources` | Shared runtime resources a fix's verification would touch: `DB/schema, port, fixture, external service, shared temp path` (same vocabulary as `writing-plans`' Runtime-resource disjointness rule). `none` if pure-code |
| `recommended` | Default disposition proposal: `fix` \| `accept` \| `rescope` |

**Literal output format.** Gap blocks follow the coverage table, one fenced block per gap:

```
G1:
  verdict: MISSING
  origin: spec "Section 3 / Fix dispatch"
  evidence: absent
  remediation: implementer task not dispatched for gaps marked fix
  touched-files: skills/verification-before-completion/reference/conformance-check.md
  touched-resources: none
  recommended: fix
```

Empty/absent values use the literal tokens above (`absent`, `none`, `unknown`) - never a blank.

After the gap blocks, the reviewer emits a **disjointness certification** line. Grammar:

```
Parallel-safe: <group>[; <group>]*
  where <group> = <comma-separated gap-id list> " disjoint"
                | <gap-id> " conflicts " <gap-id> " (" <reason> ")"
```

Example:

```
Parallel-safe: G1,G3 disjoint; G2 conflicts G1 (both touch auth.ts); G4 conflicts G1 (shared test DB)
```

Rule (identical to execution): any **file OR runtime-resource** overlap forces the conflicting
gaps into separate serial waves. Runtime-resource disjointness is not machine-checkable - the
reviewer estimates it, exactly as `writing-plans`' Runtime-resource disjointness rule does for
planned waves. When the reviewer cannot confidently certify a pair disjoint, it must mark them
`conflicts` (conservative default = serial).

**`recommended` selection policy** (the reviewer applies this; it is a proposal, not a decision):
- Default to `fix` for every `PARTIAL` / `MISSING` / `DRIFTED` row.
- `accept` only for an `UNAUTHORIZED` row whose shipped behavior is harmless, with a one-line
  rationale in `remediation`.
- `rescope` only when the `origin` requirement is impractical to satisfy in this branch.
- `accept` and `rescope` rewrite the origin rather than repair the deliverable, so the one-keystroke
  apply-all path (Section 2) still requires explicit user confirmation for any gap whose
  `recommended` is `accept` or `rescope` (Section 2 handles this).

`recommended` is a *proposal only*. The reviewer never edits, never dispatches, never re-audits
itself.

`CONFORMS` output is unchanged: no gap blocks, proceed.

### 2. Disposition menu (`conformance-check.md`, replaces the "When the check finds gaps" section)

This replaces the current "When the check finds gaps" section (`conformance-check.md` lines 80-95,
the CONFORMS/GAPS three-bullet block) in full. On `CONFORMS`: record the verdict in the completion
summary's closure section and proceed (unchanged).

On `GAPS`: the orchestrator (the main session running the verify gate - the same role SDD calls
"the orchestrator", not a dispatchable component) renders the enumerated list - each gap as
`Gn [VERDICT] origin - remediation (recommended: fix|accept|rescope)` - followed by a numbered
prompt (chat turns cannot express a bare keystroke):

```
[1] apply all recommended dispositions
[2] review per-gap (override fix/accept/rescope before applying)
```

Selecting `[1]` applies each gap's `recommended` disposition, **except** that any gap whose
`recommended` is `accept` or `rescope` is listed and requires an explicit confirming reply before
its spec edit lands (accept/rescope silently rewrite the origin - they never ride the fast path
unconfirmed). `[2]` prompts a per-gap override, then applies.

Disposition semantics:

- `fix` - dispatch a remediation unit (Section 3), then re-audit (Section 4). For an
  `UNAUTHORIZED` gap, "fix" means **removing** the unrequested code.
- `accept` - the **main session** (not a dispatched subagent) folds the deviation into the spec as
  a dated decision using the template below; once recorded it is no longer drift. For
  `UNAUTHORIZED`, accept = "keep the shipped behavior and document it as intended."
- `rescope` - the main session records the requirement in the spec as an explicit
  out-of-scope / deferred item, dated.

**Dated-decision template** (appended to the spec's decisions/deviations section):

```
- YYYY-MM-DD accept|rescope Gn: <requirement/behavior> - <one-line rationale> (conformance gate)
```

**Commit timing.** `accept`/`rescope` spec edits are committed **before** any fix wave dispatches:
pi-cohort rejects a dirty tree on a `worktree: true` dispatch, and the re-audit must read the
amended spec as its origin. If a round has only `accept`/`rescope` dispositions and no `fix`, the
spec edits land, the verdict is recorded, and no re-audit runs (nothing was fixed).

No completion claim stands over a gap that is neither fixed, accepted, nor rescoped.

### 3. Fix dispatch - reuse `dispatching-parallel-agents` mechanics

Gaps marked `fix` become tasks dispatched through the `dispatching-parallel-agents` fan-out
primitive. The loop reuses that skill's mechanics verbatim; it invokes **no** `phase_tracker` /
`plan_tracker` calls and does not enter SDD Parallel-Wave Mode.

**Precondition:** the conformance gate runs inside a worktree on the SDD and worktree-based
finishing paths. On the ad-hoc `finishing-a-development-branch` paths that run in a **normal repo**
(`GIT_DIR == GIT_COMMON`) or **detached HEAD** (`finishing-a-development-branch/SKILL.md` lines
60-62), there is no worktree HEAD to branch fix waves from. In those contexts the menu (Section 2)
offers `accept` / `rescope` and **manual fix-in-place** only; `fix`-via-dispatch is unavailable and
the gap either gets a manual fix the user drives or routes to escalation. The isolated
fix-wave loop below applies only when the gate is already inside a worktree.

**Wave grouping** comes from the reviewer's disjointness certification: gaps certified `disjoint`
(files AND resources) form one parallel wave; any `conflicts` pair splits into separate serial
waves. Same partition rule as planned execution.

**Fix-wave dispatch shape** (mirrors `dispatching-parallel-agents`):

```ts
subagent({
  context: "fresh",
  worktree: true,
  cwd: "<abs worktree path, from git rev-parse --show-toplevel>",
  tasks: [
    { agent: "implementer",
      task: "Close conformance gap G1. Origin requirement: <origin>. What's missing: " +
            "<remediation>. Satisfy the requirement; do not expand scope. " +
            "Ownership boundary - modify only: <touched-files>." },
    // ... one task per disjoint gap in this wave
  ],
})
```

- **Unit = `implementer`**, `context: "fresh"`, `worktree: true`, `cwd` = the conformance
  worktree's absolute path. The task carries the gap's `origin` + `remediation` framed as a
  requirement to satisfy (not a plan task), plus `touched-files` as an explicit **ownership
  boundary** so a parallel implementer does not wander outside its estimate and collide with a
  sibling wave.
- **Integration:** serial `git apply` of each wave's patches back onto the worktree HEAD, per
  `dispatching-parallel-agents` "Review and Integrate". The fix work ships in the **same worktree**
  and is merged by `finishing-a-development-branch`'s existing squash - no new merge machinery.
- **Failure handling is inherited verbatim** from `dispatching-parallel-agents` "Review and
  Integrate": textual conflict -> re-run one agent sequentially with the other's integrated changes
  as context (no hand-merge); semantic conflict (applies clean, suite fails) -> re-run the offending
  task sequentially on integrated HEAD; a failed agent -> integrate the successful ones, then retry
  the failed one with fresh context including the integrated changes. An implementer that returns
  BLOCKED / NEEDS_CONTEXT surfaces to the user, same as any dispatched unit.
- **`code-reviewer` over the integrated fix delta, once per round** (not per gap): gap fixes land
  *after* the branch's final code review, so without this they ship unreviewed for quality. One
  review over the round's cumulative diff is the cheap correct dose.
- **`spec-reviewer` is excluded.** Plan-vs-code is the wrong reference point for a gap fix; the
  conformance re-audit (Section 4) already checks fixes against the origin.
- **Test gate** on the integrated tree after all of the round's waves apply, using the project's
  canonical test command (the same command the worktree baseline used). A failure re-enters the
  failure-handling rules above before the round proceeds.

One round = dispatch fix waves -> serial integrate -> `code-reviewer` on the round delta ->
test gate -> re-audit (Section 4).

### 4. Bounded re-audit loop

After a fix round, re-dispatch `conformance-reviewer` for a **delta-scoped** re-audit. The re-audit
carries:

- the **full prior conformance report** - every row including DELIVERED rows and their `evidence`
  `file:line` (needed for the regression guard below), not just the gap IDs;
- the **fix diff** for the round.

The reviewer (not the orchestrator) computes the regression intersection: it re-verifies **the
gaps marked `fix` this round PLUS any previously-DELIVERED requirement whose `evidence` file
appears in the fix diff**. Gap ID continuity: it reuses `G1..Gn`, marking each `DELIVERED`
(closed), still open with its prior verdict, or introducing `Gn+1` for a regression / newly
surfaced gap.

- The re-audit dispatch carries the **same call-site `model:` injection** as the initial audit:
  when `piGauntlet.closureReview.model` is set, `extensions/phase-tracker.ts`'s closure guard
  requires every `conformance-reviewer` dispatch to specify `model:`, and the re-audit is a second
  such dispatch.
- New or still-open gaps within the cap re-enter the menu (Section 2).
- **Cap: 2 fix rounds (3 audits total)**, read from
  `settings.json#piGauntlet.closureReview.maxFixRounds` (default `2`; see Section 5).
- **On non-convergence** (cap reached with open gaps): **escalate to human** with the per-gap
  history - a round-by-round verdict trail per gap ID. No silent re-loop, no auto-ship.

### 5. Config

New key: `piGauntlet.closureReview.maxFixRounds` (integer, default `2`), alongside the existing
`closureReview.model` / `closureReview.enforce`. It is read by `conformance-check.md`'s loop-control
**prose** (the orchestrator reads settings directly at the gate); it is **not** wired into the
`phase-tracker.ts` extension - the cap is enforced by the protocol, not by a new extension gate
(see the enforcement note in Out of scope). Validation the orchestrator applies when reading it:

- missing / not an integer -> default `2`.
- `< 0` -> clamp to `0`.
- `0` -> audit-only: a `GAPS` verdict renders the menu with **`accept` / `rescope` only** (`fix`
  unavailable), and any gap left unresolved routes to escalation instead of dispatching a fix.

## Files changed

| File | Change |
|---|---|
| `agents/conformance-reviewer.md` | Output contract: literal fenced gap-block format (id/verdict/origin/evidence/remediation/touched-files/touched-resources/recommended), `DELIVERED` in re-audit rounds, `Parallel-safe:` grammar, `UNAUTHORIZED` origin token, `recommended` selection policy. No frontmatter change. |
| `skills/verification-before-completion/reference/conformance-check.md` | Replace the "When the check finds gaps" section (lines 80-95) with the full protocol: enumerated numbered menu + apply-all-recommended default (with accept/rescope confirmation), dated-decision template + commit timing, fix dispatch via `dispatching-parallel-agents` mechanics + inline dispatch shape + inherited failure handling, delta re-audit with full-report payload + model injection, cap + escalation, config read/validation. |
| `skills/subagent-driven-development/SKILL.md` | Verify step "After All Tasks" step 3: **replace** its inline disposition bullets (fix now / accept / rescope) with a pointer to the protocol. No Parallel-Wave-Mode edits. |
| `skills/finishing-a-development-branch/SKILL.md` | Conformance step: **replace** its inline disposition bullets with a pointer to the protocol; note the non-worktree/detached-HEAD menu restriction. |
| `README.md` | Document `piGauntlet.closureReview.maxFixRounds`. |
| `CHANGELOG.md` | Entry (minor - extends closureReview config + skill/agent behavior). |

## Documentation impact

- `README.md` - new `closureReview.maxFixRounds` config key documented in the closureReview section.
- `CHANGELOG.md` - one entry.
- No `AGENTS.md` change: the knobs table describes `conformance-reviewer`'s frontmatter, which is
  unchanged (the output contract lives in the body, not frontmatter).
- No `phase-tracker.ts` change: `maxFixRounds` is read by skill prose, not the extension.

## Testing approach

Skill/agent/doc change - no runtime suite exercises skill prose. Verification is:

- **Placeholder scan:** `rg -n "TODO|TBD|<fill|\[example\]|XXX" skills/verification-before-completion/reference/conformance-check.md agents/conformance-reviewer.md` -> zero matches.
- **Field-name consistency** between the two files:
  `rg -o "touched-files|touched-resources|recommended|Parallel-safe" agents/conformance-reviewer.md skills/verification-before-completion/reference/conformance-check.md`
  -> every field the menu/loop references exists in the reviewer contract with the same spelling.
- **Disposition-verb consistency:** `fix` / `accept` / `rescope` spelled identically in the
  reviewer `recommended` policy and the menu semantics.
- **Generic-skill grep** (`AGENTS.md` mandate): `rg -ni "<company>|<user-path>|<service>" skills/`
  on edited skill bodies -> zero matches.
- **Cross-reference integrity:** the pointers added to SDD and the finishing skill name a section
  that exists in `conformance-check.md` (`rg -n "<section title>" skills/verification-before-completion/reference/conformance-check.md`).
- **Config default match:** the `maxFixRounds` default documented in `README.md` equals the default
  the protocol assumes (`2`).

## Edge cases

- **`maxFixRounds: 0`** - audit-only; `GAPS` renders accept/rescope-only menu, unresolved -> escalate.
- **Non-worktree / detached-HEAD ad-hoc path** - no fix-wave dispatch; menu offers accept/rescope +
  manual fix-in-place only (Section 3 precondition).
- **All gaps accept/rescope, none fix** - spec edits land + commit, verdict recorded, no re-audit.
- **Reviewer mis-certifies disjointness** - same risk as planned execution (not machine-checkable);
  the integration-time conflict fallback + test gate are the backstop, as in
  `dispatching-parallel-agents`. `touched-files` ownership boundary in the fix task narrows it.
- **Fix introduces a regression** - caught by the delta re-audit's regression guard (previously
  DELIVERED rows whose evidence intersects the fix diff).
- **`UNAUTHORIZED` gap** - `origin` = `none (scope creep)`; `fix` = remove the code, `accept` = keep
  + document, `rescope` inapplicable (no requirement to defer).
- **Non-convergence at cap** - human escalation with per-gap round history; never auto-ship.

## Out of scope

- Editing execution-phase machinery (SDD Parallel-Wave Mode internals, `writing-plans` wave
  grouping) or the `phase-tracker.ts` extension.
- Changing `finishing-a-development-branch`'s squash/merge behavior.
- Making the reviewer's `touched-resources` machine-verified (stays an estimate, matching
  `writing-plans`' Runtime-resource disjointness rule).
- Any new agent persona or skill (the protocol lives in the existing reference doc).
- **Mechanical enforcement of the round cap / mandatory re-audit** via `phase-tracker.ts`.
  Enforcement stays prose-only in `conformance-check.md`. Rationale: the phase-tracker closure guard
  already hard-gates `complete verify` on a conformance dispatch (that gate is why the audit runs at
  all); adding round-counting/fix-loop logic to the extension would put new conditionals into the
  execution-adjacent tracker the hard constraint forbids touching. The prose loop is the same
  enforcement class as every other skill step; the measured 26/29 loop-back miss was the **absence**
  of a documented loop, not a defied one. If prose proves insufficient in practice, mechanical
  enforcement is a follow-up spec against the extension, weighed against the no-new-conditionals rule.
