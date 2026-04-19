'use strict';

function pick(obj, keys) {
  return keys.reduce(function(acc, k) {
    acc[k] = obj[k]; // BUG: should check k in obj first
    return acc;
  }, {});
}

module.exports = { pick };
