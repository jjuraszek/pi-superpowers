---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - creates isolated git worktrees with smart directory selection and safety verification
---

> **Related skills:** Set up **before** `/skill:brainstorming` — the spec is the worktree's first commit, not a separate one on `main`. Execute with `/skill:executing-plans` or `/skill:subagent-driven-development`. Clean up with `/skill:finishing-a-development-branch`.

# Using Git Worktrees

## Overview

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Detect existing isolation first → prefer the project's native tool → verify safety → ask before creating.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Step 0 — Detect Existing Isolation (REQUIRED)

Before doing anything else, check whether you are **already** inside an isolated worktree. Creating a worktree inside another worktree, or inside a submodule, produces silent corruption.

```bash
GIT_DIR=$(git rev-parse --git-dir)
GIT_COMMON=$(git rev-parse --git-common-dir)

if [ "$GIT_DIR" != "$GIT_COMMON" ]; then
  echo "Already in a worktree: $(pwd)"
  echo "Common git dir: $GIT_COMMON"
  echo "Do not create a nested worktree. Continue here or ask the user."
  # STOP — do not create another worktree
fi
```

**Submodule guard:** if `.git` is a *file* (not a directory) and not equal to `git-common-dir`, you are inside a submodule. Stop and ask.

**If already isolated:** announce it, then continue in place. Skip the rest of this skill.

## Step 1 — Get Consent (REQUIRED)

Never create a worktree silently. State what you intend and pause:

> "I'd like to create an isolated worktree at `<path>` on branch `<branch>` for this work. OK to proceed, or do you want me to work in the current directory?"

Common reasons to **not** create a worktree:
- Single-file edit or trivial change
- User already set up a workspace
- Working in a sandbox that doesn't support multiple checkouts
- User says no

## Step 1a — Prefer the Project's Native Tool

Many monorepos ship a worktree script that handles setup conventions (deps, isolated DBs, env files). Always prefer it.

Some projects ship a wrapper script (commonly `script/worktree`, `bin/worktree`, or similar). Check `AGENTS.md`, the repo root, and `script/` / `bin/` directories.

A typical wrapper handles:
- Sibling-worktree placement under a project-conventional path
- Tool-trust setup (e.g. `mise trust`, `direnv allow`)
- Subproject dependency install (`bundle install`, `uv sync`, `npm install`)
- Isolated dev/test DB provisioning where the runtime needs it
- Branch naming conventions (e.g. `<user>/<name>`)

**Prefer the wrapper. Do not call `git worktree add` directly when a wrapper exists.** It encapsulates conventions the raw command will get wrong.

## Step 2 — Fallback: Manual Worktree Creation

Only when no native tool exists:

### 2a. Pick a location

Priority:
1. `.worktrees/` if it exists (project-local, hidden)
2. `worktrees/` if it exists
3. Project config (`grep -i worktree.*director README.md AGENTS.md .pi/settings.json`)
4. Ask the user: `.worktrees/` (local) or `~/worktrees/<project>/` (global)

### 2b. Verify isolation safety

**For project-local locations, the directory MUST be gitignored:**

```bash
git check-ignore -q .worktrees 2>/dev/null || echo "NOT IGNORED — add to .gitignore first"
```

If not ignored: add to `.gitignore`, commit that change, *then* proceed. Never create a project-local worktree under an unignored path.

For `~/worktrees/...` — no .gitignore check needed.

### 2c. Create

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
git worktree add "$LOCATION/$BRANCH_NAME" -b "$BRANCH_NAME"
cd "$LOCATION/$BRANCH_NAME"
```

### 2d. Run project setup

```bash
[ -f package.json ]    && npm install
[ -f Cargo.toml ]      && cargo build
[ -f pyproject.toml ]  && uv sync
[ -f Gemfile ]         && bundle install
[ -f go.mod ]          && go mod download
```

### 2e. Sandbox fallback

If worktree creation fails on permissions (read-only filesystem, container sandbox without write to parent dirs): stop, announce the failure, and continue in the current directory on a feature branch.

## Step 3 — Verify Clean Baseline

```bash
# pick the project's test command — see AGENTS.md for the canonical entrypoint
make ci                    # cross-language convention
npm test                   # JS / TS
uv run pytest              # Python
bundle exec rspec          # Ruby
cargo test                 # Rust
go test ./...              # Go
```

- Tests pass → report ready.
- Tests fail → report failures, ask whether to proceed or investigate. Don't assume pre-existing breakage is fine.

## Step 4 — Report Location

```
Worktree ready at <full-path>
Branch: <branch-name>
Baseline: <test-result>
Ready to implement <feature>
```

## Detached HEAD

If `git symbolic-ref -q HEAD` returns nothing, you're on a detached HEAD. Do not create a worktree from this state — first ask the user whether to branch from the current commit or from `main`.

## Keeping a Worktree Current

For longer-running work the base branch advances:

```bash
git fetch origin
git rebase origin/main    # or merge if branch is shared
```

Re-run tests after rebasing.

## Quick Reference

| Situation | Action |
|---|---|
| `GIT_DIR != GIT_COMMON` | Already in worktree — do NOT create another |
| `.git` is a file | Submodule — do NOT create here |
| Project-native wrapper exists | Use the wrapper (commonly `script/worktree create`) |
| No native tool, `.worktrees/` exists, ignored | Use it |
| No native tool, not ignored | Add to `.gitignore`, commit, then create |
| Detached HEAD | Ask before branching |
| Sandbox/permission failure | Work in place on a feature branch |
| Tests fail at baseline | Report + ask |

## Red Flags — STOP

- About to run `git worktree add` from inside a worktree (`GIT_DIR != GIT_COMMON`)
- About to call `git worktree add` directly when the project ships a wrapper (use the wrapper)
- Project-local worktree path not gitignored
- Created worktree without asking the user first
- Tests fail at baseline and you proceed anyway

## Integration

**Called by:**
- `/skill:brainstorming` — **before** writing the spec; the spec is the worktree's first commit
- `/skill:executing-plans` and `/skill:subagent-driven-development` — required before any implementation tasks
- Any skill needing isolated workspace

**Pairs with:**
- `/skill:finishing-a-development-branch` — REQUIRED for cleanup. Default finish squashes the worktree's full history into a single commit on `main`. If the worktree was created by a project-native wrapper, cleanup defers to the wrapper's destroy command.

**Note:** Trivial one-off edits the user explicitly asks for (e.g. "fix this typo") do not require a worktree. Everything else — specs, plans, implementation — belongs in a worktree from the first artifact onward.

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
