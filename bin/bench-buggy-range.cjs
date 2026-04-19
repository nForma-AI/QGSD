'use strict';
// bin/bench-buggy-range.cjs
// BUG: uses <= so includes end, should be exclusive (i < end)
// Fix: change i<=end to i<end
function range(start, end) {
  var r = [];
  for (var i = start; i <= end; i++) r.push(i);
  return r;
}
module.exports = { range };
