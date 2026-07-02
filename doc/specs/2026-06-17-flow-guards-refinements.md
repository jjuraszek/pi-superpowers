# Spec: flow-guards refinements (drop the finish nudge, harden worktree guard to a block, drop council bash, fix 2 false positives + a startup-hang)

Refines the v3.2.0 flow guards (`doc/specs/2026-06-17-gauntlet-flow-guards.md`) after independent verification against consumer-project session history and a false-positive / feasibility review. Target release: **v3.3.0** (minor - no config-schema break, no agent rename, no extension API removal).

## Context

Six changes (Findings A-F), each grounded below. Three reverse or tighten v3.2.0 decisions (A removes Guard 1; B promotes Guard 2 advisory -> block; C removes council `bash`); three fix defects in the v3.2.0 implementation (D, E, F).

### Finding A - Guard 1 (finish/verify nudges) addresses a phantom; remove it

v3.2.0 issue 1 claimed "dozens of sessions `start implement` and never reach ship." Re-measured against the **same source** (consumer-project `agent.anthropic` sessions, 2026-06-01..17), separating subagent-child sessions (`parentSession` set) from main-loop sessions - the v3.2.0 evidence did not:

| Window | main-loop sessions entering `implement` | shipped in-session | subagent children excluded |
|---|---|---|---|
| 06-01..09 | 7 | 7 | 56 |
| 06-10..14 | 6 | 6 | 38 |
| 06-15..16 (v3.0.0-3.1.0) | 8 | 8 | 47 |
| 06-17 | 2 | 2 | ~6 |
| **total** | **23** | **23** | **~147** |

- "shipped in-session" = a `git merge --squash`, `gh pr create`/`merge`, `script/worktree destroy`, or `ship` phase start observed in that session.
- **23/23 main-loop `implement` sessions shipped**, before and after v3.0.0. Zero drift-to-no-ship.
- The "dozens never reach ship" signal was ~147 subagent **implementer children** that never ship *by design* (one task in a fan-out wave), miscounted as main-loop sessions.
- Outcome cross-check: consumer-project has **529 commits to `main` since 06-03** (squash-merge - `git log --merges` is empty), continuous `(#NNNN)` PR + squash throughput. Work reaches `main` heavily.
- Most of the 23 sessions predate the 06-17 nudge, so they shipped **without** Guard 1 - via existing skill prose (`subagent-driven-development` Step 5 -> `finishing-a-development-branch`) that demonstrably works.

Conclusion: both nudges (`IMPLEMENT_NUDGE`, `VERIFY_NUDGE`) target a population that, at the main-loop level, does not exhibit the failure. The `closureReview` hard gate (`CLOSURE_GATE_ERROR`) already enforces the closing loop and is **retained unchanged**. Remove Guard 1 entirely.

Caveat (stated, not blocking): only the `agent.anthropic` preset's consumer-project sessions were analyzed; `bedrock`/`openai`/default presets and non-pi harnesses were not. The v3.2.0 evidence drew from the same source, so the child-session confound applies regardless of preset.

### Finding B - Guard 2's main-loop half can be closed deterministically (advisory -> hard block)

v3.2.0 left branch-in-place **advisory** on the rationale that "hard blocks both collide with the legitimate `git worktree add -b` creation step and invite LLM bypass games." But `git worktree ...` is **already exempted** by the `GIT_WORKTREE` trigger guard, so a hard block on the *exact same* (already-`git worktree`-exempted) condition collides with nothing legitimate. pi's `tool_call` event supports blocking (`extensions.md`: "**Can block.**", `return { block: true, reason?: string }`), so the block is mechanically available.

Promote Guard 2 to a hard block. The subagent-`cwd` dispatch fix (the other, already-deterministic half of issue 2) stays as shipped.

**Prerequisite:** Finding D's regex fix lands first/with this - a hard block on a false-positive regex would *block* a legitimate `git commit`, which is strictly worse than a spurious warning.

### Finding C - Remove `bash` from both council personas (reverses v3.2.0 non-goal)

v3.2.0 kept `bash` on the council personas and added a read-only-bash persona clause, declaring "members need bash to verify spec claims." Re-examined:

- Members emit their critique as their **response text**; the subagent harness writes it to the `output:` path. The chair reads member files via `reads:`. **`bash` is never in the critique-delivery path** - removing it does not affect output.
- `bash`'s only role was read-only codebase verification. `read`/`grep`/`find`/`ls` already cover static spec-claim checks (file contents, presence, conventions, structure). Only git-history / dynamic checks are lost - marginal for a spec critic.
- The v3.2.0 persona clause is **best-effort prose**; a confused/adversarial run can ignore it (v3.2.0 admits this). Removing the tool is the only **deterministic** control, and it costs almost nothing.

Remove `bash` from `spec-council-member` and `spec-council-synthesizer`; delete the now-vacuous read-only-bash clauses.

### Finding D - Guard 2 regex false positive (defect)

`BRANCH_SWITCH = /\bgit\s+switch\b/` matches the literal substring **anywhere**, including inside quoted arguments:

- `git commit -m 'migrate to git switch'` -> fires
- `grep 'git switch' file` -> fires
- `git log --grep='git switch'` -> fires

`git commit` is near-universal during `implement`. Once Guard 2 blocks (Finding B), this false positive **blocks a legitimate commit**. Anchor the trigger to a shell statement boundary.

### Finding E - Guard 3 scratch exemption missing on the tee/sed/apply path (defect)

The redirect path honors the `TEMP_TARGET` scratch exemption; the `tee`/`sed -i`/`git apply` fallback does not. So during brainstorm:

- `tee /dev/stderr` -> warns
- `cmd | tee /var/folders/xx/scratch.log` -> warns

This contradicts the v3.2.0 guarantee "scratch paths are exempt." Extend the scratch exemption to the fallback path.

### Finding F - `inPrimaryCheckout` init has no execSync timeout (defect)

`inPrimaryCheckout` runs two synchronous `git rev-parse` calls at extension load with no `timeout`. A wedged git or filesystem hangs **pi startup** indefinitely. Add a timeout (value grounded in measured data, below) and collapse to one subprocess.

## Scope

| Item | Path | Action |
|---|---|---|
| Remove Guard 1 (both nudges + plan_tracker nudge block + complete-case nudge) | `extensions/phase-tracker.ts` | edit |
| Guard 2: statement-anchor `BRANCH_SWITCH`/`BRANCH_CHECKOUT` (Finding D) | `extensions/phase-tracker.ts` | edit |
| Guard 2: advisory -> hard block, drop its warn-once flag (Finding B) | `extensions/phase-tracker.ts` | edit |
| Guard 3: scratch exemption on tee/sed/apply path (Finding E) | `extensions/phase-tracker.ts` | edit |
| `inPrimaryCheckout`: single combined call + `timeout: 5000` (Finding F) | `extensions/phase-tracker.ts` | edit |
| Remove `bash`; delete read-only-bash clause | `agents/spec-council-member.md` | edit |
| Remove `bash`; delete read-only-bash clause | `agents/spec-council-synthesizer.md` | edit |
| Flow-guards section: two guards (worktree=blocks, spec-phase=advisory); drop finish-handoff bullet | `README.md` | edit |
| Knobs table `tools` row (council columns) -> `read, grep, find, ls`; rewrite the council-bash rationale prose | `AGENTS.md` | edit |
| Add "superseded in part" note (Guard 1 removed; Guard 2 blocks; council bash removed) | `doc/specs/2026-06-17-gauntlet-flow-guards.md` | edit |
| v3.3.0 entry | `CHANGELOG.md` | edit |
| `3.2.0` -> `3.3.0` | `package.json` | edit |

## Non-goals

- **No change to the `closureReview` gate.** `CLOSURE_GATE_ERROR` (the `complete verify` hard gate) is retained verbatim - it is the actual enforcement for the closing loop and is unrelated to the removed Guard 1 nudges.
- **No change to the subagent-`cwd` dispatch fix** (`roasting-the-spec`, `brainstorming`). It is the deterministic half of issue 2 and stays as shipped.
- **No shell-quote-aware command parsing.** Finding D's statement-anchor kills the observed false positives; a residual narrow case remains (any statement-boundary char in `STMT_START` - newline, `;`, `&`, `|`, or `(` - *inside* a quoted string, e.g. `echo 'a; git switch b'` or `git commit -m '(use git switch)'`) and is accepted - full quote tracking is out of scope.
- **No new config keys.** `flowGuards.enforce` / `flowGuards.specDirs` are unchanged; `enforce: false` remains the escape hatch (now also the override for the hard block).
- **No subagent-child interception.** Unchanged from v3.2.0 - the guards observe the main loop only.
- **No `flowGuards` removal.** Guards 2 and 3 remain; only Guard 1 is dropped.

## Behavior

All edits are to `extensions/phase-tracker.ts` unless noted. Current code is quoted exactly; replacements are surgical.

### B1 - Remove Guard 1

Three deletions; no replacement logic.

1. Delete both constants:
   ```ts
   const IMPLEMENT_NUDGE =
     "\nimplement complete -> next: phase_tracker start verify, run the closing loop, then complete verify";
   const VERIFY_NUDGE =
     "\nverify complete -> next: invoke /skill:finishing-a-development-branch (ship phase not started)";
   ```
2. In the `tool_result` handler, delete the entire Guard 1 `plan_tracker` block:
   ```ts
   // Guard 1 - nudge when implement auto-completes via plan_tracker (all tasks done).
   // ...comment...
   if (event.toolName === "plan_tracker" && flowGuardsEnforced() && !event.isError) {
     const details = event.details as { tasks?: { status: string }[]; error?: string } | undefined;
     const tasks = details?.tasks;
     if (
       !details?.error &&
       tasks &&
       tasks.length > 0 &&
       tasks.every((t) => t.status === "complete") &&
       phases.implement.status === "in_progress" &&
       phases.verify.status === "pending"
     ) {
       return { content: [...event.content, { type: "text" as const, text: IMPLEMENT_NUDGE }] };
     }
     return undefined;
   }
   ```
   (The `plan_tracker` -> `applyPlanActivity` auto-complete in `tool_execution_end` stays; only the nudge injection goes.)
3. In the `phase_tracker` `complete` case, drop the nudge:
   ```ts
   // remove:
   let nudge = "";
   if (flowGuardsEnforced()) {
     if (params.phase === "implement" && phases.verify.status === "pending") nudge = IMPLEMENT_NUDGE;
     else if (params.phase === "verify" && phases.ship.status === "pending") nudge = VERIFY_NUDGE;
   }
   ```
   and change the returned text from `...${formatStatus(phases)}${nudge}` back to `...${formatStatus(phases)}`.

### B2 - Guard 2 regex statement-anchoring (Finding D, prerequisite for B3)

Replace:
```ts
const BRANCH_SWITCH = /\bgit\s+switch\b/;
const BRANCH_CHECKOUT = /\bgit\s+checkout\s+-[bB]\b/;
```
with a leading statement-boundary anchor (start of string, or after `;` `&` `|` `(` or newline):
```ts
const STMT_START = "(?:^|[\\n;&|(])\\s*";
const BRANCH_SWITCH = new RegExp(STMT_START + "git\\s+switch\\b");
const BRANCH_CHECKOUT = new RegExp(STMT_START + "git\\s+checkout\\s+-[bB]\\b");
```

Result: `git switch -c foo` (command start) and `cd x && git switch foo` (after `&&`) match; `git commit -m '...git switch...'`, `grep 'git switch'`, `git log --grep='git switch'` (substring not at a statement boundary) do not. `GIT_WORKTREE` exemption is unaffected.

### B3 - Guard 2 advisory -> hard block (Finding B)

Replace the Guard 2 block in the `tool_call` handler:
```ts
const gphase = activeGuardPhase();
if (
  inPrimaryCheckout &&
  gphase &&
  !firedGuards.get("branch") &&
  !GIT_WORKTREE.test(command) &&
  (BRANCH_SWITCH.test(command) || BRANCH_CHECKOUT.test(command))
) {
  firedGuards.set("branch", true);
  warnings.push(branchWarning(gphase));
}
```
with an immediate block (no warn-once - a block is idempotent and must persist across retries until a worktree exists or the phase ends):
```ts
const gphase = activeGuardPhase();
if (
  inPrimaryCheckout &&
  gphase &&
  !GIT_WORKTREE.test(command) &&
  (BRANCH_SWITCH.test(command) || BRANCH_CHECKOUT.test(command))
) {
  return { block: true, reason: branchBlockReason(gphase) };
}
```

Replace `branchWarning` (now block-only; "ignore this" wording no longer applies) with:
```ts
const branchBlockReason = (phase: Phase): string =>
  `Branch switch/creation in the primary checkout is blocked during the ${phase} phase. ` +
  "Gauntlet flows run in a dedicated worktree (git worktree add ... is allowed here); " +
  "create/enter one with /skill:using-git-worktrees and run this there. " +
  "To override, set piGauntlet.flowGuards.enforce: false.";
```

Retained exemptions (unchanged): `GIT_WORKTREE`, plain `git checkout <file>` (no `-b/-B`), `ship` phase excluded (`activeGuardPhase` only spans brainstorm/plan/implement), `inPrimaryCheckout` gating, `flowGuards.enforce: false`. The `firedGuards` map and its `clear()` calls remain - Guard 3 still uses them; only Guard 2's `"branch"` key usage is removed.

**Known limitation (accepted):** `GIT_WORKTREE` is tested against the whole command, so a compound like `git worktree list && git switch foo` is exempted wholesale and slips the block. Statement-scoping the worktree exemption is out of scope for v3.3.0 - prefixing a branch switch with an unrelated `git worktree` command inside a brainstorm/plan/implement session is not an observed pattern, and the `enforce: false` escape hatch covers the deliberate case.

### B4 - Guard 3 scratch exemption on the fallback path (Finding E)

Add a non-anchored scratch matcher beside `TEMP_TARGET`:
```ts
const SCRATCH_MENTION = /\/tmp\/|\/var\/folders\/|\/dev\//; // whole-command scratch check (tee/sed/apply path)
```
and extend `otherOutsideSpec`:
```ts
// before:
const otherOutsideSpec = otherMutation && !specDirs().some((d) => command.includes(d));
// after:
const otherOutsideSpec =
  otherMutation && !specDirs().some((d) => command.includes(d)) && !SCRATCH_MENTION.test(command);
```
Now `tee /dev/stderr` / `tee /var/folders/...` are exempt, symmetric with the redirect path's `TEMP_TARGET` exemption. Best-effort whole-command granularity (consistent with the existing whole-command spec-dir mention check for these forms). The same coarseness over-exempts in the other direction: a command that only *reads* scratch while writing a tracked file (e.g. `cat /tmp/in | tee src/foo.ts`) is spuriously exempted. Accepted - Guard 3 is advisory, so a missed warning costs nothing enforceable.

### B5 - `inPrimaryCheckout` single call + timeout (Finding F)

Replace the two `execSync` calls:
```ts
const gitDir = execSync("git rev-parse --git-dir", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
}).trim();
const commonDir = execSync("git rev-parse --git-common-dir", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
}).trim();
return gitDir === commonDir;
```
with one subprocess (verified: `git rev-parse --git-dir --git-common-dir` prints both, one per line) and a timeout:
```ts
const lines = execSync("git rev-parse --git-dir --git-common-dir", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
  timeout: 5000,
})
  .trim()
  .split("\n");
return lines.length === 2 && lines[0] === lines[1];
```
On timeout (or any error) `execSync` throws -> existing `catch` -> `inPrimaryCheckout = false` -> Guard 2 disabled (fail-safe). `inPrimaryCheckout` is a module-scope IIFE evaluated **once** at extension load and cached for the session: any error, including a 5 s timeout, permanently disables Guard 2 for that session with no retry - the one-time startup cost is bounded at 5 s.

**Timeout value, grounded in data.** Measured on this repo: both `git rev-parse` calls complete in ~16 ms total (~8 ms each); `/usr/bin/time -p` reports sub-10 ms. `git rev-parse --git-dir/--git-common-dir` is metadata-only (reads `.git`, no worktree scan), so latency is a few filesystem stats - independent of repo/worktree size; even a cold-cache or network-FS read is low single-digit seconds, while a genuine hang is unbounded.

- **5000 ms chosen.** ~300x the typical 16 ms and ~2.5x a pessimistic ~2 s cold/NFS read, so it never clips a healthy call; a wedged git fail-safes Guard 2 off after at most a one-time 5 s startup delay.
- **Not 2000 ms:** a cold-cache or lock-contended read could plausibly approach 1-2 s; at 2000 ms a false timeout would *silently disable* Guard 2 - now a real regression because Guard 2 blocks (B3), not just warns. The asymmetry favors the larger value.
- **Not larger (e.g. 30 s):** a wedged git should fail-safe quickly; 5 s already dwarfs any healthy latency, and a 30 s startup stall is worse UX than disabling a single guard.

### B6 - Remove `bash` from council personas (Finding C)

`agents/spec-council-member.md`:
- Frontmatter: `tools: read, grep, find, ls, bash` -> `tools: read, grep, find, ls`.
- Body: `Use read/grep/find/ls/bash to check the spec's claims...` -> `Use read/grep/find/ls to check the spec's claims...`.
- Delete the paragraph: `Your \`bash\` access is read-only: inspect and query the codebase only. Never write, redirect into a file (\`>\`, \`>>\`, \`tee\`), edit, stage, commit, or run build/test/format commands. If the spec needs an edit, describe it in your critique - do not make it.`

`agents/spec-council-synthesizer.md`:
- Frontmatter: same `tools` change.
- Body: `Use read/grep/find/ls/bash only to check a contested claim against the codebase...` -> `Use read/grep/find/ls only to check a contested claim against the codebase...`.
- Delete the paragraph: `Your \`bash\` access is read-only: use it only to check a contested claim. Never write, redirect into a file, edit, stage, or commit.`

### B7 - Doc updates

`README.md` flow-guards subsection - replace the three-bullet "advisory" block with two guards: **Worktree discipline (blocks)** - in-place `git switch` / `git checkout -b/-B` during brainstorm/plan/implement is blocked (bash call does not run), active only when launched in the primary checkout, `git worktree`/plain file checkout never trip it, override via `enforce: false`; **Spec-phase confinement (advisory)** - unchanged behavior text, keep the scratch-exempt note. Drop the **Finish handoff** bullet and the "All three are advisory" trailer.

`AGENTS.md`:
- Knobs table `tools` row: the `spec-council-member` and `spec-council-synthesizer` columns change from `read, grep, find, ls, bash` to `read, grep, find, ls`.
- Rewrite the line beginning "Both `spec-council-*` personas additionally pin `bash` to read-only..." to state both personas **omit** `bash` (deterministic control vs best-effort clause; static checks covered by read/grep/find/ls; critiques delivered as response text so bash was never in the output path).

`doc/specs/2026-06-17-gauntlet-flow-guards.md` - add a top note: superseded in part by this spec (Guard 1 removed; Guard 2 now a hard block; `bash` removed from council personas). Keep the original as the historical record.

`CHANGELOG.md` - v3.3.0 entry summarizing Findings A-F.

`package.json` - `3.2.0` -> `3.3.0`.

## Verification

No test infrastructure (extensions load directly into pi). Manual verification in a consumer session:

1. **Guard 1 gone:** `complete implement` and `complete verify` result text carries **no** next-step nudge; a `plan_tracker` all-tasks-complete during `implement` injects no nudge.
2. **Closure gate intact:** `complete verify` without a `conformance-reviewer` dispatch still rejects with `CLOSURE_GATE_ERROR` (unchanged).
3. **Guard 2 blocks:** pi launched in the primary checkout, `start implement`, `git switch -c foo` -> bash is **blocked** (does not run), reason cites the worktree. `git checkout -B foo` -> blocked. A retry -> blocked again (no warn-once allow-through).
4. **Guard 2 false positives do NOT block (Finding D):** `git commit -m 'mention git switch'`, `grep 'git switch' x`, `git log --grep='git switch'` -> run normally, no block.
5. **Guard 2 exemptions:** `git worktree add .worktrees/x -b x` -> runs; `git checkout -- file` -> runs; `git switch main` during `ship` -> runs; `git worktree list && git switch foo` -> runs (whole-command worktree exemption; known limitation, see B3); pi launched inside a worktree -> Guard 2 disabled (any branch op runs); `flowGuards.enforce: false` -> all guards off.
6. **Guard 3 scratch exemption (Finding E):** `start brainstorm`, `cmd | tee /var/folders/xx/s.log` and `echo x | tee /dev/stderr` -> no warning; `cmd | tee src/foo.ts` -> warning; `echo x > src/foo.ts` -> warning; `write doc/specs/x.md` -> no warning.
7. **Startup timeout (Finding F):** normal launch -> no perceptible delay (single ~10-20 ms call); reason about the catch path -> a thrown/timed-out call disables Guard 2 (cannot be exercised without a wedged git; covered by code read).
8. **Council personas:** `subagent({ action: "get", agent: "spec-council-member" })` and `...synthesizer` -> `tools` lists `read, grep, find, ls` (no `bash`); bodies contain no read-only-bash clause; a dispatched member still returns its critique markdown (delivery is response text, unaffected).

## Open questions

- **Guard 1 full removal vs keep `VERIFY_NUDGE` only.** Data refutes both nudges' stated justification for the main loop, so the spec removes both. If the user prefers to retain a single soft pointer at the one genuinely unguarded transition (`complete verify` -> ship has no hard gate), the narrow alternative is to keep `VERIFY_NUDGE` and drop only `IMPLEMENT_NUDGE` + the `plan_tracker` injection. Default in this spec: full removal.
