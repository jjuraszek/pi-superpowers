/**
 * Verify-before-ship extension
 *
 * Single-session verification gate for shipping commands (git commit / git push /
 * gh pr create). Tracks whether a recognised verification command has succeeded
 * since the last source-file write; injects an advisory warning into the tool
 * result of any ship command when verification is stale.
 *
 * In-memory only. No persisted state.
 *
 * Configurable via settings.json:
 *
 *   {
 *     "piSuperpowers": {
 *       "verifyBeforeShip": {
 *         "testCommands": ["make ci", "make test", "pytest", "rspec"],
 *         "warningReference": "doc/testing.md"
 *       }
 *     }
 *   }
 *
 * Defaults match common multi-language verification entrypoints. Override
 * `testCommands` to match your project's conventions.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Default verification entrypoints. Override via settings.
const DEFAULT_TEST_COMMANDS = [
  "make\\s+(?:ci|test)(?![-\\w])", // rejects make test-smoke, test-corpus, etc.
  "npm\\s+(?:test|run\\s+test)",
  "pnpm\\s+test",
  "yarn\\s+test",
  "pytest",
  "rspec",
  "cargo\\s+test",
  "go\\s+test",
];

const SHIP_CMD = /\b(git\s+commit|git\s+push|gh\s+pr\s+create)\b/;
const SOURCE_EXT = /\.(ts|tsx|js|jsx|py|rb|go|rs|java|swift|kt)$/;
const TEST_PATH = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.|_test\.(py|go|rb)$/;

type Settings = {
  piSuperpowers?: {
    verifyBeforeShip?: {
      testCommands?: string[];
      warningReference?: string;
    };
  };
};

const isSourceWrite = (filePath: string | undefined): boolean => {
  if (!filePath) return false;
  return SOURCE_EXT.test(filePath) && !TEST_PATH.test(filePath);
};

const buildTestCmdRegex = (commands: string[]): RegExp =>
  new RegExp(`\\b(${commands.join("|")})\\b`);

const formatWarning = (command: string, testCommands: string[], reference: string | undefined): string => {
  const examples = testCommands
    .slice(0, 3)
    .map((c) => "`" + c.replace(/\\s\+/g, " ").replace(/\\b|\(\?!.*?\)/g, "") + "`")
    .join(" / ");
  const refLine = reference ? `\nReference: ${reference}` : "";
  return (
    `⚠️ Ship command \`${command.trim()}\` ran without verification.\n\n` +
    `No successful ${examples} run since the last source edit in this session.\n` +
    `Run your project's verification target before continuing, or confirm with the user that you are deliberately skipping it.${refLine}`
  );
};

export default function (pi: ExtensionAPI) {
  const settings = (pi.settings ?? {}) as Settings;
  const cfg = settings.piSuperpowers?.verifyBeforeShip ?? {};
  const testCommands = cfg.testCommands ?? DEFAULT_TEST_COMMANDS;
  const testRegex = buildTestCmdRegex(testCommands);
  const reference = cfg.warningReference;

  let verified = false;
  let pendingTestCallId: string | null = null;
  const pendingShipWarnings = new Map<string, string>();

  const getCommand = (event: { input: unknown }): string => {
    const input = event.input as { command?: unknown } | undefined;
    return typeof input?.command === "string" ? input.command : "";
  };

  const getPath = (event: { input: unknown }): string | undefined => {
    const input = event.input as { path?: unknown } | undefined;
    return typeof input?.path === "string" ? input.path : undefined;
  };

  pi.on("tool_call", async (event) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      if (isSourceWrite(getPath(event))) verified = false;
      return undefined;
    }

    if (event.toolName !== "bash") return undefined;
    const command = getCommand(event);
    if (!command) return undefined;

    if (testRegex.test(command)) {
      pendingTestCallId = event.toolCallId;
      return undefined;
    }

    if (SHIP_CMD.test(command) && !verified) {
      pendingShipWarnings.set(event.toolCallId, formatWarning(command, testCommands, reference));
    }
    return undefined;
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName !== "bash") return undefined;

    if (pendingTestCallId === event.toolCallId) {
      pendingTestCallId = null;
      if (!event.isError) verified = true;
    }

    const warning = pendingShipWarnings.get(event.toolCallId);
    if (!warning) return undefined;
    pendingShipWarnings.delete(event.toolCallId);

    return {
      content: [{ type: "text" as const, text: warning }, ...event.content],
    };
  });
}
