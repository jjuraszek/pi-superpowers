# Changelog

## v2.0.0 — 2026-06-11

Make the thinking budget a per-preset config knob for the working agents. pi-subagents `agentOverrides` only fill fields the frontmatter left **unset** (`agents.ts` fill semantics), so the previous frontmatter pins silently swallowed any `subagents.agentOverrides.<agent>.thinking` a preset supplied — and made it impossible to run the personas on non-thinking models.

- **Breaking: `thinking:` removed from `implementer`, `code-reviewer`, `spec-reviewer` frontmatter.** Presets now own the budget via `subagents.agentOverrides.<agent>.thinking`; `false` → provider default (non-thinking models). Unset → provider default for the resolved model.
- **Migration:** add to each preset's `settings.json` — recommended `implementer: medium`, `code-reviewer: high`, `spec-reviewer: medium`. Without overrides the agents no longer run at the previously pinned levels.
- **`conformance-reviewer` and council personas unchanged.** All three stay frontmatter-pinned at `xhigh` — intentional: the gate often inherits the main session's model (`closureReview.model` unset) and must still run at max budget; the council is defined by max-budget critique. v1.2.1's "thinking stays frontmatter-pinned" guarantee for the gate still holds.
- **Docs:** README "Thinking budgets" section; AGENTS.md knobs table + rationale.

## v1.3.0 — 2026-06-09

Make phase tracking explicit and scoped to superpowers flows, and reset both trackers when a new brainstorm begins.

- **Phase tracker no longer fabricates the `implement` phase from `plan_tracker` activity.** The plan→phase derivation now only *completes* an `implement` phase a skill explicitly started; it never auto-starts one. Effect: ad-hoc `plan_tracker` use outside a superpowers flow no longer lights up a lone, misleading `implement` phase — the phase widget stays dormant until a phase-owning skill starts a phase. Tasks (`plan-tracker`) are unaffected and still track standalone.
- **Executors enter the implement phase explicitly.** `subagent-driven-development` (sequential **and** parallel-wave) and `executing-plans` call `phase_tracker start implement` before the first task/wave, replacing the removed auto-start; `plan_tracker` still auto-completes the phase when every task is done. `test-driven-development` already did this.
- **`brainstorming` resets both trackers on entry.** Step 1 now calls `phase_tracker reset` **and** `plan_tracker clear` before `start brainstorm` — a new brainstorm is a new flow, so stale phases and tasks from earlier work in the same session are cleared.
- **Docs:** README phase-tracker note. No config or API changes.

## v1.2.1 — 2026-06-09

Move the `conformance-reviewer` model config from `subagents.agentOverrides.conformance-reviewer` to `piSuperpowers.closureReview.model`, injected **call-site** by the verify-step skills — the same mechanism the spec-council chair uses. Consolidates all pi-superpowers quality-lever model config under the `piSuperpowers.*` namespace (council + closure gate discoverable in one place) and gives the gate's model call-site precedence.

- **Config key changed.** Pin the gate via `settings.json#piSuperpowers.closureReview.model` (was `subagents.agentOverrides.conformance-reviewer`). The verify steps of `subagent-driven-development` / `executing-plans` / `verification-before-completion` read it from `$PI_CODING_AGENT_DIR/settings.json` and pass `model:` call-site; unset → omit → inherit the parent's model; unreachable → retry once inherited.
- **`thinking` stays frontmatter-pinned** at `xhigh` (not call-site overridable), so the config supplies only `model` — the dedicated persona is what guarantees max reasoning + fresh context regardless of the model pin.
- **Migration:** consumers replace `subagents.agentOverrides.conformance-reviewer` with `piSuperpowers.closureReview.model` in each preset. No persona or dispatch-shape change; `conformance-reviewer` still ships model-free.
- **Docs:** README (`Conformance gate model`), `AGENTS.md` rationale.

## v1.2.0 — 2026-06-09

Add a dedicated `conformance-reviewer` persona for the closing-loop intent gate, replacing the reuse of `code-reviewer` for conformance. Session audits showed the closure check was being **fused into the whole-PR code review** on a single `code-reviewer` dispatch: the code-quality system prompt dominated, the conformance result was compressed to a one-line afterthought, and the gate ran on whatever model `agentOverrides.code-reviewer` pinned (mid-tier) rather than the strongest available.

- **New agent `conformance-reviewer`** (`agents/conformance-reviewer.md`): the reviewer profile (fresh context, read-only, skeptical) at `thinking: xhigh`, framed for **requirement coverage and intent fidelity** — confront the delivered code+docs against the *origin* (spec + verbatim prompt), skipping the plan. Output is a per-requirement coverage verdict (`DELIVERED/PARTIAL/MISSING/DRIFTED/UNAUTHORIZED` → `CONFORMS`/`GAPS`), not a bug-severity list. Ships **model-free**: pin per preset via `settings.json#subagents.agentOverrides.conformance-reviewer` so each profile uses the strongest reasoning model its providers can reach. **Consumers must add this override after upgrading** — with no override the agent falls back to the harness default model.
- **Gap protocol (propose, don't dispose).** The reviewer reports gaps plus a remediation *direction*; it never edits and never decides. On `GAPS` the orchestrator surfaces each gap to the user, who chooses per gap: fix now / accept + record in spec / rescope. No completion claim stands over an unreconciled gap. Documented in `reference/conformance-check.md`.
- **Dispatch is now its own call, never fused with code review.** `subagent-driven-development` (After-All-Tasks step 3), `executing-plans` (Step 5), and `reference/conformance-check.md` dispatch `conformance-reviewer` separately from the whole-PR `code-reviewer`.
- **Closure gets its own section before finishing.** `subagent-driven-development` step 4 summary and a new `finishing-a-development-branch` Step 3.5 surface the conformance verdict as a first-class line *before* the merge/PR/keep/discard menu; unreconciled gaps block the options rather than hiding in them.
- **Docs:** README (6 personas + per-preset `Conformance gate model` config) and `AGENTS.md` (roster, knobs table column, divergence rationale).

## v1.1.6 — 2026-06-08

Extend the v1.1.5 conformance close-out to `executing-plans` for parity. Its per-task verification already routes through `/skill:verification-before-completion` (so per-slice conformance was covered), but its Step 5 self-audit before finishing was plan-vs-code only — no fresh-reviewer pass confronted the *assembled* deliverable against the origin.

- **executing-plans:** Step 5 now adds the same closing-loop conformance check — dispatch a fresh-context `code-reviewer` against the origin (spec + verbatim prompt + full diff vs `main`) per `verification-before-completion/reference/conformance-check.md`, reconciling drift before finishing. `dispatching-parallel-agents` needs no change; it routes its whole verify gate through `/skill:verification-before-completion`, which already contains the check.

## v1.1.5 — 2026-06-08

Close the conformance gap on the `subagent-driven-development` (SDD) path. v1.1.3 had SDD run its own inline verify gate (test + plan-vs-code review) and emit `phase_tracker verify` itself, instead of routing through `/skill:verification-before-completion`. But the **closing-loop conformance check** added in v1.1.0 and sharpened in v1.1.1 (`reference/conformance-check.md` — confront the deliverable against the *origin* spec + prompt, not the plan) lives only in `verification-before-completion`, so the SDD path marked `verify ✓` having run exactly the "plan-vs-code review, tests passing" that v1.1.1 declares *not sufficient* for "intent delivered (loop closed)."

- **subagent-driven-development:** the *After All Tasks Complete* gate now adds a conformance step between the audit and `phase_tracker complete verify` — dispatch a fresh-context `code-reviewer` against the origin (spec + verbatim prompt + full diff) per `verification-before-completion/reference/conformance-check.md`, reconciling drift before completion. Cites the reference directly rather than routing the whole skill, so SDD keeps `phase_tracker` ownership (no v1.1.3 regression) and avoids importing a direct-execution protocol into an orchestrator. Closing-loop steps renumbered (5→6 items in the gate).

## v1.1.4 — 2026-06-07

Fix `plan_tracker` leaking into non-execution phases, which produced an impossible phase state in v1.1.3.

Root cause: `plan_tracker` is execution-only by intent, but nothing enforced it. The brainstorming checklist said "Create a task for each item," so the model init'd a 10-item `plan_tracker` plan *during brainstorm* — both misrepresenting open-ended brainstorming as a bounded `(2/10)` process **and** tripping v1.1.3's `implement`-phase auto-derivation, which flipped `implement → in_progress` while `brainstorm` was still active (`→ brainstorm → ○ plan → → implement`, two phases at once, `plan` skipped).

- **plan-tracker:** tool description now scopes the tracker to the implement phase explicitly and forbids brainstorming/research/planning checklists.
- **brainstorming skill:** the checklist is now framed as an internal list to follow, not a `plan_tracker` plan, with a note that `plan_tracker` is execution-only.
- **phase-tracker:** defense in depth — the `implement` auto-derivation now honours the single-`in_progress` invariant that manual `start` enforces, activating `implement` from `plan_tracker` activity only when no earlier phase is still `in_progress`. The `in_progress → complete` transition stays unguarded, so the v1.1.3 direct-execution and SDD completion paths (including verify starting before the final task) are unchanged.

## v1.1.3 — 2026-06-06

- **phase-tracker:** fix the intermittent stall where the workflow finished showing `✓ brainstorm → ✓ plan → ○ implement → ○ verify → ○ ship`. Root cause was routing, not extension logic: execution paths (`subagent-driven-development`, `executing-plans`) dispatch the work to `implementer` subagents and drive `plan_tracker` (task granularity) but never invoke the `phase_tracker`-owning skills, so `implement`/`verify` were orphaned and only advanced if the model spontaneously reconciled at the end. The extension now **derives the `implement` phase from `plan_tracker` activity** (first task → `in_progress`; all tasks `complete` → `complete`), folded into both the live `tool_execution_end` path and `reconstructState` so it survives fork/switch/restore. Guidance-free — it piggybacks on a signal the model already emits reliably across every execution path.
- **subagent-driven-development:** emit `phase_tracker start/complete verify` around the "After All Tasks" gate. SDD runs its own inline test+review gate instead of routing through `/skill:verification-before-completion`, so `verify` was orphaned on the SDD path specifically (executing-plans already routes correctly). Disjoint from the `implement` auto-derivation above, so the two never double-advance the same phase.
- **roasting-the-spec:** render the council offer as an indexed choice (`1. Roast with the council` / `2. Skip to review`) to match the User Review Gate's numbered style, instead of free-form `(y/n)` prose. Still gated to appear only when the council is configured; lenient parsing keeps `y`/`yes`/`n`/`no`/`skip` working.

## v1.1.2 — 2026-06-05

- **executing-plans / subagent-driven-development:** project-specific audit skills now **supplement** rather than **replace** the generic `requesting-code-review`. Both flows run `/skill:requesting-code-review` first (still REQUIRED), then run the project audit skill (e.g. `.agents/skills/self-audit/`) as an optional follow-up that adds project-specific checks/fixes. Previously the hooks said to "prefer that — its rules supersede this baseline" / "follow that instead", which made the project skill a full replacement and forced it to re-implement generic review. Generic review now lives in exactly one place; the project skill stays optional and never becomes mandatory.

## v1.1.1 — 2026-06-04

- **verification-before-completion:** sharpen the conformance gate added in v1.1.0. (1) Frame it explicitly as the **closing loop** distinct from code review: work flows `prompt/spec → plan → code/doc`, each hop lossy; plan-vs-code review (`requesting-code-review`) is single-step and inherits any drift the plan introduced, whereas this check confronts the outcome against the *origin* (spec + prompt), skipping the plan. Renamed the Common Failures row to `Intent delivered (loop closed)` and its not-sufficient cell to `Plan-vs-code review, tests passing`; Key Patterns block reworded to audit against ORIGIN, not the plan. (2) Make **prompt + spec a first-class requirement source** when no ticket exists — the coverage rule is now "1 requirement source = 1 spec" (ticket if present, otherwise spec + prompt), removing the ticket-mandatory wording. (3) Dropped the unfounded `~90%` precision from the coverage rule.

## v1.1.0 — 2026-06-04

- **verification-before-completion:** add a deliverable-vs-spec conformance gate. New `reference/conformance-check.md` instructs the verify phase to confront deliverables (code **and** docs) against the requirements, with a fresh-context reviewer (`code-reviewer`) as the primary path — it reads the spec + verbatim original prompt + diff cold, sidestepping the main session's build-it-then-bless-it bias. Source-of-truth priority: written spec (canonical) → original prompt (inline requirements) → ticket re-fetch as fallback only when no spec exists. Spec↔prompt/ticket drift is a red flag that must be reconciled, not silently absorbed. Default coverage contract is 1 ticket = 1 spec = code satisfying every AC (explicit + implicit notes from body/comments); multi-spec efforts are allowed only when the spec explicitly declares its subset and names deferred ACs. SKILL.md changes are purely additive (one Common Failures row, one Key Patterns block) so obra-sync stays conflict-free; ticket-resolution mechanics stay in the consumer's `superpowers-overrides.md`.

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
