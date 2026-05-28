# pi-superpowers

A workflow library for the [pi coding agent](https://github.com/mariozechner/pi): opinionated skills, ready-to-use subagent personas, and two small runtime extensions.

Inspired by [obra/superpowers](https://github.com/obra/superpowers) (Claude Code) and [coctostan/pi-superpowers-plus](https://github.com/coctostan/pi-superpowers-plus). Ported to pi and trimmed to the pieces that survive across projects.

## What you get

**13 skills** that activate automatically when pi sees the right kind of task:

- **Design & planning** — `brainstorming`, `writing-plans`, `executing-plans`
- **Implementation** — `test-driven-development`, `subagent-driven-development`, `dispatching-parallel-agents`
- **Verification** — `verification-before-completion`, `systematic-debugging`
- **Review** — `requesting-code-review`, `receiving-code-review`
- **Worktree lifecycle** — `using-git-worktrees`, `finishing-a-development-branch`
- **Meta** — `writing-skills`

**3 subagent personas** dispatchable via [pi-subagents](https://github.com/jjuraszek/pi-subagents):

- `implementer` — strict RED→GREEN→REFACTOR TDD, completion-guarded.
- `code-reviewer` — read-only review, Critical/Moderate/Minor severity.
- `spec-reviewer` — verifies an implementation against its plan/spec, per-requirement table.

**2 runtime extensions**:

- `plan-tracker` — persistent task list with a TUI widget. Use the `plan_tracker` tool from skills.
- `verify-before-ship` — advisory warning if you run `git commit` / `git push` / `gh pr create` without passing tests since your last source edit.

## Requirements

- [pi-coding-agent](https://github.com/mariozechner/pi) ≥ 0.1.0
- [pi-subagents](https://github.com/jjuraszek/pi-subagents) — required peer package. Skills that dispatch agents (`requesting-code-review`, `subagent-driven-development`, `dispatching-parallel-agents`, `writing-plans`, `writing-skills`) call `subagent({})`, which is provided by pi-subagents.

Both packages must be listed in your `.pi/settings.json#packages` array (pi adds them automatically when you `pi install`).

## Install

**Project scope** (recommended — committable via the repo's `.pi/settings.json`):

```bash
pi install -l git:github.com/jjuraszek/pi-subagents@<sha-or-tag>
pi install -l git:github.com/jjuraszek/pi-superpowers@v0.1.2
```

**User scope** (all repos under your pi profile):

```bash
pi install git:github.com/jjuraszek/pi-subagents@<sha-or-tag>
pi install git:github.com/jjuraszek/pi-superpowers@v0.1.2
```

Pi clones the package, runs `npm install --omit=dev`, which triggers the `postinstall` script and symlinks the three agent files into `~/.agents/` (the user-scope discovery path pi-subagents reads from).

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

The three personas in `agents/` get symlinked into `~/.agents/` on install, so pi-subagents discovers them at user scope. Override precedence is `project > user > builtin`, so you can shadow any of them by dropping `.pi/agents/<name>.md` in your repo.

If you want to know what's in each persona before using it, see [`agents/`](./agents/). The frontmatter (tools, thinking level, context mode) is documented in [`AGENTS.md`](./AGENTS.md#agents).

## Extensions

### `plan-tracker`

A tool, not a hook. Skills call `plan_tracker({ action: "init" | "update" | "status" | "clear", ... })` to manage a task list; a TUI widget above the editor shows progress (✓/→/○). State branches with the session, no config needed.

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
