#!/usr/bin/env node
// Repo validator. Runs in CI on every push and as the release gate.
// No external deps: uses only Node built-ins so `npm test` needs no install.
//
// Usage:
//   node scripts/ci.mjs                      # validate repo
//   node scripts/ci.mjs --expect-version X   # also assert package.json == X (tag gate)

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => join(root, p);

const errors = [];
const fail = (msg) => errors.push(msg);
const ok = (msg) => console.log(`  ok  ${msg}`);

const expectIdx = process.argv.indexOf("--expect-version");
const expectVersion = expectIdx !== -1 ? process.argv[expectIdx + 1] : null;

// ---- package.json ----------------------------------------------------------
const pkg = JSON.parse(readFileSync(R("package.json"), "utf8"));

if (!pkg.name) fail("package.json: missing name");
if (!/^\d+\.\d+\.\d+/.test(pkg.version || "")) fail(`package.json: bad version "${pkg.version}"`);
if (pkg.private) fail("package.json: private:true would block publish");
if (!pkg.license) fail("package.json: missing license field");
if (!existsSync(R("LICENSE"))) fail("LICENSE file missing");
if (!existsSync(R("README.md"))) fail("README.md missing (npm shows it on the package page)");

const keywords = pkg.keywords || [];
if (!keywords.includes("pi-package"))
  fail('package.json: keywords must include "pi-package" (drives pi.dev/packages discovery)');
else ok('keyword "pi-package" present');

// files allowlist must ship what the postinstall persona copy needs
const files = pkg.files || [];
if (files.length === 0) {
  fail("package.json: no files allowlist (tarball would ship everything)");
} else {
  for (const need of ["agents", "bin"]) {
    if (!files.includes(need))
      fail(`package.json: files allowlist missing "${need}" (postinstall persona copy would break on npm install)`);
  }
  if (files.includes("agents") && files.includes("bin")) ok("files allowlist ships agents/ + bin/");
}

// pi manifest globs must resolve to real, non-empty dirs
for (const [key, arr] of Object.entries({ skills: pkg.pi?.skills, extensions: pkg.pi?.extensions })) {
  if (!Array.isArray(arr) || arr.length === 0) { fail(`package.json: pi.${key} missing`); continue; }
  for (const rel of arr) {
    const dir = R(rel.replace(/^\.\//, ""));
    if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`package.json: pi.${key} points at missing dir ${rel}`);
    else if (readdirSync(dir).length === 0) fail(`package.json: pi.${key} dir ${rel} is empty`);
  }
}
ok("pi manifest globs resolve");

// ---- version consistency: package.json == CHANGELOG top ==------------------
const changelog = readFileSync(R("CHANGELOG.md"), "utf8");
const clMatch = changelog.match(/^##\s+v(\d+\.\d+\.\d+)/m);
if (!clMatch) fail("CHANGELOG.md: no `## vX.Y.Z` heading found");
else if (clMatch[1] !== pkg.version)
  fail(`version drift: package.json ${pkg.version} != CHANGELOG top v${clMatch[1]}`);
else ok(`version aligned: ${pkg.version} == CHANGELOG top`);

if (expectVersion && expectVersion !== pkg.version)
  fail(`tag/version drift: pushed tag v${expectVersion} != package.json ${pkg.version}`);
else if (expectVersion) ok(`tag matches package.json (${pkg.version})`);

// ---- frontmatter on every skill + agent ------------------------------------
const hasFrontmatter = (file, required) => {
  const txt = readFileSync(file, "utf8");
  const m = txt.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return `no YAML frontmatter`;
  for (const field of required) if (!new RegExp(`^${field}:`, "m").test(m[1])) return `missing "${field}"`;
  return null;
};

for (const d of readdirSync(R("skills"))) {
  const skill = R(`skills/${d}/SKILL.md`);
  if (!existsSync(skill)) { fail(`skills/${d}: no SKILL.md`); continue; }
  const err = hasFrontmatter(skill, ["name", "description"]);
  if (err) fail(`skills/${d}/SKILL.md: ${err}`);
}
ok(`${readdirSync(R("skills")).length} skills have frontmatter`);

const agents = readdirSync(R("agents")).filter((f) => f.endsWith(".md"));
for (const a of agents) {
  const err = hasFrontmatter(R(`agents/${a}`), ["name", "description"]);
  if (err) fail(`agents/${a}: ${err}`);
}
ok(`${agents.length} agents have frontmatter`);

// ---- stale rename tokens (post-v4 regression guard) ------------------------
// "superpowers" alone is legit lineage; these renamed identifiers are not.
const forbidden = ["piSuperpowers", "PI_SUPERPOWERS_AGENT_DIR", "superpowers-overrides", "@jjuraszek/pi-superpowers"];
const scanDirs = ["skills", "extensions", "agents", "bin"];
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const hits = [];
for (const base of scanDirs) {
  for (const file of walk(R(base))) {
    const txt = readFileSync(file, "utf8");
    for (const tok of forbidden) if (txt.includes(tok)) hits.push(`${file.replace(root + "/", "")}: "${tok}"`);
  }
}
if (hits.length) fail("stale rename tokens found:\n    " + hits.join("\n    "));
else ok("no stale rename tokens in skills/extensions/agents/bin");

// ---- extension syntax (type-stripped parse) --------------------------------
for (const f of readdirSync(R("extensions")).filter((f) => f.endsWith(".ts"))) {
  try {
    execFileSync(process.execPath, ["--experimental-strip-types", "--check", R(`extensions/${f}`)], { stdio: "pipe" });
  } catch (e) {
    fail(`extensions/${f}: syntax error\n    ${String(e.stderr || e).split("\n").slice(0, 3).join("\n    ")}`);
  }
}
ok("extensions parse clean");

// ---- npm pack contents -----------------------------------------------------
try {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const packed = JSON.parse(out)[0].files.map((f) => f.path);
  if (!packed.some((f) => f.startsWith("agents/"))) fail("npm pack: no agents/ in tarball");
  if (!packed.some((f) => f.startsWith("bin/"))) fail("npm pack: no bin/ in tarball");
  if (packed.some((f) => f.startsWith("doc/"))) fail("npm pack: doc/ leaked into tarball");
  ok(`npm pack: ${packed.length} files, agents/ + bin/ present, no doc/ leak`);
} catch (e) {
  fail(`npm pack failed: ${String(e.stderr || e).split("\n")[0]}`);
}

// ---- report ----------------------------------------------------------------
if (errors.length) {
  console.error(`\nFAIL (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`\nPASS: repo valid${expectVersion ? ` for release v${expectVersion}` : ""}`);
