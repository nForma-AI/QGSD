'use strict';

function f(b) {
  return b + 1;
}

function g(b) {
  return f(b);
}

function h(c, d) {
  return Math.max(c, d);  
}

module.exports = { f, g, h };
