'use strict';
// BUG: selection probability uses k as denominator instead of (i+1)
// With denominator k, j = floor(random * k) is ALWAYS < k (100% replacement chance)
// making every element after the initial k replace one in the reservoir
// This biases the reservoir heavily toward later elements
// FIX: change `randomFn() * k` to `randomFn() * (i + 1)`

function reservoirSample(stream, k, randomFn) {
  randomFn = randomFn || Math.random;
  var reservoir = stream.slice(0, k);
  for (var i = k; i < stream.length; i++) {
    var j = Math.floor(randomFn() * k); // BUG: should be * (i + 1) for correct probability
    if (j < k) reservoir[j] = stream[i]; // With bug, j always < k so always replaces
  }
  return reservoir;
}

module.exports = { reservoirSample };
