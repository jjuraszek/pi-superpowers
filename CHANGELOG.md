# Changelog

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
