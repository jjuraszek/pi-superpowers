---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

> **Related skills:** Did you `/skill:brainstorming` first? Ready to implement? Use `/skill:executing-plans` or `/skill:subagent-driven-development`.

# Writing Plans

## Overview

Translate an approved spec into bite-sized, ordered, TDD-shaped tasks. Assume the engineer is skilled but has zero context for this codebase and limited taste — document file paths, exact commands, expected output, and test design.

DRY. YAGNI. TDD. Frequent commits.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

Before drafting the plan, call `phase_tracker({ action: "start", phase: "plan" })`.

**Input:** an approved spec in `<project>/doc/specs/<filename>.md` (produced by `/skill:brainstorming`).

**Save plans to:** the sibling `doc/plans/` directory next to the spec. The plan filename matches the spec filename exactly — same date, same Linear ID (if any), same topic slug, no `-design` suffix.

| Spec path | Plan path |
|---|---|
| `doc/specs/2025-05-26-foo.md` | `doc/plans/2025-05-26-foo.md` |
| `doc/specs/2025-05-26-PROJ-1234-foo.md` | `doc/plans/2025-05-26-PROJ-1234-foo.md` |
| `<service>/doc/specs/<name>.md` | `<service>/doc/plans/<name>.md` |

If no spec exists, send the work back to `/skill:brainstorming`. Do not invent a plan without a spec.

## Boundaries

- Read code and docs: yes
- Write the plan to the sibling `doc/plans/` of the spec: yes
- Edit or create any other files: no
- Start executing the plan: no — that's `/skill:executing-plans` or `/skill:subagent-driven-development`
- Land the plan on `main`: no — the plan commit goes on the worktree branch (same branch as the spec)

## Scope Check

Before writing the plan, check the spec one more time for hidden subsystem boundaries:

- Does this touch 2+ independent services / contracts / schemas?
- Are there phases where intermediate state needs to be deployable?

If yes, decompose into separate plans and call it out:

> "The spec covers A and B. I'd split into two plans, executed in order. OK?"

A single plan should land in one PR worth of work. Multi-PR sequences get separate plans.

## File Structure

**Before drafting tasks, map the files.**

List the files this implementation will create, modify, or delete. Group by component. This forces the design decisions out of the task list and into a single review surface.

```markdown
## Files

**Create:**
- `src/services/foo.py`
- `tests/services/test_foo.py`

**Modify:**
- `src/controllers/bar.rb` (add `create` action)
- `db/migrate/YYYYMMDDHHMMSS_add_baz.rb`

**Delete:**
- `src/services/legacy_foo.ts`
```

If you can't list the files, the spec isn't ready. Send it back to `/skill:brainstorming`.

## Wave Grouping

Group tasks into **waves** so the executor can parallelize independent work (see `subagent-driven-development` Parallel-Wave Mode). A wave is a maximal set of tasks that (a) have no ordering dependency on each other and (b) own **pairwise-disjoint files**.

- Tasks nest under `## Wave N — <label>` headers; `### Task N` headers sit inside a wave.
- A wave with one task is legal (runs sequentially). A pure dependency chain yields one task per wave — no parallelism, which is correct.
- Each wave after the first states its dependency on prior waves.

**File-ownership contract.** The per-task `**Files:**` block *is* the ownership declaration — no new syntax. Rule: **within a wave, the union of every task's declared paths must be pairwise disjoint.** Globs are allowed for `Modify` when exact paths are unknown, but must not overlap another same-wave task's paths. A task that must touch another's file belongs in a later wave.

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

## Bite-Sized Task Granularity

Each step is **one action, 2-5 minutes**:

- "Write the failing test" — step
- "Run it, confirm it fails" — step
- "Implement minimal code to pass" — step
- "Run tests, confirm green" — step
- "Commit" — step

## Plan Document Header

```markdown
# [Feature Name] Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans (or subagent-driven-development) skill to implement this plan task-by-task.

**Goal:** [one sentence]

**Architecture:** [2-3 sentences]

**Tech Stack:** [key tech/libraries]

**Spec:** `<project>/doc/specs/<same-filename-as-this-plan>.md`

**Linear:** `E-XXXX` (omit if no ticket)

---
```

## Task Structure

Each task uses `- [ ]` checkbox steps so execution tools (and humans) can track progress.

```markdown
### Task N: [Component Name]

**TDD scenario:** [New feature — full TDD cycle | Modifying tested code — run existing tests first | Trivial change — use judgment]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

  ```python
  def test_specific_behavior():
      result = function(input)
      assert result == expected
  ```

- [ ] **Step 2: Run test, confirm failure**

  Run: `uv run pytest tests/path/test.py::test_name -v`
  Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

  ```python
  def function(input):
      return expected
  ```

- [ ] **Step 4: Run test, confirm pass**

  Run: `uv run pytest tests/path/test.py::test_name -v`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add tests/path/test.py src/path/file.py
  git commit -m "<imperative subject> (ref E-XXXX)"
  ```
```

## No Placeholders

Every plan failure mode:

- ❌ `# TODO: add validation` — implementer can't infer "validation" of what, against what schema, with what error message.
- ❌ `# Implement the rest of the function` — incomplete code is invalid code.
- ❌ "Add tests for edge cases" — name the edge cases.
- ❌ "Wire it up to the existing system" — give file paths and call sites.
- ❌ "Similar to Task N" — repeat the code. Implementers (and subagents with fresh context) may read tasks out of order; pointing at a sibling task is not a substitute for showing the code.
- ❌ References to types, functions, methods, or fields not defined in any task in this plan. If it shows up in Task 5, it must be introduced by Task 1–4 or already exist in the codebase (with a file:line citation).
- ❌ `[fill in]`, `<example>`, `xxx` markers anywhere in the doc.
- ❌ "Probably also need to update the docs" — either yes (which doc) or no.

If a decision is genuinely open, put it in an explicit **Open Questions** section at the top and resolve before execution starts.

## Self-Review (Before Handoff)

After drafting the plan and before announcing it complete, run three checks yourself. This is a checklist you run yourself — not a subagent dispatch.

- **Spec coverage.** Cross-reference the spec's components/decisions/constraints against the plan. Does every spec section map to one or more tasks? If a spec decision has no implementation task, the plan is missing work or the spec was overspecified.
- **Placeholder scan.** Grep the doc for `TODO`, `TBD`, `xxx`, `[fill in]`, `<example>`, `etc.`, "probably", "something like". Resolve or convert each into an explicit Open Question.
- **Type / API consistency.** Function signatures and field names that appear in multiple tasks must match exactly. The plan is its own contract — internal contradictions surface as bugs during execution.
- **Wave disjointness.** For every multi-task wave, confirm the tasks' `Files:` sets are pairwise disjoint. Overlap = mis-grouped wave; split or re-order before handoff.

Fix what this review finds before handoff.

## Remember

- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills
- DRY, YAGNI, TDD, frequent commits
- Group dependency-free, file-disjoint tasks into the same wave; order waves so each wave's dependencies are satisfied by earlier waves
- If the plan exceeds ~8 tasks, split into phases with checkpoints

## Execution Handoff

After saving the plan, mark the planning phase complete:

```
phase_tracker({ action: "complete", phase: "plan" })
```

Then offer execution choice:

> Plan complete and saved to `<project>/doc/plans/<filename>.md` in the worktree. Execution options:
>
> 1. **Subagent-Driven, sequential (this session)** — fresh subagent per task with two-stage review. The default.
> 2. **Subagent-Driven, parallel waves (this session)** — independent tasks in a wave run concurrently in isolated worktrees, integrated serially with the same two-stage review. *(Offer only when the plan has ≥2 tasks in some wave.)*
> 3. **Separate Session (executing-plans)** — batch execution with human review checkpoints. Better when tasks are tightly coupled or you want more control between batches.
>
> Which approach?

- Subagent-Driven (sequential or parallel waves) → `/skill:subagent-driven-development` in this session.
- Separate Session → user opens new session in worktree → `/skill:executing-plans`.

## Red Flags — STOP

- Plan contains TODO / TBD / placeholder text
- File structure section absent
- Task step is "5+ minutes of work" (split it)
- Step lists don't use `- [ ]` checkboxes
- Two tasks reference the same function with different signatures
- Self-review skipped
- About to start executing the plan yourself

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
