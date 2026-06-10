---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

> **Related skills:** Use `/skill:using-git-worktrees` **before** writing the spec — the spec is the worktree's first artifact. Then `/skill:writing-plans` for implementation planning.

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Identify the target project → set up an isolated worktree → understand current project context → ask questions one at a time → propose 2-3 approaches with trade-offs → present the design in 200-300-word sections, validating each → write spec to disk inside the worktree → user reviews before any implementation.

## HARD CONSTRAINT

While this skill is active, do **not** take any implementation action until you have presented a design and the user has approved it. This applies to **every** change regardless of perceived simplicity. An implementation-heavy request ("test it end-to-end", "push a request to rabbit", "run the service") does not lift this gate — it just tells you what the spec must cover.

You **may**:
- Read code and docs
- Run the existing system to observe its **current** behaviour — this is research and feeds the spec (boot a local service, replay a sample request, capture a baseline classification, etc.)
- Write to the project's `doc/specs/` directory

You may **not**:
- Write or edit code outside `doc/specs/`
- Scaffold a project, or take any action that builds, deploys, or validates the **proposed change** — running new/edited code, exercising behaviour that doesn't exist yet, or "testing the fix" before there is one
- Run implementation skills (`/skill:test-driven-development`, `/skill:executing-plans`, etc.)
- Commit the spec directly on `main` in the primary checkout — it must land inside the worktree (see [Worktree First](#worktree-first))
- Start writing the plan (that's `/skill:writing-plans` — separate phase)

The line: exercising the system **as it is today** is research; exercising the **change you're proposing** is implementation and waits for the gate.

This skill ends with a **written, user-reviewed spec inside a worktree**. Nothing else.

## Checklist

Work through the items below **in order**. This is your own checklist to follow, not a `plan_tracker` plan — brainstorming is open-ended exploration, and `plan_tracker` is execution-only (the implement phase). The terminal state is the user review gate; after approval the **only** next skill is `/skill:writing-plans`. Do not jump to implementation, and do not silently drop the council offer.

1. **Start brainstorm tracking (fresh epoch)** — as the **first action on entry**, before reading code, setting up the worktree, or answering the user, reset **both** trackers and then start the phase. A new brainstorm is a new flow, so it owns a clean slate — clear any stale phases *and* tasks left in the session by earlier work:
   ```
   phase_tracker({ action: "reset" })   // clears all phases
   plan_tracker({ action: "clear" })    // clears all tasks
   phase_tracker({ action: "start", phase: "brainstorm" })
   ```
   Re-entering while a brainstorm is already in progress is safe: mid-brainstorm there are no tasks or later phases to lose, so the reset just re-establishes the same clean slate.
2. **Set up the worktree** — see [Worktree First](#worktree-first)
3. **Explore project context** — files, docs, recent commits, current behaviour
4. **Ask clarifying questions** — one at a time
5. **Propose 2-3 approaches** — with trade-offs and a recommendation
6. **Present the design** — in sections, get approval after each
7. **Write the spec** — to `doc/specs/` (see [Filename Convention](#filename-convention))
8. **Spec self-review** — placeholders, consistency, scope, ambiguity
9. **Offer the spec council** — required step when one is configured; skip only when unconfigured (see [Spec Council](#spec-council-optional))
10. **User review gate** — user reviews the committed spec
11. **Transition** — only after approval, invoke `/skill:writing-plans`

## Project Routing

Before brainstorming, identify the target project. The match drives the spec directory, AGENTS.md to read, and verification commands.

Read the repo's top-level `AGENTS.md` (already in pi's context) and any service-level `AGENTS.md` for the area the user mentioned. If the project documents a routing table mapping subprojects to spec directories and verification commands, follow it. Otherwise rely on the conventions you find.

Detection order:
1. Issue tracker reference (Linear, Jira, GitHub Issues) → infer from labels, description, or mentioned file paths
2. cwd inside a service / package directory → use that area
3. Unclear → ask the developer

If the project's `AGENTS.md` calls out additional reading for a specific area (e.g. a TDD workflow doc), read it before brainstorming work in that area.

## Worktree First

The spec is the **first commit in a dedicated worktree**, not a separate commit on `main`. Before drafting any spec content:

1. Invoke `/skill:using-git-worktrees`. Worktrees live under `.worktrees/` at the repo root, or wherever a project-native worktree script places them.
2. Switch into the worktree.
3. From there, write the spec, run self-review, commit, hand off.

Spec doc, plan doc, and implementation all live in the same worktree and ship together as a single squash commit (see `/skill:finishing-a-development-branch`).

**Exception:** trivial one-off edits the user explicitly asks for outside this skill flow (e.g. "fix this typo") do not require a worktree.

## The Process

### 1. Check git state

```bash
git status
git --no-pager log --oneline -5
```

If on a feature branch with uncommitted or unmerged work, ask:

> "You're on `<branch>` with uncommitted changes. Want to finish/merge that first, stash it, or continue here?"

Require one of: finish prior work, stash, or explicit "continue here". If the topic is new, set up the worktree per [Worktree First](#worktree-first) before continuing.

### 2. Scope check

If the request spans multiple independent subsystems (e.g., "build a new ingestion pipeline and a new admin UI and a new auth flow"), stop and flag it:

> "This looks like 2-3 independent specs to me — A, B, C. Should we brainstorm each separately, or is there a tight coupling I'm missing?"

Don't try to design a multi-subsystem monolith in one spec doc.

### 3. Understand the idea

- Check the current project state first: files, docs, recent commits, neighboring services.
- **Check if the codebase or ecosystem already solves this** before designing from scratch. Grep, read existing AGENTS.md, look at `doc/` and `doc/specs/`.
- Ask questions **one at a time** to refine the idea.
- Prefer multiple-choice questions; open-ended is fine when needed.
- One question per message. If a topic needs more exploration, split into multiple turns.
- Focus on: purpose, constraints, success criteria, who/what it touches.

### 4. Explore approaches

- Propose 2-3 different approaches with trade-offs.
- Lead with your recommended option and explain why.
- Present conversationally — don't dump a comparison table unless the user asks.

### 5. Design for clarity and isolation

When sketching the design, prefer:

- **Clear boundaries** — clean interfaces between components, easy to test in isolation.
- **YAGNI ruthlessly** — every component you add is a component you must maintain.
- **Match existing patterns** — if a service has a convention, follow it. Reference the service's `AGENTS.md` and neighboring code.
- **Single source of truth** — point at the schema/contract that owns the data (the migration, type definition, or API contract that defines it); don't invent parallel state.
- **Explicit error and edge cases** — name them. "Out of scope" is a valid answer, but it has to be stated.

### 6. Present the design in sections

Sections of 200-300 words. Ask after each whether it looks right.

Cover at minimum:
- Architecture overview
- Components / responsibilities
- Data flow (or request flow)
- Error handling and edge cases
- Testing approach

Be ready to go back and clarify when something doesn't make sense.

## Linear Ticket Handling

When a ticket ID is given, fetch the ticket and treat it as **guidance, not the sole source of truth**. Propose changes to scope, approach, or acceptance criteria when they don't align with the codebase. Surface deviations in the spec doc.

## First-Feature Oversight (Early Project Stages)

For the **first two features** of a new initiative — a new top-level module/package, a new long-lived component, a new persistence/schema area, or any pattern that will repeat — pause and ask the developer to confirm before proceeding on:

- Directory and module structure decisions
- Naming conventions (public types, files, routes, identifiers)
- New shared abstraction (location, responsibility, boundary)
- Persistence/schema design (entity names, field types, indexing)
- Proposed additions to AGENTS.md or doc/ files

If the developer hasn't provided guidance, ask explicitly:
> "This is one of the first features in this initiative. Before I proceed, I need your confirmation on: [list specific decisions]."

After the first two features establish patterns, follow those patterns without gating.

## Anti-Pattern: "Too simple to need a design"

Watch for the rationalization "this is just a small change, let's skip the spec and code it":

- Small changes that touch shared schemas, contracts, or invariants need a spec.
- "Small" often hides assumptions that the spec process would surface.
- A 5-minute spec saves an hour of rework when the assumption was wrong.

If the change truly is mechanical and contained (rename, formatter run, dependency bump), say so explicitly and skip brainstorming. Otherwise: spec first.

## Filename Convention

Spec lives in the project's `doc/specs/` (see [Project Routing](#project-routing)) with one of:

- With Linear ticket: `YYYY-MM-DD-E-12345-<topic>.md`
- Without Linear ticket: `YYYY-MM-DD-<topic>.md`

`<topic>` is a short kebab-case slug (3–6 words). Do **not** append `-design` or any other suffix.

## Spec Self-Review (Before User Review Gate)

After writing the spec to `<project>/doc/specs/<filename>.md` (per [Filename Convention](#filename-convention)) and before showing it to the user, run a self-review pass:

- **Placeholder scan.** Any `TODO`, `TBD`, `<fill in>`, `[example]`, `xxx`? Either resolve them or convert to explicit "Open Questions" with names.
- **Internal consistency.** Does Section 4 contradict Section 2? Are component names and field names consistent throughout?
- **Scope check.** Does every paragraph serve the goal? Cut filler. If something is out of scope, say it's out of scope.
- **Ambiguity check.** Is every "we should…" backed by a concrete decision? Replace "we could probably" with "we will" or "we won't".

Fix what self-review surfaces before handing to the user.

## Spec Council (Optional)

After self-review and before the user review gate, check whether a spec council is configured for the active preset (`piSuperpowers.specCouncil.members` in `$PI_CODING_AGENT_DIR/settings.json`). **When one is configured, making the offer is a required checklist step (item 9) — present it explicitly and wait; do not skip ahead to the gate.** Offer a multi-model critique pass — see `/skill:roasting-the-spec`. If no council is configured, skip silently and proceed to the gate. Approved council edits are applied to the spec and ride in the same worktree commit as the rest of this skill's output.

## User Review Gate

After self-review (and council review, if configured), commit the spec on the worktree branch and stop:

```
Spec written and committed to <project>/doc/specs/<filename>.md (worktree: <path>).

Please review. Once you approve, we can:
1. Use /skill:writing-plans to break it into implementation tasks
2. Make changes to the spec if anything is off

What's next?
```

Wait for the user. Don't start implementation, don't open the plan skill, don't land the spec on `main`. The user owns this transition. The spec stays in the worktree; it ships in the same squash commit as the implementation.

After approval, mark the brainstorm phase complete:

```
phase_tracker({ action: "complete", phase: "brainstorm" })
```

## Key Principles

- **One question at a time.**
- **Multiple choice preferred** when possible.
- **YAGNI ruthlessly.**
- **Design for testability** — clear boundaries enable TDD.
- **Explore 2-3 approaches** before settling.
- **Incremental validation** — present in sections, validate each.
- **Be flexible** — go back and clarify when something doesn't make sense.

## Red Flags — STOP

- About to write code or start a non-spec edit while this skill is active
- About to run, deploy, or validate the **proposed change** (vs. observing current behaviour) before the user approved the design
- About to skip the spec council offer when one is configured
- About to skip the self-review pass
- About to skip the user review gate and jump to `/skill:writing-plans`
- Spec contains `TODO`, `TBD`, or unnamed components
- Spec spans multiple independent subsystems with no decomposition flag
- User said "this is just a small change" and you accepted it without applying the [Anti-Pattern](#anti-pattern-too-simple-to-need-a-design) check

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
