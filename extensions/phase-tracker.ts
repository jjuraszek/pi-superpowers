/**
 * Phase Tracker Extension
 *
 * Tracks workflow phase progress: brainstorm → plan → implement → verify → ship.
 * State is stored in tool result details for proper branching support.
 * Shows a persistent single-line TUI widget alongside plan-tracker.
 *
 * Distinct from plan-tracker (per-task progress within a phase).
 * Use phase_tracker for "what stage am I in?", plan_tracker for "which task?".
 */

import { execSync } from "node:child_process";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "@sinclair/typebox";

const PHASES = ["brainstorm", "plan", "implement", "verify", "ship"] as const;
type Phase = (typeof PHASES)[number];
type PhaseStatus = "pending" | "in_progress" | "complete" | "skipped";

interface PhaseState {
  status: PhaseStatus;
  reason?: string;
}

type PhaseMap = Record<Phase, PhaseState>;

interface PhaseTrackerDetails {
  action: "start" | "complete" | "skip" | "status" | "reset";
  phases: PhaseMap;
  error?: string;
}

type Settings = {
  piGauntlet?: {
    closureReview?: {
      enforce?: boolean;
      model?: string;
    };
    flowGuards?: {
      enforce?: boolean;
      specDirs?: string[];
    };
  };
};

// Qualification per spec "Qualifying dispatch": a successful conformance-reviewer
// child run in the result details (pi-cohort SingleResult: { agent, exitCode }).
// Management mode and async dispatches return results: [] and fail this check.
const qualifiesAsClosureDispatch = (details: unknown): boolean => {
  const d = details as { results?: { agent?: unknown; exitCode?: unknown }[] } | undefined;
  if (!d || !Array.isArray(d.results)) return false;
  return d.results.some((r) => r?.agent === "conformance-reviewer" && r?.exitCode === 0);
};

const CLOSURE_GATE_ERROR =
  "Error: cannot complete 'verify': no conformance-reviewer dispatch observed.\n" +
  "The closing loop is required before verify completes. Either:\n" +
  '- dispatch subagent({ agent: "conformance-reviewer", ... }) with the spec, the\n' +
  "  user's verbatim request, and the full diff (model from\n" +
  "  piGauntlet.closureReview.model), then complete verify after its verdict, or\n" +
  "- if the user explicitly waived closure review, record it:\n" +
  '  phase_tracker({ action: "skip", phase: "verify", reason: "<user waiver>" })';

const SHIP_ADVISORY =
  "Verify is complete and ship is pending. If the conformance verdict is resolved\n" +
  "(CONFORMS, or every gap dispositioned and approved), invoke\n" +
  "/skill:finishing-a-development-branch now - do not add a 'ready to finish?' prompt;\n" +
  "its squash/PR/keep/discard menu is the human gate. If a requirement decision is\n" +
  "still open, you should not have completed verify - reopen it and surface the open\n" +
  "decision instead.";

// --- Flow guards (spec 2026-06-17-gauntlet-flow-guards) ---

const GUARD_PHASES: Phase[] = ["brainstorm", "plan", "implement"];

// Guard 2 — branch ops in place. `git switch` never targets a file path;
// `git checkout -b/-B` is explicit branch creation. Bare `git checkout <x>`
// is excluded (ambiguous with file checkout). `git worktree ...` is exempt.
const STMT_START = "(?:^|[\\n;&|(])\\s*";
const BRANCH_SWITCH = new RegExp(STMT_START + "git\\s+switch\\b");
const BRANCH_CHECKOUT = new RegExp(STMT_START + "git\\s+checkout\\s+-[bB]\\b");
const GIT_WORKTREE = /\bgit\s+worktree\b/;

// Guard 3 — bash mutation forms during brainstorm.
const BASH_REDIRECT = /(?:^|\s)>>?\s*([^\s|&]+)/; // capture the redirect target
const BASH_TEE = /\btee\b/;
const BASH_SED_I = /\bsed\s+-i\b/;
const BASH_GIT_APPLY = /\bgit\s+apply\b/;
const TEMP_TARGET = /^(\/tmp\/|\/var\/folders\/|\/dev\/)/; // scratch paths are not project mutations
const SCRATCH_MENTION = /\/tmp\/|\/var\/folders\/|\/dev\//;

const branchBlockReason = (phase: Phase): string =>
  `Branch switch/creation in the primary checkout is blocked during the ${phase} phase. ` +
  "Gauntlet flows run in a dedicated worktree (git worktree add ... is allowed here); " +
  "create/enter one with /skill:using-git-worktrees and run this there. " +
  "To override, set piGauntlet.flowGuards.enforce: false.";

// Closure-review model guard: when piGauntlet.closureReview.model is configured,
// a conformance-reviewer dispatch MUST inject that model call-site. The persona ships
// model-free, so a bare omission silently inherits the parent session's builder model -
// defeating the point of an independent closing gate on a different model. Walk the
// single / tasks / chain / parallel dispatch shapes and report any conformance-reviewer
// entry that carries no model. An explicit model (even a fallback) is fine; only a bare
// omission is caught - that preserves the documented "retry once inherited" escape hatch,
// which the orchestrator takes by passing the inherited model explicitly.
const conformanceEntriesMissingModel = (input: unknown): boolean => {
  const entries: { agent?: unknown; model?: unknown }[] = [];
  const collect = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (typeof o.agent === "string") entries.push({ agent: o.agent, model: o.model });
    for (const key of ["tasks", "chain", "parallel"] as const) {
      const v = o[key];
      if (Array.isArray(v)) for (const item of v) collect(item);
      else if (v && typeof v === "object") collect(v);
    }
  };
  collect(input);
  return entries.some((e) => e.agent === "conformance-reviewer" && !e.model);
};

const closureModelBlockReason = (model: string): string =>
  `Blocked: conformance-reviewer dispatched without a model while ` +
  `piGauntlet.closureReview.model is set to "${model}".\n` +
  `The persona ships model-free, so a bare omission silently inherits this session's ` +
  `builder model - the closing gate would then run on the same model that built the work, ` +
  `not the independent one the preset pins. Re-dispatch with model: "${model}" injected ` +
  `call-site. If that model is unreachable, pass an explicit fallback model (the documented ` +
  `one-retry escape hatch) - only a bare omission is blocked.\n` +
  `To disable this gate, set piGauntlet.closureReview.enforce: false.`;

const brainstormWriteWarning = (specDirs: string[]): string =>
  "⚠️ Writing outside the spec directory during the brainstorm phase.\n" +
  `Brainstorming may only edit the spec under ${specDirs.join(", ")}. Implementation\n` +
  "waits for the spec approval gate. If this edit IS the spec, place it under the spec dir.";

// Contiguous-subsequence match of a configured spec dir against path components.
const pathInSpecDirs = (rawPath: string, specDirs: string[]): boolean => {
  const comps = rawPath.split("/").filter((c) => c.length > 0 && c !== ".");
  return specDirs.some((dir) => {
    const dcomps = dir.split("/").filter((c) => c.length > 0);
    if (dcomps.length === 0) return false;
    for (let i = 0; i + dcomps.length <= comps.length; i++) {
      if (dcomps.every((dc, j) => comps[i + j] === dc)) return true;
    }
    return false;
  });
};

const PhaseTrackerParams = Type.Object({
  action: StringEnum(["start", "complete", "skip", "status", "reset"] as const, {
    description: "Action to perform",
  }),
  phase: Type.Optional(
    StringEnum(PHASES, {
      description: "Phase name (required for start, complete, skip)",
    }),
  ),
  reason: Type.Optional(
    Type.String({
      description: "Reason for skipping (required for skip action)",
    }),
  ),
  force: Type.Optional(
    Type.Boolean({
      description: "Reset and re-start a phase that is already complete or skipped (rare; default false)",
    }),
  ),
});

export type PhaseTrackerInput = Static<typeof PhaseTrackerParams>;

function emptyPhases(): PhaseMap {
  return Object.fromEntries(PHASES.map((p) => [p, { status: "pending" as PhaseStatus }])) as PhaseMap;
}

function phaseIcon(status: PhaseStatus, theme: Theme): string {
  switch (status) {
    case "complete":
      return theme.fg("success", "✓");
    case "in_progress":
      return theme.fg("warning", "→");
    case "skipped":
      return theme.fg("dim", "⊘");
    default:
      return theme.fg("dim", "○");
  }
}

function hasActivity(phases: PhaseMap): boolean {
  return PHASES.some((p) => phases[p].status !== "pending");
}

function formatWidget(phases: PhaseMap, theme: Theme): string {
  const parts = PHASES.map((p) => {
    const icon = phaseIcon(phases[p].status, theme);
    const name = phases[p].status === "skipped" ? theme.fg("dim", p) : p;
    return `${icon} ${name}`;
  });
  return `${theme.fg("muted", "Phases:")} ${parts.join(theme.fg("dim", " → "))}`;
}

function formatStatus(phases: PhaseMap): string {
  const lines: string[] = ["Phases:"];
  for (const p of PHASES) {
    const s = phases[p];
    const icon = s.status === "complete" ? "✓" : s.status === "in_progress" ? "→" : s.status === "skipped" ? "⊘" : "○";
    const suffix = s.reason ? ` (${s.reason})` : "";
    lines.push(`  ${icon} ${p}${suffix}`);
  }
  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  let phases: PhaseMap = emptyPhases();
  let conformanceDispatched = false;
  const closureEnforced = () =>
    ((pi.settings ?? {}) as Settings).piGauntlet?.closureReview?.enforce !== false;
  const closureReviewModel = () =>
    ((pi.settings ?? {}) as Settings).piGauntlet?.closureReview?.model;

  const flowGuardsCfg = () => ((pi.settings ?? {}) as Settings).piGauntlet?.flowGuards ?? {};
  const flowGuardsEnforced = () => flowGuardsCfg().enforce !== false;
  const specDirs = () => flowGuardsCfg().specDirs ?? ["doc/specs"];

  // Warn-once-per-phase ledger; cleared on every phase transition and on reconstruct.
  const firedGuards = new Map<string, boolean>();
  // Warnings stashed at tool_call, prepended at tool_result (verify-before-ship pattern).
  // Relies on tool_result firing for every tool_call; reconstructState clears any stragglers.
  const pendingGuardWarnings = new Map<string, string>();

  const activeGuardPhase = (): Phase | undefined =>
    GUARD_PHASES.find((p) => phases[p].status === "in_progress");

  // Guard 2 is active only when pi was launched in the primary checkout, not a
  // linked worktree. Computed once: a linked worktree has --git-dir != --git-common-dir.
  // (Inside a submodule the comparison is git-version-dependent and irrelevant here -
  // gauntlet flows do not run inside submodule git internals; whichever way it
  // resolves, the guard merely staying off in that edge case is harmless.)
  const inPrimaryCheckout = (() => {
    try {
      const lines = execSync("git rev-parse --git-dir --git-common-dir", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
      })
        .trim()
        .split("\n");
      return lines.length === 2 && lines[0] === lines[1];
    } catch {
      return false;
    }
  })();

  // Auto-complete the implement phase from plan_tracker once every task is done,
  // but only when a skill has explicitly started it (TDD, or the SDD
  // execution preamble). The tracker never *fabricates* implement from task activity:
  // outside a gauntlet flow (ad-hoc plan_tracker use) no phase is ever started, so
  // the phase widget stays dormant. Phases are entered explicitly by the phase-owning
  // skills; plan-tracker tracks tasks independently.
  const applyPlanActivity = (tasks?: { status: string }[]) => {
    if (!tasks || tasks.length === 0) return;
    if (phases.implement.status === "in_progress" && tasks.every((t) => t.status === "complete")) {
      phases = { ...phases, implement: { status: "complete" } };
      firedGuards.clear();
    }
  };

  const reconstructState = (ctx: ExtensionContext) => {
    phases = emptyPhases();
    conformanceDispatched = false;
    firedGuards.clear();
    pendingGuardWarnings.clear();
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg.role !== "toolResult") continue;
      if (msg.toolName === "phase_tracker") {
        const details = msg.details as PhaseTrackerDetails | undefined;
        if (details && !details.error) {
          phases = details.phases;
          if (details.action === "reset") conformanceDispatched = false;
        }
      } else if (msg.toolName === "subagent") {
        if (qualifiesAsClosureDispatch(msg.details)) conformanceDispatched = true;
      } else if (msg.toolName === "plan_tracker") {
        const details = msg.details as { tasks?: { status: string }[]; error?: string } | undefined;
        if (details && !details.error) applyPlanActivity(details.tasks);
      }
    }
  };

  const updateWidget = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (!hasActivity(phases)) {
      ctx.ui.setWidget("phase_tracker", undefined);
    } else {
      ctx.ui.setWidget("phase_tracker", (_tui, theme) => {
        return new Text(formatWidget(phases, theme), 0, 0);
      });
    }
  };

  for (const event of ["session_start", "session_switch", "session_fork", "session_tree"] as const) {
    pi.on(event, async (_event, ctx) => {
      reconstructState(ctx);
      updateWidget(ctx);
    });
  }

  pi.on("tool_call", async (event) => {
    // Closure-review model guard - independent of flowGuards, gated by closureReview.enforce.
    if (event.toolName === "subagent" && closureEnforced()) {
      const model = closureReviewModel();
      // Only execution-mode dispatches carry a model; management/control modes
      // (action: list/get/create/update/delete/status/...) execute nothing, so skip them.
      const hasAction = !!(event.input as { action?: unknown })?.action;
      if (model && !hasAction && conformanceEntriesMissingModel(event.input)) {
        return { block: true, reason: closureModelBlockReason(model) };
      }
    }

    if (!flowGuardsEnforced()) return undefined;

    // Guard 3 — write/edit outside the spec dir during brainstorm.
    if (event.toolName === "write" || event.toolName === "edit") {
      if (phases.brainstorm.status !== "in_progress" || firedGuards.get("brainstorm-write")) return undefined;
      const p = (event.input as { path?: unknown } | undefined)?.path;
      if (typeof p !== "string" || pathInSpecDirs(p, specDirs())) return undefined;
      firedGuards.set("brainstorm-write", true);
      pendingGuardWarnings.set(event.toolCallId, brainstormWriteWarning(specDirs()));
      return undefined;
    }

    if (event.toolName !== "bash") return undefined;
    const command = (event.input as { command?: unknown } | undefined)?.command;
    if (typeof command !== "string" || !command) return undefined;

    const warnings: string[] = [];

    // Guard 2 — branch op in place (primary checkout only, brainstorm/plan/implement).
    const gphase = activeGuardPhase();
    if (
      inPrimaryCheckout &&
      gphase &&
      !GIT_WORKTREE.test(command) &&
      (BRANCH_SWITCH.test(command) || BRANCH_CHECKOUT.test(command))
    ) {
      return { block: true, reason: branchBlockReason(gphase) };
    }

    // Guard 3 — bash mutation outside the spec dir during brainstorm.
    if (phases.brainstorm.status === "in_progress" && !firedGuards.get("brainstorm-write")) {
      // Redirect target is cleanly extractable: judge it directly against the spec dirs,
      // so `cat doc/specs/x.md > src/foo.ts` (writes OUTSIDE the spec dir) still fires
      // even though the command text mentions the spec dir.
      const target = command.match(BASH_REDIRECT)?.[1];
      const redirectOutsideSpec =
        target !== undefined && !TEMP_TARGET.test(target) && !pathInSpecDirs(target, specDirs());
      // tee / sed -i / git apply targets are not cleanly extractable; fall back to a
      // best-effort whole-command spec-dir mention check (accepted heuristic, advisory + warn-once).
      const otherMutation = BASH_TEE.test(command) || BASH_SED_I.test(command) || BASH_GIT_APPLY.test(command);
      const otherOutsideSpec =
        otherMutation && !specDirs().some((d) => command.includes(d)) && !SCRATCH_MENTION.test(command);
      if (redirectOutsideSpec || otherOutsideSpec) {
        firedGuards.set("brainstorm-write", true);
        warnings.push(brainstormWriteWarning(specDirs()));
      }
    }

    if (warnings.length > 0) pendingGuardWarnings.set(event.toolCallId, warnings.join("\n\n"));
    return undefined;
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName === "subagent") {
      if (qualifiesAsClosureDispatch(event.details)) conformanceDispatched = true;
      return undefined;
    }

    // Guards 2/3 — prepend the stashed advisory warning to the bash/write/edit result.
    if (event.toolName === "bash" || event.toolName === "write" || event.toolName === "edit") {
      const warning = pendingGuardWarnings.get(event.toolCallId);
      if (!warning) return undefined;
      pendingGuardWarnings.delete(event.toolCallId);
      return { content: [{ type: "text" as const, text: warning }, ...event.content] };
    }

    return undefined;
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.toolName !== "plan_tracker" || event.isError) return;
    const details = (event.result as { details?: { tasks?: { status: string }[]; error?: string } } | undefined)
      ?.details;
    if (!details || details.error) return;
    applyPlanActivity(details.tasks);
    updateWidget(ctx);
  });

  pi.registerTool({
    name: "phase_tracker",
    label: "Phase Tracker",
    description:
      "Track workflow phase progress (brainstorm → plan → implement → verify → ship). " +
      "Actions: start (mark phase in_progress), complete (mark phase complete), " +
      "skip (mark phase skipped with reason), status (show all phases), reset (clear all phases).",
    parameters: PhaseTrackerParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      switch (params.action) {
        case "start": {
          if (!params.phase) {
            return {
              content: [{ type: "text", text: "Error: phase required for start" }],
              details: { action: "start", phases: { ...phases }, error: "phase required" } as PhaseTrackerDetails,
            };
          }
          const current = phases[params.phase].status;
          if ((current === "complete" || current === "skipped") && !params.force) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: phase_tracker start: phase '${params.phase}' is already ${current}. Pass force: true to restart it intentionally.`,
                },
              ],
              details: {
                action: "start",
                phases: { ...phases },
                error: `phase '${params.phase}' is already ${current}`,
              } as PhaseTrackerDetails,
            };
          }
          const blocked = PHASES.find((p) => p !== params.phase && phases[p].status === "in_progress");
          if (blocked) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: phase "${blocked}" is already in_progress. Complete or skip it first.`,
                },
              ],
              details: {
                action: "start",
                phases: { ...phases },
                error: `${blocked} already in_progress`,
              } as PhaseTrackerDetails,
            };
          }
          phases = { ...phases, [params.phase]: { status: "in_progress" } };
          firedGuards.clear();
          updateWidget(ctx);
          return {
            content: [{ type: "text", text: `Phase "${params.phase}" → in_progress\n${formatStatus(phases)}` }],
            details: { action: "start", phases: { ...phases } } as PhaseTrackerDetails,
          };
        }

        case "complete": {
          if (!params.phase) {
            return {
              content: [{ type: "text", text: "Error: phase required for complete" }],
              details: { action: "complete", phases: { ...phases }, error: "phase required" } as PhaseTrackerDetails,
            };
          }
          const current = phases[params.phase].status;
          if (current !== "in_progress" && current !== "pending") {
            return {
              content: [{ type: "text", text: `Error: phase "${params.phase}" is ${current}, cannot complete.` }],
              details: {
                action: "complete",
                phases: { ...phases },
                error: `${params.phase} is ${current}`,
              } as PhaseTrackerDetails,
            };
          }
          if (params.phase === "verify" && closureEnforced() && !conformanceDispatched) {
            return {
              content: [{ type: "text", text: CLOSURE_GATE_ERROR }],
              details: {
                action: "complete",
                phases: { ...phases },
                error: "no conformance-reviewer dispatch observed",
              } as PhaseTrackerDetails,
            };
          }
          phases = { ...phases, [params.phase]: { status: "complete" } };
          firedGuards.clear();
          updateWidget(ctx);
          const advisory =
            params.phase === "verify" && phases.ship.status === "pending" ? `\n\n${SHIP_ADVISORY}` : "";
          return {
            content: [
              { type: "text", text: `Phase "${params.phase}" → complete\n${formatStatus(phases)}${advisory}` },
            ],
            details: { action: "complete", phases: { ...phases } } as PhaseTrackerDetails,
          };
        }

        case "skip": {
          if (!params.phase) {
            return {
              content: [{ type: "text", text: "Error: phase required for skip" }],
              details: { action: "skip", phases: { ...phases }, error: "phase required" } as PhaseTrackerDetails,
            };
          }
          if (!params.reason || params.reason.trim() === "") {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: phase_tracker skip requires a 'reason' string explaining why the phase is being skipped",
                },
              ],
              details: { action: "skip", phases: { ...phases }, error: "reason required for skip" } as PhaseTrackerDetails,
            };
          }
          const reason = params.reason;
          phases = { ...phases, [params.phase]: { status: "skipped", reason } };
          firedGuards.clear();
          updateWidget(ctx);
          return {
            content: [
              { type: "text", text: `Phase "${params.phase}" → skipped (${reason})\n${formatStatus(phases)}` },
            ],
            details: { action: "skip", phases: { ...phases } } as PhaseTrackerDetails,
          };
        }

        case "status": {
          return {
            content: [{ type: "text", text: formatStatus(phases) }],
            details: { action: "status", phases: { ...phases } } as PhaseTrackerDetails,
          };
        }

        case "reset": {
          phases = emptyPhases();
          conformanceDispatched = false;
          firedGuards.clear();
          updateWidget(ctx);
          return {
            content: [{ type: "text", text: "Phase tracker reset. All phases pending." }],
            details: { action: "reset", phases: { ...phases } } as PhaseTrackerDetails,
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown action: ${params.action}` }],
            details: { action: "status", phases: { ...phases }, error: "unknown action" } as PhaseTrackerDetails,
          };
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("phase_tracker "));
      text += theme.fg("muted", args.action);
      if (args.phase) {
        text += ` ${theme.fg("accent", args.phase)}`;
      }
      if (args.action === "skip" && args.reason) {
        text += ` ${theme.fg("dim", `(${args.reason})`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as PhaseTrackerDetails | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }

      const p = details.phases;
      const completeCount = PHASES.filter((ph) => p[ph].status === "complete").length;

      switch (details.action) {
        case "start": {
          const active = PHASES.find((ph) => p[ph].status === "in_progress") ?? "";
          return new Text(theme.fg("warning", "→ ") + theme.fg("muted", `${active} in progress`), 0, 0);
        }
        case "complete":
          return new Text(
            theme.fg("success", "✓ ") + theme.fg("muted", `${completeCount}/${PHASES.length} phases complete`),
            0,
            0,
          );
        case "skip":
          return new Text(theme.fg("dim", "⊘ ") + theme.fg("muted", "phase skipped"), 0, 0);
        case "status": {
          let text = theme.fg("muted", "Phases:");
          for (const ph of PHASES) {
            const icon =
              p[ph].status === "complete"
                ? theme.fg("success", "✓")
                : p[ph].status === "in_progress"
                  ? theme.fg("warning", "→")
                  : p[ph].status === "skipped"
                    ? theme.fg("dim", "⊘")
                    : theme.fg("dim", "○");
            const suffix = p[ph].reason ? theme.fg("dim", ` (${p[ph].reason})`) : "";
            const nameColor = p[ph].status === "skipped" ? "dim" : "muted";
            text += `\n${icon} ${theme.fg(nameColor, ph)}${suffix}`;
          }
          return new Text(text, 0, 0);
        }
        case "reset":
          return new Text(theme.fg("success", "✓ ") + theme.fg("muted", "Phase tracker reset"), 0, 0);
        default:
          return new Text(theme.fg("dim", "Done"), 0, 0);
      }
    },
  });
}
