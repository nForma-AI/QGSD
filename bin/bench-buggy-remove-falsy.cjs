'use strict';

function removeFalsy(arr) {
  return arr.filter(function(x) { return x !== false; });
}
module.exports = { removeFalsy };
