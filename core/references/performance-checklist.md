# Performance Checklist

Use this checklist when reviewing changes that affect startup time, install speed, runtime efficiency, or resource usage.

## Startup and install performance

- [ ] `node bin/install.js` completes in under 10 seconds on a warm cache
- [ ] No synchronous network calls during install
- [ ] File I/O during install uses bulk operations where possible (batch copy, not per-file)
- [ ] Hook registration does not duplicate entries on reinstall

## Runtime performance

- [ ] Hot paths avoid synchronous file reads — prefer caching or lazy loading
- [ ] Large JSON files (requirements.json, nf.json) are read once and cached per session
- [ ] MCP health checks use timeouts (10s default) to avoid hanging
- [ ] Quorum dispatch uses parallel Task calls, not sequential blocking calls

## Token and context efficiency

- [ ] Subagent prompts are concise — avoid sending unnecessary context
- [ ] File-based output preferred over stdout parsing for slot workers
- [ ] Skill and command files stay small (under 500 lines) to avoid bloating context
- [ ] System prompts do not repeat information already in the conversation

## Test suite performance

- [ ] Full test suite (`npm run test:ci`) completes in under 60 seconds
- [ ] No unnecessary `setTimeout` or `sleep` in tests
- [ ] Tests that hit the file system use in-memory fixtures where possible
- [ ] Parallel test execution is not blocked by shared state

## Bundle and package size

- [ ] No large binary files committed to the repository
- [ ] `node_modules` is not included in distributed artifacts
- [ ] Generated assets (terminal.svg) are regenerated only when source changes

## The optimization cycle

Measure -> Identify -> Fix -> Verify -> Guard

1. **Measure** — capture current metric with real numbers
2. **Identify** — profile the actual bottleneck (not the suspected one)
3. **Fix** — change one thing at a time, prefer simple fixes
4. **Verify** — re-measure against baseline, revert if not measurable
5. **Guard** — add a performance test or budget

## Common bottleneck patterns

- **N+1 queries**: use joins or batch fetching instead of loops
- **Synchronous file I/O in hot paths**: cache or lazy-load
- **Unbounded data fetching**: paginate, limit, or stream
- **Missing timeouts on external calls**: always set timeouts
- **Large bundles**: tree-shake imports, lazy-load heavy features
- **Redundant work**: cache computed results per session

## Attribution

Adapted for nForma from the MIT-licensed performance-checklist reference in [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
