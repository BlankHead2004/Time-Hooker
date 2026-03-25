# Contributing to Time Hooker

Thanks for your interest in contributing! Here's how you can help.

---

## Reporting Bugs

1. Check [existing issues](../../issues) to see if the bug is already reported.
2. Open a [new bug report](../../issues/new?template=bug_report.md) with:
   - Your browser and version
   - Tampermonkey version
   - The URL where the issue occurs
   - Steps to reproduce
   - Expected vs. actual behavior

## Feature Requests

Open a [feature request](../../issues/new?template=feature_request.md) describing:
- What you'd like to see
- Why it would be useful
- Any ideas on how it could work

## Pull Requests

### Setup

1. **Fork** this repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/BlankHead2004/TimeHooker.git
   cd TimeHooker
   ```
3. Create a **feature branch**:
   ```bash
   git checkout -b feat/my-feature
   ```
4. Make your changes to `TimeHooker.user.js`
5. **Test** by pasting the modified script into Tampermonkey and verifying on multiple sites
6. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add speed multiplier display in page title"
   ```
7. **Push** and open a PR against `main`

### Code Guidelines

- Keep everything in a **single file** (`TimeHooker.user.js`) — userscripts must be self-contained
- All UI must live inside the **Shadow DOM** to avoid CSS leakage
- Use the saved original API references (`_setTimeout`, `_setInterval`, etc.) for any internal timing — never call the hooked versions from within the script
- Test on at least 3 different websites before submitting
- Preserve the `@grant none` and `@run-at document-start` directives

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation changes |
| `style:` | UI/CSS changes (not code style) |
| `refactor:` | Code restructuring |
| `perf:` | Performance improvements |

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
