'use strict';
var { f } = require('../../../bin/bench-buggy-extreme-fencing-token.cjs');
var failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Formal invariant: f(cur, tok) iff tok >= cur (numeric comparison).
// Enumerate integer pairs and expose lexicographic-vs-numeric divergence.
var epochs = [1, 2, 8, 9, 10, 11, 19, 20, 100, 101];
for (var i = 0; i < epochs.length; i++) {
  for (var j = 0; j < epochs.length; j++) {
    var cur = epochs[i], tok = epochs[j];
    var expected = tok >= cur; // numeric
    var got = f(cur, tok);
    assert(
      'f(cur=' + cur + ',tok=' + tok + ')',
      got === expected,
      'expected ' + expected + ' got ' + got + ' (string: "' + String(tok) + '">="' + String(cur) + '"=' + (String(tok) >= String(cur)) + ')'
    );
  }
}

// Specific cases where string order inverts numeric order:
// '10' < '9' lexicographically → f(9, 10) should be true but bug returns false
assert('epoch 10 valid vs current 9', f(9, 10) === true,
  'f(9,10) returned false — "10" < "9" string comparison bug');
assert('epoch 11 valid vs current 9', f(9, 11) === true,
  'f(9,11) returned false');
assert('epoch 10 valid vs current 10', f(10, 10) === true,
  'got ' + f(10, 10));
assert('epoch 8 invalid vs current 9', f(9, 8) === false,
  'got ' + f(9, 8));
// '2' > '19' lexicographically → f(19, 2) should be false but bug returns true
assert('epoch 2 invalid vs current 19', f(19, 2) === false,
  'f(19,2) returned true — "2" > "19" string comparison bug');
// '20' > '9' lexicographically (correct) but only by accident
assert('epoch 20 valid vs current 9', f(9, 20) === true, 'got false');

process.exit(failed > 0 ? 1 : 0);
