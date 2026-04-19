'use strict';
var { satisfiesReadYourWrites } = require('../../../bin/bench-buggy-extreme-read-your-writes.cjs');
var failed = 0;
function assert(label, cond) {
  if (!cond) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Invariant: satisfiesReadYourWrites(r, w) iff r >= w.
// Enumerate all (readTs, writeTs) pairs in [0..5]:
for (var writeTs = 0; writeTs <= 5; writeTs++) {
  for (var readTs = 0; readTs <= 7; readTs++) {
    var expected = readTs >= writeTs;
    var got = satisfiesReadYourWrites(readTs, writeTs);
    assert(
      'RYW(read=' + readTs + ',write=' + writeTs + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

// Key boundary: read at exact write time must satisfy RYW
assert('read at write time t=5', satisfiesReadYourWrites(5, 5) === true,
  'satisfiesReadYourWrites(5,5) returned false — write invisible to same-timestamp read');
assert('read at write time t=0', satisfiesReadYourWrites(0, 0) === true,
  'satisfiesReadYourWrites(0,0) returned false');

// Read after write is always valid
assert('read after write', satisfiesReadYourWrites(6, 5) === true, 'got false');

// Read before write is invalid
assert('read before write', satisfiesReadYourWrites(4, 5) === false, 'got true');

process.exit(failed > 0 ? 1 : 0);
