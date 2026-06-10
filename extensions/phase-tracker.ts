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

  // Auto-complete the implement phase from plan_tracker once every task is done,
  // but only when a skill has explicitly started it (TDD, or the SDD / executing-plans
  // execution preamble). The tracker never *fabricates* implement from task activity:
  // outside a superpowers flow (ad-hoc plan_tracker use) no phase is ever started, so
  // the phase widget stays dormant. Phases are entered explicitly by the phase-owning
  // skills; plan-tracker tracks tasks independently.
  const applyPlanActivity = (tasks?: { status: string }[]) => {
    if (!tasks || tasks.length === 0) return;
    if (phases.implement.status === "in_progress" && tasks.every((t) => t.status === "complete")) {
      phases = { ...phases, implement: { status: "complete" } };
    }
  };

  const reconstructState = (ctx: ExtensionContext) => {
    phases = emptyPhases();
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg.role !== "toolResult") continue;
      if (msg.toolName === "phase_tracker") {
        const details = msg.details as PhaseTrackerDetails | undefined;
        if (details && !details.error) phases = details.phases;
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
          phases = { ...phases, [params.phase]: { status: "complete" } };
          updateWidget(ctx);
          return {
            content: [{ type: "text", text: `Phase "${params.phase}" → complete\n${formatStatus(phases)}` }],
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
