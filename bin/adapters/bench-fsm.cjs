'use strict';

module.exports = {
  name: 'bench-fsm',
  detect: () => true,
  parse: (src) => ({ states: 'not-an-array', transitions: null }),
  generate: (ir) => 'invalid output'
};