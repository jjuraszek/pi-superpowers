# Spec: gauntlet flow guards (worktree discipline, finish nudge, brainstorm-write confinement)

> **superseded in part** by `doc/specs/2026-06-17-flow-guards-refinements.md`: Guard 1 removed; Guard 2 promoted to a hard block; `bash` removed from council personas. The body below is the historical record.

## Context

Three recurring flow failures were observed across consumer sessions (consumer-project session history, 2026-06-09..17):

1. **finishing-a-development-branch not auto-invoked after the execution phase.** Dozens of sessions `start implement` (some reach `start verify`) and then never read `finishing-a-development-branch` nor `start ship`. The verify->finishing handoff is prose-only in `subagent-driven-development` Step 5; once `verify` completes, nothing pushes the `ship` phase. The closure gate (spec `2026-06-11-closure-review-verify-gate`) blocks `complete verify` until conformance runs, but the *next* transition is unguarded.

2. **Branch switched in the primary checkout instead of a worktree.** ~15+ sessions ran `git checkout -b <user>/<slug>` / `git switch -c` directly in the primary checkout for "small" skill/doc edits. Worktree-first is prose the model rationalizes around. Subagents compound this: a dispatched child inherits the parent **process** cwd (pi's launch dir = primary checkout), not the main loop's `cd`-in-bash logical directory — so council members and the spec-linter worker run in the primary checkout even when the main loop believes it is "in" the worktree.

3. **Council/main loop edits during the spec phase.** Council members already lack `write`/`edit` tools (frontmatter `tools: read, grep, find, ls, bash`), but members "ignore their tools sometimes" and can mutate via `bash` redirection; neither council persona forbids mutating bash. The main loop can also edit outside `doc/specs/` while the brainstorming HARD CONSTRAINT is active.

The example session (`019ed4b2`) was *not* a flow bug: it started clean on `main`, built its spec correctly in a worktree; the dirty primary checkout was external pollution from a prior attempt. It is evidence that the flow can't see/repair inherited primary-checkout state, not that this session misbehaved.

These are enforcement gaps, not missing prose. The fix pushes advisory enforcement into `phase-tracker.ts` (the phase-aware extension) and tightens two agent personas plus the subagent dispatch sites — **zero added skill body prose**. All guards are **advisory annotations**, never hard blocks: hard blocks both collide with the legitimate `git worktree add -b` creation step and invite LLM bypass games; the existing `closureReview` hard gate stays as-is (separate concern).

## Scope

| Item | Path | Action |
|---|---|---|
| Flow guards: (1) implement+verify nudges, (2) branch-in-place warning (init-gated), (3) brainstorm write/bash-mutation confinement; new `flowGuards` config | `extensions/phase-tracker.ts` | edit |
| Read-only-bash clause (assess, do not mutate) | `agents/spec-council-member.md` | edit |
| Read-only-bash clause (consolidate, do not mutate) | `agents/spec-council-synthesizer.md` | edit |
| Explicit `cwd: <worktree>` on member + chair dispatch snippets | `skills/roasting-the-spec/SKILL.md` | edit |
| Explicit `cwd: <worktree>` on the fresh-`worker` critique dispatch snippet | `skills/brainstorming/SKILL.md` | edit |
| Extension config table: `flowGuards` key + behaviors documented | `README.md` | edit |
| Extension table: phase-tracker settings note gains `flowGuards`; council persona read-only-bash note | `AGENTS.md` | edit |
| Changelog (minor bump) | `CHANGELOG.md` | edit |

## Non-goals

- **No hard blocks.** All three guards prepend an advisory warning to the tool result; the call still runs. No new refusal paths. (The `closureReview` `complete verify` gate is unchanged.)
- **No new skill body prose.** The two skill edits add a single `cwd:` field to existing dispatch code snippets — correctness, not new methodology. No new sections, no rules.
- **No subagent-child interception.** Parent extensions never see a child's internal tool calls; council/worker behavior is shaped only by persona (read-only-bash clause) and dispatch `cwd`. The guards in `phase-tracker.ts` observe the **main loop** only.
- **No write/edit path-location heuristic for issue 2.** Resolving a write/edit target to "inside vs outside the worktree" requires resolving relative paths against an unreliable agent cwd and a worktree-home guess — fuzzy, false-positive-prone. Issue 2 is detected from the unambiguous branch-command form, gated by an init-time primary-checkout-vs-worktree check (see Guard 2); issue 3's spec-dir confinement covers brainstorm edits.
- **No auto-invocation of finishing-a-development-branch.** The verify->finish nudge injects an instruction into the `complete verify` result; it never dispatches or runs finishing itself.
- **No removal of `bash` from council personas.** Members need bash to verify spec claims against the codebase; the clause constrains it to read-only, it does not remove it.
- **Bash-based mutation outside brainstorm is not guarded.** Guard 3 adds a brainstorm-phase bash-mutation warning (`>`, `tee`, `sed -i`, `git apply`), but bash mutations in `plan`/`implement`/`ship` and the general case are out of scope — `verify-before-ship.ts` already covers the ship-staleness path.
- **No gating of phases other than the documented triggers.**

## Behavior

All three guards read `piGauntlet.flowGuards.enforce` at event time (absent/undefined -> `true`; `false` -> all three disabled, extension behaves as today). State is in-memory, reconstructed from the session branch exactly like existing phase state — no new persistence.

### Guard 1 — execution -> verify -> finish nudges

Two nudges, both appended to the `phase_tracker` tool's own `content` text (no hook needed — extends the existing `complete` branch return; `details` shape unchanged). Each fires only when the named phase completes successfully and the *next* phase is not already `complete`/`skipped`/`in_progress`:

- On a successful `complete implement` (including the existing auto-complete-from-plan_tracker path, which also returns through the phase map): append
  ```
  implement complete -> next: phase_tracker start verify, run the closing loop, then complete verify
  ```
- On a successful `complete verify` (after the existing closure gate passes): append
  ```
  verify complete -> next: invoke /skill:finishing-a-development-branch (ship phase not started)
  ```

The implement nudge covers the larger at-risk population: many failing sessions stop after execution and never reach `complete verify`, so a verify-only nudge would miss them. The implement auto-complete path (plan_tracker -> all tasks done) flips `implement` to `complete` without a `phase_tracker complete` call; the nudge text is surfaced there too so the seam is covered.

### Guard 2 — branch-in-place warning

Active **only when pi was launched in the primary checkout** (not a linked worktree): at extension init, compare `git rev-parse --git-dir` against `--git-common-dir` (equal -> primary checkout; differ -> linked worktree). If launched inside a worktree, the main loop is already isolated and Guard 2 is disabled entirely — this is the correct, cheap detection point and avoids a per-tool-call git subprocess. (Submodule edge: the `--git-dir`/`--git-common-dir` comparison there is git-version-dependent and irrelevant; gauntlet flows do not run inside submodule git internals, and whichever way it resolves, the guard merely staying off in that edge case is harmless.)

While `brainstorm`, `plan`, or `implement` is `in_progress` (and Guard 2 is active), when a `bash` command performs a branch switch/creation in place, prepend an advisory warning to that bash result.

Trigger regex (branch-only git verbs, no file-path ambiguity):
- `git switch ...` in any form (git `switch` never targets a file path), **except** when `git worktree` is the leading subcommand (regex `\bgit\s+worktree\b`, exempting `git worktree add ... -b`). A bare occurrence of the word `worktree` elsewhere (e.g. a branch named `worktree-fix`) does **not** exempt.
- `git checkout -b ...` / `git checkout -B ...` (explicit branch creation; `-B` is force-create, equally in scope).
- Plain `git checkout <x>` **without** `-b` is **not** triggered — it is ambiguous with file checkout/revert (`git checkout -- path`, `git checkout <ref> -- path`), a common legitimate op.

Warning text:

```
⚠️ Branch switch/creation in place during the <phase> phase.
Gauntlet flows run in a dedicated worktree, not by switching branches in the
primary checkout. Create/enter one with /skill:using-git-worktrees, or — if you
are already inside a worktree — ignore this.
```

- **Warn-once per phase occurrence.** Suppress repeats until a `phase_tracker` `reset`, `start`, `complete`, or `skip` changes phase state (tracked by a per-guard fired-flag keyed off the current phase signature). Avoids spamming a multi-step rebase.
- Advisory — the branch command runs regardless; the warning rides on the result the model reads next.
- `ship` phase is deliberately **excluded**: `finishing-a-development-branch` legitimately runs `git switch main` for the squash merge.

### Guard 3 — brainstorm-write confinement

While `brainstorm` is `in_progress`, when a `write` or `edit` targets a path **outside** the configured spec directories, prepend an advisory warning to that tool result.

- Spec dirs from `piGauntlet.flowGuards.specDirs` (default `["doc/specs"]`). A path qualifies if a configured string appears as a **contiguous subsequence of the normalized path components** (split on `/`). Default `doc/specs` matches `.../doc/specs/...` but not `.../doc/other/...`, and not a bare `doc/` component. Both `doc/specs/x.md` and `dashboard/doc/specs/x.md` pass.
- Path source: `input.path` (write/edit), normalized then component-matched. Relative and absolute both work.

Warning text:

```
⚠️ Writing outside the spec directory during the brainstorm phase.
Brainstorming may only edit the spec under <specDirs>. Implementation waits for
the spec approval gate. If this edit IS the spec, place it under the spec dir.
```

- Also fires on a brainstorm-phase **bash mutation** (`>`/`>>` redirection into a file, `tee`, `sed -i`, `git apply`) targeting outside the spec dirs, reusing the Guard 2 bash hook — closes the redirection bypass the personas warn about.
- **Scratch paths are exempt.** A redirect whose target is under `/tmp/`, `/var/folders/`, or `/dev/` never warns: legitimate spec-phase scratch (council critique files written to an `mktemp -d`, captured command output, research notes) lands there and is not a project mutation. The exemption applies to the cleanly-extractable redirect target only; `tee`/`sed -i`/`git apply` fall back to a best-effort whole-command spec-dir mention check.
- **Warn-once per brainstorm occurrence** (same fired-flag mechanism as Guard 2).
- Advisory — the write/edit runs regardless.
- Intercepts `write`/`edit` (and the listed bash-mutation forms) during brainstorm for the **main loop only**; council members run in a separate session and cannot reach this guard — they are constrained by persona (best-effort, see Persona hardening).

## State tracking

- Phase state is already reconstructed in `reconstructState` (branch replay) and updated live by the `phase_tracker` tool execution; Guards 2 and 3 read the current in-memory `phases` map. No new reconstruction logic — the guards are pure reads of existing state.
- The warn-once fired-flag is a module-level `Map<string, boolean>` keyed by guard id + phase signature, cleared inside the same `reconstructState` path that resets the `phases` map. Session-live only — a fresh reconstruction re-arming the nudge is strictly safer than suppressing it.
- Guard 2's primary-vs-worktree determination is computed once at extension init and cached (no per-call git subprocess).
- Guards 2 and 3 hook `tool_call` (inspect `input`, stash a pending warning keyed by `toolCallId`) and `tool_result` (prepend the stashed warning to `event.content`), mirroring `verify-before-ship.ts` exactly. Guard 1 needs no hook — it extends the `phase_tracker` `complete` return.

Message/event shapes: `tool_call`/`tool_result` events and the `{ content: [...] }` return per `verify-before-ship.ts`; phase state per existing `phase-tracker.ts`; settings access per the existing `closureEnforced()` reader.

## Persona hardening (issue 3, subagent side)

Both council personas gain one read-only-bash clause (LLM-readable artifact; precise wording):

- `spec-council-member.md`, after "You do not write code. You do not edit the spec.":
  > Your `bash` access is read-only: inspect and query the codebase only. Never write, redirect into a file (`>`, `>>`, `tee`), edit, stage, commit, or run build/test/format commands. If the spec needs an edit, describe it in your critique — do not make it.
- `spec-council-synthesizer.md`, after "You do not decide what gets applied to the spec...":
  > Your `bash` access is read-only: use it only to check a contested claim. Never write, redirect into a file, edit, stage, or commit.

This clause constrains cooperative models; a confused or adversarial run could still mutate via bash. Guard 3 covers only the main-loop session — council sessions have no comparable runtime guard, so the persona clause is the sole, **best-effort** mechanism on the subagent side (not a guarantee).

## Dispatch cwd (issue 2, subagent side)

A dispatched child inherits the parent **process** cwd (pi's launch dir), not the main loop's `cd`-in-bash logical directory. So when the main loop is "in" the worktree only via `cd` inside bash commands, children still run in the primary checkout. Fix: the two dispatch sites pass an explicit absolute `cwd`:

- `skills/roasting-the-spec/SKILL.md` — member fan-out `tasks` objects and the chair dispatch gain `cwd: "<abs worktree path>"` (the worktree brainstorming is operating in).
- `skills/brainstorming/SKILL.md` — the fresh-`worker` critique dispatch gains `cwd: "<abs worktree path>"`.

`cwd` is a per-task and single-mode field on the `subagent` tool, so this is a one-field addition to each existing snippet, not new prose. The skill obtains `<abs worktree path>` by running `git rev-parse --show-toplevel` from inside the worktree immediately before dispatch and passing the trimmed stdout as the `cwd:` string — never `process.cwd()` (which returns the primary checkout) and never a hardcoded path. `subagent-driven-development`'s parallel-wave dispatch (which already documents `cwd` as REQUIRED) is unchanged; this spec only adds `cwd` to the council/worker critique dispatches that currently omit it.

## Config

| Key | Type | Default | Meaning |
|---|---|---|---|
| `piGauntlet.flowGuards.enforce` | boolean | `true` | Enable all three advisory flow guards |
| `piGauntlet.flowGuards.specDirs` | string[] | `["doc/specs"]` | Path components that count as a spec directory (Guard 3) |

New key under `piGauntlet`, sibling to `closureReview` and `specCouncil`. Default-on matches the `closureReview.enforce` precedent: the failures are silent and frequent, so opt-out (not opt-in) is the safe default. The guards are advisory, so default-on cannot break a build — worst case is an unwanted warning line, removable via `enforce: false`.

## Verification

No test infrastructure in this repo (extensions load directly into pi). Manual verification in a consumer session:

Steps 1-7 require the `phase-tracker.ts` and agent-persona edits; step 8 additionally requires the `cwd` dispatch edits.

1. **Guard 1:** `complete implement` -> result text carries the start-verify nudge; `reset` -> `start verify` -> dispatch `conformance-reviewer` -> `complete verify` -> result text ends with the finish nudge line; with `start ship` already done -> finish nudge absent.
2. **Guard 2 fires:** with pi launched in the primary checkout, `start implement` -> `git switch -c foo` -> result carries the branch-in-place warning; a second `git switch` in the same phase -> no repeat (warn-once).
3. **Guard 2 exemptions:** `git worktree add .worktrees/x -b x` -> no warning; `git checkout -- some/file` -> no warning; `git switch -c worktree-fix` (word `worktree` not the git subcommand) -> warning still fires; `git switch main` during `ship` phase -> no warning; pi launched inside a worktree -> Guard 2 disabled, no warning on any branch op.
4. **Guard 3 fires:** `start brainstorm` -> `write` to `src/foo.ts` -> warning; brainstorm-phase `echo x > src/foo.ts` (bash redirection) -> warning; `write` to `doc/specs/x.md` -> no warning; `edit` to `dashboard/doc/specs/y.md` -> no warning; `write` to `doc/other/z.md` -> warning (bare `doc/` does not match `doc/specs`).
5. **Disabled:** `flowGuards.enforce: false` -> none of the three fire.
6. **Reconstruction:** resume a session mid-implement -> Guard 2 re-arms (fired-flag reset) and still keys off the reconstructed phase.
7. **Persona:** dispatch a council member against a spec; confirm its critique describes edits rather than attempting them (manual read of the returned critique).
8. **Dispatch cwd:** run brainstorming in a worktree; confirm the dispatched worker/members resolve relative paths against the worktree (e.g. a member's `git rev-parse --show-toplevel` returns the worktree, not the primary checkout).

## Open questions

None.
