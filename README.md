# pi-gauntlet

A workflow library for the [pi coding agent](https://github.com/badlogic/pi-mono): opinionated skills, ready-to-use subagent personas, and three runtime extensions.

A diverged reinterpretation of [obra/superpowers](https://github.com/obra/superpowers) (Claude Code), by way of [coctostan/pi-superpowers-plus](https://github.com/coctostan/pi-superpowers-plus), rebuilt for pi with enforced gates, a spec council, conformance review, and parallel execution waves. See [Lineage](#lineage) for what changed.

## The workflow

pi-gauntlet is **opinionated**: every non-trivial change rides one pipeline, idea to merge. There is no separate "just edit a file and commit" path — the skills gate each other, so the next phase can't open until the current one closes.

```
brainstorm → plan → implement → verify → ship
```

1. **`brainstorming`** — every change starts here. Sets up an isolated worktree, explores the codebase, and turns the idea into a written spec under `doc/specs/`. A multi-model critique runs automatically before you read it (`roasting-the-spec` when a council is configured, else one fresh `worker`). **Hard gate:** no implementation code is written until you approve the spec.
2. **`writing-plans`** — derives an implementation plan from the approved spec, decomposed into atomic, independently-verifiable tasks (grouped into parallel waves when they're file- and resource-disjoint). Auto-chains into execution.
3. **`subagent-driven-development`** — executes the plan one atomic task at a time, each in a **fresh subagent**, behind a **two-stage review**: spec compliance first (`spec-reviewer`), then code quality (`code-reviewer`). The `implementer` persona is TDD-locked (RED→GREEN→REFACTOR). You orchestrate; you never hand-write the code.
4. **verify** — after the last task: a whole-diff review (`requesting-code-review`, plus any project-specific `self-audit` supplement), then the `conformance-reviewer` closing-loop gate that confronts the delivered code **and** docs against the *origin* (spec + your verbatim original prompt), not the plan. The phase-tracker **blocks `complete verify`** until a conformance dispatch has run, and on a successful `complete verify` (ship still pending) injects an advisory to invoke `finishing-a-development-branch` immediately without a redundant "ready to finish?" prompt - or to reopen verify if a requirement decision is still open.
5. **`finishing-a-development-branch`** — squash / PR / keep / discard. This menu is the single human decision gate at the end, mirroring spec approval at the start.

Spec, plan, and implementation all live in the **same worktree** and ship as **one squash commit**.

**Supporting skills** slot in as the pipeline needs them: `using-git-worktrees` (isolation, before the spec), `test-driven-development` (inside every implementer), `dispatching-parallel-agents` (wave fan-out), `systematic-debugging` (when something breaks), `receiving-code-review` (when you get feedback), `writing-skills` (authoring more of these).

**The gates are enforced, not suggested.** Brainstorming refuses to write code before spec approval; the phase-tracker refuses to close verify before the conformance gate runs; `verify-before-ship` warns on any commit/push/PR without a passing test run since your last edit. Reach for a shortcut and a gate stops you — that is the design, not a side effect.

## What you get

**13 skills** that activate automatically when pi sees the right kind of task:

- **Design & planning** — `brainstorming`, `writing-plans`, `roasting-the-spec`
- **Implementation** — `test-driven-development`, `subagent-driven-development`, `dispatching-parallel-agents`
- **Verification** — `verification-before-completion`, `systematic-debugging`
- **Review** — `requesting-code-review`, `receiving-code-review`
- **Worktree lifecycle** — `using-git-worktrees`, `finishing-a-development-branch`
- **Meta** — `writing-skills`

**7 subagent personas** dispatchable via [pi-cohort](https://github.com/jjuraszek/pi-cohort):

- `implementer` — strict RED→GREEN→REFACTOR TDD, completion-guarded.
- `code-reviewer` — read-only review, Critical/Moderate/Minor severity.
- `spec-reviewer` — verifies an implementation against its plan/spec, per-requirement table.
- `conformance-reviewer` — closing-loop intent gate; confronts the delivered code+docs against the *origin* (spec + verbatim prompt), skipping the plan, and emits a per-requirement coverage verdict. Read-only; proposes remediation, never fixes or decides. Ships model-free — pin its model per preset (see [Conformance gate](#conformance-gate-model)).
- `spec-summarizer` - produces a tight, spec-only human summary for the brainstorming user review gate. Fresh context, read-only (`tools: read`), reads only the spec it is given; output is ephemeral (rendered at the gate, never committed). Dispatched only by `brainstorming`; not for direct dispatch. Ships model-free - set `subagents.agentOverrides.spec-summarizer.model` per preset to override (unset -> inherits the main loop).
- `spec-council-member` — adversarial single-model spec critic; one per configured council model. Dispatched only by `roasting-the-spec`.
- `spec-council-synthesizer` — neutral chair that consolidates and adjudicates member critiques. Dispatched only by `roasting-the-spec`.

**3 runtime extensions**:

- `plan-tracker` — persistent task list with a TUI widget. Use the `plan_tracker` tool from skills.
- `phase-tracker` — tracks workflow phase (brainstorm → plan → implement → verify → ship) with a TUI widget. Use the `phase_tracker` tool from skills. Distinct from `plan-tracker` which tracks per-task progress within the implement phase.
- `verify-before-ship` — advisory warning if you run `git commit` / `git push` / `gh pr create` without passing tests since your last source edit.

## Requirements

- [pi-coding-agent](https://github.com/badlogic/pi-mono) ≥ 0.1.0
- [pi-cohort](https://github.com/jjuraszek/pi-cohort) ≥ 1.4.5 — required peer package. Skills that dispatch agents (`requesting-code-review`, `subagent-driven-development`, `dispatching-parallel-agents`, `writing-plans`, `writing-skills`) call `subagent({})`, which is provided by pi-cohort. pi-gauntlet does not vendor the dispatch tool; without pi-cohort those skills have nothing to call.

Both packages must be listed in your `.pi/settings.json#packages` array (pi adds them automatically when you `pi install`). pi-gauntlet and pi-cohort are versioned independently but release together whenever dispatch semantics change — pin compatible versions of both.

## Install

**Project scope** (recommended — committable via the repo's `.pi/settings.json`; `-l` writes to project settings):

```bash
pi install -l npm:pi-cohort
pi install -l npm:pi-gauntlet
```

**User scope** (all repos under your pi profile; the default target is user settings):

```bash
pi install npm:pi-cohort
pi install npm:pi-gauntlet
```

Pin an exact release with `npm:pi-gauntlet@X.Y.Z`. Pi clones the package, runs `npm install --omit=dev`, which triggers the `postinstall` script. Where personas land depends on the install location:

- **User install** (package under `<home>/.pi/<profile>/...`): symlinks the seven agent files into `getAgentDir()/agents` — i.e. `$PI_CODING_AGENT_DIR/agents`, defaulting to `~/.pi/agent/agents`. This is pi-cohort's profile-scoped user dir, so each pi profile (`agent`, `agent.anthropic`, …) gets its own personas instead of sharing the machine-global `~/.agents/`. Earlier releases installed into the machine-global `~/.agents/`; on upgrade the postinstall removes stale `~/.agents/<name>.md` symlinks that point into a pi-gauntlet package (which would otherwise shadow the profile-scoped copy) and leaves your own files there alone.
- **Project install** (package under `<repo>/.pi/...`): copies the seven agent files into `<repo>/.pi/agents/` (the project-scope discovery path). Copy, not symlink, so the files stay valid if you commit them; gitignore `.pi/agents/` if you'd rather keep them install-managed. Project scope wins over user scope on name collisions, so each repo's personas are independent of the user dir and of other repos.

## Upgrading from v3.x

v4.0.0 is the first public release and is a **breaking rename** (no behavior change). If you ran the package under its old identity:

- Reinstall under the new name: `pi install -l npm:pi-gauntlet` (was `@jjuraszek/pi-superpowers`).
- Rename settings namespace `piSuperpowers.*` -> `piGauntlet.*` in every preset's `settings.json` (a preset still on the old key silently gets defaults).
- Rename your override file `.pi/superpowers-overrides.md` -> `.pi/gauntlet-overrides.md`.
- Rename the env override `PI_SUPERPOWERS_AGENT_DIR` -> `PI_GAUNTLET_AGENT_DIR` if you set it.

See [CHANGELOG.md](CHANGELOG.md) for the full v4.0.0 entry.

## Install (local development)

```bash
git clone git@github.com:jjuraszek/pi-gauntlet.git ~/repos/pi-gauntlet
cd ~/path/to/your/repo
pi install -l ~/repos/pi-gauntlet
# Local-path installs skip `npm install`; run the symlink step manually:
cd ~/repos/pi-gauntlet && npm run link-agents
```

After that, edits in `~/repos/pi-gauntlet/` are picked up on next pi launch.

## Project-specific overrides

The skills shipped here are generic on purpose — they describe *how* to TDD, brainstorm, debug, request review, etc., without naming your services, your CI command, or your worktree wrapper. When you need that level of detail, drop a file at:

```
.pi/gauntlet-overrides.md
```

…in your repo. The skills read it at runtime and merge sections that match the skill's name or topic.

### Example `.pi/gauntlet-overrides.md`

```markdown
## verification-before-completion

Canonical verification target: `make ci` per service. Bare `pytest` does NOT satisfy
the gate — it skips integration tests.

## using-git-worktrees

Use the project's wrapper: `script/worktree create <name>`. It provisions an isolated
database and copies `.env.local`. Never call `git worktree add` directly.

## brainstorming

Project routing: dashboard work → `dashboard/AGENTS.md`. Compliance work → `compliance/AGENTS.md`.
Spec docs land in `doc/specs/`, plans in `doc/plans/`, both sibling to each other.
```

Two notes:

- The override file is read by the **skill instructions** at runtime — not by the pi runtime itself. So adding a section here doesn't load anything; the skill that's currently active reads the file and pulls in the matching section.
- Section headers should match skill names (`## verification-before-completion`) or skill topics (`## worktrees`, `## routing`). Skills look for both.

## Subagent personas

On a user install the seven personas in `agents/` are symlinked into `getAgentDir()/agents` (profile-scoped user dir — `$PI_CODING_AGENT_DIR/agents`, default `~/.pi/agent/agents`). On a project install they are copied into `<repo>/.pi/agents/` (project scope, isolated per repo). Override precedence is `project > user > builtin`, so a project install always shadows the user personas for that repo, and you can hand-edit or drop your own `.pi/agents/<name>.md` to shadow them further.

Target dir override: set `PI_GAUNTLET_AGENT_DIR` to force symlinking into a specific dir (leading `~` expanded; always symlink mode).

### Thinking budgets

`implementer`, `code-reviewer`, and `spec-reviewer` ship without `thinking:` in their frontmatter — pi-cohort `agentOverrides` only fill frontmatter-unset fields, so leaving it unset makes the budget a per-preset config knob. Set it in each preset's `settings.json` (use `false` on non-thinking models → provider default):

```json
{
  "subagents": {
    "agentOverrides": {
      "implementer": { "thinking": "medium" },
      "code-reviewer": { "thinking": "high" },
      "spec-reviewer": { "thinking": "medium" }
    }
  }
}
```

Unset → provider default thinking for that model. `conformance-reviewer` and the two `spec-council-*` personas stay frontmatter-pinned at `xhigh` and are not configurable — the gate and the council must run at max budget even when they inherit the session's model.

### Conformance gate model

`conformance-reviewer` ships without a `model:` in its frontmatter — like the spec-council personas, its model is supplied per preset so each profile points the last correctness gate at the strongest reasoning model its providers can reach. The verify-step skills read it from `piGauntlet.closureReview.model` and inject it **call-site** on the conformance dispatch (the same mechanism the spec-council chair uses). Add it to each preset's `settings.json`:

```json
{
  "piGauntlet": {
    "closureReview": { "model": "<provider/model>", "enforce": true, "maxFixRounds": 2 }
  }
}
```

Frontmatter pins `thinking: xhigh` and `defaultContext: fresh` (the gate always runs cold, with max reasoning) and `thinking` is not call-site overridable, so the config supplies only `model`. If `closureReview.model` is unset the dispatch omits `model:` and the gate inherits the parent's model; if the configured model is unreachable it retries once inherited.

When `closureReview.model` **is** set, the phase-tracker enforces call-site injection: a `subagent` dispatch of `conformance-reviewer` that omits `model:` is **blocked at tool-call time** (before it runs) so the gate can never silently degrade to the parent's builder model. The documented one-retry fallback still works - pass the inherited model *explicitly* and it is allowed; only a bare omission is blocked. Disabling `closureReview.enforce` disables this guard too.

`closureReview.enforce` (default `true`) controls the phase-tracker gate that
blocks `complete verify` until the conformance-reviewer has run; set `false` to
disable enforcement for a preset.

`closureReview.maxFixRounds` (default `2`) caps the conformance **remediation loop**: when a `GAPS` verdict's gaps are dispositioned `fix`, the orchestrator dispatches isolated fix waves and re-audits the delta, up to this many rounds before escalating to the user with the per-gap history. Missing or non-integer -> `2`; `< 0` clamps to `0`; `0` disables fix dispatch (the gap menu offers accept / rescope only). Enforced by the protocol prose in `verification-before-completion/reference/conformance-check.md`, not by the phase-tracker extension.

If you want to know what's in each persona before using it, see [`agents/`](./agents/). The frontmatter (tools, thinking level, context mode) is documented in [`AGENTS.md`](./AGENTS.md#agents).

## Spec council

`/skill:roasting-the-spec` runs a multi-model critique of a spec before the brainstorming user-review gate. It is the **critique half** of brainstorming's self-review: when a council is configured in the active preset's `settings.json`, brainstorming **auto-dispatches** it (no prompt); when none is configured, brainstorming runs a single fresh-`worker` critique instead. Each member runs on a different model (divergent critiques), a neutral chair consolidates and adjudicates, and you approve what gets applied.

```json
{
  "piGauntlet": {
    "specCouncil": {
      "members": ["<provider/model>", "<provider/model>", "<provider/model>"],
      "chair": "<provider/model>"
    }
  }
}
```

- `members` (required) — roster of `provider/model` strings; council size = array length, one critique per model. Empty or absent → the council never runs; brainstorming falls back to a single fresh-`worker` critique (scope + ambiguity, auto-applied).
- `chair` (optional) — model for the consolidating synthesizer; defaults to the inherited model when omitted.

Rosters are per-preset: each pi profile (`agent`, `agent.anthropic`, `agent.bedrock`, …) reads its own `settings.json`, so list only models that profile's providers can reach. The two personas it dispatches — `spec-council-member` and `spec-council-synthesizer` — are model-free; their model is injected per task from this config.

## Extensions

### `plan-tracker`

A tool, not a hook. Skills call `plan_tracker({ action: "init" | "update" | "status" | "clear", ... })` to manage a task list; a TUI widget above the editor shows progress (✓/→/○). State branches with the session, no config needed.

### `phase-tracker`

A tool, not a hook. Skills call `phase_tracker({ action: "start" | "complete" | "skip" | "status" | "reset", phase?, reason? })` to track workflow phase progress. A TUI widget shows the five-phase pipeline: `○ brainstorm → ○ plan → ○ implement → ○ verify → ○ ship`. State branches with the session, no config needed. Phases are entered **explicitly** by the phase-owning skills, so outside a gauntlet flow the widget stays dormant. The `brainstorming` skill resets both trackers on entry (new flow, clean slate); `implement` auto-completes from `plan-tracker` once a skill has started it.

Distinct from `plan-tracker`: `phase-tracker` answers "what stage of the workflow am I in?"; `plan-tracker` answers "which task within the current stage am I on?"

**Closure-review gate.** `complete verify` is rejected unless a successful
`conformance-reviewer` dispatch (a `subagent` result whose `results[]` contains
`agent: "conformance-reviewer"` with `exitCode: 0`) has been observed since the
last `reset`. Management calls (`action: "list"` etc.) and async dispatches never
qualify. A user waiver is recorded via `skip` with a reason — there is no `force`
bypass on `complete`. Disable per preset with
`settings.json#piGauntlet.closureReview.enforce: false` (default: enforced).

**Flow guards.** Two guards, on by default, disabled per
preset with `settings.json#piGauntlet.flowGuards.enforce: false`:

- **Worktree discipline (blocks).** During `brainstorm`/`plan`/`implement`, an in-place
  `git switch` / `git checkout -b`/`-B` is blocked — the bash call does not run.
  Active **only when pi was launched in the primary checkout** (not a linked
  worktree); `git worktree ...` and plain `git checkout <file>` never trip it.
  Override via `piGauntlet.flowGuards.enforce: false`.
- **Spec-phase confinement (advisory).** During `brainstorm`, a `write`/`edit` (or a bash
  mutation: `>`/`>>`/`tee`/`sed -i`/`git apply`) outside the spec dir warns that
  brainstorming may only touch the spec. Spec dirs come from
  `flowGuards.specDirs` (default `["doc/specs"]`). Redirects to scratch paths
  (`/tmp`, `/var/folders`, `/dev`) are exempt. Warns once per brainstorm.

### `verify-before-ship`

A hook on `git commit` / `git push` / `gh pr create`. If you haven't run a passing test command since your last source-file write in this session, an advisory warning is injected into the tool result. The warning clears automatically after a passing test run.

Default test-command regex matches: `make ci`, `make test`, `npm test`, `pnpm test`, `yarn test`, `pytest`, `rspec`, `cargo test`, `go test`.

Override in `.pi/settings.json`:

```json
{
  "piGauntlet": {
    "verifyBeforeShip": {
      "testCommands": ["make ci", "bundle exec rspec"],
      "warningReference": "doc/testing.md"
    }
  }
}
```

`testCommands` entries are regex fragments (anchored with `\b` automatically). `warningReference` is a doc path appended to the warning text — useful for pointing engineers at your testing conventions.

## Versioning

Bump explicitly:

```bash
pi install -l npm:pi-gauntlet@X.Y.Z
```

See [`CHANGELOG.md`](./CHANGELOG.md) for what changed in each release. Semver: minor for new skill/agent/extension, major for renames or breaking config changes. pi-gauntlet and its dispatch peer [pi-cohort](https://github.com/jjuraszek/pi-cohort) version independently but ship together whenever dispatch semantics change; pin compatible versions of both.

## Lineage

pi-gauntlet began as a port of [obra/superpowers](https://github.com/obra/superpowers) (MIT, Copyright (c) 2025 Jesse Vincent), by way of [coctostan/pi-superpowers-plus](https://github.com/coctostan/pi-superpowers-plus), and has since diverged into its own thing. It drops upstream's memory/journal system and its sequential-only execution model, and adds a multi-model spec council, a closing-loop conformance-review gate, file- and resource-disjoint parallel execution waves, and enforced phase gates (brainstorm, verify, and ship are guarded at runtime, not merely suggested). The skill methodology still owes its shape to obra's work; the runtime, the gates, and the agent roster are pi-gauntlet's own.

## License

MIT. See [`LICENSE`](./LICENSE). Portions derive from obra/superpowers (MIT) and coctostan/pi-superpowers-plus; their copyright notice is preserved in `LICENSE`.
