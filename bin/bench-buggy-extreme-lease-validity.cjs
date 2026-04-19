'use strict';
// Lease validity with clock skew:
// A server holds a valid lease only if its local clock is still safely before
// the lease expiry — with enough margin to account for maximum clock skew.
// Invariant: isLeaseValid(serverClock, leaseExpiry, maxClockSkew) iff
//   serverClock < leaseExpiry - maxClockSkew.
// This ensures that even if the server's clock is fast by maxClockSkew, the real
// time is still before leaseExpiry, preventing two servers from both believing
// they hold a valid lease simultaneously.
// Bug: ignores maxClockSkew entirely — allows a server to believe its lease is
// valid right up to the expiry, enabling dual-leadership with clock-skewed peers.
function isLeaseValid(serverClock, leaseExpiry, maxClockSkew) {
  return serverClock < leaseExpiry; // BUG: should be serverClock < leaseExpiry - maxClockSkew
}
module.exports = { isLeaseValid };
