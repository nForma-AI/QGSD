# CCR-3 Round 1 — Plan Review: 399-PLAN.md

## verdict: APPROVE_WITH_IMPROVEMENTS

---

## Overall Assessment

The plan is well-scoped, single-file, and directly addresses the objective. The task breakdown is atomic (one task, one file), the adapter methods being called (`getCallers`, `getImplementation`, `findTests`, `peek`) all exist in `bin/coderlm-adapter.cjs`, and the ensure-running preamble correctly uses `coderlm-lifecycle.cjs --start`. The success criteria and verification steps are concrete and machine-checkable.

However, there are three issues that should be addressed before execution.

---

## Issues

### Issue 1 (BLOCKING) — `node -e` one-liners will be blocked by `nf-node-eval-guard`

The plan specifies Node one-liners using `node -e "..."` in each query subcommand. The `nf-node-eval-guard` hook blocks `node -e` on zsh due to history-expansion mangling of `!` characters. The guard's own error message requires switching to a heredoc form (`node << 'NF_EVAL' ... NF_EVAL`).

The coderlm.md skill instructions will be executed by Claude agents running zsh. If the generated skill uses `node -e`, the Bash tool calls will be rejected at runtime.

**Fix:** Replace all four `node -e "..."` one-liners in the plan's action text with the heredoc-equivalent form. Example for `callers`:

```bash
node << 'NF_EVAL'
const { createAdapter } = require('./bin/coderlm-adapter.cjs');
const adapter = createAdapter({});
adapter.getCallers(process.argv[1], process.argv[2] || undefined).then(r => {
  process.stdout.write(JSON.stringify(r));
}).catch(e => process.stdout.write(JSON.stringify({error: String(e)})));
NF_EVAL
```

Note: heredoc form does not support `process.argv` injection. The symbol/file arguments must be interpolated into the heredoc body using shell variables, e.g.:

```bash
SYMBOL="<symbol>" FILE="<file>"
node << NF_EVAL
const { createAdapter } = require('./bin/coderlm-adapter.cjs');
const adapter = createAdapter({});
adapter.getCallers('${SYMBOL}', '${FILE}' || undefined).then(r => {
  process.stdout.write(JSON.stringify(r));
}).catch(e => process.stdout.write(JSON.stringify({error: String(e)})));
NF_EVAL
```

Or use `process.env` instead of `process.argv`. The exact pattern should be consistent with how other skills in this codebase pass arguments to inline Node scripts.

### Issue 2 (MINOR) — `createAdapter({})` may not be the correct call signature

The plan uses `createAdapter({})` in all four one-liners. It should be verified that `createAdapter` exported from `bin/coderlm-adapter.cjs` accepts an empty config object and defaults to `localhost:8787`. If the factory requires explicit host config, `createAdapter({})` would connect to the wrong endpoint.

This is low-risk (the adapter uses `DEFAULT_HOST = 'http://localhost:8787'` and falls back on missing config), but the plan's action text should note that `{}` is intentional and represents "use defaults".

### Issue 3 (MINOR) — Verification step 5 uses anchored regex that won't match

The verification command in `<verification>` item 5 is:

```
grep -c "^\*\*start:\|^\*\*stop:\|^\*\*status:\|^\*\*update:" commands/nf/coderlm.md
```

The existing `coderlm.md` uses `**start:**`, `**stop:**`, `**status:**`, `**update:**` (with `**` as markdown bold, not at line start with escaped `*`). The `^` anchor will fail because these lines are indented or inline. The command will return 0, giving a false negative.

**Fix:** Remove the `^` anchor or use `grep -c "\\*\\*start:\|\\*\\*stop:\|\\*\\*status:\|\\*\\*update:"`.

---

## What the Plan Gets Right

- Single atomic task, single file modified — easy to review and revert.
- Correct adapter methods referenced (`getCallers`, `getImplementation`, `findTests`, `peek`) — confirmed against `bin/coderlm-adapter.cjs`.
- Ensure-running preamble correctly placed before all query subcommands.
- Error handling with diagnostic hint is specified for all four subcommands.
- Frontmatter updates (argument-hint, description) are explicit and complete.
- No modifications to existing lifecycle subcommands is explicitly stated.
- The `<verify>` and `<verification>` blocks provide concrete post-task checks.

---

## Required Changes Before Execution

1. Replace `node -e "..."` one-liners with heredoc-safe equivalents throughout the plan's action text and generated skill content.
2. Clarify argument-passing pattern (shell variable interpolation or `process.env`) for the heredoc form.
3. Fix verification step 5 grep regex to remove the `^` anchor.
