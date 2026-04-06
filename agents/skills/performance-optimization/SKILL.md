---
name: nf:performance-optimization
description: Guides performance analysis and optimization — measure first, fix bottlenecks, verify improvement, guard against regression.
---

# performance-optimization skill

Purpose
-------
Systematically improve performance by measuring first, targeting real bottlenecks, verifying improvements, and guarding against regression. This skill applies to any performance domain: startup time, runtime latency, memory usage, bundle size, database queries, or API response time.

When to use
-----------
- A feature or endpoint is slower than acceptable
- Startup or install time has regressed
- Bundle size or memory usage has grown unexpectedly
- Before shipping a performance-sensitive change
- When the user asks to optimize or profile something

High-level steps
----------------
1) Measure — establish a baseline
  - Capture the current metric (latency, size, memory, time)
  - Use real numbers, not guesses
  - Record the baseline so improvement can be verified

2) Identify — find the actual bottleneck
  - Profile the code path (not the code you suspect)
  - Look for: N+1 queries, synchronous I/O in hot paths, unnecessary re-renders, large payloads, missing caches
  - Rank bottlenecks by impact, not by ease of fix

3) Fix — address the specific bottleneck
  - Change one thing at a time
  - Prefer simple fixes (caching, batching, lazy loading) over clever rewrites
  - Do not optimize code that is not on the critical path

4) Verify — confirm the improvement
  - Re-measure the same metric from step 1
  - Compare against baseline with real numbers
  - If the improvement is not measurable, revert

5) Guard — prevent regression
  - Add a performance test or budget if the metric matters
  - Document the optimization and why it was needed
  - Reference `references/performance-checklist.md` for project conventions

Common bottleneck patterns
--------------------------
- **N+1 queries**: Use joins or batch fetching instead of loops
- **Synchronous file I/O in hot paths**: Cache or lazy-load
- **Unbounded data fetching**: Paginate, limit, or stream
- **Missing timeouts on external calls**: Always set timeouts (10s default for MCP health checks)
- **Large bundles**: Tree-shake imports, lazy-load heavy features
- **Redundant work**: Cache computed results per session

Anti-patterns to avoid
----------------------
- Optimizing without measuring ("I think this is slow")
- Optimizing cold paths that run once at startup
- Adding complexity for marginal gains (< 5% improvement)
- Premature caching without evidence of repeated computation
- Keeping optimizations that make code significantly harder to understand

Integration with nForma
------------------------
- Pairs with `references/performance-checklist.md`
- After optimization, run `nf:code-review-and-quality` to verify the change is merge-ready
- For install/startup performance, check `node bin/install.js` timing
- For test suite performance, target `npm run test:ci` under 60 seconds

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `performance-optimization` skill in `addyosmani/agent-skills`.
