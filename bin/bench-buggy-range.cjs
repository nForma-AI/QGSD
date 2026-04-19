'use strict';

function range(start, end) {
  var r = [];
  for (var i = start; i <= end; i++) r.push(i);
  return r;
}
module.exports = { range };
