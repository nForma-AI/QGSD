'use strict';
const { hlcReceive } = require('../../../bin/bench-buggy-legendary-hlc-receive.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) {
    process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n');
    failed++;
  }
}

// HLC invariant: the receive event must have a strictly greater HLC value than the message
// When l_local == l_msg, the counter must be incremented to ensure strict ordering
for (var l = 0; l <= 3; l++) {
  for (var c1 = 0; c1 <= 3; c1++) {
    for (var c2 = 0; c2 <= 3; c2++) {
      var recv = hlcReceive({l:l, c:c1}, {l:l, c:c2});
      var msgHlc = l * 1000 + c2;
      var recvHlc = recv.l * 1000 + recv.c;
      assert(
        'recv HLC > msg HLC when l_local==l_msg (l='+l+',c1='+c1+',c2='+c2+')',
        recvHlc > msgHlc,
        'recv='+JSON.stringify(recv)+' msg={l:'+l+',c:'+c2+'}'
      );
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
