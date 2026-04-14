<div align="center">

# ⏱️ Time Hooker

### Speed Up or Slow Down Any Webpage — Right From Your Browser

[![Install with Tampermonkey](https://img.shields.io/badge/Install-Tampermonkey-00485B?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://greasyfork.org/en/scripts/571054-time-hooker)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0-blue?style=for-the-badge)]()
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-orange?style=for-the-badge&logo=tampermonkey)]()
[![Greasemonkey](https://img.shields.io/badge/Greasemonkey-Compatible-yellow?style=for-the-badge)]()

**Time Hooker** is a powerful Tampermonkey userscript that hooks into JavaScript's core timing APIs to let you **speed up**, **slow down**, or **freeze time** on any webpage. Control animations, countdowns, timers, and everything time-dependent — all with a sleek floating UI.

[Install Now](#-quick-install) · [Features](#-features) · [How It Works](#-how-it-works) · [Keyboard Shortcuts](#%EF%B8%8F-keyboard-shortcuts) · [FAQ](#-faq)

---

</div>

## 🎬 Preview

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  🟢 ← Green bubble (left edge, slides out on hover)  │
│  │                                                    │
│  │  ┌─────────────────────────┐                      │
│  │  │  ⏱ TIME HOOKER          │                      │
│  │  │       2x                │                      │
│  │  │ ┌──────┬──────┬──────┐  │                      │
│  │  │ │ 0.1x │ 0.25x│ 0.5x │  │                      │
│  │  │ ├──────┼──────┼──────┤  │                      │
│  │  │ │ 0.75x│  1x  │ 1.5x │  │                      │
│  │  │ ├──────┼──────┼──────┤  │                      │
│  │  │ │ [2x] │  3x  │  5x  │  │                      │
│  │  │ ├──────┼──────┼──────┤  │                      │
│  │  │ │ 10x  │ 20x  │      │  │                      │
│  │  │ └──────┴──────┴──────┘  │                      │
│  │  │ Fine-tune ──●────── 2x  │                      │
│  │  │ [Custom____] [Set]      │                      │
│  │  │ Hook Active      [●━━]  │                      │
│  │  │  Alt+T  Alt+R  Alt+↑/↓  │                      │
│  │  └─────────────────────────┘                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

> *A translucent green bubble peeks from the left edge. Hover to reveal it, click to open the full control panel.*

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **Speed Presets** | One-click buttons: `0.1x` `0.25x` `0.5x` `0.75x` `1x` `1.5x` `2x` `3x` `5x` `10x` `20x` |
| 🎚️ **Fine-Tune Slider** | Continuous range from `0.05x` to `25x` with 0.05 step precision |
| ✏️ **Custom Speed** | Type any value from `0.01x` to `100x` |
| ⏸️ **Freeze Time** | Set to `0.1x` or lower to virtually freeze animations/timers |
| 🔄 **Instant Reset** | One shortcut (`Alt+R`) snaps back to real-time `1x` |
| 🎨 **Non-Intrusive UI** | Translucent bubble hides at screen edge; Shadow DOM isolates all CSS |
| 💾 **Persistent Speed** | Your chosen speed survives page reloads (saved in `localStorage`) |
| 🌐 **Universal** | Works on **every website** — `@match *://*/*` |
| ⌨️ **Keyboard Driven** | Full keyboard shortcut support for power users |
| 🔒 **Zero Permissions** | `@grant none` — no special Tampermonkey permissions needed |

---

## 🛠️ What Gets Hooked

Time Hooker intercepts these core JavaScript timing APIs at `document-start`, before any page script loads:

| API | Effect |
|-----|--------|
| `setTimeout` / `clearTimeout` | Delays are divided by the speed multiplier |
| `setInterval` / `clearInterval` | Intervals are recalculated; live intervals restart on speed change |
| `Date` / `Date.now()` | Virtual clock runs at the chosen speed |
| `performance.now()` | Scaled to match the virtual clock |
| `requestAnimationFrame` | Callbacks receive virtual timestamps |

> **Example:** At `2x` speed, a `setTimeout(fn, 1000)` fires after 500ms real time. At `0.5x`, it fires after 2000ms.

---

## 🚀 Quick Install

### Prerequisites

You need a userscript manager extension:

| Browser | Extension | Link |
|---------|-----------|------|
| Chrome / Edge / Brave | **Tampermonkey** | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | **Tampermonkey** | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) |
| Safari | **Tampermonkey** | [Mac App Store](https://apps.apple.com/app/tampermonkey/id1482490089) |
| Any | **Greasemonkey** | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) |

### Method 1 — One-Click Install (Recommended)

1. **Click the button below** — Tampermonkey will detect it automatically:

   [![Install TimeHooker](https://img.shields.io/badge/⏱️_Install_TimeHooker-Click_Here-22c55e?style=for-the-badge&logoColor=white)](https://greasyfork.org/en/scripts/571054-time-hooker)

2. Tampermonkey will show a confirmation dialog → click **Install**.
3. Done. Visit any page and look for the **green bubble** on the left edge.

### Method 2 — Manual Install

1. Open your Tampermonkey **Dashboard** (click the extension icon → Dashboard).
2. Click the **`+`** tab to create a new script.
3. Delete the template code.
4. Copy the entire contents of [`TimeHooker.user.js`](TimeHooker.user.js) and paste it in.
5. Press `Ctrl+S` (or `Cmd+S`) to save.
6. Refresh any page — the green bubble appears on the left edge.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt` + `T` | Toggle the control panel open/closed |
| `Alt` + `R` | Reset speed to `1x` (real-time) |
| `Alt` + `↑` | Step speed up to the next preset |
| `Alt` + `↓` | Step speed down to the previous preset |

> **Tip:** When between presets (e.g. from the slider), `Alt+↑`/`↓` will multiply/divide by 1.5x instead.

---

## 🎯 Use Cases

- ⏩ **Skip wait timers** — Speed through countdown overlays, waiting screens, or loading delays
- 🎮 **Browser games** — Speed up idle/incremental games, or slow down for precision
- 🧪 **Web development** — Test CSS animations, transitions, and JS timers at different speeds
- 📺 **Animations** — Slow down complex animations to study them frame-by-frame
- 📊 **Dashboards** — Speed up auto-refresh intervals on monitoring dashboards
- 🧩 **Debugging** — Reproduce race conditions by slowing time to a crawl
- ⏱️ **Productivity** — Speed up Pomodoro timers, break reminders, or any timed interface

---

## 🔧 How It Works

```
┌─────────────────────────────────────────────────┐
│  @run-at document-start                         │
│                                                 │
│  1. Save references to REAL timing APIs         │
│  2. Replace them with hooked versions           │
│  3. Virtual clock tracks "fake" elapsed time    │
│  4. Speed change → recalibrate baselines        │
│     (no time-jump on speed switch)              │
│  5. All live setIntervals are restarted         │
│  6. Shadow DOM UI injected when <body> exists   │
│                                                 │
│  Page scripts only ever see the hooked APIs     │
└─────────────────────────────────────────────────┘
```

**Key design decisions:**

- **`@grant none`** — Runs in the page's own JS context so `window.setTimeout` etc. are the real page globals, not a sandbox copy.
- **`@run-at document-start`** — Hooks are installed before the page's own `<script>` tags execute, so nothing escapes.
- **Closed Shadow DOM** — The UI is fully CSS-isolated from the page. No styles leak in or out.
- **Baseline recalibration** — When you change speed, the virtual clock smoothly transitions without any timestamp jump.

---

## ❓ FAQ

<details>
<summary><b>Does it speed up videos/audio?</b></summary>

No. HTML5 `<video>` and `<audio>` elements use their own internal clocks managed by the browser's media pipeline, which can't be hooked from JavaScript. Use the browser's built-in playback rate control for media (`video.playbackRate = 2`).

</details>

<details>
<summary><b>Does it work on SPAs (Single Page Applications)?</b></summary>

Yes. The hooks are installed once at page load and affect all JavaScript that runs afterward, including dynamically loaded scripts from frameworks like React, Vue, or Angular.

</details>

<details>
<summary><b>Will websites detect this?</b></summary>

Most won't. Some anti-cheat or anti-bot systems may detect timing inconsistencies (e.g. comparing `Date.now()` to server timestamps). Use responsibly.

</details>

<details>
<summary><b>Does it work with Web Workers?</b></summary>

No — Web Workers have their own global scope that userscripts can't access. The hook only affects the main thread's timing APIs.

</details>

<details>
<summary><b>My speed setting resets on new domains?</b></summary>

Speed is saved per-origin using `localStorage`. Each domain remembers its own speed setting independently.

</details>

<details>
<summary><b>The bubble doesn't appear on some pages?</b></summary>

A few pages (like browser internal pages `chrome://`, `about:`, or pages with extremely aggressive CSP) may block userscripts. This is a browser limitation, not a bug.

</details>

---

## 🗂️ File Structure

```
TimeHooker/
├── TimeHooker.user.js          # The userscript (install this)
├── README.md                   # You are here
├── LICENSE                     # MIT License
├── CHANGELOG.md                # Version history
├── CONTRIBUTING.md             # Contribution guidelines
└── .github/
    └── ISSUE_TEMPLATE/
        ├── bug_report.md       # Structured bug report template
        └── feature_request.md  # Feature request template
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## ⭐ Star History

If you find Time Hooker useful, please consider giving it a ⭐ — it helps others discover the project!

---

<div align="center">

**Made with ☕ and JavaScript**

*Hook time. Control the web.*

</div>
