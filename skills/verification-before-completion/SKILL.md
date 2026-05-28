---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

> **Related skills:** Follow up with `/skill:requesting-code-review` before merging. Done? `/skill:finishing-a-development-branch`.

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

If a tool result contains a ⚠️ workflow warning, stop immediately and address it before continuing.

## Boundaries
- Run verification commands: yes
- Read code and output: yes
- Edit source code: no

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports without checking outputs
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without fresh evidence**

## Key Patterns

The shape of an honest claim is `[Run command] [See: verbatim output] "claim"`. The verbatim output is the contract — paste it, don't summarize it from memory.

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without proving red-green)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter ≠ build)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust "agent says success"
```

## Why This Matters

From recurring failure modes:

- Partner says "I don't believe you" — trust broken.
- Undefined functions shipped — would crash.
- Missing requirements shipped — incomplete features.
- Time wasted on false completion → redirect → rework.
- Violates: **Honesty is a core value. If you lie, you'll be replaced.**

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases and paraphrases
- Implications of success
- ANY communication suggesting completion/correctness

## Enforcement

The `verify-before-ship` extension shipped by pi-superpowers watches `git commit`, `git push`, and `gh pr create`. If you have not run a passing recognised verification command since your last source-file edit in this session, an advisory warning is injected into the tool result. The warning clears automatically after a fresh passing run.

Defaults recognise `make ci`, `make test`, `npm test`, `pytest`, `rspec`, `cargo test`, `go test`. Projects can override (or narrow) the list via `settings.json#piSuperpowers.verifyBeforeShip.testCommands`.

When all verification passes, mark the verify phase complete: call `plan_tracker` with `{action: "update", status: "complete"}` for the current phase.

## Project overrides

If `.pi/superpowers-overrides.md` exists, read it. Sections matching this skill's name override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
