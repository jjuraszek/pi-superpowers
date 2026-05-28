---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

> **Related skills:** Need an isolated workspace? `/skill:using-git-worktrees`. Need a plan first? `/skill:writing-plans`. Done? `/skill:finishing-a-development-branch`.

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

## When to Use vs. Executing Plans

| | subagent-driven-development | executing-plans |
|---|---|---|
| Session | Same (this one) | Parallel session |
| Per-task context | Fresh subagent | Same orchestrator session |
| Best for | Independent tasks | Sequential, tightly-coupled tasks |
| Pause cadence | None (continuous) | Per task |

**Dependent tasks:** include the previous task's implementation summary and relevant file paths in the next subagent's `task`. Track outputs so you can pass them forward.

## The Process

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
```

Prompt templates live alongside this SKILL.md:

- `./implementer-prompt.md`
- `./spec-reviewer-prompt.md`
- `./code-quality-reviewer-prompt.md`

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

1. Dispatch the final reviewer over the full diff (already covered in [The Process](#the-process) step "After all tasks").
2. **Run an audit pass automatically.** Run `/skill:requesting-code-review` against the worktree's full diff vs `main`, or — if the project ships a project-specific audit skill (e.g., `.agents/skills/self-audit/`) — follow that instead. Address Critical and Moderate findings before handoff. Do not ask the user — just run it.
3. Summarize what was implemented (tasks completed, files changed, test counts, self-audit verdict).
4. Ask: "All tasks complete and self-audited. Ready for finishing?"
5. **Wait for user confirmation** before invoking `/skill:finishing-a-development-branch`. The user may want to test manually or adjust scope.

## Red Flags — STOP

- Writing code yourself instead of dispatching
- Dispatching multiple implementer subagents in parallel on overlapping files
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
- `/skill:finishing-a-development-branch` — complete after all tasks (user-confirmed)

**Subagents follow by default:**
- TDD — runtime warnings on source-before-test. Implementer agents receive the three-scenario TDD instructions (new feature / modifying tested code / trivial) via agent profile and prompt template.

**Alternative:**
- `/skill:executing-plans` — use for parallel-session execution instead of same-session.

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
