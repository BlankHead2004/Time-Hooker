# Changelog

All notable changes to **Time Hooker** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.0] - 2026-04-14

### Added
- **Double-injection guard** — `Object.defineProperty(window, '__timeHookerActive', { writable: false })` prevents any duplicate execution across iframes or SPA re-mounts
- **FakeDate as class extension** — `class FakeDate extends Date` with `Symbol.hasInstance` so `instanceof Date` checks pass correctly; `Date.length` set to 7 to match native
- **Performance.prototype.now hook** — hooks at the prototype level instead of the instance, so all Performance instances (including inside iframes) are automatically covered
- **Virtual timeout ID mapping** — `setTimeout` returns virtual IDs mapped to real IDs via `_timeoutMap`, ensuring `clearTimeout` always cancels the correct timer
- **Interval map size cap** — `MAX_TRACKED_INTERVALS = 500` prevents unbounded memory growth from leaked intervals
- **Multi-pass rAF** — `requestAnimationFrame` fires multiple callback batches per real frame when speed > 1x; throttles via setTimeout when speed < 1x for accurate slow-motion
- **Web Worker hooking** — intercepts `Worker` constructor, prepends timing hooks via Blob URL + `importScripts`, and broadcasts speed changes to workers via `postMessage`
- **Same-origin iframe injection** — propagates all timing hooks (`Date`, `performance.now`, `setTimeout`, `setInterval`, `rAF`) into same-origin iframes at load time
- **Iframe creation interception** — `document.createElement('iframe')` is intercepted to auto-inject hooks on load
- **Hook re-injection guard** — polls every 2s to detect if SPA frameworks overwrote our `window.setTimeout`/`Date`/etc. and restores them
- **Toggle remembers speed** — disabling the hook saves the current speed; re-enabling restores it (instead of always resetting to 1x)
- **Custom input validation feedback** — invalid custom speed shows red border flash for 800ms
- **Input event isolation** — `keyup` and `keypress` also stopPropagation to prevent page scripts from eating typed characters
- **composedPath() click detection** — outside-click panel close uses `e.composedPath()` for proper Shadow DOM awareness
- **50x preset** — preset grid now includes 50x (12 presets total in 4-column layout)
- **Section labels** — panel has "Presets", "Fine-tune", "Custom Speed" section headers
- **Hook status indicator** — shows "Active" (green) or "Paused" (red) next to the toggle
- **Polished dark UI** — dark slate bubble (rgba(15,23,42,.82)), 28px speed label, 4-column grid, improved typography and spacing

### Changed
- `Date` is now set via `Object.defineProperty(window, 'Date', { get: () => FakeDate })` with fallback to direct assignment — more resilient against page scripts that check descriptors
- Slider max raised from 25 to 50
- Keyboard shortcuts moved to capture phase for better interception reliability
- Speed clamping uses `Math.max(0.01, Math.min(100, s))` in `setSpeed()` for safety
- Interval restart on speed change now mutates the existing entry's `rId` instead of delete-and-re-add

---

## [3.1] - 2026-04-14

### Added
- **CSS Animation & Transition speed control** — uses `document.getAnimations()` to set `playbackRate`
- **Web Animations API hook** — intercepts `Element.prototype.animate()`
- **Continuous animation poll** — polls every 500ms for newly-created animations
- **Debug logging** — 16 log points with `[TimeHooker]` prefix

---

## [3.0] - 2026-04-14

### Changed
- Hardened 5-strategy boot sequence
- All hooks wrapped in individual try/catch
- Shadow DOM fallback chain: closed → open → plain div
- Saved native MutationObserver reference

### Added
- Watchdog system (2s poll + body-replacement observer)
- Iframe guard (UI on top frame only)
- Media playback-rate sync
- 30s safety timeouts on boot observers

### Fixed
- Script failing on async-DOM SPAs
- UI disappearing on body replacement
- Crash when documentElement missing at document-start

---

## [2.0] - 2026-03-23

### Changed
- Complete rewrite: `@grant none` + closed Shadow DOM

### Added
- MutationObserver boot, Alt+Up/Down shortcuts, slider, custom input, hook toggle

### Fixed
- Bubble not appearing (sandbox isolation), keyboard shortcuts not firing

---

## [1.0] - 2026-03-23

### Added
- Initial release with timing hooks, green bubble UI, keyboard shortcuts, localStorage persistence
