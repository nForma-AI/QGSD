'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-consistent-cut-termination.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { a.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var process1 = {
  incomingChannels: ['ch1', 'ch2', 'ch3'],
  markersReceived: {ch1: true, ch2: false, ch3: false}
};
assert('not complete when only one channel done', f(process1), false);

var process2 = {
  incomingChannels: ['ch1', 'ch2'],
  markersReceived: {ch1: true, ch2: true}
};
assert('complete when all channels done', f(process2), true);

var process3 = {
  incomingChannels: ['ch1'],
  markersReceived: {ch1: false}
};
assert('not complete when no channels done', f(process3), false);

var process4 = {
  incomingChannels: ['ch1', 'ch2', 'ch3'],
  markersReceived: {ch1: false, ch2: true, ch3: false}
};
assert('not complete when middle channel done but not others', f(process4), false);

a.exit(failed > 0 ? 1 : 0);
