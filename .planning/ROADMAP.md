# Roadmap: nForma v0.42 — Repowise Intelligence Integration

**Created:** 2026-04-11
**Milestone:** v0.42
**Profile:** cli
**Depth:** standard
**Global phase range:** 54-58

## Overview

5 phases, 16 requirements. This milestone adds a "Repowise Intelligence" layer that gives AI coding agents structural understanding of repositories at a fraction of the token cost. The dependency chain follows a deliberate blast-radius-minimization strategy: XML packing (zero deps) establishes the delivery format, then git-only features (hotspot detection, co-change prediction) deliver standalone value without tree-sitter, then skeleton views introduces the single new dependency (web-tree-sitter WASM), and finally budget-aware compression requires all signals to be working. If tree-sitter fails to install on any platform, Phases 54-56 still deliver full value.

---

## Phases

- [ ] **Phase 54: XML Context Packer** — Zero-dep delivery format that all other modules feed into
- [ ] **Phase 55: Hotspot Detection** — Git-log-only churn × heuristic complexity risk scoring with nf-prompt escalation
- [ ] **Phase 56: Co-Change Prediction** — Git-log-only implicit coupling mining with debug bundle injection
- [ ] **Phase 57: Skeleton Views** — Tree-sitter AST structural code views with AST-based complexity upgrade
- [ ] **Phase 58: Budget-Aware Compression** — Adaptive skeleton detail based on token budget and risk signals

## Phase Details

### Phase 54: XML Context Packer
**Goal**: Users can deliver file contents to LLMs in structured XML format that reduces token overhead while preserving code structure
**Depends on**: Nothing (foundation phase)
**Requirements**: PACK-01, PACK-02, PACK-03
**Success Criteria** (what must be TRUE):
  1. User can pack a file's content into `<file path="...">...</file>` XML tags and the output is well-formed, parseable XML
  2. User can include files containing `<`, `>`, `&`, `"`, `'` characters and the packed output remains well-formed XML (no broken tags or entities)
  3. User can run `context-packer.cjs` as a single entry point that produces a complete packed context output with sections for skeleton, hotspot, and co-change (initially empty placeholders that other phases will fill)
**Plans**: TBD

Plans:
- [ ] 54-01: TBD
- [ ] 54-02: TBD

### Phase 55: Hotspot Detection
**Goal**: Users can identify high-risk files that are both frequently changed and structurally complex, and those risks automatically escalate agent review capacity
**Depends on**: Phase 54 (hotspot output feeds into context-packer)
**Requirements**: HOT-01, HOT-03, HOT-04, HOT-05
**Success Criteria** (what must be TRUE):
  1. User can compute per-file churn scores from git log in repos with 10K+ commits without memory overflow, via streaming parsing
  2. User can see a hotspot risk score for each file that combines churn and complexity, identifying files that are both frequently changed and structurally complex
  3. User can exclude generated files, vendored dirs, and mass-refactor commits from hotspot analysis to reduce false positive signals
  4. User's high-risk hotspot files automatically escalate quorum fan-out in `nf-prompt.js`, so agents receive more review capacity on risky code changes
**Plans**: TBD

Plans:
- [ ] 55-01: TBD
- [ ] 55-02: TBD

### Phase 56: Co-Change Prediction
**Goal**: Users can discover implicitly coupled files that frequently change together in git history, and those couplings automatically surface during debugging
**Depends on**: Phase 54 (co-change output feeds into context-packer)
**Requirements**: COCH-01, COCH-02, COCH-03, COCH-04
**Success Criteria** (what must be TRUE):
  1. User can mine file co-occurrence pairs from git history and see how often file pairs appear in the same commit
  2. User can filter temporal coupling results by configurable thresholds (min_shared_commits, min_coupling_degree) to focus on meaningful coupling
  3. User can exclude mass-refactoring commits (50+ files) from coupling analysis so focused changes carry more weight than bulk edits
  4. User running `/nf:debug` on a file sees co-change partners automatically injected into the debug context bundle
**Plans**: TBD

Plans:
- [ ] 56-01: TBD
- [ ] 56-02: TBD

### Phase 57: Skeleton Views
**Goal**: Users can see structural code views at a fraction of the token cost, enriched with behavioral intelligence from hotspot and co-change analysis
**Depends on**: Phase 55 (hotspot scores enrich skeleton), Phase 56 (coupling scores enrich skeleton)
**Requirements**: SKEL-01, SKEL-02, SKEL-03, SKEL-04, HOT-02
**Success Criteria** (what must be TRUE):
  1. User can parse source files into ASTs via `web-tree-sitter` WASM with lazy initialization (Parser.init() on first use, not at CLI startup)
  2. User can extract a structural skeleton from parsed AST showing function/class/method names with line ranges, producing ~5-10% of original token count
  3. User can parse JavaScript, TypeScript, and Python files out of the box via bundled grammar packages; additional languages available via optional grammar installation
  4. User can see hotspot risk scores and coupling degree embedded in skeleton output, so skeleton entries for high-risk or highly-coupled code are annotated with behavioral intelligence
  5. User can compute per-file cyclomatic complexity by counting decision points in the tree-sitter AST, producing a language-agnostic complexity score
**Plans**: TBD

Plans:
- [ ] 57-01: TBD
- [ ] 57-02: TBD
- [ ] 57-03: TBD

### Phase 58: Budget-Aware Compression
**Goal**: Users can adapt context output to fit within context window constraints, prioritizing detail for important code
**Depends on**: Phase 55 (hotspot scores), Phase 56 (coupling scores), Phase 57 (skeleton detail levels)
**Requirements**: PACK-04
**Success Criteria** (what must be TRUE):
  1. User can specify a token budget and `context-packer.cjs` compresses skeleton detail to fit within that budget, adapting output rather than producing uniformly detailed output
  2. User can see that high-risk hotspot files retain more detail than low-risk files when budget is constrained
  3. When budget is insufficient even for minimum skeletons, context-packer produces a filename-only listing rather than empty output or an error
**Plans**: TBD

Plans:
- [ ] 58-01: TBD

## Progress

**Execution Order:** Phase 54 → Phase 55 → Phase 56 → Phase 57 → Phase 58

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 54. XML Context Packer | 0/? | Not started | - |
| 55. Hotspot Detection | 0/? | Not started | - |
| 56. Co-Change Prediction | 0/? | Not started | - |
| 57. Skeleton Views | 0/? | Not started | - |
| 58. Budget-Aware Compression | 0/? | Not started | - |
