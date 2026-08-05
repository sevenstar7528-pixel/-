// ==UserScript==
// @name         放置天堂 修改器 v18.0
// @version      18.0
// @namespace    idle-lineage-modifier
// @description  掉落／怪物經驗／金幣倍率（可與擴充功能並掛）
// @match        https://shines871.github.io/idle-lineage-class/*
// @match        https://pp771007.github.io/idle-lineage-class/*
// @match        https://aquamarineserver.com/Lineage/*
// @match        file:///*
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const GM_SITE_ID = (typeof location !== 'undefined' && location.hostname) || 'default';
    const _GM_SENTINEL = {};

    function isCatchupBusy() {
        try {
            const el = document.documentElement;
            return el.getAttribute('data-gm-afk-catchup') === '1'
                || el.getAttribute('data-gm-ff-catchup') === '1';
        } catch (e) {
            return false;
        }
    }

    function gmStorageKey(key) {
        return GM_SITE_ID + '::' + key;
    }

    function gmGetRaw(key) {
        const scoped = GM_getValue(gmStorageKey(key), _GM_SENTINEL);
        if (scoped !== _GM_SENTINEL) return scoped;
        const legacy = GM_getValue(key, _GM_SENTINEL);
        if (legacy !== _GM_SENTINEL) {
            try { GM_setValue(gmStorageKey(key), legacy); } catch (e) { /* ignore */ }
            return legacy;
        }
        return _GM_SENTINEL;
    }

    function gmGet(key, fallback) {
        const v = gmGetRaw(key);
        return v === _GM_SENTINEL ? fallback : v;
    }

    function gmSet(key, val) {
        return GM_setValue(gmStorageKey(key), val);
    }

    function gmDelete(key) {
        try { GM_deleteValue(gmStorageKey(key)); } catch (e) { /* ignore */ }
        try { GM_deleteValue(key); } catch (e) { /* 清舊版全站共用 key */ }
    }

    const SCRIPT_VERSION = 1;
    const LEGACY_GM_KEYS = [
        'merc_exp_multiplier',
        'player_exp_multiplier',
        'ally_exp_multiplier',
    ];

    const GM_DEFAULTS = {
        drop_multiplier: 1.0,
        mob_exp_multiplier: 1.0,
        gold_multiplier: 1.0,
    };

    const MAX_MOB_EXP = 99999999;

    function clampRate(val, fallback) {
        const n = Number(val);
        if (!isFinite(n) || n <= 0) return fallback;
        return n;
    }

    function clampMobExpRate(val, fallback) {
        return clampRate(val, fallback);
    }

    function readRateSetting(key, fallback) {
        return clampRate(gmGet(key, fallback), fallback);
    }

    function migrateGmStorage() {
        const prev = gmGet('gm_mod_script_version', null);
        if (prev === SCRIPT_VERSION) return;
        LEGACY_GM_KEYS.forEach((k) => { gmDelete(k); });
        try { gmSet('gm_mod_script_version', SCRIPT_VERSION); } catch (e) { /* ignore */ }
    }

    migrateGmStorage();

    const DROP_TABLES = [
        ['MOB_DROPS', () => typeof MOB_DROPS !== 'undefined' ? MOB_DROPS : null, 'rewrite'],
        ['DARK_WEAPON_DROPS', () => typeof DARK_WEAPON_DROPS !== 'undefined' ? DARK_WEAPON_DROPS : null, 'cacheOnly'],
        ['DARK_CRYSTAL_DROPS', () => typeof DARK_CRYSTAL_DROPS !== 'undefined' ? DARK_CRYSTAL_DROPS : null, 'cacheOnly'],
        ['DRAGON_DROPS', () => typeof DRAGON_DROPS !== 'undefined' ? DRAGON_DROPS : null, 'rewrite'],
        ['WARRIOR_DROPS', () => typeof WARRIOR_DROPS !== 'undefined' ? WARRIOR_DROPS : null, 'cacheOnly'],
        ['MEM_DROPS', () => typeof MEM_DROPS !== 'undefined' ? MEM_DROPS : null, 'cacheOnly'],
    ];

    const FEATURE_IDS = ['drop', 'mobExp', 'gold'];
    let _gameProbe = null;

    function refreshGameProbe() {
        try {
            const raw = document.documentElement.getAttribute('data-gm-feature-probe');
            if (raw) _gameProbe = JSON.parse(raw);
        } catch (e) { /* 保留上次結果 */ }
    }

    function injectPageScript(code) {
        const el = document.createElement('script');
        el.textContent = code;
        (document.head || document.documentElement).appendChild(el);
        el.remove();
    }

    function injectGameFeatureProbe() {
        injectPageScript(`(function(){
    try {
        var prev = {};
        try {
            var raw = document.documentElement.getAttribute('data-gm-feature-probe');
            if (raw) prev = JSON.parse(raw) || {};
        } catch (e0) { prev = {}; }
        var probe = prev;
        if (typeof GAME_VERSION !== 'undefined') probe.v = GAME_VERSION;
        if (typeof MOB_DROPS !== 'undefined' && MOB_DROPS && typeof killMob === 'function') {
            var dk = Object.keys(MOB_DROPS)[0];
            var row = dk && MOB_DROPS[dk];
            probe.drop = Array.isArray(row) && row.length > 0
                && Array.isArray(row[0]) && typeof row[0][1] === 'number';
        }
        if (typeof DB !== 'undefined' && DB.mobs) {
            var hasExp = Object.keys(DB.mobs).some(function(id) {
                return DB.mobs[id] && typeof DB.mobs[id].exp === 'number';
            });
            probe.mobExp = hasExp
                && typeof killMob === 'function'
                && typeof getExpGainMult === 'function';
        }
        probe.gold = typeof dollFieldVal === 'function' && typeof killMob === 'function';
        document.documentElement.setAttribute('data-gm-feature-probe', JSON.stringify(probe));
    } catch (e) {
        document.documentElement.setAttribute('data-gm-feature-probe', '{"error":true}');
    }
})();`);
    }

    function isFeatureAvailable(id) {
        try {
            refreshGameProbe();
            if (_gameProbe && !_gameProbe.error) {
                if (Object.prototype.hasOwnProperty.call(_gameProbe, id)) return !!_gameProbe[id];
            }
            switch (id) {
                case 'drop':
                    return DROP_TABLES.some(([, get]) => {
                        const t = get();
                        return t && typeof t === 'object';
                    });
                case 'mobExp':
                    return typeof DB !== 'undefined' && DB.mobs;
                case 'gold':
                    return typeof dollFieldVal === 'function';
                default:
                    return false;
            }
        } catch (e) {
            return false;
        }
    }

    function canUseGmMenu() {
        return typeof GM_registerMenuCommand === 'function';
    }

    function unregisterMenu(id) {
        if (id == null) return;
        try { if (typeof GM_unregisterMenuCommand === 'function') GM_unregisterMenuCommand(id); } catch (e) {}
    }

    let dropMultiplier = readRateSetting('drop_multiplier', GM_DEFAULTS.drop_multiplier);
    let goldMultiplier = readRateSetting('gold_multiplier', GM_DEFAULTS.gold_multiplier);
    let mobExpMultiplier = clampMobExpRate(
        readRateSetting(
            'mob_exp_multiplier',
            readRateSetting('player_exp_multiplier', GM_DEFAULTS.mob_exp_multiplier)
        ),
        GM_DEFAULTS.mob_exp_multiplier
    );

    const ORIGINAL_RATES_CACHE = new Map();
    let menuModManagerId = null;
    let _lastFeatureAvailSig = '';

    function effectiveDropMultiplier() {
        return isFeatureAvailable('drop') ? dropMultiplier : GM_DEFAULTS.drop_multiplier;
    }
    function effectiveMobExpMultiplier() {
        return isFeatureAvailable('mobExp') ? mobExpMultiplier : GM_DEFAULTS.mob_exp_multiplier;
    }
    function effectiveGoldMultiplier() {
        return isFeatureAvailable('gold') ? goldMultiplier : GM_DEFAULTS.gold_multiplier;
    }

    function maybeRefreshMenuOnFeatureChange() {
        const sig = FEATURE_IDS.map((id) => (isFeatureAvailable(id) ? '1' : '0')).join('');
        if (sig !== _lastFeatureAvailSig) {
            _lastFeatureAvailSig = sig;
            registerMyMenu();
        }
    }

    function applyDropTableMultiplier(table, tableName, mode) {
        if (!table || typeof table !== 'object') return;
        const rewrite = mode !== 'cacheOnly';
        for (const monster in table) {
            if (!Array.isArray(table[monster])) continue;
            table[monster].forEach((item, index) => {
                if (!Array.isArray(item) || typeof item[1] !== 'number') return;
                const key = `${tableName}|${monster}|${item[0]}|${index}`;
                if (!ORIGINAL_RATES_CACHE.has(key)) {
                    ORIGINAL_RATES_CACHE.set(key, item[1]);
                }
                const orig = ORIGINAL_RATES_CACHE.get(key);
                if (!rewrite) {
                    item[1] = orig;
                    return;
                }
                let r = orig * effectiveDropMultiplier();
                item[1] = Number(r.toFixed(10));
            });
        }
    }

    function syncDropRatesCacheToPage() {
        const cache = {};
        ORIGINAL_RATES_CACHE.forEach((v, k) => { cache[k] = v; });
        const mult = effectiveDropMultiplier();
        injectPageScript(`(function(){
    window.__gmDropRatesOriginal = ${JSON.stringify(cache)};
    window.__gmDropMult = ${mult};
    if (window.__gmGmemDex && window.__gmGmemDex.invalidate) window.__gmGmemDex.invalidate();
})();`);
    }

    function injectPageRateMods() {
        const mobExpOn = isFeatureAvailable('mobExp');
        const goldOn = isFeatureAvailable('gold');
        if (!mobExpOn && !goldOn) return;
        const mobExpMult = mobExpOn
            ? clampMobExpRate(effectiveMobExpMultiplier(), GM_DEFAULTS.mob_exp_multiplier)
            : 1;
        const goldMult = goldOn
            ? clampRate(effectiveGoldMultiplier(), GM_DEFAULTS.gold_multiplier)
            : 1;
        injectPageScript(`(function(){
    try {
        if (typeof DB === 'undefined' || !DB.mobs) return;
        var mobExpOn = ${mobExpOn};
        var goldOn = ${goldOn};
        var mobExpMult = ${mobExpMult};
        var goldMult = ${goldMult};
        var maxMobExp = ${MAX_MOB_EXP};
        if (!window.__gmRateHookInstalled) {
            window.__gmRateHookInstalled = true;
            window.__gmMobExpBase = window.__gmMobExpBase || {};
            var _origDoll = typeof dollFieldVal === 'function' ? dollFieldVal : null;
            if (_origDoll) {
                dollFieldVal = function(field) {
                    var baseVal = _origDoll(field);
                    var gm = (window.__gmRates && window.__gmRates.gold) || 1;
                    if (field === 'goldBonus' && gm !== 1) {
                        return ((1 + baseVal / 100) * gm - 1) * 100;
                    }
                    return baseVal;
                };
            }
            window.__gmApplyMobExp = function() {
                var mult = (window.__gmRates && window.__gmRates.mobExp) || 1;
                var cache = window.__gmMobExpBase;
                for (var id in DB.mobs) {
                    var mob = DB.mobs[id];
                    if (!mob || typeof mob.exp !== 'number') continue;
                    if (!Object.prototype.hasOwnProperty.call(cache, id)) cache[id] = mob.exp;
                    var base = cache[id];
                    if (base <= 0) { mob.exp = 0; continue; }
                    var exp = Math.floor(base * mult);
                    if (exp > maxMobExp) exp = maxMobExp;
                    mob.exp = exp;
                }
            };
        }
        window.__gmRates = Object.assign({}, window.__gmRates || {}, { mobExp: mobExpMult, gold: goldMult });
        if (typeof window.__gmApplyMobExp === 'function') window.__gmApplyMobExp();
    } catch (e) {}
})();`);
    }

    function injectDropMultHooks() {
        injectPageScript(`(function(){
    try {
        if (window.__gmDropMultHooksInstalled) return;
        window.__gmDropMultHooksInstalled = true;
        function installCard() {
            if (typeof window._cardDropRoll !== 'function' || window._cardDropRoll.__gmDropMultWrap) return;
            var _orig = window._cardDropRoll;
            window._cardDropRoll = function(name, tier, rate, pool) {
                var m = 1;
                try { m = Number(window.__gmDropMult) || 1; } catch (e) { m = 1; }
                if (!(m > 0) || !isFinite(m)) m = 1;
                var r = Number(rate) || 0;
                if (m !== 1) r = Math.min(1, r * m);
                return _orig.call(this, name, tier, r, pool);
            };
            window._cardDropRoll.__gmDropMultWrap = true;
            window._cardDropRoll.__gmDropMultOrig = _orig;
        }
        function installClassic() {
            if (typeof window.classicDropMult !== 'function' || window.classicDropMult.__gmDropMultWrap) return;
            var _bare = window.classicDropMult;
            window.__gmClassicDropMultBare = function() {
                try { return _bare.apply(this, arguments); } catch (e) { return 1; }
            };
            window.classicDropMult = function() {
                var b = 1;
                try { b = Number(_bare.apply(this, arguments)); } catch (e) { b = 1; }
                if (!(b > 0) || !isFinite(b)) b = 1;
                var m = 1;
                try { m = Number(window.__gmDropMult) || 1; } catch (e2) { m = 1; }
                if (!(m > 0) || !isFinite(m)) m = 1;
                return b * m;
            };
            window.classicDropMult.__gmDropMultWrap = true;
            window.classicDropMult.__gmDropMultOrig = _bare;
        }
        function installAll() { installCard(); installClassic(); }
        installAll();
        var n = 0;
        var t = setInterval(function() {
            installAll();
            n++;
            if (n > 60) clearInterval(t);
        }, 500);
    } catch (e) {}
})();`);
    }

    function applyAllModifications() {
        try {
            if (isFeatureAvailable('drop')) {
                DROP_TABLES.forEach(([name, getTable, mode]) => {
                    const table = getTable();
                    if (table) applyDropTableMultiplier(table, name, mode || 'rewrite');
                });
            }
            syncDropRatesCacheToPage();
            injectPageRateMods();
            injectDropMultHooks();
            return true;
        } catch (e) {
            console.log('[ModGM] 修改時發生錯誤:', e);
            return false;
        }
    }

    async function resetAllSettings() {
        if (!confirm('確定要將修改器倍率恢復為預設值嗎？')) return;
        for (const [key, val] of Object.entries(GM_DEFAULTS)) {
            await gmSet(key, val);
        }
        gmDelete('merc_exp_multiplier');
        gmDelete('player_exp_multiplier');
        gmDelete('ally_exp_multiplier');
        try { gmSet('gm_mod_script_version', SCRIPT_VERSION); } catch (e) {}
        dropMultiplier = GM_DEFAULTS.drop_multiplier;
        mobExpMultiplier = GM_DEFAULTS.mob_exp_multiplier;
        goldMultiplier = GM_DEFAULTS.gold_multiplier;
        applyAllModifications();
        registerMyMenu();
    }

    function gmPromptNumber(opts) {
        opts = opts || {};
        return new Promise(function(resolve) {
            var old = document.getElementById('gm-mod-number-prompt-modal');
            if (old) old.remove();
            var el = document.createElement('div');
            el.id = 'gm-mod-number-prompt-modal';
            el.innerHTML = [
                '<div class="gmnp-mask"></div>',
                '<div class="gmnp-box" role="dialog" aria-modal="true">',
                '  <div class="gmnp-title"></div>',
                '  <div class="gmnp-hint"></div>',
                '  <input type="text" class="gmnp-input" inputmode="decimal" autocomplete="off" spellcheck="false">',
                '  <div class="gmnp-err" style="display:none;"></div>',
                '  <div class="gmnp-actions">',
                '    <button type="button" class="gmnp-cancel">取消</button>',
                '    <button type="button" class="gmnp-ok">確定</button>',
                '  </div>',
                '</div>'
            ].join('');
            var titleEl = el.querySelector('.gmnp-title');
            var hintEl = el.querySelector('.gmnp-hint');
            var input = el.querySelector('.gmnp-input');
            var errEl = el.querySelector('.gmnp-err');
            titleEl.textContent = opts.title || '輸入數值';
            hintEl.textContent = opts.hint || '需大於 0（無上下限）';
            input.value = (opts.value != null && isFinite(Number(opts.value))) ? String(opts.value) : '';
            document.body.appendChild(el);
            function close(val) {
                try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
                if (el.parentNode) el.parentNode.removeChild(el);
                resolve(val);
            }
            function submit() {
                var raw = String(input.value || '').trim().replace(/,/g, '');
                var val = Number(raw);
                if (!isFinite(val) || val <= 0) {
                    errEl.textContent = '請輸入大於 0 的數字';
                    errEl.style.display = '';
                    input.focus();
                    input.select();
                    return;
                }
                close(val);
            }
            function onKey(ev) {
                if (ev.key === 'Escape') { ev.preventDefault(); close(null); }
                else if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
            }
            el.querySelector('.gmnp-cancel').addEventListener('click', function() { close(null); });
            el.querySelector('.gmnp-ok').addEventListener('click', submit);
            el.querySelector('.gmnp-mask').addEventListener('click', function() { close(null); });
            document.addEventListener('keydown', onKey, true);
            setTimeout(function() {
                try { input.focus(); input.select(); } catch (e2) {}
            }, 0);
        });
    }

    function buildModSpecs() {
        return [
            { id: 'drop', label: () => `掉落倍率 （目前: ${dropMultiplier}倍）`, enabled: () => isFeatureAvailable('drop') },
            { id: 'mobexp', label: () => `怪物經驗倍率 （目前: ${mobExpMultiplier}倍）`, enabled: () => isFeatureAvailable('mobExp') },
            { id: 'gold', label: () => `金幣獲得倍率 （目前: ${goldMultiplier}倍）`, enabled: () => isFeatureAvailable('gold') },
        ];
    }

    function escapeGmemHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatRowLabel(spec) {
        const full = spec.label();
        const m = full.match(/^(.*)\s*（目前:\s*(.*)）\s*$/);
        return { left: m ? m[1].trim() : full, right: m ? m[2].trim() : '' };
    }

    async function runModAction(actionId) {
        switch (actionId) {
            case 'drop': {
                if (!isFeatureAvailable('drop')) return;
                const val = await gmPromptNumber({ title: '掉落倍率', value: dropMultiplier });
                if (val == null) return;
                dropMultiplier = val;
                await gmSet('drop_multiplier', dropMultiplier);
                applyAllModifications();
                break;
            }
            case 'mobexp': {
                if (!isFeatureAvailable('mobExp')) return;
                const val = await gmPromptNumber({ title: '怪物經驗倍率', value: mobExpMultiplier });
                if (val == null) return;
                mobExpMultiplier = val;
                await gmSet('mob_exp_multiplier', mobExpMultiplier);
                applyAllModifications();
                break;
            }
            case 'gold': {
                if (!isFeatureAvailable('gold')) return;
                const val = await gmPromptNumber({ title: '金幣獲得倍率', value: goldMultiplier });
                if (val == null) return;
                goldMultiplier = val;
                await gmSet('gold_multiplier', goldMultiplier);
                applyAllModifications();
                break;
            }
            case 'reset':
                await resetAllSettings();
                break;
            default:
                break;
        }
    }

    function closeModManagerModal() {
        const el = document.getElementById('gm-mod-manager-modal');
        if (el) el.remove();
    }

    function openModManagerModal() {
        closeModManagerModal();
        const specs = buildModSpecs();
        const rows = specs.map((spec) => {
            const disabled = !spec.enabled();
            const parts = formatRowLabel(spec);
            return `<button type="button" class="gmmod-row${disabled ? ' is-disabled' : ''}" data-action="${spec.id}" ${disabled ? 'disabled' : ''}><span class="gmmod-row-main">${escapeGmemHtml(parts.left)}</span><span class="gmmod-row-value">${escapeGmemHtml(parts.right)}</span></button>`;
        }).join('');
        const el = document.createElement('div');
        el.id = 'gm-mod-manager-modal';
        el.innerHTML = [
            '<div class="gmmod-mask"></div>',
            '<div class="gmmod-box">',
            '  <div class="gmmod-head">',
            '    <span class="gmmod-title">修改器管理</span>',
            '    <button type="button" class="gmmod-reset" data-action-reset="1">重置設定</button>',
            '    <span class="gmmod-spacer"></span>',
            '    <button type="button" class="gmmod-x" data-close="1">關閉</button>',
            '  </div>',
            '  <div class="gmmod-body"><div class="gmmod-list">', rows, '</div></div>',
            '</div>'
        ].join('');
        document.body.appendChild(el);
        el.addEventListener('click', async (ev) => {
            const closeBtn = ev.target && ev.target.closest ? ev.target.closest('[data-close="1"], .gmmod-mask') : null;
            if (closeBtn) { closeModManagerModal(); return; }
            const resetBtn = ev.target && ev.target.closest ? ev.target.closest('button[data-action-reset="1"]') : null;
            if (resetBtn) {
                await runModAction('reset');
                openModManagerModal();
                return;
            }
            const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-action]') : null;
            if (!btn || btn.disabled) return;
            await runModAction(btn.getAttribute('data-action'));
            openModManagerModal();
        });
    }

    function getAutomationPanelContainer() {
        const panel = document.getElementById('automation-panel');
        if (panel) {
            const inner = panel.querySelector(':scope > div:last-child');
            return inner || panel;
        }
        const tab = document.getElementById('tab-automation');
        return tab || null;
    }

    function renderModControlPanel() {
        const container = getAutomationPanelContainer();
        if (!container) return;
        let host = document.getElementById('gm-mod-controls');
        if (!host) {
            host = document.createElement('div');
            host.id = 'gm-mod-controls';
            host.className = 'gm-mod-controls';
            const extHost = document.getElementById('gm-ext-controls');
            if (extHost && extHost.parentElement === container) {
                container.insertBefore(host, extHost);
            } else {
                container.appendChild(host);
            }
        } else if (host.parentElement !== container) {
            container.appendChild(host);
        }

        host.innerHTML = '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gm-mod-controls-btn';
        btn.dataset.action = 'open-mod-manager';
        btn.textContent = '開啟修改器';
        host.appendChild(btn);

        if (!host.dataset.bound) {
            host.dataset.bound = '1';
            host.addEventListener('click', (ev) => {
                const b = ev.target && ev.target.closest ? ev.target.closest('button[data-action]') : null;
                if (!b || b.disabled) return;
                if (b.dataset.action === 'open-mod-manager') openModManagerModal();
            });
        }
    }

    function registerMyMenu() {
        if (!canUseGmMenu()) return;
        unregisterMenu(menuModManagerId);
        menuModManagerId = GM_registerMenuCommand('開啟修改器', () => {
            openModManagerModal();
        });
    }

    injectGameFeatureProbe();
    registerMyMenu();
    GM_addStyle(`
        #gm-mod-controls { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(148,163,184,0.35); }
        #gm-mod-controls .gm-mod-controls-btn {
            width: 100%;
            font-size: 14px; line-height: 1.4; font-weight: 700; padding: 12px 14px; min-height: 48px; border-radius: 8px;
            border: 1px solid #475569; background: #0f172a; color: #e2e8f0; cursor: pointer;
            white-space: normal; word-break: break-word; text-align: center;
        }
        #gm-mod-controls .gm-mod-controls-btn:hover { border-color: #fbbf24; color: #fde68a; }
        #gm-mod-number-prompt-modal { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; color: #e2e8f0; font-family: inherit; }
        #gm-mod-number-prompt-modal .gmnp-mask { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.78); }
        #gm-mod-number-prompt-modal .gmnp-box { position: relative; z-index: 1; width: min(360px, 92vw); background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.55); }
        #gm-mod-number-prompt-modal .gmnp-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
        #gm-mod-number-prompt-modal .gmnp-hint { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }
        #gm-mod-number-prompt-modal .gmnp-input { width: 100%; box-sizing: border-box; background: #020617; border: 1px solid #475569; color: #e2e8f0; border-radius: 8px; padding: 10px 12px; font-size: 15px; }
        #gm-mod-number-prompt-modal .gmnp-err { color: #fca5a5; font-size: 12px; margin-top: 8px; }
        #gm-mod-number-prompt-modal .gmnp-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
        #gm-mod-number-prompt-modal .gmnp-actions button { padding: 8px 14px; border-radius: 8px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; cursor: pointer; font-weight: 600; }
        #gm-mod-number-prompt-modal .gmnp-ok { border-color: #ca8a04 !important; background: #422006 !important; color: #fde68a !important; }
        #gm-mod-manager-modal { position: fixed; inset: 0; z-index: 2147483646; display: flex; align-items: center; justify-content: center; color: #e2e8f0; font-family: inherit; }
        #gm-mod-manager-modal .gmmod-mask { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.72); }
        #gm-mod-manager-modal .gmmod-box { position: relative; z-index: 1; width: min(520px, 94vw); max-height: min(80vh, 640px); display: flex; flex-direction: column; background: #0f172a; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.55); }
        #gm-mod-manager-modal .gmmod-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #1e293b; }
        #gm-mod-manager-modal .gmmod-title { font-size: 16px; font-weight: 800; color: #fde68a; }
        #gm-mod-manager-modal .gmmod-spacer { flex: 1; }
        #gm-mod-manager-modal .gmmod-reset, #gm-mod-manager-modal .gmmod-x { border: 1px solid #475569; background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-weight: 600; }
        #gm-mod-manager-modal .gmmod-body { overflow: auto; padding: 10px; }
        #gm-mod-manager-modal .gmmod-row { width: 100%; display: flex; justify-content: space-between; gap: 12px; text-align: left; margin: 0 0 8px; padding: 12px 14px; border-radius: 8px; border: 1px solid #334155; background: #020617; color: #e2e8f0; cursor: pointer; font-size: 14px; font-weight: 600; }
        #gm-mod-manager-modal .gmmod-row:hover { border-color: #fbbf24; }
        #gm-mod-manager-modal .gmmod-row.is-disabled { opacity: 0.45; cursor: not-allowed; }
        #gm-mod-manager-modal .gmmod-row-value { color: #fde68a; white-space: nowrap; }
    `);

    renderModControlPanel();

    setInterval(() => {
        if (isCatchupBusy()) return;
        injectGameFeatureProbe();
        maybeRefreshMenuOnFeatureChange();
        if (typeof MOB_DROPS !== 'undefined' && typeof DB !== 'undefined' && DB.mobs) {
            applyAllModifications();
        } else {
            injectPageRateMods();
            injectDropMultHooks();
        }
        renderModControlPanel();
    }, 1000);

    console.log('[ModGM] 放置天堂 修改器 v18.0 已載入（掉落／怪物經驗／金幣）');
})();
