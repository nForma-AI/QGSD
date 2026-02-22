# Phase 36 Verification

status: passed
date: 2026-02-22

## Requirements Verified

### INST-01: Installer nudge for no quorum agents
- hasClaudeMcpAgents() helper added to bin/install.js
- Detection: matches by known template names (claude-deepseek etc.) OR by args path containing 'claude-mcp-server'
- Nudge text: "No quorum agents configured. Run /qgsd:mcp-setup in Claude Code to set up your agents."
- Runtime guard: nudge only shown when `runtime === 'claude'`
- Fail-open: errors return false, never block install
- Evidence: `grep -c "hasClaudeMcpAgents" bin/install.js` = 3 (comment + definition + finishInstall call)

## File Integrity
- bin/install.js: `node --check` exits 0
- No Phase 36 in operational code
- Self-test all 5 cases: PASS
