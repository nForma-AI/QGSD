/**
 * Shared utility functions for observe handlers
 * Canonical source — all observe handlers import from here (OBS-10)
 */

/**
 * Parse a duration string like "7d", "24h", "30m" into milliseconds
 * @param {string} duration - Duration string
 * @returns {number} Milliseconds (0 for invalid input)
 */
function parseDuration(duration) {
  if (!duration) return 0;
  const match = String(duration).match(/^(\d+)([dhms])$/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return num * (multipliers[match[2]] || 0);
}

/**
 * Format age from ISO date to human-readable string
 * @param {string} isoDate - ISO8601 date string
 * @returns {string} Human-readable age like "5m", "2h", "3d"
 */
function formatAge(isoDate) {
  if (!isoDate) return 'unknown';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 0) return 'future';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

module.exports = { parseDuration, formatAge };
