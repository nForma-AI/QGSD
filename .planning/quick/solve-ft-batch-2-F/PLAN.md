---
phase: solve-ft-batch-2-F
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/ROUTE-01.stub.test.js
  - .planning/formal/generated-stubs/SESSION-01.stub.test.js
  - .planning/formal/generated-stubs/SESSION-02.stub.test.js
  - .planning/formal/generated-stubs/SESSION-03.stub.test.js
autonomous: true
requirements: [ROUTE-01, SESSION-01, SESSION-02, SESSION-03]
formal_artifacts: none
---

<objective>
Implement 4 test stubs for ROUTE and SESSION requirements.

For each stub, read its recipe JSON for pre-resolved context, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- ROUTE-01: model=.planning/formal/tla/TaskClassification.tla strategy=structural
  recipe=.planning/formal/generated-stubs/ROUTE-01.stub.recipe.json
- SESSION-01: model=.planning/formal/tla/SessionStateInjection.tla strategy=structural
  recipe=.planning/formal/generated-stubs/SESSION-01.stub.recipe.json
- SESSION-02: model=.planning/formal/tla/SessionStateInjection.tla strategy=structural
  recipe=.planning/formal/generated-stubs/SESSION-02.stub.recipe.json
- SESSION-03: model=.planning/formal/tla/SessionStateInjection.tla strategy=structural
  recipe=.planning/formal/generated-stubs/SESSION-03.stub.recipe.json
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: ROUTE-01, SESSION-01, SESSION-02, SESSION-03</name>
  <files>.planning/formal/generated-stubs/ROUTE-01.stub.test.js, .planning/formal/generated-stubs/SESSION-01.stub.test.js, .planning/formal/generated-stubs/SESSION-02.stub.test.js, .planning/formal/generated-stubs/SESSION-03.stub.test.js</files>
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
  <verify>node --test .planning/formal/generated-stubs/ROUTE-01.stub.test.js .planning/formal/generated-stubs/SESSION-01.stub.test.js .planning/formal/generated-stubs/SESSION-02.stub.test.js .planning/formal/generated-stubs/SESSION-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
