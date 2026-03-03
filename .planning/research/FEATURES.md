# Feature Research: Requirements Envelope System

**Domain:** Formal requirements aggregation, validation, and immutability enforcement
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

Requirements envelope systems are part of formal verification infrastructure in compliance-heavy and safety-critical domains. This research identifies what features make a requirements-as-formal-artifact system complete, which differentiate it, and which are anti-patterns to avoid.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Requirement Aggregation** | All requirements must be in one place, not scattered across phase plans | MEDIUM | Must consolidate from multiple sources (phase REQUIREMENTS.md, task envelopes) into a single canonical document |
| **Machine-Readable Format** | Formal systems (TLA+, Alloy, PRISM) must read requirements programmatically, not manually | LOW | JSON or YAML with REQ-ID, text, category, phase mapping, and provenance fields |
| **Traceability** | Every requirement must map to phases and implementation artifacts | MEDIUM | Maintenance burden high; requires tooling to keep in sync with roadmap changes |
| **Immutability Enforcement** | Once frozen, requirements cannot be changed without explicit approval | HIGH | Must prevent accidental modifications through hooks or pre-commit guards; amendment workflow required |
| **Duplication Detection** | Semantic duplicates hidden in natural language must surface before freezing | HIGH | NLP/LLM required; false positives common (requires human review); critical for correctness envelope |
| **Conflict Detection** | Contradictory requirements must be identified before formal specs are written | HIGH | Semantic analysis harder than duplication; requires understanding of domain constraints |
| **Formal Constraint Validation** | Requirements must be verifiable as LTL/temporal logic properties | MEDIUM | Integration point with TLA+ spec generation; requirements that cannot be formalized must be flagged |
| **Drift Detection** | Working copy divergence from frozen envelope must be caught and reported | MEDIUM | Continuous monitoring; drift signals either spec bugs or requirement changes that need amendment |
| **Version History** | Who changed what, when, and why; supporting audits and revert capability | LOW | Simple metadata in amendment records; critical for compliance contexts |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable for formal verification integration.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automated Spec Generation** | Requirements automatically become TLA+ PROPERTY checks | HIGH | Requirement text → temporal logic translation; requires domain-specific mapping rules; differentiates from static documents |
| **Amendment Workflow** | Changes to frozen envelope follow structured approval process with re-validation | HIGH | User initiates amendment, Haiku validates new requirements, quorum approves, envelope re-locked; enables controlled evolution |
| **Coverage Gap Analysis** | Identifies phases or features with no requirements (specification blindness)** | MEDIUM | Cross-reference requirements against phase features; highlights missing specs before phase execution |
| **Requirement Dependency Graph** | Visual/navigable map of requirement dependencies and conflicts | MEDIUM | Supports planning decisions; "implement requirement X" → "must first implement requirements A, B, C" |
| **Integration with Quorum Context** | Requirements feed into formal verification evidence for quorum slot workers | MEDIUM | Quorum slots receive `requirement_context` field with relevant REQ-IDs and summaries; shapes multi-model review |
| **Risk-Stratified Requirements** | Requirements tagged by risk level (critical, standard, exploratory) affecting verification intensity | MEDIUM | Higher-risk requirements get additional formal verification; filters PRISM modeling to focus on critical paths |
| **Ambiguity Explanation** | When duplication/conflict is detected, LLM explains why two requirements are semantically equivalent or contradictory | MEDIUM | Haiku validation output includes explanations; supports user decision-making during amendment |
| **Requirement-to-Test Traceability** | Requirements automatically link to test coverage in CI/CD artifacts | MEDIUM | Extension point; enables "which tests verify requirement X?" queries; currently not in scope but valuable |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. QGSD should explicitly avoid these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-Time Collaborative Editing** | Multiple people want to edit requirements at once | Conflicting edits, concurrent amendment attempts, eventual consistency nightmare; formal systems need single version of truth | Use amendment workflow with sequential approval; async collaboration is correct for immutable artifacts |
| **Hierarchical Requirement Grouping** | Organize requirements by business unit, feature, risk tier | Creates rigid structure; refactoring the hierarchy breaks traceability; parentage ambiguity (requirement in multiple groups?) | Flat list with tagging system; metadata (category, risk, phase) handled as independent attributes, not structural hierarchy |
| **Auto-Merge from Multiple Branches** | During roadmap changes, merge requirements from feature branches | Merge conflicts in formal requirements destroy correctness envelope; cannot automatically resolve without validation | Linear amendment workflow; all changes go through one quorum gate; no branching |
| **Continuous Requirement Inference** | System auto-generates requirements from code changes or TLA+ specs | Inflates requirement set; generated requirements contaminate the frozen envelope (is this user intent or artifact?); audit trail degrades | Explicit amendment workflow only; inference is input to amendment proposal, not auto-accepted |
| **Natural Language Ambiguity Tolerance** | "Good enough" validation that lets minor ambiguities through | Formal specs cannot tolerate ambiguity; postpones conflicts until verification time (expensive to fix); increases spec rewrite risk | Strict validation: ambiguities block freezing until resolved or explicitly marked as "human interpretation required" |
| **Optional Formal Spec Generation** | Some requirements are "documentation only," don't need specs | Creates two-tier requirements; some specifications don't cover all requirements; easier to miss gaps | All requirements must be formalizeable or explicitly deferred to future version; no silent documentation-only slots |
| **Dynamic Requirement Modification via Debug Sessions** | When formal verification surfaces failures, auto-propose requirement changes | Undermines immutability; debug sessions should propose new invariants (fine), not modify existing requirements (problematic) | Separate "invariant candidates" from requirements; candidates are input to amendment workflow, not automatic updates |

## Feature Dependencies

```
[Requirements Aggregation]
    └──requires──> [Machine-Readable Format]
                       └──requires──> [Traceability]

[Immutability Enforcement]
    └──requires──> [Amendment Workflow]
                       └──requires──> [Duplication Detection]
                                        └──requires──> [Formal Constraint Validation]

[Duplication Detection]
    └──enhances──> [Conflict Detection]

[Drift Detection]
    └──requires──> [Immutability Enforcement]

[Automated Spec Generation]
    └──requires──> [Formal Constraint Validation]
    └──requires──> [Requirements Aggregation]

[Amendment Workflow]
    └──requires──> [Duplication Detection]
    └──requires──> [Conflict Detection]
    └──requires──> [Version History]

[Risk-Stratified Requirements]
    └──enhances──> [Automated Spec Generation]
    └──enhances──> [Integration with Quorum Context]

[Coverage Gap Analysis]
    └──requires──> [Traceability]
    └──enhances──> [Amendment Workflow]
```

### Dependency Notes

- **Requirements Aggregation requires Machine-Readable Format:** Formal systems need structured input; natural language documents alone are not sufficient
- **Immutability Enforcement requires Amendment Workflow:** Making requirements immutable without a way to change them is pointless; amendment is the escape hatch
- **Duplication/Conflict Detection requires Formal Constraint Validation:** Cannot detect contradictions without understanding what properties are being claimed
- **Automated Spec Generation requires Formal Constraint Validation:** Requirement text must first be verifiable as logical properties before they can be translated to TLA+
- **Amendment Workflow requires Duplication & Conflict Detection:** Cannot approve an amendment without validating it against existing requirements first
- **Drift Detection requires Immutability Enforcement:** Only makes sense if there is a frozen state to drift from

## MVP Definition

### Launch With (v0.22)

Minimum viable product for requirements envelope integration into QGSD v0.22.

- [x] **Requirements Aggregation** — Consolidate all phase requirements into `.formal/requirements.json` during `new-milestone`; REQ-ID, text, category, phase, provenance fields
- [x] **Machine-Readable Format** — JSON structure with schema (type checking for fields)
- [x] **Duplication Detection** — Haiku validation pass detects semantic duplicates; user resolves before freezing
- [x] **Conflict Detection** — Haiku validation identifies contradictions (requirement A says X, requirement B says not X)
- [x] **Immutability Enforcement** — Hook or pre-commit guard prevents `.formal/requirements.json` modifications outside amendment workflow
- [x] **Formal Constraint Validation** — `generate-phase-spec.cjs` reads requirements and ensures generated TLA+ PROPERTY checks respect the envelope
- [x] **Amendment Workflow** — User initiates amendment, Haiku re-validates, quorum approves, envelope re-locked

### Add After Validation (v0.23)

Features to add once core is working and real requirements experience is captured.

- [ ] **Drift Detection** — Monitor `.planning/REQUIREMENTS.md` changes post-freeze; alert on divergence; route to amendment workflow
- [ ] **Version History** — Amendment records with user, timestamp, old/new text, approval quorum; revert capability
- [ ] **Automated Spec Generation** — Requirements text → TLA+ PROPERTY translation; currently manual in `generate-phase-spec.cjs`
- [ ] **Coverage Gap Analysis** — Identify phases with no mapped requirements
- [ ] **Requirement Dependency Graph** — Visualize requirement relationships and order-of-implementation constraints

### Future Consideration (v0.24+)

Features to defer until broader ecosystem matures.

- [ ] **Requirement-to-Test Traceability** — Link requirements to CI/CD test coverage; "which tests verify REQ-X?"
- [ ] **Risk-Stratified Requirements** — Tag requirements by risk; vary formal verification intensity by risk level
- [ ] **Ambiguity Explanation** — When duplication detected, explain why two requirements are equivalent or contradictory
- [ ] **Requirement Dependency Graph Visualization** — Mermaid/d3 rendering of requirement dependency graph
- [ ] **Bulk Amendment Operations** — Approve multiple amendments in one quorum vote (currently one per vote)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| Requirements Aggregation | HIGH | MEDIUM | P1 | Foundation; everything depends on this |
| Machine-Readable Format | HIGH | LOW | P1 | JSON schema; prerequisite for formal tools |
| Duplication Detection | HIGH | HIGH | P1 | Catches expensive mistakes; Haiku validation |
| Conflict Detection | HIGH | HIGH | P1 | Same as duplication; part of Haiku pass |
| Immutability Enforcement | HIGH | MEDIUM | P1 | Prevents silent divergence; hook-based |
| Formal Constraint Validation | HIGH | MEDIUM | P1 | Integration point with TLA+ generation |
| Amendment Workflow | HIGH | HIGH | P1 | Makes immutability workable; gates changes |
| Drift Detection | MEDIUM | MEDIUM | P2 | Detects creeping changes post-freeze |
| Version History | MEDIUM | LOW | P2 | Compliance requirement; audit trail |
| Coverage Gap Analysis | MEDIUM | MEDIUM | P2 | Catches missing specs early |
| Automated Spec Generation | HIGH | HIGH | P2 | Differentiator; reduces TLA+ manual work |
| Requirement Dependency Graph | MEDIUM | MEDIUM | P3 | Aids planning; not critical to correctness |
| Risk-Stratified Requirements | MEDIUM | MEDIUM | P3 | Optimization; filters verification effort |
| Ambiguity Explanation | LOW | MEDIUM | P3 | Nice-to-have; helps user understanding |

**Priority key:**
- P1: Must have for launch (v0.22 ENV requirements)
- P2: Should have in near term (v0.23); improves reliability
- P3: Nice to have; future consideration

## Competitor Feature Analysis

| Feature | Formal Methods Papers/Conferences | Requirements Management Tools (DOORS, Polarion) | QGSD Approach |
|---------|-------------------------------------|---------------------------------------------|---------|
| Requirement Aggregation | Manual; specs written from scratch | Built-in (database-backed) | Automated from phase plans into JSON |
| Immutability | Specs are versioned artifacts; formal specs are typically read-only in practice | Version control + access controls | Hook-based enforcement; amendment workflow |
| Duplication Detection | Manual review (part of peer review process) | Search/semantic diff; sometimes basic | Haiku LLM validation; structured output |
| Conflict Detection | Model checking finds contradictions implicitly | Manual review; some tools flag overlapping scopes | Explicit Haiku validation pass; user resolution |
| Traceability | REQ-ID to spec mapping; manual in papers | Matrix format; automated tracking | Auto-generated from phase → requirement mapping |
| Formal Constraint Validation | Assumed; specs are already formal | Not applicable (natural language) | Auto-generation from requirements to TLA+ PROPERTY |
| Amendment Workflow | Versioning + commit; manual process | Changesets; baseline updates | Structured workflow: propose → validate → approve → lock |
| Drift Detection | Not typically addressed (specs are static) | Change tracking; configuration management | Git-based monitoring; alerts on post-freeze divergence |

**Observations:**
- Formal methods assume requirements are already formal (mathematicians write specs)
- Commercial requirements tools assume natural language with manual validation
- QGSD is unique in making requirements formal artifacts with automated validation + structural enforcement

## Domain Patterns & Ecosystem

### Requirements Engineering (RE) Evolution

**Natural Language → Formal Transition (Current State of Art):**
- 2025-2026: NLP/LLM for ambiguity detection and duplication finding is active research frontier
- Semantic similarity using transformer models (SR-BERT, SpanBERT) can achieve ~80% accuracy on duplicate detection with human review
- Conflict detection is harder; models can identify "redundancy" and "inconsistency" but human review still required
- Time saving: NLP-assisted validation reduces analysis time by 66.7% vs manual review (recent empirical study)

**Formal Specification Patterns (TLA+/LTL):**
- Property specification patterns (Dwyer et al.) catalog common behaviors: response, precedence, safety, liveness
- TLA+ specifications use temporal logic to define both safety (bad things won't happen) and liveness (good things eventually happen)
- Model checking (TLC) is fully automated once specs are written; the bottleneck is writing correct specs from requirements

**Traceability Standards (ISO 26262, IEC 61508, DO-178C):**
- Formal methods in safety-critical domains (automotive, avionics, industrial control) require documented traceability
- Requirements must link to design, implementation, and verification; ISO 26262 mandates this as part of FMEA/ASIL classification
- 2026 shift: Audit trails and amendment workflows are moving from optional to table-stakes in compliance contexts

### QGSD Integration Points

**Existing Infrastructure:**
- `.formal/model-registry.json` already tracks model provenance (who last updated, when, source)
- `generate-phase-spec.cjs` translates plan truths to TLA+ properties; requirements envelope becomes the input source
- Quorum context injection already exists in slot-worker prompts; requirements can be added as formal evidence
- Haiku integration precedent exists (circuit breaker oscillation detection uses Haiku classification)

**Validation Pipeline (v0.22):**
1. `new-milestone` → collect all phase requirements
2. `.formal/requirements.json` ← aggregate + assign REQ-IDs
3. Call Haiku validator → detect duplicates/conflicts
4. User resolves ambiguities
5. Freeze envelope → immutable state
6. `generate-phase-spec.cjs` reads envelope as source of truth for PROPERTY generation
7. During phase execution, drift detector monitors for changes
8. If changes needed, amendment workflow re-validates + re-freezes

**Hooks Required:**
- Pre-commit guard on `.formal/requirements.json` (prevent direct edits)
- Or PostToolUse on requirements.json writes (propose amendment, block direct writes)

## Sources

**Formal Methods & Requirements Verification:**
- [FormaliSE 2026 Research Track - 14th FME conference series](https://2026.formalise.org/)
- [Formal Specification and Validation of Security Policies](https://inria.hal.science/inria-00507300/file/FormalSpecificationandValidationofSecurityPolicies.pdf)
- [TLA+ Specification Language and Model Checking](https://lamport.azurewebsites.net/pubs/spec-book-chap.pdf)
- [Specification Pattern System (Dwyer et al.) - Property patterns for verification](https://people.cs.ksu.edu/~dwyer/spec-patterns.ORIGINAL)
- [Beyond Vibe Coding: Using TLA+ with Claude - Executable specifications](https://shahbhat.medium.com/beyond-vibe-coding-using-tla-and-executable-specifications-with-claude-51df2a9460ff)

**Requirements Traceability & Management:**
- [Requirements Traceability Matrix (RTM): A Comprehensive Guide - Simplilearn](https://www.simplilearn.com/project-management-and-the-requirements-traceability-matrix-article)
- [ISO 26262 Requirements Traceability - Parasoft](https://www.parasoft.com/learning-center/iso-26262/requirements-traceability/)
- [The 7 Leading Requirements Management Software Solutions in 2026](https://hackernoon.com/the-7-leading-requirements-management-software-solutions-in-2026)

**Semantic Duplication & Conflict Detection (NLP/LLM):**
- [Supervised Semantic Similarity-based Conflict Detection Algorithm (S3CDA)](https://arxiv.org/html/2206.13690v2)
- [Requirements Ambiguity Detection and Explanation with LLMs: An Industrial Study](https://www.ipr.mdu.se/pdf_publications/7221.pdf)
- [A Semiautomated Approach for Detecting Ambiguities in Software Requirements Using SpanBERT and NER](https://onlinelibrary.wiley.com/doi/10.1002/smr.70041)
- [Transfer Learning for Conflict and Duplicate Detection in Software Requirement Pairs](https://arxiv.org/html/2301.03709v2)
- [Using NLP Tools to Detect Ambiguities in System Requirements](https://ceur-ws.org/Vol-3122/NLP4RE-paper-3.pdf)

**Formal Artifact Immutability & Versioning:**
- [Enforce CRD Immutability with CEL Transition Rules - Kubernetes](https://kubernetes.io/blog/2022/09/29/enforce-immutability-using-cel/)
- [Requirements Engineering 2026 - Artifacts Track](https://conf.researchr.org/track/RE-2026/RE-2026-artifacts)

**Compliance & Change Control (FDA/CCPA):**
- [FDA 21 CFR Part 11 Audit Trails: Definition, Requirements, and Compliance](https://simplerqms.com/21-cfr-part-11-audit-trail/)
- [CCPA 2026 Regulations: Cybersecurity Audits and Risk Assessments](https://secureprivacy.ai/blog/ccpa-requirements-2026-complete-compliance-guide)
- [AS 1215: Audit Documentation Standard - PCAOB (effective 2026)](https://pcaobus.org/oversight/standards/auditing-standards/details/as-1215--audit-documentation-(effective-on-12-15-2026))

**Requirements Specification Anti-Patterns:**
- [Software Requirements Specification (SRS): Free Template & Guide (2026)](https://redeagle.tech/blog/software-requirements-specification)
- [Overcoming Anti-Patterns in Requirement Elicitation](https://www.linkedin.com/pulse/overcoming-anti-patterns-requirement-elicitation-tim-williams-phd)

---

*Feature research for: Requirements Envelope / Requirements-as-Formal-Artifacts*
*Researched: 2026-03-01*
*Confidence: MEDIUM-HIGH (Haiku validation approach verified via recent LLM/NLP research; amendment workflow patterns from formal methods literature; drift detection and immutability patterns standard in compliance/artifact management)*
