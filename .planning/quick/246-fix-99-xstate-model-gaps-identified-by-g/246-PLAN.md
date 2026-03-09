---
phase: quick-246
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/build-layer-manifest.cjs
  - bin/build-layer-manifest.test.cjs
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix Gate A model gaps by improving the spec-module-to-model-path matching in
build-layer-manifest.cjs. Currently, 103 of 128 models are "ungrounded" because
computeLayerMaturity uses a naive substring match that fails when spec module
names use hyphens (e.g., "account-manager") but model filenames use PascalCase
or other conventions (e.g., "NFAccountManager.tla").

The fix: normalize both the spec module name and the model path by stripping
hyphens/underscores before comparing, so "account-manager" matches
"NFAccountManager". This single algorithmic fix will ground the majority of the
89 model_gap entries without creating any new spec modules.
</objective>

<tasks>
<task type="auto">
  <name>Improve computeLayerMaturity matching algorithm</name>
  <files>bin/build-layer-manifest.cjs</files>
  <action>
In computeLayerMaturity(), before the substring match, normalize both the
spec module name and the model path by:
1. Lowercasing both
2. Removing all hyphens and underscores from both
3. Then checking if the normalized model path includes the normalized module name

This way "account-manager" -> "accountmanager" matches "nfaccountmanager.tla",
"stop-hook" -> "stophook" matches "nfstophook.tla", etc.

Also add a secondary match: split the spec module name on hyphens and check
if ALL parts appear in the model path (order-independent). This catches cases
like "tui-nav" matching "TUINavigation" (tuinav vs tuinavigation).
  </action>
  <verify>
Run: node bin/build-layer-manifest.cjs --json | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const layers=d.layers||{};
  let hasSD=0,noSD=0;
  for(const[,entries]of Object.entries(layers))
    for(const e of(Array.isArray(entries)?entries:[]))
      if(e.grounding_status==='has_semantic_declarations')hasSD++;else noSD++;
  console.log('has_semantic_declarations:',hasSD,'ungrounded:',noSD);
"
Expect has_semantic_declarations to be significantly higher than 25.
  </verify>
  <done>computeLayerMaturity uses normalized matching. Grounded model count increased.</done>
</task>

<task type="auto">
  <name>Rebuild per-model gates and verify Gate A improvement</name>
  <files>bin/compute-per-model-gates.cjs</files>
  <action>
1. Run build-layer-manifest.cjs to update the registry and manifest
2. Run compute-per-model-gates.cjs --aggregate --json to recompute all gate scores
3. Verify the Gate A grounding_score improved (target: > 0.5, ideally > 0.8)
  </action>
  <verify>
Run: node bin/compute-per-model-gates.cjs --aggregate --json | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Gate A pass:', d.scores.gate_a_pass, '/', d.total_models);
  console.log('Score:', (d.scores.gate_a_pass/d.total_models).toFixed(4));
"
  </verify>
  <done>Gate A grounding_score improved from 0.30 to > 0.50</done>
</task>
</tasks>
