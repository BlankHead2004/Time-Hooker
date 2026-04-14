// ==UserScript==
// @name         Time Hooker
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Speed up or slow down any webpage by hooking JS timing functions — ultimate edition
// @author       Kushagra
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    //  §0  DOUBLE-INJECTION GUARD
    // ═══════════════════════════════════════════════════════════════════════
    if (window.__timeHookerActive) return;
    try {
        Object.defineProperty(window, '__timeHookerActive', {
            value: true, writable: false, configurable: false
        });
    } catch (_) {
        window.__timeHookerActive = true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §0b  DEBUG LOGGING
    // ═══════════════════════════════════════════════════════════════════════
    const TH_DEBUG = true;
    const log  = (...a) => { if (TH_DEBUG) console.log('%c[TimeHooker]', 'color:#22c55e;font-weight:bold', ...a); };
    const warn = (...a) => { if (TH_DEBUG) console.warn('%c[TimeHooker]', 'color:#f59e0b;font-weight:bold', ...a); };
    log('v4.0 loaded | readyState =', document.readyState,
        '| body =', !!document.body,
        '| docElem =', !!document.documentElement);

    // ═══════════════════════════════════════════════════════════════════════
    //  §1  SPEED STATE
    // ═══════════════════════════════════════════════════════════════════════
    let speedMultiplier = 1;
    let savedSpeed      = 1;
    let hookActive      = true;

    function loadSpeed() {
        try {
            const stored = parseFloat(localStorage.getItem('__th_speed'));
            if (isFinite(stored) && stored > 0 && stored <= 100) return stored;
        } catch (_) {}
        return 1;
    }
    function saveSpeed(s) {
        try { localStorage.setItem('__th_speed', String(s)); } catch (_) {}
    }
    speedMultiplier = loadSpeed();

    // ═══════════════════════════════════════════════════════════════════════
    //  §2  SAVE NATIVE REFERENCES (before any page script can tamper)
    // ═══════════════════════════════════════════════════════════════════════
    const _Date         = window.Date;
    const _now          = Date.now.bind(Date);
    const _perfNow      = performance.now.bind(performance);
    const _setTimeout   = window.setTimeout.bind(window);
    const _setInterval  = window.setInterval.bind(window);
    const _clrTimeout   = window.clearTimeout.bind(window);
    const _clrInterval  = window.clearInterval.bind(window);
    const _raf          = window.requestAnimationFrame.bind(window);
    const _craf         = window.cancelAnimationFrame.bind(window);
    const _MO           = window.MutationObserver;
    const _Worker       = window.Worker;
    const _createElement = document.createElement.bind(document);

    // ═══════════════════════════════════════════════════════════════════════
    //  §3  VIRTUAL CLOCK
    // ═══════════════════════════════════════════════════════════════════════
    let baseReal        = _now();
    let baseVirtual     = baseReal;
    let perfBaseReal    = _perfNow();
    let perfBaseVirtual = perfBaseReal;

    const vNow     = () => baseVirtual + (_now() - baseReal) * speedMultiplier;
    const vPerfNow = () => perfBaseVirtual + (_perfNow() - perfBaseReal) * speedMultiplier;

    function recalibrateClocks(newSpeed) {
        const rn = _now();
        baseVirtual = baseVirtual + (rn - baseReal) * speedMultiplier;
        baseReal    = rn;
        const pn = _perfNow();
        perfBaseVirtual = perfBaseVirtual + (pn - perfBaseReal) * speedMultiplier;
        perfBaseReal    = pn;
        speedMultiplier = newSpeed;
        saveSpeed(newSpeed);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §4  HOOK: Date (proper class extension + Symbol.hasInstance)
    // ═══════════════════════════════════════════════════════════════════════
    try {
        class FakeDate extends _Date {
            constructor(...args) {
                if (args.length === 0) super(vNow());
                else super(...args);
            }
        }
        FakeDate.now   = () => vNow();
        FakeDate.parse = _Date.parse.bind(_Date);
        FakeDate.UTC   = _Date.UTC.bind(_Date);
        try { Object.defineProperty(FakeDate, 'name', { value: 'Date', configurable: true }); } catch (_) {}
        try { Object.defineProperty(FakeDate, 'length', { value: 7, configurable: true }); } catch (_) {}
        try {
            Object.defineProperty(FakeDate, Symbol.hasInstance, {
                value: (inst) => inst instanceof _Date, configurable: true
            });
        } catch (_) {}
        try {
            Object.defineProperty(window, 'Date', { get: () => FakeDate, configurable: true });
        } catch (_) {
            window.Date = FakeDate;
        }
        // Store for re-injection guard
        window.__thFakeDate = FakeDate;
        log('Date hooked (class extension)');
    } catch (e) { warn('Could not hook Date:', e); }

    // ═══════════════════════════════════════════════════════════════════════
    //  §5  HOOK: performance.now (prototype-level for iframe coverage)
    // ═══════════════════════════════════════════════════════════════════════
    try {
        Object.defineProperty(Performance.prototype, 'now', {
            value: function () { return vPerfNow(); },
            writable: true, configurable: true,
        });
        log('performance.now hooked (prototype)');
    } catch (_) {
        try { performance.now = () => vPerfNow(); log('performance.now hooked (instance)'); }
        catch (e) { warn('Could not hook performance.now:', e); }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §6  HOOK: setTimeout / clearTimeout (virtual ID mapping)
    // ═══════════════════════════════════════════════════════════════════════
    let _vIdCounter = 0;
    const _timeoutMap = new Map();

    try {
        window.setTimeout = function (fn, delay, ...args) {
            const vId = ++_vIdCounter;
            const scaled = Math.max(0, (delay || 0) / speedMultiplier);
            const rId = _setTimeout(function () {
                _timeoutMap.delete(vId);
                if (typeof fn === 'string') {
                    try { eval(fn); } catch (e) { console.error(e); }
                } else if (typeof fn === 'function') {
                    fn(...args);
                }
            }, scaled);
            _timeoutMap.set(vId, rId);
            return vId;
        };
        window.clearTimeout = function (vId) {
            const rId = _timeoutMap.get(vId);
            if (rId !== undefined) {
                _clrTimeout(rId);
                _timeoutMap.delete(vId);
            } else {
                _clrTimeout(vId);
            }
        };
        log('setTimeout hooked (virtual ID)');
    } catch (e) { warn('Could not hook setTimeout:', e); }

    // ═══════════════════════════════════════════════════════════════════════
    //  §7  HOOK: setInterval / clearInterval (tracked + capped map)
    // ═══════════════════════════════════════════════════════════════════════
    const _intervalMap = new Map();
    const MAX_TRACKED_INTERVALS = 500;

    try {
        window.setInterval = function (fn, delay, ...args) {
            const vId = ++_vIdCounter;
            const scaled = Math.max(1, (delay || 0) / speedMultiplier);
            const wrapper = function () {
                if (typeof fn === 'string') {
                    try { eval(fn); } catch (e) { console.error(e); }
                } else if (typeof fn === 'function') {
                    fn(...args);
                }
            };
            const rId = _setInterval(wrapper, scaled);
            if (_intervalMap.size >= MAX_TRACKED_INTERVALS) {
                const firstKey = _intervalMap.keys().next().value;
                _intervalMap.delete(firstKey);
            }
            _intervalMap.set(vId, { rId, fn, delay: delay || 0, args, wrapper });
            return vId;
        };
        window.clearInterval = function (vId) {
            const entry = _intervalMap.get(vId);
            if (entry !== undefined) {
                _clrInterval(entry.rId);
                _intervalMap.delete(vId);
            } else {
                _clrInterval(vId);
            }
        };
        log('setInterval hooked (capped map)');
    } catch (e) { warn('Could not hook setInterval:', e); }

    // ═══════════════════════════════════════════════════════════════════════
    //  §8  HOOK: requestAnimationFrame (multi-pass for speed > 1)
    // ═══════════════════════════════════════════════════════════════════════
    let _rafSeq = 0;
    const _rafCbs = new Map();
    let _rafLoopActive = false;

    function runRafLoop() {
        if (!_rafCbs.size) { _rafLoopActive = false; return; }
        if (speedMultiplier >= 1) {
            const passes = Math.max(1, Math.round(speedMultiplier));
            for (let p = 0; p < passes && _rafCbs.size > 0; p++) {
                const batch = new Map(_rafCbs);
                _rafCbs.clear();
                const t = vPerfNow();
                batch.forEach(cb => { try { cb(t); } catch (e) { console.error(e); } });
            }
            if (_rafCbs.size > 0) _raf(runRafLoop);
            else _rafLoopActive = false;
        } else {
            const frameMs = 1000 / 60;
            const delayMs = frameMs * (1 / speedMultiplier - 1);
            const batch = new Map(_rafCbs);
            _rafCbs.clear();
            const t = vPerfNow();
            batch.forEach(cb => { try { cb(t); } catch (e) { console.error(e); } });
            if (_rafCbs.size > 0) _setTimeout(() => _raf(runRafLoop), delayMs);
            else _rafLoopActive = false;
        }
    }

    try {
        window.requestAnimationFrame = function (cb) {
            const id = ++_rafSeq;
            _rafCbs.set(id, cb);
            if (!_rafLoopActive) { _rafLoopActive = true; _raf(runRafLoop); }
            return id;
        };
        window.cancelAnimationFrame = function (id) { _rafCbs.delete(id); };
        log('rAF hooked (multi-pass)');
    } catch (e) { warn('Could not hook rAF:', e); }

    // ═══════════════════════════════════════════════════════════════════════
    //  §9  HOOK: Web Workers (inject timing hooks via Blob URL)
    // ═══════════════════════════════════════════════════════════════════════
    const _workers = new Set();

    function workerHookCode() {
        return '(function(){' +
            'if(self.__timeHookerActive)return;self.__timeHookerActive=true;' +
            'let _speed=' + speedMultiplier + ';' +
            'const _now=Date.now.bind(Date),_pnow=(typeof performance!=="undefined")?performance.now.bind(performance):_now;' +
            'const _sto=self.setTimeout.bind(self),_sti=self.setInterval.bind(self);' +
            'let bR=_now(),bV=bR,pR=_pnow(),pV=pR;' +
            'const vN=()=>bV+(_now()-bR)*_speed,vP=()=>pV+(_pnow()-pR)*_speed;' +
            'const _RD=Date;class FD extends _RD{constructor(...a){super(a.length?a[0]:vN());}}' +
            'FD.now=vN;FD.parse=_RD.parse;FD.UTC=_RD.UTC;self.Date=FD;' +
            'if(typeof performance!=="undefined")performance.now=vP;' +
            'self.setTimeout=(fn,d,...a)=>_sto(fn,Math.max(0,(d||0)/_speed),...a);' +
            'self.setInterval=(fn,d,...a)=>_sti(fn,Math.max(1,(d||0)/_speed),...a);' +
            'self.addEventListener("message",e=>{' +
            'if(e.data&&e.data.__thSpeed!==undefined){' +
            'const n=_now(),pn=_pnow();bV=bV+(n-bR)*_speed;bR=n;pV=pV+(pn-pR)*_speed;pR=pn;_speed=e.data.__thSpeed;}});' +
            '})();\n';
    }

    function broadcastSpeedToWorkers(s) {
        const dead = [];
        _workers.forEach(ref => {
            const w = ref.deref();
            if (!w) { dead.push(ref); return; }
            try { w.postMessage({ __thSpeed: s }); } catch (_) {}
        });
        dead.forEach(r => _workers.delete(r));
    }

    try {
        if (typeof _Worker !== 'undefined') {
            window.Worker = function (scriptURL, options) {
                let blobURL;
                try {
                    const hookSrc = workerHookCode();
                    const blob = new Blob(
                        [hookSrc + 'importScripts(' + JSON.stringify(String(scriptURL)) + ');'],
                        { type: 'application/javascript' }
                    );
                    blobURL = URL.createObjectURL(blob);
                } catch (_) {
                    blobURL = scriptURL;
                }
                const w = new _Worker(blobURL, options);
                if (blobURL !== scriptURL) {
                    _setTimeout(() => { try { URL.revokeObjectURL(blobURL); } catch (_) {} }, 5000);
                }
                _workers.add(new WeakRef(w));
                return w;
            };
            try { Object.setPrototypeOf(window.Worker, _Worker); } catch (_) {}
            log('Worker hooked');
        }
    } catch (e) { warn('Could not hook Worker:', e); }

    // ═══════════════════════════════════════════════════════════════════════
    //  §10  HOOK: Same-origin iframes
    // ═══════════════════════════════════════════════════════════════════════
    function injectIntoIframe(iframe) {
        try {
            const cw = iframe.contentWindow;
            if (!cw || cw.__timeHookerActive) return;
            cw.__timeHookerActive = true;
            try { cw.Date = window.Date; } catch (_) {}
            try {
                Object.defineProperty(cw.Performance.prototype, 'now', {
                    value: () => vPerfNow(), writable: true, configurable: true
                });
            } catch (_) {
                try { cw.performance.now = () => vPerfNow(); } catch (_) {}
            }
            cw.setTimeout = window.setTimeout;
            cw.setInterval = window.setInterval;
            cw.clearTimeout = window.clearTimeout;
            cw.clearInterval = window.clearInterval;
            cw.requestAnimationFrame = window.requestAnimationFrame;
            cw.cancelAnimationFrame = window.cancelAnimationFrame;
        } catch (_) { /* cross-origin — skip silently */ }
    }

    function hookExistingIframes() {
        try { document.querySelectorAll('iframe').forEach(injectIntoIframe); } catch (_) {}
    }

    // Intercept iframe creation
    try {
        document.createElement = function (tag, ...args) {
            const el = _createElement(tag, ...args);
            if (typeof tag === 'string') {
                const t = tag.toLowerCase();
                if (t === 'iframe') {
                    el.addEventListener('load', () => injectIntoIframe(el), { once: false });
                }
                if (t === 'video' || t === 'audio') trackMedia(el);
            }
            return el;
        };
    } catch (_) {}

    // ═══════════════════════════════════════════════════════════════════════
    //  §11  HOOK: CSS Animations + Web Animations API
    // ═══════════════════════════════════════════════════════════════════════
    function speedUpAllAnimations() {
        try {
            const anims = document.getAnimations ? document.getAnimations() : [];
            for (const anim of anims) {
                try { anim.playbackRate = speedMultiplier; } catch (_) {}
            }
        } catch (_) {}
    }

    let _animPollId = null;
    function startAnimationPoll() {
        if (_animPollId) return;
        _animPollId = _setInterval(() => {
            if (speedMultiplier !== 1) speedUpAllAnimations();
        }, 500);
    }

    try {
        const _origAnimate = Element.prototype.animate;
        if (_origAnimate) {
            Element.prototype.animate = function (keyframes, options) {
                if (typeof options === 'number') {
                    options = options / speedMultiplier;
                } else if (options && typeof options === 'object') {
                    options = Object.assign({}, options);
                    if (options.duration != null && typeof options.duration === 'number')
                        options.duration = options.duration / speedMultiplier;
                    if (options.delay != null) options.delay = options.delay / speedMultiplier;
                    if (options.endDelay != null) options.endDelay = options.endDelay / speedMultiplier;
                }
                const anim = _origAnimate.call(this, keyframes, options);
                try { anim.playbackRate = speedMultiplier; } catch (_) {}
                return anim;
            };
            log('Web Animations API hooked');
        }
    } catch (e) { warn('Could not hook Web Animations API:', e); }

    // ═══════════════════════════════════════════════════════════════════════
    //  §12  MEDIA PLAYBACK-RATE SYNC
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

    // ═══════════════════════════════════════════════════════════════════════
    //  §13  RE-INJECTION GUARD (protect hooks from SPA overwriting)
    // ═══════════════════════════════════════════════════════════════════════
    const _ourImpls = {
        setTimeout:            window.setTimeout,
        setInterval:           window.setInterval,
        clearTimeout:          window.clearTimeout,
        clearInterval:         window.clearInterval,
        requestAnimationFrame: window.requestAnimationFrame,
        cancelAnimationFrame:  window.cancelAnimationFrame,
    };

    _setInterval(() => {
        for (const key of Object.keys(_ourImpls)) {
            if (window[key] !== _ourImpls[key]) {
                try { window[key] = _ourImpls[key]; } catch (_) {}
            }
        }
    }, 2000);

    // ═══════════════════════════════════════════════════════════════════════
    //  §14  SPEED SETTER (master function)
    // ═══════════════════════════════════════════════════════════════════════
    function setSpeed(s) {
        s = Math.max(0.01, Math.min(100, s));
        recalibrateClocks(s);

        // Restart tracked intervals at new rate
        const snap = new Map(_intervalMap);
        snap.forEach(({ fn, delay, args, wrapper }, vId) => {
            const entry = _intervalMap.get(vId);
            if (!entry) return;
            _clrInterval(entry.rId);
            const newRId = _setInterval(wrapper, Math.max(1, delay / speedMultiplier));
            entry.rId = newRId;
            _intervalMap.set(vId, entry);
        });

        broadcastSpeedToWorkers(s);
        syncMediaRate();
        speedUpAllAnimations();
        startAnimationPoll();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §15  UI — only on top frame, Shadow DOM, polished design
    // ═══════════════════════════════════════════════════════════════════════
    const IS_TOP = (function () {
        try { return window.self === window.top; } catch (_) { return false; }
    })();
    log('IS_TOP =', IS_TOP);
    if (!IS_TOP) { log('Skipping UI (iframe — hooks still active)'); return; }

    const PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50];
    let _uiHost = null;
    let _refresh = null;

    function getParent() {
        return document.body || document.documentElement || null;
    }

    function buildUI() {
        if (_uiHost && _uiHost.isConnected) return true;
        const parent = getParent();
        if (!parent) { log('buildUI: no parent yet'); return false; }

        const host = _createElement('div');
        host.id = '__time-hooker-host';
        host.setAttribute('data-th', '1');
        host.style.cssText =
            'position:fixed!important;top:0!important;left:0!important;' +
            'width:0!important;height:0!important;overflow:visible!important;' +
            'z-index:2147483647!important;pointer-events:none!important;' +
            'opacity:1!important;visibility:visible!important;display:block!important;';

        let shadow;
        try { shadow = host.attachShadow({ mode: 'closed' }); }
        catch (_) { try { shadow = host.attachShadow({ mode: 'open' }); } catch (__) { shadow = null; } }

        let root;
        if (shadow) { root = shadow; }
        else { root = _createElement('div'); host.appendChild(root); }

        root.innerHTML = getTemplate();

        try { parent.appendChild(host); } catch (_) {
            try { document.documentElement.appendChild(host); } catch (__) { return false; }
        }
        _uiHost = host;

        // ── Refs ─────────────────────────────────────────────────────
        const $ = id => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
        const bubble     = $('bubble');
        const panel      = $('panel');
        const grid       = $('grid');
        const badge      = $('badge');
        const speedLbl   = $('speedlbl');
        const slider     = $('slider');
        const sliderVal  = $('sliderval');
        const customIn   = $('customin');
        const applyBtn   = $('applybtn');
        const toggleBtn  = $('togglebtn');
        const hookStatus = $('hookstatus');

        if (!bubble || !panel) { warn('buildUI: elements not found'); return false; }

        let panelOpen = false;

        function refresh() {
            try {
                const s = speedMultiplier;
                badge.textContent     = s + 'x';
                speedLbl.textContent  = s + 'x';
                slider.value          = Math.min(s, parseFloat(slider.max));
                sliderVal.textContent = s + 'x';
                customIn.placeholder  = 'e.g. 7.5';

                (root.querySelectorAll ? root : root).querySelectorAll('.btn').forEach(b => {
                    b.classList.toggle('active', parseFloat(b.dataset.s) === s);
                    b.classList.toggle('disabled', !hookActive);
                });

                const clr = s > 1 ? '#22c55e' : s < 1 ? '#f59e0b' : '#64748b';
                badge.style.background = clr;
                speedLbl.style.color   = clr;
                hookStatus.textContent = hookActive ? 'Active' : 'Paused';
                hookStatus.style.color = hookActive ? '#22c55e' : '#f87171';
                toggleBtn.classList.toggle('on', hookActive);
            } catch (_) {}
        }
        _refresh = refresh;

        // ── Preset buttons ───────────────────────────────────────────
        PRESETS.forEach(s => {
            const b = _createElement('div');
            b.className = 'btn';
            b.dataset.s = s;
            b.textContent = s + 'x';
            b.addEventListener('click', e => {
                e.stopPropagation();
                if (!hookActive) return;
                setSpeed(s); refresh();
            });
            grid.appendChild(b);
        });

        // ── Bubble toggle ────────────────────────────────────────────
        bubble.addEventListener('click', e => {
            e.stopPropagation();
            panelOpen = !panelOpen;
            panel.classList.toggle('show', panelOpen);
            bubble.classList.toggle('open', panelOpen);
        });

        // composedPath() for shadow DOM click detection
        document.addEventListener('click', e => {
            if (panelOpen && !e.composedPath().includes(host)) {
                panelOpen = false;
                panel.classList.remove('show');
                bubble.classList.remove('open');
            }
        }, { capture: false });

        panel.addEventListener('click', e => e.stopPropagation());

        // ── Slider ───────────────────────────────────────────────────
        slider.addEventListener('input', e => {
            e.stopPropagation();
            if (!hookActive) return;
            const v = Math.round(parseFloat(e.target.value) * 100) / 100;
            setSpeed(v); refresh();
        });

        // ── Custom speed ─────────────────────────────────────────────
        function applyCustom() {
            const v = parseFloat(customIn.value);
            if (isFinite(v) && v > 0 && v <= 100) {
                setSpeed(v); refresh(); customIn.value = '';
            } else {
                customIn.style.borderColor = '#f87171';
                _setTimeout(() => { customIn.style.borderColor = ''; }, 800);
            }
        }
        applyBtn.addEventListener('click', e => { e.stopPropagation(); applyCustom(); });
        customIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') applyCustom(); });
        customIn.addEventListener('keyup', e => e.stopPropagation());
        customIn.addEventListener('keypress', e => e.stopPropagation());

        // ── Toggle hook on/off (remembers speed) ─────────────────────
        toggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            hookActive = !hookActive;
            if (!hookActive) {
                savedSpeed = speedMultiplier;
                setSpeed(1); refresh();
            } else {
                setSpeed(savedSpeed); refresh();
            }
        });

        // ── Keyboard shortcuts (capture phase) ───────────────────────
        document.addEventListener('keydown', e => {
            if (!e.altKey) return;
            const key = e.key.toLowerCase();
            if (key === 't') { e.preventDefault(); bubble.click(); return; }
            if (key === 'r') { e.preventDefault(); if (hookActive) { setSpeed(1); refresh(); } return; }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!hookActive) return;
                const idx = PRESETS.indexOf(speedMultiplier);
                const next = idx !== -1 && idx < PRESETS.length - 1
                    ? PRESETS[idx + 1]
                    : Math.min(100, parseFloat((speedMultiplier * 1.5).toFixed(2)));
                setSpeed(next); refresh();
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!hookActive) return;
                const idx = PRESETS.indexOf(speedMultiplier);
                const prev = idx > 0
                    ? PRESETS[idx - 1]
                    : Math.max(0.01, parseFloat((speedMultiplier / 1.5).toFixed(2)));
                setSpeed(prev); refresh();
            }
        }, { capture: true });

        refresh();
        log('UI injected successfully!');
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §16  SHADOW DOM TEMPLATE (polished dark design)
    // ═══════════════════════════════════════════════════════════════════════
    function getTemplate() {
        return '<style>' +
'*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }' +

'#bubble {' +
'  position:fixed; top:50%; left:0; z-index:2147483647;' +
'  transform:translateX(-42px) translateY(-50%);' +
'  transition:transform .28s cubic-bezier(.4,0,.2,1), box-shadow .28s;' +
'  width:58px; height:58px; border-radius:0 18px 18px 0;' +
'  background:rgba(34,197,94,.55); backdrop-filter:blur(6px);' +
'  border:1px solid rgba(34,197,94,.3); border-left:none;' +
'  display:flex; align-items:center; justify-content:flex-end;' +
'  padding-right:9px; cursor:pointer; user-select:none;' +
'  box-shadow:2px 0 16px rgba(0,0,0,.25); pointer-events:auto;' +
'  font-family:"Segoe UI",system-ui,-apple-system,sans-serif;' +
'}' +
'#bubble:hover, #bubble.open {' +
'  transform:translateX(0) translateY(-50%);' +
'  background:rgba(34,197,94,.82);' +
'  box-shadow:4px 0 28px rgba(34,197,94,.45);' +
'}' +
'#bubble svg {' +
'  width:26px; height:26px; fill:#fff;' +
'  transition:transform .28s, fill .2s;' +
'  filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));' +
'}' +
'#bubble:hover svg { transform:rotate(12deg) scale(1.1); fill:#fff; }' +

'#badge {' +
'  position:absolute; top:-5px; right:-3px;' +
'  background:#64748b; color:#f1f5f9;' +
'  font-size:8.5px; font-weight:700; letter-spacing:.3px;' +
'  padding:2px 5px; border-radius:6px; line-height:1.4;' +
'  box-shadow:0 1px 6px rgba(0,0,0,.4); pointer-events:none;' +
'  font-family:"Segoe UI",system-ui,sans-serif; transition:background .2s;' +
'}' +

'#panel {' +
'  position:fixed; top:50%; left:66px; z-index:2147483647;' +
'  transform:translateY(-50%) scale(.9) translateX(-10px);' +
'  opacity:0; pointer-events:none;' +
'  transition:opacity .2s ease, transform .2s ease;' +
'  background:rgba(10,14,26,.95); backdrop-filter:blur(18px);' +
'  border:1px solid rgba(255,255,255,.08); border-radius:18px;' +
'  padding:18px 20px; min-width:260px; max-height:92vh; overflow-y:auto;' +
'  box-shadow:0 12px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05);' +
'  color:#e2e8f0; font-family:"Segoe UI",system-ui,sans-serif; font-size:13px;' +
'}' +
'#panel.show {' +
'  opacity:1; transform:translateY(-50%) scale(1) translateX(0);' +
'  pointer-events:auto;' +
'}' +

'.label {' +
'  color:rgba(255,255,255,.38); font-size:9.5px; font-weight:700;' +
'  letter-spacing:1.6px; text-transform:uppercase; margin-bottom:10px;' +
'  display:flex; align-items:center; gap:5px;' +
'  font-family:"Segoe UI",system-ui,sans-serif;' +
'}' +
'.label svg { fill:rgba(255,255,255,.3); flex-shrink:0; }' +

'#speedlbl {' +
'  display:block; text-align:center; margin-bottom:14px;' +
'  font-size:28px; font-weight:800; letter-spacing:-1px;' +
'  transition:color .2s; font-variant-numeric:tabular-nums;' +
'  font-family:"Segoe UI",system-ui,sans-serif;' +
'}' +

'.sep { height:1px; background:rgba(255,255,255,.06); margin:12px 0; }' +

'#grid {' +
'  display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-bottom:4px;' +
'}' +
'.btn {' +
'  padding:7px 2px; border-radius:8px;' +
'  border:1px solid rgba(255,255,255,.07);' +
'  background:rgba(255,255,255,.04);' +
'  color:#94a3b8; font-size:12px; font-weight:500;' +
'  text-align:center; cursor:pointer; transition:all .15s;' +
'  font-family:"Segoe UI",system-ui,sans-serif;' +
'}' +
'.btn:hover:not(.disabled) {' +
'  background:rgba(34,197,94,.15); border-color:rgba(34,197,94,.4); color:#fff;' +
'}' +
'.btn.active {' +
'  background:rgba(34,197,94,.2); border-color:#22c55e;' +
'  color:#22c55e; font-weight:700; box-shadow:0 0 12px rgba(34,197,94,.18);' +
'}' +
'.btn.disabled { opacity:.35; cursor:not-allowed; }' +

'.slider-row {' +
'  display:flex; align-items:center; gap:8px; margin-bottom:4px;' +
'}' +
'.slider-row .lbl { color:rgba(255,255,255,.4); font-size:11px; white-space:nowrap; }' +
'.slider-row .val { color:#22c55e; font-size:11.5px; font-weight:700; min-width:44px; text-align:right; font-variant-numeric:tabular-nums; }' +

'input[type=range] {' +
'  -webkit-appearance:none; appearance:none; flex:1; height:3px;' +
'  border-radius:2px; background:rgba(255,255,255,.12); outline:none; cursor:pointer;' +
'}' +
'input[type=range]::-webkit-slider-thumb {' +
'  -webkit-appearance:none; width:14px; height:14px; border-radius:50%;' +
'  background:#22c55e; border:2px solid #052e16; cursor:pointer;' +
'  box-shadow:0 0 6px rgba(34,197,94,.4);' +
'}' +
'input[type=range]::-moz-range-thumb {' +
'  width:14px; height:14px; border-radius:50%;' +
'  background:#22c55e; border:none; cursor:pointer;' +
'}' +

'.custom-row { display:flex; gap:6px; align-items:center; }' +
'.custom-row input {' +
'  flex:1; padding:7px 9px; border-radius:8px; font-size:12.5px;' +
'  border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.06);' +
'  color:#e2e8f0; outline:none; width:0; min-width:0;' +
'  font-family:"Segoe UI",system-ui,sans-serif; transition:border-color .15s;' +
'}' +
'.custom-row input:focus { border-color:#22c55e; }' +
'.custom-row button {' +
'  padding:7px 13px; border-radius:8px; border:none;' +
'  background:#22c55e; color:#052e16; font-size:12px; font-weight:700;' +
'  cursor:pointer; transition:background .15s, transform .1s;' +
'  font-family:"Segoe UI",system-ui,sans-serif; white-space:nowrap;' +
'}' +
'.custom-row button:hover { background:#16a34a; }' +
'.custom-row button:active { transform:scale(.95); }' +

'.row { display:flex; align-items:center; justify-content:space-between; gap:8px; }' +
'.row .lbl { color:rgba(255,255,255,.55); font-size:12px; }' +
'#hookstatus { font-size:11px; font-weight:600; transition:color .2s; }' +

'.toggle {' +
'  position:relative; width:38px; height:20px; border-radius:10px;' +
'  background:rgba(255,255,255,.12); cursor:pointer; transition:background .2s;' +
'  border:none; padding:0; flex-shrink:0;' +
'}' +
'.toggle.on { background:#22c55e; }' +
'.toggle::after {' +
'  content:""; position:absolute; top:2px; left:2px;' +
'  width:16px; height:16px; border-radius:50%;' +
'  background:#fff; transition:transform .2s;' +
'  box-shadow:0 1px 3px rgba(0,0,0,.3);' +
'}' +
'.toggle.on::after { transform:translateX(18px); }' +

'.hint {' +
'  display:block; margin-top:10px; text-align:center;' +
'  color:rgba(255,255,255,.22); font-size:9.5px; line-height:1.9;' +
'  font-family:"Segoe UI",system-ui,sans-serif;' +
'}' +
'.hint kbd {' +
'  background:rgba(255,255,255,.08); padding:1px 4px; border-radius:3px;' +
'  font-size:9px; color:rgba(255,255,255,.4); font-family:monospace;' +
'  border:1px solid rgba(255,255,255,.1);' +
'}' +
'</style>' +

'<div id="bubble">' +
'  <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>' +
'  <span id="badge">1x</span>' +
'</div>' +

'<div id="panel">' +
'  <div class="label">' +
'    <svg width="11" height="11" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>' +
'    TIME HOOKER v4' +
'  </div>' +
'  <span id="speedlbl">1x</span>' +
'  <div class="label" style="margin-bottom:8px">Presets</div>' +
'  <div id="grid"></div>' +
'  <div class="sep"></div>' +
'  <div class="label" style="margin-bottom:8px">Fine-tune</div>' +
'  <div class="slider-row">' +
'    <span class="lbl">0.05x</span>' +
'    <input type="range" id="slider" min="0.05" max="50" step="0.05" value="1">' +
'    <span class="val" id="sliderval">1x</span>' +
'  </div>' +
'  <div class="sep"></div>' +
'  <div class="label" style="margin-bottom:8px">Custom Speed</div>' +
'  <div class="custom-row">' +
'    <input type="number" id="customin" placeholder="e.g. 7.5" min="0.01" max="100" step="0.01">' +
'    <button id="applybtn">Set</button>' +
'  </div>' +
'  <div class="sep"></div>' +
'  <div class="row">' +
'    <span class="lbl">Hook</span>' +
'    <span id="hookstatus">Active</span>' +
'    <button class="toggle on" id="togglebtn"></button>' +
'  </div>' +
'  <span class="hint">' +
'    <kbd>Alt</kbd>+<kbd>T</kbd> panel &middot; <kbd>Alt</kbd>+<kbd>R</kbd> reset<br>' +
'    <kbd>Alt</kbd>+<kbd>&uarr;</kbd>/<kbd>&darr;</kbd> step speed' +
'  </span>' +
'</div>';
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §17  ROBUST BOOT (5-strategy)
    // ═══════════════════════════════════════════════════════════════════════
    let _booted = false;

    function tryBoot() {
        if (_booted) return;
        log('tryBoot | body =', !!document.body, '| docElem =', !!document.documentElement);
        if (buildUI()) {
            _booted = true;
            startWatchdog();
            hookExistingIframes();
            scanExistingMedia();
            if (speedMultiplier !== 1) { speedUpAllAnimations(); startAnimationPoll(); }
        }
    }

    // Strategy 1: direct
    tryBoot();
    // Strategy 2: DOMContentLoaded
    document.addEventListener('DOMContentLoaded', tryBoot, { once: true });
    // Strategy 3: readystatechange
    document.addEventListener('readystatechange', tryBoot);
    // Strategy 4: MutationObserver
    try {
        const target = document.documentElement || document;
        const bootObs = new _MO(() => { tryBoot(); if (_booted) bootObs.disconnect(); });
        bootObs.observe(target, { childList: true, subtree: true });
        _setTimeout(() => { bootObs.disconnect(); tryBoot(); }, 30000);
    } catch (_) {}
    // Strategy 5: polling
    const _poll = _setInterval(() => { tryBoot(); if (_booted) _clrInterval(_poll); }, 50);
    _setTimeout(() => _clrInterval(_poll), 30000);

    // ═══════════════════════════════════════════════════════════════════════
    //  §18  WATCHDOG — re-inject UI + watch body replacement + iframes
    // ═══════════════════════════════════════════════════════════════════════
    function startWatchdog() {
        _setInterval(() => {
            if (!_uiHost || !_uiHost.isConnected) {
                _uiHost = null; _booted = false; tryBoot();
            }
        }, 2000);

        try {
            const bodyObs = new _MO(muts => {
                for (const m of muts) {
                    for (const node of m.removedNodes) {
                        if (node === _uiHost || (node.nodeType === 1 && node.tagName === 'BODY')) {
                            _uiHost = null; _booted = false;
                            _setTimeout(tryBoot, 100);
                            return;
                        }
                    }
                }
            });
            bodyObs.observe(document.documentElement || document, { childList: true, subtree: false });
        } catch (_) {}

        // Watch for dynamically added iframes
        try {
            const ifrObs = new _MO(muts => {
                muts.forEach(m => m.addedNodes.forEach(n => {
                    if (n.tagName === 'IFRAME') injectIntoIframe(n);
                    else if (n.querySelectorAll) {
                        try { n.querySelectorAll('iframe').forEach(injectIntoIframe); } catch (_) {}
                    }
                }));
            });
            ifrObs.observe(document.documentElement, { childList: true, subtree: true });
        } catch (_) {}
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  §19  SCAN EXISTING MEDIA
    // ═══════════════════════════════════════════════════════════════════════
    function scanExistingMedia() {
        try { document.querySelectorAll('video, audio').forEach(trackMedia); } catch (_) {}
        try {
            const mediaObs = new _MO(muts => {
                for (const m of muts) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        if (/^(VIDEO|AUDIO)$/i.test(node.tagName)) trackMedia(node);
                        try { node.querySelectorAll && node.querySelectorAll('video, audio').forEach(trackMedia); } catch (_) {}
                    }
                }
            });
            mediaObs.observe(document.documentElement || document, { childList: true, subtree: true });
        } catch (_) {}
    }

})();
