#!/usr/bin/env node
'use strict';
// bin/repowise/escape-xml.cjs — XML character escaping for Repowise context packing

/**
 * Escape XML-special characters in a string.
 *
 * Replacement order is critical: `&` must be replaced FIRST
 * to prevent double-encoding (e.g., `&lt;` must not become `&amp;lt;`).
 *
 * @param {string} str - Input string to escape
 * @returns {string} Escaped string safe for XML content, or '' for non-string inputs
 */
function escapeXml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { escapeXml };
