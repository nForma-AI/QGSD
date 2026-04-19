'use strict';
var { isValidToken } = require('../../../bin/bench-buggy-extreme-fencing-token.cjs');
var failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

// Formal invariant: isValidToken(cur, tok) iff tok >= cur (numeric comparison).
// Enumerate integer pairs and expose lexicographic-vs-numeric divergence.
var epochs = [1, 2, 8, 9, 10, 11, 19, 20, 100, 101];
for (var i = 0; i < epochs.length; i++) {
  for (var j = 0; j < epochs.length; j++) {
    var cur = epochs[i], tok = epochs[j];
    var expected = tok >= cur; // numeric
    var got = isValidToken(cur, tok);
    assert(
      'isValidToken(cur=' + cur + ',tok=' + tok + ')',
      got === expected,
      'expected ' + expected + ' got ' + got + ' (string: "' + String(tok) + '">="' + String(cur) + '"=' + (String(tok) >= String(cur)) + ')'
    );
  }
}

// Specific cases where string order inverts numeric order:
// '10' < '9' lexicographically → isValidToken(9, 10) should be true but bug returns false
assert('epoch 10 valid vs current 9', isValidToken(9, 10) === true,
  'isValidToken(9,10) returned false — "10" < "9" string comparison bug');
assert('epoch 11 valid vs current 9', isValidToken(9, 11) === true,
  'isValidToken(9,11) returned false');
assert('epoch 10 valid vs current 10', isValidToken(10, 10) === true,
  'got ' + isValidToken(10, 10));
assert('epoch 8 invalid vs current 9', isValidToken(9, 8) === false,
  'got ' + isValidToken(9, 8));
// '2' > '19' lexicographically → isValidToken(19, 2) should be false but bug returns true
assert('epoch 2 invalid vs current 19', isValidToken(19, 2) === false,
  'isValidToken(19,2) returned true — "2" > "19" string comparison bug');
// '20' > '9' lexicographically (correct) but only by accident
assert('epoch 20 valid vs current 9', isValidToken(9, 20) === true, 'got false');

process.exit(failed > 0 ? 1 : 0);
