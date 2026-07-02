# Parallel Wave-Based Implementation Execution

**Status:** Draft (spec review)
**Date:** 2026-05-31
**Spec:** this document
**Worktree:** `.worktrees/parallel-implementation` (branch `parallel-implementation`)
**Touches:** `skills/writing-plans/`, `skills/subagent-driven-development/`, `skills/dispatching-parallel-agents/`

## Problem

The implementation phase is strictly sequential. `subagent-driven-development` dispatches one implementer per task, one at a time; `writing-plans` emits a flat dependency-ordered task list with no notion of which tasks are independent. Plans frequently contain tasks that touch disjoint files and have no ordering dependency, yet they execute serially, wasting wall-clock time.

The only parallel skill, `dispatching-parallel-agents`, is framed exclusively for *debugging* independent failures, not plan-driven implementation.

## Goals

- `writing-plans` groups independent tasks into **waves** and declares per-task file ownership so independence is *checkable*, not vibes.
- `subagent-driven-development` gains a **parallel-wave execution mode**: within a wave, fan out implementers concurrently in isolated worktrees; integrate serially; review; commit; advance.
- The execution mode is chosen **once at handoff** (hybrid trigger), defaulting to sequential.
- Conflicts (textual and semantic) are detected and resolved deterministically without the orchestrator hand-merging.

## Non-Goals

- Parallel execution inside the **separate-session** path (`executing-plans`). Out of scope; possible future extension.
- Cross-wave parallelism. Waves run strictly in sequence.
- Auto-inferring independence the plan didn't declare. The plan's declared file ownership is the contract; the executor enforces and backstops it, it does not guess.
- Changing the sequential default. Sequential remains the default mode.

## Ground-Truth Constraints

The `pi-cohort` skill (dispatch ground truth) is deliberately opinionated **against** parallel writes:

- "Parallelize reading, review, validation, and synthesis support, **not normal writes**, unless you deliberately isolate writers with worktrees." (`skills/pi-cohort/SKILL.md:629`)
- "For very large work, split into serial milestones instead of launching a swarm of writers." (`:703`)
- `worktree: true` is the one sanctioned concurrent-write mechanism: "gives each parallel task its own git worktree branched from HEAD." (`:415-431`)

This design lives **entirely inside the worktree-isolation carve-out.** The skill changes must invoke that exception explicitly; parallel-wave mode is the deliberate, isolated-writer case, not a relaxation of the single-writer default.

### Verified dispatch mechanics (`pi-cohort` source)

| Fact | Source | Design consequence |
|---|---|---|
| Child worktrees created at `os.tmpdir()/pi-worktree-<runId>-<index>` | `src/runs/shared/worktree.ts:156` | No on-disk nesting under the orchestrator's worktree; children are flat git siblings. |
| `toplevel` / base `HEAD` resolved from the dispatch **top-level `cwd`** (not the process cwd) | `worktree.ts:104,111,493` | Orchestrator must pass `cwd: <worktree path>`; else children branch from the primary checkout (e.g. `main`), not the worktree. Per-task `cwd` must equal it or the run errors (`:125`). Wave N+1 sees wave N once committed. |
| `git worktree add <tmp> -b <branch> HEAD` | `worktree.ts:326` | Each child branches from current HEAD. |
| Result captured as `git diff --cached <base>` → `task-<index>-<agent>.patch` | `worktree.ts:449-450,537` | Integration is **patch-apply**, not branch-merge. |
| Worktrees + branches `worktree remove --force` + `prune` after capture | `worktree.ts:361,479,550-555` | No living branches to merge; the patch file is the only integration artifact. Orchestrator owns integration. |

"Worktree-in-worktree" is a non-issue: git has no nesting concept (all worktrees share one common `.git`), and children land in `$TMPDIR` regardless. Confirmed empirically on git 2.53.0.

## Design Overview

A **wave** is a maximal set of plan tasks that (a) have no ordering dependency on each other and (b) own pairwise-disjoint file sets. The executor runs waves in sequence; within a wave it runs tasks concurrently, each isolated in its own worktree, then integrates their patches serially behind a single test+review gate.

```
for each wave (in dependency order):
  pre-dispatch: verify tasks own disjoint files        # static independence check
  fan out:      N implementers, context:fresh, worktree:true, branched from HEAD
  per task:     parse status; spec-review its patch (read-only, parallelizable)
  integrate:    git apply --index each patch sequentially onto HEAD
                  apply fails  -> textual conflict  -> sequential fallback for that task
  test gate:    run suite on integrated tree
                  failure      -> semantic conflict / bug -> diagnose, re-run task sequentially
  quality gate: code-quality review on the integrated wave diff (loop to ✅)
  commit the wave                                       # clean tree; new base for next wave
after all waves: final full-diff reviewer + self-audit (unchanged from today)
```

The orchestrator never edits code and never resolves merge markers by hand. Its only write is `git apply` of a returned patch and the wave commit. Every conflict resolution is a **re-dispatch**, preserving fresh-subagent isolation.

## Component Changes

### 1. `writing-plans` — waves + file-ownership contract

**Wave grouping.** Tasks are grouped under `## Wave N — <label>` headers. The existing flat `### Task N` headers nest under a wave. A wave with one task is legal (degenerate, runs sequentially). Each wave after the first states its dependency on prior waves:

```markdown
## Wave 1 — Foundations

Parallel-safe: Tasks 1–3 own disjoint files (see each task's Files block).

### Task 1: ...
### Task 2: ...
### Task 3: ...

## Wave 2 — Wire-up

Depends on Wave 1: Task 4 consumes the API introduced by Task 1.

### Task 4: ...
```

**File-ownership contract.** The per-task `**Files:**` block (Create/Modify/Delete/Test) *is* the ownership declaration — no new syntax. New rule: **within a wave, the union of every task's declared paths must be pairwise disjoint.** Globs are allowed for `Modify` when exact paths are unknown, but globs must not overlap another same-wave task's paths. A task that must touch another's file belongs in a later wave.

**Ordering rule update.** "Order tasks so dependencies are satisfied by earlier tasks" becomes "Group dependency-free, file-disjoint tasks into the same wave; order waves so each wave's dependencies are satisfied by earlier waves." A pure dependency chain yields one task per wave (no parallelism — expected).

**Self-review additions.** Add a check: for every multi-task wave, confirm the tasks' `Files:` sets are pairwise disjoint. Overlap = mis-grouped wave (fix before handoff). This gives the spec/plan reviewer a concrete, checkable independence claim.

### 2. `writing-plans` — execution handoff menu (3 options, disambiguated)

The current handoff (`SKILL.md:198`) ships two options and labels option 2 "**Parallel** Session (separate)" — which collides with task-level parallelism. Replace with:

```
1. Subagent-Driven, sequential (this session)
     — one task at a time, two-stage review. Default.
2. Subagent-Driven, parallel waves (this session)
     — independent tasks in a wave run concurrently in isolated worktrees,
       integrated serially with the same two-stage review.
       [shown only when the plan has ≥2 tasks in some wave]
3. Separate Session (executing-plans)
     — batch execution with checkpoints in a fresh session.
       [drop the word "Parallel"]
```

Options 1 and 2 are the same skill (`subagent-driven-development`), one toggle. Option 2 is **plan-aware**: hidden when every wave has one task. Selecting it routes to `subagent-driven-development` in parallel-wave mode.

### 3. `subagent-driven-development` — parallel-wave mode

Add a "Parallel-Wave Mode" section. Default flow ("The Process") stays as the sequential per-task path. Parallel-wave mode applies when chosen at handoff and the plan has multi-task waves.

**Progress tracking (`plan_tracker`).** No extension change — `plan_tracker` is a flat list of `{name, status}` (`pending|in_progress|complete`) with no native group concept (`extensions/plan-tracker.ts`), so waves are *encoded*, not modeled:

- **Init once, wave-ordered.** At execution start, `init` with **every** task across **all** waves in wave order, each name prefixed with its wave — `"W1: <title>"`, `"W2: <title>"`, …. `init` accepts name strings only and assigns positional 0-based indices; those indices stay stable for the whole run. **Never re-init mid-run** — `init` rebuilds the list and drops all statuses.
- **Wave fan-out → `in_progress`.** `update` every task index in the wave to `in_progress` (one call per index). Multiple simultaneous `in_progress` entries is expected in parallel mode; sequential mode has exactly one.
- **Wave commit → `complete`.** After the test + quality gate passes and the wave commits, `update` all that wave's indices to `complete`. `complete` means **durably committed**, not "patch applied" — a task in conflict-fallback stays `in_progress` until its wave commits, so there is no status churn.
- **Lifecycle per task:** `pending → in_progress (wave fan-out) → complete (wave commit)`.
- **Widget caveat (known, deliberately unfixed).** The persistent widget's icon strip (`○ → ✓`) and `(c/total)` count reflect every task, but its trailing *name* shows only the **first** `in_progress` task (`formatWidget`). In parallel mode the icon strip / `status` action is the full in-flight view; a richer multi-task widget is a separate extension change, out of scope (YAGNI).
- **Sequential mode** is unchanged from today (init the full list, one `in_progress` at a time); wave prefixes are harmless if present.

**Per-wave loop** (the orchestrator's algorithm):

1. **Independence check.** Parse the wave's tasks' `Files:` blocks; assert pairwise-disjoint. Overlap → treat the wave as sequential single-task waves (plan bug; surface it). 
2. **Fan out.** One `subagent(...)` parallel call:

   ```ts
   subagent({
     context: "fresh",
     worktree: true,
     concurrency: 4,            // default; cap = wave size; tunable
     tasks: [
       { agent: "implementer", task: "<Task text + owned files + status protocol>", output: "wave<N>-task<i>.md" },
       // ... one entry per wave task
     ],
   })
   ```
3. **Status + spec review per task.** Parse each task's `DONE`/`DONE_WITH_CONCERNS`/`NEEDS_CONTEXT`/`BLOCKED` (existing table). Spec-review each returned patch in isolation (it applies to the shared base, so it reviews cleanly). Spec reviews are read-only and may themselves be dispatched in parallel. Re-dispatch incomplete/failed tasks (fresh, `worktree:true`, branched from base) until `DONE` + spec ✅.
4. **Integrate.** `git apply --index <task-i.patch>` sequentially onto HEAD.
5. **Test gate.** Run the suite on the integrated tree (semantic-conflict detector).
6. **Quality review.** Code-quality review on the integrated wave diff; loop fixes to ✅.
7. **Commit the wave.** Leaves a clean tree; next wave's children branch from this commit.

**Two-stage review preserved:** spec review is per-task (pre-integration, parallelizable); quality review is per-wave on the integrated diff (post-integration). Both gates still required before the wave commits.

**Dependent context across waves.** Wave N+1 tasks branch from a HEAD containing wave N, so they *see* the code. Still forward wave N's task summaries into wave N+1 prompts for context (existing "Dependent tasks" guidance).

**Red-flag reconciliation.** The current red flag "Dispatching multiple implementer subagents in parallel on overlapping files" stays — it is exactly what the independence check + worktree isolation prevent. Reword to: "Dispatching parallel implementers on overlapping files, or without `worktree: true` / outside wave mode." Wave mode is the sanctioned exception (disjoint files + worktree isolation + serial integration).

**Caveat (generic).** Parallel-wave mode requires each task to be independently runnable and verifiable in a fresh worktree — no reliance on uncommitted local state. `pi-cohort` symlinks `node_modules`; repos needing other per-worktree setup must account for it.

### 4. `dispatching-parallel-agents` — generalize beyond debugging

This skill already documents the reusable mechanic (`worktree: true`, `concurrency`, `context: "fresh"`, per-task diffs, "if agents edited the same files" fallback). Changes:

- **Reframe scope** from "multiple unrelated *failures*" to "multiple independent *tasks* (bug fixes **or** implementation tasks)." Keep debugging as the worked example.
- **Make it the canonical mechanic home.** `subagent-driven-development`'s parallel-wave mode references this skill for fan-out + worktree isolation + patch integration + conflict fallback, rather than duplicating it.
- **Align conflict policy.** The existing "pick the correct version per hunk, or re-run one agent with the other's changes as context" should lead with **re-run (sequential fallback)** as the preferred resolution and treat manual hunk-merge as a last resort — consistent with `subagent-driven-development`'s "orchestrator does not write code" rule.

### 5. Naming consistency (cross-skill)

Reserve **"parallel"** for *task-level* concurrency (waves, `dispatching-parallel-agents`). The separate-session path is **"Separate Session"** — matching `executing-plans`' own "execute in a separate session" self-description. Canonical names for the three execution paths, used everywhere:

- **Sequential (this session)** → `subagent-driven-development`, sequential mode
- **Parallel waves (this session)** → `subagent-driven-development`, parallel-wave mode
- **Separate Session** → `executing-plans`

Renaming the handoff menu alone is insufficient: `subagent-driven-development` itself currently calls `executing-plans` "parallel session," which would collide with its own new parallel-wave mode. Full rename set:

| Skill / location (anchor text) | Current | New |
|---|---|---|
| `writing-plans` handoff menu, separate-session option | "Parallel Session (separate)" | "Separate Session (executing-plans)" |
| `writing-plans` routing line ("→ user opens new session in worktree") | "Parallel Session →" | "Separate Session →" |
| `subagent-driven-development` comparison-table "Session" row | "Parallel session" | "Separate session" |
| `subagent-driven-development` "When to use" bullet ("…instead of same-session") | "parallel-session execution" | "separate-session execution" |

**Leave unchanged** (legitimate task-parallel usage): all of `dispatching-parallel-agents`; the reworded red flag in §3; unrelated hits (`brainstorming` "parallel state", `systematic-debugging` test-timeout note). The comparison table's *fuller* rework (reflecting that `subagent-driven-development` now has two modes) is covered in §3; §5 changes only the naming token.

## Conflict Handling

Two failure classes, detected at different stages:

| Class | Cause | Detected by | Resolution |
|---|---|---|---|
| **Textual** | Two tasks edited the same file/lines | `git apply` fails at integration | Drop the failing task from the batch; finish integrating the rest; re-run the dropped task **sequentially**, fresh implementer branched from the updated HEAD so it adapts. |
| **Semantic** | Disjoint files, incompatible assumptions (renamed symbol, changed type/shape) | Post-integration **test gate** fails (git sees nothing) | Diagnose the incompatible pair; re-run the offending task sequentially on updated HEAD. If ambiguous which task is "right," **escalate to the user.** |

**Layered detection, not belt-and-suspenders:** the static pre-dispatch disjointness check (prevents most textual conflicts before spending compute), the `git apply` step (textual backstop), and the test gate (semantic backstop) each catch a *different* failure at a *different* time.

**Invariant:** the orchestrator never resolves merge markers by hand. Every resolution is a re-dispatch. This is where silent breakage would otherwise hide, and it preserves fresh-subagent isolation.

## Edge Cases

- **Single-task wave.** Runs as today's sequential per-task flow (worktree fan-out is pointless for N=1).
- **`BLOCKED`/`NEEDS_CONTEXT` mid-wave.** Integrate and commit the `DONE` tasks first; then resolve the blocked task per existing rules (diagnose / re-dispatch with answers / escalate) before advancing. A blocked task never strands a wave's completed work, but the wave is not "complete" until the blocked task resolves or the user accepts dropping it.
- **Dirty tree before a wave.** Forbidden — `pi-cohort` worktree mode requires clean state. The commit-per-wave rule guarantees it; if the tree is dirty, stop and surface it.
- **Whole wave fails / repeated conflicts.** After the existing two-attempt fix budget, stop and report; the wave was mis-grouped or the plan is wrong.
- **Empty wave.** Plan error; reject at the independence check.

## Alternatives Considered

| Alternative | Why not |
|---|---|
| Staged-planning + single writer (pi-cohort milestone/`/orchestrate` model) | Parallelizes *judgment*, not *writes*. Doesn't deliver wall-clock wins for independent, write-heavy tasks — the user's actual goal. |
| Shared-worktree parallel writers | Collisions; violates `pi-cohort` single-writer guidance and the existing red flag. |
| Implicit auto-parallelization (any independent wave) | Contradicts single-writer default; fires worktree overhead on tiny tasks. Hybrid (explicit choice once at handoff) preferred. |
| Branch-merge integration | Not available — `pi-cohort` removes worktrees/branches and returns patches. Patch-apply is the actual contract. |
| New dedicated parallel-execution skill | Duplicates `subagent-driven-development`. Parallel is a mode + reuse of `dispatching-parallel-agents`. |

## Verification Approach

Skills are markdown; "tests" are methodology + lint + dogfood:

1. **Generic-ness lint** (AGENTS.md rule): `rg -ni "<company>|<user-paths>|<internal-services>" skills/writing-plans skills/subagent-driven-development skills/dispatching-parallel-agents` → zero matches.
2. **Internal consistency:** menu option names match across `writing-plans` and `subagent-driven-development`; cross-references resolve; the file-ownership rule is stated identically where referenced; and `rg -ni "parallel session" skills/` returns **zero** matches (the term is fully retired per §5), with every remaining `parallel` in skill bodies referring only to task-parallelism.
3. **End-to-end dogfood:** construct a minimal sample plan with one 2-task disjoint wave + one dependent single-task wave; run parallel-wave mode in a scratch repo; confirm (a) both tasks fan out with `worktree: true`, (b) returned patches `git apply` cleanly, (c) an intentionally overlapping wave triggers the sequential fallback, (d) a semantic conflict is caught by the test gate, and (e) `plan_tracker` shows multiple `in_progress` entries during the wave, all flipping to `complete` only at the wave commit.
4. **Project-overrides block** present and unchanged in each edited skill.

## Open Questions

None. (Separate-session parallelism and cross-wave parallelism are explicit Non-Goals, not open questions.)
