'use strict';

function flattenDeep(arr) {
  return arr.reduce(function(acc, val) {
    return Array.isArray(val) ? acc.concat(val) : acc.concat([val]); // BUG: doesn't recurse
  }, []);
}

module.exports = { flattenDeep };
