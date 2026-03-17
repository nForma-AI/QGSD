// test/user-guide-overhaul.test.cjs
/** @requirement GUIDE-01 — User Guide TUI screenshots cross-referenced to features */
const { describe, it } = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const GUIDE = fs.readFileSync(path.join(__dirname, '..', 'docs', 'USER-GUIDE.md'), 'utf8');

describe('GUIDE-01: TUI screenshots cross-referenced to features', () => {
  it('contains at least 6 TUI screenshot references', () => {
    const matches = GUIDE.match(/<img\s+src="assets\/tui-[^"]+"/g) || [];
    assert.ok(matches.length >= 6, `Expected >= 6 TUI screenshots, found ${matches.length}`);
  });

  it('all referenced images exist on disk', () => {
    const imgRefs = [...GUIDE.matchAll(/src="(assets\/[^"]+)"/g)].map(m => m[1]);
    assert.ok(imgRefs.length > 0, 'Should have at least one image reference');
    for (const ref of imgRefs) {
      const fullPath = path.join(__dirname, '..', 'docs', ref);
      assert.ok(fs.existsSync(fullPath), `Referenced image missing: ${ref}`);
    }
  });

  it('screenshots are distributed across sections, not clustered', () => {
    const lines = GUIDE.split('\n');
    const imgLines = lines.reduce((acc, line, idx) => {
      if (/<img\s+src="assets\/tui-/.test(line)) acc.push(idx);
      return acc;
    }, []);
    if (imgLines.length >= 2) {
      const spread = imgLines[imgLines.length - 1] - imgLines[0];
      assert.ok(spread > 50, `Screenshots should be spread across the document (spread: ${spread} lines)`);
    }
  });
});

describe('GUIDE-02: Getting Started walkthrough', () => {
  it('has a Getting Started section', () => {
    assert.ok(/^## Getting Started/m.test(GUIDE), 'User Guide should have ## Getting Started');
  });

  it('Getting Started appears before Workflow Diagrams', () => {
    const gsIdx = GUIDE.indexOf('## Getting Started');
    const wdIdx = GUIDE.indexOf('## Workflow Diagrams');
    assert.ok(gsIdx > -1 && wdIdx > -1, 'Both sections must exist');
    assert.ok(gsIdx < wdIdx, 'Getting Started must appear before Workflow Diagrams');
  });

  it('contains step-by-step structure', () => {
    assert.ok(/### Step 1/i.test(GUIDE), 'Should have Step 1');
    assert.ok(/### Step 2/i.test(GUIDE), 'Should have Step 2');
  });

  it('includes screenshots in Getting Started', () => {
    const gsIdx = GUIDE.indexOf('## Getting Started');
    const nextSection = GUIDE.indexOf('\n## ', gsIdx + 1);
    const gsContent = GUIDE.substring(gsIdx, nextSection > -1 ? nextSection : undefined);
    const imgCount = (gsContent.match(/<img\s/g) || []).length;
    assert.ok(imgCount >= 2, `Getting Started should have >= 2 screenshots, found ${imgCount}`);
  });

  it('walkthrough mentions install and quorum setup', () => {
    const gsIdx = GUIDE.indexOf('## Getting Started');
    const nextSection = GUIDE.indexOf('\n## ', gsIdx + 1);
    const gsContent = GUIDE.substring(gsIdx, nextSection > -1 ? nextSection : undefined).toLowerCase();
    assert.ok(gsContent.includes('install') || gsContent.includes('npx'), 'Should mention installation');
    assert.ok(gsContent.includes('quorum') || gsContent.includes('mcp-setup'), 'Should mention quorum setup');
  });
});

describe('Table of Contents: anchor slug validation', () => {
  it('every ## heading has a corresponding ToC anchor link with correct slug format', () => {
    const tocStart = GUIDE.indexOf('## Table of Contents');
    const tocEnd = GUIDE.indexOf('\n---', tocStart);
    const tocSection = GUIDE.substring(tocStart, tocEnd > -1 ? tocEnd : undefined);

    // Extract all ## headings (excluding Table of Contents itself)
    const headings = [...GUIDE.matchAll(/^## (.+)$/gm)]
      .map(m => m[1])
      .filter(h => h !== 'Table of Contents');

    assert.ok(headings.length > 0, 'Should have at least one ## heading');

    for (const heading of headings) {
      // Compute expected slug: lowercase, spaces to hyphens, strip non-alphanumeric/hyphen
      const slug = heading
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const expectedLink = `(#${slug})`;
      assert.ok(
        tocSection.includes(expectedLink),
        `ToC missing anchor for "## ${heading}" -- expected link containing "(#${slug})"`
      );
    }
  });
});
