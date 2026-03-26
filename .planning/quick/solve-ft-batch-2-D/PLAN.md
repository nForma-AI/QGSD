---
phase: solve-ft-batch-2-D
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/BML-01.stub.test.js
  - .planning/formal/generated-stubs/BML-03.stub.test.js
  - .planning/formal/generated-stubs/CEX-01.stub.test.js
  - .planning/formal/generated-stubs/CEX-02.stub.test.js
  - .planning/formal/generated-stubs/CEX-03.stub.test.js
autonomous: true
requirements: [BML-01, BML-03, CEX-01, CEX-02, CEX-03]
formal_artifacts: none
---

<objective>
Implement 5 test stubs for BML and CEX requirements.

For each stub, read its recipe JSON for pre-resolved context, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- BML-01: model=.planning/formal/tla/BugModelLookup.tla strategy=behavioral
  recipe=.planning/formal/generated-stubs/BML-01.stub.recipe.json
- BML-03: model=.planning/formal/tla/BugModelLookup.tla strategy=structural
  recipe=.planning/formal/generated-stubs/BML-03.stub.recipe.json
- CEX-01: model=.planning/formal/alloy/constraint-extraction.als strategy=structural
  recipe=.planning/formal/generated-stubs/CEX-01.stub.recipe.json
- CEX-02: model=.planning/formal/alloy/constraint-extraction.als strategy=structural
  recipe=.planning/formal/generated-stubs/CEX-02.stub.recipe.json
- CEX-03: model=.planning/formal/alloy/constraint-extraction.als strategy=structural
  recipe=.planning/formal/generated-stubs/CEX-03.stub.recipe.json
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: BML-01, BML-03, CEX-01, CEX-02, CEX-03</name>
  <files>.planning/formal/generated-stubs/BML-01.stub.test.js, .planning/formal/generated-stubs/BML-03.stub.test.js, .planning/formal/generated-stubs/CEX-01.stub.test.js, .planning/formal/generated-stubs/CEX-02.stub.test.js, .planning/formal/generated-stubs/CEX-03.stub.test.js</files>
  <action>
For each stub:
1. Read .planning/formal/generated-stubs/{ID}.stub.recipe.json
2. Read the stub file (.stub.test.js)
3. Use recipe.formal_property.definition as the property under test
4. Import from recipe.import_hint (adjust relative path if needed)
5. Follow recipe.test_strategy:
   - structural: assert function/export exists with correct signature
   - behavioral: call function with known input, assert output matches formal property
   - constant: assert code constant === formal value from property definition
6. If recipe.source_files is empty, use Grep to find the implementing module
7. Replace assert.fail('TODO') with real test logic using node:test + node:assert/strict
  </action>
  <verify>node --test .planning/formal/generated-stubs/BML-01.stub.test.js .planning/formal/generated-stubs/BML-03.stub.test.js .planning/formal/generated-stubs/CEX-01.stub.test.js .planning/formal/generated-stubs/CEX-02.stub.test.js .planning/formal/generated-stubs/CEX-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
