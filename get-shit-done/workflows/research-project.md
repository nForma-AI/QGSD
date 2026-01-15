<purpose>
Comprehensive domain research before roadmap creation.

Answers the questions that inform quality roadmaps:
- What's the standard stack for this type of product?
- What features do users expect?
- How are these systems typically structured?
- What do projects in this domain commonly get wrong?

This research shapes the roadmap. Without it, phases are guesses based on intuition.
With it, phases reflect how experts actually build these systems.
</purpose>

<when_to_use>
**Use for:**
- Greenfield projects in established domains
- When "what features should exist" is partially unknown
- Complex integrations requiring ecosystem knowledge
- Any project where you'd research before starting

**Skip for:**
- Well-defined specs with clear scope
- Simple utilities
- Brownfield features (use research-phase instead)
</when_to_use>

<required_reading>
**Read these files NOW:**

1. ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
2. ~/.claude/get-shit-done/templates/research-project/STACK.md
3. ~/.claude/get-shit-done/templates/research-project/FEATURES.md
4. ~/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md
5. ~/.claude/get-shit-done/templates/research-project/PITFALLS.md
6. .planning/PROJECT.md
</required_reading>

<process>

<step name="analyze_project">
Read PROJECT.md and extract:

1. **Domain**: What type of product is this?
   - Community platform, e-commerce, SaaS tool, developer tool, mobile app, game, etc.

2. **Stated stack**: Did user specify technologies?
   - If yes: research how to use that stack for this domain
   - If no: research what stack is standard for this domain

3. **Core value**: What's the one thing that must work?

4. **Requirements**: What did user explicitly request?

5. **Constraints**: Any limitations on choices?

Present analysis:
```
Domain analysis:

- Type: [inferred domain]
- Stack: [stated or "to be determined"]
- Core: [core value from PROJECT.md]
- Key requirements: [list]

Does this look right? (yes / adjust)
```
</step>

<step name="determine_research_questions">
Based on domain, generate 4 research questions:

| Dimension | Question Template |
|-----------|-------------------|
| Stack | "What's the standard 2025 stack for building [domain]?" |
| Features | "What features do [domain] products have? What's table stakes vs. differentiating?" |
| Architecture | "How are [domain] systems typically structured? What are the major components?" |
| Pitfalls | "What do [domain] projects commonly get wrong? What are the critical mistakes?" |

**Customize questions based on project specifics:**

- If stack is stated: "How do you build [domain] with [stack]? What supporting libraries?"
- If specific features mentioned: "How do experts implement [feature] in [domain]?"
- If constraints exist: "What's the best approach for [domain] given [constraint]?"

Present questions for approval:
```
Research questions:

1. Stack: [question]
2. Features: [question]
3. Architecture: [question]
4. Pitfalls: [question]

Proceed with these questions? (yes / adjust)
```
</step>

<step name="spawn_research_agents">
Spawn 4 parallel Task agents using subagent_type: "general-purpose".

**Agent prompt template:**

```
Research question: [question]

Domain: [domain from analyze_project]
Project context: [summary from PROJECT.md]

Instructions:
1. Use Context7 to find relevant library documentation
2. Use WebSearch to find current best practices (2024-2025)
3. Cross-verify all WebSearch findings with authoritative sources
4. Focus on actionable recommendations, not theoretical overview

Output format:
- Direct answer to the question
- Specific recommendations with rationale
- Code examples where relevant
- Sources with confidence levels (HIGH/MEDIUM/LOW)

Constraints:
- Prefer official docs and Context7 over blog posts
- Mark anything unverified as LOW confidence
- Be specific: versions, library names, patterns
```

**Spawn all 4 agents in parallel:**

```
Spawning research agents:

1. Stack research → [running]
2. Features research → [running]
3. Architecture research → [running]
4. Pitfalls research → [running]

This may take 2-3 minutes...
```

Wait for all agents to complete.
</step>

<step name="aggregate_results">
Create `.planning/research/` directory:

```bash
mkdir -p .planning/research
```

**For each research dimension, create document using templates:**

1. **STACK.md** — From stack agent results
   - Use template from templates/research-project/STACK.md
   - Populate with agent findings
   - Include version numbers and rationale

2. **FEATURES.md** — From features agent results
   - Use template from templates/research-project/FEATURES.md
   - Categorize as table stakes / differentiators / anti-features
   - Note complexity and dependencies

3. **ARCHITECTURE.md** — From architecture agent results
   - Use template from templates/research-project/ARCHITECTURE.md
   - Include system diagrams (ASCII)
   - Document component responsibilities

4. **PITFALLS.md** — From pitfalls agent results
   - Use template from templates/research-project/PITFALLS.md
   - Include warning signs and prevention
   - Note which phase should address each pitfall

5. **SUMMARY.md** — Synthesize all results
   - Use template from templates/research-project/SUMMARY.md
   - Executive summary of all findings
   - **Critical: Include "Implications for Roadmap" section**
   - Suggest phase structure based on research
</step>

<step name="roadmap_implications">
In SUMMARY.md, include explicit roadmap guidance:

```markdown
## Implications for Roadmap

Based on research, suggested phase structure:

1. **[Phase name]** — [rationale from research]
   - Addresses: [features from FEATURES.md]
   - Avoids: [pitfall from PITFALLS.md]

2. **[Phase name]** — [rationale from research]
   - Implements: [architecture component from ARCHITECTURE.md]
   - Uses: [stack element from STACK.md]

3. **[Phase name]** — [rationale from research]
   ...

**Phase ordering rationale:**
- [Why this order based on dependencies discovered]
- [Why this grouping based on architecture patterns]

**Research flags for phases:**
- Phase [X]: Likely needs deeper research (reason)
- Phase [Y]: Standard patterns, unlikely to need research
```

This section directly feeds into create-roadmap.
</step>

<step name="confidence_assessment">
Add confidence section to SUMMARY.md:

```markdown
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | [HIGH/MEDIUM/LOW] | [reason - e.g., "verified with Context7"] |
| Features | [HIGH/MEDIUM/LOW] | [reason - e.g., "based on competitor analysis"] |
| Architecture | [HIGH/MEDIUM/LOW] | [reason - e.g., "standard patterns, well-documented"] |
| Pitfalls | [HIGH/MEDIUM/LOW] | [reason - e.g., "from post-mortems and community"] |

**Overall confidence:** [HIGH/MEDIUM/LOW]

**Gaps to address during planning:**
- [Any areas where research was inconclusive]
- [Topics that need phase-specific research later]
```
</step>

<step name="git_commit">
Commit research:

```bash
git add .planning/research/
git commit -m "$(cat <<'EOF'
docs: research [domain] ecosystem

Researched stack, features, architecture, and pitfalls for [project name].

Key findings:
- Stack: [one-liner]
- Architecture: [one-liner]
- Critical pitfall: [one-liner]

Ready for roadmap creation.
EOF
)"
```
</step>

<step name="present_results">
```
Research complete:

## Files Created

- .planning/research/SUMMARY.md — Executive summary + roadmap implications
- .planning/research/STACK.md — Recommended technologies
- .planning/research/FEATURES.md — Feature landscape
- .planning/research/ARCHITECTURE.md — System structure patterns
- .planning/research/PITFALLS.md — Common mistakes to avoid

## Key Findings

**Stack:** [one-liner from STACK.md]
**Architecture:** [one-liner from ARCHITECTURE.md]
**Critical pitfall:** [most important from PITFALLS.md]

## Suggested Phases

[List from SUMMARY.md Implications for Roadmap section]

---

## ▶ Next Up

**Create roadmap** — using research findings

`/gsd:create-roadmap`

<sub>`/clear` first → fresh context window</sub>

---
```
</step>

</process>

<research_quality>
**Good research answers:**
- What specific libraries/versions to use (not just "use React")
- What features users expect (not just "add features")
- How components connect (not just "it has a backend")
- What specific mistakes to avoid (not just "be careful")

**Research is ready when:**
- Each document has specific, actionable content
- Sources are cited with confidence levels
- Roadmap implications are explicit
- A developer could start planning immediately
</research_quality>

<success_criteria>
- [ ] PROJECT.md analyzed, domain identified
- [ ] Research questions customized and approved
- [ ] 4 parallel agents spawned and completed
- [ ] STACK.md created with specific recommendations
- [ ] FEATURES.md created with prioritized features
- [ ] ARCHITECTURE.md created with system structure
- [ ] PITFALLS.md created with prevention strategies
- [ ] SUMMARY.md created with roadmap implications
- [ ] Confidence assessment included
- [ ] Research committed to git
</success_criteria>
