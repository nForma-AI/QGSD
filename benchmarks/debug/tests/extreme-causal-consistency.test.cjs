'use strict';
var { isCausallyConsistent } = require('../../../bin/bench-buggy-extreme-causal-consistency.cjs');
var failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// W1 → W2: if W2 is visible, W1 must also be visible.
var causalPairs = [{cause: 'W1', effect: 'W2'}];

// VALID: both visible
assert('sees both W1 and W2: consistent', isCausallyConsistent(['W1', 'W2'], causalPairs) === true,
  'got false');

// INVALID: sees W2 (effect) but not W1 (cause) — causally inconsistent
// Buggy: cause W1 is NOT visible → skips check → returns true (misses violation!)
assert('sees W2 without W1: inconsistent', isCausallyConsistent(['W2'], causalPairs) === false,
  'isCausallyConsistent(["W2"],[{cause:W1,effect:W2}]) returned true — ' +
  'effect visible without cause, violation missed (wrong implication direction)');

// VALID: sees neither
assert('sees neither: consistent', isCausallyConsistent([], causalPairs) === true, 'got false');

// VALID: sees only W1 (cause without effect is fine — effect might not have been sent yet)
// Buggy: cause W1 IS visible → checks effect W2 → W2 not visible → returns FALSE (incorrect!)
assert('sees only W1: consistent', isCausallyConsistent(['W1'], causalPairs) === true,
  'isCausallyConsistent(["W1"]) returned false — cause visible without effect is valid, ' +
  'bug incorrectly rejects it (wrong direction check)');

// Chain: W1 → W2 → W3
var chain = [{cause: 'W1', effect: 'W2'}, {cause: 'W2', effect: 'W3'}];

// VALID: all visible
assert('chain all visible: consistent', isCausallyConsistent(['W1','W2','W3'], chain) === true, 'got false');

// INVALID: W3 visible but W2 missing
assert('chain W3 visible W2 missing: inconsistent', isCausallyConsistent(['W1','W3'], chain) === false,
  'chain violation missed: W3 visible but W2 not visible');

// INVALID: W2 visible but W1 missing
assert('chain W2 visible W1 missing: inconsistent', isCausallyConsistent(['W2','W3'], chain) === false,
  'chain violation missed: W2 visible but W1 not visible');

// VALID: W1, W2 visible (W3 not yet propagated)
assert('chain partial W1,W2: consistent', isCausallyConsistent(['W1','W2'], chain) === true,
  'valid partial chain incorrectly rejected');

// Multiple independent pairs: W1→W2 and W3→W4
var multi = [{cause:'W1',effect:'W2'},{cause:'W3',effect:'W4'}];

// INVALID: W2 visible, W1 missing (first pair violated)
assert('multi: W2 without W1 inconsistent', isCausallyConsistent(['W2','W3','W4'], multi) === false,
  'multi-pair violation in first pair missed');

// VALID: W3 visible without W4 (cause without effect is fine)
assert('multi: W3 without W4 valid', isCausallyConsistent(['W1','W2','W3'], multi) === true,
  'valid state incorrectly rejected');

process.exit(failed > 0 ? 1 : 0);
