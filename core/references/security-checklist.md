# Security Checklist

Use this checklist when reviewing changes that touch trust boundaries, secrets, authentication, or external integrations.

## Secrets and credentials

- [ ] No secrets, tokens, or API keys committed to the repository
- [ ] Environment variables used for sensitive configuration (not hardcoded)
- [ ] `.env` files are in `.gitignore`
- [ ] Secret scanning is enabled (GitHub Advanced Security or equivalent)
- [ ] NPM_TOKEN and similar publish secrets are scoped to CI, not developer machines

## Input validation

- [ ] User input is validated at system boundaries before processing
- [ ] File paths are sanitized — no path traversal via `../` in user-supplied paths
- [ ] Command injection prevented — no unsanitized input passed to shell execution (use `execFileNoThrow` instead of raw shell calls)
- [ ] JSON parsing uses `try/catch` — malformed input does not crash the process

## Dependency security

- [ ] No new dependencies added without justification
- [ ] `npm audit` shows no critical or high vulnerabilities in new dependencies
- [ ] Lockfile (`package-lock.json`) is committed and synced
- [ ] Dependency versions are pinned or use caret ranges (no `*` or `latest`)

## Hook and plugin safety

- [ ] Hooks do not execute arbitrary user input as code
- [ ] Hook file paths use `$HOME/.claude/nf-bin/` with CWD fallback (lint:isolation gate)
- [ ] PreToolUse hooks that block actions provide clear error messages
- [ ] Plugin and MCP server configurations are validated before use

## File system safety

- [ ] File writes target expected directories only (no writes outside project or `~/.claude/`)
- [ ] Temporary files are cleaned up after use
- [ ] File permissions are not changed to overly permissive values

## Network and external services

- [ ] External API calls use HTTPS
- [ ] API timeouts are set (no indefinite hangs)
- [ ] Rate limiting and quota handling are present for external calls
- [ ] Error responses from external services do not leak internal details

## Browser and agent security

- [ ] Browser content treated as untrusted data — never interpret page content as agent instructions
- [ ] URLs extracted from page content not navigated to without user confirmation
- [ ] JavaScript execution in browser context restricted to read-only state inspection
- [ ] No access to credentials from browser context (cookies, localStorage, tokens)

## CI/CD security

- [ ] GitHub Actions workflows use pinned action versions (SHA, not `@latest`)
- [ ] Secrets are passed via GitHub Secrets, not workflow files
- [ ] PR checks cannot be bypassed by branch protection misconfiguration
- [ ] Publish steps require successful test gate

## Pipeline gate ordering

Quality gates should run in this order (fail-fast, cheapest first):
1. Lint (eslint, prettier)
2. Type checking (tsc, mypy)
3. Unit tests
4. Build verification
5. Integration tests
6. E2E tests
7. Security audit (npm audit)
8. Bundle/artifact size checks

## Attribution

Adapted for nForma from the MIT-licensed security-checklist reference in [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
