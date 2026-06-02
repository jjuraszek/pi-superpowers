# Changelog

## v1.0.3 — 2026-06-02

- **roasting-the-spec / spec-council-synthesizer:** stop the chair stalling at synthesis. The member critiques live in a shared temp dir and rode to the chair only via `reads:`, but the synthesizer's prompt told it that it "receives the paths" — which the task never enumerated, so it scanned the tree for `*.md` and hung. The skill now lists the exact `<tmpdir>/member-<i>-<slug>.md` paths in the chair's task text (flagged as already-injected via reads), and the synthesizer persona is instructed not to run find/grep/ls to discover critique files.

## v1.0.2 — 2026-06-01

- **brainstorming:** phase tracking now starts unconditionally on skill entry. The `phase_tracker({ action: "start", phase: "brainstorm" })` call was previously gated behind a `status`-probe conditional ("if status returns pending across the board") and buried inside *Worktree First* under the worktree-setup step — the exact step the model defers when a conversational prompt arrives, so a question-heavy entry could answer the user and never start tracking. Hoisted it to **checklist item 1** as the first action on entry (before reading code, worktree setup, or replying), documented its idempotency (re-entry while in-progress is a safe no-op), and removed the status-probe guard. Checklist renumbered (10→11 items); spec-council reference updated to item 9.

## v1.0.1 — 2026-06-01

- **brainstorming:** harden the anti-jump-to-implementation gate after an implementation-heavy prompt slipped straight past spec/council/plan. HARD CONSTRAINT reframed from a file-write boundary into a behavioral gate — no implementation action until the design is approved, and an imperative request ("test it end-to-end", "run the service") explicitly does not lift it. Drew the research/implementation line: running the system to observe **current** behaviour is allowed research (feeds the spec); building, deploying, or validating the **proposed change** is implementation and waits for the gate. Added an ordered **Checklist** (terminal state = user gate → `/skill:writing-plans`) so steps can't be silently skipped, made the spec-council offer a required checklist item when configured, and added matching Red Flags.

## v1.0.0 — 2026-05-31

- **writing-plans:** tasks can be grouped into dependency **waves** under `## Wave N` headers; the per-task `Files:` block now doubles as a file-ownership contract (within a wave, task file sets must be pairwise disjoint). Self-review gains a wave-disjointness check; ordering guidance updated for waves.
- **subagent-driven-development:** new **Parallel-Wave Mode** — independent tasks in a wave run concurrently in isolated worktrees (`worktree: true`), integrated serially via `git apply` behind the same two-stage review, committed per wave. `plan_tracker` wave encoding documented (init-once, wave-prefixed names, multiple concurrent `in_progress`). Dispatching a wave from inside a worktree requires passing the worktree path as the top-level `cwd` so children branch from the right base. Sequential remains the default.
- **dispatching-parallel-agents:** generalized from debugging-only to any independent file-disjoint tasks (including plan waves); established as the canonical fan-out + worktree-isolation + patch-integration mechanic home; conflict policy now leads with sequential re-dispatch over manual hunk-merge, and documents textual vs semantic conflicts.
- **Naming:** retired “parallel session” (which meant the separate `executing-plans` session) in favor of “Separate Session”; “parallel” now refers only to task-level concurrency (waves).

## v0.5.0 — 2026-05-31

- **roasting-the-spec:** new skill — an optional, per-preset multi-model spec critique that runs inside `brainstorming` between self-review and the user gate. Each council member runs on a different model (`piSuperpowers.specCouncil.members`), a neutral chair (`spec-council-synthesizer`) consolidates and adjudicates their critiques, the parent proposes dispositions, and the user approves what lands. Off unless configured.
- **agents:** add `spec-council-member` (adversarial single-model spec critic, `thinking: xhigh`) and `spec-council-synthesizer` (neutral consolidating chair, `thinking: xhigh`). Both are model-free; `roasting-the-spec` injects the model per task. Brings the shipped persona count to five.
- **brainstorming:** add a one-section hook offering the spec council before the user review gate when configured; unchanged when not.

## v0.4.1 — 2026-05-30

- **using-git-worktrees:** worktrees are now the announced default for skill-driven work (was a blocking consent gate). Canonical home is `<repo>/.worktrees/<branch>`, created if missing, with the gitignore check folded into creation. Dropped the global `~/worktrees/` prompt and the bare `worktrees/` location; `~/.worktrees/<project>/` is used only when there is no enclosing repo. Project setup and baseline examples now prefer `pnpm`/`yarn`.
- **finishing-a-development-branch:** worktree-cleanup provenance synced to the new paths (`.worktrees/`, `~/.worktrees/<project>/`); removed the stale `worktrees/` and `~/.config/superpowers/worktrees/` entries this fork never creates.
- **verification-before-completion:** documented default test commands now list `pnpm test`/`yarn test`, matching the `verify-before-ship` extension and README.
- **test-driven-development:** prerequisite is an active worktree, not just a non-`main` branch.
- **brainstorming:** First-Feature Oversight and single-source-of-truth guidance made stack-agnostic (removed Rails/Django-specific vocabulary).
- **dispatching-parallel-agents:** replaced the session-specific narrative with a dense pi-subagents integration reference (parallel mode, fresh context, `worktree: true` isolation, agent choice, output capture).

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
