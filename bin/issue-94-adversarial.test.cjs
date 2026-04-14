const fs = require('fs');
const path = require('path');

// Known sub-skills from the 17 existing skills
const KNOWN_SUB_SKILLS = new Set([
  'api-and-interface-design',
  'browser-testing-with-devtools',
  'ci-cd-and-automation',
  'code-review-and-quality',
  'code-simplification',
  'deprecation-and-migration',
  'documentation-and-adrs',
  'frontend-ui-engineering',
  'git-workflow-and-versioning',
  'idea-refine',
  'incremental-implementation',
  'performance-optimization',
  'security-and-hardening',
  'shipping-and-launch',
  'spec-driven-development',
  'task-intake',
  'test-driven-development'
]);

// Expected phase names
const PHASES = ['nf-idea', 'nf-plan', 'nf-build', 'nf-ship', 'nf-debug', 'nf-observe'];

function parseSkillMd(content) {
  const lines = content.split('\n');
  const sections = {};
  let currentSection = null;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';

    if (line === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }

    if (inFrontmatter) continue;

    // Check for section headers: text followed by dashes
    if (line && nextLine && nextLine.match(/^-+$/)) {
      currentSection = line.toLowerCase().replace(/ /g, '-');
      sections[currentSection] = [];
      i++; // Skip the dashes line
    } else if (currentSection && line) {
      sections[currentSection].push(line);
    }
  }

  return sections;
}

function validateSkillFile(phase, filePath) {
  console.log(`\n--- Validating ${phase} ---`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`${phase}: SKILL.md file missing`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const sections = parseSkillMd(content);

  // Check required sections
  const requiredSections = ['purpose', 'entry-conditions', 'sub-skills', 'slash-commands', 'exit-routes', 'if-stuck'];
  for (const section of requiredSections) {
    if (!sections[section]) {
      throw new Error(`${phase}: Missing required section: ${section}`);
    }
  }

  // Check frontmatter
  const frontmatterMatch = content.match(/^---\nname: (.+)\ndescription: (.+)\n---/);
  if (!frontmatterMatch) {
    throw new Error(`${phase}: Missing or invalid frontmatter`);
  }
  const name = frontmatterMatch[1];
  if (!name.includes(phase)) {
    throw new Error(`${phase}: Frontmatter name '${name}' does not match phase`);
  }

  // Check sub-skills are valid
  const subSkillsSection = sections['sub-skills'];
  if (subSkillsSection) {
    for (const line of subSkillsSection) {
      if (line.includes('|') && !line.includes('---') && !line.match(/^\|\s*[:-]+\s*\|/)) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length >= 2 && cells[0] !== 'Skill') {
          const skillName = cells[0].replace(/`/g, '');
          if (skillName && !KNOWN_SUB_SKILLS.has(skillName)) {
            throw new Error(`${phase}: Unknown sub-skill '${skillName}'`);
          }
        }
      }
    }
  }

  // Check no nf-solve or nf-resolve references except in "do not reference"
  const forbiddenRefs = content.match(/\bnf-solve\b|\bnf-resolve\b/g);
  if (forbiddenRefs) {
    for (const ref of forbiddenRefs) {
      if (!content.includes('Do not reference nf-solve or nf-resolve')) {
        throw new Error(`${phase}: Forbidden reference to ${ref}`);
      }
    }
  }

  // Check routing is mentioned
  if (!content.includes('route') && !content.includes('routing')) {
    throw new Error(`${phase}: Missing routing documentation`);
  }

  console.log(`${phase}: Validation passed`);
}

function validateDocsUpdate() {
  console.log('\n--- Validating docs/agent-skills.md ---');

  const docsPath = path.join(__dirname, '..', 'docs', 'agent-skills.md');
  if (!fs.existsSync(docsPath)) {
    throw new Error('docs/agent-skills.md missing');
  }

  const content = fs.readFileSync(docsPath, 'utf8');

  // Check phase lifecycle diagram
  if (!content.includes('nf-idea') || !content.includes('nf-plan') || !content.includes('nf-build') ||
      !content.includes('nf-ship') || !content.includes('nf-debug') || !content.includes('nf-observe')) {
    throw new Error('docs/agent-skills.md: Missing phase lifecycle diagram');
  }

  // Check phase table
  if (!content.includes('| **nf-idea** |') || !content.includes('| **nf-plan** |')) {
    throw new Error('docs/agent-skills.md: Missing phase table');
  }

  console.log('docs/agent-skills.md: Validation passed');
}

function runAdversarialTests() {
  console.log('Running adversarial tests for issue 94 completion...');

  // Validate each phase skill file
  for (const phase of PHASES) {
    const filePath = path.join(require('os').homedir(), '.config', 'opencode', 'skills', phase, 'SKILL.md');
    validateSkillFile(phase, filePath);
  }

  // Validate docs update
  validateDocsUpdate();

  console.log('\n✅ All adversarial tests passed! Issue 94 appears complete.');
}

if (require.main === module) {
  try {
    runAdversarialTests();
  } catch (e) {
    console.error(`❌ Test failed: ${e.message}`);
    process.exit(1);
  }
}

module.exports = { runAdversarialTests, validateSkillFile, validateDocsUpdate };