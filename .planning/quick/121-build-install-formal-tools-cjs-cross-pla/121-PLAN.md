---
phase: quick-121
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install-formal-tools.cjs
  - bin/install.js
  - VERIFICATION_TOOLS.md
  - README.md
  - docs/QUORUM_CONSENSUS.md
  - docs/quorum_interface.md
autonomous: true
requirements: [QUICK-121]

must_haves:
  truths:
    - "node bin/install-formal-tools.cjs downloads tla2tools.jar and alloy.dist.jar on a fresh clone"
    - "Running the script twice is idempotent — second run prints skip arrows, exits 0"
    - "node bin/install.js --formal execs install-formal-tools.cjs and exits"
    - "VERIFICATION_TOOLS.md Prerequisites section points to the new script"
    - "README.md formal verification Prerequisites table points to the new script"
    - "QUORUM_CONSENSUS.md and quorum_interface.md live under docs/"
  artifacts:
    - path: "bin/install-formal-tools.cjs"
      provides: "Cross-platform formal tool installer"
    - path: "docs/QUORUM_CONSENSUS.md"
      provides: "Moved from root"
    - path: "docs/quorum_interface.md"
      provides: "Moved from root"
  key_links:
    - from: "bin/install.js"
      to: "bin/install-formal-tools.cjs"
      via: "spawnSync or execFileSync on --formal flag"
      pattern: "hasFormal.*install-formal-tools"
---

<objective>
Build bin/install-formal-tools.cjs — a cross-platform Node.js script that automates
downloading TLA+, Alloy, and PRISM formal verification tools. Wire it into bin/install.js
via --formal flag. Update prerequisite docs to reference the new script. Move two
loose root-level docs into docs/.

Purpose: Replace manual curl commands with a single idempotent installer so contributors
can set up the full formal verification pipeline in one step.
Output: bin/install-formal-tools.cjs, updated bin/install.js, updated docs.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@VERIFICATION_TOOLS.md
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/install-formal-tools.cjs</name>
  <files>bin/install-formal-tools.cjs</files>
  <action>
Create a new CommonJS script. Use only Node.js built-ins (https, fs, path, os, child_process,
zlib) — no npm dependencies. Structure:

**Colors / output helpers:**
- `ok(msg)` — prints `\x1b[32m✓\x1b[0m msg`
- `skip(msg)` — prints `\x1b[33m→\x1b[0m msg`
- `fail(msg)` — prints `\x1b[31m✗\x1b[0m msg`

**downloadFile(url, dest):** Promise-based HTTPS download following redirects (use
`https.get`, handle 301/302 by recursing with response.headers.location). Write to dest
via fs.createWriteStream. Reject on non-200 after redirects.

**Java check (soft warning, never blocks):**
- spawnSync('java', ['-version'], { encoding: 'utf8', stdio: 'pipe' })
- Parse stderr (java -version prints to stderr) for version number — match /(\d+)/ from
  first token like "17.0.x" or legacy "1.8.0"; treat "1.x" as x for pre-9 versions
- If exit code !== 0 OR version < 17: print warning with https://adoptium.net/ link
  but continue (soft warning only, do NOT exit)

**TLA+ install:**
- dest = path.join(process.cwd(), '.formal/tla/tla2tools.jar')
- URL = 'https://github.com/tlaplus/tlaplus/releases/latest/download/tla2tools.jar'
- If fs.existsSync(dest): skip('TLA+ tla2tools.jar already present — skipping')
- Else: download, ok('TLA+ tla2tools.jar downloaded')
- Track result: { name: 'TLA+', status: 'ok'|'skip'|'fail' }

**Alloy install:**
- dest = path.join(process.cwd(), '.formal/alloy/org.alloytools.alloy.dist.jar')
- URL = 'https://github.com/AlloyTools/org.alloytools.alloy/releases/latest/download/org.alloytools.alloy.dist.jar'
- Same skip/download pattern as TLA+
- Track result: { name: 'Alloy', status: 'ok'|'skip'|'fail' }

**PRISM install (platform-specific, non-blocking):**
Detect skip condition first: if process.env.PRISM_BIN is set AND
fs.existsSync(process.env.PRISM_BIN): skip('PRISM already configured — skipping')
and record status: 'skip'.

Otherwise by platform (process.platform):

darwin:
  - tmpDir = os.tmpdir()
  - tarUrl = 'https://www.prismmodelchecker.org/dl/prism-4.8.1-mac64.tar.gz'
  - Download to path.join(tmpDir, 'prism-mac64.tar.gz')
  - Extract: spawnSync('tar', ['-xzf', tarPath, '-C', tmpDir], { stdio: 'inherit' })
  - Find extracted dir: fs.readdirSync(tmpDir).find(d => d.startsWith('prism-'))
  - Run install: spawnSync('bash', ['./install.sh'], { cwd: extractedDir, stdio: 'inherit' })
  - xattr quarantine fix: spawnSync('xattr', ['-dr', 'com.apple.quarantine', extractedDir],
    { stdio: 'pipe' }) — ignore errors (flag may not exist)
  - Print: `  export PRISM_BIN="${extractedDir}/bin/prism"` — suggest adding to shell profile
  - On any error: fail('PRISM install failed — see https://prismmodelchecker.org/download.php')
    record status: 'fail' but do NOT exit non-zero

linux:
  - tarUrl = 'https://www.prismmodelchecker.org/dl/prism-4.8.1-linux64.tar.gz'
  - Same extract + install.sh pattern as darwin
  - Print symlink suggestion: `  sudo ln -s "${extractedDir}/bin/prism" /usr/local/bin/prism`
  - OR: `  export PRISM_BIN="${extractedDir}/bin/prism"`

win32:
  - exeUrl = 'https://www.prismmodelchecker.org/dl/prism-4.8.1-win-installer.exe'
  - Download to path.join(os.tmpdir(), 'prism-installer.exe')
  - Run: spawnSync(installerPath, ['/S'], { stdio: 'inherit' }) — silent NSIS install
  - Print: 'Add C:\\Program Files\\PRISM\\bin to your PATH'

**Petri nets:**
- Just print: skip('Petri nets — no install needed, bundled via @hpcc-js/wasm-graphviz npm')

**Summary table:**
Print a simple summary after all installs:

```
  Results:
    TLA+    ✓ installed    (or → skipped / ✗ failed)
    Alloy   ✓ installed
    PRISM   → skipped
    Petri   → bundled
```

**Exit code:**
- Exit 0 if TLA+ status !== 'fail' AND Alloy status !== 'fail'
- Exit 1 otherwise
- PRISM failure is non-blocking (warning only)

Wrap the entire main logic in an async IIFE:
```js
(async () => { ... })().catch(err => { fail(err.message); process.exit(1); });
```
  </action>
  <verify>
node bin/install-formal-tools.cjs
# First run: downloads jars, prints ✓ lines, exits 0
# Verify files exist:
ls .formal/tla/tla2tools.jar .formal/alloy/org.alloytools.alloy.dist.jar

# Second run (idempotent):
node bin/install-formal-tools.cjs
# Must print → skip lines for TLA+ and Alloy, exit 0
echo "Exit: $?"
  </verify>
  <done>
tla2tools.jar and org.alloytools.alloy.dist.jar present under .formal/. Second run prints
skip arrows and exits 0. Script exits 0 when TLA+ and Alloy succeed regardless of PRISM
outcome.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire --formal flag into bin/install.js and update docs</name>
  <files>
    bin/install.js
    VERIFICATION_TOOLS.md
    README.md
    docs/QUORUM_CONSENSUS.md
    docs/quorum_interface.md
  </files>
  <action>
**bin/install.js — add --formal flag:**

1. In the arg-parsing block (lines 21-34), add after `hasMigrateSlots`:
   ```js
   const hasFormal = args.includes('--formal');
   ```

2. After the `hasMigrateSlots` block (after line 2343, before "// Main logic"), add:
   ```js
   if (hasFormal) {
     const { spawnSync } = require('child_process');
     const formalScript = path.join(__dirname, 'install-formal-tools.cjs');
     const result = spawnSync(process.execPath, [formalScript], { stdio: 'inherit' });
     process.exit(result.status ?? 0);
   }
   ```

3. In the hasHelp block (the long console.log string around line 323), append to the
   options list:
   `    ${cyan}--formal${reset}                  Install formal verification tools (TLA+, Alloy, PRISM)\n`

**VERIFICATION_TOOLS.md — replace Prerequisites section:**

Replace the entire "## Shared Prerequisite: Java 17" section (lines 5-25) with:

```markdown
## Prerequisites

Install all formal verification tools in one step:

```bash
node bin/install-formal-tools.cjs
# or via the installer:
node bin/install.js --formal
```

This script:
- Checks for Java 17+ (required by TLA+, Alloy, PRISM) and warns if missing
- Downloads `tla2tools.jar` into `.formal/tla/`
- Downloads `org.alloytools.alloy.dist.jar` into `.formal/alloy/`
- Downloads and installs PRISM for your platform, prints `PRISM_BIN` export
- Notes that Petri nets require no install (bundled via npm)

Idempotent — safe to run multiple times. PRISM install is non-blocking.

If you prefer manual installation, download Java 17 from https://adoptium.net/
and follow the per-tool instructions below.
```

Keep all sections below (TLA+, Alloy 6, PRISM, Petri Net, npm test) unchanged.

**README.md — update formal verification Prerequisites table:**

Find the Prerequisites section under "### Formal Verification" (around line 686-699).
Replace the table and the paragraph above it with:

```markdown
#### Prerequisites

TLA+, Alloy, and PRISM all require Java 17+. Petri nets need no extra install (bundled via npm).

One-step install:

```bash
node bin/install-formal-tools.cjs
# or: node bin/install.js --formal
```

Full per-tool documentation: **[VERIFICATION_TOOLS.md](VERIFICATION_TOOLS.md)**

Quick summary:

| Tool | Requires | One-time setup |
|------|----------|----------------|
| TLA+ | Java 17+ | Auto-downloaded to `.formal/tla/` by install script |
| Alloy 6 | Java 17+ | Auto-downloaded to `.formal/alloy/` by install script |
| PRISM | Java 17+ | Downloaded + installed by script; set `PRISM_BIN` as instructed |
| Petri nets | — | Nothing — bundled via `@hpcc-js/wasm-graphviz` |
```

**Move loose root docs to docs/:**

Use fs.renameSync (or just create the new files with the same content and delete old ones).
Since this is a task for Claude to execute, perform these moves via Node.js in a small
inline script, OR use the Write tool to create docs/QUORUM_CONSENSUS.md and
docs/quorum_interface.md with the same content as the originals, then delete the originals.

The target paths are:
- docs/QUORUM_CONSENSUS.md  (move from QUORUM_CONSENSUS.md)
- docs/quorum_interface.md  (move from quorum_interface.md)

After moving, check if any file in the repo references the old root-level paths and update
them. Use grep to find: `grep -r "QUORUM_CONSENSUS\|quorum_interface" --include="*.md" .`
Update any found references to use `docs/` prefix.
  </action>
  <verify>
# Verify --formal flag dispatch:
node bin/install.js --formal 2>&1 | head -5
# Should exec install-formal-tools.cjs (prints its output)

# Verify docs moved:
ls docs/QUORUM_CONSENSUS.md docs/quorum_interface.md
# Old paths must be gone:
test ! -f QUORUM_CONSENSUS.md && echo "root copy gone" || echo "ERROR: still at root"
test ! -f quorum_interface.md && echo "root copy gone" || echo "ERROR: still at root"

# Verify VERIFICATION_TOOLS.md updated:
head -15 VERIFICATION_TOOLS.md | grep "install-formal-tools"

# Verify README.md updated:
grep "install-formal-tools" README.md
  </verify>
  <done>
node bin/install.js --formal runs the formal installer. VERIFICATION_TOOLS.md and
README.md reference the new script. QUORUM_CONSENSUS.md and quorum_interface.md are
under docs/ with root copies deleted and any inbound references updated.
  </done>
</task>

</tasks>

<verification>
node bin/install-formal-tools.cjs        # exits 0, jars present
node bin/install-formal-tools.cjs        # exits 0, prints skip arrows (idempotent)
node bin/install.js --formal             # dispatches to installer, exits 0
grep "install-formal-tools" README.md    # appears in Prerequisites
grep "install-formal-tools" VERIFICATION_TOOLS.md
ls docs/QUORUM_CONSENSUS.md docs/quorum_interface.md
test ! -f QUORUM_CONSENSUS.md && test ! -f quorum_interface.md && echo "root copies removed"
npm test                                 # existing tests unaffected
</verification>

<success_criteria>
- bin/install-formal-tools.cjs downloads TLA+ and Alloy jars on first run, skips on re-run
- node bin/install.js --formal dispatches to install-formal-tools.cjs
- VERIFICATION_TOOLS.md Prerequisites section references the new script
- README.md formal verification Prerequisites table references the new script
- docs/QUORUM_CONSENSUS.md and docs/quorum_interface.md exist; root copies removed
- npm test passes (no regressions)
</success_criteria>

<output>
After completion, create `.planning/quick/121-build-install-formal-tools-cjs-cross-pla/121-SUMMARY.md`
</output>
