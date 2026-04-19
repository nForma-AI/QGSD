'use strict';

function f(a) {
  if (!a.length) return [];
  a.sort(function(a, b) { return a[0] - b[0]; });
  var result = [a[0].slice()];
  for (var i = 1; i < a.length; i++) {
    var last = result[result.length - 1];
    if (a[i][0] >= last[1]) { 
      result.push(a[i].slice());
    } else {
      last[1] = Math.max(last[1], a[i][1]);
    }
  }
  return result;
}

module.exports = { f };
