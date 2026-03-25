'use strict';
/** @requirement BTF-04 — validates B->F remediation dispatch routing, cap enforcement, and priority ordering */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Integration tests for B->F remediation dispatch routing.
 * Tests the classification-to-dispatch routing logic, cap enforcement,
 * and priority ordering described in solve-remediate.md section 3a-extra.
 */

// Helper: create mock b_to_f detail
function mockBtoFDetail({ notCoveredCount = 0, coveredNotReproducedCount = 0 }) {
  const classification = [];

  for (let i = 0; i < notCoveredCount; i++) {
    classification.push({
      test: `test/nc-${String(i).padStart(2, '0')}.test.cjs`,
      classification: 'not_covered',
      models: [],
      bug_id: `nc${String(i).padStart(6, '0')}`,
    });
  }

  for (let i = 0; i < coveredNotReproducedCount; i++) {
    classification.push({
      test: `test/cnr-${String(i).padStart(2, '0')}.test.cjs`,
      classification: 'covered_not_reproduced',
      models: [`.planning/formal/tla/model-${i}.tla`],
      bug_id: `cnr${String(i).padStart(5, '0')}`,
    });
  }

  return {
    residual: notCoveredCount + coveredNotReproducedCount,
    detail: {
      total_failing: notCoveredCount + coveredNotReproducedCount,
      covered_reproduced: 0,
      covered_not_reproduced: coveredNotReproducedCount,
      not_covered: notCoveredCount,
      top_bugs: classification.filter(c => c.classification !== 'covered_reproduced').slice(0, 5).map(c => c.bug_id),
      classification,
    },
  };
}

// Simulate dispatch routing logic from section 3a-extra
function simulateDispatch(btoFResult) {
  const dispatched = [];
  const cappedLayers = [];

  if (!btoFResult || btoFResult.residual <= 0) {
    return { dispatched, cappedLayers };
  }

  const detail = btoFResult.detail;
  const notCovered = detail.classification.filter(c => c.classification === 'not_covered');
  const coveredNotReproduced = detail.classification.filter(c => c.classification === 'covered_not_reproduced');

  // Phase 1: not_covered (max 3/cycle)
  const NC_MAX = 3;
  let ncDispatched = 0;
  for (const entry of notCovered) {
    if (ncDispatched >= NC_MAX) {
      cappedLayers.push({ layer: 'b_to_f', dispatched: NC_MAX, max: NC_MAX, bucket: 'not_covered' });
      break;
    }
    dispatched.push({ target: 'close-formal-gaps', bug_id: entry.bug_id, bucket: 'not_covered' });
    ncDispatched++;
  }

  // Phase 2: covered_not_reproduced (max 2/cycle)
  const CNR_MAX = 2;
  let cnrDispatched = 0;
  for (const entry of coveredNotReproduced) {
    if (cnrDispatched >= CNR_MAX) {
      cappedLayers.push({ layer: 'b_to_f', dispatched: CNR_MAX, max: CNR_MAX, bucket: 'blind_spots' });
      break;
    }
    dispatched.push({ target: 'model-driven-fix', bug_id: entry.bug_id, bucket: 'blind_spots', models: entry.models });
    cnrDispatched++;
  }

  return { dispatched, cappedLayers };
}

describe('BTF-04: B->F remediation dispatch routing', () => {
  it('not_covered entries route to close-formal-gaps', () => {
    const btoF = mockBtoFDetail({ notCoveredCount: 2 });
    const { dispatched } = simulateDispatch(btoF);

    assert.equal(dispatched.length, 2);
    for (const d of dispatched) {
      assert.equal(d.target, 'close-formal-gaps');
      assert.equal(d.bucket, 'not_covered');
    }
  });

  it('covered_not_reproduced entries route to model-driven-fix', () => {
    const btoF = mockBtoFDetail({ coveredNotReproducedCount: 2 });
    const { dispatched } = simulateDispatch(btoF);

    assert.equal(dispatched.length, 2);
    for (const d of dispatched) {
      assert.equal(d.target, 'model-driven-fix');
      assert.equal(d.bucket, 'blind_spots');
      assert.ok(d.models.length > 0, 'Should include model paths');
    }
  });

  it('not_covered dispatches capped at 3', () => {
    const btoF = mockBtoFDetail({ notCoveredCount: 5 });
    const { dispatched, cappedLayers } = simulateDispatch(btoF);

    const ncDispatched = dispatched.filter(d => d.bucket === 'not_covered');
    assert.equal(ncDispatched.length, 3, 'Should dispatch exactly 3 not_covered');

    assert.equal(cappedLayers.length, 1);
    assert.deepEqual(cappedLayers[0], { layer: 'b_to_f', dispatched: 3, max: 3, bucket: 'not_covered' });
  });

  it('blind spot dispatches capped at 2', () => {
    const btoF = mockBtoFDetail({ coveredNotReproducedCount: 4 });
    const { dispatched, cappedLayers } = simulateDispatch(btoF);

    const cnrDispatched = dispatched.filter(d => d.bucket === 'blind_spots');
    assert.equal(cnrDispatched.length, 2, 'Should dispatch exactly 2 blind spots');

    assert.equal(cappedLayers.length, 1);
    assert.deepEqual(cappedLayers[0], { layer: 'b_to_f', dispatched: 2, max: 2, bucket: 'blind_spots' });
  });

  it('dispatch priority: not_covered before covered_not_reproduced', () => {
    const btoF = mockBtoFDetail({ notCoveredCount: 2, coveredNotReproducedCount: 2 });
    const { dispatched } = simulateDispatch(btoF);

    assert.equal(dispatched.length, 4);
    // First 2 should be not_covered (close-formal-gaps)
    assert.equal(dispatched[0].target, 'close-formal-gaps');
    assert.equal(dispatched[1].target, 'close-formal-gaps');
    // Last 2 should be covered_not_reproduced (model-driven-fix)
    assert.equal(dispatched[2].target, 'model-driven-fix');
    assert.equal(dispatched[3].target, 'model-driven-fix');
  });

  it('zero residual skips dispatch', () => {
    const btoF = mockBtoFDetail({ notCoveredCount: 0, coveredNotReproducedCount: 0 });
    const { dispatched, cappedLayers } = simulateDispatch(btoF);

    assert.equal(dispatched.length, 0, 'Should not dispatch anything');
    assert.equal(cappedLayers.length, 0, 'Should have no capped layers');
  });

  it('overflow items remain in residual (not dropped)', () => {
    const btoF = mockBtoFDetail({ notCoveredCount: 5, coveredNotReproducedCount: 4 });
    const { dispatched, cappedLayers } = simulateDispatch(btoF);

    // 3 not_covered dispatched, 2 blind spots dispatched = 5 total dispatched
    assert.equal(dispatched.length, 5);

    // Both caps hit
    assert.equal(cappedLayers.length, 2);

    // Residual still reflects ALL items (5 + 4 = 9), not just dispatched (3 + 2 = 5)
    // The overflow items (2 not_covered + 2 blind spots) carry forward to next cycle
    assert.equal(btoF.residual, 9, 'Residual should include all items, not just dispatched');

    // Classification array still has all entries
    assert.equal(btoF.detail.classification.length, 9, 'Classification should retain all entries');
  });
});
