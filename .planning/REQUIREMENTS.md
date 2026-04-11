# Requirements: nForma v0.42 — Repowise Intelligence Integration

**Defined:** 2026-04-11
**Core Value:** Planning decisions are multi-model verified by structural enforcement

## Baseline Requirements

*Included from nForma baseline defaults (profile: cli). Cross-cutting quality gates.*

### UX Heuristics
- [x] **UX-01**: Every user-initiated action produces immediate feedback (loading/disabled state) and completion feedback (result message, navigation change, or visible state update)
- [x] **UX-02**: Destructive actions (delete, reset, remove, overwrite) require explicit confirmation or provide undo within a reasonable window
- [x] **UX-03**: Error messages are human-readable, explain what went wrong, and suggest a next step or recovery action

### Security
- [x] **SEC-01**: Pre-commit hook runs secret scanning (e.g., Gitleaks) to block commits containing API keys, tokens, passwords, or credentials
- [x] **SEC-02**: CI pipeline runs deep secret scanning (e.g., TruffleHog) across full repo history on every PR
- [x] **SEC-03**: All external input (user input, API request bodies, query parameters, file uploads) is validated and sanitized at system boundaries before processing
- [x] **SEC-04**: Dependencies are scanned for known vulnerabilities in CI (e.g., npm audit, Dependabot, Snyk) and critical/high findings block merge

### Reliability
- [x] **REL-01**: Failures in external services (APIs, databases, third-party SDKs) are caught and handled gracefully — the application degrades functionality rather than crashing
- [x] **REL-02**: Long-running operations (file uploads, data processing, API calls >2s) show progress indication and can be cancelled by the user

### Observability
- [x] **OBS-01**: CLI tools exit with appropriate codes (0 = success, non-zero = failure) and write errors to stderr, output to stdout

### CI/CD
- [x] **CI-01**: Automated test suite runs on every pull request and merge to main is blocked when tests fail
- [x] **CI-02**: Linting and formatting checks run in CI and block merge on violations
- [x] **CI-03**: Type checking (if applicable to the language) runs in CI and blocks merge on type errors

## Milestone v0.42 Requirements

### Context Packing
- [x] **PACK-01**: User can deliver file contents to LLMs in XML-style tagged format (`<file path="...">...</file>`) that preserves structure while reducing token overhead vs raw source inclusion
- [x] **PACK-02**: User can escape XML-special characters in packed content via an `escapeXml()` helper that handles `<`, `>`, `&`, `"`, `'` — preventing malformed XML output
- [x] **PACK-03**: User can invoke `context-packer.cjs` as a single entry point that orchestrates all Repowise intelligence modules (skeleton, hotspot, co-change) and produces a unified packed context output
- [x] **PACK-04**: User can compress skeleton detail level based on a token budget, so that the system adapts output to fit within context window constraints rather than producing uniformly detailed output

### Skeleton Views
- [x] **SKEL-01**: User can parse source files into ASTs via `web-tree-sitter` WASM with lazy initialization (Parser.init() on first use, not at CLI startup)
- [x] **SKEL-02**: User can extract a structural skeleton from parsed AST showing function/class/method names with line ranges (start-end), producing ~5-10% of original token count
- [x] **SKEL-03**: User can parse JavaScript, TypeScript, and Python files out of the box via bundled grammar packages; additional languages available via optional grammar installation
- [x] **SKEL-04**: User can see hotspot risk scores and coupling degree embedded in skeleton output, so skeleton entries for high-risk or highly-coupled code are annotated with behavioral intelligence

### Hotspot Detection
- [x] **HOT-01**: User can compute per-file churn scores from git log with streaming parsing that handles repos with 10K+ commits without exceeding maxBuffer
- [x] **HOT-02**: User can compute per-file cyclomatic complexity by counting decision points in the tree-sitter AST, producing a language-agnostic complexity score
- [x] **HOT-03**: User can compute a hotspot risk score as the normalized intersection of churn and complexity, identifying files that are both frequently changed and structurally complex
- [x] **HOT-04**: User can exclude high-noise paths (generated files, vendored dirs, mass-refactor commits) and normalize by file size to reduce false positive hotspot signals
- [x] **HOT-05**: User can have high-risk hotspot files automatically escalate quorum fan-out in `nf-prompt.js`, so agents receive more review capacity on risky code changes

### Co-Change Prediction
- [x] **COCH-01**: User can mine file co-occurrence from git history, counting how often file pairs appear in the same commit
- [x] **COCH-02**: User can compute temporal coupling scores with configurable thresholds (min_shared_commits, min_coupling_degree) to identify implicitly related files
- [x] **COCH-03**: User can filter out mass-refactoring commits by inverse file-count weighting, so commits touching 50+ files contribute less coupling signal than focused changes
- [x] **COCH-04**: User can have co-change pairs injected into the debug context bundle, so `/nf:debug` surfaces implicit coupling when investigating bugs in related files

## Future Requirements

### Advanced Classification
- **ROUTE-05**: Classification confidence scoring with fallback to user prompt on low confidence
- **ROUTE-06**: Multi-intent detection (task is both a bug fix AND a feature addition)

### Autoresearch Enhancements
- **LOOP-01**: Cross-session TSV history persistence (learn from prior solve sessions)
- **LOOP-02**: Composite quality score for refinement sessions (penalizes vacuous models)

### Technical Debt Requirements
- **DEBT-07**: Formalize constraint extraction for debug invariants in propose-debug-invariants.cjs
- **DEBT-08**: Add future instrumentation source for per-file trace data in formalization-candidates.cjs
- **DEBT-09**: Standardize JSON read/write serialization patterns across bin/ scripts
- **DEBT-10**: Standardize path resolution: consolidate _nfBin helper usage across bin/ modules
- **DEBT-11**: Reduce empty catch block proliferation in check-provider-health.cjs, call-quorum-slot.cjs, nForma.cjs
- **DEBT-12**: Create formal model for shell-safe prompt delivery (stdin piping, no escaping)
- **DEBT-13**: Create formal model for quorum slot model deduplication (diversity guarantee)
- **DEBT-14**: Create formal model for net_residual computation (FP subtraction from raw sweep residuals)
- **DEBT-15**: Create formal model for solve convergence layer-transition sweeps (L1->L2, L2->L3, L3->TC)

### Repowise v2
- **PACK-05**: Grammar auto-discovery — nForma ships a grammar registry that auto-downloads `.wasm` files on first use
- **SKEL-05**: Multi-language grammar hot-reload without CLI restart
- **HOT-06**: Per-function hotspot scoring (function-level churn × complexity instead of file-level)
- **COCH-05**: Sliding window co-change analysis (last N commits instead of full history)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changes to autoresearch-refine.cjs or solution-simulation-loop.cjs internals | Already shipped in quick-348 and quick-350 |
| New formal model creation for Repowise features | Can be added as formal scope scan discovers invariants; not a prerequisite |
| Interactive user prompts during Repowise analysis | Repowise modules are autonomous by design |
| Full Aider-compatible repomap format | nForma's skeleton format is different; compatibility not needed |
| Native tree-sitter bindings (C++) | WASM is portable and avoids native compilation issues; performance is sufficient for CLI use |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PACK-01 | Phase 54 | MET |
| PACK-02 | Phase 54 | MET |
| PACK-03 | Phase 54 | MET |
| PACK-04 | Phase 58 | MET |
| SKEL-01 | Phase 57 | MET |
| SKEL-02 | Phase 57 | MET |
| SKEL-03 | Phase 57 | MET |
| SKEL-04 | Phase 57 | MET |
| HOT-01 | Phase 55 | MET |
| HOT-02 | Phase 57 | MET |
| HOT-03 | Phase 55 | MET |
| HOT-04 | Phase 55 | MET |
| HOT-05 | Phase 55 | MET |
| COCH-01 | Phase 56 | MET |
| COCH-02 | Phase 56 | MET |
| COCH-03 | Phase 56 | MET |
| COCH-04 | Phase 56 | MET |

**Coverage:**
- v0.42 requirements: 16 total
- Baseline requirements: 13 (carried forward)
- Mapped to phases: 16/16 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11*
