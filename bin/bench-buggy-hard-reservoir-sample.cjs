'use strict';

function reservoirSample(stream, k, randomFn) {
  randomFn = randomFn || Math.random;
  var reservoir = stream.slice(0, k);
  for (var i = k; i < stream.length; i++) {
    var j = Math.floor(randomFn() * k); 
    if (j < k) reservoir[j] = stream[i]; 
  }
  return reservoir;
}

module.exports = { reservoirSample };
