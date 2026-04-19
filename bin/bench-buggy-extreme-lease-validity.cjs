'use strict';

function isLeaseValid(serverClock, leaseExpiry, maxClockSkew) {
  return serverClock < leaseExpiry; 
}
module.exports = { isLeaseValid };
