# Quick Task 246: Fix Gate A Model Gaps

## What Changed

Improved the `computeLayerMaturity()` function in `bin/build-layer-manifest.cjs` to use
fuzzy matching between spec module names and model file paths. Previously, spec modules
like "account-manager" would not match model files like "NFAccountManager.tla" because
the hyphen-separated module name doesn't appear as a substring of the PascalCase filename.

### Matching Algorithm Changes

Added two new matching paths beyond the original exact substring:

1. **Stripped match**: Remove hyphens and underscores from both the spec module name and
   the model path before comparing. "account-manager" -> "accountmanager" matches
   "nfaccountmanager.tla".

2. **Parts match**: Split the spec module name on hyphens and check if ALL parts appear
   in the stripped model path. "tui-nav" -> ["tui","nav"] both found in "tuinavigation".

### Results

- Layer manifest grounded models: 25 -> 30 (+5)
- Gate B pass: 94 -> 124 (+30) — significant improvement due to better layer classification
- Gate A pass: 39 -> 38 (marginal change — most Gate A failures are due to missing formal
  verification passes, not manifest classification)

### Root Cause Analysis

The Gate A model gap (89-90 models) is primarily caused by 290 requirement IDs in the
traceability matrix lacking passing formal verification checks (`latest_result !== 'pass'`).
The matching algorithm fix addresses the manifest classification layer but cannot fix the
underlying formal verification gap. Future solve iterations need to run `run-formal-verify.cjs`
with working TLA+/Alloy toolchains to generate passing check results.

## Files Modified

- `bin/build-layer-manifest.cjs` — improved `computeLayerMaturity()` matching
