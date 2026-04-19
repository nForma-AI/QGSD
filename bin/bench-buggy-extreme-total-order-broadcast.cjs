'use strict';

function isConsistentDelivery(deliveryLogs) {
  if (deliveryLogs.length === 0) return true;
  var first = deliveryLogs[0].slice().sort().join(','); 
  return deliveryLogs.every(function(log) {
    return log.slice().sort().join(',') === first;    
  });
}
module.exports = { isConsistentDelivery };
