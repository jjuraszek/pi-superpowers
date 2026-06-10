# pi-superpowers

A workflow library for the [pi coding agent](https://github.com/badlogic/pi-mono): opinionated skills, ready-to-use subagent personas, and three runtime extensions.

Inspired by [obra/superpowers](https://github.com/obra/superpowers) (Claude Code) and [coctostan/pi-superpowers-plus](https://github.com/coctostan/pi-superpowers-plus). Ported to pi and trimmed to the pieces that survive across projects.

## What you get

**14 skills** that activate automatically when pi sees the right kind of task:

- **Design & planning** — `brainstorming`, `writing-plans`, `executing-plans`, `roasting-the-spec`
- **Implementation** — `test-driven-development`, `subagent-driven-development`, `dispatching-parallel-agents`
- **Verification** — `verification-before-completion`, `systematic-debugging`
- **Review** — `requesting-code-review`, `receiving-code-review`
- **Worktree lifecycle** — `using-git-worktrees`, `finishing-a-development-branch`
- **Meta** — `writing-skills`

**6 subagent personas** dispatchable via [pi-subagents](https://github.com/jjuraszek/pi-subagents):

- `implementer` — strict RED→GREEN→REFACTOR TDD, completion-guarded.
- `code-reviewer` — read-only review, Critical/Moderate/Minor severity.
- `spec-reviewer` — verifies an implementation against its plan/spec, per-requirement table.
- `conformance-reviewer` — closing-loop intent gate; confronts the delivered code+docs against the *origin* (spec + verbatim prompt), skipping the plan, and emits a per-requirement coverage verdict. Read-only; proposes remediation, never fixes or decides. Ships model-free — pin its model per preset (see [Conformance gate](#conformance-gate-model)).
- `spec-council-member` — adversarial single-model spec critic; one per configured council model. Dispatched only by `roasting-the-spec`.
- `spec-council-synthesizer` — neutral chair that consolidates and adjudicates member critiques. Dispatched only by `roasting-the-spec`.

**3 runtime extensions**:

- `plan-tracker` — persistent task list with a TUI widget. Use the `plan_tracker` tool from skills.
- `phase-tracker` — tracks workflow phase (brainstorm → plan → implement → verify → ship) with a TUI widget. Use the `phase_tracker` tool from skills. Distinct from `plan-tracker` which tracks per-task progress within the implement phase.
- `verify-before-ship` — advisory warning if you run `git commit` / `git push` / `gh pr create` without passing tests since your last source edit.

## Requirements

- [pi-coding-agent](https://github.com/badlogic/pi-mono) ≥ 0.1.0
- [pi-subagents](https://github.com/jjuraszek/pi-subagents) — required peer package. Skills that dispatch agents (`requesting-code-review`, `subagent-driven-development`, `dispatching-parallel-agents`, `writing-plans`, `writing-skills`) call `subagent({})`, which is provided by pi-subagents.

Both packages must be listed in your `.pi/settings.json#packages` array (pi adds them automatically when you `pi install`).

## Install

**Project scope** (recommended — committable via the repo's `.pi/settings.json`):

```bash
pi install -l git:github.com/jjuraszek/pi-subagents@<sha-or-tag>
pi install -l git:github.com/jjuraszek/pi-superpowers@v1.2.0
```

**User scope** (all repos under your pi profile):

```bash
pi install git:github.com/jjuraszek/pi-subagents@<sha-or-tag>
pi install git:github.com/jjuraszek/pi-superpowers@v1.2.0
```

Pi clones the package, runs `npm install --omit=dev`, which triggers the `postinstall` script. Where personas land depends on the install location:

- **User install** (package under `<home>/.pi/<profile>/...`): symlinks the six agent files into `getAgentDir()/agents` — i.e. `$PI_CODING_AGENT_DIR/agents`, defaulting to `~/.pi/agent/agents`. This is pi-subagents' profile-scoped user dir, so each pi profile (`agent`, `agent.anthropic`, …) gets its own personas instead of sharing the machine-global `~/.agents/`. Older versions installed into `~/.agents/`; on upgrade the postinstall removes stale `~/.agents/<name>.md` symlinks that point into a pi-superpowers package (which would otherwise shadow the profile-scoped copy) and leaves your own files there alone.
- **Project install** (package under `<repo>/.pi/...`): copies the six agent files into `<repo>/.pi/agents/` (the project-scope discovery path). Copy, not symlink, so the files stay valid if you commit them; gitignore `.pi/agents/` if you'd rather keep them install-managed. Project scope wins over user scope on name collisions, so each repo's personas are independent of the user dir and of other repos.

## Install (local development)

```bash
git clone git@github.com:jjuraszek/pi-superpowers.git ~/repos/pi-superpowers
cd ~/path/to/your/repo
pi install -l ~/repos/pi-superpowers
# Local-path installs skip `npm install`; run the symlink step manually:
cd ~/repos/pi-superpowers && npm run link-agents
```

After that, edits in `~/repos/pi-superpowers/` are picked up on next pi launch.

## Project-specific overrides

The skills shipped here are generic on purpose — they describe *how* to TDD, brainstorm, debug, request review, etc., without naming your services, your CI command, or your worktree wrapper. When you need that level of detail, drop a file at:

```
.pi/superpowers-overrides.md
```

…in your repo. The skills read it at runtime and merge sections that match the skill's name or topic.

### Example `.pi/superpowers-overrides.md`

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

On a user install the six personas in `agents/` are symlinked into `getAgentDir()/agents` (profile-scoped user dir — `$PI_CODING_AGENT_DIR/agents`, default `~/.pi/agent/agents`). On a project install they are copied into `<repo>/.pi/agents/` (project scope, isolated per repo). Override precedence is `project > user > builtin`, so a project install always shadows the user personas for that repo, and you can hand-edit or drop your own `.pi/agents/<name>.md` to shadow them further.

Target dir override: set `PI_SUPERPOWERS_AGENT_DIR` to force symlinking into a specific dir (leading `~` expanded; always symlink mode).

### Conformance gate model

`conformance-reviewer` ships without a `model:` in its frontmatter — like the spec-council personas, its model is supplied per preset so each profile points the last correctness gate at the strongest reasoning model its providers can reach. Add it to each preset's `settings.json`:

```json
{
  "subagents": {
    "agentOverrides": {
      "conformance-reviewer": { "model": "<provider/model>" }
    }
  }
}
```

Frontmatter pins `thinking: xhigh` and `defaultContext: fresh` (the gate always runs cold, with max reasoning), so the override only needs to supply `model`. With no override the agent falls back to the harness default model.

If you want to know what's in each persona before using it, see [`agents/`](./agents/). The frontmatter (tools, thinking level, context mode) is documented in [`AGENTS.md`](./AGENTS.md#agents).

## Spec council

`/skill:roasting-the-spec` runs an optional multi-model critique of a spec before the brainstorming user-review gate. It is **off unless configured** in the active preset's `settings.json`. Each member runs on a different model (divergent critiques), a neutral chair consolidates and adjudicates, and you approve what gets applied.

```json
{
  "piSuperpowers": {
    "specCouncil": {
      "members": ["<provider/model>", "<provider/model>", "<provider/model>"],
      "chair": "<provider/model>"
    }
  }
}
```

- `members` (required) — roster of `provider/model` strings; council size = array length, one critique per model. Empty or absent → the council is never offered and brainstorming is unchanged.
- `chair` (optional) — model for the consolidating synthesizer; defaults to the inherited model when omitted.

Rosters are per-preset: each pi profile (`agent`, `agent.anthropic`, `agent.bedrock`, …) reads its own `settings.json`, so list only models that profile's providers can reach. The two personas it dispatches — `spec-council-member` and `spec-council-synthesizer` — are model-free; their model is injected per task from this config.

## Extensions

### `plan-tracker`

A tool, not a hook. Skills call `plan_tracker({ action: "init" | "update" | "status" | "clear", ... })` to manage a task list; a TUI widget above the editor shows progress (✓/→/○). State branches with the session, no config needed.

### `phase-tracker`

A tool, not a hook. Skills call `phase_tracker({ action: "start" | "complete" | "skip" | "status" | "reset", phase?, reason? })` to track workflow phase progress. A TUI widget shows the five-phase pipeline: `○ brainstorm → ○ plan → ○ implement → ○ verify → ○ ship`. State branches with the session, no config needed.

Distinct from `plan-tracker`: `phase-tracker` answers "what stage of the workflow am I in?"; `plan-tracker` answers "which task within the current stage am I on?"

### `verify-before-ship`

A hook on `git commit` / `git push` / `gh pr create`. If you haven't run a passing test command since your last source-file write in this session, an advisory warning is injected into the tool result. The warning clears automatically after a passing test run.

Default test-command regex matches: `make ci`, `make test`, `npm test`, `pnpm test`, `yarn test`, `pytest`, `rspec`, `cargo test`, `go test`.

Override in `.pi/settings.json`:

```json
{
  "piSuperpowers": {
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
pi install -l git:github.com/jjuraszek/pi-superpowers@vX.Y.Z
```

See [`CHANGELOG.md`](./CHANGELOG.md) for what changed in each release. Semver: minor for new skill/agent/extension, major for renames or breaking config changes.

## License

MIT (declared in `package.json`).
