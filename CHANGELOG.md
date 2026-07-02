# Changelog

## v4.0.0 - 2026-07-02

**Breaking: public identity.** First public npm release. The package is renamed and re-homed for its own identity as a diverged reinterpretation of obra/superpowers (via coctostan/pi-superpowers-plus); see the README `Lineage` section. No skill, agent, or extension *behavior* changes in this release - it is a rename + credits + publish-readiness pass. Consumers must update their `.pi/settings.json` and any override file.

- **Package renamed `@jjuraszek/pi-superpowers` -> `pi-gauntlet`** (unscoped, published to npm as public). Install becomes `pi install npm:pi-gauntlet` (`-l` for project scope). `repository`/`homepage`/`bugs` now point at `jjuraszek/pi-gauntlet`; `keywords` gain `pi-package` and drop `superpowers`.
- **Settings namespace renamed `piSuperpowers.*` -> `piGauntlet.*`** across all extensions and skills. Every configured key moves: `piGauntlet.closureReview` (`enforce`, `model`, `maxFixRounds`), `piGauntlet.flowGuards` (`enforce`, `specDirs`), `piGauntlet.verifyBeforeShip` (`testCommands`, `warningReference`). A preset still using `piSuperpowers.*` gets defaults silently - update every preset's `settings.json`.
- **Override filename renamed `.pi/superpowers-overrides.md` -> `.pi/gauntlet-overrides.md`.** Every skill's "Project overrides" block reads the new path; consumers must rename their override file.
- **Env override renamed `PI_SUPERPOWERS_AGENT_DIR` -> `PI_GAUNTLET_AGENT_DIR`** in `bin/install-agents.mjs`.
- **Dispatch peer is now `pi-cohort`** (the package providing the `subagent()` tool) in all references - README peer-dependency, AGENTS.md ground-truth, skill bodies. pi-gauntlet requires `pi-cohort >= 1.4.5`; the two packages release together whenever dispatch semantics change.
- **Added `LICENSE`** (MIT) with obra/superpowers copyright preserved; README gains a `Lineage` section; AGENTS.md `Upstream inspiration` is reframed from an active re-sync workflow into a historical lineage/credits record (SHA table kept).
- **Docs scrub.** Internal consumer-project identifiers removed from `doc/specs/`; the flow-guards spec file is renamed `2026-06-17-superpowers-flow-guards.md` -> `2026-06-17-gauntlet-flow-guards.md`.

## v3.5.0 - 2026-07-02

Turn the conformance gate from a detector into a closer. It found gaps well (50% of measured full-flow sessions got `GAPS`) but closed them badly - no enumerated issue list, no disposition menu, and only 3/29 gapped sessions ever re-audited after a fix. Post-gap handling was ad hoc and one session looped 7 rounds unbounded.

- **Machine-addressable reviewer output** (`agents/conformance-reviewer.md`). Each non-DELIVERED row now emits a structured gap block (`id`/`verdict`/`origin`/`evidence`/`remediation`/`touched-files`/`touched-resources`/`recommended`) plus a `Parallel-safe:` disjointness certification line, so the orchestrator can drive disposition and fix concurrency mechanically. Frontmatter unchanged.
- **Remediation-loop protocol** (`verification-before-completion/reference/conformance-check.md`). The "When the check finds gaps" section now specifies a numbered disposition menu (apply-all-recommended, with accept/rescope confirmation), isolated fix-wave dispatch reusing `dispatching-parallel-agents` mechanics (fresh context + `worktree: true` + serial integrate + one `code-reviewer` pass + test gate), and a bounded delta re-audit with a regression guard. `subagent-driven-development` Parallel-Wave Mode is deliberately **not** reused - its `phase_tracker({ phase: "implement" })` open errors during the verify phase - so the loop targets the lower-level fan-out primitive and leaves execution machinery untouched.
- **New `piGauntlet.closureReview.maxFixRounds`** (default `2`). Caps the fix/re-audit loop; `0` = audit-only. Enforced by protocol prose, not the phase-tracker extension.
- **Call-site pointers** in `subagent-driven-development` and `finishing-a-development-branch` replace their inline disposition prose; the finishing skill notes fix dispatch is unavailable on non-worktree / detached-HEAD finishes.

## v3.4.3 - 2026-07-01

Enforce the conformance gate's configured model at dispatch time. `conformance-reviewer` ships model-free and the verify-step skills are instructed to inject `piGauntlet.closureReview.model` call-site - but nothing checked it. An orchestrator that read the reminder yet omitted `model:` had its closing gate silently inherit the parent session's builder model (e.g. Opus) instead of the pinned independent model, defeating the point of a cold cross-model gate. The failure was invisible: the run succeeded and satisfied the existing "a conformance-reviewer ran" completion guard.

- **New `tool_call` guard in `phase-tracker.ts`.** When `closureReview.model` is set, a `subagent` dispatch of `conformance-reviewer` that omits `model:` is blocked before it runs, with a corrective reason naming the configured model. Walks the single / `tasks` / `chain` / `parallel` dispatch shapes. The documented "retry once inherited" fallback is preserved - an *explicit* model (even the inherited one) passes; only a bare omission is blocked. Gated by the same `closureReview.enforce` toggle (default `true`). Management/control dispatches (`action:` list/get/create/update/delete/status/...) execute nothing and are exempt, so they are never blocked.
- **Docs synced** (`README.md` conformance-gate section, `AGENTS.md` settings-key table).

## v3.4.2 - 2026-06-29

Sharpen the `code-reviewer` Simplicity dimension with an over-engineering tag taxonomy borrowed from the ponytail-review skill (a project-specific, aggressively-themed code-review skill in a consumer repo - not shipped here). Priority #6 was a single vague bullet ("Can the same outcome be reached with less code?") that produced soft, unactionable findings.

- **Tag taxonomy on `code-reviewer` priority #6** (`agents/code-reviewer.md`). Each simplicity finding now carries one of `delete:` / `stdlib:` / `native:` / `yagni:` / `shrink:`, each pairing the cut with what replaces it (name the stdlib function, name the native feature, show the shorter form). Tags are explicitly independent of the Critical/Moderate/Minor severity axis. The `delete:` line carries an exception so a single smoke test / `assert`-based self-check is never flagged as bloat.
- **`Complexity: net -<N> lines` added to the output format**, omitted when nothing is cuttable. Composes with (does not duplicate) consumer `AGENTS.md` liability discipline, which is inherited at runtime; the taxonomy supplies output format, not philosophy. The rest of ponytail (persona theming, intensity levels, gain/debt skills) was assessed and deliberately not ported - redundant with existing context and a poor fit for `implementer`'s fixed-scope rule.

## v3.4.1 - 2026-06-25

Force the brainstorming user review gate to render the `spec-summarizer` output verbatim. A session dispatched the summarizer, received a full structured summary, then presented a self-authored paraphrase at the gate instead - dropping the summarizer's Scope/Outputs/Algorithm/Acceptance sections and three of four gap-footer entries.

- **`brainstorming` gate now pastes the summarizer's returned text verbatim** (`skills/brainstorming/SKILL.md`). Checklist item 11 and the User Review Gate section now forbid paraphrasing, condensing, re-sectioning, or merging the summary with council output; "fold into the gate" is redefined as *place inside the message*, not *rewrite*. Council outcome, unresolved ambiguities, and **every** gap-footer entry are appended as their own adjacent lines. A new Red Flag flags presenting a rewritten summary as equivalent to not rendering it. If the summary looks wrong, re-dispatch or note the discrepancy adjacently - never silently rewrite.

## v3.4.0 - 2026-06-23

Add a spec-only summary at the brainstorming user review gate, and a flag-not-inline external-ref path so specs stay self-contained.

- **New `spec-summarizer` agent** (`agents/spec-summarizer.md`). Fresh context, read-only (`tools: read`), `inheritProjectContext: false` - reads only the spec it is given and returns a tight, decision-layer-first human summary. Dispatched only by `brainstorming` at the existing gate; output is ephemeral (rendered, never committed). Model-free - set `subagents.agentOverrides.spec-summarizer.model` per preset.
- **`brainstorming` renders the summary at the gate** as part of the existing single human gate (no new gate). New checklist item 11; the gate message leads with the summary.
- **External-ref path (C).** `spec-council-member` gains an `external-ref` finding kind; `spec-council-synthesizer` surfaces it as an `external-ref:`-prefixed cluster so it survives synthesis; `brainstorming` scans the critique return for the flag and inlines the referenced context (it holds the ticket; the critics do not) before summarizing. The worker fallback path carries the same flag.

## v3.3.3 — 2026-06-22

Re-add a verify->ship advisory to `phase-tracker`, narrower than the Guard 1 nudge removed in v3.3.0. A main-loop flow was observed stalling at the verify->ship boundary: conformance returned CONFORMS, verify completed, then the model stacked a redundant "Want me to proceed to finishing now?" prompt and ended the turn — exactly what `subagent-driven-development` step 5 forbids, but only as advisory prose with nothing enforcing it.

- **Advisory injected on `complete verify` when ship is still pending.** The phase-tracker now appends a nudge to the successful verify-complete result: if the conformance verdict is resolved, invoke `finishing-a-development-branch` immediately without a redundant "ready to finish?" prompt; if a requirement decision is still open, reopen verify and surface it instead.
- **Keyed on the phase state, not the verdict.** The conformance-gap human decision happens *before* `complete verify` (verify stays `in_progress`), so the advisory — which fires only on `complete verify` + ship pending — cannot clobber that legitimate pause. The extension never parses the conformance verdict (it only sees the dispatch `exitCode`), so the resolved-vs-open classification stays with the model; the advisory is a nudge, not an auto-transition or a block. Distinct from the v3.3.0-removed Guard 1 nudge: that was phantom signal (subagent-child exits mistaken for stalls); this targets a confirmed main-loop stall and is conditional on `ship` still pending.

## v3.3.2 — 2026-06-18

Resolve `piGauntlet.specCouncil` from two settings files instead of one. A session skipped the council because the agent read the repo-local `.pi/settings.json` (which had no `specCouncil`) as if it were the preset file, fell back to the single-`worker` critique, and reported it as a config problem. The council was correctly configured in `$PI_CODING_AGENT_DIR/settings.json` the whole time.

- **Two-file council resolution with repo precedence** (`brainstorming`, `roasting-the-spec`). Lookup order: (1) `<repo-root>/.pi/settings.json` (worktree root via `git rev-parse --show-toplevel`) — wins if it **defines** `specCouncil`, including an empty `members` as an explicit "no council for this repo"; (2) `$PI_CODING_AGENT_DIR/settings.json` — consulted only when the repo file does not define the key. First file that defines `specCouncil` wins; no cross-file merge.
- **Explicit anti-footgun note.** Both skills now warn to expand `$PI_CODING_AGENT_DIR` and never substitute a hardcoded project path for it — the repo-local `.pi/settings.json` and the preset file are different files. Reading one as the other was the original miss.

## v3.3.1 — 2026-06-18

Revert the v3.2.0/v3.3.0 removal of `bash` from the spec-council personas. The removal regressed council runs from 363/363 historical synthesis-reach to 0/2.

- **Restored `bash` on `spec-council-member` and `spec-council-synthesizer`** (`tools: read, grep, find, ls, bash`). `roasting-the-spec` dispatches members with an `output:` path, and pi-cohort injects a `Write your findings to: <path>` instruction into every such task. With no write-capable tool the member was ordered to write a file it could not write: observed failures were 87-byte preamble stubs (glm-5) and stalls (gpt-5.5 at `xhigh`), with critique content lost before the chair saw it. The v3.3.0 rationale ("critiques are response text so `bash` was never in the output path") was empirically false - `bash` IS the output path: members do read-only verification (`grep`/`wc`/`find`) then `cat > <output>`. Forward fix only; the v3.3.0 flow-guard changes are untouched.

## v3.3.0 — 2026-06-18

Refine the v3.2.0 flow guards based on observed behavior: Guard 1 was phantom signal (main-loop implement sessions already ship; the original non-completion count was subagent children, not stalled flows), Guard 2 advisory warning was too weak for branch-switch drift, and two bugs were found in Guards 2 and 3.

- **Removed Guard 1 (finish/verify nudges).** The `complete implement` and `complete verify` next-step nudges are removed. In practice, main-loop implement sessions do ship; the sessions that appeared stalled were subagent children (implementer, reviewer) whose exit is not a flow halt. The nudge text was phantom signal.
- **Guard 2 promoted to a hard block.** In-place `git switch` / `git checkout -b`/`-B` during `brainstorm`/`plan`/`implement` now blocks the bash call entirely (does not run), rather than warning after the fact. Branch-switch drift was not corrected by an advisory; a hard block is the minimum effective enforcement.
- **Removed `bash` from both council personas.** `spec-council-member` and `spec-council-synthesizer` frontmatter `tools` no longer includes `bash`. Deterministic tool removal replaces the v3.2.0 best-effort read-only-bash persona clause: static spec-claim checks are covered by `read`/`grep`/`find`/`ls`; critiques are response text so `bash` was never in the output path.
- **Fixed Guard 2 quoted-substring regex false positive.** The branch-command detection regex was matching quoted substrings (e.g. a commit message containing `git switch`) as a trigger. Fixed to anchor on command position, not substring presence.
- **Fixed Guard 3 scratch-path exemption on the tee/sed/apply path.** The scratch exemption (`/tmp`, `/var/folders`, `/dev`) was applied only on the redirect (`>`/`>>`) path; `tee`/`sed -i`/`git apply` commands targeting scratch paths still warned. Exemption is now applied uniformly across all Guard 3 bash-mutation forms.
- **Added execSync timeout to inPrimaryCheckout startup git call.** The `git rev-parse` call that determines primary-vs-worktree at extension init now carries an `execSync` timeout, preventing a hung git process from stalling the extension indefinitely on misconfigured repos.

## v3.2.0 — 2026-06-17

Add three advisory flow guards to `phase-tracker`, harden the spec-council personas to read-only bash, and pass explicit `cwd` on council/worker dispatches - mitigating worktree-discipline, finish-handoff, and spec-phase-mutation drift observed in session history, without adding skill-body prose.

- **`phase-tracker` flow guards (advisory, default-on, `piGauntlet.flowGuards.enforce`).** (1) Finish handoff: `complete implement` / `complete verify` (and the plan-tracker auto-complete) append a next-step nudge toward `start verify` and `/skill:finishing-a-development-branch`. (2) Worktree discipline: in-place `git switch` / `git checkout -b` during brainstorm/plan/implement warns, gated by an init-time primary-checkout-vs-worktree check (`--git-dir` vs `--git-common-dir`), exempting `git worktree` and plain file checkout; warns once per phase. (3) Spec-phase confinement: `write`/`edit` or bash mutation (`>`/`>>`/`tee`/`sed -i`/`git apply`) outside `flowGuards.specDirs` (default `["doc/specs"]`) during brainstorm warns; warns once per brainstorm. All three never block.
- **Spec-council personas pinned to read-only bash.** `spec-council-member` and `spec-council-synthesizer` bodies now forbid mutating via `bash` (write/redirect/edit/stage/commit/build) - closing the gap where a member "ignores its tools" and mutates through bash. Best-effort: council sessions have no runtime guard.
- **Explicit `cwd` on council/worker dispatches.** `roasting-the-spec` (member fan-out + chair) and `brainstorming` (fresh-worker critique) now pass `cwd: <worktree>` (from `git rev-parse --show-toplevel`), so subagents stop inheriting pi's primary-checkout launch dir. `subagent-driven-development` already pins `cwd` and is unchanged.

## v3.1.0 — 2026-06-16

Collapse the redundant end-of-flow gate and make documentation a spec-owned decision, so the chain has one human gate at finish instead of two stacked stops.

- **`subagent-driven-development` no longer asks "Ready for finishing?".** Once the conformance verdict is `CONFORMS` (or every gap is dispositioned), it auto-invokes `/skill:finishing-a-development-branch`. That skill's Step 4 menu (squash / PR / keep / discard) is the genuine human gate; the prior "ready?" prompt only stacked a second stop in front of it. Open gaps are already owned by the step-3 conformance check, which surfaces them and waits. Manual testing is reframed as an always-follow-up (post-squash on base, or on the PR branch), never a reason to hold the gate.
- **`finishing-a-development-branch` drops Step 1.5 (Documentation and Learnings).** The docs question is now redundant — doc impact is decided at spec time and ships in the diff — and the learnings question had no consuming memory system (dead output). Step references renumber accordingly.
- **`brainstorming` makes documentation a first-class spec output.** Section 6 design coverage gains a "Documentation impact" item (name each doc that changes, or "none"); the self-review lint gains a "Documentation named" check (now five bullets, first three inline). This closes the loop: docs flow spec -> plan task (`writing-plans` already forces "which doc, or no") -> implementation -> conformance gate, so finishing never needs to re-ask.
- **Skill-only.** No agent or extension changes.

## v3.0.2 — 2026-06-16

**Fix:** `roasting-the-spec` now passes `control: { needsAttentionAfterMs: 600000 }` on both the member fan-out and the chair dispatch, suppressing false-positive "needs attention (no observed activity for Xs)" notices on the spec council.

- **Root cause.** pi-cohort's subagent-control derives `needs_attention` from `now - lastActivityAt`, and `lastActivityAt` advances only on discrete child events (`tool_execution_start/end`, `tool_result_end`, `message_end`) — there is no in-turn/streaming signal. Council members and the chair each run one long, tool-less reasoning turn, so they cross the 60s default with zero activity events and get flagged stale despite being healthy (observed 180 false positives; one real turn ran 506s).
- **Fix placement.** `control` is a **run-level** param: `resolveControlConfig` reads only top-level `effectiveParams.control`, and the parallel per-task schema (`TaskItem`) has no `control` field. So the override sits beside `tasks` on the member call (not inside `members.map(...)`, where it would be silently dropped) and beside `agent`/`model`/`reads` on the single chair call.
- **10 min, not disabled.** Raising the idle threshold to 600000 ms keeps attention tracking on so a genuinely wedged run can still surface.
- **Skill-only.** No pi-cohort change.

## v3.0.1 — 2026-06-15

**Fix:** `plan-tracker` snapshots no longer alias live `Task` objects. The stored `details.tasks` is now a deep copy (`tasks.map((t) => ({ ...t }))`) at every result site, and `reconstructState` clones on read instead of binding the module array to a persisted snapshot.

- **Root cause.** `details: { tasks: [...tasks] }` was a shallow copy: the array was cloned but the `Task` objects were shared by reference. A later `update` mutated `tasks[i].status` in place, retroactively corrupting the already-persisted `details` of every prior result. Two updates in one turn (e.g. mark task N complete + task N+1 in-progress) wrote the *final* state into the earlier snapshot, so the persisted history diverged from the rendered text.
- **Impact.** Live widget on a clean reload was unaffected (it reads the last result, which is correct). The corruption bit branching/rewind — the feature the file comment advertises ("stored in tool result details for proper branching support") — because reconstructing to a mid-plan point replayed a snapshot that had been mutated to a later state.
- **No behavior or API change** beyond correct per-step snapshots.

## v3.0.0 — 2026-06-15

**Breaking:** deletes the `executing-plans` skill. Consumers that invoked it for separate-session batch execution must switch to `subagent-driven-development`.

- **Collapse the plan-handoff gate into a deterministic auto-select-and-proceed seam.** `brainstorming` now auto-proceeds to `writing-plans` on spec approval (no next-step menu); `writing-plans` auto-selects the execution mode from wave structure (any wave ≥2 tasks → parallel-wave, else sequential) and auto-invokes `subagent-driven-development` (no 3-way picker). The four human gates become three: spec approval, in-flight STOPs, end gate. The removed gate was a mechanical lookup that asked the human to decide something with no new information.
- **Delete `executing-plans`.** Unused in practice; its closing-loop conformance logic was duplicated in `subagent-driven-development`, so deletion removes a divergence tax. No escape hatch or config flag is retained — one opinionated happy path.
- **Strengthen the wave-grouping contract to parallel-safety.** A multi-task wave now requires disjoint files **and** disjoint shared mutable runtime resources (DB/schema, port, fixture, external service, shared temp path), making the auto-selected parallel mode safe by the planner's grouping rather than a downstream judgment. `subagent-driven-development`'s independence check and Red Flags carry the same contract.

## v2.2.1 — 2026-06-13

Harden the v2.2.0 lint/critique split against the two runtime-legibility regressions it introduced. The four self-review bullets stay byte-identical to the obra ancestor (re-sync constraint intact); the fixes are anchors around them.

- **Inline-vs-dispatched boundary made explicit at the bullets.** A lead-in above the four `Spec Self-Review` bullets now states that only the first two run inline and that scope + ambiguity are the dispatched critique — a model reading the imperative bullets top-down no longer applies scope/ambiguity edits inline (the exact behavior v2.2.0 set out to remove).
- **Post-critique placeholder re-scan promoted to a durable anchor.** Previously prose-only (easy to drop under context pruning), it is now checklist item 10 and a Red Flag, so correct behavior no longer depends on reading three sections together.
- **No bullet text, agent, or extension changes.**

## v2.2.0 — 2026-06-13

Split brainstorming's spec self-review into an inline lint and an auto-dispatched critique, so the judgment half runs with fresh eyes off the main loop while the mechanical half stays cheap and inline.

- **`brainstorming` self-review is now two stages.** Placeholder scan + internal consistency stay **inline** at the main loop (the lint). Scope + ambiguity become the **critique pass**, never run inline.
- **The critique is auto-dispatched, not offered.** When `piGauntlet.specCouncil.members` is configured, brainstorming auto-invokes `/skill:roasting-the-spec` (the council *is* the critique pass — the prior numbered offer is gone; config = consent). When no council is configured, it dispatches a single fresh `worker` that applies the scope + ambiguity checks and auto-applies fixes in place. The worker surfaces any ambiguity it could not safely resolve to the user gate.
- **`brainstorming` owns the config gate.** `roasting-the-spec` drops its offer block and is invoked only after brainstorming confirms `members` is non-empty; absent/empty/malformed config never reaches it.
- **`worker` model is documentation-only.** The dispatch passes no `model:`; it resolves from `subagents.agentOverrides.worker.model` (unset → inherits the main loop). Fresh context isolates the critique regardless; cost offload depends on the consumer's override.
- **No agent or extension changes.** `spec-reviewer` was explicitly rejected as the wrong persona (its prompt targets implementation-vs-spec compliance, and no code exists at brainstorm time). Scope/recon delegation was considered and dropped (no real gain — brainstorming recon is adaptive and feeds the interactive loop).
- **Docs:** README spec-council section (auto-dispatch + worker fallback).

## v2.1.0 — 2026-06-11

Enforce the closing loop deterministically. A consumer session completed the verify phase off a code-reviewer verdict alone after a context pruner dropped the skill text mandating the conformance-reviewer dispatch — prompt-level compliance is not enough for the last correctness gate.

- **`phase_tracker complete verify` now rejects** unless a successful `conformance-reviewer` dispatch (child result with `exitCode: 0`) has been observed since the last `reset`. Management-mode calls and async dispatches never qualify. The rejection message instructs: dispatch the reviewer, or record an explicit user waiver via `skip` — no `force` bypass on `complete`.
- **Config:** `piGauntlet.closureReview.enforce` (default `true`). Default-on is deliberate: pi-cohort is mandatory for consumers, and opt-in enforcement would let a preset silently re-inherit the observed failure.
- **`executing-plans` Step 5 wired to the phase tracker.** It dispatched the reviewer but never called `start`/`complete verify`, so the gate could not fire on that path. The mandate is unchanged; the step now enters and closes the phase explicitly.
- **Docs:** README phase-tracker gate + `closureReview.enforce`; AGENTS.md extension table.

## v2.0.0 — 2026-06-11

Make the thinking budget a per-preset config knob for the working agents. pi-cohort `agentOverrides` only fill fields the frontmatter left **unset** (`agents.ts` fill semantics), so the previous frontmatter pins silently swallowed any `subagents.agentOverrides.<agent>.thinking` a preset supplied — and made it impossible to run the personas on non-thinking models.

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

Move the `conformance-reviewer` model config from `subagents.agentOverrides.conformance-reviewer` to `piGauntlet.closureReview.model`, injected **call-site** by the verify-step skills — the same mechanism the spec-council chair uses. Consolidates all pi-superpowers quality-lever model config under the `piGauntlet.*` namespace (council + closure gate discoverable in one place) and gives the gate's model call-site precedence.

- **Config key changed.** Pin the gate via `settings.json#piGauntlet.closureReview.model` (was `subagents.agentOverrides.conformance-reviewer`). The verify steps of `subagent-driven-development` / `executing-plans` / `verification-before-completion` read it from `$PI_CODING_AGENT_DIR/settings.json` and pass `model:` call-site; unset → omit → inherit the parent's model; unreachable → retry once inherited.
- **`thinking` stays frontmatter-pinned** at `xhigh` (not call-site overridable), so the config supplies only `model` — the dedicated persona is what guarantees max reasoning + fresh context regardless of the model pin.
- **Migration:** consumers replace `subagents.agentOverrides.conformance-reviewer` with `piGauntlet.closureReview.model` in each preset. No persona or dispatch-shape change; `conformance-reviewer` still ships model-free.
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

- **verification-before-completion:** add a deliverable-vs-spec conformance gate. New `reference/conformance-check.md` instructs the verify phase to confront deliverables (code **and** docs) against the requirements, with a fresh-context reviewer (`code-reviewer`) as the primary path — it reads the spec + verbatim original prompt + diff cold, sidestepping the main session's build-it-then-bless-it bias. Source-of-truth priority: written spec (canonical) → original prompt (inline requirements) → ticket re-fetch as fallback only when no spec exists. Spec↔prompt/ticket drift is a red flag that must be reconciled, not silently absorbed. Default coverage contract is 1 ticket = 1 spec = code satisfying every AC (explicit + implicit notes from body/comments); multi-spec efforts are allowed only when the spec explicitly declares its subset and names deferred ACs. SKILL.md changes are purely additive (one Common Failures row, one Key Patterns block) so obra-sync stays conflict-free; ticket-resolution mechanics stay in the consumer's `gauntlet-overrides.md`.

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

- **roasting-the-spec:** new skill — an optional, per-preset multi-model spec critique that runs inside `brainstorming` between self-review and the user gate. Each council member runs on a different model (`piGauntlet.specCouncil.members`), a neutral chair (`spec-council-synthesizer`) consolidates and adjudicates their critiques, the parent proposes dispositions, and the user approves what lands. Off unless configured.
- **agents:** add `spec-council-member` (adversarial single-model spec critic, `thinking: xhigh`) and `spec-council-synthesizer` (neutral consolidating chair, `thinking: xhigh`). Both are model-free; `roasting-the-spec` injects the model per task. Brings the shipped persona count to five.
- **brainstorming:** add a one-section hook offering the spec council before the user review gate when configured; unchanged when not.

## v0.4.1 — 2026-05-30

- **using-git-worktrees:** worktrees are now the announced default for skill-driven work (was a blocking consent gate). Canonical home is `<repo>/.worktrees/<branch>`, created if missing, with the gitignore check folded into creation. Dropped the global `~/worktrees/` prompt and the bare `worktrees/` location; `~/.worktrees/<project>/` is used only when there is no enclosing repo. Project setup and baseline examples now prefer `pnpm`/`yarn`.
- **finishing-a-development-branch:** worktree-cleanup provenance synced to the new paths (`.worktrees/`, `~/.worktrees/<project>/`); removed the stale `worktrees/` and `~/.config/superpowers/worktrees/` entries this fork never creates.
- **verification-before-completion:** documented default test commands now list `pnpm test`/`yarn test`, matching the `verify-before-ship` extension and README.
- **test-driven-development:** prerequisite is an active worktree, not just a non-`main` branch.
- **brainstorming:** First-Feature Oversight and single-source-of-truth guidance made stack-agnostic (removed Rails/Django-specific vocabulary).
- **dispatching-parallel-agents:** replaced the session-specific narrative with a dense pi-cohort integration reference (parallel mode, fresh context, `worktree: true` isolation, agent choice, output capture).

## v0.4.0 — 2026-05-30

- **install-agents:** user installs now symlink personas into `getAgentDir()/agents` (`$PI_CODING_AGENT_DIR/agents`, default `~/.pi/agent/agents`) instead of the global `~/.agents/`. This is pi-cohort's profile-scoped user dir, so each pi profile (`agent`, `agent.anthropic`, `agent.bedrock`, …) gets its own personas and stops sharing one global dir. Project installs are unchanged (copy into `<repo>/.pi/agents/`).
- **install-agents:** migration — older versions symlinked into `~/.agents/`, which pi-cohort still discovers and which *wins* over `getAgentDir()/agents` on name collisions. User installs now remove stale `~/.agents/<name>.md` symlinks that resolve into a pi-superpowers package so they no longer shadow the profile-scoped install. Real files and unrelated symlinks in `~/.agents/` are left untouched.
- **install-agents:** `PI_GAUNTLET_AGENT_DIR` override now expands a leading `~`/`~/`.

## v0.3.0 — 2026-05-30

- **install-agents:** project installs now copy personas into `<repo>/.pi/agents/` (project scope) instead of symlinking into the global `~/.agents/`. Previously every install — user or project — wrote to the shared `~/.agents/` keyed by filename, so personas were effectively global across all pi profiles and the last install to run won the symlink. The installer now detects whether the package lives under `<repo>/.pi/...` (project → copy, install-managed, gitignored) or `<home>/.pi/<profile>/...` (user → symlink into `~/.agents/`, unchanged). Local-path dev installs and `PI_GAUNTLET_AGENT_DIR` keep symlink behavior. Project scope wins over user scope on name collisions, so per-repo installs are now independent.

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

- **Agents:** add `thinking`, `defaultContext`, `inheritSkills` frontmatter to all three personas. Previously these knobs were documented in `AGENTS.md` but missing from the agent files, so dispatch fell back to pi-cohort defaults (typically `thinking: high`, no defaultContext override). Now: reviewers use `thinking: high` + `defaultContext: fresh`; implementer uses `thinking: medium` + `defaultContext: fork`. All three use `inheritSkills: false` to prevent recursive skill discovery in dispatched children.
- **AGENTS.md:** correct false claim that `plan-tracker.ts` accepts settings — it has no configurable knobs. Tighten the package-conventions section. Document the divergence from `obra/superpowers` v5.1.0 (they dropped `agents/`, we keep them as pi-cohort profiles) and explain why `using-superpowers` is intentionally absent.
- **README.md:** rewrite for human readability, expand the project-overrides section with a concrete example, fix the version pin from `v0.1.0` to `v0.1.1`.
- **skills/writing-skills/SKILL.md:** drop project-specific references; broaden the "Where Skills Live in Pi" table to include the package-distributed path; update extension references to reflect package distribution.

## v0.1.1 — 2026-05-28

- Drop `peerDependencies` from `package.json`. The relationship is informational only — pi loads this package via its own package manager (not via `require()` / `import`) so npm's peer-dep auto-install pulled ~138 transitive packages with no runtime benefit. The host requirement is still documented in `README.md` and `AGENTS.md`. `npm install` now does effectively zero work (just runs `postinstall` to relink agents).

## v0.1.0 — 2026-05-28

Initial extraction of the obra/superpowers-inspired workflow framework into a standalone package.

Includes 13 skills, 3 agents (implementer, code-reviewer, spec-reviewer), 2 extensions (plan-tracker, verify-before-ship).
