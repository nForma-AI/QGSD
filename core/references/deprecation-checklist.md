# Deprecation and Migration Checklist

Use this checklist when planning or executing deprecation, migration, or sunsetting of code, APIs, or features.

## Decision framework
- [ ] Does the system still provide unique value?
- [ ] How many consumers depend on it?
- [ ] Is a replacement available and validated?
- [ ] Migration cost per consumer assessed?
- [ ] Ongoing maintenance cost exceeds migration cost?

## Before deprecating
- [ ] Replacement built and covers all critical use cases
- [ ] Replacement validated in production
- [ ] Deprecation announcement drafted with specific timeline

## Migration
- [ ] Migration guide with concrete before/after examples
- [ ] One consumer migrated at a time
- [ ] Adapters or feature flags for gradual rollover
- [ ] Migration progress tracked visibly

## Removal
- [ ] Zero active usage verified before removal
- [ ] Code deleted entirely (no commented-out blocks)
- [ ] All references removed: docs, config, imports, tests
- [ ] Deprecation notice itself removed

## Anti-patterns to avoid
- [ ] Not deprecating without providing an alternative
- [ ] Not announcing without a migration guide
- [ ] Not adding features to deprecated systems
- [ ] Not keeping zombie code with no owner

## Attribution
Adapted for nForma from the MIT-licensed deprecation-and-migration skill in addyosmani/agent-skills.
