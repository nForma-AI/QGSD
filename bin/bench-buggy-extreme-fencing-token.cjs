'use strict';
// Fencing tokens prevent zombie processes from writing with stale epochs.
// Invariant: isValidToken(currentEpoch, tokenEpoch) iff tokenEpoch >= currentEpoch (numerically).
// Bug: converts both to strings before comparing — string lexicographic order
// differs from numeric order ('10' < '9' lexicographically, '2' > '19').
function isValidToken(currentEpoch, tokenEpoch) {
  return String(tokenEpoch) >= String(currentEpoch); // BUG: string comparison, '10' < '9'
}
module.exports = { isValidToken };
