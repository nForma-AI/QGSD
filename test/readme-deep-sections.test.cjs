/** @requirement RDME-05 — README architecture diagram and section structure */
const { describe, it } = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const README = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

describe('RDME-05: Architecture diagram in How It Works', () => {
  it('contains a flow diagram (mermaid or text-based)', () => {
    const hasMermaid = README.includes('```mermaid');
    // Text-based flow diagram like: Describe idea → Quorum reviews plan → ...
    const hasTextFlow = /→.*→/m.test(README);
    assert.ok(hasMermaid || hasTextFlow, 'README should contain an architecture flow diagram (mermaid or text-based)');
  });
  it('flow diagram contains step keywords', () => {
    const hasMermaidFlow = /flowchart\s+(LR|TD|TB)/i.test(README);
    // Text-based flow with arrows
    const hasTextFlow = README.includes('→');
    assert.ok(hasMermaidFlow || hasTextFlow, 'Flow diagram should contain step keywords or arrows');
  });
  it('diagram appears in or near How It Works section', () => {
    const howItWorksIdx = README.indexOf('## How It Works');
    assert.ok(howItWorksIdx > -1, 'How It Works section must exist');
    // Check for either mermaid or text-based diagram after How It Works
    const mermaidIdx = README.indexOf('```mermaid', howItWorksIdx);
    const textFlowIdx = README.indexOf('→', howItWorksIdx);
    const diagramIdx = mermaidIdx > -1 ? mermaidIdx : textFlowIdx;
    assert.ok(diagramIdx > -1, 'Flow diagram must exist after How It Works heading');
    assert.ok(diagramIdx > howItWorksIdx, 'Flow diagram should be after How It Works heading');
    // Should be within ~50 lines of heading
    const linesBetween = README.substring(howItWorksIdx, diagramIdx).split('\n').length;
    assert.ok(linesBetween < 50, `Flow diagram should be near How It Works heading (found ${linesBetween} lines away)`);
  });
});

describe('RDME-08: Community/Contributing section', () => {
  it('has a Community heading', () => {
    assert.ok(/^## Community/m.test(README), 'README should have ## Community section');
  });
  it('contains Discord link', () => {
    assert.ok(README.includes('discord.gg/M8SevJEuZG'), 'Community section should have Discord invite link');
  });
  it('appears before Star History', () => {
    const communityIdx = README.indexOf('## Community');
    const starHistoryIdx = README.indexOf('## Star History');
    assert.ok(communityIdx > -1 && starHistoryIdx > -1, 'Both sections must exist');
    assert.ok(communityIdx < starHistoryIdx, 'Community must appear before Star History');
  });
});

describe('RDME-09: Getting Started rebalanced', () => {
  it('install command is visible (not inside details)', () => {
    // npx command should appear before any <details> in Getting Started
    const gsIdx = README.indexOf('## Getting Started');
    const nextDetails = README.indexOf('<details>', gsIdx);
    const installCmd = README.indexOf('npx @nforma.ai/nforma', gsIdx);
    assert.ok(installCmd > gsIdx, 'Install command must be in Getting Started');
    assert.ok(installCmd < nextDetails, 'Install command must appear before first <details> block');
  });
  it('quorum setup wizard is mentioned in Getting Started', () => {
    const gsIdx = README.indexOf('## Getting Started');
    // Find end of Getting Started (next ## heading or end of file)
    const nextSection = README.indexOf('\n## ', gsIdx + 1);
    const gsSection = README.substring(gsIdx, nextSection > -1 ? nextSection : gsIdx + 5000);
    assert.ok(gsSection.includes('/nf:mcp-setup'),
      'Quorum setup wizard (/nf:mcp-setup) should be mentioned in Getting Started section');
  });
});

describe('RDME-10: Observability table not broken', () => {
  it('no image between table rows in Observability section', () => {
    const obsIdx = README.indexOf('Observability');
    const obsSection = README.substring(obsIdx, obsIdx + 1000);
    // Find all table rows and images
    const lines = obsSection.split('\n');
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        inTable = true;
      } else if (inTable && line.startsWith('![')) {
        assert.fail(`Image found between table rows at line ${i}: "${line}"`);
      } else if (inTable && !line.startsWith('|')) {
        inTable = false; // table ended cleanly
      }
    }
  });
  it('settings and set-profile commands exist in README', () => {
    // These commands should exist somewhere in the README (may be inside <details> blocks)
    assert.ok(README.includes('/nf:settings'), '/nf:settings command must be in README');
    assert.ok(README.includes('/nf:set-profile'), '/nf:set-profile command must be in README');
  });
});
