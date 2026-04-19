'use strict';
// Total order broadcast: all correct processes must deliver the SAME sequence of messages.
// Invariant: every delivery log must be identical — same messages in the same ORDER.
// Bug: sorts each log before comparing, converting order equality into set equality.
// Two processes that delivered [A,B,C] and [A,C,B] incorrectly pass as consistent
// because both sort to the same string "A,B,C".
function isConsistentDelivery(deliveryLogs) {
  if (deliveryLogs.length === 0) return true;
  var first = deliveryLogs[0].slice().sort().join(','); // BUG: sorts away order information
  return deliveryLogs.every(function(log) {
    return log.slice().sort().join(',') === first;    // BUG: compares sorted = set equality only
  });
}
module.exports = { isConsistentDelivery };
