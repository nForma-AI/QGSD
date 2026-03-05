/**
 * Internal work detection handler for /qgsd:observe
 * Scans local project state for:
 * 1. Unfinished quick tasks (PLAN.md without SUMMARY.md)
 * 2. Stale debug sessions (quorum-debug-latest.md)
 * 3. TODO/FIXME/HACK/XXX comments in codebase (tracked as debt)
 * 4. Active milestone phases without VERIFICATION.md
 *
 * Returns standard observe schema: { source_label, source_type, status, issues[] }
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/**
 * Format age from mtime (Date) to human-readable string
 * Named distinctly from observe-handlers.cjs formatAge(isoString) to avoid confusion.
 * @param {Date} mtime - File modification time
 * @returns {string} Human-readable age like "5m", "2h", "3d"
 */
function formatAgeFromMtime(mtime) {
  if (!mtime || !(mtime instanceof Date)) return 'unknown';
  const diffMs = Date.now() - mtime.getTime();
  if (diffMs < 0) return 'future';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Internal work detection handler
 * Scans four categories: unfinished quick tasks, stale debug sessions, TODO comments, active unverified phases
 *
 * @param {object} sourceConfig - { label?, ...other config }
 * @param {object} options - { projectRoot?, limitOverride? }
 * @returns {object} Standard observe schema result
 */
function handleInternal(sourceConfig, options) {
  const label = sourceConfig.label || 'Internal Work';
  const projectRoot = options.projectRoot || process.cwd();
  const issues = [];

  try {
    // Category 1: Unfinished quick tasks
    try {
      const quickDir = path.resolve(projectRoot, '.planning/quick');
      if (fs.existsSync(quickDir)) {
        const entries = fs.readdirSync(quickDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          // Extract task number from directory name: e.g., "168-add-internal-work-detection"
          const dirName = entry.name;
          const match = dirName.match(/^(\d+)-/);
          if (!match) continue;

          const taskNum = match[1];
          const slug = dirName.slice(match[0].length);

          const planPath = path.join(quickDir, dirName, `${taskNum}-PLAN.md`);
          const summaryPath = path.join(quickDir, dirName, `${taskNum}-SUMMARY.md`);

          // Check: PLAN exists but SUMMARY does not
          if (fs.existsSync(planPath) && !fs.existsSync(summaryPath)) {
            const planStat = fs.statSync(planPath);
            issues.push({
              id: `internal-quick-${taskNum}`,
              title: `Unfinished quick task #${taskNum}: ${slug}`,
              severity: 'warning',
              url: '',
              age: formatAgeFromMtime(planStat.mtime),
              created_at: planStat.mtime.toISOString(),
              meta: 'PLAN exists, no SUMMARY',
              source_type: 'internal',
              issue_type: 'issue',
              _route: `/qgsd:quick "${slug}"`
            });
          }
        }
      }
    } catch (err) {
      // Log warning but continue with other scans (fail-open)
      console.warn(`[observe-internal] Warning scanning quick tasks: ${err.message}`);
    }

    // Category 2: Stale debug sessions
    try {
      const debugPath = path.resolve(projectRoot, '.planning/quick/quorum-debug-latest.md');
      if (fs.existsSync(debugPath)) {
        const stat = fs.statSync(debugPath);

        // Check if less than 7 days old
        const diffMs = Date.now() - stat.mtime.getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        if (diffMs < sevenDaysMs) {
          // Read file content to check for "unresolved" or "status: open"
          const content = fs.readFileSync(debugPath, 'utf8');
          const isUnresolved = /unresolved|status:\s*open/i.test(content);

          if (isUnresolved) {
            issues.push({
              id: 'internal-debug-latest',
              title: 'Unresolved debug session: quorum-debug-latest.md',
              severity: 'info',
              url: '',
              age: formatAgeFromMtime(stat.mtime),
              created_at: stat.mtime.toISOString(),
              meta: 'Debug session may need resolution',
              source_type: 'internal',
              issue_type: 'issue',
              _route: '/qgsd:debug --resume'
            });
          }
        }
      }
    } catch (err) {
      // Log warning but continue with other scans (fail-open)
      console.warn(`[observe-internal] Warning scanning debug sessions: ${err.message}`);
    }

    // Category 3: TODO/FIXME/HACK/XXX comments in codebase
    try {
      // Fix 5: Validate projectRoot exists before running grep
      if (!fs.existsSync(projectRoot)) {
        console.warn(`[observe-internal] projectRoot does not exist: ${projectRoot}, skipping TODO scan`);
      } else {
        const todoPatterns = [
          { tag: 'FIXME', severity: 'warning' },
          { tag: 'HACK', severity: 'warning' },
          { tag: 'XXX', severity: 'warning' },
          { tag: 'TODO', severity: 'info' }
        ];

        // Fix 2: Exclude .planning/ at grep level (not post-filter) to ensure
        // limit cap applies to real results, not .planning/ noise
        const excludeDirs = [
          'node_modules', '.git', '.planning',
          'vendor', 'dist', '.next', 'coverage'
        ];
        const excludeGlobs = excludeDirs.map(d => `--exclude-dir=${d}`);

        // File extensions to scan
        const includeExts = ['--include=*.js', '--include=*.cjs', '--include=*.mjs',
          '--include=*.ts', '--include=*.tsx', '--include=*.jsx',
          '--include=*.md', '--include=*.json', '--include=*.py',
          '--include=*.sh', '--include=*.css', '--include=*.html'];

        // Single grep call for all patterns: TODO|FIXME|HACK|XXX
        // Fix 1: Use -Z (--null) for NUL-separated file:line:content to handle colons in paths
        const pattern = '\\b(TODO|FIXME|HACK|XXX)\\b';
        const grepArgs = ['-rnZ', '-E', pattern, ...includeExts, ...excludeGlobs, projectRoot];

        let grepOutput = '';
        try {
          grepOutput = execFileSync('grep', grepArgs, {
            encoding: 'utf8',
            maxBuffer: 5 * 1024 * 1024, // 5MB cap
            timeout: 15000 // 15s timeout
          });
        } catch (grepErr) {
          // grep exits 1 when no matches found — that's fine
          if (grepErr.status !== 1) {
            console.warn(`[observe-internal] grep failed: ${grepErr.message}`);
          }
        }

        if (grepOutput) {
          const lines = grepOutput.split('\n').filter(l => l.trim());
          const limit = options.limitOverride || 50; // Cap to avoid noise
          const todoSeverityMap = Object.fromEntries(todoPatterns.map(p => [p.tag, p.severity]));

          let count = 0;
          for (const line of lines) {
            if (count >= limit) break;

            // Fix 1: With -Z flag, grep outputs: filePath\0lineNum:content
            // Split on first NUL byte to get filePath, then split remainder on first colon for lineNum:content
            const nulIdx = line.indexOf('\0');
            if (nulIdx < 0) {
              // Fallback for grep implementations that don't support -Z:
              // use legacy colon-split parsing
              const colonIdx = line.indexOf(':');
              if (colonIdx < 0) continue;
              const afterFile = line.indexOf(':', colonIdx + 1);
              if (afterFile < 0) continue;
              var filePath = line.slice(0, colonIdx);
              var lineNum = line.slice(colonIdx + 1, afterFile);
              var content = line.slice(afterFile + 1).trim();
            } else {
              var filePath = line.slice(0, nulIdx);
              const remainder = line.slice(nulIdx + 1);
              const colonIdx = remainder.indexOf(':');
              if (colonIdx < 0) continue;
              var lineNum = remainder.slice(0, colonIdx);
              var content = remainder.slice(colonIdx + 1).trim();
            }

            // Determine which tag matched
            const tagMatch = content.match(/\b(TODO|FIXME|HACK|XXX)\b/);
            const tag = tagMatch ? tagMatch[1] : 'TODO';
            const severity = todoSeverityMap[tag] || 'info';

            // Make path relative to project root for readability
            const relPath = path.relative(projectRoot, filePath);

            // Fix 3: Enrich TODO issues with fingerprint fields for debt writer
            // fingerprintIssue expects: { exception_type, function_name, message }
            issues.push({
              id: `internal-todo-${relPath}:${lineNum}`,
              title: `${tag} in ${relPath}:${lineNum}`,
              severity,
              url: '',
              age: '',
              created_at: new Date().toISOString(),
              meta: content.slice(0, 120),
              source_type: 'internal',
              issue_type: 'issue',
              exception_type: tag,
              function_name: relPath,
              _route: `/qgsd:quick "Resolve ${tag} at ${relPath}:${lineNum}"`
            });
            count++;
          }
        }
      }
    } catch (err) {
      console.warn(`[observe-internal] Warning scanning TODOs: ${err.message}`);
    }

    // Category 4: Active milestone phases without VERIFICATION.md
    try {
      const stateFilePath = path.resolve(projectRoot, '.planning/STATE.md');
      if (fs.existsSync(stateFilePath)) {
        const stateContent = fs.readFileSync(stateFilePath, 'utf8');

        // Extract Phase: value from STATE.md
        const phaseMatch = stateContent.match(/^Phase:\s+(.+?)$/m);
        if (phaseMatch) {
          let phase = phaseMatch[1].trim();

          // Skip if phase is empty or placeholder
          if (phase && phase !== '-' && phase !== '---') {
            // Sanitize phase string to prevent path traversal
            phase = phase.replace(/[^a-z0-9-]/g, '');

            if (phase) {
              const phaseDir = path.join(projectRoot, '.planning/phases', phase);

              // Check if phase directory exists
              if (fs.existsSync(phaseDir) && fs.statSync(phaseDir).isDirectory()) {
                // Check if any VERIFICATION.md file exists
                const entries = fs.readdirSync(phaseDir);
                const hasVerification = entries.some(f => f.endsWith('-VERIFICATION.md'));

                if (!hasVerification) {
                  issues.push({
                    id: `internal-milestone-${phase}`,
                    title: `Active phase ${phase} has no verification`,
                    severity: 'warning',
                    url: '',
                    age: '',
                    created_at: new Date().toISOString(),
                    meta: 'Phase active in STATE.md but no VERIFICATION.md found',
                    source_type: 'internal',
                    issue_type: 'issue',
                    _route: '/qgsd:solve'
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // Log warning but continue with other scans (fail-open)
      console.warn(`[observe-internal] Warning scanning milestone phases: ${err.message}`);
    }

    return {
      source_label: label,
      source_type: 'internal',
      status: 'ok',
      issues
    };
  } catch (err) {
    return {
      source_label: label,
      source_type: 'internal',
      status: 'error',
      error: `Internal work detection failed: ${err.message}`,
      issues: []
    };
  }
}

module.exports = { handleInternal, formatAgeFromMtime };
