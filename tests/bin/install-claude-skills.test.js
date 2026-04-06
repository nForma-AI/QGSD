const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

// Simple smoke tests for bin/install.js install() behavior for Claude local
describe('bin/install.js', function() {
  this.timeout(10000);

  it('installs .agents/skills and writes manifest for local claude install', function(done) {
    const { spawn } = require('child_process');
    const cwd = process.cwd();
    const targetDir = path.join(cwd, '.claude');

    // Remove existing targetDir to ensure clean install
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true });
    }

    const installer = spawn(process.execPath, ['bin/install.js', '--claude', '--local'], { stdio: 'inherit' });
    installer.on('exit', (code) => {
      try {
        assert.strictEqual(code, 0, 'installer exited with non-zero code');

        // Check skills directory exists under .agents/skills (installer should copy agents/skills/*)
        const skillsDir = path.join(targetDir, '.agents', 'skills');
        assert.ok(fs.existsSync(skillsDir), `.agents/skills must exist at ${skillsDir}`);

        // Expect at least one skill folder (task-intake) with SKILL.md
        const taskSkill = path.join(skillsDir, 'task-intake', 'SKILL.md');
        assert.ok(fs.existsSync(taskSkill), 'task-intake SKILL.md must be present');

        // Check manifest exists and includes agents/skills entries
        const manifestPath = path.join(targetDir, 'nf-file-manifest.json');
        assert.ok(fs.existsSync(manifestPath), 'manifest must exist');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const keys = Object.keys(manifest.files || {});
        const hasSkillEntry = keys.some(k => k.includes('.agents/skills/task-intake/SKILL.md'));
        assert.ok(hasSkillEntry, 'manifest must include .agents/skills/task-intake/SKILL.md');

        done();
      } catch (err) {
        done(err);
      }
    });
  });
});
