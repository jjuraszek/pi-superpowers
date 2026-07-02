# Spec: spec council ("roasting the spec")

## Context

`/skill:brainstorming` currently ends a spec with two checks: an inline self-review pass, then a user review gate. The author (the parent agent) verifies its own spec alone; cross-model verification is ad-hoc and manual.

This adds an **optional, per-preset-configured** multi-model critique pass that runs after self-review and before the user gate. The core mechanic: N members, each a **different model**, critique the spec in parallel for divergent angles; a neutral **chair** consolidates and **adjudicates** their disagreements; the parent proposes dispositions; the **user** is the final jury.

The council is invisible unless configured. With no `piGauntlet.specCouncil` in the active preset's settings, brainstorming behaves exactly as it does today.

## Scope

| Item | Path | Action |
|---|---|---|
| Council skill | `skills/roasting-the-spec/SKILL.md` | add |
| Member agent | `agents/spec-council-member.md` | add |
| Chair agent | `agents/spec-council-synthesizer.md` | add |
| Brainstorming hook | `skills/brainstorming/SKILL.md` | edit (one line at the verification step) |
| Knobs table + agent count | `AGENTS.md` | edit (two knobs-table columns, "Three agents"→"Five", council rationale) |
| Counts + persona list + config | `README.md` | edit (skills 13→14, personas 3→5, install "three agent files"→five, config key) |
| Changelog | `CHANGELOG.md` | edit |
| Roster (consumer) | each preset's `settings.json` | not committed — lives in the consumer's pi dirs |

## Non-goals

- **No new extension.** Gating, fanout, and apply are all prompt-level; the skill reads settings directly. No `.ts`.
- **No auto re-roast loop.** Single pass. The user re-invokes manually if they want another round after edits.
- **No prompt-level diversity.** Members share one prompt; diversity comes from heterogeneous *models*, not per-member lenses.
- **No JSON `outputSchema`.** Member/chair outputs are fixed markdown templates (survives heterogeneous models, human-readable at the gate).
- **No base-settings inheritance.** Rosters are per-preset by design; the skill reads the active preset's `settings.json`, not a merged view.
- **Not generalized to plans/designs yet.** Scoped to specs. The skill is named for that. Generalizing later is a deliberate, separately-versioned change.
- **No model identifiers in the skill body.** Models come only from config (keeps the skill generic per repo rules).

---

## Separation of powers

The design exists to avoid one agent being judge and jury over its own spec.

| Role | Who | Authority | Bias control |
|---|---|---|---|
| Witnesses | N `spec-council-member`, one per roster model | Independent critique only | Fresh context, heterogeneous models |
| Judge of testimony | `spec-council-synthesizer` (chair) | Consolidates; **final say on member-vs-member conflicts** | Fresh context — never saw the spec being written |
| Advocate | parent (brainstorming loop) | Proposes `apply`/`defer`/`reject` per finding, on scope/intent grounds | Cannot suppress findings — chair output is an independent artifact |
| Jury | user | Final approval of what gets applied | Owns the existing brainstorming review gate |

The chair adjudicates *between members* (whose argument is stronger), not in defense of the spec. The parent decides *whether to apply* on scope grounds. The user decides *what actually lands*. No single actor both critiques and ratifies.

## Identifiers & file layout

| Kind | Identifier |
|---|---|
| Skill name | `roasting-the-spec` |
| Skill dir | `skills/roasting-the-spec/SKILL.md` |
| Member agent | `spec-council-member` (`agents/spec-council-member.md`) |
| Chair agent | `spec-council-synthesizer` (`agents/spec-council-synthesizer.md`) |
| Config key | `piGauntlet.specCouncil` |
| Member output file | `<tmpdir>/member-<i>-<model-slug>.md` — absolute path from `mktemp -d`, outside the worktree, removed after apply |

`spec-council-member` sits next to the existing `spec-reviewer` deliberately — they are different jobs: `spec-reviewer` checks an implementation against a spec; `spec-council-member` critiques the spec's own quality.

## Configuration: `piGauntlet.specCouncil`

Lives in each preset's `settings.json` (e.g. `~/.pi/agent.anthropic/settings.json`, `~/.pi/agent.bedrock/settings.json`). Mirrors the existing `piGauntlet.verifyBeforeShip` pattern.

```jsonc
{
  "piGauntlet": {
    "specCouncil": {
      "members": ["<provider/model>", "<provider/model>", "<provider/model>"],
      "chair": "<provider/model>"
    }
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `members` | `string[]` of `provider/model` | yes | The roster. Council size = array length. Each entry = one member, run under that model. |
| `chair` | `string` (`provider/model`) | no | Model for the synthesizer. Defaults to the parent's inherited model when omitted. |

**Gating / detection.** The skill instructs the parent to read `$PI_CODING_AGENT_DIR/settings.json` (active preset) and inspect `piGauntlet.specCouncil.members` by reading the file directly (no brittle `jq`/`python` parse — settings may be JSONC).

- `members` absent / empty / not an array → treat as **unconfigured**: the council is never mentioned, brainstorming proceeds unchanged. Malformed config emits one warning line, then is treated as unconfigured.
- `members` non-empty → the council is **offered** (single y/n prompt). Each preset's roster diverges naturally because each owns its own `settings.json`.

`agentOverrides` (single-agent model/thinking) is the wrong home — it cannot hold a roster or a chair list. `piGauntlet.specCouncil` is the canonical location.

---

## Agent: `spec-council-member`

### Frontmatter

```yaml
name: spec-council-member
description: <one-line: adversarial single-model spec critic, dispatched by roasting-the-spec>
tools: read, grep, find, ls, bash
thinking: xhigh
defaultContext: fresh
inheritProjectContext: true
inheritSkills: false
completionGuard: false
systemPromptMode: replace
```

No `model:` field — the model is injected per task from the roster. `xhigh` maps to max on Anthropic and high elsewhere (pi reasoning levels: `off|minimal|low|medium|high|xhigh`). Read-only (no `write`/`edit`); `bash` is for inspecting the codebase to check the spec's claims against reality.

### Responsibilities

Adversarial spec critic. Reads the spec and the problem statement, then assesses five axes:

1. **Addresses the problem?** Does the spec actually solve the problem in the description? (`yes` / `partial` / `no` + why)
2. **Logical gaps** — missing steps, unhandled states, hand-waved transitions.
3. **Oversimplifications** — places the spec assumes away real complexity.
4. **Ambiguities** — unnamed components, undefined terms, "we should" without a decision.
5. **Actionable & testable?** — could an implementer build and verify this without further guessing?

### Output contract (fixed markdown)

```
verdict: sound | needs-work | unsound
addresses-problem: yes | partial | no — <why>
findings:
- [blocker|major|minor] <kind> @ <section or quote> — <problem> → <suggested edit>
- ...
```

`<kind>` ∈ `gap | oversimplification | ambiguity | scope | not-actionable | other`. Empty `findings` is valid (spec is sound). `verdict` must stay consistent with `addresses-problem`: `no` forces `unsound`; `partial` rules out `sound`; a `partial`/`no` answer must carry at least one finding naming the gap.

## Agent: `spec-council-synthesizer` (chair)

### Frontmatter

```yaml
name: spec-council-synthesizer
description: <one-line: neutral chair that consolidates and adjudicates council member critiques>
tools: read, grep, find, ls, bash
thinking: xhigh
defaultContext: fresh
inheritProjectContext: true
inheritSkills: false
completionGuard: false
systemPromptMode: replace
```

`thinking: xhigh` — compiling N divergent critiques and resolving their contradictions is as reasoning-heavy as the critique itself, so the chair matches the members' budget. `model:` injected per task (`chair` config, else inherited). Fresh context is load-bearing: the chair never saw the spec authored, so it weighs the members' testimony, not the spec's defense.

### Responsibilities

Reads the N member files + the spec + the problem statement. Then:

- **Consolidate** — dedupe overlapping findings, cluster by theme, rank by severity, record how many members raised each cluster. A member's `findings` may be empty or absent (it judged the spec sound) — count that as no findings from that member, not an error.
- **Adjudicate (primary job)** — where members **disagree**, weigh each side's argument and **decide** (favor verifiable evidence over assertion; weigh severity × likelihood). Fold the winning position into a single suggested edit. Do **not** hand the quarrel to the user.
- Keep a compact one-line audit note per resolved conflict so the user can spot-check the call without reading the debate.

### Output contract (fixed markdown)

```
consensus: <overall verdict> — <N/M members flagged blockers, etc.>
clusters:
- [severity] <theme> — raised-by: [modelA, modelB] — <finding> → <suggested edit>
- ...
resolved:
- <contested point> → sided with <position> (<one-clause why>)
- ...
```

`clusters` are all pre-resolved — no raw `contradictions` list is emitted. `raised-by` is attributed from the model slug in each member's filename. When every member returned empty findings, emit `clusters:` with no bullets and `consensus: sound — no findings`. `resolved` is a header with no bullets when members did not conflict.

---

## Skill: `roasting-the-spec` — orchestration

All steps are parent-driven (the parent owns orchestration; members and chair do not recurse). Runs **after** brainstorming's Spec Self-Review, **before** its User Review Gate.

**1 — Gate (silent unless configured).** Read `$PI_CODING_AGENT_DIR/settings.json`; inspect `piGauntlet.specCouncil.members`. Unconfigured → return silently. Configured → ask once:

> "Spec council configured (3: opus-4-1, gemini-3-pro, gpt-5.1). Roast the spec? (y/n)"

Decline (`n`) → return to the normal gate. Accept (`y`) → continue.

**2 — Fanout (one member per model).** The parent first creates an absolute temp dir **outside** the worktree, then dispatches parallel, fresh, read-only members that each write their markdown there. The parent does **not** ingest these.

```
D=$(mktemp -d)   # absolute, e.g. /tmp/tmp.XXXX — never inside the repo

subagent({ tasks: members.map((m, i) => ({
  agent: "spec-council-member",
  model: m,
  task: "<problem statement inline>. Read the spec at <spec path>. Emit the member template.",
  output: D + "/member-" + i + "-" + slug(m) + ".md"   // absolute → never tracked by git
})) })
```

> `slug(m)` replaces `/` and other non-alphanumerics with `-` (`provider/model` → `provider-model`), and the chair recovers it from the filename for attribution. Relative `output:` paths in parallel-`tasks` mode resolve against cwd (the worktree) and would be committed; the absolute `mktemp -d` keeps member files out of the tree. (Chain mode exposes `{chain_dir}` as an auto-cleaned alternative; the skill takes the explicit `mktemp` path so step-6 cleanup is unambiguous.)

**3 — Synthesis + adjudication.** Parent ingests **only** the chair's consolidated output → lean context.

```
subagent({
  agent: "spec-council-synthesizer",
  model: chair ?? inherited,
  reads: [the N files under $D],
  task: "Consolidate and adjudicate vs the spec at <spec path> and the problem statement."
})
```

**4 — Propose (parent = advocate).** For each cluster: `apply` (+ the concrete edit) / `defer` (out of scope, named) / `reject` (+ one-line rationale).

**5 — User gate (jury).** Present the chair's clusters, the `resolved` audit notes, and the proposed dispositions. User approves or adjusts.

**6 — Apply.** Parent edits the spec in `doc/specs/`, re-runs the brainstorming placeholder scan, removes the temp dir (`rm -rf "$D"`), then the normal commit. Member files lived only under `$D` (outside the worktree), so nothing council-related is ever staged.

## Brainstorming integration

In `skills/brainstorming/SKILL.md`, at the Spec Self-Review → User Review Gate boundary, add one line (kept minimal to preserve a legible diff against obra upstream):

> After self-review, if a spec council is configured (`piGauntlet.specCouncil`), offer it before the user gate — see `/skill:roasting-the-spec`. Approved edits land in the same worktree spec commit.

No other brainstorming changes.

## Error & edge cases

| Case | Behavior |
|---|---|
| Roster model unreachable in active preset | Skip that member; proceed if ≥1 succeeded; name failed models in the gate summary |
| **All** members fail | Abort council, warn, fall back to normal user gate |
| Malformed `specCouncil` (members missing/empty/not-array) | Treat as unconfigured (silent skip) + one warning line; never crash brainstorming |
| `chair` unreachable | Fall back to inherited model for the synthesizer (+ warn) |
| Single-model roster | Valid (1 member + chair); degenerate but allowed |
| No actionable findings | Chair reports consensus `sound`; parent proposes zero edits; gate proceeds with "council found no blockers" |
| Members disagree | Chair adjudicates and resolves; never surfaced as a raw quarrel |
| User declines (`n`) | Skip entirely → normal gate |
| Member files | Written under an absolute `mktemp -d` dir outside the worktree; removed after apply; never staged |

## Testing & verification

No automated harness exists for prompt-level skills/agents (markdown), and this feature adds no `.ts`. Verification is dogfood + lint:

- **Manual scenarios.** (a) config absent → zero council mention; (b) configured + decline → skip; (c) configured + accept → N members spawn under the correct per-model assignment, chair consolidates + adjudicates, gate shows dispositions, approved edits apply; (d) one bogus roster model → graceful skip + warning; (e) deliberately contradictory members → chair resolves, no quarrel surfaced.
- **Generic-ness lint** (repo rule): `rg -ni "<company>|/Users/[^/]+|<model-names>" skills/roasting-the-spec/` → zero matches. Models/paths come only from config, never the skill body.
- **Frontmatter validity.** Both agents parse; `thinking` is `xhigh` for both (member for breadth of critique, chair for adjudication).
- **Docs.** `AGENTS.md` knobs table carries both agents and reads "Five agents"; `README.md` documents `piGauntlet.specCouncil`, skills count is 14, personas count is 5 (intro + install mechanics); `CHANGELOG.md` notes the new skill + agents (minor bump).

## Implementation checklist

1. `agents/spec-council-member.md` — frontmatter + adversarial-critic system prompt + output template.
2. `agents/spec-council-synthesizer.md` — frontmatter + consolidate/adjudicate system prompt + output template.
3. `skills/roasting-the-spec/SKILL.md` — the 6-step recipe; generic body; standard "Project overrides" trailer.
4. `skills/brainstorming/SKILL.md` — one-line hook.
5. `AGENTS.md` — "Three agents ship"→"Five"; two new knobs-table columns (both `xhigh`, read-only, `fresh`); rationale line (model injected per task, dispatched by `roasting-the-spec`); note `roasting-the-spec` is original (not obra-synced), so the "13 of obra's 14" coverage line stays accurate.
6. `README.md` — skills `13`→`14` (+ `roasting-the-spec` in the Design & planning bullet); personas `3`→`5` (+ two bullets); install-mechanics "three agent files"/"three personas" → five (≈ lines 53–56, 106); document `piGauntlet.specCouncil`.
7. `CHANGELOG.md` — entry (minor bump: new skill + two agents).
