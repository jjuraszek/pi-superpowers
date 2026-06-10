---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

> **Related skills:** Need an isolated workspace? `/skill:using-git-worktrees`. Verify each task with `/skill:verification-before-completion`. Done? `/skill:finishing-a-development-branch`.

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

If a tool result contains a ⚠️ workflow warning, stop immediately and address it before continuing.

## Prerequisites
- Running inside a dedicated worktree (the same one the spec and plan were authored in). If you're in the primary checkout on `main`, stop and invoke `/skill:using-git-worktrees` first — implementation never lands directly on `main`.
- Approved plan or clear task scope

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Initialize the `plan_tracker` tool and proceed

### Step 2: Execute Batch
**Default: First 3 tasks**

Before the first batch, enter the implement phase: `phase_tracker({ action: "start", phase: "implement" })` — `plan_tracker` auto-completes it once every task is done.

For each task:
1. Update task status via `plan_tracker` tool
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Update task status via `plan_tracker` tool

### Step 3: Report
When batch complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

### Step 4: Continue
Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

### Step 5: Self-Audit Before Finishing

After all tasks are complete and verified, and **before** invoking the finishing skill, run a self-audit pass. Do not ask the user — just run it.

- **REQUIRED SUB-SKILL:** Run `/skill:requesting-code-review` against the worktree's full diff vs `main`. Then, if the project ships a project-specific audit skill (e.g., `.agents/skills/self-audit/`), run it as an optional supplement — it adds project-specific checks and fixes on top of this baseline; it does not replace it.
- Address Critical and Moderate findings in the worktree before proceeding. Minor findings either get fixed or surfaced in the handoff message.
- The self-audit pass produces additional commits on the worktree branch; they get squashed together with the rest of the work in the finishing step.
- **Close the loop — conformance check.** Per-task verification confronts each slice of intent, and the audit above is plan-vs-code; neither confronts the *assembled* deliverable against the origin. Before proceeding, dispatch a fresh-context **`conformance-reviewer`** (its own dispatch, separate from the code-quality audit) to confront the whole deliverable (code **and** docs) against the *origin* — the spec **and** the original prompt — per `verification-before-completion/reference/conformance-check.md`. Pass the spec path, the verbatim original prompt, and the full diff vs `main`. On `GAPS`, do not auto-fix or auto-proceed: surface each gap with the reviewer's proposed remediation and let the user decide (fix now / accept + record in spec / rescope), then re-check. Report the verdict as its own **Closure / conformance** section in the Step 3 handoff summary. Unrecorded divergence = conformance failure, not a completion.

### Step 6: Complete Development

After self-audit passes:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use `/skill:finishing-a-development-branch`
- Follow that skill to verify tests, squash to `main`, and clean up the worktree

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When the Plan Is Wrong

**Different from being blocked** — you're not stuck, but you've learned something that makes the remaining plan unworkable.

- Stop executing immediately
- Report what you've learned and why remaining tasks won't work
- Propose a revised approach, or ask your human partner to revisit the design
- Don't continue executing tasks you know are heading somewhere bad

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- TDD is the default for production code: failing test first, verify fail, implement, verify pass
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **`/skill:using-git-worktrees`** — Set up an isolated workspace before starting. Required even for small or single-step tasks; implementation never lands directly on `main`.
- **`/skill:writing-plans`** — Creates the plan this skill executes.
- **`/skill:finishing-a-development-branch`** — Squash-merge into `main` after the self-audit pass. No PR, no push by default.

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
