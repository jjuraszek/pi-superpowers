# pi-superpowers

Workflow skills, agent personas, and extensions for the pi coding agent. Generic by design — project-specific content lives in consumer repos via `.pi/superpowers-overrides.md`.

## Communication Style

Applies to humans and agents — chat, PR descriptions, issue comments, commit messages.

Do **NOT** output:

- Intent classification ("I detect X intent", "My approach…").
- Phase/routing announcements before acting.
- Subagent/tool invocation preamble ("I'll delegate this…", "Let me start by…") — just fire it.
- Status narration ("I'm working on…", "Now I'll…").
- Preamble pleasantries.
- Restating what was just done — the diff speaks for itself.

Output **instead**:

- **Outcomes** — what changed, what was found.
- **Decisions needing user input** — ambiguities, options.
- **Verification results** — test/build output, errors.
- **Blockers** — failures or decisions required to proceed.

Bullets over prose. Short paragraphs. End on the ask, not a summary.

LLM-readable artifacts (`AGENTS.md`, `README.md`, `CHANGELOG.md`, skill bodies, agent personas, spec docs) stay structured. Use tables, headings, code blocks, explicit field references. Optimize for unambiguous retrieval.

## Code & Documentation Discipline

- **Code is a liability.** Add only what the task requires. No premature abstractions, no helpers for hypothetical reuse, no fallbacks for branches that can't happen, no commented-out alternatives.
- **No belt-and-suspenders.** Don't validate, null-check, or guard the same thing at multiple layers — pick one.
- **Delete dead code, don't comment it out.** Branch from the deletion commit if reversibility matters.
- **Comments only when the *why* is non-obvious.** No docstrings on self-evident params/returns. No banner/separator comments. Don't reference the current task or PR — that belongs in the commit message.
- **Markdown tables use compact `|---|` separators.** Never padded/aligned columns — column-width changes create huge diffs.
- **Surface, don't auto-fix.** A bug fix doesn't drag in surrounding cleanup. Mention spotted issues; don't sneak them into the diff.

## Package conventions

### Skills must stay generic

Skills in `skills/*/SKILL.md` are reusable across any pi consumer. Project-specific content (service names, file paths, verification commands, routing tables) is **forbidden** in skill bodies.

Every skill ends with a "Project overrides" block pointing to `.pi/superpowers-overrides.md`. Consumers add project-specific content there; skills read it at runtime.

Before committing skill edits, run:

```bash
rg -ni "<your-company>|jjuraszek|/Users/[^/]+|<your-org-name>" skills/
```

Replace the placeholders above with patterns specific to your fork — company names, your username paths, internal service names. Expected: zero matches. Linear/Jira/`script/worktree`-style references are OK as **examples** but never as canonical paths.

### Agents

Three agents ship in `agents/`: `implementer`, `code-reviewer`, `spec-reviewer`. Body text becomes the child's system prompt (`systemPromptMode: replace`).

Frontmatter knobs are **not overridable** at `subagent()` call time, so pick them carefully:

| Knob | implementer | code-reviewer | spec-reviewer |
|---|---|---|---|
| `tools` | `read, write, edit, bash, grep, find, ls` | `read, grep, find, ls, bash` | `read, grep, find, ls, bash` |
| `thinking` | `medium` | `high` | `high` |
| `defaultContext` | `fork` | `fresh` | `fresh` |
| `inheritProjectContext` | `true` | `true` | `true` |
| `inheritSkills` | `false` | `false` | `false` |
| `completionGuard` | `true` | `false` | `false` |

Rationale: reviewers are read-only and skeptical (fresh context, no edit tools, high thinking budget). Implementer continues the parent's session (fork) but doesn't need to recurse into skill discovery (inheritSkills: false avoids dispatch loops). `inheritProjectContext: true` lets agents adapt to the consumer's `AGENTS.md`.

If you must override at call site, the only callable knobs are `model`, `task`, `output`, `reads`, `progress`, `skill` — frontmatter wins for the rest.

### Extensions

All three extensions ship in `extensions/`:

| Extension | Configurable | Settings key |
|---|---|---|
| `plan-tracker.ts` | No | — |
| `phase-tracker.ts` | No | — |
| `verify-before-ship.ts` | Yes | `settings.json#piSuperpowers.verifyBeforeShip` (keys: `testCommands`, `warningReference`) |

Hardcoded project paths or commands in extensions are forbidden. If you add a new configurable behavior, surface it as a `piSuperpowers.<extensionName>` settings key with a sane default and document it in `README.md`.

## Development

### Local iteration

```bash
# In a consumer repo:
pi install -l ~/repos/pi-superpowers
cd ~/repos/pi-superpowers && npm run link-agents   # one-time per machine, symlinks agents/*.md into getAgentDir()/agents (default ~/.pi/agent/agents)
```

Edits in `~/repos/pi-superpowers/skills/` and `~/repos/pi-superpowers/extensions/` reload on next pi launch. Edits to `agents/*.md` are live via symlinks.

### Adding a skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`).
2. Body is generic workflow methodology. No project-specific paths or commands.
3. Append the standard "Project overrides" block at the end (copy from any existing skill).
4. Verify with the grep above.
5. Commit.

### Modifying an agent

1. Edit `agents/<name>.md`.
2. Re-read the knobs table above before changing frontmatter — most are not call-time overridable.
3. If the persona diverges materially from pi-subagents builtins, document why in the body.
4. Commit.

### Modifying an extension

1. Any new tunable must read from `settings.json#piSuperpowers.<extensionName>`.
2. Provide a sane default that works without configuration.
3. Update `README.md` with the new config key.
4. Commit.

## Release workflow

```bash
# Bump version in package.json + CHANGELOG.md
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

Consumers bump explicitly:

```bash
pi install -l git:github.com/jjuraszek/pi-superpowers@vX.Y.Z
```

Semver:
- **minor** — new skill, agent, or extension.
- **major** — skill/agent rename, breaking config schema change, extension API removal.

## Upstream inspiration

Last sync:

| Source | SHA | Date | Tag |
|---|---|---|---|
| `obra/superpowers` | `f2cbfbefebbf` | 2026-05-04 | v5.1.0 |
| `coctostan/pi-superpowers-plus` | `661d6cd0575b` | 2026-02-22 | v0.4.1 |

**Material divergence from obra v5.1.0:** upstream deleted their `agents/` directory in v5.1.0, merging `code-reviewer` into the `requesting-code-review` skill as a Task-dispatch template. We keep `agents/` because pi-subagents treats named agents as a first-class dispatch primitive (the `subagent({ agent: "code-reviewer" })` call in skills resolves to our profile, not a prompt template). Don't re-sync that change without considering pi-subagents semantics.

**Skills coverage:** we ship 13 of obra's 14 v5.1.0 skills. The missing one, `using-superpowers`, is a Claude-Code-specific bootstrap skill that forces invocation of the `Skill` tool; pi's discovery model surfaces skill descriptions in the system prompt automatically, so the bootstrap isn't needed.

Re-sync workflow: compare a fresh checkout of upstream against `skills/`, port worthwhile changes manually, bump the SHA above with date, note material changes in `CHANGELOG.md`. No subtree, no patch files — keep the divergence small and reviewed.

## Ground truth

When the source contradicts an assumption, the source wins:

- Pi runtime: `@earendil-works/pi-coding-agent` docs (`packages.md`, `skills.md`).
- Agent dispatch: `jjuraszek/pi-subagents` source (`src/agents/agents.ts`) and `skills/pi-subagents/SKILL.md`.
