# Changelog

All notable changes to **Time Hooker** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0] - 2026-03-23

### Changed
- **Complete rewrite** for reliability across all websites
- Switched to `@grant none` — script now runs in the page's native JS context instead of Tampermonkey's sandbox
- Replaced CSS-reset approach (`all: initial`) with **closed Shadow DOM** for bulletproof CSS isolation
- UI now attaches to `document.body` with `MutationObserver` fallback (instead of `document.documentElement`)
- Simplified and optimized all timing hooks

### Added
- Closed Shadow DOM — page CSS can never interfere with the UI, and vice versa
- `MutationObserver`-based boot sequence ensures UI appears even on dynamically-built pages
- `Alt+Up`/`Alt+Down` keyboard shortcuts to step through speed presets
- Continuous fine-tune slider (0.05x - 25x)
- Custom speed input field (0.01x - 100x)
- Hook Active toggle to disable/enable time manipulation without uninstalling
- Speed badge color coding: green (>1x), amber (<1x), grey (1x)

### Fixed
- Green bubble not appearing on any page (sandbox isolation issue)
- Keyboard shortcuts not firing (event listeners were on sandbox document)
- CSS conflicts with host page styles

---

## [1.0] - 2026-03-23

### Added
- Initial release
- Hooks: `setTimeout`, `setInterval`, `Date`, `Date.now()`, `performance.now()`, `requestAnimationFrame`
- Floating green bubble UI with speed presets
- Keyboard shortcuts: `Alt+T` (toggle panel), `Alt+R` (reset to 1x)
- Speed persistence via `localStorage`
- Universal `@match *://*/*`
