---
status: resolved
trigger: "IVL-02 chain: full round-trip fails with AssertionError: run-formal-check should pass for quorum"
created: 2026-03-17T00:00:00Z
updated: 2026-03-17T00:00:00Z
---

## Current Focus

hypothesis: resolved
test: n/a
expecting: n/a
next_action: archived

## Symptoms

expected: `run-formal-check --modules=quorum` exits with status 0; IVL-02 full round-trip test passes
actual: AssertionError [ERR_ASSERTION]: run-formal-check should pass for quorum — actual: false, expected: true (line 380)
errors: AssertionError [ERR_ASSERTION]: run-formal-check should pass for quorum
reproduction: npm run test:formal
started: Pre-existing, likely introduced during v0.36 rebrand milestone

## Eliminated

- hypothesis: quorum TLC model has invariant violation
  evidence: Running `node bin/run-formal-check.cjs --modules=quorum` directly shows 3 passed, 0 failed. quorum was never broken.
  timestamp: 2026-03-17T00:00:00Z

- hypothesis: .planning/formal/spec/quorum/invariants.md missing
  evidence: File exists at that path, Step 1 of the test passes.
  timestamp: 2026-03-17T00:00:00Z

## Evidence

- timestamp: 2026-03-17T00:00:00Z
  checked: Direct run of `node bin/run-formal-check.cjs --modules=quorum`
  found: Exits 0, 3 checks passed. IVL-02 full round-trip actually passes now.
  implication: The IVL-02 test itself is not broken. A different test was the actual failure.

- timestamp: 2026-03-17T00:00:00Z
  checked: Full test suite `node --test bin/test-formal-integration.test.cjs`
  found: 21 pass, 0 fail. But separately, IVL-03 regression for `mcp-calls` failing: "mcp-calls should pass, got exit code 1"
  implication: The originally reported IVL-02 symptom was a test ordering artifact or stale report. The real failure is IVL-03 mcp-calls.

- timestamp: 2026-03-17T00:00:00Z
  checked: `run-formal-check.cjs` MODULE_CHECKS for mcp-calls — references `.planning/formal/tla/NFMCPEnv.tla`
  found: File `NFMCPEnv.tla` does not exist. Only `QGSDMCPEnv.tla` exists (pre-rebrand name).
  implication: Rebrand renamed the module in run-formal-check.cjs but did not rename the TLA file on disk.

- timestamp: 2026-03-17T00:00:00Z
  checked: `QGSDMCPEnv.tla` contents
  found: MODULE declaration is `MODULE QGSDMCPEnv`. TLC requires filename to match module name.
  implication: Must create NFMCPEnv.tla with MODULE NFMCPEnv declaration.

## Resolution

root_cause: Rebrand gap — `bin/run-formal-check.cjs` was updated to reference `NFMCPEnv.tla` during the QGSD→nForma rename, but the TLA spec file `.planning/formal/tla/QGSDMCPEnv.tla` was never renamed. TLC requires the filename to match the MODULE declaration, so passing `NFMCPEnv.tla` as a non-existent file caused a non-zero exit, making the IVL-03 mcp-calls regression test fail.

fix: Created `.planning/formal/tla/NFMCPEnv.tla` as a renamed copy of `QGSDMCPEnv.tla` with the MODULE declaration updated from `QGSDMCPEnv` to `NFMCPEnv`, and references to `qgsd-prompt.js` → `nf-prompt.js` and `QGSDDeliberation.tla` → `NFDeliberation.tla` in comments. Updated `MCMCPEnv.cfg` comment to reference the new filename.

verification: `node bin/run-formal-check.cjs --modules=mcp-calls` exits 0 (1 passed, 0 failed). Full test suite: 21 pass, 0 fail (1 skip for Java-not-found which cannot be tested when Java is present).

files_changed:
  - .planning/formal/tla/NFMCPEnv.tla (created — renamed from QGSDMCPEnv.tla with MODULE name updated)
  - .planning/formal/tla/MCMCPEnv.cfg (comment updated to reference NFMCPEnv.tla)
