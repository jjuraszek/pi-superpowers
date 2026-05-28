# Plan Document Reviewer Prompt Template

Dispatch a fresh-context subagent to review a plan **document** (not an implementation) before handing it off to executors.

**Purpose:** Verify the plan is complete, matches the spec, and decomposes into actionable tasks. This is independent of `code-reviewer` and `spec-reviewer`, which both target *implementations*; this reviewer targets the *plan*.

**Dispatch after:** the plan is fully written and self-reviewed; before handoff to `executing-plans` or `subagent-driven-development`.

```ts
subagent({
  agent: "worker",
  context: "fresh",
  task: `You are a plan document reviewer. Verify this plan is complete and ready for implementation.

**Plan to review:** [PLAN_FILE_PATH]
**Spec for reference:** [SPEC_FILE_PATH]

## What to Check

| Category | What to Look For |
|----------|------------------|
| Completeness | TODOs, placeholders, incomplete tasks, missing steps |
| Spec Alignment | Plan covers spec requirements, no major scope creep |
| Task Decomposition | Tasks have clear boundaries, steps are actionable (2–5 minutes each) |
| Buildability | Could an engineer with zero context follow this plan without getting stuck? |
| Internal Consistency | Types, signatures, and field names match across tasks |
| Code Repetition | If Task N says "similar to Task M", does the plan actually repeat the code, or only point? |

## Calibration

**Only flag issues that would cause real problems during implementation.** An implementer building the wrong thing, getting stuck, or producing inconsistent code is an issue. Minor wording or stylistic preferences are not.

Approve unless there are serious gaps: missing spec requirements, contradictory steps, placeholder content, tasks too vague to act on, or signatures/types that disagree between tasks.

## Output Format

## Plan Review

**Status:** Approved | Issues Found

**Issues (if any):**
- [Task X, Step Y]: [specific issue] — [why it matters for implementation]

**Recommendations (advisory, do not block approval):**
- [suggestions for improvement]
`,
})
```

**Reviewer returns:** Status, Issues (if any), Recommendations.

**On Issues Found:** revise the plan in the worktree, then either re-dispatch the reviewer or document the resolution before handoff. Don't proceed to execution with unresolved issues.
