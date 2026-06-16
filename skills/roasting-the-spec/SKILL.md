---
name: roasting-the-spec
description: Use after writing a spec, when a spec council is configured (piSuperpowers.specCouncil in the active preset's settings). Auto-dispatched by /skill:brainstorming as the critique pass when members is non-empty (no longer offered). N members on different models critique in parallel, a neutral chair consolidates and adjudicates, the parent proposes dispositions, the user approves.
---

# Roasting the Spec (Spec Council)

## Overview

A multi-model critique pass for a freshly written spec. Each council **member** runs on a different model and critiques the spec independently — different models surface different angles. A neutral **chair** consolidates the critiques and adjudicates disagreements. The parent proposes what to apply; the **user** approves. The council never decides on its own what changes land.

Auto-dispatched from `/skill:brainstorming` as the critique pass, after the inline lint and before the user review gate, **only when a council is configured** (`members` non-empty). brainstorming owns that gate; when no council is configured it runs a single fresh-`worker` critique instead and does not invoke this skill.

## Hard constraint

This skill may read anything and edit **only** the spec under `doc/specs/`. It does not write code, does not run implementation skills, and does not land anything on `main`. Applied edits ride in the same worktree spec commit as the rest of brainstorming's output.

## Separation of powers

- **Members** — independent witnesses. One per configured model, fresh context, read-only.
- **Chair** — judge of the testimony. Fresh context (never saw the spec authored); consolidates and resolves member-vs-member conflicts. Final say on conflicts; no say on what gets applied.
- **Parent (you)** — advocate. Proposes apply / defer / reject per finding on scope grounds. Cannot suppress findings.
- **User** — jury. Approves what actually lands, at the existing review gate.

## Configuration and gating

Read the active preset's settings file at `$PI_CODING_AGENT_DIR/settings.json` and look for `piSuperpowers.specCouncil`:

```json
{
  "piSuperpowers": {
    "specCouncil": {
      "members": ["<provider/model>", "<provider/model>"],
      "chair": "<provider/model>"
    }
  }
}
```

- `members` — array of `provider/model` strings. Council size = array length.
- `chair` — optional model for the synthesizer; if omitted, the synthesizer inherits the parent's model.

brainstorming owns the gate: it parses this config (it may contain comments — read it, do not pipe through a strict JSON parser), emits any malformed-config warning, and decides whether to invoke this skill. This skill is dispatched **only after** brainstorming confirms `members` is non-empty, so it runs the council unconditionally on entry — no offer, no numbered choice. Absent/empty/malformed config never reaches here (brainstorming runs the fresh-`worker` critique instead). A minimal defensive re-parse is fine, but ownership of "should the council run" lives in brainstorming, not here.

## The council run

### 1 — Fan out to members

Create an absolute temp dir outside the worktree so member files are never tracked by git:

```bash
mktemp -d   # absolute path, e.g. /tmp/tmp.XXXXXX
```

Dispatch one member per configured model, in parallel, each writing its critique into that dir. Do **not** read these files yourself — they are for the chair.

```
subagent({
  control: { needsAttentionAfterMs: 600000 },
  tasks: members.map((model, i) => ({
    agent: "spec-council-member",
    model,
    task: "Problem statement: <the problem the spec addresses, from its Context section and the user's stated intent>.\n" +
          "Read the spec at <abs path to doc/specs/...>. Critique it on your five axes and emit your template.",
    output: "<tmpdir>/member-" + i + "-" + slug(model) + ".md"
  }))
})
```

`control` is a **run-level** field: it must sit beside `tasks`, not inside the `members.map(...)` task objects (the per-task schema has no `control` field and would silently drop it). The 10-minute `needsAttentionAfterMs` suppresses false-positive "no observed activity" idle notices — members do one long, tool-less reasoning turn that crosses the 60s default with zero activity events — while still letting a genuinely wedged run surface eventually.

`slug(model)` = the model string with `/` and any other non-alphanumeric character replaced by `-` (so `provider/model` → `provider-model`); the chair recovers this slug from each filename for `raised-by` attribution. Relative `output:` paths in parallel mode resolve against the worktree and would get committed — always use the absolute temp dir.

If a member fails (e.g. its model is unreachable in this preset), skip it and continue as long as at least one member succeeded. If **all** members fail, abort the council, say so, and return to the user gate.

### 2 — Synthesize and adjudicate

Dispatch the chair once. It reads the member files (not you), the spec, and the problem statement, and returns one consolidated, conflict-resolved report. You ingest **only** this report.

```
subagent({
  agent: "spec-council-synthesizer",
  model: <chair from config, else omit to inherit>,
  control: { needsAttentionAfterMs: 600000 },
  reads: [ <the member file paths under the temp dir> ],
  task: "Problem statement: <paste>. Spec: <abs path>.\n" +
        "Member critiques (already injected via reads — do not search for them):\n" +
        members.map((model, i) => "<tmpdir>/member-" + i + "-" + slug(model) + ".md").join("\n") + "\n" +
        "Consolidate and adjudicate the member critiques."
})
```

The chair runs one long single-turn synthesis (one observed false positive ran 506s); `control: { needsAttentionAfterMs: 600000 }` raises the idle threshold to 10 minutes so the healthy run is not flagged stale, without disabling attention tracking entirely.

List the exact member paths in the task text. The `reads:` array injects their contents, but the chair's prompt expects the paths explicitly; without them it scans the tree for `*.md` and stalls.

If the configured `chair` model is unreachable, retry once with the inherited model.

### 3 — Propose dispositions

For each cluster in the chair's report, decide and state one of:

- **apply** — with the concrete edit you will make.
- **defer** — out of scope for this spec; name where it belongs.
- **reject** — with a one-line reason.

You are the advocate here, not the judge — propose, do not unilaterally apply.

### 4 — User gate

Fold the chair's clusters, its `resolved` audit notes, and your proposed dispositions into brainstorming's user review gate. Let the user approve or adjust.

### 5 — Apply and clean up

Apply the approved edits to the spec under `doc/specs/`. Re-run brainstorming's placeholder scan. Remove the temp dir (`rm -rf` the `mktemp -d` path). Then continue with brainstorming's normal commit. Nothing council-related (member files) is ever staged.

Single pass — no automatic re-roast loop. The user can invoke this skill again after edits for another round.

## Red flags — STOP

- Running the council when `piSuperpowers.specCouncil.members` is absent or empty (brainstorming owns the gate and should have used the worker fallback).
- Reading member critique files yourself instead of routing them through the chair.
- Writing member files to a relative path (they land in the worktree).
- Auto-applying findings without the user gate.
- Surfacing member-vs-member disagreements to the user instead of letting the chair adjudicate.
- Editing anything other than the spec under `doc/specs/`.

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
