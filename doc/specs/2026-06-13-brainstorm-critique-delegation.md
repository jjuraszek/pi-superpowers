# Brainstorming self-review: split lint from critique, auto-dispatch the critique

## Context

`skills/brainstorming/SKILL.md` runs its entire flow at the main-loop model (Opus). The
goal is to keep the *interactive* loop (clarifying questions, approach exploration, design
validation, the user review gate) at Opus while pushing the non-interactive, fresh-eyes
work off the main loop.

The spec self-review (current checklist item 8, section "Spec Self-Review") is the
candidate. It currently runs four checks inline at Opus:

- Placeholder scan
- Internal consistency
- Scope check
- Ambiguity check

and auto-applies fixes ("Fix what self-review surfaces before handing to the user").

Separately, the spec council (`skills/roasting-the-spec/SKILL.md`, checklist item 9) is
*offered* as a numbered choice when configured. So today the two passes are inconsistent:
self-review is automatic, the council is opt-in per spec.

`brainstorming/SKILL.md` is tracked against the obra/superpowers ancestor; its diff must
stay minimal and legible for re-sync. `roasting-the-spec` is an original skill (no obra
ancestor) and may be edited freely.

## Decisions

1. **Split self-review into lint vs critique.**
   - **Lint** = placeholder scan + internal consistency. Mechanical, deterministic, no
     fresh-eyes benefit. Stays **inline at Opus**, unchanged.
   - **Critique** = scope + ambiguity. Judgment, benefits from an independent reader.
     **Delegated**, never run inline.

2. **The critique is auto-dispatched (no offer), selected by config:**
   - Spec council configured (`piGauntlet.specCouncil.members` non-empty) → the council
     **is** the critique pass; invoke `/skill:roasting-the-spec` automatically.
   - Otherwise → dispatch **one fresh `worker`** with a plain critique brief. No chair, no
     fan-out, no council machinery, no `spec-council-member`. The "poor man's council" is a
     single generic subagent reading the spec cold.

3. **The fresh worker auto-applies its findings**, lifting the directives verbatim from the
   current scope/ambiguity checks. This matches today's self-review semantics (fixes are
   applied in place; the user gate is the backstop). The council path keeps its existing
   propose-then-gate semantics. The asymmetry is intentional — each path preserves its
   current behavior. The worker edits **only** the spec under `doc/specs/` (`agents/worker.md`
   already ships `edit`/`write`); this does not breach brainstorming's HARD CONSTRAINT, which
   permits writes to `doc/specs/`. The placeholder re-scan + user gate are the backstop.

4. **The fallback worker's model is not the skill's concern — documentation only.** `worker`
   is a pi-cohort agent; its model resolves from `subagents.agentOverrides.worker.model`
   in `settings.json`. Unset → it inherits the main-loop model. The skill dispatches `worker`
   with **no `model:` param** and does not invent config; it only documents this resolution.
   Fresh context isolates the critique off the main-loop context window regardless of model;
   the *cost* offload depends on the consumer setting that override. Not the skill's job to
   enforce.

5. **`brainstorming` owns the config gate.** It parses `piGauntlet.specCouncil.members`,
   emits the malformed-config warning, and selects the path (council vs worker).
   `roasting-the-spec` is invoked **only after** brainstorming confirms `members` is
   non-empty — it no longer offers, gates, or warns on absent/empty config.

6. **`spec-reviewer` is the wrong persona and is not used.** Its `systemPromptMode: replace`
   body is hard-wired to implementation-vs-spec compliance (reads code, cites `file:line`,
   verdict `COMPLIANT/NEEDS_REWORK`). No implementation exists at brainstorm time. A generic
   `worker` with a task string is the correct lightweight tool.

7. **No agent edits.** `spec-reviewer`, `spec-council-member`, and `spec-council-synthesizer`
   are untouched. AGENTS.md is untouched — `spec-council-member` stays "dispatched only by
   `/skill:roasting-the-spec`" (brainstorming calls the skill, not the agent).

## Order of operations (new self-review step)

1. Write spec to `doc/specs/`.
2. **Lint inline** (placeholder scan + internal consistency); fix what surfaces.
3. **Critique pass (auto):**
   - council configured → `/skill:roasting-the-spec`.
   - else → one fresh `worker`, auto-applies scope + ambiguity fixes, returns a summary.
4. Re-run the placeholder scan (catches anything the critique edits introduced).
5. User review gate (unchanged).

## Edit plan

### `skills/brainstorming/SKILL.md` (obra-tracked — minimal, surgical)

**Checklist intro line** — `do not silently drop the council offer` → `do not silently drop
the critique pass`.

**Checklist items 8-9:**

- 8 `**Spec self-review (lint)**` — placeholders, consistency; inline.
- 9 `**Critique pass (auto-dispatched)**` — scope, ambiguity; `roasting-the-spec` if a
  council is configured, else a fresh `worker`.

**Section "Spec Self-Review"** — keep the four bullets **byte-identical** (obra diff). Reword
only the surrounding framing so the split is unambiguous and nothing reads as run-inline
for scope/ambiguity. Replace the trailing line (`Fix what self-review surfaces before
handing to the user.`) with a paragraph that:
- labels placeholder scan + internal consistency as the inline **lint** (run inline, fix inline),
- labels scope + ambiguity as the auto-dispatched **critique** — explicitly **not** run inline,
- branches: council configured (per the [Spec Council](#spec-council-optional) gate owned by
  brainstorming) → `/skill:roasting-the-spec`; else → the fresh-`worker` dispatch,
- includes the corrected, schema-valid snippet (note `agent`, no `model:`):
  ```
  subagent({ agent: "worker", context: "fresh", task:
    "Problem statement: <the problem the spec addresses + the user's stated intent>.\n" +
    "Read the spec at <abs path to doc/specs/...>. Edit ONLY that file. Apply two checks and\n" +
    "fix what you find in place: (1) Scope — does every paragraph serve the goal? Cut filler;\n" +
    "state out-of-scope explicitly. (2) Ambiguity — is every 'we should' a concrete decision?\n" +
    "Replace 'we could probably' with 'we will'/'we won't'. Return a summary of what you\n" +
    "changed, and flag any ambiguity you could NOT safely resolve." })
  ```
  (`worker`'s model comes from `subagents.agentOverrides.worker.model`; the skill passes no
  `model:` — add a one-line note pointing there, per Decision 6.)
- states the worker auto-applies, and the placeholder scan re-runs after it returns.

**Section "Spec Council"** — flip offer → auto, and make brainstorming the config owner:
brainstorming parses `piGauntlet.specCouncil.members`, emits the malformed-config warning,
and selects the path. When `members` is non-empty the council *is* the critique pass (invoke
`roasting-the-spec` automatically, no prompt); otherwise the fresh-`worker` critique runs
instead.

**Red flags** — replace `About to skip the spec council offer when one is configured` with two:
`About to skip the critique pass (council if configured, else fresh worker)` and `Critique
dispatch (council or worker) failed to complete and you proceeded to the gate anyway`.

### `skills/roasting-the-spec/SKILL.md` (original — edit freely)

- **Frontmatter description** — drop "optional"; state it is auto-dispatched by brainstorming
  when a council is configured (no longer offered).
- **Overview** — "Invoked ... Runs only if a council is configured" → auto-dispatched as the
  critique pass when a council is configured; when none is configured brainstorming runs the
  single fresh-worker critique and does not invoke this skill.
- **Configuration and gating** — remove the numbered-choice offer block. This skill is
  invoked by brainstorming **only after** it confirms `members` is non-empty, so the gate,
  the malformed-config warning, and the fallback selection all move to brainstorming (per
  Decision 7). Keep a minimal defensive parse, but ownership of "should the council run" is
  no longer here.
- **Red flags** — `Offering the council when ... absent or empty` → `Running the council when
  ... absent or empty (brainstorming should have used the worker fallback)`.

## Out of scope

- Scout/recon delegation for brainstorming step 3. No real gain: brainstorming recon is
  adaptive and feeds the interactive dialogue at Opus; delegating it trades quality for a
  marginal token saving. Explicitly dropped.
- Any change to `pr-gatekeeper` / `linear-finish` (separate session / dropped).
- Any agent-roster or AGENTS.md change.

## Verification

- `rg -n "council offer|Offer the spec council" skills/brainstorming/SKILL.md` → zero matches
  after the edit (offer language gone).
- Generic-skill grep per AGENTS.md (`rg -ni "<placeholders>" skills/`) → zero matches.
- The four self-review bullets are byte-identical to the pre-edit version (obra diff = one
  replaced trailing line + one added paragraph + reworded framing + the two checklist-item
  clauses).
- Confirm the obra ancestor (`obra/superpowers` brainstorming skill) still contains the
  self-review block being split — the minimal-diff target must actually exist upstream.
- Manual read-through: the new self-review section is unambiguous about lint-inline vs
  critique-dispatched and does not leave both paths runnable at once.
- The fallback dispatch snippet is schema-valid (`agent: "worker"` present; no `model:`).
