# pi-superpowers

Workflow skills, agent personas, and extensions for the pi coding agent. Generic by design — project-specific content lives in consumer repos via `.pi/superpowers-overrides.md`.

## Communication Style

Applies to humans and agents — chat, PR descriptions, issue comments, commit messages.

### Suppress process narration

Do NOT output:

- Intent classification ("I detect X intent", "My approach…").
- Phase/routing announcements before acting.
- Subagent/tool invocation preamble ("I'll delegate this…", "Let me start by…") — just fire it.
- Status narration ("I'm working on…", "Now I'll…").
- Preamble pleasantries.
- Restating what was just done — the diff speaks for itself.

### Output instead

- **Outcomes**: what changed, what was found.
- **Decisions needing user input**: ambiguities, options.
- **Verification results**: test/build output, errors.
- **Blockers**: failures or decisions required to proceed.

Bullets over prose. Short paragraphs. No wall-of-text. End on the ask, not a summary.

### LLM-readable artifacts stay structured

`AGENTS.md`, `README.md`, `CHANGELOG.md`, skill bodies, agent personas, doc/ specs — these are written for future LLMs to parse, not casual reading. Use tables, headings, code blocks, explicit field references. Optimize for unambiguous retrieval.

## Code & Documentation Discipline

- **Code is a liability.** Every line is something to maintain. Add only what the task requires. No premature abstractions, no helpers for hypothetical reuse, no fallbacks for branches that can't happen, no commented-out alternatives.
- **No belt-and-suspenders.** Don't validate, null-check, or guard the same thing at multiple layers — pick one. Defensive duplicate checks are tech debt.
- **Delete dead code, don't comment it out.** Branch from the deletion commit if reversibility matters. Commented-out code rots and misleads.
- **Comments only when the *why* is non-obvious** — hidden constraint, subtle invariant, surprising workaround. Don't restate the code. No docstrings on self-evident params/returns. No banner/separator comments. Don't reference the current task or PR — that belongs in the commit message.
- **Markdown tables use compact separators.** Always `|---|`. Never padded/aligned columns — they create huge diffs on column-width changes.
- **Surface, don't auto-fix.** A bug fix doesn't drag in surrounding cleanup. A one-shot operation doesn't grow a helper. If you spot something else worth doing, mention it — don't sneak it into the diff.

## Package conventions

### Skills must stay generic

Skills in `skills/*/SKILL.md` are reusable across any pi consumer. Project-specific content (service names, file paths, verification commands, routing tables) is **forbidden** in skill bodies.

Every skill ends with a "Project overrides" block pointing to `.pi/superpowers-overrides.md`. Consumers add project-specific content there; skills read it at runtime.

When editing a skill, run before committing:

```bash
rg -n "gridstrong|dashboard|rule-bot|excavation|librarian|runner/|script/worktree|script/ci|bin/rspec|mise x|specific.company.name" skills/
```

Expected: zero matches.

### Agents are read-only contracts

Three agents ship in `agents/`: `implementer`, `code-reviewer`, `spec-reviewer`. Frontmatter knobs (`tools`, `thinking`, `defaultContext`, `inheritProjectContext`, `inheritSkills`, `systemPromptMode`) are **not overridable** at `subagent()` call time. Picking these correctly matters.

| Knob | Notes |
|---|---|
| `tools` | Read-only reviewers omit `edit, write`. Implementers include them. |
| `thinking` | `high` for reviewers; `medium` for implementer (TDD discipline is explicit, not budget-driven). |
| `defaultContext` | `fresh` for reviewers (avoid confirmation bias). `fork` for implementer continuing parent's session. |
| `inheritProjectContext` | `true` for all three — agents adapt to consumer's `AGENTS.md`. |
| `inheritSkills` | `false` typically (prevents recursive skill discovery in subagents). |

Body text is the child's system prompt (`--system-prompt` or `--append-system-prompt`). Cache-friendly across multi-turn. Keep concise.

### Extensions are configurable

Both `extensions/plan-tracker.ts` and `extensions/verify-before-ship.ts` accept config via `settings.json#piSuperpowers.<extensionName>`. Hardcoded project paths or commands are forbidden — surface them as config keys with sane defaults.

## Development

### Local iteration

```bash
# In a consumer repo:
pi install -l ~/repos/pi-superpowers
cd ~/repos/pi-superpowers && npm run link-agents   # one-time per machine
```

Edits in `~/repos/pi-superpowers/skills/` and `~/repos/pi-superpowers/extensions/` reload on next pi launch. Edits to `agents/*.md` are live via symlinks.

### Adding a skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`).
2. Body is generic workflow methodology. No project-specific paths or commands.
3. Append the standard "Project overrides" block at the end.
4. Verify with the grep above.
5. Commit.

### Modifying an agent

1. Edit `agents/<name>.md`.
2. Re-read the "Knobs" table above before changing frontmatter — most are not call-time overridable.
3. If the persona diverges materially from pi-subagents builtins, document why in the body comment.
4. Commit.

### Modifying an extension

1. New configurable behavior must read from `settings.json#piSuperpowers.<extensionName>`.
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

Semver: bump **minor** on new skill/agent/extension; bump **major** if skill/agent rename, breaking config schema change, or extension API removal.

## Upstream inspiration

Last sync from upstream sources:

- `obra/superpowers` @ `f2cbfbefebbf` — 2026-05-04 (Release v5.1.0)
- `coctostan/pi-superpowers-plus` @ `661d6cd0575b` — 2026-02-22 (v0.4.1)

Re-sync workflow: compare a fresh checkout of upstream against `skills/`, port worthwhile changes manually, bump the SHA above with date, note material changes in `CHANGELOG.md`. No subtree, no patch files — keep the divergence small and reviewed.

## Ground truth

Source-of-truth for behavior questions:

- Pi runtime: `@earendil-works/pi-coding-agent` docs (`packages.md`, `skills.md`).
- Agent dispatch: `jjuraszek/pi-subagents` source (`src/agents/agents.ts`).
- When the source contradicts an assumption, the source wins. Don't fabricate.
