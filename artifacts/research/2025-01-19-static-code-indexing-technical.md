# Technical Research: Self-Evolving Codebase Intelligence for GSD

## Strategic Summary

The most mind-blowing approach combines **semantic code indexing** (tree-sitter AST + voyage-code-3 embeddings), **adaptive pattern learning** (conventions extracted and refined through feedback), and **self-improving compliance** (the system gets smarter about YOUR codebase over time). Instead of static indices that go stale, this creates a **living knowledge graph** that understands not just what code exists, but WHY it's structured that way—and enforces that understanding during execution.

**Recommendation:** Approach 3 (Self-Evolving Intelligence) - because "mindblowing" means the system should feel like it genuinely understands your codebase and gets better over time.

## Requirements

- Zero external services (local-first, works offline)
- Sub-second queries (can't slow down Claude's planning/execution)
- Adaptive learning (improves from corrections without manual intervention)
- Works across language ecosystems (not just TypeScript)
- Integrates seamlessly with existing GSD workflow
- Minimal storage overhead (< 50MB for typical project)

---

## Approach 1: Static JSON Indices with Stale Detection

**How it works:** Generate JSON indices during `map-codebase`, store commit hash in metadata, refresh lazily when HEAD moves.

**Libraries/tools:**
- tree-sitter (AST parsing) - `npm install tree-sitter tree-sitter-typescript tree-sitter-python`
- Node.js built-in fs for JSON persistence
- Git hooks via husky or manual `.git/hooks/post-commit`

**Pros:**
- Simple to implement (~500 lines)
- No external dependencies
- Fast queries (JSON parse + lookup)
- Familiar format (developers can hand-edit)

**Cons:**
- Indices go stale between sessions
- No semantic understanding (just structural data)
- Manual schema maintenance
- Doesn't learn from corrections

**Best when:** You want quick wins with minimal complexity

**Complexity:** S

---

## Approach 2: Semantic Search with Local Embeddings

**How it works:** Embed code chunks using voyage-code-3, store in sqlite-vec, enable semantic queries like "find authentication logic" or "code that validates user input."

**Libraries/tools:**
- `voyage-code-3` via API (200M tokens free, $0.06/1M after)
- `sqlite-vec` - pure C, runs anywhere SQLite runs
- `tree-sitter` for intelligent chunking (function-level, not file-level)
- `better-sqlite3` for Node.js bindings

**Architecture:**
```
Code Changes → Tree-sitter chunks → voyage-code-3 embeds → sqlite-vec stores
                                                              ↓
Query ("auth logic") → embed query → sqlite-vec similarity → ranked results
```

**Pros:**
- Semantic understanding ("find error handling" works even with varied naming)
- Hybrid search possible (FTS5 keywords + vector similarity)
- Local-first with cloud embeddings (best of both)
- Works across languages (voyage-code-3 trained on 80+ languages)

**Cons:**
- Requires API calls for embedding (latency, cost at scale)
- More complex setup
- Still doesn't learn conventions automatically
- Embedding drift as model versions change

**Best when:** You need powerful search across large/unfamiliar codebases

**Complexity:** M

---

## Approach 3: Self-Evolving Codebase Intelligence (The Mind-Blowing One)

**How it works:** Three-layer system that builds understanding incrementally and learns from corrections.

### Layer 1: Structural Index (Tree-sitter AST)
Fast, deterministic extraction of code structure:
- Functions, classes, exports, imports
- File patterns and naming conventions
- Directory structure and module boundaries

### Layer 2: Semantic Memory (Embeddings + Patterns)
Understanding what code DOES, not just what it IS:
- Function-level embeddings via voyage-code-3
- Pattern clusters detected via embedding similarity
- Convention rules extracted from consistent patterns

### Layer 3: Adaptive Learning (The Magic)
The system improves from every interaction:
- When Claude deviates from conventions and you correct it → system learns
- When Claude asks "should this be a service or util?" and you answer → system remembers
- Confidence scores that increase with consistent patterns, decrease with exceptions

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                     Codebase Intelligence                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  STRUCTURE  │  │  SEMANTICS  │  │     LEARNED RULES       │ │
│  │  (AST/JSON) │  │ (Embeddings)│  │   (Adaptive/Scored)     │ │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────────┤ │
│  │ symbols.json│  │ sqlite-vec  │  │ conventions.json        │ │
│  │ patterns.json  │ + FTS5      │  │ ├─ rule: "services/*"   │ │
│  │ structure.json │             │  │ │  confidence: 0.95     │ │
│  │             │  │             │  │ │  examples: [...]      │ │
│  │             │  │             │  │ │  exceptions: [...]    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      FEEDBACK LOOP                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐  │
│  │ Executor │ → │ Deviation │ → │ User Correction/Approval │  │
│  │ writes   │    │ detected  │    │ → Update confidence      │  │
│  │ code     │    │           │    │ → Add to examples        │  │
│  └──────────┘    └──────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Libraries/tools:**
```bash
# Core parsing
npm install tree-sitter tree-sitter-typescript tree-sitter-python tree-sitter-go tree-sitter-rust

# Vector storage (local)
npm install better-sqlite3
# sqlite-vec compiled extension (downloaded during install)

# Embeddings (API)
npm install voyageai  # or call API directly

# Optional: Local embeddings fallback
# ollama pull nomic-embed-text (for offline mode)
```

**The "Mind-Blowing" Features:**

1. **Convention Inference Engine**
   - Analyzes existing code to detect patterns automatically
   - "I see 15 files matching `src/services/*.service.ts`, all exporting classes with `@Injectable()`"
   - Confidence scores: 15 examples = high confidence, 2 examples = tentative

2. **Deviation Detection During Execution**
   - Before Claude writes `src/utils/auth.ts`, check conventions
   - "This looks like a service (has `@Injectable`, depends on repository). Convention suggests `src/services/auth.service.ts`"
   - NOT blocking—advisory with reasoning

3. **Correction Learning**
   - User says "no, utils is correct here because X"
   - System adds exception: `{pattern: "auth*", location: "utils", reason: "X", confidence: 0.8}`
   - Future similar cases consider this exception

4. **Semantic "Why" Queries**
   - Claude can ask the index: "Why is UserRepository in `src/data` not `src/repositories`?"
   - Index returns: historical context, similar patterns, any recorded exceptions

5. **Auto-Refresh with Minimal Recomputation**
   - Git hook triggers on commit
   - Only re-index changed files (incremental)
   - Only re-embed functions that changed (hash comparison)
   - Full re-scan weekly or on major refactors

**Pros:**
- Feels magical ("it knows my codebase")
- Gets smarter over time (adaptive)
- Handles edge cases gracefully (exceptions are learned, not errors)
- Works across languages
- Local-first with optional cloud embeddings

**Cons:**
- Most complex to implement (~2000 lines + iteration)
- Requires careful feedback loop design
- Cold start problem (needs usage to learn)
- More storage (embeddings + history)

**Best when:** You want GSD to feel like a senior engineer who truly knows the codebase

**Complexity:** L

---

## Approach 4: MCP Server Integration (Leverage Existing Tools)

**How it works:** Use existing code-index-mcp or claude-context MCP servers, integrate with GSD's planning/execution.

**Libraries/tools:**
- `code-index-mcp` or `claude-context` MCP server
- GSD adds MCP configuration to project setup
- Planner/executor query MCP tools instead of custom indices

**Pros:**
- Leverage battle-tested implementations
- Active community development
- Already handles tree-sitter, embeddings, incremental updates
- MCP is Claude Code native

**Cons:**
- Less control over index structure
- May not support adaptive learning
- Another dependency to manage
- May not align perfectly with GSD's workflow

**Best when:** You want proven tooling without building from scratch

**Complexity:** M

---

## Comparison

| Aspect | Static JSON | Semantic Search | Self-Evolving | MCP Server |
|--------|-------------|-----------------|---------------|------------|
| Complexity | S | M | L | M |
| Query Speed | Instant | ~100ms | ~150ms | Varies |
| Semantic Understanding | None | Good | Excellent | Good |
| Learns from Corrections | No | No | Yes | No |
| Offline Capable | Yes | Partial | Partial | Depends |
| Cross-language | Manual | Yes | Yes | Yes |
| Maintenance | Manual | Medium | Self-maintaining | External |
| "Wow Factor" | Low | Medium | High | Medium |

---

## Recommendation

**Go with Approach 3: Self-Evolving Intelligence**, implemented in phases:

**Phase 1 (MVP):** Static JSON indices with tree-sitter extraction
- Get basic pattern detection working
- Prove value before adding complexity

**Phase 2 (Semantic):** Add sqlite-vec + voyage-code-3
- Enable "find code that does X" queries
- Hybrid search for maximum flexibility

**Phase 3 (Adaptive):** Add feedback loop and confidence scoring
- Convention rules with confidence
- Learn from corrections
- The "magic" emerges here

**Phase 4 (Polish):** Auto-refresh, git hooks, exception handling
- Incremental updates
- Graceful degradation when offline

---

## Implementation Context

<claude_context>
<chosen_approach>
- name: Self-Evolving Codebase Intelligence (phased)
- libraries:
  - tree-sitter + language grammars (parsing)
  - better-sqlite3 + sqlite-vec extension (storage)
  - voyageai SDK or direct API (embeddings)
  - chokidar (file watching, optional)
- install: |
    npm install tree-sitter tree-sitter-typescript tree-sitter-python tree-sitter-go
    npm install better-sqlite3
    # sqlite-vec: download prebuilt from https://github.com/asg017/sqlite-vec/releases
    npm install voyageai
</chosen_approach>
<architecture>
- pattern: Three-layer knowledge graph (Structure → Semantics → Learned Rules)
- components:
  - CodebaseIndexer: Orchestrates tree-sitter parsing, embedding generation, storage
  - StructureExtractor: AST → JSON symbols, patterns, structure
  - SemanticMemory: sqlite-vec for embeddings, FTS5 for keywords
  - ConventionEngine: Pattern detection, rule inference, confidence scoring
  - FeedbackCollector: Captures corrections, updates confidence, logs exceptions
  - QueryInterface: Unified API for planner/executor to query knowledge
- data_flow: |
    Init: codebase → tree-sitter → symbols.json + patterns.json
                  → voyage-code-3 → sqlite-vec
                  → ConventionEngine → conventions.json

    Query: planner asks "where should auth service go?"
           → QueryInterface checks conventions.json (high confidence rules)
           → Falls back to semantic search if no rule
           → Returns recommendation with reasoning

    Feedback: executor writes code → deviation detected → user corrects
              → FeedbackCollector updates rule confidence or adds exception
</architecture>
<files>
- create:
  - `.planning/indices/symbols.json` - Extracted code symbols
  - `.planning/indices/patterns.json` - Detected architectural patterns
  - `.planning/indices/conventions.json` - Learned rules with confidence
  - `.planning/indices/codebase.db` - sqlite-vec embeddings + FTS5
  - `.planning/indices/meta.json` - Commit hash, last update, stats
  - `get-shit-done/lib/indexer/` - Index generation code
  - `get-shit-done/lib/query/` - Query interface for planner/executor
- structure: |
    .planning/
      indices/
        symbols.json       # {exports, imports, classes, functions}
        patterns.json      # {detected patterns with locations}
        conventions.json   # {rules with confidence, examples, exceptions}
        codebase.db        # sqlite-vec + FTS5 hybrid storage
        meta.json          # {lastCommit, lastUpdate, stats}
- reference:
  - `.planning/codebase/ARCHITECTURE.md` - Use as input for initial pattern detection
  - `.planning/codebase/CONVENTIONS.md` - Seed initial convention rules
  - `commands/gsd/map-codebase.md` - Extend to also generate indices
</files>
<implementation>
- start_with: StructureExtractor using tree-sitter (symbols.json output)
- order:
  1. Tree-sitter parsing → symbols.json (Phase 1)
  2. Pattern detection → patterns.json (Phase 1)
  3. sqlite-vec setup + embedding generation (Phase 2)
  4. ConventionEngine + confidence scoring (Phase 3)
  5. FeedbackCollector + correction learning (Phase 3)
  6. Git hooks + incremental updates (Phase 4)
  7. Query interface integration with planner/executor (Phase 4)
- gotchas:
  - Tree-sitter grammars are separate packages per language
  - sqlite-vec is a C extension, needs platform-specific binary
  - voyage-code-3 has 32K context but 120K token batch limit
  - Chunking strategy matters: function-level > file-level for embeddings
  - Confidence scores need tuning (start conservative, adjust based on feedback)
  - Don't over-index: only public exports, key patterns, not every variable
- testing:
  - StructureExtractor: Parse known files, verify symbol extraction
  - SemanticMemory: Embed test functions, verify similarity search
  - ConventionEngine: Feed patterns, verify rule inference
  - FeedbackCollector: Simulate corrections, verify confidence updates
  - Integration: Full flow from code change → query → recommendation
</implementation>
</claude_context>

**Next Action:** Start with Phase 1 - build the tree-sitter StructureExtractor that outputs `symbols.json` for a test project. This proves the parsing pipeline works before adding embeddings.

---

## Sources

- [Semantic Code Indexing with AST and Tree-sitter](https://medium.com/@email2dineshkuppan/semantic-code-indexing-with-ast-and-tree-sitter-for-ai-agents-part-1-of-3-eb5237ba687a) - Tree-sitter fundamentals
- [mcp-server-tree-sitter](https://github.com/wrale/mcp-server-tree-sitter) - Reference implementation
- [code-index-mcp](https://github.com/johnhuang316/code-index-mcp) - 7-language tree-sitter integration
- [claude-context (Zilliz)](https://github.com/zilliztech/claude-context) - 40% token reduction with semantic search
- [voyage-code-3 announcement](https://blog.voyageai.com/2024/12/04/voyage-code-3/) - State-of-art code embeddings
- [sqlite-vec](https://github.com/asg017/sqlite-vec) - Local vector search for SQLite
- [Hybrid search with sqlite-vec](https://alexgarcia.xyz/blog/2024/sqlite-vec-hybrid-search/index.html) - FTS5 + vector combination
- [Codebases are uniquely hard to search semantically](https://www.greptile.com/blog/semantic-codebase-search) - Why chunking strategy matters
- [Self-Improving Coding Agent (arxiv)](https://arxiv.org/abs/2504.15228) - Research on adaptive code agents
- [Building Self-Improving AI Agents](https://yoheinakajima.com/better-ways-to-build-self-improving-ai-agents/) - Feedback loop architecture
- [State of AI code quality 2025](https://www.qodo.ai/reports/state-of-ai-code-quality/) - Context-aware AI expectations
- [Git Hooks Guide 2025](https://dev.to/arasosman/git-hooks-for-automated-code-quality-checks-guide-2025-372f) - Modern hook practices
- [pre-commit framework](https://pre-commit.com/) - Hook management
