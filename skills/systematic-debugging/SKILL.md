---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

> **Related skills:** Write a failing test for the bug with `/skill:test-driven-development`. Verify the fix with `/skill:verification-before-completion`.

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

Debug discipline is enforced by this skill, not by runtime hooks. The pi `verify-before-ship` extension only gates ship commands; it does not track investigation patterns. Hold yourself to the process below.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue: test failures, bugs, unexpected behavior, performance problems, build failures, integration issues.

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work
- You don't fully understand the issue

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (rushing guarantees rework)

## The Four Phases

You MUST complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully** — Don't skip past errors or warnings. Read stack traces completely. Note line numbers, file paths, error codes.

2. **Reproduce Consistently** — Can you trigger it reliably? What are the exact steps? If not reproducible → gather more data, don't guess.

3. **Check Recent Changes** — Git diff, recent commits, new dependencies, config changes, environmental differences.

4. **Gather Evidence in Multi-Component Systems** — For each component boundary: log what enters, what exits, verify config propagation. Run once to see WHERE it breaks, then investigate that component.

   **Example (multi-layer system):**
   ```bash
   # Layer 1: Workflow
   echo "=== Secrets available: ==="
   echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

   # Layer 2: Build script
   echo "=== Env vars in build script: ==="
   env | grep IDENTITY || echo "IDENTITY not in environment"

   # Layer 3: Signing
   echo "=== Keychain state: ==="
   security list-keychains
   security find-identity -v
   ```
   **This reveals:** Which layer fails (e.g., secrets → workflow ✓, workflow → build ✗)

5. **Trace Data Flow** — Where does the bad value originate? What called this with the bad value? Keep tracing up until you find the source. Fix at source, not at symptom. See `root-cause-tracing.md` for the complete technique.

### Phase 2: Pattern Analysis

1. **Find Working Examples** — Locate similar working code in same codebase.
2. **Compare Against References** — Read reference implementation COMPLETELY. Don't skim.
3. **Identify Differences** — List every difference, however small. Don't assume "that can't matter."
4. **Understand Dependencies** — What components, settings, config, environment does this need?

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** — State clearly: "I think X is the root cause because Y." Be specific, not vague.
2. **Test Minimally** — Make the SMALLEST possible change. One variable at a time. Don't fix multiple things at once.
3. **Verify Before Continuing** — Did it work? Yes → Phase 4. No → Form NEW hypothesis. DON'T add more fixes on top.
4. **When You Don't Know** — Say "I don't understand X." Don't pretend to know. Ask for help. Research more. The escape valve is real: an honest "I'm stuck on X" beats a confident wrong fix every time.

### Phase 4: Implementation

1. **Create Failing Test Case** — Use `/skill:test-driven-development` for writing proper failing tests. MUST have before fixing.

2. **Implement Single Fix** — ONE change at a time. No "while I'm here" improvements. No bundled refactoring.

3. **Verify Fix** — Test passes? No other tests broken? Issue actually resolved?

4. **If Fix Doesn't Work:**
   - If < 3 attempts: Return to Phase 1, re-analyze with new information
   - **If ≥ 3 attempts: STOP (see below)**

### When 3+ Fixes Fail: Question Architecture

**This is NOT a failed hypothesis — it's a wrong architecture.**

Pattern indicating architectural problem:
- Each fix reveals new shared state/coupling in different places
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

**STOP and question fundamentals:**
- Is this pattern fundamentally sound?
- Are we sticking with it through sheer inertia?
- Should we refactor architecture vs. continue fixing symptoms?

**Discuss with your human partner before attempting more fixes.**

## Red Flags and Rationalizations

Read `reference/rationalizations.md` for the full table of excuses and the partner-signal redirections. Short version:

- "Quick fix for now, investigate later" → return to Phase 1.
- "Just try changing X and see if it works" → return to Phase 1.
- "It's probably X, let me fix that" → return to Phase 1.
- "One more fix attempt" after 2+ failures → question architecture, don't fix again.
- Each fix reveals a new problem in a different place → question architecture.

## When Process Reveals "No Root Cause"

If investigation reveals issue is truly environmental, timing-dependent, or external:
1. Document what you investigated
2. Implement appropriate handling (retry, timeout, error message)
3. Add monitoring/logging for future investigation

**But:** 95% of "no root cause" cases are incomplete investigation.

## Supporting Techniques

These techniques are part of systematic debugging and available in this directory:

- **`root-cause-tracing.md`** — Trace bugs backward through call stack to find original trigger
- **`defense-in-depth.md`** — Add validation at multiple layers after finding root cause
- **`condition-based-waiting.md`** — Replace arbitrary timeouts with condition polling

Read directly when needed: `reference/rationalizations.md` and the supporting `*.md` files in this directory.

## Project overrides

If `.pi/gauntlet-overrides.md` exists, read it. Any sections relevant to this skill — by name match, by topic (routing, verification, worktrees, etc.), or by workflow convention — override or extend the instructions above. Project-local `AGENTS.md` is already in context — check it for project-specific routing tables, service paths, and verification commands.
