# Quorum Debate
Question: What is the proper way to find and invoke the Claude Code CLI binary from a Node.js subprocess (execFileSync) in a Claude Code plugin?
Date: 2026-03-10
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude (Opus 4.6) | Option A — scan ~/.local/share/claude/versions/, pick latest semver, use absolute path in execFileSync | lsof output showing binary at ~/.local/share/claude/versions/2.1.72 |
| codex-1 | UNAVAIL | — |
| gemini-1 | UNAVAIL | — |
| opencode-1 (T1 fallback for codex-1) | Option A — dynamic resolution with semver sort | — |
| copilot-1 (T1 fallback for gemini-1) | UNAVAIL | — |
| claude-1/DeepSeek-V3.2 (T2 fallback) | Option A + CRITICAL: must unset CLAUDECODE env var | Verified CLAUDECODE=1 blocks nested sessions; tested binary at versioned path |

## Outcome
Unanimous consensus on Option A (dynamic binary path resolution). Key implementation details:

1. **Resolve path**: Scan `~/.local/share/claude/versions/`, filter for semver-named files, sort descending, select highest
2. **Unset CLAUDECODE**: Critical — `CLAUDECODE=1` is inherited from the parent Claude Code session and blocks subprocess invocation with "cannot be launched inside another Claude Code session"
3. **Use absolute path**: Pass resolved path directly to `execFileSync()` instead of relying on PATH

### Why other options fail
- (B) PATH augmentation: Binary isn't symlinked to any PATH location; doesn't address CLAUDECODE
- (C) Agent tool: Not available from .cjs files; wrong abstraction level
- (D) npx: No npm package for the native binary
