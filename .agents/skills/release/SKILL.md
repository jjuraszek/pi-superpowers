---
name: release
description: Use when asked to release, publish, bump the version, or cut a tag for jjuraszek/pi-gauntlet.
---

# Release

Use this skill when asked to release this package.

## Overview

`pi-gauntlet` publishes to **npm** (public, unscoped); the `pi-package` keyword
lists it on `https://pi.dev/packages/pi-gauntlet`. Users install with
`pi install npm:pi-gauntlet`.

The release is **tag-driven and CI-executed**: pushing a `vX.Y.Z` tag triggers
`.github/workflows/release.yml`, which gates on `tag == package.json`, runs
`npm test` (`scripts/ci.mjs`), and runs `npm publish --provenance --access
public` via **OIDC trusted publishing**. The local flow only assigns the version
and pushes the tag; **never run `npm publish` by hand.**

All mechanics live in `.agents/skills/release/scripts/release.sh`. This skill is
the judgment layer around it: propose the level, get approval, then run the
script. The script's config header is the only part that differs from the
pi-cohort copy - keep them in sync.

`scripts/ci.mjs` asserts `package.json` version == tag == `CHANGELOG.md` top
heading. All three must be the identical `X.Y.Z` string or both the local
pre-flight and CI fail.

## Boundaries

- Reads: git log/tags, `package.json`, `CHANGELOG.md`, pi `settings.json` files.
- Writes (only when you run the matching command): `package.json` version, a
  release commit, the `vX.Y.Z` tag, and - only with an explicit `--apply` and a
  separate approval - `settings.json` pins.
- Does NOT: run `npm publish`, edit consumer project files, or rewrite
  `~/.pi/**/settings.json` without a distinct approval for that action.

## Tag scheme

`v<major>.<minor>.<patch>` - plain semver, matching the workflow filter
`v[0-9]+.[0-9]+.[0-9]+`. `package.json` `version` mirrors the tag without the
leading `v`.

## Bump policy

| Level | When |
|---|---|
| `patch` | fixes, skill/agent/extension prose, non-breaking internal changes |
| `minor` | new skill, agent, or extension |
| `major` | skill/agent rename, breaking config-schema change (settings-key rename, package rename), extension API removal |

## Process

### 1. Propose the level - require explicit approval

```bash
bash .agents/skills/release/scripts/release.sh propose
```

Present the commits, the heuristic level, and the resulting `X.Y.Z` with a
one-line rationale tied to specific commits. **Stop and wait** for the user to
accept or override. Never pick the level and proceed in one step.

### 2. Bump package.json + CHANGELOG in one commit

Because `ci.mjs` gates all three strings, set them together before tagging:

- set `package.json` `version` to the agreed `X.Y.Z`
- make the top `CHANGELOG.md` heading `## vX.Y.Z - <date>` for that version
- `git commit -m "Release vX.Y.Z"`

### 3. Tag, push, verify - require explicit approval of the exact command

```bash
bash .agents/skills/release/scripts/release.sh current
bash .agents/skills/release/scripts/release.sh --dry-run current   # preview, no changes
```

`current` tags the version already committed. The script verifies `main` + a
clean tree, runs `npm test` as a pre-flight (which fails if the three strings
disagree), creates the annotated tag, pushes `main` + the tag, then chains
straight into verification. The `patch`/`minor`/`major` modes also exist, but
they bump only `package.json` - on this repo the pre-flight `npm test` then
aborts because the CHANGELOG heading is stale, so prefer the `current` path
above.

### 4. Verification (the script runs this automatically after a push)

To re-run standalone:

```bash
bash .agents/skills/release/scripts/release.sh verify           # current package.json version
bash .agents/skills/release/scripts/release.sh verify 4.1.0
```

It watches the release workflow to a terminal state (`gh` if present), polls
`npm view pi-gauntlet@X.Y.Z version` until live, then checks the pi.dev catalog.
Only claim success once `npm view` prints the new version. pi.dev lags npm by
minutes to hours - report crawl lag, do not loop on it.

### 5. Optional - propose preset pin sync

Offer only when relevant. Requires its own explicit approval before `--apply`.

```bash
bash .agents/skills/release/scripts/release.sh sync-presets            # report only
bash .agents/skills/release/scripts/release.sh sync-presets --apply    # rewrite same-form npm pins
```

Scans `settings.json` under `~/.pi` and this repo's parent tree. Same-form npm
pins (`npm:pi-gauntlet@<old>`) are bumped by `--apply`; git-tag pins and stale
`pi-superpowers` names are reported for manual migration, never auto-rewritten.

## Safety checks

Refuse to proceed unless ALL hold; report which failed, do not silently fix:

- working tree clean (for `current`, commit feature work first)
- releasing from `main`
- the target `vX.Y.Z` tag does not already exist (the script enforces this)
- `npm test` passes (the script's pre-flight; also the CI gate)
- `package.json` version == tag == CHANGELOG top heading

## Pair with pi-cohort

pi-gauntlet depends on the [pi-cohort](https://github.com/jjuraszek/pi-cohort)
dispatch package (`subagent()`). They version independently, but **release
together whenever dispatch semantics change** - a skill relying on a new
pi-cohort dispatch shape must ship alongside the pi-cohort release that provides
it, and the README peer-dependency minimum bumps in the same pi-gauntlet
release. When only pi-gauntlet-internal content changes, release it alone.

## Red Flags - STOP

- about to run `npm publish` locally - push the tag, let CI publish
- picked the bump level without user confirmation
- reported success without `npm view pi-gauntlet@X.Y.Z` printing the version
- retrying the pi.dev fetch "until it appears" - that's crawl lag, not failure
- editing a `~/.pi/**/settings.json` without its own explicit approval
- `package.json` version, tag, and CHANGELOG heading are not the identical string

## First-time npm setup (one-off, not per release)

`pi-gauntlet` must be registered once as a **trusted publisher** on npmjs.com:
Settings -> Trusted Publishing -> GitHub Actions publisher for repo
`jjuraszek/pi-gauntlet`, workflow `release.yml`. Until it exists the publish
step cannot authenticate (403).
