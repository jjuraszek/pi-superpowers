---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

> **Related skills:** Test new skills with `/skill:test-driven-development` discipline. Verify they work with `/skill:verification-before-completion`.

# Writing Skills

## Overview

**Writing skills IS test-driven development applied to process documentation.**

Write a pressure scenario for a subagent, watch it fail (baseline), write the skill, watch tests pass (agent complies), then refactor to close loopholes.

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

**Violating the letter of the rules is violating the spirit of the rules.** This cuts off the entire class of "I'm following the spirit" rationalizations agents reach for under pressure — yours and the ones reading the skills you write.

**REQUIRED BACKGROUND:** Read `/skill:test-driven-development` first. This skill applies RED → GREEN → REFACTOR to documentation.

## Where Skills Live in Pi

Pi discovers skills from multiple roots (see `docs/skills.md` in `@earendil-works/pi-coding-agent` for the full list). The common ones:

| Path | Scope | Typical Use |
|---|---|---|
| `.pi/skills/<name>/SKILL.md` | Project, pi-only | Workflow methodology authored in-repo |
| `.agents/skills/<name>/SKILL.md` (any ancestor) | Cross-harness, project | Skills shared with Claude Code, Codex, etc. |
| `~/.pi/agent/skills/<name>/SKILL.md` | User-global, pi-only | Personal skills |
| `~/.agents/skills/<name>/SKILL.md` | User-global, cross-harness | Personal skills shared with other harnesses |
| Installed packages (`skills/` dir, `pi.skills` in `package.json`) | Package-scoped | Reusable skill libraries like `pi-superpowers` |

Each skill directory contains:
```
SKILL.md              # required entry point
reference/            # optional progressive-disclosure files
  <topic>.md          # read directly when SKILL.md points at it
<supporting>.md       # prompt templates, examples
```

`reference/` is the pi pattern for keeping SKILL.md tight while still shipping deep guidance. See `.pi/skills/test-driven-development/reference/` and `.pi/skills/systematic-debugging/reference/` for working examples.

### Reference Files Bundled With This Skill

Read directly when SKILL.md tells you to (path is given inline). The progressive-disclosure pattern is *which file to read when*, not a special tool:

| Topic | File | When to load |
|-------|------|--------------|
| `writing-skills-anthropic-best-practices` | `reference/anthropic-best-practices.md` | Anthropic's canonical guide to authoring SKILL.md — concision, degrees of freedom, progressive disclosure, evaluation-driven development. Read when designing a skill from scratch or restructuring an existing one. |
| `writing-skills-persuasion` | `reference/persuasion.md` | Cialdini's seven principles applied to skill design. Read when authoring a discipline-enforcing skill that must hold up under pressure. Cites Meincke et al. (2025): N=28,000 LLM conversations, compliance 33% → 72% with persuasion techniques. |
| `writing-skills-testing-with-subagents` | `reference/testing-skills-with-subagents.md` | RED-GREEN-REFACTOR for skills: pressure scenarios, rationalization tables, meta-testing, bulletproofing checklist. Read before running baseline scenarios via the `subagent` tool. |

## When to Create a Skill

**Create when:**
- The technique was not obvious to you the first time
- You will reference it across projects or services
- The pattern is broad (not tied to one file or feature)
- Other agents would benefit

**Don't create for:**
- One-off solutions
- Standard practices documented elsewhere
- Project-specific conventions (use `AGENTS.md` or a service-level `doc/`)
- Mechanically enforceable rules at ship time (use the `verify-before-ship` extension from `pi-superpowers` — runtime enforcement beats documentation). Note: only ship-command verification is mechanised today; TDD, debug, and phase enforcement are skill-only.

## SKILL.md Structure

**Frontmatter (YAML):**

```yaml
---
name: skill-name-with-hyphens
description: Use when <specific triggering conditions and symptoms>
---
```

- `name`: letters, numbers, hyphens only.
- `description`: third-person, ONLY describes when to use, NOT what the skill does.
  - Start with "Use when…"
  - Include symptoms, situations, contexts
  - **Never summarize the skill's workflow** (see CSO section below for why)
  - Aim for under 500 characters; max 1024 for full frontmatter

**Body skeleton:**

```markdown
> **Related skills:** <pointers to skills the user should run before/after/with this one>

# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## Boundaries
- Reads: <what files/state this skill touches read-only>
- Writes: <what it writes>
- Does NOT: <explicit no-touch list>

## When to Use
Bullet list of symptoms. When NOT to use.

## The Process / Core Pattern
Numbered steps OR before/after comparison.

## Quick Reference
Table or bullets for scanning common operations.

## Common Mistakes
What goes wrong + fixes.

## Red Flags
Phrases/situations that mean STOP and reconsider.
```

## Claude Search Optimization (CSO)

The harness reads `description` to decide which skills to load. Optimize for "should I read this skill right now?".

**Description = trigger, NOT summary.**

```yaml
# ❌ BAD: summarizes workflow — agent may follow this instead of reading the skill
description: Use when executing plans — dispatches subagent per task with code review between tasks

# ❌ BAD: process detail
description: Use for TDD — write test first, watch it fail, write minimal code, refactor

# ✅ GOOD: trigger only
description: Use when executing implementation plans with independent tasks in the current session

# ✅ GOOD: trigger only
description: Use when implementing any feature or bugfix, before writing implementation code
```

**Why this matters:** When a description summarizes the workflow, the agent treats it as a shortcut and skips the skill body. Testing showed a description that said "code review between tasks" caused agents to do ONE review even though the skill body specified TWO. Changing the description to a pure trigger fixed the compliance.

**Keyword coverage:** use the words an agent would search for — error messages ("ENOTEMPTY", "race condition"), symptoms ("flaky", "hanging"), tool names, file types.

**Naming:** active voice, verb-first.
- ✅ `creating-skills`, not `skill-creation`
- ✅ `condition-based-waiting`, not `async-test-helpers`
- ✅ `root-cause-tracing`, not `debugging-techniques`

## Cross-References

Use skill name with explicit requirement markers. **Never** force-load with `@` syntax — that burns context before the file is needed.

- ✅ `**REQUIRED SUB-SKILL:** Use /skill:test-driven-development`
- ✅ `**REQUIRED BACKGROUND:** You MUST understand /skill:systematic-debugging`
- ✅ `> **Related skills:** Pair with /skill:verification-before-completion`
- ❌ `@.pi/skills/test-driven-development/SKILL.md`

## Token Efficiency

`description` is loaded into every conversation. `SKILL.md` is loaded when the agent decides to read it. `reference/*.md` is loaded only when SKILL.md instructs the agent to read a specific file.

**Targets:**
- Frequently-loaded skills: <250 lines
- Specialized skills: <500 lines
- Anything beyond: split into `reference/` files

**Techniques:**
- **Move deep content to `reference/`** — like `.pi/skills/test-driven-development/reference/{rationalizations,examples,when-stuck}.md`. SKILL.md mentions them; agent loads them on demand.
- **Cross-reference, don't duplicate.** Point to other skills rather than restating.
- **Compress examples.** One clear example beats three.
- **Skip the obvious.** Pi agents already know git, ripgrep, mise; don't explain.

Verify:
```bash
wc -l .pi/skills/<name>/SKILL.md
```

## Pi Tooling References

If a skill leans on pi capabilities, name them explicitly:

| Capability | How to reference it |
|---|---|
| Plan/phase persistence | `plan_tracker` tool (provided by the `pi-superpowers` package's `plan-tracker` extension) |
| Progressive disclosure | Direct `read` of `reference/<topic>.md` paths named inline in SKILL.md |
| Runtime enforcement | `verify-before-ship` extension from `pi-superpowers` (advisory warning before `git commit` / `git push` / `gh pr create` when no canonical verification command has succeeded since the last source edit) |
| Subagent dispatch | `subagent` tool from `pi-subagents`; baseline subagents from `pi-superpowers` are `implementer`, `code-reviewer`, `spec-reviewer`. Consumer repos can add project-specific subagents under `.pi/agents/`. |

Don't invent capabilities. Don't reference Claude Code's `Task` tool, OpenCode hooks, or Codex `spawn_agent` unless the skill is explicitly for that harness.

## The Iron Law (Same as TDD)

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

Applies to new skills AND edits to existing skills.

Wrote a skill before testing it? Delete it. Start over.
Edited a skill without testing? Same violation.

**No exceptions:**
- Not for "simple additions"
- Not for "just adding a section"
- Not for "documentation updates"
- Don't keep untested changes as "reference"
- Don't "adapt" while running tests
- Delete means delete

## Bulletproofing Skills Against Rationalization

Discipline-enforcing skills (like TDD, verification-before-completion) have to survive a reader under pressure. The reader will look for loopholes. Your job is to close them in the skill before they have to be re-closed in production.

Read `.pi/skills/writing-skills/reference/persuasion.md` for the research foundation: Cialdini's seven principles plus Meincke et al. (2025), which measured LLM compliance climbing from 33% to 72% when persuasion techniques were applied to disciplinary prompts. The techniques below operationalize that research.

### Close every loophole explicitly

Don't just state the rule — forbid the specific workaround.

**Bad:**
```markdown
Write code before test? Delete it.
```

**Good:**
```markdown
Write code before test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete
```

### Anchor the Spirit vs Letter principle early

State once, near the top:

```markdown
**Violating the letter of the rules is violating the spirit of the rules.**
```

This sentence is doing real work. Without it, "I'm following the spirit" becomes the universal jailbreak for every other rule in the skill.

### Build the rationalization table from real baselines

Every excuse a baseline subagent gave goes in a two-column table. Don't invent rationalizations; harvest them.

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
```

### Provide a Red Flags self-check list

Agents under pressure rarely catch themselves on principle. They catch themselves on pattern recognition. Give them the patterns:

```markdown
## Red Flags — STOP and Start Over

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "This is different because…"

**All of these mean: Delete code. Start over with TDD.**
```

### Common rationalizations for skipping skill testing

The meta-form of every other rationalization table. Keep handy when *writing* a skill, because skipping the baseline-scenario step is the original sin that produces everything else.

| Excuse | Reality |
|--------|---------|
| "Skill is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "It's just a reference" | References have gaps. Test retrieval. |
| "Testing is overkill" | Untested skills have issues. Always. 15 min testing saves hours. |
| "I'll test if problems emerge" | Problems = agents can't use the skill in production. Test before deploying. |
| "Too tedious to test" | Less tedious than debugging the bad skill in production. |
| "I'm confident it's good" | Overconfidence guarantees issues. Test anyway. |
| "Academic review is enough" | Reading ≠ using. Test application scenarios. |
| "No time to test" | Deploying untested = fixing untested later. |

**All of these mean: Test before deploying. No exceptions.**

### Update the description with violation symptoms

The description fires when an agent is *about* to violate the rule the skill enforces. Symptoms in the trigger > workflow summary.

## RED-GREEN-REFACTOR for Skills

### RED — Watch the baseline fail

Pick a pressure scenario where you predict the agent will get it wrong without the skill. Run it via the `subagent` tool against a fresh-context worker. Capture verbatim:

- What choices did the subagent make?
- What rationalizations did it use?
- Which pressures triggered the violation?

```ts
subagent({
  agent: "worker",
  context: "fresh",
  task: "<scenario prompt that creates the pressure>"
})
```

### GREEN — Write the minimal skill

Address those specific rationalizations. Don't add content for hypothetical cases.

Re-run the same scenario. Subagent should now comply.

### REFACTOR — Close loopholes

Agent found a new rationalization? Add an explicit counter. Re-test.

Build the rationalization table from each iteration:

```markdown
| Excuse | Reality |
|---|---|
| "Too simple to test" | Simple code breaks. The test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "I'm following the spirit" | Violating the letter of the rules is violating the spirit. |
```

Add a Red Flags list so agents can self-check:

```markdown
## Red Flags — STOP

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
```

## Skill Types and How to Test Each

| Type | Examples | Test with | Success |
|---|---|---|---|
| **Discipline-enforcing** | TDD, verification-before-completion | Pressure scenarios (time + sunk cost + exhaustion) | Agent follows rule under pressure |
| **Technique** | condition-based-waiting, root-cause-tracing | Application + variation + missing-info scenarios | Agent applies correctly to new case |
| **Pattern** | reducing-complexity | Recognition + application + counter-example scenarios | Agent recognizes when/when-not to apply |
| **Reference** | API docs, library guides | Retrieval + application + gap scenarios | Agent finds and uses information |

## Skill Creation Checklist

Use `plan_tracker` to create tasks for each item:

**RED — Failing Test**
- [ ] Create pressure scenarios (3+ combined pressures for discipline skills)
- [ ] Run scenarios WITHOUT the skill — document baseline verbatim
- [ ] Identify patterns in rationalizations / failures

**GREEN — Minimal Skill**
- [ ] Name: letters, numbers, hyphens only
- [ ] Frontmatter has `name` and `description` (max 1024 chars total)
- [ ] Description starts with "Use when…", trigger only, no workflow
- [ ] Keywords for search (errors, symptoms, tools, file types)
- [ ] Overview + Boundaries + The Process sections
- [ ] One excellent example (not multi-language)
- [ ] Re-run scenarios WITH skill — verify compliance

**REFACTOR — Close Loopholes**
- [ ] Identify new rationalizations from testing
- [ ] Add explicit counters (discipline skills)
- [ ] Build rationalization table
- [ ] Add Red Flags list
- [ ] Re-test until bulletproof

**Pi-specific**
- [ ] If discipline skill *and* the rule is mechanically detectable at a tool boundary: consider an `extensions/*.ts` hook (high bar — runtime hooks are deliberately slim; only add ones that beat false-positive heuristics)
- [ ] If skill has >500 lines: split deep content into `reference/<topic>.md` and instruct the agent to read the specific file inline
- [ ] Skill location: project-scoped lives under `.pi/skills/`; cross-harness skills shared with Claude Code under `.agents/skills/`; reusable workflow skills belong in a package like `pi-superpowers`
- [ ] Update routing: link from `AGENTS.md` if cross-cutting

**Deployment**
- [ ] Commit skill to git
- [ ] If broadly useful: consider upstream PR to `obra/superpowers`

## STOP Before Moving to the Next Skill

After writing any skill, complete its deployment checklist before starting another one.

Do **not** batch-create skills without testing each. Do **not** move on because "the next one is small." Deploying an untested skill is deploying untested code; the framework's whole leverage is that the discipline survives, and the discipline doesn't survive a batch.

## Anti-Patterns

**Narrative example** — "In session 2025-10-03, we found …"
Too specific. Not reusable. Cut it.

**Multi-language dilution** — `example.js`, `example.py`, `example.go`
Maintenance burden, mediocre quality. Pick one language that best illustrates the pattern.

**Code in flowcharts** — DOT graphs with `step1 [label="import fs"]`
Can't copy-paste. Use markdown code blocks.

**Generic labels** — `helper1`, `step3`, `pattern4`
Labels should carry semantic meaning.

**Documentation that mechanizes** — if it's enforceable with a regex, lint rule, or `verify-before-ship` hook at a tool boundary, automate it. Don't waste skill tokens on rules a deterministic check can enforce.

## Red Flags — STOP

- Wrote a skill without running a baseline scenario first
- Edited a skill without re-running the relevant baseline
- Description starts with "This skill does…" (summary instead of trigger)
- Code-then-test ordering in the skill body
- Force-loading other skills with `@`
- SKILL.md over 500 lines with no `reference/` split
- Referencing tools that don't exist in pi (Claude Code's `Task`, OpenCode hooks, etc.) for a pi-scope skill
- About to ship multiple skills in a batch without testing each
- "I'll test it later" — that means never
- "It's about spirit, not ritual" — that's the rationalization the skill exists to defeat

## The Bottom Line

Creating skills IS TDD for process documentation. Same Iron Law. Same cycle. Same benefits.

RED (baseline) → GREEN (skill) → REFACTOR (close loopholes).

If you follow TDD for code, follow it for skills.

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
