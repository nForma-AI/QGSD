'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-paxos-chosen-value.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var responses = [{ballot:1,value:'old'},{ballot:5,value:'chosen'},{ballot:3,value:'middle'}];
assert('uses highest ballot value', f(responses, 'own'), 'chosen');
assert('uses own when no accepted values', f([{ballot:1,value:null}], 'own'), 'own');
assert('single accepted value', f([{ballot:3,value:'x'}], 'own'), 'x');
assert('two values picks higher ballot', f([{ballot:2,value:'low'},{ballot:10,value:'high'}], 'own'), 'high');

process.exit(failed > 0 ? 1 : 0);
