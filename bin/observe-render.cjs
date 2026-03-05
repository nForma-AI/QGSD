/**
 * Dual-table renderer for /nf:observe
 * Renders Issues table and Drifts table with error section
 */

// Severity sort order (lower = higher priority)
const SEVERITY_ORDER = { error: 0, critical: 0, bug: 1, warning: 2, info: 3 };

/**
 * Get sort order for a severity string
 * @param {string} severity
 * @returns {number}
 */
function classifySeverity(severity) {
  return SEVERITY_ORDER[severity] ?? 4;
}

/**
 * Format age from ISO date to human-readable string
 * @param {string} isoDate
 * @returns {string}
 */
function formatAge(isoDate) {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 0) return 'future';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Truncate a string to maxLen, adding "..." if truncated
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Pad or truncate string to exact width
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function pad(str, width) {
  const s = String(str || '');
  if (s.length >= width) return s.slice(0, width);
  return s + ' '.repeat(width - s.length);
}

/**
 * Render observe output with dual tables (Issues + Drifts) and error section
 *
 * @param {object[]} results - Array of handler results (standard schema, all resolved)
 * @returns {string} Formatted output string
 */
function renderObserveOutput(results) {
  const lines = [];

  // Separate successes and errors
  const successes = results.filter(r => r.status === 'ok');
  const errorResults = results.filter(r => r.status === 'error');
  const sourceCount = results.length;

  // Collect all issues
  const allItems = [];
  for (const r of successes) {
    for (const issue of (r.issues || [])) {
      allItems.push({ ...issue, source_label: issue.source_label || r.source_label });
    }
  }

  // Split by issue_type
  const issues = allItems.filter(item => item.issue_type !== 'drift');
  const drifts = allItems.filter(item => item.issue_type === 'drift');

  const totalIssues = issues.length;
  const totalDrifts = drifts.length;

  // Header
  if (totalIssues === 0 && totalDrifts === 0 && errorResults.length === 0) {
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(' QGSD > OBSERVE: All clear — no open issues found');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`Sources checked: ${sourceCount}`);
    return lines.join('\n');
  }

  const failNote = errorResults.length > 0 ? `; ${errorResults.length} source(s) failed` : '';
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(` QGSD > OBSERVE: ${totalIssues} issue(s), ${totalDrifts} drift(s) across ${sourceCount} source(s)${failNote}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Sort issues by severity then age (newest first)
  issues.sort((a, b) => {
    const sevCmp = classifySeverity(a.severity) - classifySeverity(b.severity);
    if (sevCmp !== 0) return sevCmp;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  // Sort drifts by severity
  drifts.sort((a, b) => {
    return classifySeverity(a.severity) - classifySeverity(b.severity);
  });

  // Render Issues table
  if (issues.length > 0) {
    lines.push('');
    lines.push('┌────────────────────────────── ISSUES ───────────────────────────────┐');
    lines.push('│ #  │ Title                                    │ Source  │ Sev │ Age  │');
    lines.push('├─────────────────────────────────────────────────────────────────────┤');

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const num = String(i + 1).padStart(2, ' ');
      const title = pad(truncate(issue.title, 40), 40);
      const source = pad(truncate(issue.source_label || issue.source_type || '', 7), 7);
      const sev = pad(truncate(issue.severity || 'info', 3), 3);
      const age = pad(issue.age || formatAge(issue.created_at), 4);
      lines.push(`│ ${num} │ ${title} │ ${source} │ ${sev} │ ${age} │`);
    }

    lines.push('└─────────────────────────────────────────────────────────────────────┘');
  }

  // Render Drifts table
  if (drifts.length > 0) {
    lines.push('');
    lines.push('┌────────────────────────────── DRIFTS ───────────────────────────────┐');
    lines.push('│ #  │ Parameter                              │ Formal │ Actual │ Sev  │');
    lines.push('├─────────────────────────────────────────────────────────────────────┤');

    for (let i = 0; i < drifts.length; i++) {
      const drift = drifts[i];
      const num = String(i + 1).padStart(2, ' ');
      const param = pad(truncate(drift.formal_parameter_key || drift.title || '', 36), 36);
      const formal = pad(truncate(String(drift.formal_value || ''), 6), 6);
      const actual = pad(truncate(String(drift.actual_value || ''), 6), 6);
      const sev = pad(truncate(drift.severity || 'info', 4), 4);
      lines.push(`│ ${num} │ ${param} │ ${formal} │ ${actual} │ ${sev} │`);
    }

    lines.push('└─────────────────────────────────────────────────────────────────────┘');
  }

  // Render errors section
  if (errorResults.length > 0) {
    lines.push('');
    lines.push(`Errors from sources (${errorResults.length} failed, did not block others):`);
    for (const err of errorResults) {
      lines.push(`  ✗ ${err.source_label || err.source_type}: ${err.error || 'Unknown error'}`);
    }
  }

  return lines.join('\n');
}

module.exports = { renderObserveOutput, classifySeverity, formatAge, truncate };
