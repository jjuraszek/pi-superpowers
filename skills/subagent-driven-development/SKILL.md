---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

> **Related skills:** Need an isolated workspace? `/skill:using-git-worktrees`. Need a plan first? `/skill:writing-plans`. Done? `/skill:finishing-a-development-branch`. Reached via the auto-chain from `/skill:writing-plans` (not a direct human entry point; direct invocation stays possible for recovery, e.g. re-running after a STOP).

# Subagent-Driven Development

Execute a plan by dispatching a **fresh subagent per task**, with two-stage review after each: spec compliance first, then code quality.

**Core principle:** Fresh subagent per task + two-stage review = high quality, fast iteration.

If a tool result contains a ⚠️ workflow warning, stop immediately and address it before continuing.

## Why Subagents

Your context window holds the full plan, prior decisions, and conversation history. Each subagent gets a fresh window with only the current task's text and context.

- **No context pollution.** Task N's noise doesn't leak into Task N+1.
- **Tighter focus.** Subagent reads less, makes fewer cross-task assumptions, ships smaller diffs.
- **Cheaper at scale.** Smaller models can handle simple subtasks; you only spend top-tier tokens on orchestration and hard problems.

You are the **orchestrator**. You read the plan, dispatch, review the review, decide. You do **not** write code yourself.

## Continuous Execution

**Do not pause to check in with the user between tasks.** The plan is already approved. Pause only when:

- A subagent returns `NEEDS_CONTEXT` or `BLOCKED` (see [Implementer Status](#implementer-status))
- A reviewer finds issues the implementer cannot resolve in two attempts
- A ⚠️ workflow warning fires
- You hit the end of the plan (then stop and report — see [After All Tasks](#after-all-tasks-complete))

Periodic "should I continue?" prompts add latency without adding safety. The plan is the contract; execute it.

## Prerequisites

- Running inside a dedicated worktree (the same one the spec and plan were authored in). If you're on `main` in the primary checkout, stop and invoke `/skill:using-git-worktrees` first — implementation never lands directly on `main`.
- Approved plan or clear task scope
- `plan_tracker` initialized with the full task list

## Sequential vs. Parallel-Wave

subagent-driven-development runs **sequentially by default**; when the plan groups independent tasks into waves, [Parallel-Wave Mode](#parallel-wave-mode) parallelizes the tasks within a wave. The mode is auto-selected by `writing-plans` at handoff (≥2 tasks in some wave → parallel; else sequential) — you are not asked to choose.

**Dependent tasks:** include the previous task's implementation summary and relevant file paths in the next subagent's `task`. Track outputs so you can pass them forward.

## The Process

Before the first task, enter the implement phase: `phase_tracker({ action: "start", phase: "implement" })` — you hold this phase for the parent session while the per-task work is dispatched to subagents; `plan_tracker` auto-completes it once every task is done.

For each task in `plan_tracker`:

1. **Dispatch implementer.** Pass the full task text + scene-setting context. Don't make the subagent re-read the plan.
2. **Handle implementer status** (see below).
3. **Dispatch spec reviewer.** Verify the diff matches the spec — nothing missing, nothing extra.
4. If spec reviewer finds gaps → re-dispatch implementer to fix → re-review. Loop until ✅.
5. **Dispatch code-quality reviewer.** Only after spec is ✅.
6. If quality reviewer finds issues → re-dispatch implementer → re-review. Loop until ✅.
7. Mark task complete in `plan_tracker`.

After all tasks: dispatch a final reviewer over the full diff. Then [After All Tasks](#after-all-tasks-complete).

## Implementer Status

Every implementer dispatch returns one of:

| Status | Meaning | Orchestrator action |
|---|---|---|
| `DONE` | Implemented + tests pass + self-reviewed + committed | Proceed to spec review |
| `DONE_WITH_CONCERNS` | Implemented + tests pass, but flagged a deviation or risk | Read concerns. If acceptable, proceed. If not, dispatch fix subagent. |
| `NEEDS_CONTEXT` | Implementer needs information you have | Answer the questions, re-dispatch with answers in the task text |
| `BLOCKED` | Cannot proceed (missing dependency, spec contradicts code, environment broken) | Stop. Diagnose. Either fix orchestration-level issue and re-dispatch, or escalate to user. |

Implementer prompt templates must instruct subagents to return one of these statuses explicitly.

## Model Selection

Pi-subagents accepts a per-task `model` override. Use it.

| Task complexity | Model tier | Use cases |
|---|---|---|
| Trivial mechanical change | Cheap | Rename, formatter run, dependency bump, file-move with no edits |
| Standard implementation | Default | Most plan tasks — feature work with tests, refactor with tests |
| Hard / novel / large surface | Most capable | New subsystem, complex algorithm, cross-service contract change |
| Spec review | Default | Reads diff + spec, mechanical comparison |
| Code-quality review | Most capable | Judgment call on naming, design, complexity |
| Final reviewer | Most capable | Whole-PR-scope review |
| Conformance / closure | Most capable | Whole-deliverable-vs-origin intent gate (`conformance-reviewer`; model from `piSuperpowers.closureReview.model`, injected call-site) |

```ts
subagent({
  agent: "implementer",
  task: "...",
  model: "anthropic/claude-haiku-4"   // cheap tier
})
```

When in doubt, default. Don't downgrade reviewers — false negatives are expensive.

## Dispatch

```ts
// implementer
subagent({ agent: "implementer", task: "<task text + context + status protocol>" })

// spec compliance
subagent({ agent: "spec-reviewer", task: "<diff range + spec excerpt + ask: does this match?>" })

// code quality
subagent({ agent: "code-reviewer", task: "<diff range + ask: production-ready?>" })

// closing-loop conformance (origin vs deliverable) — its OWN dispatch, never fused with code quality
// model from piSuperpowers.closureReview.model (read $PI_CODING_AGENT_DIR/settings.json); omit to inherit
subagent({ agent: "conformance-reviewer", model: /* piSuperpowers.closureReview.model from config, else omit to inherit */, task: "<spec path + verbatim original prompt + full diff vs main; per conformance-check.md>" })
```

Prompt templates live alongside this SKILL.md:

- `./implementer-prompt.md`
- `./spec-reviewer-prompt.md`
- `./code-quality-reviewer-prompt.md`

## Parallel-Wave Mode

Auto-selected at handoff by `writing-plans` (any wave with ≥2 tasks) when the plan groups tasks into **waves** (see `writing-plans`). Waves run in sequence; within a wave, tasks that the plan certified file- **and** runtime-resource-disjoint run concurrently in isolated worktrees, integrated serially behind one test + review gate. The sequential [Process](#the-process) above is the default and the fallback; this mode is the deliberate, worktree-isolated exception to the "no parallel implementers" red flag.

**Enter the implement phase first.** Before the first wave, call `phase_tracker({ action: "start", phase: "implement" })` (as in [The Process](#the-process)); `plan_tracker` auto-completes it once every task across all waves is done.

**Progress tracking (`plan_tracker`).** `plan_tracker` is a flat list with no native group concept, so waves are *encoded*, not modeled:

- **Init once, wave-ordered:** `init` with every task across all waves in wave order, each name prefixed with its wave (`"W1: <title>"`, `"W2: <title>"`, …). Indices are positional and stable; never re-init mid-run (it drops statuses).
- **Wave fan-out → `in_progress`:** mark every task index in the wave `in_progress`. Multiple simultaneous `in_progress` entries is expected (sequential mode has one).
- **Wave commit → `complete`:** after the wave's gate passes and it commits, mark all that wave's indices `complete`. `complete` = durably committed, so a task in conflict-fallback stays `in_progress` until its wave commits.
- **Lifecycle per task:** `pending → in_progress (wave fan-out) → complete (wave commit)`.
- **Widget caveat (known, deliberately unfixed).** The persistent `plan_tracker` widget's icon strip (`○ → ✓`) and `(c/total)` count reflect every task, but its trailing *name* shows only the **first** `in_progress` task. In parallel mode the icon strip and the `status` action are the full in-flight view; a richer multi-task widget is a separate extension change, out of scope (YAGNI).
- **Sequential mode is unchanged:** init the full list, one `in_progress` at a time; wave prefixes are harmless if present.

**Per-wave loop:**

1. **Independence check.** Parse the wave's tasks' `Files:` blocks; assert pairwise-disjoint (mechanical). Runtime-resource disjointness (DB/schema, port, fixture, external service, shared temp path) is not machine-checkable here — trust the plan's wave grouping, which `writing-plans`' D5 contract guarantees. Either kind of overlap → the wave is mis-grouped; run those tasks as sequential single-task waves and note it.
2. **Fan out.** One parallel dispatch (shape below): `implementer` per task, `context: "fresh"`, `worktree: true`. Each returns a status + a patch.
3. **Status + spec review per task.** Parse each `DONE`/`BLOCKED`/etc. (see [Implementer Status](#implementer-status)); spec-review each returned patch against its task (read-only, parallelizable). Re-dispatch incomplete tasks (fresh, `worktree: true`) until `DONE` + spec ✅.
4. **Integrate.** `git apply` each task's patch sequentially onto HEAD. Apply fails = textual conflict → drop that task, finish the rest, re-run the dropped task sequentially on the updated HEAD.
5. **Test gate.** Run the suite on the integrated tree. Failure = semantic conflict or bug → re-run the offending task sequentially, else fix per [When a Subagent Fails](#when-a-subagent-fails).
6. **Quality review.** Code-quality review on the integrated wave diff; loop fixes to ✅.
7. **Commit the wave.** Leaves a clean tree; the next wave's children branch from this commit and so see the integrated work.

**Two-stage review is preserved:** spec review per task (pre-integration), quality review per wave (post-integration). Both gates required before the wave commits.

**Dependent context across waves:** wave N+1 tasks branch from a HEAD containing wave N, so they see the code; still forward wave N's task summaries into wave N+1 prompts.

**Caveat:** each task must be independently runnable and verifiable in a fresh worktree — no reliance on uncommitted local state. `pi-subagents` symlinks `node_modules`; repos needing other per-worktree setup must account for it.

**Set `cwd` to your worktree — resilience-critical.** This whole workflow runs *inside* a worktree, but the `subagent` tool resolves the worktree base from the **top-level `cwd`**, which defaults to the orchestrator's process cwd — the *primary* checkout (usually `main`), not the worktree. Omit `cwd` and `worktree: true` branches every child from the primary checkout's HEAD: the children never see your spec, plan, or prior-wave commits, and integration runs against the wrong baseline. Pass the worktree's absolute path as the top-level `cwd`. Do **not** set per-task `cwd` under `worktree: true` — pi-subagents requires it to equal the shared cwd and errors otherwise. (Clean-tree is enforced here too — `resolveRepoState` rejects a dirty tree — which is why each wave commits before the next.)

```ts
subagent({
  context: "fresh",
  cwd: "/abs/path/to/this/worktree",  // REQUIRED: the worktree you're in, else children branch from main
  worktree: true,        // each task in its own git worktree, branched from cwd's HEAD
  concurrency: 4,        // default; cap = wave size
  tasks: [
    // do NOT set per-task cwd under worktree:true — it must equal the top-level cwd or the run errors
    { agent: "implementer", task: "<task text + owned files + status protocol>", output: "wave1-task1.md" },
    { agent: "implementer", task: "<task text + owned files + status protocol>", output: "wave1-task2.md" },
  ],
})
```

For the fan-out + worktree + patch-integration + conflict mechanics, see `dispatching-parallel-agents`.

## When a Subagent Fails

**You are the orchestrator. You do NOT write code.**

1. **Attempt 1:** dispatch a NEW fix subagent with the error output, the original task, and specific instructions about what went wrong.
2. **Attempt 2:** if attempt 1 also fails, dispatch one more with a simplified scope or different approach.
3. **After 2 failed attempts:** STOP. Report failure to the user. The task probably needs redesign.

**NEVER:**
- Write code yourself to "help" or "finish up"
- Fix the subagent's work inline — that pollutes your context and defeats fresh-subagent isolation
- Silently skip the failed task
- Lower quality gates (skip reviews) because a task is "almost done"

## After All Tasks Complete

0. Call `phase_tracker({ action: "start", phase: "verify" })`. (The `implement` phase was started at execution start and auto-completes from `plan_tracker` once all tasks are done; this flow runs its own verify gate instead of `/skill:verification-before-completion`, so it must mark verify itself.)
1. Dispatch the final reviewer over the full diff (already covered in [The Process](#the-process) step "After all tasks").
2. **Run an audit pass automatically.** Run `/skill:requesting-code-review` against the worktree's full diff vs `main`. Then, if the project ships a project-specific audit skill (e.g., `.agents/skills/self-audit/`), run it as an optional supplement (it adds project-specific checks and fixes, not a replacement). Address Critical and Moderate findings before handoff. Do not ask the user — just run it.
3. **Close the loop — conformance check.** The audit in step 2 is plan-vs-code (single-step); it inherits any requirement the plan already dropped. Before marking verify complete, dispatch a fresh-context **`conformance-reviewer`** — its **own** dispatch, never fused into the step-1 final review — to confront the deliverable (code **and** docs) against the *origin* — the spec **and** the original prompt — per `verification-before-completion/reference/conformance-check.md`. Pass the spec path, the verbatim original prompt, and the full diff. On `GAPS`, do not auto-fix or auto-proceed: surface each gap with the reviewer's proposed remediation and let the user decide (fix now → re-dispatch implementer / accept + record in spec / rescope), then re-check. Only when the verdict is `CONFORMS` (or every gap is dispositioned) call `phase_tracker({ action: "complete", phase: "verify" })`.
4. Summarize what was implemented (tasks completed, files changed, test counts, self-audit verdict). Give the closing loop its **own section** — `Closure / conformance: CONFORMS` (or `GAPS` with each gap and its disposition) — so the user sees intent-fidelity as a first-class line before any finishing decision, not buried in the audit verdict.
5. **Proceed to finishing — no confirmation prompt.** When the verdict is `CONFORMS` (or every gap is dispositioned), invoke `/skill:finishing-a-development-branch` immediately. Its Step 4 menu (squash / PR / keep / discard) is the human gate; a separate "ready to finish?" prompt only stacks a second stop in front of it. Open gaps are already owned by step 3, so nothing is left to decide here. Manual testing is a follow-up after the finishing choice (on `<base-branch>` after a squash-merge, or on the PR branch), never a reason to hold this gate.

## Red Flags — STOP

- Writing code yourself instead of dispatching
- Dispatching parallel implementers on overlapping files, or without `worktree: true` outside Parallel-Wave Mode (wave mode is the sanctioned exception: disjoint files + worktree isolation + serial integration)
- Parallelizing a wave whose tasks contend on a shared mutable runtime resource (DB/schema, port, fixture, external service, shared temp path) — that wave was mis-grouped; run those tasks as sequential single-task waves
- Making a subagent read the plan instead of passing task text
- Starting code-quality review before spec compliance is ✅
- Moving to next task with either review still showing issues
- Letting implementer self-review replace external review (both needed)
- Pausing to "check in" between tasks (continuous execution rule)
- Skipping the `Implementer Status` parse — treating every response as DONE
- Starting on main without explicit user consent

## Integration

**Required workflow skills:**
- `/skill:using-git-worktrees` — set up isolation first (small changes can branch in place with user approval)
- `/skill:writing-plans` — creates the plan this skill executes
- `/skill:requesting-code-review` — review template for reviewer subagents
- `/skill:finishing-a-development-branch` — invoked automatically once the conformance verdict is `CONFORMS` (or all gaps dispositioned)

**Subagents follow by default:**
- TDD — runtime warnings on source-before-test. Implementer agents receive the three-scenario TDD instructions (new feature / modifying tested code / trivial) via agent profile and prompt template.

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
