// ==UserScript==
// @name         Time Hooker
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Speed up or slow down any webpage by hooking JS timing functions — works on virtually all sites
// @author       Kushagra
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @noframes     false
// ==/UserScript==

(function () {
    'use strict';

    // Debug logging (check browser console F12 for these messages)
    const TH_DEBUG = true;
    const log = (...a) => { if (TH_DEBUG) console.log('%c[TimeHooker]', 'color:#22c55e;font-weight:bold', ...a); };
    const warn = (...a) => { if (TH_DEBUG) console.warn('%c[TimeHooker]', 'color:#f59e0b;font-weight:bold', ...a); };
    log('v3.0 loaded | readyState =', document.readyState,
        '| body =', !!document.body,
        '| docElem =', !!document.documentElement,
        '| isTop =', (function(){ try { return window.self === window.top; } catch(_) { return false; } })());


    // ═══════════════════════════════════════════════════════════════════════
    //  §1  SPEED STATE
    // ═══════════════════════════════════════════════════════════════════════
    let speedMultiplier = 1;
    try { speedMultiplier = parseFloat(localStorage.getItem('__th_speed')) || 1; } catch (_) {}

    // ═══════════════════════════════════════════════════════════════════════
    //  §2  SAVE NATIVE REFERENCES  (before any page script can tamper)
    // ═══════════════════════════════════════════════════════════════════════
    const _Date        = Date;
    const _now         = Date.now;
    const _perfNow     = performance.now.bind(performance);
    const _setTimeout  = window.setTimeout.bind(window);
    const _setInterval = window.setInterval.bind(window);
    const _clrTimeout  = window.clearTimeout.bind(window);
    const _clrInterval = window.clearInterval.bind(window);
    const _raf         = window.requestAnimationFrame.bind(window);
    const _craf        = window.cancelAnimationFrame.bind(window);
    const _MO          = window.MutationObserver;

    // ═══════════════════════════════════════════════════════════════════════
    //  §3  VIRTUAL CLOCK
    // ═══════════════════════════════════════════════════════════════════════
    let baseReal        = _now();
    let baseVirtual     = baseReal;
    let perfBaseReal    = _perfNow();
    let perfBaseVirtual = perfBaseReal;

    const vNow     = () => baseVirtual + (_now() - baseReal) * speedMultiplier;
    const vPerfNow = () => perfBaseVirtual + (_perfNow() - perfBaseReal) * speedMultiplier;

    // ═══════════════════════════════════════════════════════════════════════
    //  §4  HOOK TIMING FUNCTIONS  (wrapped in try/catch for resilience)
    // ═══════════════════════════════════════════════════════════════════════

    // ── Date ─────────────────────────────────────────────────────────────
    try {
        function FakeDate(...a) {
            if (!new.target) return (new _Date(vNow())).toString();
            if (a.length === 0) return new _Date(vNow());
            return new _Date(...a);
        }
        FakeDate.prototype = _Date.prototype;
        FakeDate.now   = () => vNow();
        FakeDate.parse = _Date.parse;
        FakeDate.UTC   = _Date.UTC;
        try { Object.defineProperty(FakeDate, 'name', { value: 'Date', configurable: true }); } catch (_) {}
        window.Date = FakeDate;
    log('Date hooked');
    } catch (e) { warn('Could not hook Date:', e); }

    // ── performance.now ──────────────────────────────────────────────────
    try {
        performance.now = () => vPerfNow();
    log('performance.now hooked');
    } catch (e) { warn('Could not hook performance.now:', e); }

    // ── setTimeout / clearTimeout ────────────────────────────────────────
    try {
        window.setTimeout = function (fn, delay, ...a) {
            return _setTimeout(fn, Math.max(0, (delay || 0) / speedMultiplier), ...a);
        };
        window.clearTimeout = _clrTimeout;
    log('setTimeout hooked');
    } catch (e) { warn('Could not hook setTimeout:', e); }

    // ── setInterval / clearInterval  (tracked for restart on speed Δ) ───
    const _intervals = new Map();
    try {
        window.setInterval = function (fn, delay, ...a) {
            const id = _setInterval(fn, Math.max(1, (delay || 0) / speedMultiplier), ...a);
            _intervals.set(id, { fn, delay, a });
            return id;
        };
        window.clearInterval = function (id) {
            _intervals.delete(id);
            _clrInterval(id);
        };
    log('setInterval hooked');
    } catch (e) { warn('Could not hook setInterval:', e); }

    // ── requestAnimationFrame / cancelAnimationFrame ─────────────────────
    const _rafCbs  = new Map();
    let   _rafPump = false;
    let   _rafSeq  = 0;

    function pumpRAF() {
        if (!_rafCbs.size) { _rafPump = false; return; }
        const batch = new Map(_rafCbs);
        _rafCbs.clear();
        const t = vPerfNow();
        batch.forEach(cb => { try { cb(t); } catch (e) { console.error(e); } });
        _raf(pumpRAF);
    }
    try {
        window.requestAnimationFrame = function (cb) {
            const id = ++_rafSeq;
            _rafCbs.set(id, cb);
            if (!_rafPump) { _rafPump = true; _raf(pumpRAF); }
            return id;
        };
        window.cancelAnimationFrame = function (id) { _rafCbs.delete(id); };
    log('rAF hooked');
    } catch (e) { warn('Could not hook rAF:', e); }

    // ═══════════════════════════════════════════════════════════════════════
    //  §5  MEDIA PLAYBACK-RATE SYNC
    // ═══════════════════════════════════════════════════════════════════════
    const _mediaElements = new Set();

    function syncMediaRate() {
        _mediaElements.forEach(el => {
            try { if (el.isConnected) el.playbackRate = speedMultiplier; } catch (_) {}
        });
    }

    function trackMedia(el) {
        if (el && (el instanceof HTMLMediaElement) && !_mediaElements.has(el)) {
            _mediaElements.add(el);
            try { el.playbackRate = speedMultiplier; } catch (_) {}
        }
    }

    // Intercept media elements created via createElement
    try {
        const _origCreate = document.createElement.bind(document);
        document.createElement = function (tag, opts) {
            const el = _origCreate(tag, opts);
            if (/^(video|audio)$/i.test(tag)) trackMedia(el);
            return el;
        };
    } catch (_) {}

    // ═══════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════
    //  §5b  CSS ANIMATION / TRANSITION SPEED OVERRIDE
    // ═══════════════════════════════════════════════════════════════════════
    let _cssStyleEl = null;

    function updateCSSSpeed() {
        const factor = 1 / speedMultiplier;
        const css = '*, *::before, *::after {' +
            ' animation-duration: calc(var(--th-orig-anim-dur, 1s) * ' + factor + ') !important;' +
            ' animation-delay: calc(var(--th-orig-anim-del, 0s) * ' + factor + ') !important;' +
            ' transition-duration: calc(var(--th-orig-trans-dur, 0.3s) * ' + factor + ') !important;' +
            ' transition-delay: calc(var(--th-orig-trans-del, 0s) * ' + factor + ') !important;' +
            '}';
        // Simpler and more reliable: just set a global playback rate multiplier
        // by overriding durations with a scale factor
        const cssSimple = ':root { --th-speed: ' + factor + '; }\n' +
            '*, *::before, *::after {' +
            ' animation-play-state: running !important;' +
            '}';

        if (speedMultiplier === 1) {
            // Remove override when at normal speed
            if (_cssStyleEl && _cssStyleEl.parentNode) {
                _cssStyleEl.parentNode.removeChild(_cssStyleEl);
                _cssStyleEl = null;
            }
            return;
        }

        if (!_cssStyleEl) {
            _cssStyleEl = document.createElement('style');
            _cssStyleEl.id = '__th-css-speed';
            _cssStyleEl.setAttribute('data-th', 'css');
        }

        // Use document.timeline to speed up Web Animations API (the most reliable approach)
        // For CSS, we need to iterate existing animations
        _cssStyleEl.textContent = ':root { --th-speed-factor: ' + factor + '; }';

        const parent = document.head || document.documentElement;
        if (parent && !_cssStyleEl.parentNode) {
            try { parent.appendChild(_cssStyleEl); } catch(_) {}
        }

        // Speed up all running CSS & Web animations via getAnimations()
        speedUpAllAnimations();
    }

    function speedUpAllAnimations() {
        try {
            // document.getAnimations() returns ALL running animations (CSS + Web Animations API)
            const anims = document.getAnimations ? document.getAnimations() : [];
            for (const anim of anims) {
                try {
                    anim.playbackRate = speedMultiplier;
                } catch(_) {}
            }
        } catch(_) {}
    }

    // Observe new animations being added (for dynamically created elements)
    let _animPollId = null;
    function startAnimationPoll() {
        if (_animPollId) return;
        _animPollId = _setInterval(() => {
            if (speedMultiplier !== 1) {
                speedUpAllAnimations();
            }
        }, 500);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §5c  WEB ANIMATIONS API HOOK
    // ═══════════════════════════════════════════════════════════════════════
    try {
        const _origAnimate = Element.prototype.animate;
        if (_origAnimate) {
            Element.prototype.animate = function(keyframes, options) {
                // Scale duration/delay in the options
                if (typeof options === 'number') {
                    options = options / speedMultiplier;
                } else if (options && typeof options === 'object') {
                    options = Object.assign({}, options);
                    if (options.duration != null && typeof options.duration === 'number') {
                        options.duration = options.duration / speedMultiplier;
                    }
                    if (options.delay != null) {
                        options.delay = options.delay / speedMultiplier;
                    }
                    if (options.endDelay != null) {
                        options.endDelay = options.endDelay / speedMultiplier;
                    }
                }
                const anim = _origAnimate.call(this, keyframes, options);
                try { anim.playbackRate = speedMultiplier; } catch(_) {}
                return anim;
            };
            log('Web Animations API hooked');
        }
    } catch(e) { warn('Could not hook Web Animations API:', e); }


    //  §6  SPEED SETTER  (recalibrates clocks + restarts intervals)
    // ═══════════════════════════════════════════════════════════════════════
    function setSpeed(s) {
        // Recalibrate Date virtual clock
        const n = _now();
        baseVirtual = baseVirtual + (n - baseReal) * speedMultiplier;
        baseReal    = n;

        // Recalibrate performance virtual clock
        const pn = _perfNow();
        perfBaseVirtual = perfBaseVirtual + (pn - perfBaseReal) * speedMultiplier;
        perfBaseReal    = pn;

        speedMultiplier = s;
        try { localStorage.setItem('__th_speed', String(s)); } catch (_) {}

        // Restart tracked intervals at the new rate
        const snap = new Map(_intervals);
        snap.forEach(({ fn, delay, a }, oldId) => {
            _clrInterval(oldId);
            _intervals.delete(oldId);
            const newId = _setInterval(fn, Math.max(1, delay / speedMultiplier), ...a);
            _intervals.set(newId, { fn, delay, a });
        });

        // Sync media playback rates
        syncMediaRate();

        // Sync CSS animations & transitions
        updateCSSSpeed();
        startAnimationPoll();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §7  UI  — only injected on the TOP frame
    // ═══════════════════════════════════════════════════════════════════════
    const IS_TOP = (function () {
        try { return window.self === window.top; } catch (_) { return false; }
    })();
    log('IS_TOP =', IS_TOP);
    if (!IS_TOP) { log('Skipping UI (iframe)'); return; }

    const PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20];
    let _uiHost  = null;   // current host <div>
    let _refresh  = null;   // function to refresh UI labels

    // ── Attach host element to the best available parent ─────────────────
    function getParent() {
        return document.body || document.documentElement || document.querySelector('html') || null;
    }

    function buildUI() {
        // Prevent double injection
        if (_uiHost && _uiHost.isConnected) return;

        const parent = getParent();
        if (!parent) { log('buildUI: no parent found yet'); return false; }

        // ── Host element — zero-size, fixed overlay ──────────────────────
        const host = document.createElement('div');
        host.id    = '__time-hooker-host';
        host.setAttribute('data-th', '1');
        host.style.cssText =
            'position:fixed!important;top:0!important;left:0!important;' +
            'width:0!important;height:0!important;overflow:visible!important;' +
            'z-index:2147483647!important;pointer-events:none!important;' +
            'opacity:1!important;visibility:visible!important;display:block!important;';

        // ── Shadow DOM with fallback ─────────────────────────────────────
        let shadow;
        try {
            shadow = host.attachShadow({ mode: 'closed' });
        } catch (_) {
            try { shadow = host.attachShadow({ mode: 'open' }); } catch (__) { shadow = null; }
        }

        log('Shadow DOM:', shadow ? 'attached' : 'FAILED — using fallback');
        let root;
        if (shadow) {
            root = shadow;
        } else {
            // Fallback: plain div (no shadow isolation, but at least it works)
            root = document.createElement('div');
            host.appendChild(root);
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = getHTML();
        root.appendChild(wrapper);

        log('Appending host to', parent.tagName || 'unknown');
        try { parent.appendChild(host); } catch (_) {
            // Last-resort: append to <html>
            try { document.documentElement.appendChild(host); } catch (__) { return false; }
        }

        _uiHost = host;

        // ── Element refs ─────────────────────────────────────────────────
        const $ = id => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
        const bubble    = $('bubble');
        const panel     = $('panel');
        const grid      = $('grid');
        const badge     = $('badge');
        const speedLbl  = $('speedlbl');
        const slider    = $('slider');
        const sliderVal = $('sliderval');
        const customIn  = $('customin');
        const applyBtn  = $('applybtn');
        const toggleBtn = $('togglebtn');

        if (!bubble || !panel) { warn('buildUI: shadow DOM elements not found! bubble=', !!bubble, 'panel=', !!panel); return false; }

        let panelOpen  = false;
        let hookActive = true;

        function refresh() {
            try {
                badge.textContent     = speedMultiplier + 'x';
                speedLbl.textContent  = speedMultiplier + 'x';
                slider.value          = speedMultiplier;
                sliderVal.textContent = speedMultiplier + 'x';
                (root.querySelectorAll ? root : wrapper).querySelectorAll('.btn').forEach(b => {
                    b.classList.toggle('active', parseFloat(b.dataset.s) === speedMultiplier);
                });
                badge.style.background = speedMultiplier > 1 ? '#22c55e'
                                       : speedMultiplier < 1 ? '#f59e0b' : '#64748b';
            } catch (_) {}
        }
        _refresh = refresh;

        // ── Speed preset buttons ─────────────────────────────────────────
        PRESETS.forEach(s => {
            const b = document.createElement('div');
            b.className = 'btn' + (s === speedMultiplier ? ' active' : '');
            b.dataset.s = s;
            b.textContent = s + 'x';
            b.addEventListener('click', e => { e.stopPropagation(); setSpeed(s); refresh(); });
            grid.appendChild(b);
        });

        // ── Bubble toggles panel ─────────────────────────────────────────
        bubble.addEventListener('click', e => {
            e.stopPropagation();
            panelOpen = !panelOpen;
            panel.classList.toggle('show', panelOpen);
            bubble.classList.toggle('open', panelOpen);
        });

        // Close on outside click (capture phase for max reliability)
        document.addEventListener('click', () => {
            if (panelOpen) {
                panelOpen = false;
                panel.classList.remove('show');
                bubble.classList.remove('open');
            }
        }, true);

        panel.addEventListener('click', e => e.stopPropagation());

        // ── Slider ───────────────────────────────────────────────────────
        slider.addEventListener('input', e => {
            e.stopPropagation();
            setSpeed(parseFloat(parseFloat(e.target.value).toFixed(2)));
            refresh();
        });

        // ── Custom speed ─────────────────────────────────────────────────
        const applyCust = () => {
            const v = parseFloat(customIn.value);
            if (v > 0 && v <= 100) { setSpeed(v); refresh(); customIn.value = ''; }
        };
        applyBtn.addEventListener('click', e => { e.stopPropagation(); applyCust(); });
        customIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') applyCust(); });

        // ── Toggle hook on/off ───────────────────────────────────────────
        toggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            hookActive = !hookActive;
            toggleBtn.classList.toggle('on', hookActive);
            if (!hookActive) { setSpeed(1); refresh(); }
        });

        // ── Keyboard shortcuts ───────────────────────────────────────────
        document.addEventListener('keydown', e => {
            if (e.altKey && e.key.toLowerCase() === 't') { e.preventDefault(); bubble.click(); }
            if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); setSpeed(1); refresh(); }
            if (e.altKey && e.key === 'ArrowUp') {
                e.preventDefault();
                const i = PRESETS.indexOf(speedMultiplier);
                setSpeed(i !== -1 && i < PRESETS.length - 1
                    ? PRESETS[i + 1]
                    : Math.min(100, +(speedMultiplier * 1.5).toFixed(2)));
                refresh();
            }
            if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault();
                const i = PRESETS.indexOf(speedMultiplier);
                setSpeed(i > 0
                    ? PRESETS[i - 1]
                    : Math.max(0.01, +(speedMultiplier / 1.5).toFixed(2)));
                refresh();
            }
        });

        refresh();
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §8  SHADOW DOM TEMPLATE
    // ═══════════════════════════════════════════════════════════════════════
    function getHTML() {
        return '<style>' +
'*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }' +
':host { font-family:"Segoe UI",system-ui,-apple-system,sans-serif; }' +
'div, span, label, input, button, svg { font-family:"Segoe UI",system-ui,-apple-system,sans-serif; }' +

'#bubble {' +
'  position:fixed; top:50%; left:0;' +
'  z-index:2147483647;' +
'  transform: translateX(-38px) translateY(-50%);' +
'  transition: transform .3s cubic-bezier(.4,0,.2,1), background .3s, box-shadow .3s;' +
'  width:54px; height:54px; border-radius:0 16px 16px 0;' +
'  background:rgba(34,197,94,.55); backdrop-filter:blur(6px);' +
'  display:flex; align-items:center; justify-content:flex-end;' +
'  padding-right:8px; cursor:pointer; user-select:none;' +
'  box-shadow:0 2px 12px rgba(0,0,0,.18);' +
'  pointer-events:auto;' +
'}' +
'#bubble:hover, #bubble.open {' +
'  transform: translateX(0) translateY(-50%);' +
'  background:rgba(34,197,94,.82);' +
'  box-shadow:0 4px 24px rgba(34,197,94,.45);' +
'}' +
'#bubble svg {' +
'  width:26px; height:26px; fill:#fff;' +
'  filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));' +
'  transition:transform .3s;' +
'}' +
'#bubble:hover svg { transform:rotate(15deg) scale(1.12); }' +

'#badge {' +
'  position:absolute; top:-4px; right:-2px;' +
'  background:#22c55e; color:#052e16; font-size:9px; font-weight:700;' +
'  padding:1px 5px; border-radius:6px; line-height:1.4;' +
'  box-shadow:0 1px 4px rgba(0,0,0,.3); pointer-events:none;' +
'}' +

'#panel {' +
'  position:fixed; top:50%; left:62px;' +
'  z-index:2147483647;' +
'  transform:translateY(-50%) scale(.92); opacity:0;' +
'  pointer-events:none;' +
'  transition:opacity .22s cubic-bezier(.4,0,.2,1), transform .22s cubic-bezier(.4,0,.2,1);' +
'  background:rgba(15,23,42,.94); backdrop-filter:blur(14px);' +
'  border:1px solid rgba(255,255,255,.1); border-radius:16px;' +
'  padding:16px 18px; min-width:230px;' +
'  box-shadow:0 8px 32px rgba(0,0,0,.45);' +
'  color:#e2e8f0; font-size:13px;' +
'}' +
'#panel.show {' +
'  opacity:1; transform:translateY(-50%) scale(1);' +
'  pointer-events:auto;' +
'}' +

'.title {' +
'  color:rgba(255,255,255,.55); font-size:10px; font-weight:600;' +
'  letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;' +
'  display:flex; align-items:center; gap:6px;' +
'}' +
'.title svg { fill:rgba(255,255,255,.45); }' +

'#speedlbl {' +
'  display:block; text-align:center; margin-bottom:12px;' +
'  color:#22c55e; font-size:17px; font-weight:700;' +
'}' +

'#grid {' +
'  display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:12px;' +
'}' +
'.btn {' +
'  padding:8px 4px; border-radius:8px;' +
'  border:1px solid rgba(255,255,255,.08);' +
'  background:rgba(255,255,255,.05);' +
'  color:#e2e8f0; font-size:13px; font-weight:500;' +
'  text-align:center; cursor:pointer;' +
'  transition:background .15s, border-color .15s, color .15s;' +
'}' +
'.btn:hover {' +
'  background:rgba(34,197,94,.22); border-color:rgba(34,197,94,.5); color:#fff;' +
'}' +
'.btn.active {' +
'  background:rgba(34,197,94,.32); border-color:#22c55e;' +
'  color:#22c55e; font-weight:700;' +
'  box-shadow:0 0 10px rgba(34,197,94,.22);' +
'}' +

'.sep { height:1px; background:rgba(255,255,255,.08); margin:10px 0; }' +

'.slider-row {' +
'  display:flex; align-items:center; gap:8px; margin-bottom:8px;' +
'}' +
'.slider-row label { color:rgba(255,255,255,.5); font-size:11px; min-width:52px; }' +
'.slider-row .val  { color:#22c55e; font-size:12px; font-weight:600; min-width:42px; text-align:right; }' +
'input[type=range] {' +
'  -webkit-appearance:none; appearance:none; flex:1; height:4px;' +
'  border-radius:2px; background:rgba(255,255,255,.15); outline:none; cursor:pointer;' +
'}' +
'input[type=range]::-webkit-slider-thumb {' +
'  -webkit-appearance:none; width:14px; height:14px; border-radius:50%;' +
'  background:#22c55e; border:2px solid #166534; cursor:pointer;' +
'}' +
'input[type=range]::-moz-range-thumb {' +
'  width:14px; height:14px; border-radius:50%;' +
'  background:#22c55e; border:2px solid #166534; cursor:pointer;' +
'}' +

'.custom-row { display:flex; gap:6px; align-items:center; }' +
'.custom-row input {' +
'  flex:1; padding:6px 8px; border-radius:6px; font-size:13px;' +
'  border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.08);' +
'  color:#e2e8f0; outline:none; width:60px;' +
'}' +
'.custom-row input:focus { border-color:#22c55e; }' +
'.custom-row button {' +
'  padding:6px 12px; border-radius:6px; border:none;' +
'  background:#22c55e; color:#052e16; font-size:12px;' +
'  font-weight:600; cursor:pointer; transition:background .15s;' +
'}' +
'.custom-row button:hover { background:#16a34a; }' +

'.row { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }' +
'.row label { color:rgba(255,255,255,.7); font-size:12px; }' +
'.toggle {' +
'  position:relative; width:38px; height:20px; border-radius:10px;' +
'  background:rgba(255,255,255,.15); cursor:pointer; transition:background .2s;' +
'  border:none; padding:0;' +
'}' +
'.toggle.on { background:#22c55e; }' +
'.toggle::after {' +
'  content:""; position:absolute; top:2px; left:2px;' +
'  width:16px; height:16px; border-radius:50%;' +
'  background:#fff; transition:transform .2s;' +
'}' +
'.toggle.on::after { transform:translateX(18px); }' +

'.hint {' +
'  display:block; margin-top:10px; text-align:center;' +
'  color:rgba(255,255,255,.3); font-size:10px; line-height:1.7;' +
'}' +
'.hint kbd {' +
'  background:rgba(255,255,255,.1); padding:1px 5px; border-radius:3px;' +
'  font-family:monospace; font-size:10px; color:rgba(255,255,255,.5);' +
'}' +
'</style>' +

'<div id="bubble">' +
'  <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>' +
'  <span id="badge">1x</span>' +
'</div>' +

'<div id="panel">' +
'  <div class="title">' +
'    <svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>' +
'    TIME HOOKER' +
'  </div>' +
'  <span id="speedlbl">1x</span>' +
'  <div id="grid"></div>' +
'  <div class="sep"></div>' +
'  <div class="slider-row">' +
'    <label>Fine-tune</label>' +
'    <input type="range" id="slider" min="0.05" max="25" step="0.05" value="1">' +
'    <span class="val" id="sliderval">1x</span>' +
'  </div>' +
'  <div class="sep"></div>' +
'  <div class="custom-row">' +
'    <input type="number" id="customin" placeholder="Custom" min="0.01" max="100" step="0.01">' +
'    <button id="applybtn">Set</button>' +
'  </div>' +
'  <div class="sep"></div>' +
'  <div class="row">' +
'    <label>Hook Active</label>' +
'    <button class="toggle on" id="togglebtn"></button>' +
'  </div>' +
'  <span class="hint">' +
'    <kbd>Alt</kbd>+<kbd>T</kbd> panel &nbsp;' +
'    <kbd>Alt</kbd>+<kbd>R</kbd> reset<br>' +
'    <kbd>Alt</kbd>+<kbd>&uarr;</kbd>/<kbd>&darr;</kbd> step speed' +
'  </span>' +
'</div>';
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §9  ROBUST BOOT — multiple strategies to survive any DOM timing
    // ═══════════════════════════════════════════════════════════════════════
    let _booted = false;

    function tryBoot() {
        if (_booted) return;
        log('tryBoot() called | body =', !!document.body, '| docElem =', !!document.documentElement);
        if (buildUI()) {
            _booted = true;
            log('UI injected successfully!');
            startWatchdog();
            scanExistingMedia();
            if (speedMultiplier !== 1) { updateCSSSpeed(); startAnimationPoll(); }
        }
    }

    // Strategy 1: direct check
    log('Boot strategy 1: direct');
    tryBoot();

    // Strategy 2: DOMContentLoaded
    log('Boot strategy 2: DOMContentLoaded listener added');
    document.addEventListener('DOMContentLoaded', tryBoot, { once: true });

    // Strategy 3: readystatechange (fires at interactive AND complete)
    document.addEventListener('readystatechange', tryBoot);

    // Strategy 4: MutationObserver on the broadest possible target
    // Watches document OR documentElement for childList so we catch <body> creation
    try {
        const target = document.documentElement || document;
        const bootObs = new _MO(() => { tryBoot(); if (_booted) bootObs.disconnect(); });
        bootObs.observe(target, { childList: true, subtree: true });
        // Safety: disconnect after 30 s regardless
        _setTimeout(() => { bootObs.disconnect(); tryBoot(); }, 30000);
    } catch (_) {}

    // Strategy 5: polling fallback (some sites delay body creation significantly)
    const _poll = _setInterval(() => {
        tryBoot();
        if (_booted) _clrInterval(_poll);
    }, 50);
    _setTimeout(() => _clrInterval(_poll), 30000); // stop polling after 30 s

    // ═══════════════════════════════════════════════════════════════════════
    //  §10  WATCHDOG — re-injects UI if host element is removed
    // ═══════════════════════════════════════════════════════════════════════
    function startWatchdog() {
        // Check every 2 seconds that our host is still in the DOM
        _setInterval(() => {
            if (!_uiHost || !_uiHost.isConnected) {
                _uiHost = null;
                _booted = false;
                tryBoot();
            }
        }, 2000);

        // Also watch for body replacement (some SPAs swap <body> entirely)
        try {
            const bodyObs = new _MO((mutations) => {
                for (const m of mutations) {
                    for (const node of m.removedNodes) {
                        if (node === _uiHost || (node.nodeType === 1 && node.tagName === 'BODY')) {
                            _uiHost = null;
                            _booted = false;
                            _setTimeout(tryBoot, 100);
                            return;
                        }
                    }
                }
            });
            const watchTarget = document.documentElement || document;
            bodyObs.observe(watchTarget, { childList: true, subtree: false });
        } catch (_) {}
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §11  SCAN EXISTING MEDIA  (for <video>/<audio> already in DOM)
    // ═══════════════════════════════════════════════════════════════════════
    function scanExistingMedia() {
        try {
            document.querySelectorAll('video, audio').forEach(trackMedia);
        } catch (_) {}

        // Also observe future media elements added to the page
        try {
            const mediaObs = new _MO((muts) => {
                for (const m of muts) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        if (/^(VIDEO|AUDIO)$/i.test(node.tagName)) trackMedia(node);
                        try {
                            node.querySelectorAll && node.querySelectorAll('video, audio').forEach(trackMedia);
                        } catch (_) {}
                    }
                }
            });
            mediaObs.observe(document.documentElement || document, { childList: true, subtree: true });
        } catch (_) {}
    }

})();
