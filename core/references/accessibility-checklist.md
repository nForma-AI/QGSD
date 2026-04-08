# Accessibility Checklist

Use this checklist when reviewing changes that affect CLI output, terminal rendering, documentation, or any user-facing interface.

## Terminal output

- [ ] Status messages use text labels alongside symbols (not color alone to convey meaning)
- [ ] Colors degrade gracefully when `NO_COLOR` or `FORCE_COLOR=0` is set
- [ ] Progress indicators include text state, not just spinners
- [ ] Error messages are descriptive and actionable — include what failed and what to try

## Documentation

- [ ] README and docs use clear heading hierarchy (h1 → h2 → h3, no skipped levels)
- [ ] Code examples include context about what they do (not just bare commands)
- [ ] Acronyms are expanded on first use (ADR, MCP, CI/CD)
- [ ] Links use descriptive text, not "click here" or bare URLs

## CLI interface

- [ ] Commands provide `--help` output or usage hints when called incorrectly
- [ ] Non-interactive mode works when `stdin` is not a TTY
- [ ] Exit codes are meaningful (0 = success, non-zero = failure with specific codes if applicable)
- [ ] Long-running operations provide progress feedback

## Keyboard and navigation

- [ ] Interactive prompts support keyboard navigation (arrow keys, enter)
- [ ] Default selections are clearly indicated
- [ ] Escape or Ctrl+C cleanly exits interactive flows without leaving state behind

## Web accessibility (WCAG 2.1 AA)

When building web interfaces (not just CLI):

- [ ] Full keyboard navigation for every interactive element
- [ ] ARIA labels where semantic HTML alone is insufficient
- [ ] Focus management on route changes and modal open/close
- [ ] Meaningful empty states and error states (not just blank screens)
- [ ] Touch targets at least 44x44px on mobile

## Responsive design

When building web interfaces, test at these breakpoints:

- [ ] 320px (small mobile)
- [ ] 768px (tablet)
- [ ] 1024px (small desktop)
- [ ] 1440px (standard desktop)

Mobile-first approach: start from the smallest breakpoint and add complexity upward.

## Internationalization readiness

- [ ] User-facing strings are not embedded in logic (extractable for future i18n)
- [ ] Date formatting uses ISO 8601 or locale-aware formatting
- [ ] No assumptions about LTR text direction in output formatting

## Attribution

Adapted for nForma from the MIT-licensed accessibility-checklist reference in [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
