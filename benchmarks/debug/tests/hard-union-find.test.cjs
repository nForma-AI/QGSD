'use strict';
const { f } = require('../../../bin/bench-buggy-hard-union-find.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\a'); failed++; }
}

// After union(0,1): parent[1]=0 (correct), find(0)=0, find(1)=0 — OK so far
// After union(1,2): rx=find(1)=0, ry=find(2)=2, equal rank → parent[y]=parent[2]=rx=0, rank[0]++
//   BUT BUG: sets parent[y] = rx, not parent[ry] = rx. Here y=2, ry=2 → same node → OK
// After union(0,3): rx=find(0)=0, ry=find(3)=3, rank[0]=1 > rank[3]=0 → parent[y]=parent[3]=rx=0
//   BUG sets parent[3] = 0 — same as correct since y=3, ry=3
// The bug fires when y != ry, i.e. y is not its own root

// Scenario where bug fires:
// union(0,1): rx=0, ry=1, equal ranks → parent[y=1] = rx=0. rank[0]++. Correct here since y=ry=1.
// union(2,3): rx=2, ry=3, equal ranks → parent[y=3] = rx=2. rank[2]++. Correct since y=ry=3.
// union(1,3): rx=find(1)=0, ry=find(3)=2, rank[0]=1 > rank[2]=1... wait rank[0]=1, rank[2]=1, equal
//   → parent[y=3] = rx=0. BUG: sets parent[3]=0, but ry=2 so parent[2] should be set!
//   Now: 0's component: {0,1,3} (0→0, 1→0, 3→0), 2's component: {2} (2→2)
//   find(2) = 2, find(3) = 0. They should be in same component but aren't!

var uf = f(4);
uf.union(0, 1); // parent[1]=0, rank[0]=1
uf.union(2, 3); // parent[3]=2, rank[2]=1
uf.union(1, 3); // rx=find(1)=0, ry=find(3)=2, equal rank → BUG: sets parent[y=3]=0, not parent[2]=0
// After bug: find(2)=2 (still its own root!), find(0)=0, find(1)=0, find(3)=0
assert('find(1) === find(3) after union', uf.find(1) === uf.find(3), true); // OK: both return 0
assert('find(2) === find(0) after union', uf.find(2) === uf.find(0), true); // BUGGY: find(2)=2 != find(0)=0

process.exit(failed > 0 ? 1 : 0);
