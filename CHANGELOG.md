# Changelog

All notable changes to **Time Hooker** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.1] - 2026-04-14

### Added
- **CSS Animation & Transition speed control** — uses `document.getAnimations()` to set `playbackRate` on all running CSS animations and transitions
- **Web Animations API hook** — intercepts `Element.prototype.animate()`, scaling `duration`, `delay`, and `endDelay` by the speed multiplier and setting `playbackRate` on returned animations
- **Continuous animation poll** — polls every 500 ms to catch newly-created animations and apply the current speed, ensuring dynamically-added CSS animations are also affected
- **Auto-cleanup** — CSS speed overrides are automatically removed when speed resets to 1x
- **Debug logging** — 16 log points with `[TimeHooker]` prefix (green in console) for easy troubleshooting; controlled by `TH_DEBUG` flag

### Changed
- Speed setter (`setSpeed()`) now also triggers CSS animation sync and starts the animation poll
- Boot sequence now activates CSS/animation hooks immediately if a non-1x speed is persisted from localStorage

---

## [3.0] - 2026-04-14

### Changed
- **Hardened boot sequence** — 5-strategy approach (direct check → DOMContentLoaded → readystatechange → MutationObserver → polling fallback) ensures the UI appears on virtually any site
- MutationObserver now targets `document.documentElement || document` with `subtree: true` instead of just `childList` on documentElement
- All timing hooks wrapped in individual `try/catch` blocks — if one hook fails (e.g., site freezes prototypes), others still apply
- Shadow DOM creation now uses fallback chain: closed → open → plain div
- Saved native `MutationObserver` reference to prevent sites from overriding it
- Outside-click listener now uses capture phase for maximum reliability
- `getHTML()` uses concatenated strings instead of template literals for broader engine compatibility

### Added
- **Watchdog system** — polls every 2 s to verify the UI host element is still in the DOM; re-injects automatically if removed by SPAs or page frameworks
- **Body-replacement observer** — detects when SPAs swap `<body>` entirely and re-injects the UI within 100 ms
- **Iframe guard** — timing hooks apply in all frames, but the bubble UI only renders on `window.top` (prevents duplicate bubbles in iframed pages)
- **Media playback-rate sync** — automatically adjusts `<video>` and `<audio>` `playbackRate` when speed changes
- **Media element tracking** — intercepts `document.createElement('video'|'audio')` and uses a MutationObserver to catch dynamically-added media
- **Fallback parent resolution** — `getParent()` tries `document.body → documentElement → querySelector('html')` before giving up
- `data-th="1"` attribute on host element for easier debugging
- Explicit `opacity:1!important; visibility:visible!important; display:block!important` on host to survive page CSS resets
- 30-second safety timeout on boot observers and polling to prevent resource leaks

### Fixed
- Script failing on modern SPAs like rarestudy.site that build the DOM asynchronously
- UI disappearing on sites that dynamically replace `<body>` (e.g., React/Next.js hydration)
- Crash when `document.documentElement` doesn't exist at `@run-at document-start`
- Duplicate bubble appearing in pages with iframes
- `attachShadow()` failure crashing the entire script instead of falling back gracefully

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
