#!/usr/bin/env node
/**
 * Install agents/*.md into the pi-subagents discovery path.
 *
 * Two modes, chosen by where this package was installed:
 *
 *   - PROJECT install (package lives under <repo>/.pi/...): copy personas into
 *     <repo>/.pi/agents/ so pi-subagents discovers them at PROJECT scope. Copy
 *     (not symlink) because a consumer may commit .pi/agents/; a symlink would
 *     point into the gitignored .pi/git/... install dir and commit as a broken
 *     machine-local path. The dir is install-managed, so copies refresh on every
 *     install. Project scope wins over user scope, keeping repos independent.
 *
 *   - USER install (package under <home>/.pi/<profile>/...) or a local-path dev
 *     install (no .pi ancestor): symlink personas into getAgentDir()/agents,
 *     i.e. $PI_CODING_AGENT_DIR/agents or ~/.pi/agent/agents by default. This is
 *     pi-subagents' profile-scoped user dir (userDirOld), so each pi profile
 *     gets its own personas instead of sharing the global ~/.agents. Symlinks
 *     give live dev-edit and refresh on install; non-symlink files are left.
 *
 * Migration: pi-subagents discovers BOTH getAgentDir()/agents and the legacy
 * global ~/.agents, and ~/.agents wins on name collisions. Older versions of
 * this package symlinked into ~/.agents, so on a user install we remove any
 * stale ~/.agents/<name>.md symlinks that point into a pi-superpowers package;
 * otherwise they would shadow the new profile-scoped install.
 *
 * Override the target dir via PI_SUPERPOWERS_AGENT_DIR (always symlink mode).
 *
 * Invoked automatically by `npm install` (which pi runs on git package installs)
 * and manually via `npm run link-agents` for local-path dev installs.
 */
import { readdirSync, symlinkSync, unlinkSync, mkdirSync, existsSync, lstatSync, copyFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { homedir } from "node:os";

const PKG_DIR = dirname(fileURLToPath(import.meta.url)).replace(/\/bin$/, "");
const AGENTS_SRC = join(PKG_DIR, "agents");

if (!existsSync(AGENTS_SRC)) {
  console.log(`pi-superpowers: no agents/ dir at ${AGENTS_SRC}; skipping`);
  process.exit(0);
}

const personas = readdirSync(AGENTS_SRC).filter((n) => n.endsWith(".md"));
const { target, mode } = resolveTarget(PKG_DIR);
if (!existsSync(target)) mkdirSync(target, { recursive: true });

for (const f of personas) {
  const src = join(AGENTS_SRC, f);
  const dst = join(target, f);
  const dstStat = safelstat(dst);

  if (mode === "copy") {
    if (dstStat?.isSymbolicLink()) unlinkSync(dst);
    copyFileSync(src, dst);
    console.log(`pi-superpowers: copied ${dst}`);
    continue;
  }

  if (dstStat === null) {
    symlinkSync(src, dst);
    console.log(`pi-superpowers: linked ${dst}`);
  } else if (dstStat.isSymbolicLink()) {
    unlinkSync(dst);
    symlinkSync(src, dst);
    console.log(`pi-superpowers: refreshed ${dst}`);
  } else {
    console.warn(`pi-superpowers: skip ${dst} (not a symlink; delete to install)`);
  }
}

if (mode === "symlink") migrateLegacyGlobalLinks(personas, target);

/**
 * Decide where personas go and how. A project install is one whose nearest
 * `.pi` ancestor is NOT the user's home `.pi` (i.e. `<repo>/.pi`, not
 * `<home>/.pi/<profile>`). Env override always forces user-style symlinks.
 */
function resolveTarget(pkgDir) {
  if (process.env.PI_SUPERPOWERS_AGENT_DIR) {
    return { target: expandTilde(process.env.PI_SUPERPOWERS_AGENT_DIR), mode: "symlink" };
  }
  const piDir = findPiAncestor(pkgDir);
  if (piDir && canonical(dirname(piDir)) !== canonical(homedir())) {
    return { target: join(piDir, "agents"), mode: "copy" };
  }
  return { target: join(getAgentDir(), "agents"), mode: "symlink" };
}

/** Mirror of pi-subagents shared/utils.ts getAgentDir(). */
function getAgentDir() {
  const configured = process.env.PI_CODING_AGENT_DIR;
  if (configured === "~") return homedir();
  if (configured?.startsWith("~/")) return join(homedir(), configured.slice(2));
  return configured || join(homedir(), ".pi", "agent");
}

/**
 * Remove stale ~/.agents/<name>.md symlinks left by older versions, so the
 * legacy global dir stops shadowing the profile-scoped install. Only touches
 * symlinks resolving into a pi-superpowers package; leaves real files and
 * unrelated links alone. Skips when the new target already IS ~/.agents.
 */
function migrateLegacyGlobalLinks(names, newTarget) {
  const legacy = join(homedir(), ".agents");
  if (canonical(legacy) === canonical(newTarget)) return;
  for (const f of names) {
    const p = join(legacy, f);
    const st = safelstat(p);
    if (!st?.isSymbolicLink()) continue;
    if (canonical(p).includes("pi-superpowers")) {
      unlinkSync(p);
      console.log(`pi-superpowers: removed legacy ${p}`);
    }
  }
}

function findPiAncestor(start) {
  let dir = start;
  for (;;) {
    if (basename(dir) === ".pi") return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function expandTilde(p) {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

function canonical(p) {
  try { return realpathSync(p); } catch { return p; }
}

function safelstat(p) {
  try { return lstatSync(p); } catch { return null; }
}
