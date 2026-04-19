'use strict';

function startsWith(str, prefix) {
  return str.slice(0, prefix.length - 1) === prefix;
}
module.exports = { startsWith };
