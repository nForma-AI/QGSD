# Release Notes Template

Used by `complete-milestone.md` workflow at the `git_tag` step to create GitHub releases.

## Format

```markdown
## {{MILESTONE_NAME}}

{{1-2 sentence summary of what shipped and why it matters.}}

### Key features
- **{{Feature Name}}:** {{What it does, key technical detail}}
- **{{Feature Name}}:** {{What it does, key technical detail}}
- ...

### Stats
- {{N}}/{{N}} requirements satisfied
- {{N}} phases, {{N}} plans
- {{commits/files/lines summary}}
- Audit: {{PASSED/TECH_DEBT}}

### Install
\`\`\`bash
npx @nforma.ai/nforma@{{VERSION}}
\`\`\`
```

## Rules

1. Summary is 1-2 sentences — what shipped, not how
2. Key features use **bold label** followed by colon and description
3. Each feature is one bullet, one line — no nested bullets
4. Stats section is 4 lines: requirements, phases/plans, size, audit
5. Install block uses the npm package version
6. No emoji in release notes
7. No phase numbers or requirement IDs in feature descriptions — those are internal
