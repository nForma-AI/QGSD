'use strict';
function findConflicts(t1, t2) {
  // BUG: checks wr-dependency (T1 wrote something T2 read) instead of rw-antidependency (T1 read something T2 wrote)
  return t1.writeSet.some(function(key) {
    return t2.readSet.indexOf(key) !== -1;
  });
}
module.exports = { findConflicts };
