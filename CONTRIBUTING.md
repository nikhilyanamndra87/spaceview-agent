# Contributing to ARIA

Thank you for your interest in contributing! This guide will help you get started.

---

## Ground Rules

1. **Zero external dependencies** — the core artifact must remain self-contained (no npm packages in `Agent.jsx`)
2. **Document everything** — JSDoc on all functions, inline comments on non-obvious logic
3. **Test before PR** — run through the [manual test matrix](./docs/ARCHITECTURE.md#manual-test-matrix)
4. **Small PRs** — one feature or fix per pull request

---

## Development Setup

```bash
git clone https://github.com/nikhilyanamndra87/aria-agent.git
cd aria-agent

# Run in Claude.ai — paste Agent.jsx as an artifact
# OR run standalone:
npm create vite@latest . -- --template react
npm install
npm run dev
```

---

## Branch Strategy

```
main          ← stable, always works
dev           ← integration branch
feature/*     ← new features
fix/*         ← bug fixes
docs/*        ← documentation only
```

---

## Commit Convention

```
feat: add streaming response support
fix: prevent infinite loop on unknown stop_reason
docs: update agentic loop diagram in ARCHITECTURE.md
style: adjust bubble border radius for tighter feel
refactor: extract useAgent hook from monolithic component
```

---

## Pull Request Checklist

- [ ] Code is commented with JSDoc and inline explanations
- [ ] README updated if any public-facing behaviour changed
- [ ] Manual test matrix passed
- [ ] No external npm dependencies added to `Agent.jsx`
- [ ] Design doc updated if visual changes were made

---

## Reporting Issues

Include:
- Browser and OS
- Prompt that caused the issue
- Screenshot or console error
- Expected vs actual behaviour
