# Changelog

## v0.4.0 — 2026-05-30

- **install-agents:** user installs now symlink personas into `getAgentDir()/agents` (`$PI_CODING_AGENT_DIR/agents`, default `~/.pi/agent/agents`) instead of the global `~/.agents/`. This is pi-subagents' profile-scoped user dir, so each pi profile (`agent`, `agent.anthropic`, `agent.bedrock`, …) gets its own personas and stops sharing one global dir. Project installs are unchanged (copy into `<repo>/.pi/agents/`).
- **install-agents:** migration — older versions symlinked into `~/.agents/`, which pi-subagents still discovers and which *wins* over `getAgentDir()/agents` on name collisions. User installs now remove stale `~/.agents/<name>.md` symlinks that resolve into a pi-superpowers package so they no longer shadow the profile-scoped install. Real files and unrelated symlinks in `~/.agents/` are left untouched.
- **install-agents:** `PI_SUPERPOWERS_AGENT_DIR` override now expands a leading `~`/`~/`.

## v0.3.0 — 2026-05-30

- **install-agents:** project installs now copy personas into `<repo>/.pi/agents/` (project scope) instead of symlinking into the global `~/.agents/`. Previously every install — user or project — wrote to the shared `~/.agents/` keyed by filename, so personas were effectively global across all pi profiles and the last install to run won the symlink. The installer now detects whether the package lives under `<repo>/.pi/...` (project → copy, install-managed, gitignored) or `<home>/.pi/<profile>/...` (user → symlink into `~/.agents/`, unchanged). Local-path dev installs and `PI_SUPERPOWERS_AGENT_DIR` keep symlink behavior. Project scope wins over user scope on name collisions, so per-repo installs are now independent.

## v0.2.0 — 2026-05-28

- **writing-plans:** drop `plan-document-reviewer-prompt.md` subagent dispatch from the Self-Review step. Align with obra v5.0.6 — inline self-review only. The dispatch added ~25 min/run with no measured quality gain and contradicted the repo's no-belt-and-suspenders rule.
- **using-git-worktrees:** port obra v5.1.0 Step 0 improvements — robust path resolution via `cd && pwd -P` wrapping, submodule guard via `git rev-parse --show-superproject-working-tree` (replaces fragile `.git is a file` heuristic), branch-state reporting after detection.
- **using-git-worktrees:** port obra v5.1.0 Step 1a improvements — explicit native-tool name anchors (`EnterWorktree`, `WorktreeCreate`, `/worktree`, `--worktree`). Upstream TDD showed compliance jumped from 2/6 to 50/50 with explicit names.
- **writing-skills:** fix dead reference to `examples/CLAUDE_MD_TESTING.md` in `reference/testing-skills-with-subagents.md`. File was never ported; replaced with pointer to upstream `obra/superpowers` repo.
- **README:** fix broken link — `mariozechner/pi` → `badlogic/pi-mono` (was 404).
- **AGENTS.md:** improve verification grep example — replace meaningless `specific.company.name` placeholder with realistic patterns (`jjuraszek`, `/Users/[^/]+`, `<your-org-name>`).
- **extensions:** add `phase-tracker.ts` — tracks workflow phase (brainstorm → plan → implement → verify → ship) with a TUI widget. Session-state only, no disk persistence.
- **skills:** rewire `brainstorming`, `writing-plans`, `test-driven-development`, `verification-before-completion`, and `finishing-a-development-branch` to call `phase_tracker` for phase progress instead of (mis)using `plan_tracker`. `plan_tracker` is now used correctly — only for per-task progress in `subagent-driven-development` and `executing-plans`.

## v0.1.2 — 2026-05-28

- **Agents:** add `thinking`, `defaultContext`, `inheritSkills` frontmatter to all three personas. Previously these knobs were documented in `AGENTS.md` but missing from the agent files, so dispatch fell back to pi-subagents defaults (typically `thinking: high`, no defaultContext override). Now: reviewers use `thinking: high` + `defaultContext: fresh`; implementer uses `thinking: medium` + `defaultContext: fork`. All three use `inheritSkills: false` to prevent recursive skill discovery in dispatched children.
- **AGENTS.md:** correct false claim that `plan-tracker.ts` accepts settings — it has no configurable knobs. Tighten the package-conventions section. Document the divergence from `obra/superpowers` v5.1.0 (they dropped `agents/`, we keep them as pi-subagents profiles) and explain why `using-superpowers` is intentionally absent.
- **README.md:** rewrite for human readability, expand the project-overrides section with a concrete example, fix the version pin from `v0.1.0` to `v0.1.1`.
- **skills/writing-skills/SKILL.md:** drop project-specific references; broaden the "Where Skills Live in Pi" table to include the package-distributed path; update extension references to reflect package distribution.

## v0.1.1 — 2026-05-28

- Drop `peerDependencies` from `package.json`. The relationship is informational only — pi loads this package via its own package manager (not via `require()` / `import`) so npm's peer-dep auto-install pulled ~138 transitive packages with no runtime benefit. The host requirement is still documented in `README.md` and `AGENTS.md`. `npm install` now does effectively zero work (just runs `postinstall` to relink agents).

## v0.1.0 — 2026-05-28

Initial extraction of the obra/superpowers-inspired workflow framework into a standalone package.

Includes 13 skills, 3 agents (implementer, code-reviewer, spec-reviewer), 2 extensions (plan-tracker, verify-before-ship).
