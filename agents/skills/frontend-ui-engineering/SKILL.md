---
name: nf:frontend-ui-engineering
description: Guides production-quality frontend development — component architecture, accessibility, responsive design, state management, and design system adherence.
---

# frontend-ui-engineering skill

Purpose
-------
Build production-quality user interfaces that are accessible, performant, responsive, and visually polished. This skill covers the full frontend engineering discipline, not just making things look good.

When to use
-----------
- Building new UI components or pages
- Modifying existing interfaces
- Implementing responsive layouts
- Adding interactivity or state management
- Fixing visual, accessibility, or responsiveness issues

Core principles
---------------
1) **Component architecture** — small, focused components with single responsibility. Prefer composition over configuration. Separate data fetching from presentation.

2) **Accessibility first (WCAG 2.1 AA)** — keyboard navigation, ARIA labels, focus management, meaningful empty and error states. Accessibility is not optional.

3) **Responsive design** — mobile-first approach. Test at 320px, 768px, 1024px, and 1440px breakpoints.

4) **State management** — use the simplest approach that works. Local state → shared context → external store. Avoid prop drilling beyond 3 levels.

5) **Design system adherence** — use existing design tokens (colors, spacing, typography). Avoid one-off values that drift from the system.

High-level steps
----------------
1) Understand the requirement
  - What does the user see? What can they do?
  - What are the states: loading, empty, error, success?
  - What are the responsive breakpoints?

2) Build the component structure
  - Start with the markup and semantics
  - Add styles using the design system
  - Wire up state and interactivity
  - Handle all states (not just the happy path)

3) Make it accessible
  - Keyboard-navigate through every interaction
  - Add ARIA labels where semantics alone are insufficient
  - Test with a screen reader or accessibility audit tool

4) Make it responsive
  - Start from the smallest breakpoint
  - Verify layout at each breakpoint
  - Ensure touch targets are large enough on mobile

5) Verify
  - Zero console errors and warnings
  - Full keyboard accessibility
  - Screen reader compatibility
  - Responsive across all breakpoints
  - All states handled (loading, error, empty, success)

Common pitfalls
---------------
- Over-saturated gradients and neon accents (the "AI aesthetic")
- Missing loading and error states
- Click-only interactions with no keyboard equivalent
- Hardcoded pixel values instead of design tokens
- Testing only at desktop width

Integration with nForma
------------------------
- After building UI, use `nf:code-review-and-quality` for review
- For browser testing, pair with `nf:browser-testing-with-devtools`
- Reference `references/accessibility-checklist.md` for project conventions
- For performance of frontend code, use `nf:performance-optimization`

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `frontend-ui-engineering` skill in `addyosmani/agent-skills`.
