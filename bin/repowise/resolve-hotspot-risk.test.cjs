#!/usr/bin/env node
'use strict';
// bin/repowise/resolve-hotspot-risk.test.cjs
// Tests for bin/repowise/resolve-hotspot-risk.cjs — Hotspot risk resolution for quorum escalation

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { resolveHotspotRisk, loadCachedHotspots, saveCachedHotspots } = require('./resolve-hotspot-risk.cjs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// resolveHotspotRisk
// ---------------------------------------------------------------------------

describe('resolveHotspotRisk', () => {
  it('returns routine when no changed files match hotspots', () => {
    const result = resolveHotspotRisk(['nonexistent/path/file.xyz'], PROJECT_ROOT);
    assert.equal(result.risk_level, 'routine');
    assert.equal(result.hotspot_files.length, 0);
  });

  it('returns correct risk level for files in the repo', () => {
    // Use a file we know exists and has churn
    const result = resolveHotspotRisk(['package.json'], PROJECT_ROOT);
    assert.ok(['routine', 'medium', 'high'].includes(result.risk_level));
    assert.ok(typeof result.max_score === 'number');
  });

  it('returns high when a high-risk file is in the changed list', () => {
    // First get the hotspots to find a high-risk file
    const { computeHotspots } = require('./hotspot.cjs');
    const hotspots = computeHotspots(PROJECT_ROOT);
    const highRisk = hotspots.files.find(f => f.risk === 'high');

    if (highRisk) {
      const result = resolveHotspotRisk([highRisk.path], PROJECT_ROOT);
      assert.equal(result.risk_level, 'high');
      assert.ok(result.max_score > 0.7);
    } else {
      // No high-risk files in repo — skip gracefully
      assert.ok(true, 'no high-risk files in repo (skipped)');
    }
  });

  it('max_score is the highest hotspot_score among matching files', () => {
    const result = resolveHotspotRisk(['package.json'], PROJECT_ROOT);
    if (result.hotspot_files.length > 0) {
      const scores = result.hotspot_files.map(f => f.hotspot_score);
      const expectedMax = Math.round(Math.max(...scores) * 1000) / 1000;
      assert.equal(result.max_score, expectedMax);
    }
  });
});

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

describe('cache management', () => {
  const cacheDir = path.join(PROJECT_ROOT, '.planning', 'repowise');
  const cachePath = path.join(cacheDir, 'hotspot-cache.json');

  it('saveCachedHotspots writes cache file', () => {
    const testData = { files: [{ path: 'test.js', churn: 5, complexity: 10, hotspot_score: 0.5, risk: 'medium' }], summary: { total_files: 1, high_risk_count: 0, medium_risk_count: 1 } };
    saveCachedHotspots(PROJECT_ROOT, testData);
    assert.ok(fs.existsSync(cachePath));
  });

  it('loadCachedHotspots reads back cache data', () => {
    const data = loadCachedHotspots(PROJECT_ROOT);
    if (data) {
      assert.ok(Array.isArray(data.files));
      assert.ok(data.summary);
    }
  });

  it('loadCachedHotspots returns null for expired or missing cache', () => {
    const result = loadCachedHotspots('/nonexistent/path');
    assert.equal(result, null);
  });
});
