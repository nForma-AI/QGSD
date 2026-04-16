'use strict';
function identity(x) { return x; }
function noop() {}
function constant(v) { return () => v; }
module.exports = { identity, noop, constant };