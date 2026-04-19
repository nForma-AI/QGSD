'use strict';
const { processUpdate } = require('../../../bin/bench-buggy-legendary-chain-replication-ack.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var storage = {};
var acked = [];
var replica = {
  isTail: true,
  storage: storage
};

var sendAck = function(id) {
  acked.push(id);
  // Client reads immediately after receiving ACK — write must already be in storage
  assert('write visible after ack', storage['x'], 'hello');
};

processUpdate(replica, {id:1, key:'x', value:'hello'}, sendAck);
assert('ack was sent', acked.length, 1);
assert('storage updated after processUpdate', storage['x'], 'hello');

// Non-tail replica: no ack sent
var storage2 = {};
var acked2 = [];
var nonTail = {isTail: false, storage: storage2};
processUpdate(nonTail, {id:2, key:'y', value:'world'}, function(id){ acked2.push(id); });
assert('non-tail does not ack', acked2.length, 0);
assert('non-tail still stores', storage2['y'], 'world');

process.exit(failed > 0 ? 1 : 0);
