'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-raft-election-safety.cjs');
let failed = 0;
var _i = 0;
function assert(label, cond) {
  _i++;
  if (!cond) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// At most one candidate can win in any cluster size for any vote split
for (var n = 3; n <= 8; n++) {
  for (var k = 0; k <= n; k++) {
    var aWins = f(k, n);
    var bWins = f(n - k, n);
    assert(
      'at most one winner: n='+n+' k='+k,
      !(aWins && bWins),
      'both win: k='+k+' n-k='+(n-k)
    );
  }
}

process.exit(failed > 0 ? 1 : 0);
