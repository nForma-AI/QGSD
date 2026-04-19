'use strict';
// bin/bench-buggy-extreme-vector-clock.cjs
// Vector clock — happens-before relation
//
// Formal definition (Lamport 1978):
//   happensBefore(A, B) ⟺ ∀i. A[i] ≤ B[i]  ∧  ∃i. A[i] < B[i]
//
// Events are CONCURRENT when neither A→B nor B→A:
//   ∃i. A[i] > B[i]  ∧  ∃j. A[j] < B[j]
// In this case BOTH happensBefore(A,B) and happensBefore(B,A) must be FALSE.
//
// BUG: compares the sum of components instead of per-component dominance.
// Sum comparison works for purely sequential clocks but misclassifies concurrent events:
//   A=[2,1], B=[1,3]: sumA=3 < sumB=4 → incorrectly claims A happened before B
//   (correct answer: concurrent — neither dominates the other)

function happensBefore(vcA, vcB) {
  const sumA = vcA.reduce(function(s, x) { return s + x; }, 0);
  const sumB = vcB.reduce(function(s, x) { return s + x; }, 0);
  return sumA < sumB;  // BUG: should check per-component dominance
}

module.exports = { happensBefore };
