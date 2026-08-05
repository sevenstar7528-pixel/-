// ==UserScript==
// @name         放置天堂 擴充功能 v1.0
// @version      1.0
// @namespace    idle-lineage-extension
// @description  功能／平衡／廢品／即時查詢（可與修改器並掛；倍率由修改器負責）
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

    // 各 GitHub Pages 站點獨立儲存（shines871 / pp771007 互不影響）
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

    // =========================
    // ✔ 版本與設定防呆（改版後自動清理舊參數、驗證合法值）
    // =========================
    const SCRIPT_VERSION = 5;
    const LEGACY_GM_KEYS = [
        'mob_names_always',
        'player_exp_multiplier',
        'ally_exp_multiplier',
        'enhance_one_sixth_triple',
        'bless_plus_one_safe_boost',
    ];

    const GM_DEFAULTS = {
        teleport_boss_mode_enabled: false, // 傳戒找王模式（true=開啟 / false=關閉）
        shared_inv_enabled: false,         // 傭兵共用背包（true/false）
        shared_gold_enabled: false,        // 傭兵共用金幣（true/false）
        inventory_ui_mode: 'grid',         // 物品欄介面（'grid'=傳統版, 'list'=清單版）
        mob_names_mode: 'default',         // 怪物名稱（'default'|'always'|'lock'）
        stat_detail_enabled: false,         // 能力頁屬性詳細資訊（true/false）
        squad_switch_enabled: true,        // 傭兵名字旁快速切換存檔按鈕（true/false）
        squad_merc_ui_enabled: false,     // 傭兵增益圖示 + 名稱旁異常狀態（true/false）
        collection_reveal_enabled: false, // 收藏冊增強：怪物全資訊＋階級色框；裝備／道具／遺物未獲得可滑過看說明（預設關）
        item_eff_detail_enabled: false,   // 武器特效詳細解說：特效下方顯示機率／傷害等（預設關）
        ally_preset_restore_enabled: true, // Chaos：重新招募保持設定／傭兵記憶（秋玥禁用）
        ally_arrow_dmg_enabled: false,     // 傭兵弓攻擊是否計入傭兵自身箭矢傷害與特效（公式同玩家·不消耗箭矢）
        wpn_en_pet_hit_enabled: false,     // Chaos：寵物命中補正：(6-武器安定值+武器強化值)×2（不含召喚）
        pet_reevolve_enabled: false,       // 寵物重新進化（不降等·需消耗勝利果實；秋玥／Chaos 皆可用）
        pledge_junk_en_sell_enabled: false, // 血盟掉落加值裝備：廢品記憶有同 id 基底則直接賣出（不標記廢品）
        castle_login_enabled: false,       // 擁有城堡時上線不在出生地改為在城堡
        super_black_market_enabled: false, // 超級黑市：權重1裝備上架滿10次後保底抽遺物／脛甲（售價10億）
        wh_scroll_enhance_enabled: false,  // 武防卷倉庫可用：強化／一鍵／快速強化背包不足時扣倉庫（預設關）
        buy_shout_notify_enabled: false,   // 遺物掉落 Chrome 通知（PC端限定·需開啟通知·預設關）
        hide_orig_pbar_enabled: false,     // 關閉置頂橫條 #_orig_pbar（非官方提示·有橫條才可開·預設關）
        inv_item_search_enabled: false,    // 物品搜尋（武/防/道具共用·有原生搜尋則禁用·預設關）
        obel_pride_track_enabled: false,   // 魔物追蹤：隱藏狩獵區（不含傲塔·遊戲已內建傲塔）
        sherine_world_correct_enabled: false, // 席琳世界補正：席琳化怪物不套用 AC 降低與 DR 增加
        sherine_grace_nocd_enabled: false, // 一般席琳：移除恩賜 3 分鐘冷卻＋允許場上多隻（頭目仍不中）
        full_random_enabled: false,        // 全隨機模式（true/false）
        pseudo_trad_drops_enabled: false,  // 偽傳統掉落（true/false）
        ui_refresh_sec: 0,                // UI 更新頻率（0=關閉節流，1/2/3=每 N 秒更新）
        difficulty_m: 1.0,                 // 難度係數（50~200%；100=原版；內部存 M）
    };

    // 301 版傳統掉落強化權重表（官網 v3.0.83 已移除，偽傳統掉落由修改器內嵌）
    const TRAD_EN_TABLES = {
        wpn6: [[20,1],[19,3],[18,5],[17,7],[16,8],[15,10],[14,12],[13,13],[12,15],[11,17],[10,18],[9,20],[8,22],[7,23],[6,45],[5,47],[4,47],[3,47],[2,47],[1,47],[0,46]],
        wpn0: [[20,1],[19,3],[18,5],[17,7],[16,8],[15,10],[14,12],[13,13],[12,15],[11,17],[10,18],[9,20],[8,22],[7,23],[6,25],[5,27],[4,28],[3,30],[2,32],[1,33],[0,151]],
        arm6: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,30],[5,30],[4,30],[3,30],[2,30],[1,30],[0,246]],
        arm4: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,17],[5,18],[4,37],[3,37],[2,37],[1,37],[0,243]],
        arm0: [[15,1],[14,3],[13,5],[12,7],[11,8],[10,10],[9,12],[8,13],[7,15],[6,17],[5,18],[4,20],[3,22],[2,23],[1,25],[0,301]],
        acc0: [[5,1],[4,3],[3,5],[2,7],[1,8],[0,476]],
    };

    const DIFF_M_MIN = 0.5;
    const DIFF_M_MAX = 2.0;
    const DIFF_PCT_MIN = 50;
    const DIFF_PCT_MAX = 200;
    const MAX_MOB_EXP = 99999999;   // 單一怪物模板 exp 上限（乘倍率後）

    // 倍率僅要求 >0 有限數，不設上下限（與金幣輸入一致）
    function clampRate(val, fallback) {
        const n = Number(val);
        if (!isFinite(n) || n <= 0) return fallback;
        return n;
    }



    function clampDifficultyM(val, fallback) {
        const n = Number(val);
        if (!isFinite(n)) return fallback;
        if (n < DIFF_M_MIN) return DIFF_M_MIN;
        if (n > DIFF_M_MAX) return DIFF_M_MAX;
        return n;
    }

    function difficultyMToPct(m) {
        return Math.round(clampDifficultyM(m, GM_DEFAULTS.difficulty_m) * 100);
    }

    function clampDifficultyPct(val, fallback) {
        const n = Math.round(Number(val));
        if (!isFinite(n)) return fallback;
        if (n < DIFF_PCT_MIN) return DIFF_PCT_MIN;
        if (n > DIFF_PCT_MAX) return DIFF_PCT_MAX;
        return n;
    }

    function difficultyPctToM(pct) {
        return clampDifficultyM(clampDifficultyPct(pct, difficultyMToPct(GM_DEFAULTS.difficulty_m)) / 100, GM_DEFAULTS.difficulty_m);
    }

    function difficultyFactors(m) {
        const mm = clampDifficultyM(m, GM_DEFAULTS.difficulty_m);
        return { m: mm, hp: Math.pow(mm, 1.5), dmg: 0.5 + 0.5 * mm };
    }

    function formatFactorPct(mult) {
        return Math.round(mult * 100) + '%';
    }

    function difficultyValueLabel(m) {
        const f = difficultyFactors(m != null ? m : effectiveDifficultyM());
        return `係數 ${formatFactorPct(f.m)} · HP ${formatFactorPct(f.hp)} · 傷害 ${formatFactorPct(f.dmg)}`;
    }

    function readRateSetting(key, fallback) {
        return clampRate(gmGet(key, fallback), fallback);
    }

    function readBoolSetting(key, fallback) {
        const v = gmGet(key, null);
        if (v === null || v === undefined) return fallback;
        if (typeof v === 'boolean') return v;
        if (v === 'true' || v === 1 || v === '1') return true;
        if (v === 'false' || v === 0 || v === '0') return false;
        return fallback;
    }

    function readEnumSetting(key, allowed, fallback) {
        const v = gmGet(key, null);
        return allowed.includes(v) ? v : fallback;
    }

    function migrateGmStorage() {
        const prev = gmGet('gm_ext_script_version', null);
        if (prev === SCRIPT_VERSION) return;
        LEGACY_GM_KEYS.forEach((k) => { gmDelete(k); });
        try { gmSet('gm_ext_script_version', SCRIPT_VERSION); } catch (e) { /* ignore */ }
    }

    migrateGmStorage();

    // rewrite: 擊殺時只乘 _dropBase（不含 classicDropMult）→ 需改寫表內機率
    // cacheOnly: 擊殺時乘 _dropMult（含 classicDropMult）→ 改由 classicDropMult 掛倍率，表只快取原值避免雙重
    const DROP_TABLES = [
        ['MOB_DROPS', () => typeof MOB_DROPS !== 'undefined' ? MOB_DROPS : null, 'rewrite'],
        ['DARK_WEAPON_DROPS', () => typeof DARK_WEAPON_DROPS !== 'undefined' ? DARK_WEAPON_DROPS : null, 'cacheOnly'],
        ['DARK_CRYSTAL_DROPS', () => typeof DARK_CRYSTAL_DROPS !== 'undefined' ? DARK_CRYSTAL_DROPS : null, 'cacheOnly'],
        ['DRAGON_DROPS', () => typeof DRAGON_DROPS !== 'undefined' ? DRAGON_DROPS : null, 'rewrite'],
        ['WARRIOR_DROPS', () => typeof WARRIOR_DROPS !== 'undefined' ? WARRIOR_DROPS : null, 'cacheOnly'],
        ['MEM_DROPS', () => typeof MEM_DROPS !== 'undefined' ? MEM_DROPS : null, 'cacheOnly'],
    ];

    const MOB_NAMES_MODES = ['always', 'lock', 'default'];
    const MOB_NAMES_LABELS = { always: '常駐顯示', lock: '鎖定中顯示', default: '預設顯示' };
    const INV_UI_MODES = ['grid', 'list'];
    const INV_UI_LABELS = { grid: '傳統版', list: '清單版' };

    const FEATURE_IDS = ['difficulty', 'invUi', 'sharedInv', 'mobNames', 'squadSwitch', 'squadMercUi', 'allyPreset'];

    // 遊戲端最低版本（遊戲改版時若 API 變了，可調高或改 probe 條件）
    const FEATURE_MIN_GAME_VERSION = {
        sharedInv: '3.0.0',
    };

    let _gameProbe = null;

    function parseGameVersion(v) {
        if (!v || typeof v !== 'string') return null;
        const m = v.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!m) return null;
        return { major: +m[1], minor: +m[2], patch: +m[3] };
    }

    function gameVersionAtLeast(current, minimum) {
        const cur = parseGameVersion(current);
        const min = parseGameVersion(minimum);
        if (!min) return true;
        if (!cur) return false;
        if (cur.major !== min.major) return cur.major > min.major;
        if (cur.minor !== min.minor) return cur.minor > min.minor;
        return cur.patch >= min.patch;
    }

    /**
     * 秋玥版判定：看法師精通「召喚精通」文案，不依 GAME_VERSION。
     * Chaos：魅力額外增加／魅力影響提升；秋玥：強化迷魅與召喚眷屬／更頻繁地施展。
     */
    function isAutumnEdition() {
        refreshGameProbe();
        if (_gameProbe && !_gameProbe.error && Object.prototype.hasOwnProperty.call(_gameProbe, 'autumnSummonMastery')) {
            return !!_gameProbe.autumnSummonMastery;
        }
        return false;
    }

    function refreshGameProbe() {
        try {
            const raw = document.documentElement.getAttribute('data-gm-feature-probe');
            if (raw) _gameProbe = JSON.parse(raw);
        } catch (e) { /* 保留上次結果 */ }
    }

    function injectGameFeatureProbe() {
        injectPageScript(`(function(){
    try {
        var probe = {};
        try {
            var _raw = document.documentElement.getAttribute('data-gm-feature-probe');
            if (_raw) probe = JSON.parse(_raw) || {};
        } catch (_e0) { probe = {}; }
        probe.v = typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : (probe.v || null);
        if (probe.difficulty == null) probe.difficulty = false;
        if (probe.invUi == null) probe.invUi = false;
        if (probe.sharedInv == null) probe.sharedInv = false;
        if (probe.mobNames == null) probe.mobNames = false;
        if (probe.squadSwitch == null) probe.squadSwitch = false;
        if (probe.squadMercUi == null) probe.squadMercUi = false;
        if (probe.allyPreset == null) probe.allyPreset = false;
        probe.autumnSummonMastery = false;
        try {
            var _sm = (typeof MASTERY_DATA !== 'undefined' && MASTERY_DATA.mage && MASTERY_DATA.mage.list)
                ? MASTERY_DATA.mage.list.m_summon : null;
            if (_sm) {
                var _smt = String(_sm.msg || '') + String(_sm.d || '');
                probe.autumnSummonMastery = /眷屬|更頻繁地施展|強化迷魅與召喚/.test(_smt)
                    && !/魅力額外增加|魅力影響提升/.test(_smt);
            }
        } catch (e) {}
        if (typeof MOB_DROPS !== 'undefined' && MOB_DROPS && typeof killMob === 'function') {
            var dk = Object.keys(MOB_DROPS)[0];
            var row = dk && MOB_DROPS[dk];
            probe.drop = Array.isArray(row) && row.length > 0
                && Array.isArray(row[0]) && typeof row[0][1] === 'number';
        }
        // 怪物經驗：DB.mobs.exp + getExpGainMult（相容 301 版 MERC_EXP_SHARE 與新版 partyExpShareCount）
        if (typeof DB !== 'undefined' && DB.mobs) {
            var hasExp = Object.keys(DB.mobs).some(function(id) {
                return DB.mobs[id] && typeof DB.mobs[id].exp === 'number';
            });
            probe.mobExp = hasExp
                && typeof killMob === 'function'
                && typeof getExpGainMult === 'function';
            probe.partyExp = typeof partyExpShareCount === 'function';
        }
        probe.gold = typeof dollFieldVal === 'function' && typeof killMob === 'function';
        probe.difficulty = typeof applySherineBuff === 'function'
            && typeof enemyPhysicalAttack === 'function'
            && typeof applyMobMagic === 'function'
            && typeof tick === 'function';
        probe.invUi = typeof decorateClassicInventoryTab === 'function'
            && typeof renderTabs === 'function'
            && !!document.getElementById('tab-items');
        probe.sharedInv = typeof saveGame === 'function'
            && typeof _lzGet === 'function' && typeof _lzSet === 'function'
            && typeof _saveWrap === 'function';
        probe.mobNames = !!document.getElementById('battle-view');
        probe.squadSwitch = typeof renderSquadPanel === 'function'
            && typeof saveGame === 'function' && typeof loadGame === 'function'
            && typeof slotSummary === 'function'
            && !!document.getElementById('squad-tab-team');
        probe.squadMercUi = probe.squadSwitch;
        probe.allyPreset = (typeof rehireAlly === 'function' || typeof toggleAlly === 'function')
            && typeof setAllyAtkSkill === 'function';
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
                const minVer = FEATURE_MIN_GAME_VERSION[id];
                if (minVer && _gameProbe.v && !gameVersionAtLeast(_gameProbe.v, minVer)) return false;
                if (Object.prototype.hasOwnProperty.call(_gameProbe, id)) return !!_gameProbe[id];
            }
            // probe 尚未跑完前的簡易 fallback（多為 DOM）
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
                case 'difficulty':
                    return typeof applySherineBuff === 'function' && typeof enemyPhysicalAttack === 'function';
                case 'invUi':
                    return !!document.getElementById('tab-items');
                case 'sharedInv':
                    return typeof saveGame === 'function';
                case 'mobNames':
                    return !!document.getElementById('battle-view');
                case 'squadSwitch':
                    return !!document.getElementById('squad-tab-team');
                case 'squadMercUi':
                    return !!document.getElementById('squad-tab-team');
                case 'allyPreset':
                    return typeof rehireAlly === 'function' || typeof toggleAlly === 'function';
                default:
                    return false;
            }
        } catch (e) {
            return false;
        }
    }

    function menuStatus(featureId, activeText) {
        return isFeatureAvailable(featureId) ? `（目前: ${activeText}）` : '（目前:禁用）';
    }

    function canUseGmMenu() {
        return typeof GM_registerMenuCommand === 'function';
    }

    function unregisterMenu(id) {
        if (id === null || id === undefined) return;
        if (typeof GM_unregisterMenuCommand !== 'function') return;
        try { GM_unregisterMenuCommand(id); } catch (e) { /* ignore */ }
    }

    // =========================
    // ✔ 載入所有自訂倍率
    // =========================
    let difficultyM = clampDifficultyM(gmGet('difficulty_m', GM_DEFAULTS.difficulty_m), GM_DEFAULTS.difficulty_m);
    let teleportBossModeEnabled = (function () {
        const legacy = gmGet('teleport_boss_mode_mult', null);
        if (legacy !== null && legacy !== undefined) {
            const on = Number(legacy) > 1;
            try { gmSet('teleport_boss_mode_enabled', on); } catch (e) { /* ignore */ }
            try { gmDelete('teleport_boss_mode_mult'); } catch (e) { /* ignore */ }
            return on;
        }
        return readBoolSetting('teleport_boss_mode_enabled', GM_DEFAULTS.teleport_boss_mode_enabled);
    })();


    let menuExtManagerId = null;
    let _nativeTraditional = false;
    let sharedInvEnabled = readBoolSetting('shared_inv_enabled', GM_DEFAULTS.shared_inv_enabled);
    let sharedGoldEnabled = readBoolSetting('shared_gold_enabled', GM_DEFAULTS.shared_gold_enabled);
    let statDetailEnabled = readBoolSetting('stat_detail_enabled', GM_DEFAULTS.stat_detail_enabled);
    let squadSwitchEnabled = readBoolSetting('squad_switch_enabled', GM_DEFAULTS.squad_switch_enabled);
    let squadMercUiEnabled = readBoolSetting('squad_merc_ui_enabled', GM_DEFAULTS.squad_merc_ui_enabled);
    let collectionRevealEnabled = readBoolSetting('collection_reveal_enabled', GM_DEFAULTS.collection_reveal_enabled);
    let itemEffDetailEnabled = readBoolSetting('item_eff_detail_enabled', GM_DEFAULTS.item_eff_detail_enabled);
    let allyPresetRestoreEnabled = readBoolSetting('ally_preset_restore_enabled', GM_DEFAULTS.ally_preset_restore_enabled);
    let allyArrowDmgEnabled = readBoolSetting('ally_arrow_dmg_enabled', GM_DEFAULTS.ally_arrow_dmg_enabled);
    let wpnEnPetHitEnabled = readBoolSetting('wpn_en_pet_hit_enabled', GM_DEFAULTS.wpn_en_pet_hit_enabled);
    let petReevolveEnabled = readBoolSetting('pet_reevolve_enabled', GM_DEFAULTS.pet_reevolve_enabled);
    let pledgeJunkEnSellEnabled = readBoolSetting('pledge_junk_en_sell_enabled', GM_DEFAULTS.pledge_junk_en_sell_enabled);
    let castleLoginEnabled = readBoolSetting('castle_login_enabled', GM_DEFAULTS.castle_login_enabled);
    let superBlackMarketEnabled = readBoolSetting('super_black_market_enabled', GM_DEFAULTS.super_black_market_enabled);
    let whScrollEnhanceEnabled = readBoolSetting('wh_scroll_enhance_enabled', GM_DEFAULTS.wh_scroll_enhance_enabled);
    let buyShoutNotifyEnabled = readBoolSetting('buy_shout_notify_enabled', GM_DEFAULTS.buy_shout_notify_enabled);
    let hideOrigPbarEnabled = readBoolSetting('hide_orig_pbar_enabled', GM_DEFAULTS.hide_orig_pbar_enabled);
    let invItemSearchEnabled = readBoolSetting('inv_item_search_enabled', GM_DEFAULTS.inv_item_search_enabled);
    let obelPrideTrackEnabled = readBoolSetting('obel_pride_track_enabled', GM_DEFAULTS.obel_pride_track_enabled);
    let sherineWorldCorrectEnabled = readBoolSetting('sherine_world_correct_enabled', GM_DEFAULTS.sherine_world_correct_enabled);
    let sherineGraceNoCdEnabled = readBoolSetting('sherine_grace_nocd_enabled', GM_DEFAULTS.sherine_grace_nocd_enabled);
    let fullRandomEnabled = readBoolSetting('full_random_enabled', GM_DEFAULTS.full_random_enabled);
    function clampUiRefreshSec(val, fallback) {
        const n = Number(val);
        if (!isFinite(n)) return fallback;
        if (n <= 0) return 0;
        if (n >= 3) return 3;
        return n >= 2 ? 2 : 1;
    }

    let uiRefreshSec = (function() {
        const legacy = gmGet('ui_throttle_enabled', null);
        if (legacy !== null && legacy !== undefined) {
            const sec = readBoolSetting('ui_throttle_enabled', false) ? 3 : 0;
            try { gmSet('ui_refresh_sec', sec); } catch (e) {}
            return sec;
        }
        return clampUiRefreshSec(gmGet('ui_refresh_sec', GM_DEFAULTS.ui_refresh_sec), GM_DEFAULTS.ui_refresh_sec);
    })();

    function pseudoTradStorageKey() {
        const pk = document.documentElement.getAttribute('data-gm-player-key');
        if (pk && pk !== '|') return 'pseudo_trad_drops_' + pk.replace(/[^a-zA-Z0-9_|.-]/g, '_');
        return 'pseudo_trad_drops_enabled';
    }

    function reloadPseudoTradSetting() {
        pseudoTradDropsEnabled = readBoolSetting(pseudoTradStorageKey(), GM_DEFAULTS.pseudo_trad_drops_enabled);
    }

    let pseudoTradDropsEnabled = readBoolSetting('pseudo_trad_drops_enabled', GM_DEFAULTS.pseudo_trad_drops_enabled);

    let inventoryUiMode = readEnumSetting('inventory_ui_mode', INV_UI_MODES, GM_DEFAULTS.inventory_ui_mode);
    let _invUiPageHookInstalled = false;

    function loadMobNamesMode() {
        const v = gmGet('mob_names_mode', null);
        if (MOB_NAMES_MODES.includes(v)) return v;
        if (gmGet('mob_names_always', null) === true) return 'always';
        return GM_DEFAULTS.mob_names_mode;
    }

    let mobNamesMode = loadMobNamesMode();
    if (!MOB_NAMES_MODES.includes(mobNamesMode)) mobNamesMode = GM_DEFAULTS.mob_names_mode;

    function refreshNativeTraditional() {
        try {
            const v = document.documentElement.getAttribute('data-gm-native-trad');
            if (v === '1') _nativeTraditional = true;
            else if (v === '0') _nativeTraditional = false;
        } catch (e) { /* ignore */ }
    }

    function isNativeTraditionalChar() {
        return _nativeTraditional;
    }

    function effectiveDifficultyM() {
        return isFeatureAvailable('difficulty') ? difficultyM : GM_DEFAULTS.difficulty_m;
    }
    function teleportBossModeLabel() {
        if (!teleportBossModeEnabled) return '關閉';
        if (isAutoTeleportBossOnNow()) return '未關閉遇BOSS順移';
        const n = teleportRingCountNow();
        if (n <= 0) return '未檢測到傳戒';
        return `+${n * 100}%（${n}顆）`;
    }
    function difficultyMenuLabel() {
        return difficultyValueLabel();
    }
    function effectiveSharedInvEnabled() {
        return sharedInvEnabled && isFeatureAvailable('sharedInv');
    }
    function effectiveSharedGoldEnabled() {
        return sharedGoldEnabled && isFeatureAvailable('sharedInv');
    }
    function effectiveStatDetailEnabled() {
        return !!statDetailEnabled;
    }
    function effectiveSquadSwitchEnabled() {
        // Chaos 已有 switchToAllyChar，本功能僅秋玥
        if (!isAutumnEdition()) return false;
        return squadSwitchEnabled && isFeatureAvailable('squadSwitch');
    }
    function effectiveSquadMercUiEnabled() {
        return squadMercUiEnabled && isFeatureAvailable('squadMercUi');
    }
    function effectiveAllyPresetRestoreEnabled() {
        // 秋玥禁用；僅 Chaos 可用
        if (isAutumnEdition()) return false;
        return allyPresetRestoreEnabled && isFeatureAvailable('allyPreset');
    }
    function effectiveAllyArrowDmgEnabled() {
        return allyArrowDmgEnabled;
    }
    function effectiveWpnEnPetHitEnabled() {
        if (isAutumnEdition()) return false;
        return wpnEnPetHitEnabled;
    }
    function effectivePetReevolveEnabled() {
        return petReevolveEnabled;
    }
    function effectivePledgeJunkEnSellEnabled() {
        return !!pledgeJunkEnSellEnabled;
    }
    function effectiveCastleLoginEnabled() {
        return !!castleLoginEnabled;
    }
    function effectiveSuperBlackMarketEnabled() {
        return !!superBlackMarketEnabled;
    }
    function effectiveWhScrollEnhanceEnabled() {
        return !!whScrollEnhanceEnabled;
    }
    function effectiveBuyShoutNotifyEnabled() {
        return !!buyShoutNotifyEnabled;
    }
    function hasOrigPbar() {
        try { return !!document.getElementById('_orig_pbar'); } catch (e) { return false; }
    }
    function effectiveHideOrigPbarEnabled() {
        return !!hideOrigPbarEnabled;
    }
    function applyHideOrigPbar() {
        let el;
        try { el = document.getElementById('_orig_pbar'); } catch (e) { return; }
        if (!el) return;
        if (effectiveHideOrigPbarEnabled()) {
            if (!el.hasAttribute('data-gm-pbar-prev-display')) {
                el.setAttribute('data-gm-pbar-prev-display', el.style.display || '');
            }
            el.style.setProperty('display', 'none', 'important');
        } else if (el.hasAttribute('data-gm-pbar-prev-display')) {
            const prev = el.getAttribute('data-gm-pbar-prev-display');
            el.removeAttribute('data-gm-pbar-prev-display');
            if (prev) el.style.display = prev;
            else el.style.removeProperty('display');
        } else {
            el.style.removeProperty('display');
        }
    }
    function effectiveObelPrideTrackEnabled() {
        return !!obelPrideTrackEnabled;
    }
    function effectiveSherineWorldCorrectEnabled() {
        return sherineWorldCorrectEnabled;
    }
    function effectiveSherineGraceNoCdEnabled() {
        return sherineGraceNoCdEnabled;
    }
    function effectiveUiRefreshSec() {
        return clampUiRefreshSec(uiRefreshSec, GM_DEFAULTS.ui_refresh_sec);
    }
    function effectiveInventoryUiMode() {
        return isFeatureAvailable('invUi') ? inventoryUiMode : GM_DEFAULTS.inventory_ui_mode;
    }
    function effectiveMobNamesMode() {
        // Chaos 已有 hover／鎖定顯示怪名，本功能僅秋玥
        if (!isAutumnEdition()) return GM_DEFAULTS.mob_names_mode;
        return isFeatureAvailable('mobNames') ? mobNamesMode : GM_DEFAULTS.mob_names_mode;
    }
    function effectivePseudoTradDrops() {
        if (isNativeTraditionalChar()) return false;
        return pseudoTradDropsEnabled;
    }

    let _lastFeatureAvailSig = '';
    function hasTeleportRingNow() {
        return teleportRingCountNow() > 0;
    }
    function teleportRingCountNow() {
        try {
            const n = parseInt(document.documentElement.getAttribute('data-gm-teleport-ring-count') || '0', 10);
            return Number.isFinite(n) && n > 0 ? n : 0;
        } catch (e) { return 0; }
    }
    function isAutoTeleportBossOnNow() {
        try { return document.documentElement.getAttribute('data-gm-auto-teleport-boss') === '1'; }
        catch (e) { return false; }
    }
    function refreshTeleportBossContext() {
        injectPageScript(`(function(){
    try {
        var cnt = 0;
        try {
            if (typeof player !== 'undefined' && player) {
                [player.eq && player.eq.ring1, player.eq && player.eq.ring2, player.eq && player.eq.ring3, player.eq && player.eq.ring4]
                    .forEach(function (e) { if (e && e.id === 'acc_116') cnt++; });
                if (player.inv) player.inv.forEach(function (i) {
                    if (i && i.id === 'acc_116') cnt += Math.max(1, i.cnt || 1);
                });
            }
            if (cnt <= 0 && typeof hasTeleportRing === 'function' && hasTeleportRing()) cnt = 1;
        } catch (e) {}
        var tp = document.getElementById('set-teleport');
        document.documentElement.setAttribute('data-gm-teleport-ring-count', String(cnt));
        document.documentElement.setAttribute('data-gm-has-teleport-ring', cnt > 0 ? '1' : '0');
        document.documentElement.setAttribute('data-gm-auto-teleport-boss', (tp && tp.checked) ? '1' : '0');
    } catch (e) {}
})();`);
    }
    function maybeRefreshMenuOnFeatureChange() {
        const sig = FEATURE_IDS.map((id) => (isFeatureAvailable(id) ? '1' : '0')).join('')
            + (_nativeTraditional ? 'T' : 'F')
            + ('R' + teleportRingCountNow())
            + (teleportBossModeEnabled ? 'T1' : 'T0')
            + (document.documentElement.getAttribute('data-gm-auto-teleport-boss') === '1' ? 'A1' : 'A0');
        if (sig !== _lastFeatureAvailSig) {
            _lastFeatureAvailSig = sig;
            applyInventoryUiMode();
            applyMobNamesStyle();
            applySquadSwitchVisibility();
            registerMyMenu();
        }
    }

    function injectPageScript(code) {
        const el = document.createElement('script');
        el.textContent = code;
        (document.head || document.documentElement).appendChild(el);
        el.remove();
    }

    function injectNativeTradProbe() {
        injectPageScript(`(function(){
    try {
        function gmUpdateNativeTradFlag() {
            var nat = !!(typeof player !== 'undefined' && player && player.traditionalMode);
            if (!nat && typeof traditionalActive === 'function') {
                try { nat = !!(player && traditionalActive()); } catch (e) {}
            }
            var pk = (typeof currentSlot !== 'undefined' ? String(currentSlot) : '') + '|'
                + (player && player.name ? String(player.name) : '');
            document.documentElement.setAttribute('data-gm-native-trad', nat ? '1' : '0');
            document.documentElement.setAttribute('data-gm-player-key', pk);
            window.__gmNativeTraditional = nat;
        }
        window.gmUpdateNativeTradFlag = gmUpdateNativeTradFlag;
        if (typeof player !== 'undefined' && player && player.cls) gmUpdateNativeTradFlag();
        if (typeof loadGame === 'function' && !loadGame.__gmNativeTradProbe) {
            var _lg = loadGame;
            loadGame = function() {
                var r = _lg.apply(this, arguments);
                try { gmUpdateNativeTradFlag(); } catch (e) {}
                return r;
            };
            loadGame.__gmNativeTradProbe = true;
        }
    } catch (e) {}
})();`);
    }

    function injectPseudoTradDrops() {
        const on = effectivePseudoTradDrops();
        const native = isNativeTraditionalChar();
        const tablesJson = JSON.stringify(TRAD_EN_TABLES);
        injectPageScript(`(function(){
    try {
        window.__gmPseudoTradDrops = ${on && !native};
        window.__gmNativeTraditional = ${!!native};
        var TRAD_EN_TABLES = ${tablesJson};
        if (!window.__gmPseudoTradHooks) {
            window.__gmPseudoTradHooks = true;
            function gmTradEnTableFor(d) {
                if (!d) return null;
                var safe = d.safe || 0;
                if (d.type === 'wpn') return (safe >= 6) ? TRAD_EN_TABLES.wpn6 : TRAD_EN_TABLES.wpn0;
                if (d.type === 'arm') return (safe >= 6) ? TRAD_EN_TABLES.arm6 : (safe >= 4 ? TRAD_EN_TABLES.arm4 : TRAD_EN_TABLES.arm0);
                if (d.type === 'acc') return TRAD_EN_TABLES.acc0;
                return null;
            }
            function gmRollTradEn(d) {
                var tbl = gmTradEnTableFor(d);
                if (!tbl) return 0;
                var total = 0, i;
                for (i = 0; i < tbl.length; i++) total += tbl[i][1];
                var r = lootRng('traden') * total, acc = 0, lvl = 0;
                for (i = 0; i < tbl.length; i++) {
                    acc += tbl[i][1];
                    if (r < acc) { lvl = tbl[i][0]; break; }
                }
                return (typeof capEn === 'function') ? capEn(lvl, d) : lvl;
            }
            function gmSplitPseudoTradStack(itemInfo, rolledEn) {
                if (!itemInfo || !rolledEn || typeof player === 'undefined' || !player || !Array.isArray(player.inv)) return;
                var id = itemInfo.id, cnt = itemInfo.cnt || 1;
                var bless = itemInfo.bless, anc = itemInfo.anc, attr = itemInfo.attr, seteff = itemInfo.seteff;
                var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
                var probe0 = { id: id, en: 0, bless: bless, anc: anc, attr: attr, seteff: seteff };
                var probeN = { id: id, en: rolledEn, bless: bless, anc: anc, attr: attr, seteff: seteff };
                var ex0 = player.inv.find(function(it) { return typeof sameItemSig === 'function' && sameItemSig(it, probe0); });
                if (ex0) {
                    ex0.cnt -= cnt;
                    if (ex0.cnt <= 0) player.inv = player.inv.filter(function(it) { return it !== ex0; });
                }
                var exN = player.inv.find(function(it) { return typeof sameItemSig === 'function' && sameItemSig(it, probeN); });
                if (exN) exN.cnt += cnt;
                else {
                    var junk = !!(player.junkPrefs && typeof itemSig === 'function'
                        && player.junkPrefs[itemSig(probeN)]) && !(d && d.noJunk);
                    player.inv.push({
                        id: id, uid: uid(), cnt: cnt, en: rolledEn,
                        bless: bless, anc: anc, attr: attr, seteff: seteff,
                        lock: false, junk: junk
                    });
                }
                itemInfo.en = rolledEn;
            }
            if (typeof gainItem === 'function' && !gainItem.__gmPseudoTradWrap) {
                var _gmGainBase = gainItem;
                gainItem = function(id, cnt, silent, forceNormal, affixOld) {
                    var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
                    var inCtx = !!_tradLootCtx || !!window.__gmPseudoTradLootCtx;
                    var wantRoll = window.__gmPseudoTradDrops && inCtx && !forceNormal && d && !d.noEnhance
                        && ((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc');
                    var rolled = wantRoll ? gmRollTradEn(d) : 0;
                    var result = _gmGainBase.apply(this, arguments);
                    if (rolled > 0 && result) gmSplitPseudoTradStack(result, rolled);
                    return result;
                };
                gainItem.__gmPseudoTradWrap = true;
            }
            if (typeof killMob === 'function' && !killMob.__gmPseudoTradWrap) {
                var _gmKM = killMob;
                killMob = function(idx) {
                    if (!window.__gmPseudoTradDrops) return _gmKM.apply(this, arguments);
                    window.__gmPseudoTradLootCtx = true;
                    try { return _gmKM.apply(this, arguments); }
                    finally { window.__gmPseudoTradLootCtx = false; }
                };
                killMob.__gmPseudoTradWrap = true;
            }
        }
        if (typeof window.gmUpdateNativeTradFlag === 'function') {
            try { window.gmUpdateNativeTradFlag(); } catch (e) {}
        }
    } catch (e) {}
})();`);
    }

    function syncSharedInvFlagToPage() {
        const on = effectiveSharedInvEnabled();
        injectPageScript(`try{localStorage.setItem('gm_shared_inv_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncSharedGoldFlagToPage() {
        const on = effectiveSharedGoldEnabled();
        injectPageScript(`try{localStorage.setItem('gm_shared_gold_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncStatDetailFlagToPage() {
        const on = effectiveStatDetailEnabled();
        injectPageScript(`window.__gmStatDetailOn=${on};try{localStorage.setItem('gm_stat_detail_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncAllyPresetFlagToPage() {
        const on = effectiveAllyPresetRestoreEnabled();
        injectPageScript(`window.__gmAllyPresetOn=${on};try{localStorage.setItem('gm_ally_preset_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncSquadMercUiFlagToPage() {
        // 同步使用者開關本身，勿再 && isFeatureAvailable：probe 瞬間失敗（例如尚未出現 squad-tab-team）
        // 會每秒把頁面旗標打成 false，造成選單顯示開啟卻完全沒反應
        const on = !!squadMercUiEnabled;
        injectPageScript(`window.__gmSquadMercUiOn=${on};try{localStorage.setItem('gm_squad_merc_ui_enabled','${on ? '1' : '0'}');}catch(e){}try{if(typeof __gmUpdateSquadMercUi==='function')__gmUpdateSquadMercUi();else if(typeof renderSquadPanel==='function')renderSquadPanel();}catch(e){}`);
    }
    function syncCollectionRevealFlagToPage() {
        const on = !!collectionRevealEnabled;
        injectPageScript(`window.__gmCollectionRevealOn=${on};try{localStorage.setItem('gm_collection_reveal_enabled','${on ? '1' : '0'}');}catch(e){}try{if(typeof renderEquipBook==='function')renderEquipBook();if(typeof renderMiscBook==='function')renderMiscBook();if(typeof renderRelicBook==='function')renderRelicBook();if(typeof renderCardBook==='function')renderCardBook();}catch(e){}`);
    }
    function syncItemEffDetailFlagToPage() {
        const on = !!itemEffDetailEnabled;
        injectPageScript(`window.__gmItemEffDetailOn=${on};try{localStorage.setItem('gm_item_eff_detail_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncAllyArrowDmgFlagToPage() {
        const on = effectiveAllyArrowDmgEnabled();
        injectPageScript(`window.__gmAllyArrowDmgOn=${on};try{localStorage.setItem('gm_ally_arrow_dmg_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncWpnEnPetHitFlagToPage() {
        const on = effectiveWpnEnPetHitEnabled();
        injectPageScript(`window.__gmWpnEnPetHitOn=${on};try{localStorage.setItem('gm_wpn_en_pet_hit_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncPetReevolveFlagToPage(opts) {
        const on = effectivePetReevolveEnabled();
        // 每秒只同步旗標；勿呼叫 refresh（會整頁重繪寵物保管列表，捲動會卡住）
        const doRefresh = !!(opts && opts.refresh);
        injectPageScript(`window.__gmPetReevolveOn=${on};try{localStorage.setItem('gm_pet_reevolve_enabled','${on ? '1' : '0'}');}catch(e){}${doRefresh ? 'try{if(typeof __gmRefreshPetReevolveUi===\'function\')__gmRefreshPetReevolveUi();}catch(e){}' : ''}`);
    }
    function syncPledgeJunkEnSellFlagToPage() {
        const on = effectivePledgeJunkEnSellEnabled();
        injectPageScript(`window.__gmPledgeJunkEnSellOn=${on};try{localStorage.setItem('gm_pledge_junk_en_sell_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncCastleLoginFlagToPage() {
        const on = effectiveCastleLoginEnabled();
        injectPageScript(`window.__gmCastleLoginOn=${on};try{localStorage.setItem('gm_castle_login_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncSuperBlackMarketFlagToPage() {
        const on = effectiveSuperBlackMarketEnabled();
        injectPageScript(`window.__gmSuperBmOn=${on};try{localStorage.setItem('gm_super_black_market_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncWhScrollEnhanceFlagToPage() {
        const on = effectiveWhScrollEnhanceEnabled();
        injectPageScript(`window.__gmWhScrollEnhOn=${on};try{localStorage.setItem('gm_wh_scroll_enhance_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncBuyShoutNotifyFlagToPage() {
        const on = effectiveBuyShoutNotifyEnabled();
        injectPageScript(`window.__gmBuyShoutNotifyOn=${on};try{localStorage.setItem('gm_buy_shout_notify_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncHideOrigPbarFlagToPage() {
        const on = effectiveHideOrigPbarEnabled();
        injectPageScript(`window.__gmHideOrigPbarOn=${on};try{localStorage.setItem('gm_hide_orig_pbar_enabled','${on ? '1' : '0'}');}catch(e){}`);
        try { applyHideOrigPbar(); } catch (e) {}
    }
    function hasNativeInvItemSearch() {
        try {
            if (typeof window.renderTabs === 'function'
                && window.renderTabs.__afkISearch
                && !window.renderTabs.__gmInvSearch) return true;
            const ids = ['afk-isearch-input', 'afk-isearch-wpn', 'afk-isearch-arm', 'afk-isearch-item'];
            for (let i = 0; i < ids.length; i++) {
                const el = document.getElementById(ids[i]);
                if (el && el.getAttribute('data-gm-inv-search') !== '1') return true;
            }
            const box = document.getElementById('afk-isearch');
            if (box && box.getAttribute('data-gm-inv-search') !== '1') return true;
        } catch (e) {}
        return false;
    }
    function effectiveInvItemSearchEnabled() {
        return !!invItemSearchEnabled && !hasNativeInvItemSearch();
    }
    function syncInvItemSearchFlagToPage() {
        const on = effectiveInvItemSearchEnabled();
        injectPageScript(`window.__gmInvItemSearchOn=${on};try{localStorage.setItem('gm_inv_item_search_enabled','${on ? '1' : '0'}');}catch(e){}try{if(typeof __gmRefreshInvItemSearch==='function')__gmRefreshInvItemSearch();}catch(e){}`);
    }
    function syncObelPrideTrackFlagToPage() {
        const on = effectiveObelPrideTrackEnabled();
        injectPageScript(`window.__gmObelPrideTrackOn=${on};try{localStorage.setItem('gm_obel_pride_track_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function requestBuyShoutNotifyPermission() {
        injectPageScript(`(function(){try{
            if(!('Notification' in window)){alert('此瀏覽器不支援通知');return;}
            if(Notification.permission==='granted')return;
            if(Notification.permission==='denied'){alert('瀏覽器已封鎖通知，請在網址列允許本站通知後再試');return;}
            Notification.requestPermission().then(function(p){
                if(p!=='granted')alert('未允許瀏覽器通知，遺物掉落將無法跳出通知');
            });
        }catch(e){}})();`);
    }
    function syncSherineWorldCorrectFlagToPage() {
        const on = effectiveSherineWorldCorrectEnabled();
        injectPageScript(`window.__gmSherineWorldCorrectOn=${on};try{localStorage.setItem('gm_sherine_world_correct_enabled','${on ? '1' : '0'}');}catch(e){}try{if(typeof __gmFixSherineMobsAcDr==='function')__gmFixSherineMobsAcDr();}catch(e){}`);
    }
    function syncSherineGraceNoCdFlagToPage() {
        const on = effectiveSherineGraceNoCdEnabled();
        injectPageScript(`window.__gmSherineGraceNoCdOn=${on};try{localStorage.setItem('gm_sherine_grace_nocd_enabled','${on ? '1' : '0'}');}catch(e){}`);
    }
    function syncUiThrottleFlagToPage() {
        const sec = effectiveUiRefreshSec();
        injectPageScript(`window.__gmUiRefreshSec=${sec};try{localStorage.setItem('gm_ui_refresh_sec','${sec}');}catch(e){}`);
    }
    syncSharedInvFlagToPage();
    syncSharedGoldFlagToPage();
    syncStatDetailFlagToPage();
    syncAllyPresetFlagToPage();
    syncSquadMercUiFlagToPage();
    syncCollectionRevealFlagToPage();
    syncItemEffDetailFlagToPage();
    syncAllyArrowDmgFlagToPage();
    syncWpnEnPetHitFlagToPage();
    syncPetReevolveFlagToPage();
    syncPledgeJunkEnSellFlagToPage();
    syncCastleLoginFlagToPage();
    syncSuperBlackMarketFlagToPage();
    syncWhScrollEnhanceFlagToPage();
    syncBuyShoutNotifyFlagToPage();
    syncHideOrigPbarFlagToPage();
    syncInvItemSearchFlagToPage();
    syncObelPrideTrackFlagToPage();
    syncSherineWorldCorrectFlagToPage();
    syncSherineGraceNoCdFlagToPage();
    syncUiThrottleFlagToPage();

    // 掉落／經驗／金幣倍率由「修改器」腳本負責

    // 經驗／金幣倍率（301 版內建 afk 腳本、離線掛機皆在頁面跑）
    function injectPageRateMods() { /* 倍率由修改器負責 */ }

    function injectPageTeleportBossMode() {
        const on = !!teleportBossModeEnabled;
        injectPageScript(`(function(){
    try {
        window.__gmTeleportBossModeOn = ${on};
        window.__gmTeleportRingCount = function() {
            try {
                var cnt = 0;
                if (typeof player === 'undefined' || !player) return 0;
                [player.eq && player.eq.ring1, player.eq && player.eq.ring2, player.eq && player.eq.ring3, player.eq && player.eq.ring4]
                    .forEach(function (e) { if (e && e.id === 'acc_116') cnt++; });
                if (player.inv) player.inv.forEach(function (i) {
                    if (i && i.id === 'acc_116') cnt += Math.max(1, i.cnt || 1);
                });
                if (cnt <= 0 && typeof hasTeleportRing === 'function' && hasTeleportRing()) cnt = 1;
                return cnt;
            } catch (e) { return 0; }
        };
        window.__gmTeleportBossModeCond = function() {
            try {
                if (!window.__gmTeleportBossModeOn) return false;
                if (!(window.__gmTeleportRingCount && window.__gmTeleportRingCount() > 0)) return false;
                var tp = document.getElementById('set-teleport');
                if (tp && tp.checked) return false;
                return true;
            } catch (e) { return false; }
        };
        // 用閉包外層 wrapper，勿以 new Function(fn.toString()) 重寫 spawnMob：
        // 301 版 afk-training.js 會先包住 spawnMob（閉包 _origSpawnMob），字串重寫會弄斷引用導致不生怪。
        if (typeof spawnMob === 'function' && !spawnMob.__gmTpBossModePatched) {
            var _origGmSpawnMob = spawnMob;
            function gmTpBossExtraRoll() {
                if (!window.__gmTeleportBossModeCond || !window.__gmTeleportBossModeCond()) return;
                try {
                    var siegeArea = typeof isSiegeArea === 'function' && isSiegeArea(mapState.current);
                    var elderRoom = mapState.current === 'elder_room';
                    var base = siegeArea ? 0.10 : (elderRoom ? 0.05 : 0.01);
                    if (siegeArea && mapState.suppressSiegeBoss) return;
                    // 每顆傳戒多一次 forceBoss 判定（+100% 原機率）；例：2 顆 ≈ 原機率 ×3
                    var rings = window.__gmTeleportRingCount ? window.__gmTeleportRingCount() : 1;
                    for (var i = 0; i < rings; i++) {
                        if (Math.random() < base) mapState.forceBoss = true;
                    }
                } catch (e) {}
            }
            spawnMob = function(idx) {
                gmTpBossExtraRoll();
                return _origGmSpawnMob.apply(this, arguments);
            };
            spawnMob.__gmTpBossModePatched = true;
            spawnMob.__gmTpBossModeOrig = _origGmSpawnMob;
        }
    } catch (e) {}
})();`);
    }

    // 難度係數（50～200%，100=原版）：HP×(係數%)^1.5、怪物輸出傷害×(0.5+0.5×係數%)
    function injectPageDifficultyMods() {
        if (!isFeatureAvailable('difficulty')) return;
        const f = difficultyFactors(effectiveDifficultyM());
        injectPageScript(`(function(){
    try {
        window.__gmDifficulty = { m: ${f.m}, hp: ${f.hp}, dmg: ${f.dmg} };
        window.gmMobDmgOut = function(d) {
            var g = window.__gmDifficulty;
            if (!g || g.dmg === 1 || !d || d <= 0) return d;
            return Math.max(1, Math.floor(d * g.dmg));
        };
        function _gmDiffBase(fn) {
            if (!fn) return fn;
            if (fn.__gmDiffOrig) return fn.__gmDiffOrig;
            return fn;
        }
        function gmRebindFn(name, replaces) {
            if (name === 'tick' || name === 'applyMobMagic' || name === 'applyMobMagicToAlly') return;
            var fn = _gmDiffBase(window[name]);
            if (!fn || fn.__gmDiffPatched) return;
            var src = fn.toString();
            if (fn.__gmUiThrottleWrap || fn.__gmAutobuyWrap) return;
            var sig = src.match(/^function\\s*[^(]*\\(([^)]*)\\)/);
            if (!sig) return;
            var params = sig[1];
            var body = src.replace(/^function[^(]*\\([^)]*\\)\\s*\\{/, '').replace(/\\}\\s*$/, '');
            for (var i = 0; i < replaces.length; i++) {
                body = body.split(replaces[i][0]).join(replaces[i][1]);
            }
            try {
            var nf = new Function(params, body);
            nf.__gmDiffPatched = true;
            nf.__gmDiffOrig = fn;
            window[name] = nf;
            } catch (e) {}
        }
        if (typeof window.__gmInstallDiffMagicHook === 'function') {
            try { window.__gmInstallDiffMagicHook(); } catch (e) {}
        }
        if (!window.__gmDiffHookInstalled) {
            if (typeof applySherineBuff !== 'function' || typeof enemyPhysicalAttack !== 'function'
                || typeof enemyAttackAlly !== 'function' || typeof applyMobMagic !== 'function') return;
            window.__gmDiffHookInstalled = true;
            var _asb = applySherineBuff;
            applySherineBuff = function(idx) {
                var mob = mapState.mobs[idx];
                if (mob && !mob._gmDiffHp) {
                    var g = window.__gmDifficulty;
                    if (g && g.hp !== 1) {
                        mob.hp = Math.max(1, Math.floor(mob.hp * g.hp));
                        mob.curHp = mob.hp;
                        mob._gmDiffHp = true;
                    }
                }
                return _asb.apply(this, arguments);
            };
            applySherineBuff.__gmDiffWrap = true;
            gmRebindFn('enemyPhysicalAttack', [
                ['player.hp -= totalDmg', 'totalDmg=gmMobDmgOut(totalDmg);player.hp-=totalDmg']
            ]);
            gmRebindFn('enemyAttackAlly', [
                ['ally.curHp -= totalDmg', 'totalDmg=gmMobDmgOut(totalDmg);ally.curHp-=totalDmg']
            ]);
            if (typeof window.__gmInstallDiffMagicHook === 'function') {
                try { window.__gmInstallDiffMagicHook(); } catch (e) {}
            }
        }
    } catch (e) {}
})();`);
    }

    // =========================
    // ✔ Chaos 非官方轉載頂欄：降層，讓插件管理介面蓋過它
    // =========================
    let _gmOrigPbarStyleInstalled = false;
    function fixUnofficialRepublishBarLayer() {
        if (!_gmOrigPbarStyleInstalled) {
            _gmOrigPbarStyleInstalled = true;
            try {
                // 原 #_orig_pbar 使用 z-index:2147483647，會蓋住管理介面；降到遊戲之上、插件之下
                GM_addStyle([
                    '#_orig_pbar{z-index:10000!important;}',
                    '#gm-ext-manager-modal{z-index:2147483646!important;}',
                    '#gm-ext-number-prompt-modal{z-index:2147483647!important;}',
                    '#gm-stat-tooltip{z-index:2147483645!important;}'
                ].join(''));
            } catch (e) {}
        }
        try {
            const bar = document.getElementById('_orig_pbar');
            if (bar) bar.style.setProperty('z-index', '10000', 'important');
        } catch (e) {}
    }

    // =========================
    // ✔ 物品欄 UI：方格版（現版）↔ 清單版（C版）
    // =========================
    function installInventoryUiListStyles() {
        GM_addStyle(`
/* 清單版：透明底透出右側 panel(#1e293b)，不疊深色塊、不用背景圖 */
html.gm-inv-list #tab-items,
html.gm-inv-list #tab-weapons,
html.gm-inv-list #tab-armors,
html.gm-inv-list #tab-equip,
html.gm-inv-list .classic-inventory-tab {
    padding: 3px 0 4px 0 !important;
    overflow: hidden !important;
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
}
html.gm-inv-list .classic-inventory-tab:not(.hidden) {
    display: flex !important; flex-direction: column; align-items: stretch;
    flex: 1 1 auto; min-height: 0; gap: 2px !important;
}
html.gm-inv-list .classic-list-toolbar.sticky {
    top: 0 !important; margin-top: 0 !important; padding-top: 0 !important;
    flex: 0 0 auto;
}
html.gm-inv-list .classic-inventory-shell {
    display: contents !important;
    background: none !important;
    background-image: none !important;
}
html.gm-inv-list .classic-inventory-scroll,
html.gm-inv-list .classic-sort-wrap,
html.gm-inv-list .classic-grid-empty { display: none !important; }
html.gm-inv-list .classic-inventory-viewport {
    position: static !important; flex: 1 1 auto; min-height: 0;
    left: auto !important; top: auto !important; width: 100% !important;
    max-height: none !important; height: auto !important;
    display: flex !important; flex-direction: column !important; gap: 5px !important;
    grid-template-columns: unset !important; grid-auto-rows: unset !important;
    align-content: unset !important;
    overflow-y: auto; overflow-x: hidden; box-sizing: border-box;
    margin: 0 !important;
    padding: 0 !important;
    background-color: #0f172a !important;
    background-image: none !important;
    scrollbar-width: thin; scrollbar-color: #d6a638 #17191d;
    overscroll-behavior: contain;
}
html.gm-inv-list .classic-inventory-viewport::-webkit-scrollbar { width: 12px; }
html.gm-inv-list .classic-inventory-viewport::-webkit-scrollbar-track {
    background: rgba(30,41,59,.85); border-left: 1px solid #475569;
}
html.gm-inv-list .classic-inventory-viewport::-webkit-scrollbar-thumb {
    background: linear-gradient(90deg,#69480e,#f1cd59 45%,#8d6519);
    border: 1px solid #f7df86; border-radius: 8px; box-shadow: 0 0 4px #000;
}
/* 物品列：C 版 bg-slate-800（rgb(30 41 59)），覆寫方格版 #090a0d */
html.gm-inv-list .classic-inventory-viewport > .list-item,
html.gm-inv-list #tab-items .list-item,
html.gm-inv-list #tab-weapons .list-item,
html.gm-inv-list #tab-armors .list-item,
html.gm-inv-list #tab-equip .list-item {
    display: flex !important; align-items: center; justify-content: flex-start !important;
    width: 100% !important; height: auto !important; min-height: 48px !important;
    margin: 0 !important; padding: 3px 5px !important;
    border: 0 !important; border-radius: 0 !important;
    background-color: rgb(30 41 59) !important;
    box-shadow: none !important;
    --tw-ring-shadow: 0 0 #0000 !important;
    --tw-ring-offset-shadow: 0 0 #0000 !important;
    opacity: 1 !important;
    cursor: pointer !important;
    transition: background-color 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item.rounded,
html.gm-inv-list .classic-inventory-tab .list-item.rounded {
    border-radius: 0 !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item.bg-slate-900,
html.gm-inv-list .classic-inventory-tab .list-item.bg-slate-900 {
    background-color: rgb(15 23 42) !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item[class*="bg-red-950"],
html.gm-inv-list .classic-inventory-tab .list-item[class*="bg-red-950"] {
    background-color: rgba(69, 10, 10, 0.4) !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item:hover,
html.gm-inv-list #tab-items .list-item:hover,
html.gm-inv-list #tab-weapons .list-item:hover,
html.gm-inv-list #tab-armors .list-item:hover,
html.gm-inv-list #tab-equip .list-item:hover {
    background-color: rgb(51 65 85) !important;
    filter: brightness(1.14) !important;
    box-shadow: inset 0 0 0 1px rgba(212, 175, 55, 0.35) !important;
    border-color: transparent !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item.bg-slate-900:hover,
html.gm-inv-list .classic-inventory-tab .list-item.bg-slate-900:hover {
    background-color: rgb(40 52 72) !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item[class*="bg-red-950"]:hover,
html.gm-inv-list .classic-inventory-tab .list-item[class*="bg-red-950"]:hover {
    background-color: rgba(127, 29, 29, 0.55) !important;
    box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.4) !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item[class*="bg-green-900"]:hover,
html.gm-inv-list .classic-inventory-tab .list-item[class*="bg-green-900"]:hover {
    background-color: rgb(20 83 45) !important;
    box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.45) !important;
}
html.gm-inv-list .classic-inventory-viewport > .list-item[class*="bg-amber-900"]:hover,
html.gm-inv-list .classic-inventory-tab .list-item[class*="bg-amber-900"]:hover {
    background-color: rgb(120 53 15) !important;
    box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.45) !important;
}
html.gm-inv-list .classic-item-main {
    display: grid !important; grid-template-columns: 18% minmax(0,1fr);
    align-items: center; width: 100%; height: 100%; gap: 4%;
    justify-content: unset !important;
}
html.gm-inv-list .classic-icon-box img,
html.gm-inv-list .classic-item-main .classic-icon-box img {
    width: 78% !important; height: 78% !important;
    max-width: 48px; max-height: 48px;
}
html.gm-inv-list .classic-inventory-tab .list-item > .classic-icon-box {
    flex: 0 0 18%; margin-right: 4%;
}
html.gm-inv-list .classic-inventory-tab .list-item .classic-name-box {
    display: flex !important; flex: 1 1 auto;
}
html.gm-inv-list .classic-inventory-tab .list-item input[type="checkbox"] {
    position: static !important; flex: 0 0 auto; margin-right: 3px;
    width: 16px; height: 16px;
}
html.gm-inv-list .classic-inventory-tab .list-item > div {
    position: static !important; width: 100%; min-width: 0;
    display: flex; align-items: center;
}
html.gm-inv-list .classic-item-lock-badge,
html.gm-inv-list .classic-item-junk-label { display: none !important; }
/* 3.2.58+ 圖示右下角數量／強化：清單版名稱已顯示，隱藏避免重複 */
html.gm-inv-list .classic-icon-corner-value { display: none !important; }
html.gm-inv-list .classic-item-junk .classic-icon-box img {
    opacity: 1 !important; filter: none !important;
}
html.gm-inv-list .classic-item-locked .classic-name-box .classic-item-flags::after {
    content: ' [🔒]'; color: #f87171; font-size: 10px; font-weight: bold;
}
html.gm-inv-list .classic-item-junk:not(.classic-item-locked) .classic-name-box .classic-item-flags::after {
    content: ' [廢]'; color: #fbbf24; font-size: 10px; font-weight: bold;
}
        `);
    }

    function injectInventoryUiPageHook() {
        if (_invUiPageHookInstalled) return;
        _invUiPageHookInstalled = true;
        injectPageScript(`(function(){
    if (window.__gmInvUiHookReady) return;
    window.__gmInvUiHookReady = true;
    window.__gmInvUiMode = window.__gmInvUiMode || 'grid';
    function gmDecorateList(div) {
        if (!div) return;
        div.classList.add('classic-inventory-tab');
        var viewport = document.createElement('div');
        viewport.className = 'classic-inventory-viewport';
        Array.from(div.children).filter(function(x) {
            return !x.classList.contains('classic-list-toolbar') && !x.classList.contains('sticky');
        }).forEach(function(x) { viewport.appendChild(x); });
        var quick = Array.from(div.children).find(function(x) { return x.classList.contains('sticky'); });
        if (quick) quick.classList.add('classic-list-toolbar');
        div.appendChild(viewport);
    }
    function install() {
        if (typeof decorateClassicInventoryTab !== 'function') return;
        if (decorateClassicInventoryTab.__gmInvUiRouter) return;
        window.__gmDecorateGrid = decorateClassicInventoryTab;
        var router = function(div) {
            if (window.__gmInvUiMode === 'list') gmDecorateList(div);
            else window.__gmDecorateGrid(div);
        };
        router.__gmInvUiRouter = true;
        decorateClassicInventoryTab = router;
    }
    install();
    var n = 0, t = setInterval(function() { install(); if (++n > 40) clearInterval(t); }, 250);
})();`);
    }

    function applyInventoryUiMode() {
        const mode = effectiveInventoryUiMode();
        const isList = mode === 'list';
        document.documentElement.classList.toggle('gm-inv-list', isList);
        if (!isFeatureAvailable('invUi')) return;
        injectPageScript(`window.__gmInvUiMode='${mode}';try{if(typeof renderTabs==='function')renderTabs(true);}catch(e){}`);
    }

    function applyFullRandomMode() {
        injectPageScript(`(function(){
    window.__gmFullRandomEnabled = ${fullRandomEnabled ? 'true' : 'false'};
    function install() {
        if (typeof lootRng !== 'function') return false;
        if (!window.__gmLootRngToggleInstalled) {
            window.__gmLootRngOriginal = lootRng;
            lootRng = function(tag) {
                if (window.__gmFullRandomEnabled) return Math.random();
                return window.__gmLootRngOriginal(tag);
            };
            window.__gmLootRngToggleInstalled = true;
        }
        if (typeof _dollRng === 'function' && !window.__gmDollRngToggleInstalled) {
            window.__gmDollRngOriginal = _dollRng;
            _dollRng = function(tag, seq) {
                if (window.__gmFullRandomEnabled) return Math.random();
                return window.__gmDollRngOriginal(tag, seq);
            };
            window.__gmDollRngToggleInstalled = true;
        }
        return true;
    }
    if (!install()) {
        var n = 0, t = setInterval(function() {
            if (install() || ++n > 40) clearInterval(t);
        }, 250);
    }
})();`);
    }

    function removeJunkPrefSig(sig) {
        const encoded = JSON.stringify(String(sig || ''));
        injectPageScript(`(function(){
    var sig = ${encoded};
    if (typeof player === 'undefined' || !player) return;
    if (!player.junkPrefs) player.junkPrefs = {};
    delete player.junkPrefs[sig];
    if (Array.isArray(player.inv) && typeof itemSig === 'function') {
        player.inv.forEach(function(i){
            if (!i || itemSig(i) !== sig) return;
            i.junk = false;
            if (i._ruleJunk) { i._userKeep = true; i._ruleJunk = false; }
            delete i.junkSince; delete i._autoSellQty;
        });
    }
    try { if (typeof saveGame === 'function') saveGame(); } catch(e){}
    try { if (typeof renderTabs === 'function') renderTabs(); } catch(e){}
    try { if (typeof updateUI === 'function') updateUI(); } catch(e){}
})();`);
    }

    function refreshExtensionManagerJunkPanel() {
        const qEnc = JSON.stringify(String(_gmemJunkQuery || '').trim().toLowerCase());
        injectPageScript(`(function(){
    function labelOf(sig){
        sig = String(sig || '');
        var p = sig.split('|');
        var id = p[0] || '';
        var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
        var nm = (d && d.n) ? d.n : id;
        var en = Number(p[1] || 0) || 0;
        var bless = p[2], anc = p[3], attr = p[4], seteff = p[5];
        var tags = [];
        if (en > 0) tags.push('+' + en);
        if (bless === 'B') tags.push('祝福'); else if (bless === 'C') tags.push('詛咒');
        if (anc && anc !== '0' && anc !== 'false') tags.push('遠古');
        if (attr) tags.push('屬性:' + attr);
        if (seteff) tags.push('席琳:' + seteff);
        return tags.length ? (nm + '（' + tags.join(' / ') + '）') : nm;
    }
    function esc(s){
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    var panel = document.querySelector('#gm-ext-manager-modal .gmem-junk-list');
    var clearBtn = document.querySelector('#gm-ext-manager-modal .gmem-junk-clear');
    var q = ${qEnc};
    if (clearBtn) clearBtn.classList.toggle('show', !!q);
    if (!panel) return;
    if (typeof player === 'undefined' || !player) {
        panel.innerHTML = '<div class="gmem-junk-muted">無法讀取玩家資料</div>';
        return;
    }
        if (!player.junkPrefs) player.junkPrefs = {};
        var keys = Object.keys(player.junkPrefs).filter(function(k){ return !!player.junkPrefs[k]; })
            .sort(function(a,b){ return labelOf(a).localeCompare(labelOf(b), 'zh-Hant'); });
    var total = keys.length;
    if (q) {
        keys = keys.filter(function(sig){
            var lb = labelOf(sig).toLowerCase();
            return lb.indexOf(q) >= 0 || String(sig).toLowerCase().indexOf(q) >= 0;
        });
    }
    if (!total) {
        panel.innerHTML = '<div class="gmem-junk-muted">目前沒有廢品記憶</div>';
        return;
    }
    if (!keys.length) {
        panel.innerHTML = '<div class="gmem-junk-muted">找不到符合「' + esc(q) + '」的廢品記憶</div>';
        return;
    }
    panel.innerHTML = keys.map(function(sig){
        return '<div class="gmem-junk-row"><span>' + esc(labelOf(sig)) + '</span><button type="button" data-junk-remove="' + encodeURIComponent(sig) + '">刪除</button></div>';
    }).join('');
})();`);
    }

    function openJunkPrefsManagerMenu() {
        openExtensionManagerModal('junk');
    }

    let _gmemJunkQuery = '';
    let _gmemDexQuery = '';
    let _gmemDexRelicQuery = '';
    let _gmemDexShinQuery = '';
    let _gmemDexDollQuery = '';
    let _gmemDexScroll = 0;
    let _gmemDexRelicScroll = 0;
    let _gmemDexShinScroll = 0;
    let _gmemDexDollScroll = 0;
    let _gmemDexRelicCls = 'all';
    let _gmemDexShinCls = 'all';
    let _gmemDexDollCls = 'all';
    let _gmemDexDataSrc = 'current';
    let _gmemDexMode = 'drop';

    function gmemDexSrcLabel(src) {
        return src === 'original' ? '原始資料' : '當前難度';
    }

    function gmemDexQueryForMode(mode) {
        if (mode === 'relic') return _gmemDexRelicQuery;
        if (mode === 'shin') return _gmemDexShinQuery;
        if (mode === 'doll') return _gmemDexDollQuery;
        return _gmemDexQuery;
    }

    function setGmemDexQueryForMode(mode, val) {
        if (mode === 'relic') _gmemDexRelicQuery = val;
        else if (mode === 'shin') _gmemDexShinQuery = val;
        else if (mode === 'doll') _gmemDexDollQuery = val;
        else _gmemDexQuery = val;
    }

    function gmemDexScrollForMode(mode) {
        if (mode === 'relic') return _gmemDexRelicScroll;
        if (mode === 'shin') return _gmemDexShinScroll;
        if (mode === 'doll') return _gmemDexDollScroll;
        return _gmemDexScroll;
    }

    function setGmemDexScrollForMode(mode, val) {
        const n = Math.max(0, Number(val) || 0);
        if (mode === 'relic') _gmemDexRelicScroll = n;
        else if (mode === 'shin') _gmemDexShinScroll = n;
        else if (mode === 'doll') _gmemDexDollScroll = n;
        else _gmemDexScroll = n;
    }

    function gmemDexClsForMode(mode) {
        if (mode === 'relic') return _gmemDexRelicCls || 'all';
        if (mode === 'shin') return _gmemDexShinCls || 'all';
        if (mode === 'doll') return _gmemDexDollCls || 'all';
        return 'all';
    }

    function setGmemDexClsForMode(mode, val) {
        const cls = val || 'all';
        if (mode === 'relic') _gmemDexRelicCls = cls;
        else if (mode === 'shin') _gmemDexShinCls = cls;
        else if (mode === 'doll') _gmemDexDollCls = cls;
    }

    function captureGmemDexState(el) {
        if (!el) return;
        const panel = el.querySelector('.gmem-dex-panel');
        const input = el.querySelector('.gmem-dex-input');
        const srcBtn = el.querySelector('.gmem-dex-src-btn');
        const scroll = el.querySelector('.gmem-dex-scroll');
        const activeCls = el.querySelector('.gmem-dex-cls.is-active');
        const raw = panel ? panel.getAttribute('data-mode') : '';
        const mode = (raw === 'relic' || raw === 'shin' || raw === 'doll') ? raw : 'drop';
        _gmemDexMode = mode;
        if (input) setGmemDexQueryForMode(mode, input.value);
        if (scroll) setGmemDexScrollForMode(mode, scroll.scrollTop);
        if (activeCls && (mode === 'relic' || mode === 'shin' || mode === 'doll')) {
            setGmemDexClsForMode(mode, activeCls.getAttribute('data-cls') || 'all');
        }
        if (srcBtn) _gmemDexDataSrc = srcBtn.getAttribute('data-src') === 'original' ? 'original' : 'current';
    }

    function syncGmGmemDexPanel(opts) {
        installGmGmemDexEngine();
        const focus = !!(opts && opts.focus);
        const el = document.getElementById('gm-ext-manager-modal');
        const panel = el && el.querySelector('.gmem-dex-panel');
        const mode = (_gmemDexMode === 'relic' || _gmemDexMode === 'shin' || _gmemDexMode === 'doll') ? _gmemDexMode : 'drop';
        if (panel) {
            panel.setAttribute('data-mode', mode);
            const input = panel.querySelector('.gmem-dex-input');
            if (input) input.value = gmemDexQueryForMode(mode);
        }
        const payload = JSON.stringify({
            mode: mode,
            drop: _gmemDexQuery,
            relic: _gmemDexRelicQuery,
            shin: _gmemDexShinQuery,
            doll: _gmemDexDollQuery,
            dropScroll: _gmemDexScroll,
            relicScroll: _gmemDexRelicScroll,
            shinScroll: _gmemDexShinScroll,
            dollScroll: _gmemDexDollScroll,
            relicCls: _gmemDexRelicCls,
            shinCls: _gmemDexShinCls,
            dollCls: _gmemDexDollCls,
            focus: focus
        });
        injectPageScript('(function(){ if (window.__gmGmemDex) window.__gmGmemDex.syncPanel(' + payload + '); })();');
    }

    function refreshGmemCatalogButtons() {
        installGmGmemDexEngine();
        injectPageScript('(function(){ if (window.__gmGmemDex && window.__gmGmemDex.syncCatalogBtns) window.__gmGmemDex.syncCatalogBtns(); })();');
    }

    function installGmGmemDexEngine() {
        const GMEM_DEX_VER = 5;
        if (installGmGmemDexEngine._ver === GMEM_DEX_VER) return;
        installGmGmemDexEngine._ver = GMEM_DEX_VER;
        injectPageScript(`(function(){
    var GMEM_DEX_VER = ${GMEM_DEX_VER};
    if (window.__gmGmemDex && window.__gmGmemDex.ver === GMEM_DEX_VER) return;
    var MAX_RESULTS = 60, SEARCH_DEBOUNCE_MS = 150, ITEM_MATCH_MAX = 24;
    var INDEX = [], ITEM_INDEX = [], RELIC_INDEX = [], SHIN_INDEX = [], DOLL_INDEX = [], DROPPED_SET = {}, _searchTimer = null, _ready = false;
    var _craftIndex = null, _craftMatIndex = null, _npcInfo = null, _trialBy = null, _shopIndex = null, _boxBy = null;
    var _dropQueryCache = '', _relicQueryCache = '', _shinQueryCache = '', _dollQueryCache = '';
    var _dropScrollCache = 0, _relicScrollCache = 0, _shinScrollCache = 0, _dollScrollCache = 0;
    var _relicClsCache = 'all', _shinClsCache = 'all', _dollClsCache = 'all';
    var CLS_FILTERS = [
        { id: 'all', label: '全部' },
        { id: 'royal', label: '王族' },
        { id: 'knight', label: '騎士' },
        { id: 'mage', label: '法師' },
        { id: 'elf', label: '妖精' },
        { id: 'dark', label: '黑暗妖精' },
        { id: 'illusion', label: '幻術士' },
        { id: 'dragon', label: '龍騎士' },
        { id: 'warrior', label: '戰士' }
    ];
    var DOLL_TIER_FILTERS = [
        { id: 'all', label: '全部' },
        { id: '1', label: '一階' },
        { id: '2', label: '二階' },
        { id: '3', label: '三階' },
        { id: '4', label: '四階' },
        { id: '5', label: '五階' },
        { id: '6', label: '六階' }
    ];
    var DOLL_TIER_CN = { 1: '一階', 2: '二階', 3: '三階', 4: '四階', 5: '五階', 6: '六階' };
    var ELE = { fire: '🔥 火', water: '💧 水', earth: '🪨 地', wind: '🌪 風', none: '無' };
    var _CLS_CN = { knight: '騎士', mage: '法師', elf: '妖精', dark: '黑暗妖精', illusion: '幻術士', dragon: '龍騎士', warrior: '戰士', royal: '王族' };
    var SPECIAL_BLOCKS = [
        { id: 'dropmult', title: '🔮 掉落倍率：修改器 × 席琳的世界 ×3／瘋狂 ×5／恩賜怪 ×10', keys: ['掉落倍率', '倍率', '席琳的世界', '瘋狂的席琳世界', '經典模式', '恩賜怪', '恩賜'], lines: [
            '<b>怎麼算</b>：原版掉落機率 × 修改器掉落倍率 × 席琳倍率。例：原版 1%、修改器 5 倍、席琳世界 → 1% × 5 × 3 = 15%',
            '<b>「當前難度」顯示</b>：已把修改器與席琳倍率算進去的機率（方便對照實際掉落）',
            '<b>席琳倍率</b>：席琳的世界 ×3、瘋狂的席琳世界 ×5；怪物卡只吃修改器倍率，不吃席琳',
            '<b>例外</b>：任務／誘捕等本來就 100% 必掉的，不會再被倍率提高',
            '<b>恩賜怪</b>：席琳世界裡偶爾出現的強化怪，該隻掉落再 ×10。一般席琳預設每 3 分鐘最多一隻；修改器可關閉冷卻並允許多隻同時出現'
        ] },
        { id: 'statmult', title: '⚔️ 怪物數值：難度切換含修改器與席琳', keys: ['HP', '經驗', '金幣', '難度係數', '席琳補正', '怪物數值'], lines: [
            '<b>「當前難度」數值</b>：已套用修改器經驗／金幣倍率、難度係數（係數愈高怪愈肉、打愈痛）、以及席琳世界強化（血盟怪除外）',
            '<b>席琳世界</b>：HP×3、經驗／金幣×5、MR×1.5、命中×1.5、輸出傷害×2；防禦變硬（AC−10，頭目−20）、減傷提高（DR＋等級÷3）。若開啟「席琳補正」則 AC／DR 維持原樣',
            '<b>瘋狂席琳</b>：HP×5、經驗／金幣×10、MR×3、命中×2、輸出傷害×3',
            '<b>恩賜怪</b>：席琳世界裡偶爾出現的強化怪，該隻 HP／經驗／金幣再 ×10。一般席琳預設每 3 分鐘最多一隻'
        ] },
        { id: 'panacea', title: '🧪 萬能藥（屬性藥）', keys: ['萬能藥', '屬性藥'], lines: ['條件：怪物等級 40 以上、且不是血盟', '一般怪 0.01%、頭目 1%，掉落時隨機給六屬性萬能藥之一（再 × 修改器掉落倍率）'] },
        { id: 'mobcard', title: '🎴 怪物卡片（普／銀／金卡）', keys: ['怪物卡片', '普卡', '銀卡', '金卡', '卡片'], lines: [
            '條件：該怪有卡片圖鑑（血盟／建築除外）；三階各自獨立判定',
            '普卡 0.1%、銀卡 0.01%、金卡 0.001%（再 × 修改器掉落倍率）',
            '不吃席琳／恩賜／經典模式倍率；會吃修改器掉落倍率'
        ] },
        { id: 'sherine', title: '🔮 席琳結晶（席琳的世界限定）', keys: ['席琳結晶'], lines: ['條件：開啟「席琳的世界」後，被席琳化的怪掉（血盟怪、等級 20 以下不掉）', '會吃修改器掉落倍率；瘋狂席琳再 ×3'] },
        { id: 'areadrop', title: '🌿 區域額外掉落', keys: ['米索莉', '精靈玉', '元素石'], lines: ['妖精森林周邊、眠龍洞穴 1~3 樓：粗糙的米索莉塊／精靈玉／元素石 各 20%（再 × 修改器掉落倍率／席琳）'] }
    ];
  var SPECIAL_BY_ID = {}; SPECIAL_BLOCKS.forEach(function(b){ SPECIAL_BY_ID[b.id] = b; });
    function mapNameOf(id) {
        try {
            if (window.AFK_EXTRA && AFK_EXTRA.mapNameWithRegion) return AFK_EXTRA.mapNameWithRegion(id);
            if (window.AFK_EXTRA && AFK_EXTRA.mapName) return AFK_EXTRA.mapName(id);
        } catch(e){}
        try {
            if (!id || typeof id !== 'string') return id || '?';
            if (id === 'afk_dummy') return '木人場';
            if (id === 'windwood_dungeon') return '風木地監';
            if (id === 'oblivion_island') return '遺忘之島';
            if (id === 'oblivion_travel') return '遺忘之島途中';
            if (id === 'rift_battle') return '時空裂痕';
            if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES[id]) return HIDDEN_AREA_NAMES[id];
            var pf = /^pride_f(\\d+)$/.exec(id); if (pf) return '傲慢之塔 ' + pf[1] + ' 樓';
            var pr = /^pride_(\\d+)_(\\d+)$/.exec(id); if (pr) return '傲慢之塔 ' + pr[1] + '~' + pr[2] + ' 樓（直接挑戰）';
            if (typeof MAP_CATEGORIES !== 'undefined') {
                for (var c in MAP_CATEGORIES) { var l = MAP_CATEGORIES[c]; for (var i = 0; i < l.length; i++) if (l[i].v === id) return l[i].t; }
            }
            if (typeof SIEGE_CITY !== 'undefined') {
                for (var k in SIEGE_CITY) { var s = SIEGE_CITY[k]; if (s.outer === id) return s.outerName; if (s.inner === id) return s.innerName; if (s.castle === id) return s.castleName; }
            }
            if (typeof DB !== 'undefined' && DB.towns && DB.towns[id]) return DB.towns[id].n;
            if (typeof MAP_REGIONS !== 'undefined') {
                for (var ri = 0; ri < MAP_REGIONS.length; ri++) {
                    var r = MAP_REGIONS[ri], ms = r.maps || [];
                    for (var mj = 0; mj < ms.length; mj++) if (ms[mj].v === id) return ms[mj].t;
                }
            }
        } catch(e){}
        return id;
    }
    function itemNameOf(id) { return (DB.items[id] && DB.items[id].n) ? DB.items[id].n : id; }
    function trialClassNote(id) { try { if (typeof TRIAL_ITEM_CLASS !== 'undefined' && TRIAL_ITEM_CLASS[id]) { var c = TRIAL_ITEM_CLASS[id]; var a = (Array.isArray(c) ? c : [c]).map(function(x){ return _CLS_CN[x] || x; }); return '🔒僅' + a.join('／'); } } catch(e){} return null; }
    function esc(s) { return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    function hl(text, q) { var s = esc(text); if (!q) return s; var eq = esc(q); if (!eq) return s; var low = s.toLowerCase(), elow = eq.toLowerCase(), out = '', i = 0, idx; while ((idx = low.indexOf(elow, i)) >= 0) { out += s.slice(i, idx) + '<mark class="gmem-dex-hl">' + s.slice(idx, idx + eq.length) + '</mark>'; i = idx + eq.length; } return out + s.slice(i); }
    function fmt(n) { try { return (n == null ? '-' : Number(n).toLocaleString()); } catch(e) { return '' + n; } }
    function fmtPct(p) { if (p > 0 && p < 0.00005) return '<0.0001'; return p < 0.01 ? (p < 0.001 ? p.toFixed(4) : p.toFixed(3)) : (p < 1 ? p.toFixed(2) : (Number.isInteger(p) ? '' + p : p.toFixed(1))); }
    function st(k, v) { return '<span class="gmem-dex-stat"><b>' + k + '</b> ' + esc(v) + '</span>'; }
    function panelRoot() { return document.getElementById('gm-ext-manager-modal'); }
    function panelEl() { var r = panelRoot(); return r ? r.querySelector('.gmem-dex-panel') : null; }
    function panelInput() { var r = panelRoot(); return r ? r.querySelector('.gmem-dex-input') : null; }
    function panelResults() { var r = panelRoot(); return r ? r.querySelector('.gmem-dex-results') : null; }
    function panelScroll() { var r = panelRoot(); return r ? r.querySelector('.gmem-dex-scroll') : null; }
    function panelDataSource() { var r = panelRoot(); var b = r ? r.querySelector('.gmem-dex-src-btn') : null; return (b && b.getAttribute('data-src') === 'original') ? 'original' : 'current'; }
    function panelMode() {
        var p = panelEl();
        var m = p ? p.getAttribute('data-mode') : '';
        return (m === 'relic' || m === 'shin' || m === 'doll') ? m : 'drop';
    }
    function queryCacheFor(mode) {
        if (mode === 'relic') return _relicQueryCache;
        if (mode === 'shin') return _shinQueryCache;
        if (mode === 'doll') return _dollQueryCache;
        return _dropQueryCache;
    }
    function setQueryCache(mode, q) {
        if (mode === 'relic') _relicQueryCache = q || '';
        else if (mode === 'shin') _shinQueryCache = q || '';
        else if (mode === 'doll') _dollQueryCache = q || '';
        else _dropQueryCache = q || '';
    }
    function scrollCacheFor(mode) {
        if (mode === 'relic') return _relicScrollCache;
        if (mode === 'shin') return _shinScrollCache;
        if (mode === 'doll') return _dollScrollCache;
        return _dropScrollCache;
    }
    function setScrollCache(mode, top) {
        var n = Math.max(0, Number(top) || 0);
        if (mode === 'relic') _relicScrollCache = n;
        else if (mode === 'shin') _shinScrollCache = n;
        else if (mode === 'doll') _dollScrollCache = n;
        else _dropScrollCache = n;
    }
    function saveCurrentModeState() {
        var mode = panelMode();
        var input = panelInput();
        var scroll = panelScroll();
        if (input) setQueryCache(mode, input.value);
        if (scroll) setScrollCache(mode, scroll.scrollTop);
    }
    function restoreScroll(mode) {
        var scroll = panelScroll();
        if (!scroll) return;
        var top = scrollCacheFor(mode);
        scroll.scrollTop = top;
        requestAnimationFrame(function(){ scroll.scrollTop = top; });
    }
    function isItemRelic(d) {
        try {
            if (typeof isRelic === 'function') return !!isRelic(d);
            return !!(d && d.relic);
        } catch(e) { return !!(d && d.relic); }
    }
    function isItemShin(d) { return !!(d && d.slot === 'shin'); }
    function isItemDoll(d) { return !!(d && d.slot === 'doll'); }
    function hasRelics() { return RELIC_INDEX.length > 0; }
    function hasShins() { return SHIN_INDEX.length > 0; }
    function hasDolls() { return DOLL_INDEX.length > 0; }
    function catalogClsFor(mode) {
        if (mode === 'relic') return _relicClsCache || 'all';
        if (mode === 'shin') return _shinClsCache || 'all';
        if (mode === 'doll') return _dollClsCache || 'all';
        return 'all';
    }
    function setCatalogCls(mode, cls) {
        var v = cls || 'all';
        if (mode === 'relic') _relicClsCache = v;
        else if (mode === 'shin') _shinClsCache = v;
        else if (mode === 'doll') _dollClsCache = v;
    }
    function itemMatchesClass(req, cls) {
        if (!cls || cls === 'all') return true;
        if (!req || req === 'all') return true;
        var parts = String(req).split(',');
        for (var i = 0; i < parts.length; i++) if (parts[i].trim() === cls) return true;
        return false;
    }
    function itemMatchesDollTier(tier, cls) {
        if (!cls || cls === 'all') return true;
        return String(tier || 0) === String(cls);
    }
    function refreshClsBarButtons() {
        var panel = panelEl(); if (!panel) return;
        var bar = panel.querySelector('.gmem-dex-clsbar');
        if (!bar) return;
        var mode = panelMode();
        var filters = (mode === 'doll') ? DOLL_TIER_FILTERS : CLS_FILTERS;
        var cur = catalogClsFor(mode);
        bar.innerHTML = filters.map(function(f) {
            return '<button type="button" class="gmem-dex-cls' + (f.id === cur ? ' is-active' : '') + '" data-cls="' + f.id + '">' + f.label + '</button>';
        }).join('');
    }
    function updateClsBarUI() {
        var panel = panelEl(); if (!panel) return;
        var bar = panel.querySelector('.gmem-dex-clsbar');
        if (!bar) return;
        refreshClsBarButtons();
    }
    function stripHtml(s) {
        return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\\s+/g, ' ').trim();
    }
    function catalogItemHay(id, d) {
        var parts = [d.n || '', d.d || ''];
        try {
            if (typeof buildItemDescHTML === 'function') {
                parts.push(buildItemDescHTML({ id: id, en: 0 }));
            }
        } catch(e){}
        var keys = [
            ['str', '力量 STR'], ['dex', '敏捷 DEX'], ['con', '體質 CON'], ['int', '智力 INT'], ['wis', '精神 WIS'], ['cha', '魅力 CHA'],
            ['mhp', 'HP上限'], ['mmp', 'MP上限'], ['hpR', 'HP恢復'], ['mpR', 'MP恢復'],
            ['ac', '防禦 AC'], ['mr', '魔防 MR'], ['dr', '傷害減免 減免'], ['er', '迴避 ER'],
            ['hit', '命中'], ['dmgBonus', '傷害'], ['extraDmg', '額外傷害'], ['meleeDmg', '近距離傷害'], ['rangedDmg', '遠距離傷害'],
            ['meleeHit', '近距離命中'], ['rangedHit', '遠距離命中'], ['mdmg', '魔法傷害'],
            ['resFire', '火屬性抗性 火'], ['resWater', '水屬性抗性 水'], ['resWind', '風屬性抗性 風'], ['resEarth', '地屬性抗性 地'],
            ['immPoison', '免疫中毒'], ['immParalyze', '免疫麻痺'], ['immStone', '免疫石化'],
            ['thorns', '反傷'], ['crushDr', '重擊減免 減免'], ['safe', '安定值'], ['relic', '遺物'], ['legend', '傳說']
        ];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i][0], label = keys[i][1];
            if (d[k] != null && d[k] !== false && d[k] !== 0) parts.push(label + ' ' + d[k]);
            else if (d[k] === true) parts.push(label);
        }
        if (d.slot === 'shin') parts.push('脛甲');
        if (d.slot === 'doll') {
            parts.push('魔法娃娃 娃娃');
            if (d.dollTier) parts.push((DOLL_TIER_CN[d.dollTier] || '') + '魔法娃娃');
        }
        if (d.armguard) parts.push('臂甲');
        if (d.noEnhance) parts.push('無法強化');
        if (d.req) {
            parts.push('適用職業 ' + d.req);
            if (d.req === 'all') {
                for (var ci = 0; ci < CLS_FILTERS.length; ci++) if (CLS_FILTERS[ci].id !== 'all') parts.push(CLS_FILTERS[ci].label);
            } else {
                String(d.req).split(',').forEach(function(c){
                    var id = c.trim();
                    if (_CLS_CN[id]) parts.push(_CLS_CN[id]);
                });
            }
        }
        return stripHtml(parts.join(' ')).toLowerCase();
    }
    function catalogQueryMatch(hay, q) {
        if (!q) return true;
        var parts = q.split(/\\s+/).filter(Boolean);
        if (!parts.length) return true;
        for (var i = 0; i < parts.length; i++) if (hay.indexOf(parts[i]) < 0) return false;
        return true;
    }
    function rebuildCatalogIndexes() {
        RELIC_INDEX = []; SHIN_INDEX = []; DOLL_INDEX = [];
        if (typeof DB === 'undefined' || !DB || !DB.items) return false;
        for (var iid in DB.items) {
            var d = DB.items[iid]; if (!d || !d.n) continue;
            var hay = catalogItemHay(iid, d);
            var entry = { id: iid, n: d.n, hay: hay, req: d.req || 'all' };
            if (isItemRelic(d)) RELIC_INDEX.push(entry);
            if (isItemShin(d)) SHIN_INDEX.push({ id: iid, n: d.n, hay: hay, req: d.req || 'all' });
            if (isItemDoll(d)) DOLL_INDEX.push({ id: iid, n: d.n, hay: hay, tier: d.dollTier || 0 });
        }
        var sortFn = function(a, b){ try { return a.n.localeCompare(b.n, 'zh-Hant'); } catch(e) { return a.n.localeCompare(b.n); } };
        RELIC_INDEX.sort(sortFn);
        SHIN_INDEX.sort(sortFn);
        DOLL_INDEX.sort(function(a, b) {
            return (a.tier || 0) - (b.tier || 0) || sortFn(a, b);
        });
        return true;
    }
    function updateCatalogBtns() {
        var root = panelRoot(); if (!root) return;
        var relicTop = root.querySelector('.gmem-relic-btn');
        var shinTop = root.querySelector('.gmem-shin-btn');
        var dollTop = root.querySelector('.gmem-doll-btn');
        if (relicTop) relicTop.style.display = hasRelics() ? '' : 'none';
        if (shinTop) shinTop.style.display = hasShins() ? '' : 'none';
        if (dollTop) dollTop.style.display = hasDolls() ? '' : 'none';
    }
    function updateModeUI() {
        var panel = panelEl(); if (!panel) return;
        var mode = panelMode();
        updateCatalogBtns();
        if (mode === 'relic' && !hasRelics()) { panel.setAttribute('data-mode', 'drop'); mode = 'drop'; }
        if (mode === 'shin' && !hasShins()) { panel.setAttribute('data-mode', 'drop'); mode = 'drop'; }
        if (mode === 'doll' && !hasDolls()) { panel.setAttribute('data-mode', 'drop'); mode = 'drop'; }
        var input = panelInput();
        if (input) {
            if (mode === 'relic' || mode === 'shin' || mode === 'doll') input.placeholder = '搜尋名稱／屬性／說明關鍵字…';
            else input.placeholder = '搜尋 怪物 / 地圖 / 掉落物…';
        }
        var srcBtn = panel.querySelector('.gmem-dex-src-btn');
        if (srcBtn) srcBtn.style.display = (mode === 'relic' || mode === 'shin' || mode === 'doll') ? 'none' : '';
        var special = panel.querySelector('.gmem-dex-special-wrap');
        if (special) special.style.display = (mode === 'relic' || mode === 'shin' || mode === 'doll') ? 'none' : '';
        var clsbar = panel.querySelector('.gmem-dex-clsbar');
        if (clsbar) clsbar.style.display = (mode === 'relic' || mode === 'shin' || mode === 'doll') ? '' : 'none';
        updateClsBarUI();
    }
    function syncCatalogBtns() {
        rebuildCatalogIndexes();
        updateCatalogBtns();
    }
    function sherineDropMult() {
        try {
            if (typeof player === 'undefined' || !player) return 1;
            if (player.sherineMad) return 5;
            if (player.sherineWorld) return 3;
        } catch(e){}
        return 1;
    }
    function sherineDropLabel() {
        var m = sherineDropMult();
        if (m >= 5) return '席琳×5';
        if (m >= 3) return '席琳×3';
        return '';
    }
    function gmDropMultLabel() {
        var m = window.__gmDropMult || 1;
        if (!m || m === 1) return '';
        var s = (Math.abs(m - Math.round(m)) < 0.0001) ? String(Math.round(m)) : String(m);
        return '修改×' + s;
    }
    function fmtMult(m) {
        return (Math.abs(m - Math.round(m)) < 0.0001) ? String(Math.round(m)) : String(m);
    }
    function sherineWorldActive() {
        try {
            if (typeof player === 'undefined' || !player) return false;
            return !!(player.sherineWorld || player.sherineMad);
        } catch(e) { return false; }
    }
    function sherineMadActive() {
        try { return !!(typeof player !== 'undefined' && player && player.sherineMad); } catch(e) { return false; }
    }
    function sherineWorldLabel() {
        if (sherineMadActive()) return '瘋狂席琳';
        if (sherineWorldActive()) return '席琳世界';
        return '';
    }
    function sherineCorrectOn() {
        if (window.__gmSherineWorldCorrectOn === true) return true;
        if (window.__gmSherineWorldCorrectOn === false) return false;
        try { return localStorage.getItem('gm_sherine_world_correct_enabled') === '1'; } catch(e) { return false; }
    }
    function gmMobExpBase(mobId, mob) {
        var cache = window.__gmMobExpBase;
        if (cache && Object.prototype.hasOwnProperty.call(cache, mobId) && typeof cache[mobId] === 'number') return cache[mobId];
        var exp = mob && typeof mob.exp === 'number' ? mob.exp : 0;
        var mult = (window.__gmRates && window.__gmRates.mobExp) || 1;
        return (mult !== 1 && exp > 0) ? Math.floor(exp / mult) : exp;
    }
    function origMobStats(mobId, mob) {
        var goldMin = mob.goldMin, goldMax = mob.goldMax;
        if (goldMin == null && mob.lv) goldMin = mob.lv * 5;
        if (goldMax == null && mob.lv) goldMax = mob.lv * 10;
        return {
            hp: mob.hp,
            exp: gmMobExpBase(mobId, mob),
            goldMin: goldMin,
            goldMax: goldMax,
            dmg: mob.dmg ? [mob.dmg[0], mob.dmg[1]] : null,
            hit: mob.hit,
            ac: mob.ac,
            mr: mob.mr,
            dr: mob.dr || 0
        };
    }
    function currentMobStats(mobId, mob) {
        var s = origMobStats(mobId, mob);
        var diff = window.__gmDifficulty;
        if (diff && diff.hp !== 1) s.hp = Math.max(1, Math.floor(s.hp * diff.hp));
        var mobExpMult = (window.__gmRates && window.__gmRates.mobExp) || 1;
        if (mobExpMult !== 1 && s.exp > 0) {
            var maxExp = 99999999;
            s.exp = Math.min(maxExp, Math.floor(s.exp * mobExpMult));
        }
        if (diff && diff.dmg !== 1 && s.dmg) {
            s.dmg[0] = Math.max(1, Math.floor(s.dmg[0] * diff.dmg));
            s.dmg[1] = Math.max(1, Math.floor(s.dmg[1] * diff.dmg));
        }
        if (mob.race !== '血盟' && sherineWorldActive()) {
            var mad = sherineMadActive();
            var hpM = mad ? 5 : 3, rewM = mad ? 10 : 5, mrM = mad ? 3 : 1.5, hitM = mad ? 2 : 1.5, dmgM = mad ? 3 : 2;
            s.hp = Math.floor(s.hp * hpM);
            s.exp = Math.floor(s.exp * rewM);
            s.goldMin = Math.floor((s.goldMin || 0) * rewM);
            s.goldMax = Math.floor((s.goldMax || 0) * rewM);
            s.mr = Math.floor((s.mr || 0) * mrM);
            s.hit = Math.floor((s.hit || 0) * hitM);
            if (!sherineCorrectOn()) {
                s.ac = (s.ac || 0) - (mob.boss ? 20 : 10);
                s.dr = (s.dr || 0) + Math.floor((mob.lv || 1) / 3);
            }
            if (s.dmg) {
                s.dmg[0] = Math.floor(s.dmg[0] * dmgM);
                s.dmg[1] = Math.floor(s.dmg[1] * dmgM);
            }
        }
        var goldMult = (window.__gmRates && window.__gmRates.gold) || 1;
        if (goldMult !== 1) {
            s.goldMin = Math.floor((s.goldMin || 0) * goldMult);
            s.goldMax = Math.floor((s.goldMax || 0) * goldMult);
        }
        return s;
    }
    function mobStatsForDisplay(h, useCurrent) {
        return useCurrent ? currentMobStats(h.id, h.mob) : origMobStats(h.id, h.mob);
    }
    function gmMobExpMultLabel() {
        var m = (window.__gmRates && window.__gmRates.mobExp) || 1;
        if (!m || m === 1) return '';
        return '經驗×' + fmtMult(m);
    }
    function gmGoldMultLabel() {
        var m = (window.__gmRates && window.__gmRates.gold) || 1;
        if (!m || m === 1) return '';
        return '金幣×' + fmtMult(m);
    }
    function gmDifficultyLabel() {
        var g = window.__gmDifficulty;
        if (!g || g.m === 1) return '';
        return '難度' + Math.round(g.m * 100) + '%';
    }
    function statModeLabel(useCurrent) {
        if (!useCurrent) return '';
        var parts = ['當前難度'];
        var sw = sherineWorldLabel(); if (sw) parts.push(sw);
        var me = gmMobExpMultLabel(); if (me) parts.push(me);
        var gl = gmGoldMultLabel(); if (gl) parts.push(gl);
        var df = gmDifficultyLabel(); if (df) parts.push(df);
        if (sherineCorrectOn() && sherineWorldActive()) parts.push('席琳補正');
        return '（' + parts.join('·') + '）';
    }
    function gmDropMultForItem(itemId) {
        var m = window.__gmDropMult || 1;
        if (!m || m === 1) return 1;
        return m;
    }
    function isCardDropItem(itemId) {
        try {
            var d = DB.items[itemId];
            return !!(d && (d.eff === 'card' || String(itemId).indexOf('card_') === 0));
        } catch (e) { return false; }
    }
    function dropPctDisplay(d, useCurrent) {
        var orig = d[4];
        if (!useCurrent) {
            if (orig > 100) return 100;
            return orig;
        }
        // 怪物卡：吃修改器掉落倍率，不吃席琳
        var pct = isCardDropItem(d[0])
            ? (orig * gmDropMultForItem(d[0]))
            : (orig * gmDropMultForItem(d[0]) * sherineDropMult());
        if (pct > 100) pct = 100;
        return pct;
    }
    function updateSrcBtn() {
        var btn = panelRoot() && panelRoot().querySelector('.gmem-dex-src-btn');
        if (!btn) return;
        var src = panelDataSource();
        btn.setAttribute('data-src', src);
        btn.textContent = src === 'original' ? '原始資料' : '當前難度';
    }
    function origDropPct(tableName, mobName, itemId, index, currentPct) {
        var key = tableName + '|' + mobName + '|' + itemId + '|' + index;
        if (window.__gmDropRatesOriginal && Object.prototype.hasOwnProperty.call(window.__gmDropRatesOriginal, key)) return window.__gmDropRatesOriginal[key];
        var mult = window.__gmDropMult || 1;
        return mult ? (currentPct / mult) : currentPct;
    }
    function dropsFromTable(tableName, table, mobName) {
        var list = table ? table[mobName] : null;
        if (!list) return [];
        return list.map(function(e, index) {
            var cur = e[1];
            return [e[0], cur, origDropPct(tableName, mobName, e[0], index, cur), trialClassNote(e[0])];
        });
    }
    function buildIndexes() {
        if (_ready) return true;
        if (typeof DB === 'undefined' || !DB || !DB.mobs || !DB.maps || !DB.items || typeof MOB_DROPS === 'undefined') {
            rebuildCatalogIndexes();
            return false;
        }
        INDEX = []; ITEM_INDEX = []; DROPPED_SET = {};
        rebuildCatalogIndexes();
        if (_craftIndex === null) try { buildCraftIndex(); } catch (e) {}
        var mobToMaps = {};
        for (var mid in DB.maps) (DB.maps[mid] || []).forEach(function(mob){ (mobToMaps[mob] = mobToMaps[mob] || []).push(mid); });
        function cardDropsForMob(mobName, mobObj) {
            var out = [];
            try {
                if (!mobName || !mobObj) return out;
                if (mobObj.race === '血盟' || mobObj.race === '建築') return out;
                if (typeof CARD_MOB_INFO === 'undefined' || !CARD_MOB_INFO[mobName]) return out;
                if (typeof CARD_TIERS === 'undefined' || typeof cardId !== 'function') return out;
                // 與 MOB_DROPS 相同：存「百分比數字」（0.1＝0.1%）；對應 rollCardDrops 的 0.001／0.0001／0.00001 機率
                var rates = [0.1, 0.01, 0.001];
                for (var ti = 0; ti < CARD_TIERS.length; ti++) {
                    var cid = cardId(mobName, CARD_TIERS[ti].t);
                    if (!DB.items[cid]) continue;
                    var rate = rates[ti] != null ? rates[ti] : 0;
                    out.push([cid, itemNameOf(cid), rate, null, rate]);
                }
            } catch (e) {}
            return out;
        }
        for (var id in DB.mobs) {
            var mob = DB.mobs[id];
            var maps = (mobToMaps[id] || []).map(function(mapId){ return mapNameOf(mapId); }).filter(function(n, i, a){ return n && a.indexOf(n) === i; });
            var raw = [].concat(
                dropsFromTable('MOB_DROPS', MOB_DROPS, mob.n),
                dropsFromTable('DARK_WEAPON_DROPS', typeof DARK_WEAPON_DROPS !== 'undefined' ? DARK_WEAPON_DROPS : null, mob.n),
                dropsFromTable('DARK_CRYSTAL_DROPS', typeof DARK_CRYSTAL_DROPS !== 'undefined' ? DARK_CRYSTAL_DROPS : null, mob.n),
                dropsFromTable('DRAGON_DROPS', typeof DRAGON_DROPS !== 'undefined' ? DRAGON_DROPS : null, mob.n),
                dropsFromTable('WARRIOR_DROPS', typeof WARRIOR_DROPS !== 'undefined' ? WARRIOR_DROPS : null, mob.n),
                dropsFromTable('MEM_DROPS', typeof MEM_DROPS !== 'undefined' ? MEM_DROPS : null, mob.n)
            );
            var drops = raw.map(function(e){ return [e[0], itemNameOf(e[0]), e[1], e[3], e[2]]; }).filter(function(d){ return DB.items[d[0]]; });
            cardDropsForMob(mob.n, mob).forEach(function(cd){ drops.push(cd); });
            drops.forEach(function(d){ DROPPED_SET[d[0]] = true; });
            drops.sort(function(a, b){ return b[2] - a[2]; });
            var hay = (mob.n + ' ' + maps.join(' ') + ' ' + drops.map(function(d){ return d[1]; }).join(' ')).toLowerCase();
            INDEX.push({ id: id, mob: mob, maps: maps, drops: drops, hay: hay });
        }
        INDEX.sort(function(a, b){ return (a.mob.lv || 0) - (b.mob.lv || 0) || String(a.mob.n).localeCompare(String(b.mob.n)); });
        ITEM_INDEX = [];
        var shopSet = {};
        if (typeof SHOP_LISTS !== 'undefined' && SHOP_LISTS) { for (var k in SHOP_LISTS) (SHOP_LISTS[k] || []).forEach(function(sid){ shopSet[sid] = true; }); }
        for (var iid in DB.items) {
            var d = DB.items[iid]; if (!d || !d.n) continue;
            if (d.slot === 'doll') continue; // 魔法娃娃改走專屬分頁，不進掉落搜尋
            var isEquip = (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc');
            var isCard = (d.eff === 'card' || String(iid).indexOf('card_') === 0);
            var isCraft = !!( (_craftIndex && _craftIndex[iid]) || (_craftMatIndex && _craftMatIndex[iid]) );
            var isAcq = !!itemAcquireOf(iid) || !!trialSourceOf(iid);
            var isBox = !!boxTiersOf(iid);
            if (!isEquip && !shopSet[iid] && !DROPPED_SET[iid] && !isCard && !isCraft && !isAcq && !isBox) continue;
            ITEM_INDEX.push({ id: iid, n: d.n, hay: String(d.n).toLowerCase() });
        }
        ITEM_INDEX.sort(function(a, b){ return a.n.length - b.n.length || a.n.localeCompare(b.n); });
        _ready = true; return true;
    }
    function specialPanelHTML() {
        var body = SPECIAL_BLOCKS.map(function(b){
            return '<details class="gmem-dex-sp-item" data-spid="' + b.id + '" open><summary class="gmem-dex-sp-h">' + b.title + '</summary><ul>' + b.lines.map(function(l){ return '<li>' + l + '</li>'; }).join('') + '</ul></details>';
        }).join('');
        return '<details class="gmem-dex-special-wrap" open><summary><span class="gmem-dex-sp-label">📋 全域特殊掉落規則</span></summary><div class="gmem-dex-sp-body">' + body + '</div></details>';
    }
    function ensureSpecialPanel() {
        var root = panelRoot(); if (!root) return;
        var panel = root.querySelector('.gmem-dex-panel'); if (!panel) return;
        var scroll = panel.querySelector('.gmem-dex-scroll') || panel;
        if (!scroll.querySelector('.gmem-dex-special-wrap')) scroll.insertAdjacentHTML('beforeend', specialPanelHTML());
        Array.prototype.forEach.call(scroll.querySelectorAll('.gmem-dex-special-wrap, .gmem-dex-sp-item'), function(el){ el.open = true; });
    }
    function findExactItem(q) {
        if (!q) return null;
        var match = null;
        for (var id in DB.items) {
            var d = DB.items[id];
            if (!d || !d.n) continue;
            if (d.slot === 'doll') continue;
            if (String(d.n).toLowerCase() === q) match = { id: id, n: d.n };
        }
        return match;
    }
    function findDropSources(itemId) {
        if (!itemId || !buildIndexes()) return [];
        var out = [], seen = {};
        for (var i = 0; i < INDEX.length; i++) {
            var h = INDEX[i], drops = h.drops || [];
            for (var j = 0; j < drops.length; j++) {
                if (drops[j][0] !== itemId) continue;
                var n = h.mob && h.mob.n;
                if (!n || seen[n]) break;
                seen[n] = true;
                out.push({ n: n, drop: drops[j] });
                break;
            }
        }
        return out;
    }
    function buildNpcInfo() {
        _npcInfo = {};
        try {
            if (typeof DB === 'undefined' || !DB.towns) return;
            for (var tid in DB.towns) {
                var t = DB.towns[tid]; if (!t || !t.npcs) continue;
                t.npcs.forEach(function(n) {
                    if (n && n.id && !_npcInfo[n.id]) _npcInfo[n.id] = { name: n.n, town: t.n };
                });
            }
        } catch (e) {}
    }
    function buildCraftIndex() {
        _craftIndex = {};
        _craftMatIndex = {};
        if (_npcInfo === null) buildNpcInfo();
        function addRec(resultId, rec) {
            if (!resultId || !rec) return;
            (_craftIndex[resultId] = _craftIndex[resultId] || []).push(rec);
            (rec.req || []).forEach(function(m) {
                if (!m || !m.id || m.id === 'gold') return;
                (_craftMatIndex[m.id] = _craftMatIndex[m.id] || []).push({
                    result: resultId,
                    npcId: rec.npcId,
                    cnt: m.cnt || 1,
                    plus11: !!m.plus11,
                    plus7: !!m.plus7,
                    yield: rec.yield || 1,
                    note: rec.note || ''
                });
            });
        }
        try {
            if (typeof CRAFT_RECIPES !== 'undefined' && CRAFT_RECIPES) {
                for (var npcId in CRAFT_RECIPES) {
                    (CRAFT_RECIPES[npcId] || []).forEach(function(r) {
                        if (!r || !r.result) return;
                        addRec(r.result, { npcId: npcId, req: r.req || [], yield: r.yield || 1 });
                    });
                }
            }
        } catch (e) {}
        try {
            if (typeof DEMONKING_RECIPES !== 'undefined' && DEMONKING_RECIPES) {
                var dkMats = (typeof DEMONKING_MATS !== 'undefined' && DEMONKING_MATS) ? DEMONKING_MATS : [];
                DEMONKING_RECIPES.forEach(function(r) {
                    if (!r || !r.result) return;
                    var req = [{ id: r.src, cnt: 1, plus11: true }].concat(dkMats);
                    addRec(r.result, {
                        npcId: 'npc_flame_shadow', req: req, yield: 1,
                        note: '消耗 +11 以上的指定惡魔武器，會繼承強化值／詞綴／席琳套裝效果'
                    });
                });
            }
        } catch (e) {}
        try {
            if (typeof LUMIEL_RECIPES !== 'undefined' && LUMIEL_RECIPES) {
                LUMIEL_RECIPES.forEach(function(r) {
                    if (!r || !r.result) return;
                    var req = [{ id: r.src, cnt: 1, plus7: true }].concat(r.mats || []);
                    addRec(r.result, {
                        npcId: 'npc_lumiel', req: req, yield: 1,
                        note: '消耗 +7 以上的「' + (r.srcName || r.src) + '」，會繼承強化值／詞綴／席琳套裝效果'
                    });
                });
            }
        } catch (e) {}
        // 🔷🔶 象牙塔・神秘的魔法師：鋼鐵瑪那魔杖（不在 CRAFT_RECIPES）
        try {
            if (typeof MYSTICWAND_RECIPES !== 'undefined' && MYSTICWAND_RECIPES) {
                var mwMats = (typeof MYSTICWAND_MATS !== 'undefined' && MYSTICWAND_MATS) ? MYSTICWAND_MATS : [];
                MYSTICWAND_RECIPES.forEach(function(r) {
                    if (!r || !r.result) return;
                    var req = [{ id: r.src, cnt: 1, plus7: true }].concat(mwMats);
                    addRec(r.result, {
                        npcId: 'npc_mystic_mage', req: req, yield: 1,
                        note: '消耗 +7 以上的「' + (r.srcName || r.src) + '」；成品恆為 +0 白板（不繼承強化值／屬性／詞綴）'
                    });
                });
            }
        } catch (e) {}
        // 靈魂之球喚回（不在 CRAFT_RECIPES）
        try {
            addRec('wpn_baphomet_wand', {
                npcId: '__soul_orb__',
                req: [{ id: 'wpn_powerless_baphomet', cnt: 1 }, { id: 'item_soul_orb', cnt: 1 }],
                yield: 1,
                note: '對「靈魂之球」使用即可喚回；會繼承失去魔力魔杖的席琳套裝效果'
            });
            addRec('wpn_baless', {
                npcId: '__soul_orb__',
                req: [{ id: 'wpn_powerless_baless', cnt: 1 }, { id: 'item_soul_orb', cnt: 1 }],
                yield: 1,
                note: '對「靈魂之球」使用即可喚回；會繼承失去魔力魔杖的席琳套裝效果'
            });
        } catch (e) {}
    }
    function npcTownName(npcName) {
        try {
            if (!npcName || typeof DB === 'undefined' || !DB.towns) return '';
            for (var tid in DB.towns) {
                var tw = DB.towns[tid];
                if ((tw.npcs || []).some(function(n) { return n && n.n === npcName; })) return tw.n || '';
            }
        } catch (e) {}
        return '';
    }
    function npcWithTown(npcName) {
        var t = npcTownName(npcName);
        return (npcName || '') + (t ? '（' + t + '）' : '');
    }
    function buildTrialBy() {
        _trialBy = {};
        var put = function(id, label) { if (id && !_trialBy[id]) _trialBy[id] = label; };
        try {
            if (typeof TRIAL_50_CFG !== 'undefined' && TRIAL_50_CFG) {
                for (var c in TRIAL_50_CFG) {
                    var t = TRIAL_50_CFG[c];
                    (t.rewards || []).forEach(function(r) {
                        put(r.id || r, npcWithTown(t.npc) + ' 的 50 級試煉：以「' + (t.exMatNm || '指定材料') + '」兌換');
                    });
                }
            }
        } catch (e) {}
        try {
            if (typeof DARK_TRIAL_CFG !== 'undefined' && DARK_TRIAL_CFG) {
                for (var k in DARK_TRIAL_CFG) {
                    var c2 = DARK_TRIAL_CFG[k];
                    put(c2.reward, npcWithTown(c2.npc) + '：以「' + (c2.reqName || '指定道具') + '」兌換');
                }
            }
        } catch (e) {}
        try {
            if (typeof SHENIEN_EX !== 'undefined' && SHENIEN_EX) {
                for (var k2 in SHENIEN_EX) (SHENIEN_EX[k2].rewards || []).forEach(function(id) {
                    put(id, '希蓮恩（希培利亞村莊）試煉兌換');
                });
            }
        } catch (e) {}
        try {
            if (typeof WARRIOR_EX !== 'undefined' && WARRIOR_EX) {
                for (var k3 in WARRIOR_EX) (WARRIOR_EX[k3].rewards || []).forEach(function(id) {
                    put(id, '多文（海音）戰士試煉兌換');
                });
            }
        } catch (e) {}
        try {
            if (typeof PROCEL_EX !== 'undefined' && PROCEL_EX) {
                for (var k4 in PROCEL_EX) (PROCEL_EX[k4].rewards || []).forEach(function(id) {
                    put(id, '普洛凱爾（貝希摩斯）龍騎士兌換');
                });
            }
        } catch (e) {}
        try {
            if (typeof YURIA_REWARDS !== 'undefined' && YURIA_REWARDS) {
                YURIA_REWARDS.forEach(function(r) { put(r.id, '尤麗婭（說話之島）：以「歐林的日記本」兌換（三選一）'); });
            }
        } catch (e) {}
        try {
            if (typeof YURIA_HATIN_REWARDS !== 'undefined' && YURIA_HATIN_REWARDS) {
                YURIA_HATIN_REWARDS.forEach(function(r) { put(r.id, '尤麗婭（說話之島）：以「黑暗哈汀的日記本」兌換（六選一）'); });
            }
        } catch (e) {}
        try {
            if (typeof SHIMIZHE_REWARDS !== 'undefined' && SHIMIZHE_REWARDS) {
                SHIMIZHE_REWARDS.forEach(function(id) { put(id, '希米哲（海賊島村莊）：以「兒子的信＋遺骸＋肖像畫」各 1 兌換（五選一）'); });
            }
        } catch (e) {}
        try { put('acc_summon_ctrl', '雷德（銀騎士村）：以五枚部下證明戒指＋魔法寶石 ×100 兌換'); } catch (e) {}
    }
    function trialSourceOf(id) {
        if (_trialBy === null) buildTrialBy();
        return (_trialBy && _trialBy[id]) || null;
    }
    // 特殊取得（非製作表／非試煉 config）；優先讀 AFK_EXTRA.itemAcquire
    var ITEM_ACQUIRE_FALLBACK = {
        wpn_baphomet_wand: '用「靈魂之球」喚回「失去魔力的巴風特魔杖」（繼承席琳套裝效果）',
        wpn_baless: '用「靈魂之球」喚回「失去魔力的巴列斯魔杖」（繼承席琳套裝效果）',
        mat_holy_relic: '持有「死亡騎士之印記」時，在拉斯塔巴德區域擊敗任何怪 0.1% 掉落',
        wpn_shaha_arrow: '裝備「沙哈之弓」時自動附帶的無限專用箭，不需另外取得',
        bk_dragon_bloodlust: '貝希摩斯·普洛凱爾：用「妖魔密使首領間諜書」×1 兌換（二選一）',
        armguard_dragonscale: '貝希摩斯·普洛凱爾：用「妖魔密使首領間諜書」×1 兌換（二選一）',
        wpn_dragon_2h: '貝希摩斯·普洛凱爾：用「妖魔搜索文件」×3 兌換（二選一）',
        bk_dragon_armor: '貝希摩斯·普洛凱爾：用「妖魔搜索文件」×3 兌換（二選一）',
        clk_dragon: '貝希摩斯·普洛凱爾：用「雪怪之心」×10 兌換',
        wpn_chain_annihilator: '貝希摩斯·普洛凱爾（完成 50 級試煉後）：用「靈魂之火灰燼」×1 兌換',
        arm_53: '銀騎士村·瑞奇（騎士試煉）兌換：黑騎士的誓約＋古老的交易文件＋龍龜甲 各 ×1',
        arm_115: '說話之島·詹姆（法師試煉）兌換：食屍鬼的指甲＋食屍鬼的牙齒＋骷髏頭 各 ×1',
        arm_50: '燃柳村·歐斯（妖精試煉）兌換：四大妖魔魔法書各 ×1（與精靈體質頭盔二選一）',
        arm_51: '燃柳村·歐斯（妖精試煉）兌換：四大妖魔魔法書各 ×1（與精靈敏捷頭盔二選一）',
        wpn_crystalwand: '象牙塔·塔拉斯（法師·水晶試煉）兌換：不死族的鑰匙＋不死族的骨頭 各 ×1',
        wpn_manawand: '象牙塔·塔拉斯（法師·瑪那試煉）兌換：變形怪的血 ×1（與瑪那斗篷二選一）',
        arm_89: '象牙塔·塔拉斯（法師·瑪那試煉）兌換：變形怪的血 ×1（與瑪那魔杖二選一）',
        acc_royal_guard: '威頓村·馬沙（王族試煉）兌換：失去光明的靈魂 ×1',
        acc_134: '威頓村·馬沙（騎士試煉）兌換：夜之視野＋古代鑰匙 各 ×1',
        arm_102: '威頓村·馬沙（妖精試煉）兌換：藍色長笛＋古代鑰匙 各 ×1',
        bk_elf_summon2: '威頓村·馬沙（妖精試煉）兌換：藍色長笛＋古代鑰匙 各 ×1',
        wpn_redknight: '說話之島·甘特（騎士試煉）兌換：夏洛伯之爪 ×1',
        shd_redknight: '說話之島·甘特（騎士試煉）兌換：蛇女之鱗 ×1',
        clk_royal_red: '說話之島·甘特（王族試煉）兌換：王族搜索狀 ×1',
        clk_royal_majesty: '說話之島·甘特（王族試煉）兌換：村民的遺物 ×1',
        bk_royal_precise: '說話之島·甘特（王族試煉）兌換：王族搜索狀 ×1',
        bk_royal_callally: '說話之島·甘特（王族試煉）兌換：村民的遺物 ×1',
        arm_85: '妖精森林·迷幻森林之母（妖精試煉）兌換：受詛咒的精靈書 ×1',
        bk_elf_summon: '妖精森林·迷幻森林之母（妖精試煉）兌換：受詛咒的精靈書 ×1',
        doll_bag: '向威頓村「魔法娃娃商人」用重複的「銀卡」兌換（1:1，需該怪卡片圖鑑已開到金階）。打開隨機獲得一～二階魔法娃娃',
        doll_box_high: '向威頓村「魔法娃娃商人」用重複的「金卡」兌換（1:1，需該怪卡片圖鑑已開到金階）。打開隨機獲得二～四階魔法娃娃',
        mem_cube_burn: '希蓮恩（希培利亞村莊）試煉兌換：交付污濁安特的水果／樹枝／樹皮 各 ×1（與幻術士魔杖二選一）',
        mem_cube_shock: '希蓮恩（希培利亞村莊）試煉兌換：交付艾爾摩將軍之心 ×1（與幻術士法書二選一）',
        wpn_11: '角色創建時的起始武器（黑暗妖精／王族），無法另外取得',
        amr_jacket: '角色創建時的起始防具，無法另外取得'
    };
    function itemAcquireOf(id) {
        try {
            if (window.AFK_EXTRA && AFK_EXTRA.itemAcquire && AFK_EXTRA.itemAcquire[id] && AFK_EXTRA.itemAcquire[id].short) {
                return AFK_EXTRA.itemAcquire[id].short;
            }
        } catch (e) {}
        return ITEM_ACQUIRE_FALLBACK[id] || null;
    }
    function buildShopIndex() {
        _shopIndex = {};
        try {
            if (typeof SHOP_LISTS === 'undefined' || !SHOP_LISTS) return;
            if (_npcInfo === null) buildNpcInfo();
            var defaultSet = {};
            (SHOP_LISTS.default || []).forEach(function(id) { defaultSet[id] = true; });
            for (var npcId in SHOP_LISTS) {
                if (npcId === 'default') continue;
                var info = _npcInfo[npcId] || { name: npcId, town: '' };
                (SHOP_LISTS[npcId] || []).forEach(function(id) {
                    if (defaultSet[id]) return;
                    var e = (_shopIndex[id] = _shopIndex[id] || { specific: [], general: false });
                    if (!e.specific.some(function(s) { return s.name === info.name && s.town === info.town; })) {
                        e.specific.push({ name: info.name, town: info.town });
                    }
                });
            }
            (SHOP_LISTS.default || []).forEach(function(id) {
                (_shopIndex[id] = _shopIndex[id] || { specific: [], general: false }).general = true;
            });
        } catch (e) { _shopIndex = {}; }
    }
    var SHOP_BUNDLE_PRICE = {
        wpn_5: { base: 100, unit: '1000 根' },
        wpn_22: { base: 200, unit: '1000 根' },
        new_item_143: { base: 100, unit: '1000 個' }
    };
    function shopBuyPrice(id) {
        if (SHOP_BUNDLE_PRICE[id]) return SHOP_BUNDLE_PRICE[id];
        try {
            var d = DB.items[id];
            return (d && d.p) ? { base: d.p, unit: '' } : null;
        } catch (e) { return null; }
    }
    function shopInfoHTML(itemId) {
        if (_shopIndex === null) buildShopIndex();
        var e = _shopIndex[itemId];
        if (!e) return '';
        var lines = e.specific.map(function(s) {
            return '<div class="gmem-dex-craft-where">在 <b>' + esc(s.name) + (s.town ? '（' + esc(s.town) + '）' : '') + '</b> 販售</div>';
        });
        if (e.general) lines.push('<div class="gmem-dex-craft-where">各村莊雜貨商人皆有販售</div>');
        if (!lines.length) return '';
        var pr = shopBuyPrice(itemId);
        var priceLine = pr
            ? '<div class="gmem-dex-craft-mats">售價：' + fmt(pr.base) + ' 金幣' + (pr.unit ? '（' + pr.unit + '）' : '') + '；攻城獲勝期間 8 折</div>'
            : '';
        return '<div class="gmem-dex-item-shop"><div class="gmem-dex-sub">商店販售</div>' + priceLine + lines.join('') + '</div>';
    }
    function buildBoxBy() {
        _boxBy = {};
        function add(tbl, label) {
            if (!tbl || !label) return;
            tbl.forEach(function(e) {
                var iid = e && e[0];
                if (!iid) return;
                (_boxBy[iid] = _boxBy[iid] || {})[label] = 1;
            });
        }
        try {
            if (typeof BOX_LOOT_BY_ID !== 'undefined' && BOX_LOOT_BY_ID) {
                for (var boxId in BOX_LOOT_BY_ID) {
                    var label = (DB.items[boxId] && DB.items[boxId].n) || boxId;
                    add(BOX_LOOT_BY_ID[boxId], label);
                }
                return;
            }
        } catch (e) {}
        try { add(typeof OSIRIS_BOX_BASIC !== 'undefined' ? OSIRIS_BOX_BASIC : null, '歐西里斯寶箱（初級）'); } catch (e) {}
        try { add(typeof OSIRIS_BOX_HIGH !== 'undefined' ? OSIRIS_BOX_HIGH : null, '歐西里斯寶箱（高級）'); } catch (e) {}
        try { add(typeof KUKULKAN_BOX_BASIC !== 'undefined' ? KUKULKAN_BOX_BASIC : null, '庫庫爾坎寶箱（初級）'); } catch (e) {}
        try { add(typeof KUKULKAN_BOX_HIGH !== 'undefined' ? KUKULKAN_BOX_HIGH : null, '庫庫爾坎寶箱（高級）'); } catch (e) {}
    }
    function boxTiersOf(id) {
        if (_boxBy === null) buildBoxBy();
        return (_boxBy && _boxBy[id]) ? Object.keys(_boxBy[id]) : null;
    }
    function boxInfoHTML(itemId) {
        var tiers = boxTiersOf(itemId);
        if (!tiers || !tiers.length) return '';
        return '<div class="gmem-dex-item-box"><div class="gmem-dex-sub">寶箱開出</div>'
            + '<div class="gmem-dex-craft-mats">開「' + esc(tiers.join('／')) + '」隨機獲得（每開通常消耗 1 顆龜裂之核）</div></div>';
    }
    function dollInfoHTML(itemId) {
        try {
            var d = DB.items[itemId];
            if (!d || d.slot !== 'doll') return '';
        } catch (e) { return ''; }
        return '<div class="gmem-dex-item-acquire"><div class="gmem-dex-sub">魔法娃娃</div>'
            + '<div class="gmem-dex-craft-mats">開「魔法娃娃的袋子／高級魔法娃娃的盒子」隨機取得，或由低一階娃娃合成。袋子用重複銀卡兌換、盒子用重複金卡兌換（需該怪卡片圖鑑已開到金階）。</div></div>';
    }
    function acquireInfoHTML(itemId) {
        var parts = [];
        var acq = itemAcquireOf(itemId);
        var hasSoulCraft = _craftIndex && _craftIndex[itemId] && _craftIndex[itemId].some(function(r){ return r.npcId === '__soul_orb__'; });
        if (acq && !hasSoulCraft) {
            parts.push('<div class="gmem-dex-item-acquire"><div class="gmem-dex-sub">取得方式</div><div class="gmem-dex-craft-mats">' + esc(acq) + '</div></div>');
        }
        var ts = trialSourceOf(itemId);
        if (ts && !acq) {
            parts.push('<div class="gmem-dex-item-acquire"><div class="gmem-dex-sub">試煉／兌換</div><div class="gmem-dex-craft-mats">' + esc(ts) + '</div></div>');
        }
        try { parts.push(dollInfoHTML(itemId)); } catch (e) {}
        try { parts.push(boxInfoHTML(itemId)); } catch (e) {}
        try { parts.push(shopInfoHTML(itemId)); } catch (e) {}
        return parts.filter(Boolean).join('');
    }
    function craftHaveCount(id) {
        try {
            if (typeof invCountId === 'function') return Math.max(0, Number(invCountId(id)) || 0);
        } catch (e) {}
        try {
            if (id === 'gold') return Math.max(0, Number(player && player.gold) || 0);
            if (!player || !player.inv) return 0;
            return player.inv.filter(function(i) { return i && i.id === id; })
                .reduce(function(s, i) { return s + (Number(i.cnt) || 0); }, 0);
        } catch (e) { return 0; }
    }
    function craftNeedHaveRatio(needCnt, haveCnt) {
        var need = Math.max(0, Number(needCnt) || 0);
        var have = Math.max(0, Number(haveCnt) || 0);
        var ok = have >= need;
        return '<span class="' + (ok ? 'gmem-dex-craft-ok' : 'gmem-dex-craft-lack') + '">' + fmt(need) + '/' + fmt(have) + '</span>';
    }
    function craftMatLabel(m) {
        if (!m) return '—';
        var needCnt = m.cnt || 1;
        var have = craftHaveCount(m.id);
        var ratio = craftNeedHaveRatio(needCnt, have);
        if (m.id === 'gold') return '金幣 需求 ' + ratio;
        var mn = itemNameOf(m.id);
        var need = (m.plus11 ? '（須 +11 以上）' : (m.plus7 ? '（須 +7 以上）' : ''));
        return '<span class="gmem-dex-iname" data-item="' + esc(mn) + '" title="查詢此材料">' + esc(mn) + '</span>' + need + ' 需求 ' + ratio;
    }
    function craftInfoHTML(itemId) {
        if (_craftIndex === null) buildCraftIndex();
        if (_npcInfo === null) buildNpcInfo();
        var recs = _craftIndex[itemId];
        if (!recs || !recs.length) return '';
        var blocks = recs.map(function(rec) {
            var where;
            if (rec.npcId === '__soul_orb__') {
                where = '使用 <b>靈魂之球</b> 喚回';
            } else {
                var npc = _npcInfo[rec.npcId] || { name: rec.npcId, town: '' };
                where = '在 <b>' + esc(npc.name) + (npc.town ? '（' + esc(npc.town) + '）' : '') + '</b> 製作';
            }
            var mats = (rec.req || []).map(craftMatLabel).join('、');
            var y = (rec.yield && rec.yield > 1) ? '（一次產出 ' + rec.yield + ' 個）' : '';
            return '<div class="gmem-dex-craft-where">' + where + y + '</div>'
                + '<div class="gmem-dex-craft-mats">材料：' + (mats || '—') + '</div>'
                + (rec.note ? '<div class="gmem-dex-craft-note">' + esc(rec.note) + '</div>' : '');
        }).join('');
        return '<div class="gmem-dex-item-craft"><div class="gmem-dex-sub">製作</div>' + blocks + '</div>';
    }
    function craftUsedAsMatHTML(itemId) {
        if (_craftMatIndex === null) buildCraftIndex();
        if (_npcInfo === null) buildNpcInfo();
        var uses = _craftMatIndex[itemId];
        if (!uses || !uses.length) return '';
        var have = craftHaveCount(itemId);
        var ranked = uses.slice().sort(function(a, b) {
            return itemNameOf(a.result).localeCompare(itemNameOf(b.result), 'zh-Hant')
                || String(a.npcId).localeCompare(String(b.npcId));
        });
        var rows = ranked.map(function(u) {
            var rn = itemNameOf(u.result);
            var where;
            if (u.npcId === '__soul_orb__') {
                where = '靈魂之球喚回';
            } else {
                var npc = _npcInfo[u.npcId] || { name: u.npcId, town: '' };
                where = esc(npc.name) + (npc.town ? '（' + esc(npc.town) + '）' : '');
            }
            var needFlag = (u.plus11 ? '（須 +11 以上）' : (u.plus7 ? '（須 +7 以上）' : ''));
            var y = (u.yield && u.yield > 1) ? '，一次產出 ' + u.yield + ' 個' : '';
            return '<div class="gmem-dex-craft-use-row">'
                + '<span class="gmem-dex-iname" data-item="' + esc(rn) + '" title="查詢成品">' + esc(rn) + '</span>'
                + '<span class="gmem-dex-craft-use-meta"> · ' + where + needFlag + ' · 需求 ' + craftNeedHaveRatio(u.cnt, have) + y + '</span>'
            + '</div>';
        }).join('');
        return '<div class="gmem-dex-item-craftuse"><div class="gmem-dex-sub">可用此材料製作</div>'
            + '<div class="gmem-dex-craft-have">目前持有（背包+倉庫）：<b>' + fmt(have) + '</b></div>'
            + rows + '</div>';
    }
    function parseSearchParts(q) {
        if (!q) return [];
        if (q.indexOf('/') >= 0) return q.split('/').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean);
        return [q];
    }
    function hayMatchesParts(hay, parts) {
        if (!parts.length) return false;
        for (var i = 0; i < parts.length; i++) if (hay.indexOf(parts[i]) >= 0) return true;
        return false;
    }
    function gotoDropQuery(q) {
        var root = panelRoot(), panel = panelEl();
        if (!panel) return;
        saveCurrentModeState();
        panel.setAttribute('data-mode', 'drop');
        if (root) {
            var dexBtn = root.querySelector('.gmem-dex-btn');
            var relicBtn = root.querySelector('.gmem-relic-btn');
            var shinBtn = root.querySelector('.gmem-shin-btn');
            var dollBtn = root.querySelector('.gmem-doll-btn');
            if (dexBtn) dexBtn.classList.add('is-active');
            if (relicBtn) relicBtn.classList.remove('is-active');
            if (shinBtn) shinBtn.classList.remove('is-active');
            if (dollBtn) dollBtn.classList.remove('is-active');
        }
        setQueryCache('drop', q || '');
        setScrollCache('drop', 0);
        updateModeUI();
        ensureSpecialPanel();
        setQuery(q || '');
    }
    function itemDetailHTML(exact) {
        if (!exact || !DB.items[exact.id]) return '';
        var d = DB.items[exact.id];
        var item = { id: exact.id, en: 0 };
        var headInner = '';
        try {
            headInner = (typeof getItemFullName === 'function') ? getItemFullName(item) : ('<span>' + esc(d.n) + '</span>');
        } catch(e) { headInner = '<span>' + esc(d.n) + '</span>'; }
        var iconHtml = '';
        try {
            if (typeof getIconUrl === 'function') {
                var glow = (typeof getGlowClass === 'function') ? getGlowClass(item, d) : '';
                iconHtml = '<img src="' + esc(getIconUrl(d)) + '" alt="" class="gmem-dex-item-icon' + (glow ? ' ' + glow : '') + '" onerror="this.style.display=\\'none\\'">';
            }
        } catch(e){}
        var legendTag = d.legend ? ' <span class="c-legend gmem-dex-item-tag">傳說</span>' : '';
        var relicTag = (typeof isRelic === 'function' && isRelic(d)) ? ' <span class="c-relic gmem-dex-item-tag">遺物</span>' : '';
        var descBody = '';
        try {
            if (typeof buildItemDescHTML === 'function') descBody = buildItemDescHTML(item);
            else if (d.d) descBody = d.d;
            else descBody = '<span class="gmem-dex-item-muted">無詳細說明</span>';
        } catch(e) {
            descBody = d.d ? d.d : '<span class="gmem-dex-item-muted">無詳細說明</span>';
        }
        var priceHtml = '';
        try {
            if (typeof getSellPrice === 'function') {
                var sp = getSellPrice(item);
                if (sp > 0) priceHtml = '<div class="gmem-dex-item-price">販賣價格: ' + fmt(sp) + ' 金幣</div>';
            } else if (d.p) priceHtml = '<div class="gmem-dex-item-price">參考價格: ' + fmt(d.p) + ' 金幣</div>';
        } catch(e){}
        var dropsHtml = '';
        var sources = findDropSources(exact.id);
        if (sources.length) {
            var useCurrent = panelDataSource() !== 'original';
            var allCard = sources.every(function(s){ return isCardDropItem(s.drop[0]); });
            var shLbl = (!allCard && useCurrent) ? sherineDropLabel() : '';
            var gmLbl = useCurrent ? gmDropMultLabel() : '';
            var dropLabel = useCurrent
                ? ('（當前難度' + (shLbl ? '·' + shLbl : '') + (gmLbl ? '·' + gmLbl : '') + (allCard ? '·卡不吃席琳' : '') + '）')
                : '';
            var ranked = sources.slice().sort(function(a, b){
                return dropPctDisplay(b.drop, useCurrent) - dropPctDisplay(a.drop, useCurrent);
            });
            dropsHtml = '<div class="gmem-dex-item-dropsources"><div class="gmem-dex-sub">掉落' + dropLabel + '</div><div class="gmem-dex-droplist">' + ranked.map(function(s){
                var pct = dropPctDisplay(s.drop, useCurrent);
                var label = s.n + ' ' + fmtPct(pct) + '%';
                return '<span class="gmem-dex-droplink" data-mobs="' + esc(s.n) + '" title="到掉落查詢">' + esc(label) + '</span>';
            }).join('') + '</div></div>';
        }
        var craftUseHtml = '';
        try { craftUseHtml = craftUsedAsMatHTML(exact.id); } catch (e) { craftUseHtml = ''; }
        var craftHtml = '';
        try { craftHtml = craftInfoHTML(exact.id); } catch (e) { craftHtml = ''; }
        var acqHtml = '';
        try { acqHtml = acquireInfoHTML(exact.id); } catch (e) { acqHtml = ''; }
        return '<div class="gmem-dex-card gmem-dex-item-card"><div class="gmem-dex-item-head">' + iconHtml + '<div class="gmem-dex-item-title">' + headInner + legendTag + relicTag + '</div></div><div class="gmem-dex-item-desc">' + descBody + priceHtml + acqHtml + craftUseHtml + craftHtml + dropsHtml + '</div></div>';
    }
    function itemMatchesHTML(q) {
        var ms = [];
        for (var i = 0; i < ITEM_INDEX.length && ms.length <= ITEM_MATCH_MAX; i++) {
            var it = ITEM_INDEX[i];
            try {
                var d = DB.items[it.id];
                if (d && (d.eff === 'card' || String(it.id).indexOf('card_') === 0)) continue;
            } catch (e) {}
            if (it.hay.indexOf(q) >= 0) ms.push(it);
        }
        if (!ms.length) return '';
        var more = ms.length > ITEM_MATCH_MAX; if (more) ms = ms.slice(0, ITEM_MATCH_MAX);
        var names = ms.map(function(it){ return '<span class="gmem-dex-iname" data-item="' + esc(it.n) + '" title="查掉落來源">' + hl(it.n, q) + '</span>'; }).join('、');
        return '<div class="gmem-dex-card"><div class="gmem-dex-imatch-h">🔎 符合的物品</div><div class="gmem-dex-imatch">' + names + (more ? '　…還有更多，請輸入更精確的名稱' : '') + '</div></div>';
    }
    function cardHTML(h, q) {
        var useCurrent = panelDataSource() !== 'original';
        var shLbl = useCurrent ? sherineDropLabel() : '';
        var gmLbl = useCurrent ? gmDropMultLabel() : '';
        var dropLabel = useCurrent ? ('（當前難度' + (shLbl ? '·' + shLbl : '') + (gmLbl ? '·' + gmLbl : '') + '）') : '';
        var statLabel = statModeLabel(useCurrent);
        var statsData = mobStatsForDisplay(h, useCurrent);
        var m = h.mob, tags = '';
        if (m.boss) tags += '<span class="gmem-dex-tag tag-boss">BOSS</span>';
        if (m.hard) tags += '<span class="gmem-dex-tag tag-hard">硬皮</span>';
        var dmg = statsData.dmg ? (statsData.dmg[0] + '~' + statsData.dmg[1]) : '-';
        var gold = (statsData.goldMin != null) ? (fmt(statsData.goldMin) + '~' + fmt(statsData.goldMax)) : '-';
        var drStat = (useCurrent && statsData.dr > 0) ? st('減傷', statsData.dr) : '';
        var stats = '<div class="gmem-dex-sub">數值' + statLabel + '</div><div class="gmem-dex-stats">' + st('等級', m.lv) + st('屬性', ELE[m.e] || m.e || '無') + st('種族', m.race || '-') + st('行為', m.beh || '-') + st('HP', fmt(statsData.hp)) + st('攻擊', dmg) + st('命中', statsData.hit != null ? statsData.hit : '-') + st('AC', statsData.ac != null ? statsData.ac : '-') + st('魔防', statsData.mr != null ? statsData.mr : '-') + drStat + st('經驗', fmt(statsData.exp)) + st('金幣', gold) + '</div>';
        var mapsHTML = h.maps.length ? h.maps.map(function(nm){ return '<span class="gmem-dex-maplink" data-map="' + esc(nm) + '">' + hl(nm, q) + '</span>'; }).join('、') : '—';
        var dropsHTML = h.drops.length ? '<table class="gmem-dex-drops"><tbody>' + h.drops.map(function(d){
            var pct = dropPctDisplay(d, useCurrent);
            var tag = d[3] ? ' <span class="gmem-dex-droptag">' + esc(d[3]) + '</span>' : '';
            return '<tr><td><span class="gmem-dex-iname" data-item="' + esc(d[1]) + '" title="查掉落來源">' + hl(d[1], q) + '</span>' + tag + '</td><td class="gmem-dex-pct">' + fmtPct(pct) + '%</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="gmem-dex-nodrop">無專屬掉落表</div>';
        return '<div class="gmem-dex-card"><div class="gmem-dex-name">' + hl(m.n, q) + ' ' + tags + '</div>' + stats + '<div class="gmem-dex-sub">出沒地圖</div><div class="gmem-dex-maps">' + mapsHTML + '</div><div class="gmem-dex-sub">掉落' + dropLabel + '</div>' + dropsHTML + '</div>';
    }
    function clearMarksIn(el) {
        if (!el) return;
        var ms = el.querySelectorAll('mark.gmem-dex-hl');
        for (var i = 0; i < ms.length; i++) { var m = ms[i]; m.parentNode.replaceChild(document.createTextNode(m.textContent), m); }
        el.normalize();
    }
    function markIn(el, q) {
        clearMarksIn(el); if (!el || !q) return;
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(function(node){
            var txt = node.nodeValue, low = txt.toLowerCase(), idx = low.indexOf(q);
            if (idx < 0) return;
            var frag = document.createDocumentFragment(), pos = 0;
            while (idx >= 0) {
                if (idx > pos) frag.appendChild(document.createTextNode(txt.slice(pos, idx)));
                var mk = document.createElement('mark'); mk.className = 'gmem-dex-hl'; mk.textContent = txt.slice(idx, idx + q.length);
                frag.appendChild(mk); pos = idx + q.length; idx = low.indexOf(q, pos);
            }
            if (pos < txt.length) frag.appendChild(document.createTextNode(txt.slice(pos)));
            node.parentNode.replaceChild(frag, node);
        });
    }
    function doCatalogSearch(kind) {
        var input = panelInput(), results = panelResults(); if (!input || !results) return;
        rebuildCatalogIndexes();
        updateModeUI();
        var clearBtn = panelRoot() && panelRoot().querySelector('.gmem-dex-clear');
        if (clearBtn) clearBtn.classList.toggle('show', !!input.value);
        var q = (input.value || '').trim().toLowerCase();
        var modeKey = kind === 'shin' ? 'shin' : (kind === 'doll' ? 'doll' : 'relic');
        var list = kind === 'shin' ? SHIN_INDEX : (kind === 'doll' ? DOLL_INDEX : RELIC_INDEX);
        var label = kind === 'shin' ? '脛甲' : (kind === 'doll' ? '魔法娃娃' : '遺物');
        var icon = kind === 'shin' ? '🦵' : (kind === 'doll' ? '🪆' : '🏺');
        var cls = catalogClsFor(modeKey);
        if (kind === 'doll') {
            if (cls && cls !== 'all') list = list.filter(function(it){ return itemMatchesDollTier(it.tier, cls); });
        } else if (cls && cls !== 'all') {
            list = list.filter(function(it){ return itemMatchesClass(it.req, cls); });
        }
        if (q) list = list.filter(function(it){ return catalogQueryMatch(it.hay, q); });
        if (!list.length) {
            results.innerHTML = '<div class="gmem-dex-hint">' + ((q || (cls && cls !== 'all')) ? ('找不到符合的' + label) : ('此版本沒有' + label + '資料')) + '</div>';
            return;
        }
        var scope;
        if (kind === 'doll') scope = (cls && cls !== 'all') ? (DOLL_TIER_CN[cls] || cls) : '全部';
        else scope = (cls && cls !== 'all') ? (_CLS_CN[cls] || cls) : '全部';
        var html = '<div class="gmem-dex-imatch-h">' + icon + ' ' + label + ' · ' + scope + '（' + list.length + '）</div>';
        html += list.map(function(it){ return itemDetailHTML(it); }).join('');
        results.innerHTML = html;
    }
    function doSearch() {
        if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }
        var mode = panelMode();
        if (mode === 'relic') { doCatalogSearch('relic'); return; }
        if (mode === 'shin') { doCatalogSearch('shin'); return; }
        if (mode === 'doll') { doCatalogSearch('doll'); return; }
        var input = panelInput(), results = panelResults(); if (!input || !results) return;
        if (!buildIndexes()) { results.innerHTML = '<div class="gmem-dex-hint">遊戲資料尚未載入，請稍後再試</div>'; return; }
        ensureSpecialPanel();
        updateModeUI();
        var clearBtn = panelRoot() && panelRoot().querySelector('.gmem-dex-clear');
        if (clearBtn) clearBtn.classList.toggle('show', !!input.value);
        updateSrcBtn();
        var q = (input.value || '').trim().toLowerCase();
        if (!q) { results.innerHTML = '<div class="gmem-dex-hint">輸入 怪物名 / 地圖 / 掉落物 開始搜尋</div>'; return; }
        Array.prototype.forEach.call(document.querySelectorAll('#gm-ext-manager-modal .gmem-dex-sp-item'), function(it){
            it.classList.remove('gmem-dex-sp-hit'); clearMarksIn(it);
        });
        var parts = parseSearchParts(q);
        var multiMob = q.indexOf('/') >= 0;
        var qSingle = (!multiMob && parts.length === 1) ? parts[0] : '';
        var exact = qSingle ? findExactItem(qSingle) : null;
        var exactHTML = exact ? itemDetailHTML(exact) : '';
        var itemHTML = exactHTML + (qSingle ? itemMatchesHTML(qSingle) : '');
        var hits = [];
        for (var i = 0; i < INDEX.length && hits.length <= MAX_RESULTS; i++) {
            if (multiMob) {
                var mobName = String(INDEX[i].mob.n || '').toLowerCase();
                if (parts.indexOf(mobName) >= 0) hits.push(INDEX[i]);
            } else if (hayMatchesParts(INDEX[i].hay, parts)) {
                hits.push(INDEX[i]);
            }
        }
        if (!hits.length) {
            if (!itemHTML.trim()) {
                results.innerHTML = '<div class="gmem-dex-hint">找不到符合的怪物或物品</div>';
                return;
            }
            results.innerHTML = itemHTML;
            return;
        }
        var truncated = hits.length > MAX_RESULTS; if (truncated) hits = hits.slice(0, MAX_RESULTS);
        var hlQ = qSingle || parts[0] || q;
        var html = itemHTML + hits.map(function(h){ return cardHTML(h, hlQ); }).join('');
        if (truncated) html += '<div class="gmem-dex-hint">符合的太多，只顯示前 ' + MAX_RESULTS + ' 筆，請輸入更精確的關鍵字。</div>';
        results.innerHTML = html;
    }
    function debouncedSearch() { if (_searchTimer) clearTimeout(_searchTimer); _searchTimer = setTimeout(function(){ _searchTimer = null; doSearch(); }, SEARCH_DEBOUNCE_MS); }
    function setQuery(q) { var input = panelInput(); if (!input) return; input.value = q || ''; setQueryCache(panelMode(), input.value); doSearch(); var scroll = panelScroll(); if (scroll) scroll.scrollTop = 0; setScrollCache(panelMode(), 0); }
    function syncPanel(state) {
        var root = panelRoot(); if (!root) return;
        var dexPanel = root.querySelector('.gmem-dex-panel');
        rebuildCatalogIndexes();
        updateCatalogBtns();
        if (!dexPanel || dexPanel.style.display === 'none') return;
        if (state && typeof state === 'object') {
            if (typeof state.drop === 'string') _dropQueryCache = state.drop;
            if (typeof state.relic === 'string') _relicQueryCache = state.relic;
            if (typeof state.shin === 'string') _shinQueryCache = state.shin;
            if (typeof state.doll === 'string') _dollQueryCache = state.doll;
            if (typeof state.dropScroll === 'number') _dropScrollCache = state.dropScroll;
            if (typeof state.relicScroll === 'number') _relicScrollCache = state.relicScroll;
            if (typeof state.shinScroll === 'number') _shinScrollCache = state.shinScroll;
            if (typeof state.dollScroll === 'number') _dollScrollCache = state.dollScroll;
            if (typeof state.relicCls === 'string') _relicClsCache = state.relicCls || 'all';
            if (typeof state.shinCls === 'string') _shinClsCache = state.shinCls || 'all';
            if (typeof state.dollCls === 'string') _dollClsCache = state.dollCls || 'all';
            if (state.mode === 'relic' || state.mode === 'shin' || state.mode === 'doll' || state.mode === 'drop') {
                dexPanel.setAttribute('data-mode', state.mode);
            }
        }
        buildIndexes();
        var mode = panelMode();
        var input = panelInput();
        if (input) input.value = queryCacheFor(mode);
        updateModeUI();
        if (mode === 'drop') ensureSpecialPanel();
        doSearch();
        restoreScroll(mode);
        if (state && state.focus && input) try { input.focus(); } catch(e){}
    }
    if (!window.__gmGmemDexBound) {
        window.__gmGmemDexBound = true;
        document.addEventListener('input', function(e){
            var api = window.__gmGmemDex;
            if (api && typeof api._onInput === 'function') api._onInput(e);
        });
        document.addEventListener('click', function(e){
            var api = window.__gmGmemDex;
            if (api && typeof api._onClick === 'function') api._onClick(e);
        });
        document.addEventListener('scroll', function(e){
            var api = window.__gmGmemDex;
            if (api && typeof api._onScroll === 'function') api._onScroll(e);
        }, true);
    }
    window.__gmGmemDex = {
        ver: GMEM_DEX_VER,
        syncPanel: syncPanel,
        syncCatalogBtns: syncCatalogBtns,
        doSearch: doSearch,
        buildIndexes: buildIndexes,
        gotoDropQuery: gotoDropQuery,
        saveCurrentModeState: saveCurrentModeState,
        invalidate: function(){ _ready = false; _craftIndex = null; _craftMatIndex = null; _npcInfo = null; _trialBy = null; _shopIndex = null; _boxBy = null; },
        _onInput: function(e){
            if (e.target && e.target.matches && e.target.matches('#gm-ext-manager-modal .gmem-dex-input')) {
                setQueryCache(panelMode(), e.target.value);
                debouncedSearch();
            }
        },
        _onClick: function(e){
            if (!e.target || !e.target.closest) return;
            var root = panelRoot(); if (!root || !root.contains(e.target)) return;
            var clsBtn = e.target.closest('.gmem-dex-cls');
            if (clsBtn) {
                var mode = panelMode();
                if (mode !== 'relic' && mode !== 'shin' && mode !== 'doll') return;
                setCatalogCls(mode, clsBtn.getAttribute('data-cls') || 'all');
                setScrollCache(mode, 0);
                updateClsBarUI();
                doSearch();
                restoreScroll(mode);
                return;
            }
            var srcBtn = e.target.closest('.gmem-dex-src-btn');
            if (srcBtn) {
                var next = srcBtn.getAttribute('data-src') === 'original' ? 'current' : 'original';
                srcBtn.setAttribute('data-src', next);
                srcBtn.textContent = next === 'original' ? '原始資料' : '當前難度';
                doSearch();
                return;
            }
            var clearBtn = e.target.closest('.gmem-dex-clear');
            if (clearBtn) { var i = panelInput(); if (i) { i.value = ''; setQueryCache(panelMode(), ''); doSearch(); i.focus(); } return; }
            var droplink = e.target.closest('.gmem-dex-droplink');
            if (droplink) { gotoDropQuery(droplink.getAttribute('data-mobs') || ''); return; }
            var map = e.target.closest('.gmem-dex-maplink');
            if (map) { setQuery(map.getAttribute('data-map') || ''); return; }
            var iname = e.target.closest('.gmem-dex-iname');
            if (iname) { setQuery(iname.getAttribute('data-item') || ''); return; }
        },
        _onScroll: function(e){
            if (!e.target || !e.target.classList || !e.target.classList.contains('gmem-dex-scroll')) return;
            if (!panelRoot() || !panelRoot().contains(e.target)) return;
            setScrollCache(panelMode(), e.target.scrollTop);
        }
    };
})();`);
    }

    function buildGmemDexPanelHtml() {
        const clsBtns = [
            ['all', '全部'],
            ['royal', '王族'],
            ['knight', '騎士'],
            ['mage', '法師'],
            ['elf', '妖精'],
            ['dark', '黑暗妖精'],
            ['illusion', '幻術士'],
            ['dragon', '龍騎士'],
            ['warrior', '戰士']
        ].map(([id, label], i) => `          <button type="button" class="gmem-dex-cls${i === 0 ? ' is-active' : ''}" data-cls="${id}">${label}</button>`).join('');
        return [
            '      <div class="gmem-dex-head">',
            '        <div class="gmem-dex-toolbar">',
            '          <span class="gmem-dex-inwrap">',
            '            <input type="text" class="gmem-dex-input" placeholder="搜尋 怪物 / 地圖 / 掉落物…" autocomplete="off">',
            '            <button type="button" class="gmem-dex-clear" title="清除" aria-label="清除">✕</button>',
            '          </span>',
            '          <button type="button" class="gmem-dex-src-btn" data-src="current">當前難度</button>',
            '        </div>',
            '        <div class="gmem-dex-clsbar" style="display:none;">',
            clsBtns,
            '        </div>',
            '      </div>',
            '      <div class="gmem-dex-scroll">',
            '        <div class="gmem-dex-results"><div class="gmem-dex-hint">輸入 怪物名 / 地圖 / 掉落物 開始搜尋</div></div>',
            '      </div>'
        ].join('');
    }

    function installInventoryUiHook() {
        injectInventoryUiPageHook();
    }

    function openDexSearchWithQuery(q) {
        const query = String(q || '').trim();
        if (!query) return;
        try {
            injectPageScript(`(function(){
    try { if (typeof closeModal === 'function') closeModal(); else { var m = document.getElementById('item-modal'); if (m) m.classList.add('hidden'); } } catch (e) {}
    try { if (typeof closeEquipBook === 'function') closeEquipBook(); } catch (e) {}
    try { if (typeof closeMiscBook === 'function') closeMiscBook(); } catch (e) {}
    try { if (typeof closeRelicBook === 'function') closeRelicBook(); } catch (e) {}
    try { if (typeof closeCardBook === 'function') closeCardBook(); } catch (e) {}
    try { if (typeof closeCollectionPanel === 'function') closeCollectionPanel(); } catch (e) {}
})();`);
        } catch (e) {
            const m = document.getElementById('item-modal');
            if (m) m.classList.add('hidden');
        }
        _gmemDexMode = 'drop';
        _gmemDexQuery = query;
        _gmemDexScroll = 0;
        openExtensionManagerModal('dex');
    }

    if (!window.__gmCodexDexClickBound) {
        window.__gmCodexDexClickBound = true;
        document.addEventListener('click', (ev) => {
            const el = ev.target && ev.target.closest ? ev.target.closest('.gm-codex-dex-click') : null;
            if (!el) return;
            if (!el.closest('#equip-book, #misc-book, #relic-book, #card-book')) return;
            const q = el.getAttribute('data-q') || '';
            if (!q) return;
            ev.preventDefault();
            ev.stopPropagation();
            openDexSearchWithQuery(q);
        }, true);
    }

    function installItemModalDexSearch() {
        if (!installItemModalDexSearch._style) {
            installItemModalDexSearch._style = true;
            GM_addStyle(`
                #modal-item-name .gm-item-dex-btn {
                    flex: 0 0 auto;
                    margin-left: 8px;
                    padding: 2px 8px;
                    border-radius: 6px;
                    border: 1px solid #fbbf24;
                    background: #713f12;
                    color: #fef3c7;
                    font-size: 12px;
                    font-weight: 700;
                    line-height: 1.4;
                    cursor: pointer;
                    white-space: nowrap;
                    vertical-align: middle;
                }
                #modal-item-name .gm-item-dex-btn:hover {
                    filter: brightness(1.12);
                    border-color: #fde68a;
                    color: #fffbeb;
                }
                #modal-item-name .flex.items-center {
                    flex-wrap: wrap;
                    gap: 4px 0;
                }
            `);
        }
        if (!installItemModalDexSearch._click) {
            installItemModalDexSearch._click = true;
            document.addEventListener('click', (ev) => {
                const btn = ev.target && ev.target.closest ? ev.target.closest('.gm-item-dex-btn') : null;
                if (!btn) return;
                ev.preventDefault();
                ev.stopPropagation();
                openDexSearchWithQuery(btn.getAttribute('data-q') || '');
            }, true);
        }
        injectPageScript(`(function(){
    function gmBaseItemName(item) {
        try {
            if (!item || !item.id) return '';
            if (typeof DB !== 'undefined' && DB.items && DB.items[item.id] && DB.items[item.id].n) {
                return String(DB.items[item.id].n);
            }
        } catch (e) {}
        return '';
    }
    function gmInjectItemDexBtn(item) {
        var nameEl = document.getElementById('modal-item-name');
        if (!nameEl) return;
        var q = gmBaseItemName(item);
        var existing = nameEl.querySelector('.gm-item-dex-btn');
        if (!q) {
            if (existing) existing.remove();
            return;
        }
        var flex = nameEl.querySelector('.flex.items-center') || nameEl;
        if (existing) {
            existing.setAttribute('data-q', q);
            existing.setAttribute('title', '掉落查詢：' + q);
            if (!flex.contains(existing)) flex.appendChild(existing);
            return;
        }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gm-item-dex-btn';
        btn.setAttribute('data-q', q);
        btn.setAttribute('title', '掉落查詢：' + q);
        btn.textContent = '查詢';
        flex.appendChild(btn);
    }
    if (typeof openModal === 'function' && !openModal.__gmDexBtn) {
        var _om = openModal;
        openModal = function(item, isEq, slot) {
            var ret = _om.apply(this, arguments);
            try { gmInjectItemDexBtn(item); } catch (e) {}
            return ret;
        };
        openModal.__gmDexBtn = true;
    }
})();`);
    }

    // =========================
    // ✔ 核心合併修改邏輯
    // =========================
    function applyAllModifications() {
        try {
            // 倍率由「修改器」腳本負責；擴充只套用平衡／功能相關
            injectPageDifficultyMods();
            injectPageTeleportBossMode();
            injectPseudoTradDrops();

            if (isFeatureAvailable('invUi')) installInventoryUiHook();
            installItemModalDexSearch();

            return true;
        } catch (e) {
            console.log('[ExtGM] 套用擴充時發生錯誤:', e);
            return false;
        }
    }

    // =========================
    // ✔ 動態更新 GM 選單文字
    // =========================
    async function resetAllSettings() {
        if (!confirm('確定要將所有擴充功能設定恢復為預設值嗎？')) return;
        for (const [key, val] of Object.entries(GM_DEFAULTS)) {
            await gmSet(key, val);
        }
        gmDelete('mob_names_always');
        gmDelete('player_exp_multiplier');
        gmDelete('ally_exp_multiplier');
        gmDelete('enhance_one_sixth_triple');
        gmDelete('bless_plus_one_safe_boost');
        try { gmSet('gm_ext_script_version', SCRIPT_VERSION); } catch (e) {}
        difficultyM = GM_DEFAULTS.difficulty_m;
        teleportBossModeEnabled = GM_DEFAULTS.teleport_boss_mode_enabled;
        sharedInvEnabled = GM_DEFAULTS.shared_inv_enabled;
        sharedGoldEnabled = GM_DEFAULTS.shared_gold_enabled;
        statDetailEnabled = GM_DEFAULTS.stat_detail_enabled;
        inventoryUiMode = GM_DEFAULTS.inventory_ui_mode;
        mobNamesMode = GM_DEFAULTS.mob_names_mode;
        squadSwitchEnabled = GM_DEFAULTS.squad_switch_enabled;
        squadMercUiEnabled = GM_DEFAULTS.squad_merc_ui_enabled;
        collectionRevealEnabled = GM_DEFAULTS.collection_reveal_enabled;
        itemEffDetailEnabled = GM_DEFAULTS.item_eff_detail_enabled;
        allyPresetRestoreEnabled = GM_DEFAULTS.ally_preset_restore_enabled;
        allyArrowDmgEnabled = GM_DEFAULTS.ally_arrow_dmg_enabled;
        wpnEnPetHitEnabled = GM_DEFAULTS.wpn_en_pet_hit_enabled;
        petReevolveEnabled = GM_DEFAULTS.pet_reevolve_enabled;
        pledgeJunkEnSellEnabled = GM_DEFAULTS.pledge_junk_en_sell_enabled;
        castleLoginEnabled = GM_DEFAULTS.castle_login_enabled;
        superBlackMarketEnabled = GM_DEFAULTS.super_black_market_enabled;
        whScrollEnhanceEnabled = GM_DEFAULTS.wh_scroll_enhance_enabled;
        buyShoutNotifyEnabled = GM_DEFAULTS.buy_shout_notify_enabled;
        hideOrigPbarEnabled = GM_DEFAULTS.hide_orig_pbar_enabled;
        invItemSearchEnabled = GM_DEFAULTS.inv_item_search_enabled;
        obelPrideTrackEnabled = GM_DEFAULTS.obel_pride_track_enabled;
        sherineWorldCorrectEnabled = GM_DEFAULTS.sherine_world_correct_enabled;
        sherineGraceNoCdEnabled = GM_DEFAULTS.sherine_grace_nocd_enabled;
        fullRandomEnabled = GM_DEFAULTS.full_random_enabled;
        uiRefreshSec = GM_DEFAULTS.ui_refresh_sec;
        pseudoTradDropsEnabled = GM_DEFAULTS.pseudo_trad_drops_enabled;
        await gmSet(pseudoTradStorageKey(), pseudoTradDropsEnabled);
        applyAllModifications();
        applyMobNamesStyle();
        applyInventoryUiMode();
        applyFullRandomMode();
        syncSharedInvFlagToPage();
        syncSharedGoldFlagToPage();
        syncStatDetailFlagToPage();
        syncAllyPresetFlagToPage();
        syncSquadMercUiFlagToPage();
            syncCollectionRevealFlagToPage();
        syncItemEffDetailFlagToPage();
                syncAllyArrowDmgFlagToPage();
        syncWpnEnPetHitFlagToPage();
                syncPetReevolveFlagToPage({ refresh: true });
        syncPledgeJunkEnSellFlagToPage();
        syncCastleLoginFlagToPage();
                syncSuperBlackMarketFlagToPage();
        syncWhScrollEnhanceFlagToPage();
        syncBuyShoutNotifyFlagToPage();
        syncHideOrigPbarFlagToPage();
        syncInvItemSearchFlagToPage();
            syncSherineWorldCorrectFlagToPage();
        syncSherineGraceNoCdFlagToPage();
        syncUiThrottleFlagToPage();
        applySquadSwitchVisibility();
        scheduleSquadInject(true);
        registerMyMenu();
    }

    function buildAutomationControlSpecs() {
        const mobNameShort = (function(v) {
            if (v === 'default') return '預設';
            if (v === 'always') return '常駐';
            if (v === 'lock') return '鎖定';
            return v || '預設';
        })(mobNamesMode);
        return [
            { id: 'difficulty',
                labelMain: () => '難度係數 · HP×係數^1.5 · 傷害×（0.5+0.5×係數）',
                labelValue: () => difficultyValueLabel(),
                label: () => `難度係數 · HP×係數^1.5 · 傷害×（0.5+0.5×係數） （目前: ${difficultyValueLabel()}）`,
                enabled: () => isFeatureAvailable('difficulty') },
            { id: 'sherineworldcorrect', label: () => `席琳世界補正 （移除AC DR） （目前: ${sherineWorldCorrectEnabled ? '開啟' : '關閉'}）`, enabled: () => true },
            { id: 'sherinegracenocd', label: () => `一般席琳世界 取消恩賜怪冷卻（3分鐘）限制且場上可同時出現多隻 （目前: ${sherineGraceNoCdEnabled ? '開啟' : '關閉'}）`, enabled: () => true },
            { id: 'allyarrow', label: () => `傭兵計算箭矢傷害與特效 （目前: ${allyArrowDmgEnabled ? '開啟' : '關閉'}）`, enabled: () => true },
            { id: 'uithrottle', label: () => {
                const sec = effectiveUiRefreshSec();
                const v = sec <= 0 ? '關閉' : `每 ${sec} 秒 1 次`;
                return `畫面流暢更新 （目前: ${v}）`;
            }, enabled: () => true },
            { id: 'invui', label: () => !isFeatureAvailable('invUi')
                ? '清單式物品欄介面 （目前: 已內建）'
                : `清單式物品欄介面 （目前: ${effectiveInventoryUiMode() === 'list' ? '開啟' : '關閉'}）`,
                enabled: () => isFeatureAvailable('invUi') },
            { id: 'pledgejunkensell',
                labelMain: () => '血盟掉落加值裝備·廢品基底直接賣出（不標記廢品）',
                labelValue: () => (pledgeJunkEnSellEnabled ? '開啟' : '關閉'),
                label: () => `血盟掉落加值裝備·廢品基底直接賣出（不標記廢品） （目前: ${pledgeJunkEnSellEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true },
            { id: 'castlelogin',
                labelMain: () => '擁有城堡時上線不在出生地改為在城堡',
                labelValue: () => (castleLoginEnabled ? '開啟' : '關閉'),
                label: () => `擁有城堡時上線不在出生地改為在城堡 （目前: ${castleLoginEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true },
            { id: 'superbm',
                labelMain: () => '超級黑市（強化公告·極低機率出現遺物販售·收購價區間提示）',
                labelValue: () => (superBlackMarketEnabled ? '開啟' : '關閉'),
                label: () => `超級黑市（強化公告·極低機率出現遺物販售·收購價區間提示） （目前: ${superBlackMarketEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true },
            { id: 'whscrollenh',
                labelMain: () => '武防卷倉庫可用（強化／一鍵／快速強化·背包優先）',
                labelValue: () => (whScrollEnhanceEnabled ? '開啟' : '關閉'),
                label: () => `武防卷倉庫可用（強化／一鍵／快速強化·背包優先） （目前: ${whScrollEnhanceEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true },
            { id: 'buyshoutnotify',
                labelMain: () => '遺物掉落通知（PC端限定·需開啟瀏覽器通知）',
                labelValue: () => (buyShoutNotifyEnabled ? '開啟' : '關閉'),
                label: () => `遺物掉落通知（PC端限定·需開啟瀏覽器通知） （目前: ${buyShoutNotifyEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true },
            { id: 'hideorigpbar',
                labelMain: () => '關閉置頂橫條（非官方轉載提示）',
                labelValue: () => (hasOrigPbar() ? (hideOrigPbarEnabled ? '開啟' : '關閉') : '禁用'),
                label: () => `關閉置頂橫條（非官方轉載提示） （目前: ${hasOrigPbar() ? (hideOrigPbarEnabled ? '開啟' : '關閉') : '禁用'}）`,
                enabled: () => hasOrigPbar() },
            { id: 'invitemsearch',
                labelMain: () => '物品搜尋（武/防/道具共用）',
                labelValue: () => (hasNativeInvItemSearch() ? '禁用' : (invItemSearchEnabled ? '開啟' : '關閉')),
                label: () => `物品搜尋（武/防/道具共用） （目前: ${hasNativeInvItemSearch() ? '禁用' : (invItemSearchEnabled ? '開啟' : '關閉')}）`,
                enabled: () => !hasNativeInvItemSearch() },
            { id: 'obelpride',
                label: () => `魔物追蹤啟用隱藏地圖 （目前: ${obelPrideTrackEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true },
            { id: 'sharedinv',
                labelMain: () => '傭兵共用背包 （會覆蓋其他存檔背包,開啟前請先存倉）',
                labelValue: () => (sharedInvEnabled ? '開啟' : '關閉'),
                label: () => `傭兵共用背包 （會覆蓋其他存檔背包,開啟前請先存倉） （目前: ${sharedInvEnabled ? '開啟' : '關閉'}）`,
                enabled: () => isFeatureAvailable('sharedInv') },
            { id: 'sharedgold',
                labelMain: () => '傭兵共用金幣 （會覆蓋其他存檔金幣,開啟前請先存倉）',
                labelValue: () => (sharedGoldEnabled ? '開啟' : '關閉'),
                label: () => `傭兵共用金幣 （會覆蓋其他存檔金幣,開啟前請先存倉） （目前: ${sharedGoldEnabled ? '開啟' : '關閉'}）`,
                enabled: () => isFeatureAvailable('sharedInv') },
            { id: 'squadswitch',
                label: () => !isAutumnEdition()
                    ? '快速切換角色 （目前: 已內建）'
                    : `快速切換角色 （目前: ${squadSwitchEnabled ? '開啟' : '關閉'}）`,
                enabled: () => isAutumnEdition() && isFeatureAvailable('squadSwitch') },
            { id: 'petreevolve',
                labelMain: () => '寵物重新進化（不降等·需消耗勝利果實）',
                labelValue: () => (petReevolveEnabled ? '開啟' : '關閉'),
                label: () => `寵物重新進化（不降等·需消耗勝利果實） （目前: ${petReevolveEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true },
            { id: 'mobnames',
                label: () => !isAutumnEdition()
                    ? '怪物名稱顯示 （目前: 已內建）'
                    : `怪物名稱顯示 （目前: ${mobNameShort}）`,
                enabled: () => isAutumnEdition() && isFeatureAvailable('mobNames') },
            { id: 'statdetail', label: () => `能力頁屬性詳細資訊 （目前: ${statDetailEnabled ? '開啟' : '關閉'}）`, enabled: () => true },
            { id: 'squadmercui', label: () => `傭兵列表Buff/Debuff狀態 （目前: ${squadMercUiEnabled ? '開啟' : '關閉'}）`, enabled: () => isFeatureAvailable('squadMercUi') },
            { id: 'collectionreveal', label: () => `收藏增強·怪物全資訊＋色框／物品提示／點擊開掉落查詢 （目前: ${collectionRevealEnabled ? '開啟' : '關閉'}）`, enabled: () => true },
            { id: 'itemeffdetail', label: () => `武器特效詳細解說 （目前: ${itemEffDetailEnabled ? '開啟' : '關閉'}）`, enabled: () => true },
            { id: 'allypreset',
                labelMain: () => '重新招募保持設定（傭兵記憶）',
                labelValue: () => (isAutumnEdition()
                    ? '禁用'
                    : (allyPresetRestoreEnabled ? '開啟' : '關閉')),
                label: () => isAutumnEdition()
                    ? '重新招募保持設定（傭兵記憶） （目前: 禁用）'
                    : `重新招募保持設定（傭兵記憶） （目前: ${allyPresetRestoreEnabled ? '開啟' : '關閉'}）`,
                enabled: () => !isAutumnEdition() && isFeatureAvailable('allyPreset') },
            { id: 'wpnenpethit',
                labelMain: () => '寵物命中補正 · 增加 （6−武器安定值+武器強化值）×2',
                labelValue: () => (isAutumnEdition()
                    ? '禁用'
                    : (wpnEnPetHitEnabled ? '開啟' : '關閉')),
                label: () => isAutumnEdition()
                    ? '寵物命中補正 · 增加 （6−武器安定值+武器強化值）×2 （目前: 禁用）'
                    : `寵物命中補正 · 增加 （6−武器安定值+武器強化值）×2 （目前: ${wpnEnPetHitEnabled ? '開啟' : '關閉'}）`,
                enabled: () => !isAutumnEdition() },
            { id: 'pseudo', label: () => `偽傳統掉落 （目前: ${effectivePseudoTradDrops() ? '開啟' : '關閉'}）`, enabled: () => !isNativeTraditionalChar() },
            { id: 'teleport',
                labelMain: () => '傳戒找王模式 （每顆傳戒+100%遭遇率 · 離線有效）',
                labelValue: () => teleportBossModeLabel(),
                label: () => `傳戒找王模式 （每顆傳戒+100%遭遇率 · 離線有效） （目前: ${teleportBossModeLabel()}）`,
                enabled: () => true },
            { id: 'fullrandom',
                labelMain: () => '全隨機模式 （S/L不再固定亂數）',
                labelValue: () => (fullRandomEnabled ? '開啟' : '關閉'),
                label: () => `全隨機模式 （S/L不再固定亂數） （目前: ${fullRandomEnabled ? '開啟' : '關閉'}）`,
                enabled: () => true }
        ];
    }

    function gmPromptNumber(opts) {
        opts = opts || {};
        return new Promise(function(resolve) {
            var old = document.getElementById('gm-ext-number-prompt-modal');
            if (old) old.remove();
            var el = document.createElement('div');
            el.id = 'gm-ext-number-prompt-modal';
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
                if (!document.getElementById('gm-ext-number-prompt-modal')) return;
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    ev.stopPropagation();
                    close(null);
                } else if (ev.key === 'Enter') {
                    ev.preventDefault();
                    ev.stopPropagation();
                    submit();
                }
            }
            el.querySelector('.gmnp-mask').addEventListener('click', function() { close(null); });
            el.querySelector('.gmnp-cancel').addEventListener('click', function() { close(null); });
            el.querySelector('.gmnp-ok').addEventListener('click', submit);
            document.addEventListener('keydown', onKey, true);
            setTimeout(function() {
                try { input.focus(); input.select(); } catch (e2) {}
            }, 0);
        });
    }

    async function runAutomationControlAction(actionId) {
        switch (actionId) {
            case 'difficulty': {
            if (!isFeatureAvailable('difficulty')) return;
                const curPct = difficultyMToPct(difficultyM);
                const input = prompt(`輸入難度係數（${DIFF_PCT_MIN}～${DIFF_PCT_MAX}%，100＝原版）`, curPct);
            if (input === null) return;
                difficultyM = difficultyPctToM(input);
            await gmSet('difficulty_m', difficultyM);
            injectPageDifficultyMods();
                break;
            }
            case 'teleport':
            teleportBossModeEnabled = !teleportBossModeEnabled;
            await gmSet('teleport_boss_mode_enabled', teleportBossModeEnabled);
            injectPageTeleportBossMode();
                break;
            case 'invui':
            if (!isFeatureAvailable('invUi')) return;
                inventoryUiMode = inventoryUiMode === 'list' ? 'grid' : 'list';
            await gmSet('inventory_ui_mode', inventoryUiMode);
            applyInventoryUiMode();
                break;
            case 'pledgejunkensell':
                pledgeJunkEnSellEnabled = !pledgeJunkEnSellEnabled;
                await gmSet('pledge_junk_en_sell_enabled', pledgeJunkEnSellEnabled);
                syncPledgeJunkEnSellFlagToPage();
                break;
            case 'castlelogin':
                castleLoginEnabled = !castleLoginEnabled;
                await gmSet('castle_login_enabled', castleLoginEnabled);
                syncCastleLoginFlagToPage();
                break;
            case 'superbm':
                superBlackMarketEnabled = !superBlackMarketEnabled;
                await gmSet('super_black_market_enabled', superBlackMarketEnabled);
                syncSuperBlackMarketFlagToPage();
                break;
            case 'whscrollenh':
                whScrollEnhanceEnabled = !whScrollEnhanceEnabled;
                await gmSet('wh_scroll_enhance_enabled', whScrollEnhanceEnabled);
                syncWhScrollEnhanceFlagToPage();
                break;
            case 'buyshoutnotify':
                buyShoutNotifyEnabled = !buyShoutNotifyEnabled;
                await gmSet('buy_shout_notify_enabled', buyShoutNotifyEnabled);
                syncBuyShoutNotifyFlagToPage();
                if (buyShoutNotifyEnabled) requestBuyShoutNotifyPermission();
                break;
            case 'hideorigpbar':
                if (!hasOrigPbar()) return;
                hideOrigPbarEnabled = !hideOrigPbarEnabled;
                await gmSet('hide_orig_pbar_enabled', hideOrigPbarEnabled);
                syncHideOrigPbarFlagToPage();
                break;
            case 'invitemsearch':
                if (hasNativeInvItemSearch()) return;
                invItemSearchEnabled = !invItemSearchEnabled;
                await gmSet('inv_item_search_enabled', invItemSearchEnabled);
                syncInvItemSearchFlagToPage();
                break;
            case 'obelpride':
                obelPrideTrackEnabled = !obelPrideTrackEnabled;
                await gmSet('obel_pride_track_enabled', obelPrideTrackEnabled);
                syncObelPrideTrackFlagToPage();
                break;
            case 'sharedinv':
            if (!isFeatureAvailable('sharedInv')) return;
            sharedInvEnabled = !sharedInvEnabled;
            await gmSet('shared_inv_enabled', sharedInvEnabled);
            syncSharedInvFlagToPage();
                break;
            case 'sharedgold':
            if (!isFeatureAvailable('sharedInv')) return;
            sharedGoldEnabled = !sharedGoldEnabled;
            await gmSet('shared_gold_enabled', sharedGoldEnabled);
            syncSharedGoldFlagToPage();
                break;
            case 'mobnames':
                if (!isAutumnEdition() || !isFeatureAvailable('mobNames')) return;
            mobNamesMode = MOB_NAMES_MODES[(MOB_NAMES_MODES.indexOf(mobNamesMode) + 1) % MOB_NAMES_MODES.length];
            await gmSet('mob_names_mode', mobNamesMode);
            applyMobNamesStyle();
                break;
            case 'statdetail':
                statDetailEnabled = !statDetailEnabled;
                await gmSet('stat_detail_enabled', statDetailEnabled);
                syncStatDetailFlagToPage();
                break;
            case 'squadswitch':
                if (!isAutumnEdition() || !isFeatureAvailable('squadSwitch')) return;
            squadSwitchEnabled = !squadSwitchEnabled;
            await gmSet('squad_switch_enabled', squadSwitchEnabled);
            applySquadSwitchVisibility();
                scheduleSquadInject(true);
                break;
            case 'petreevolve':
                petReevolveEnabled = !petReevolveEnabled;
                await gmSet('pet_reevolve_enabled', petReevolveEnabled);
                syncPetReevolveFlagToPage({ refresh: true });
                break;
            case 'squadmercui':
                if (!isFeatureAvailable('squadMercUi')) return;
                squadMercUiEnabled = !squadMercUiEnabled;
                await gmSet('squad_merc_ui_enabled', squadMercUiEnabled);
                syncSquadMercUiFlagToPage();
                break;
            case 'collectionreveal':
                collectionRevealEnabled = !collectionRevealEnabled;
                await gmSet('collection_reveal_enabled', collectionRevealEnabled);
                syncCollectionRevealFlagToPage();
                break;
            case 'itemeffdetail':
                itemEffDetailEnabled = !itemEffDetailEnabled;
                await gmSet('item_eff_detail_enabled', itemEffDetailEnabled);
                syncItemEffDetailFlagToPage();
                break;
            case 'allypreset':
                if (isAutumnEdition() || !isFeatureAvailable('allyPreset')) return;
            allyPresetRestoreEnabled = !allyPresetRestoreEnabled;
            await gmSet('ally_preset_restore_enabled', allyPresetRestoreEnabled);
            syncAllyPresetFlagToPage();
                break;
            case 'allyarrow':
                allyArrowDmgEnabled = !allyArrowDmgEnabled;
                await gmSet('ally_arrow_dmg_enabled', allyArrowDmgEnabled);
                syncAllyArrowDmgFlagToPage();
                break;
            case 'wpnenpethit':
                if (isAutumnEdition()) break;
                wpnEnPetHitEnabled = !wpnEnPetHitEnabled;
                await gmSet('wpn_en_pet_hit_enabled', wpnEnPetHitEnabled);
                syncWpnEnPetHitFlagToPage();
                break;
            case 'sherineworldcorrect':
                sherineWorldCorrectEnabled = !sherineWorldCorrectEnabled;
                await gmSet('sherine_world_correct_enabled', sherineWorldCorrectEnabled);
                syncSherineWorldCorrectFlagToPage();
                break;
            case 'sherinegracenocd':
                sherineGraceNoCdEnabled = !sherineGraceNoCdEnabled;
                await gmSet('sherine_grace_nocd_enabled', sherineGraceNoCdEnabled);
                syncSherineGraceNoCdFlagToPage();
                break;
            case 'fullrandom':
            fullRandomEnabled = !fullRandomEnabled;
            await gmSet('full_random_enabled', fullRandomEnabled);
            applyFullRandomMode();
                break;
            case 'uithrottle':
                uiRefreshSec = [0, 1, 2, 3][([0, 1, 2, 3].indexOf(effectiveUiRefreshSec()) + 1) % 4];
                await gmSet('ui_refresh_sec', uiRefreshSec);
                syncUiThrottleFlagToPage();
                break;
            case 'pseudo':
                if (isNativeTraditionalChar()) return;
                pseudoTradDropsEnabled = !pseudoTradDropsEnabled;
                await gmSet(pseudoTradStorageKey(), pseudoTradDropsEnabled);
                injectPseudoTradDrops();
                break;
            case 'junkprefs':
                openJunkPrefsManagerMenu();
                break;
            case 'reset':
                await resetAllSettings();
                break;
            default:
                return;
        }
            registerMyMenu();
        renderAutomationControlPanel();
    }

    function closeExtensionManagerModal() {
        const el = document.getElementById('gm-ext-manager-modal');
        if (el) captureGmemDexState(el);
        if (el) el.remove();
    }

    function extensionSpecTab(spec) {
        if (!spec || !spec.id) return 'features';
        if (['difficulty', 'sherineworldcorrect', 'sherinegracenocd', 'allyarrow', 'wpnenpethit'].indexOf(spec.id) >= 0) return 'balance';
        return 'features';
    }

    function extensionSpecFocus(spec) {
        return spec && (spec.id === 'uithrottle' || spec.id === 'difficulty');
    }

    function formatExtensionRowLabel(spec) {
        if (typeof spec.labelMain === 'function' && typeof spec.labelValue === 'function') {
            return { left: spec.labelMain(), right: spec.labelValue() };
        }
        const full = spec.label();
        const m = full.match(/^(.*)\s*（目前:\s*(.*)）\s*$/);
        return { left: m ? m[1].trim() : full, right: m ? m[2].trim() : '' };
    }

    function escapeGmemHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatExtensionRowValueHtml(right) {
        const text = String(right || '');
        if (text === '開啟') return '<span class="gmem-val-on">開啟</span>';
        if (text === '關閉') return '<span class="gmem-val-off">關閉</span>';
        if (text === '禁用') return '<span class="gmem-val-off">禁用</span>';
        return escapeGmemHtml(text);
    }

    function isGmemQueryTab(tab) {
        return tab === 'query' || tab === 'dex' || tab === 'relic' || tab === 'shin' || tab === 'doll';
    }

    function resolveGmemQueryTab(tab) {
        if (tab === 'query') {
            if (_gmemDexMode === 'relic') return 'relic';
            if (_gmemDexMode === 'shin') return 'shin';
            if (_gmemDexMode === 'doll') return 'doll';
            return 'dex';
        }
        return tab;
    }

    function switchExtensionManagerTab(el, nextTab) {
        if (!el) return;
        nextTab = resolveGmemQueryTab(nextTab);
        const isDex = nextTab === 'dex';
        const isRelic = nextTab === 'relic';
        const isShin = nextTab === 'shin';
        const isDoll = nextTab === 'doll';
        const isDexPanel = isDex || isRelic || isShin || isDoll;
        el.querySelectorAll('button.gmem-tab').forEach((b) => {
            const sw = b.getAttribute('data-tab-switch');
            if (sw === 'query') b.classList.toggle('is-active', isDexPanel);
            else b.classList.toggle('is-active', !isDexPanel && sw === nextTab);
        });
        const subWrap = el.querySelector('.gmem-query-subtabs');
        if (subWrap) subWrap.style.display = isDexPanel ? '' : 'none';
        const dexBtn = el.querySelector('.gmem-dex-btn');
        const relicBtn = el.querySelector('.gmem-relic-btn');
        const shinBtn = el.querySelector('.gmem-shin-btn');
        const dollBtn = el.querySelector('.gmem-doll-btn');
        if (dexBtn) dexBtn.classList.toggle('is-active', isDex);
        if (relicBtn) relicBtn.classList.toggle('is-active', isRelic);
        if (shinBtn) shinBtn.classList.toggle('is-active', isShin);
        if (dollBtn) dollBtn.classList.toggle('is-active', isDoll);
        const listEl = el.querySelector('.gmem-list');
        const junkEl = el.querySelector('.gmem-junk-panel');
        const dexEl = el.querySelector('.gmem-dex-panel');
        if (listEl) listEl.style.display = (isDexPanel || nextTab === 'junk') ? 'none' : '';
        if (junkEl) junkEl.style.display = nextTab === 'junk' ? '' : 'none';
        if (dexEl) {
            dexEl.style.display = isDexPanel ? '' : 'none';
            if (isDexPanel) {
                _gmemDexMode = isRelic ? 'relic' : (isShin ? 'shin' : (isDoll ? 'doll' : 'drop'));
                dexEl.setAttribute('data-mode', _gmemDexMode);
                const input = dexEl.querySelector('.gmem-dex-input');
                if (input) input.value = gmemDexQueryForMode(_gmemDexMode);
            }
        }
        const bodyEl = el.querySelector('.gmem-body');
        if (bodyEl) bodyEl.classList.toggle('is-dex', isDexPanel);
        if (!isDexPanel && nextTab !== 'junk') {
            el.querySelectorAll('.gmem-row').forEach((row) => {
                row.style.display = (row.getAttribute('data-tab') === nextTab) ? '' : 'none';
            });
        }
        if (nextTab === 'junk') {
            const junkInput = el.querySelector('.gmem-junk-input');
            if (junkInput) junkInput.value = _gmemJunkQuery || '';
            refreshExtensionManagerJunkPanel();
        }
        if (isDexPanel) syncGmGmemDexPanel({ focus: false });
        else refreshGmemCatalogButtons();
    }

    function openExtensionManagerModal(activeTab) {
        const prev = document.getElementById('gm-ext-manager-modal');
        if (prev) captureGmemDexState(prev);
        closeExtensionManagerModal();
        const specs = buildAutomationControlSpecs();
        let tab = ['features', 'balance', 'junk', 'query', 'dex', 'relic', 'shin', 'doll'].includes(activeTab) ? activeTab : 'features';
        tab = resolveGmemQueryTab(tab);
        if (tab === 'dex') _gmemDexMode = 'drop';
        if (tab === 'relic') _gmemDexMode = 'relic';
        if (tab === 'shin') _gmemDexMode = 'shin';
        if (tab === 'doll') _gmemDexMode = 'doll';
        const isDexPanel = tab === 'dex' || tab === 'relic' || tab === 'shin' || tab === 'doll';
        const rows = specs.map((spec) => {
            const disabled = !spec.enabled();
            const parts = formatExtensionRowLabel(spec);
            const left = parts.left;
            const right = parts.right;
            const cat = extensionSpecTab(spec);
            const hidden = (cat !== tab || tab === 'junk' || isDexPanel) ? ' style="display:none;"' : '';
            const focus = extensionSpecFocus(spec) ? ' is-focus' : '';
            return `<button type="button" class="gmem-row${focus}${disabled ? ' is-disabled' : ''}" data-action="${spec.id}" data-tab="${cat}" ${disabled ? 'disabled' : ''}${hidden}><span class="gmem-row-main">${left}</span><span class="gmem-row-value">${formatExtensionRowValueHtml(right)}</span></button>`;
        }).join('');
        const panelModeAttr = (_gmemDexMode === 'relic' || _gmemDexMode === 'shin' || _gmemDexMode === 'doll') ? _gmemDexMode : 'drop';
        const el = document.createElement('div');
        el.id = 'gm-ext-manager-modal';
        el.innerHTML = [
            '<div class="gmem-mask"></div>',
            '<div class="gmem-box">',
            '  <div class="gmem-head">',
            '    <div class="gmem-head-row">',
            '      <span class="gmem-title">擴充功能管理</span>',
            '      <button type="button" class="gmem-reset" data-action-reset="1">重置設定</button>',
            '      <span class="gmem-spacer"></span>',
            '      <button type="button" class="gmem-x" data-close="1">關閉</button>',
            '    </div>',
            '    <div class="gmem-tabs-row">',
            '      <div class="gmem-tabs">',
            `        <button type="button" class="gmem-tab${tab === 'features' ? ' is-active' : ''}" data-tab-switch="features">功能調整</button>`,
            `        <button type="button" class="gmem-tab${tab === 'balance' ? ' is-active' : ''}" data-tab-switch="balance">平衡調整</button>`,
            `        <button type="button" class="gmem-tab${tab === 'junk' ? ' is-active' : ''}" data-tab-switch="junk">廢品管理</button>`,
            `        <button type="button" class="gmem-tab${isDexPanel ? ' is-active' : ''}" data-tab-switch="query">即時查詢</button>`,
            '      </div>',
            `      <div class="gmem-query-subtabs"${isDexPanel ? '' : ' style="display:none;"'}>`,
            `        <button type="button" class="gmem-shin-btn${tab === 'shin' ? ' is-active' : ''}" style="display:none;">脛甲</button>`,
            `        <button type="button" class="gmem-relic-btn${tab === 'relic' ? ' is-active' : ''}" style="display:none;">遺物</button>`,
            `        <button type="button" class="gmem-doll-btn${tab === 'doll' ? ' is-active' : ''}" style="display:none;">魔法娃娃</button>`,
            `        <button type="button" class="gmem-dex-btn${tab === 'dex' ? ' is-active' : ''}">掉落查詢</button>`,
            '      </div>',
            '    </div>',
            '  </div>',
            '  <div class="gmem-body">',
            `    <div class="gmem-list"${tab === 'junk' || isDexPanel ? ' style="display:none;"' : ''}>`, rows, '</div>',
            `    <div class="gmem-junk-panel"${tab !== 'junk' ? ' style="display:none;"' : ''}>`,
            '      <div class="gmem-junk-toolbar">',
            '        <span class="gmem-junk-inwrap">',
            '          <input type="text" class="gmem-junk-input" placeholder="搜尋廢品名稱／強化／祝福…" autocomplete="off">',
            '          <button type="button" class="gmem-junk-clear" title="清除" aria-label="清除">✕</button>',
            '        </span>',
            '      </div>',
            '      <div class="gmem-junk-list"></div>',
            '    </div>',
            `    <div class="gmem-dex-panel" data-mode="${panelModeAttr}"${isDexPanel ? '' : ' style="display:none;"'}>`,
            buildGmemDexPanelHtml(),
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');
        document.body.appendChild(el);
        const bodyEl = el.querySelector('.gmem-body');
        if (bodyEl) bodyEl.classList.toggle('is-dex', isDexPanel);
        const dexInput = el.querySelector('.gmem-dex-input');
        const dexSrcBtn = el.querySelector('.gmem-dex-src-btn');
        if (dexInput) dexInput.value = gmemDexQueryForMode(panelModeAttr);
        if (dexSrcBtn) {
            dexSrcBtn.setAttribute('data-src', _gmemDexDataSrc);
            dexSrcBtn.textContent = gmemDexSrcLabel(_gmemDexDataSrc);
        }
        if (tab === 'junk') {
            const junkInput = el.querySelector('.gmem-junk-input');
            if (junkInput) junkInput.value = _gmemJunkQuery || '';
            refreshExtensionManagerJunkPanel();
            if (junkInput) {
                try { junkInput.focus(); } catch (e) {}
            }
        }
        if (isDexPanel) syncGmGmemDexPanel({ focus: true });
        else refreshGmemCatalogButtons();
        el.addEventListener('click', async (ev) => {
            const closeBtn = ev.target && ev.target.closest ? ev.target.closest('[data-close="1"], .gmem-mask') : null;
            if (closeBtn) { closeExtensionManagerModal(); return; }
            const resetBtn = ev.target && ev.target.closest ? ev.target.closest('button[data-action-reset="1"]') : null;
            if (resetBtn) {
                await runAutomationControlAction('reset');
                openExtensionManagerModal(tab);
                return;
            }
            const junkClearBtn = ev.target && ev.target.closest ? ev.target.closest('button.gmem-junk-clear') : null;
            if (junkClearBtn) {
                _gmemJunkQuery = '';
                const junkInput = el.querySelector('.gmem-junk-input');
                if (junkInput) junkInput.value = '';
                refreshExtensionManagerJunkPanel();
                if (junkInput) {
                    try { junkInput.focus(); } catch (e) {}
                }
                return;
            }
            const junkRemoveBtn = ev.target && ev.target.closest ? ev.target.closest('button[data-junk-remove]') : null;
            if (junkRemoveBtn) {
                removeJunkPrefSig(decodeURIComponent(junkRemoveBtn.getAttribute('data-junk-remove') || ''));
                refreshExtensionManagerJunkPanel();
                return;
            }
            const shinOpenBtn = ev.target && ev.target.closest ? ev.target.closest('button.gmem-shin-btn') : null;
            if (shinOpenBtn) {
                captureGmemDexState(el);
                _gmemDexMode = 'shin';
                switchExtensionManagerTab(el, 'shin');
                return;
            }
            const relicOpenBtn = ev.target && ev.target.closest ? ev.target.closest('button.gmem-relic-btn') : null;
            if (relicOpenBtn) {
                captureGmemDexState(el);
                _gmemDexMode = 'relic';
                switchExtensionManagerTab(el, 'relic');
                return;
            }
            const dollOpenBtn = ev.target && ev.target.closest ? ev.target.closest('button.gmem-doll-btn') : null;
            if (dollOpenBtn) {
                captureGmemDexState(el);
                _gmemDexMode = 'doll';
                switchExtensionManagerTab(el, 'doll');
                return;
            }
            const dexDropLink = ev.target && ev.target.closest ? ev.target.closest('.gmem-dex-droplink') : null;
            if (dexDropLink) {
                captureGmemDexState(el);
                _gmemDexMode = 'drop';
                _gmemDexQuery = dexDropLink.getAttribute('data-mobs') || '';
                _gmemDexScroll = 0;
                return;
            }
            const dexOpenBtn = ev.target && ev.target.closest ? ev.target.closest('button.gmem-dex-btn') : null;
            if (dexOpenBtn) {
                captureGmemDexState(el);
                _gmemDexMode = 'drop';
                switchExtensionManagerTab(el, 'dex');
                return;
            }
            const tabBtn = ev.target && ev.target.closest ? ev.target.closest('button[data-tab-switch]') : null;
            if (tabBtn) {
                captureGmemDexState(el);
                const nextTab = tabBtn.getAttribute('data-tab-switch') || 'rates';
                switchExtensionManagerTab(el, nextTab);
                return;
            }
            const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-action]') : null;
            if (!btn || btn.disabled) return;
            const actionId = btn.getAttribute('data-action');
            const currentTab = btn.getAttribute('data-tab') || tab;
            await runAutomationControlAction(actionId);
            openExtensionManagerModal(currentTab);
        });
        el.addEventListener('input', (ev) => {
            if (!ev.target || !ev.target.classList || !ev.target.classList.contains('gmem-junk-input')) return;
            _gmemJunkQuery = ev.target.value || '';
            refreshExtensionManagerJunkPanel();
        });
        el.addEventListener('keydown', (ev) => {
            if (!ev.target || !ev.target.classList || !ev.target.classList.contains('gmem-junk-input')) return;
            if (ev.key === 'Escape') {
                ev.preventDefault();
                _gmemJunkQuery = '';
                ev.target.value = '';
                refreshExtensionManagerJunkPanel();
            }
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

    function renderAutomationControlPanel() {
        const container = getAutomationPanelContainer();
        if (!container) return;
        let host = document.getElementById('gm-ext-controls');
        if (!host) {
            host = document.createElement('div');
            host.id = 'gm-ext-controls';
            host.className = 'gm-ext-controls';
            const modHost = document.getElementById('gm-mod-controls');
            if (modHost && modHost.parentElement === container) {
                if (modHost.nextSibling) container.insertBefore(host, modHost.nextSibling);
                else container.appendChild(host);
            } else {
                container.appendChild(host);
            }
        } else if (host.parentElement !== container) {
            container.appendChild(host);
        }

        host.innerHTML = '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gm-ext-controls-btn';
        btn.dataset.action = 'open-ext-manager';
        btn.textContent = '開啟擴充功能管理';
        host.appendChild(btn);

        if (!host.dataset.bound) {
            host.dataset.bound = '1';
            host.addEventListener('click', (ev) => {
                const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-action]') : null;
                if (!btn || btn.disabled) return;
                if (btn.dataset.action === 'open-ext-manager') openExtensionManagerModal();
            });
        }
    }

    function registerMyMenu() {
        if (!canUseGmMenu()) return;
        unregisterMenu(menuExtManagerId);
        menuExtManagerId = GM_registerMenuCommand('開啟擴充功能管理', () => {
            openExtensionManagerModal();
        });
    }

    function applyMobNamesStyle() {
        const id = 'gm-mob-names-style';
        let el = document.getElementById(id);
        const mode = effectiveMobNamesMode();
        if (mode === 'default' || !isFeatureAvailable('mobNames')) {
            if (el) el.remove();
            return;
        }
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            (document.head || document.documentElement).appendChild(el);
        }
        if (mode === 'always') {
            el.textContent = '#battle-view .mob-name { opacity: 1 !important; }';
        } else if (mode === 'lock') {
            el.textContent = [
                '#battle-view .mob-name { opacity: 0 !important; }',
                '#battle-view .mob-target.active .mob-name { opacity: 1 !important; }'
            ].join('\n');
        }
    }

    // =========================
    // ✔ 初始化與高頻定時監控器
    // =========================
    injectGameFeatureProbe();
    injectNativeTradProbe();
    refreshTeleportBossContext();
    registerMyMenu();
    installGmGmemDexEngine();
    installItemModalDexSearch();
    installInventoryUiListStyles();
    applyInventoryUiMode();
    applyFullRandomMode();
    applyMobNamesStyle();
    GM_addStyle(`
        #gm-ext-controls { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(148,163,184,0.35); }
        #gm-ext-controls .gm-ext-controls-btn {
            width: 100%;
            font-size: 14px; line-height: 1.4; font-weight: 700; padding: 12px 14px; min-height: 48px; border-radius: 8px;
            border: 1px solid #475569; background: #0f172a; color: #e2e8f0; cursor: pointer;
            white-space: normal; word-break: break-word; text-align: center;
        }
        #gm-ext-controls .gm-ext-controls-btn:hover { border-color: #60a5fa; color: #bfdbfe; }
        #gm-ext-controls .gm-ext-controls-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        #gm-ext-number-prompt-modal { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; color: #e2e8f0; font-family: inherit; }
        #gm-ext-number-prompt-modal .gmnp-mask { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.78); }
        #gm-ext-number-prompt-modal .gmnp-box { position: relative; width: min(380px, 92vw); background: #172033; border: 2px solid #b7791f; border-radius: 12px; padding: 18px 18px 16px; box-shadow: 0 16px 48px #000; }
        #gm-ext-number-prompt-modal .gmnp-title { font-size: 20px; font-weight: 700; color: #fde68a; margin-bottom: 6px; }
        #gm-ext-number-prompt-modal .gmnp-hint { font-size: 13px; color: #94a3b8; margin-bottom: 12px; }
        #gm-ext-number-prompt-modal .gmnp-input { width: 100%; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: #f8fafc; font-size: 18px; font-weight: 700; padding: 10px 12px; outline: none; font-family: inherit; }
        #gm-ext-number-prompt-modal .gmnp-input:focus { border-color: #eab308; }
        #gm-ext-number-prompt-modal .gmnp-err { margin-top: 8px; color: #fca5a5; font-size: 13px; }
        #gm-ext-number-prompt-modal .gmnp-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        #gm-ext-number-prompt-modal .gmnp-cancel,
        #gm-ext-number-prompt-modal .gmnp-ok { border-radius: 7px; padding: 8px 16px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
        #gm-ext-number-prompt-modal .gmnp-cancel { background: #334155; border: 1px solid #64748b; color: #e2e8f0; }
        #gm-ext-number-prompt-modal .gmnp-ok { background: #854d0e; border: 1px solid #fbbf24; color: #fef9c3; }
        #gm-ext-number-prompt-modal .gmnp-ok:hover { filter: brightness(1.08); }
        #gm-ext-manager-modal { position: fixed; inset: 0; z-index: 2147483646; display: flex; align-items: center; justify-content: center; color: #e2e8f0; }
        #gm-ext-manager-modal .gmem-mask { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.72); }
        #gm-ext-manager-modal .gmem-box { position: relative; display: flex; flex-direction: column; width: min(720px, 90vw); height: min(88vh, 900px); min-height: 0; max-height: 88vh; overflow: hidden; background: #172033; border: 2px solid #b7791f; border-radius: 14px; padding: 18px; box-shadow: 0 18px 60px #000; box-sizing: border-box; margin: 0 auto; }
        #gm-ext-manager-modal .gmem-head { flex: 0 0 auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
        #gm-ext-manager-modal .gmem-head-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        #gm-ext-manager-modal .gmem-title { flex: 0 0 auto; white-space: nowrap; font-size: 26px; font-weight: 700; color: #fde68a; }
        #gm-ext-manager-modal .gmem-tabs-row { display: block; width: 100%; }
        #gm-ext-manager-modal .gmem-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; }
        #gm-ext-manager-modal .gmem-tab[data-tab-switch="query"] { margin-left: auto; }
        #gm-ext-manager-modal .gmem-query-subtabs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; }
        #gm-ext-manager-modal .gmem-query-subtabs .gmem-dex-btn { margin-left: auto; }
        #gm-ext-manager-modal .gmem-shin-btn,
        #gm-ext-manager-modal .gmem-relic-btn,
        #gm-ext-manager-modal .gmem-doll-btn,
        #gm-ext-manager-modal .gmem-dex-btn,
        #gm-ext-manager-modal .gmem-tab { flex: 0 0 auto; background: #1e293b; border: 1px solid #475569; border-radius: 7px; padding: 6px 10px; color: #cbd5e1; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        #gm-ext-manager-modal .gmem-tab[data-tab-switch="query"].is-active { background: #713f12; border-color: #fbbf24; color: #fef3c7; }
        #gm-ext-manager-modal .gmem-shin-btn:hover { border-color: #a78bfa; color: #ddd6fe; }
        #gm-ext-manager-modal .gmem-shin-btn.is-active { background: #4c1d95; border-color: #a78bfa; color: #ede9fe; }
        #gm-ext-manager-modal .gmem-relic-btn:hover { border-color: #38bdf8; color: #bae6fd; }
        #gm-ext-manager-modal .gmem-relic-btn.is-active { background: #0c4a6e; border-color: #38bdf8; color: #e0f2fe; }
        #gm-ext-manager-modal .gmem-doll-btn:hover { border-color: #f472b6; color: #fbcfe8; }
        #gm-ext-manager-modal .gmem-doll-btn.is-active { background: #9d174d; border-color: #f472b6; color: #fce7f3; }
        #gm-ext-manager-modal .gmem-dex-btn:hover { border-color: #fbbf24; color: #fde68a; }
        #gm-ext-manager-modal .gmem-dex-btn.is-active { background: #713f12; border-color: #fbbf24; color: #fef3c7; }
        #gm-ext-manager-modal .gmem-dex-panel { display: flex; flex-direction: column; gap: 0; min-height: 100%; font-size: 16px; }
        #gm-ext-manager-modal .gmem-body.is-dex { overflow: hidden; display: flex; flex-direction: column; }
        #gm-ext-manager-modal .gmem-body.is-dex .gmem-dex-panel { flex: 1 1 auto; min-height: 0; overflow: hidden; }
        #gm-ext-manager-modal .gmem-dex-head { flex: 0 0 auto; z-index: 3; background: #172033; padding-bottom: 10px; border-bottom: 1px solid #334155; }
        #gm-ext-manager-modal .gmem-dex-toolbar { display: flex; align-items: center; gap: 8px; }
        #gm-ext-manager-modal .gmem-dex-clsbar { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-cls { background: transparent; border: 1px solid #475569; border-radius: 8px; padding: 5px 10px; color: #e2e8f0; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; }
        #gm-ext-manager-modal .gmem-dex-cls:hover { border-color: #67e8f9; color: #ecfeff; }
        #gm-ext-manager-modal .gmem-dex-cls.is-active { background: rgba(34, 211, 238, 0.16); border-color: #22d3ee; color: #fff; }
        #gm-ext-manager-modal .gmem-dex-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-top: 10px; }
        #gm-ext-manager-modal .gmem-dex-inwrap { position: relative; flex: 1 1 auto; min-width: 0; display: flex; }
        #gm-ext-manager-modal .gmem-dex-input { flex: 1 1 auto; min-width: 0; background: #1e293b; border: 1px solid #475569; color: #e2e8f0; border-radius: 8px; padding: 11px 40px 11px 13px; font-size: 16px; outline: none; font-family: inherit; }
        #gm-ext-manager-modal .gmem-dex-input:focus { border-color: #eab308; }
        #gm-ext-manager-modal .gmem-dex-clear { display: none; position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; background: #475569; color: #e2e8f0; border-radius: 50%; font-size: 13px; line-height: 1; cursor: pointer; padding: 0; }
        #gm-ext-manager-modal .gmem-dex-clear.show { display: block; }
        #gm-ext-manager-modal .gmem-dex-src-btn { flex: 0 0 auto; background: #1e293b; border: 1px solid #475569; color: #e2e8f0; border-radius: 7px; padding: 9px 12px; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; font-family: inherit; }
        #gm-ext-manager-modal .gmem-dex-src-btn:hover { border-color: #fbbf24; color: #fde68a; }
        #gm-ext-manager-modal .gmem-dex-src-btn[data-src="original"] { background: #422006; border-color: #fbbf24; color: #fef3c7; }
        #gm-ext-manager-modal .gmem-dex-results { display: flex; flex-direction: column; gap: 10px; }
        #gm-ext-manager-modal .gmem-dex-hint { color: #94a3b8; text-align: center; padding: 18px 8px; font-size: 15px; line-height: 1.6; }
        #gm-ext-manager-modal .gmem-dex-card { background: #111c30; border: 1px solid #475569; border-radius: 10px; padding: 14px; }
        #gm-ext-manager-modal .gmem-dex-name { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        #gm-ext-manager-modal .gmem-dex-hl { background: #fde047; color: #1e293b; border-radius: 3px; padding: 0 2px; font-weight: 700; }
        #gm-ext-manager-modal .gmem-dex-tag { font-size: 13px; font-weight: 700; padding: 1px 7px; border-radius: 6px; margin-left: 6px; vertical-align: middle; }
        #gm-ext-manager-modal .gmem-dex-tag.tag-boss { background: #7f1d1d; color: #fecaca; }
        #gm-ext-manager-modal .gmem-dex-tag.tag-hard { background: #1e3a5f; color: #bfdbfe; }
        #gm-ext-manager-modal .gmem-dex-stats { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 15px; color: #cbd5e1; margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-stat b { color: #94a3b8; font-weight: normal; margin-right: 2px; }
        #gm-ext-manager-modal .gmem-dex-sub { font-size: 15px; color: #fcd34d; font-weight: 700; margin: 8px 0 3px; }
        #gm-ext-manager-modal .gmem-dex-maps { font-size: 16px; color: #e2e8f0; line-height: 1.6; }
        #gm-ext-manager-modal .gmem-dex-maplink { color: #7dd3fc; text-decoration: underline; cursor: pointer; }
        #gm-ext-manager-modal .gmem-dex-iname { color: #7dd3fc; text-decoration: underline; cursor: pointer; }
        #gm-ext-manager-modal .gmem-dex-droptag { font-size: 13px; color: #fca5a5; background: #3b1d2a; border: 1px solid #7f3a4a; border-radius: 4px; padding: 0 5px; margin-left: 2px; white-space: nowrap; }
        #gm-ext-manager-modal .gmem-dex-imatch-h { color: #fcd34d; font-weight: 700; font-size: 16px; margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-imatch { font-size: 16px; line-height: 1.9; color: #64748b; }
        #gm-ext-manager-modal .gmem-dex-nodrop { font-size: 16px; color: #64748b; }
        #gm-ext-manager-modal .gmem-dex-drops { width: 100%; border-collapse: collapse; font-size: 16px; }
        #gm-ext-manager-modal .gmem-dex-drops td { padding: 5px 6px; border-bottom: 1px solid #1e293b; color: #e2e8f0; }
        #gm-ext-manager-modal .gmem-dex-pct { text-align: right; white-space: nowrap; color: #93c5fd; }
        #gm-ext-manager-modal .gmem-dex-special-wrap { border: 1px solid #475569; border-radius: 10px; background: #0f172acc; padding: 10px 12px; }
        #gm-ext-manager-modal .gmem-dex-sp-label { color: #fcd34d; font-weight: 700; font-size: 16px; cursor: pointer; }
        #gm-ext-manager-modal .gmem-dex-sp-item { margin-top: 8px; border-top: 1px solid #334155; padding-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-sp-h { color: #e2e8f0; font-size: 16px; font-weight: 700; cursor: pointer; }
        #gm-ext-manager-modal .gmem-dex-sp-item ul { margin: 6px 0 0 18px; padding: 0; color: #cbd5e1; font-size: 15px; line-height: 1.6; }
        #gm-ext-manager-modal .gmem-dex-sp-hit { border: 1px solid #fbbf24; border-radius: 8px; padding: 6px; background: #422006; }
        #gm-ext-manager-modal .gmem-dex-item-card { background: #0b1220; border-color: #64748b; }
        #gm-ext-manager-modal .gmem-dex-item-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #475569; }
        #gm-ext-manager-modal .gmem-dex-item-icon { width: 32px; height: 32px; object-fit: contain; flex: 0 0 auto; }
        #gm-ext-manager-modal .gmem-dex-item-title { font-size: 18px; font-weight: 700; line-height: 1.4; flex: 1 1 auto; min-width: 0; }
        #gm-ext-manager-modal .gmem-dex-item-tag { font-size: 13px; font-weight: 700; margin-left: 4px; }
        #gm-ext-manager-modal .gmem-dex-item-desc { color: #cbd5e1; font-size: 15px; line-height: 1.65; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-orange-300 { color: #fdba74; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-orange-200 { color: #fed7aa; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-blue-300 { color: #93c5fd; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-slate-300 { color: #cbd5e1; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-slate-400 { color: #94a3b8; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-amber-300 { color: #fcd34d; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-violet-400 { color: #a78bfa; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-rose-300 { color: #fda4af; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-sky-300 { color: #7dd3fc; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-yellow-400 { color: #facc15; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-green-200 { color: #bbf7d0; }
        #gm-ext-manager-modal .gmem-dex-item-desc .text-xs { font-size: 13px; }
        #gm-ext-manager-modal .gmem-dex-item-desc .class-eq-icon { width: 22px; height: 22px; vertical-align: middle; margin: 0 2px; }
        #gm-ext-manager-modal .gmem-dex-item-price { color: #facc15; margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-item-dropsources { margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-item-dropsources .gmem-dex-sub { margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-item-craft { margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-item-craft .gmem-dex-sub { margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-item-acquire { margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-item-acquire .gmem-dex-sub { margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-item-shop { margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-item-shop .gmem-dex-sub { margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-item-box { margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-item-box .gmem-dex-sub { margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-item-craftuse { margin-top: 8px; }
        #gm-ext-manager-modal .gmem-dex-item-craftuse .gmem-dex-sub { margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-craft-use-row { color: #e2e8f0; font-size: 14px; line-height: 1.55; margin-bottom: 4px; }
        #gm-ext-manager-modal .gmem-dex-craft-use-meta { color: #94a3b8; }
        #gm-ext-manager-modal .gmem-dex-craft-have { color: #cbd5e1; font-size: 13px; margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-craft-have b { color: #fde68a; }
        #gm-ext-manager-modal .gmem-dex-craft-ok { color: #4ade80; font-weight: 700; }
        #gm-ext-manager-modal .gmem-dex-craft-lack { color: #f87171; font-weight: 700; }
        #gm-ext-manager-modal .gmem-dex-craft-where { color: #e2e8f0; font-size: 14px; line-height: 1.5; margin-bottom: 2px; }
        #gm-ext-manager-modal .gmem-dex-craft-where b { color: #fcd34d; }
        #gm-ext-manager-modal .gmem-dex-craft-mats { color: #cbd5e1; font-size: 14px; line-height: 1.55; margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-craft-note { color: #94a3b8; font-size: 13px; line-height: 1.45; margin-bottom: 6px; }
        #gm-ext-manager-modal .gmem-dex-droplist { display: flex; flex-wrap: wrap; gap: 6px; }
        #gm-ext-manager-modal .gmem-dex-droplink { display: inline-block; color: #7dd3fc; text-decoration: none; cursor: pointer; line-height: 1.4; padding: 3px 8px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; word-break: break-word; }
        #gm-ext-manager-modal .gmem-dex-droplink:hover { color: #e0f2fe; border-color: #38bdf8; background: #0c4a6e; }
        #gm-ext-manager-modal .gmem-dex-item-muted { color: #94a3b8; }
        #gm-ext-manager-modal .gmem-spacer { flex: 1 1 auto; }
        #gm-ext-manager-modal .gmem-tab:hover { border-color: #60a5fa; color: #bfdbfe; }
        #gm-ext-manager-modal .gmem-tab.is-active { background: #0b3b66; border-color: #38bdf8; color: #e0f2fe; }
        @media (max-width: 640px) {
            #gm-ext-manager-modal .gmem-box { width: 88vw; max-width: 420px; padding: 12px; border-radius: 10px; height: min(86vh, 820px); }
            #gm-ext-manager-modal .gmem-title { font-size: 20px; }
            #gm-ext-manager-modal .gmem-shin-btn,
            #gm-ext-manager-modal .gmem-relic-btn,
            #gm-ext-manager-modal .gmem-doll-btn,
            #gm-ext-manager-modal .gmem-dex-btn,
            #gm-ext-manager-modal .gmem-tab { padding: 5px 8px; font-size: 13px; }
        }
        #gm-ext-manager-modal .gmem-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
        #gm-ext-manager-modal .gmem-list { display: flex; flex-direction: column; gap: 8px; }
        #gm-ext-manager-modal .gmem-junk-panel { display: flex; flex-direction: column; gap: 10px; min-height: 100%; }
        #gm-ext-manager-modal .gmem-junk-toolbar { flex: 0 0 auto; }
        #gm-ext-manager-modal .gmem-junk-inwrap { position: relative; display: flex; width: 100%; }
        #gm-ext-manager-modal .gmem-junk-input { flex: 1 1 auto; min-width: 0; background: #1e293b; border: 1px solid #475569; color: #e2e8f0; border-radius: 8px; padding: 11px 40px 11px 13px; font-size: 16px; outline: none; font-family: inherit; }
        #gm-ext-manager-modal .gmem-junk-input:focus { border-color: #eab308; }
        #gm-ext-manager-modal .gmem-junk-clear { display: none; position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; background: #475569; color: #e2e8f0; border-radius: 50%; font-size: 13px; line-height: 1; cursor: pointer; padding: 0; }
        #gm-ext-manager-modal .gmem-junk-clear.show { display: block; }
        #gm-ext-manager-modal .gmem-junk-list { display: flex; flex-direction: column; gap: 0; background: #0f172acc; border: 1px solid #475569; border-radius: 10px; padding: 12px; }
        #gm-ext-manager-modal .gmem-junk-row { display: flex; gap: 10px; align-items: center; padding: 8px 4px; border-bottom: 1px solid #334155; }
        #gm-ext-manager-modal .gmem-junk-row:last-child { border-bottom: none; }
        #gm-ext-manager-modal .gmem-junk-row span { flex: 1 1 auto; min-width: 0; word-break: break-word; }
        #gm-ext-manager-modal .gmem-junk-row button { flex: 0 0 auto; background: #334155; border: 1px solid #64748b; border-radius: 6px; padding: 6px 12px; color: #e2e8f0; cursor: pointer; }
        #gm-ext-manager-modal .gmem-junk-muted { font-size: 13px; color: #94a3b8; padding: 4px 2px; }
        #gm-ext-manager-modal .gmem-row { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left; padding: 12px 14px; font-size: 16px; line-height: 1.45; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; cursor: pointer; }
        #gm-ext-manager-modal .gmem-row-main { flex: 1 1 auto; min-width: 0; text-align: left; }
        #gm-ext-manager-modal .gmem-row-value { flex: 0 0 auto; text-align: right; color: #93c5fd; font-weight: 700; white-space: nowrap; }
        #gm-ext-manager-modal .gmem-row-value .gmem-val-on { color: #4ade80; }
        #gm-ext-manager-modal .gmem-row-value .gmem-val-off { color: #f87171; }
        #gm-ext-manager-modal .gmem-row:hover { border-color: #60a5fa; color: #bfdbfe; }
        #gm-ext-manager-modal .gmem-row.is-focus {
            border-color: #34d399;
            background: linear-gradient(180deg, rgba(10, 44, 35, 1) 0%, rgba(8, 62, 46, 1) 100%);
            box-shadow: 0 0 0 1px rgba(110, 231, 183, 0.32) inset, 0 0 0 1px rgba(5, 150, 105, 0.24);
        }
        #gm-ext-manager-modal .gmem-row.is-focus .gmem-row-main { color: #dcfce7; font-weight: 700; }
        #gm-ext-manager-modal .gmem-row.is-focus .gmem-row-value { color: #86efac; }
        #gm-ext-manager-modal .gmem-row.is-focus .gmem-row-value .gmem-val-on { color: #86efac; }
        #gm-ext-manager-modal .gmem-row.is-focus .gmem-row-value .gmem-val-off { color: #fca5a5; }
        #gm-ext-manager-modal .gmem-row.is-disabled { opacity: 0.5; cursor: not-allowed; }
        #gm-ext-manager-modal .gmem-x { background: #334155; border: 1px solid #64748b; border-radius: 6px; padding: 8px 14px; color: #e2e8f0; font-size: 15px; }
        #gm-ext-manager-modal .gmem-reset { background: linear-gradient(180deg, #9a3412 0%, #7c2d12 100%); border: 2px solid #fdba74; border-radius: 8px; padding: 8px 14px; color: #fff7ed; font-size: 15px; font-weight: 700; box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.25) inset; }
        #gm-ext-manager-modal .gmem-reset:hover { filter: brightness(1.1); }
    `);
    renderAutomationControlPanel();

    fixUnofficialRepublishBarLayer();

    // 每秒掃描遊戲是否載入完成，套用掉落／怪物經驗／金幣修改
    setInterval(() => {
        if (isCatchupBusy()) return;
        fixUnofficialRepublishBarLayer();
        injectGameFeatureProbe();
        injectNativeTradProbe();
        refreshTeleportBossContext();
        refreshNativeTraditional();
        reloadPseudoTradSetting();
        if (document.getElementById('gm-ext-manager-modal')) refreshGmemCatalogButtons();
        maybeRefreshMenuOnFeatureChange();
        if (typeof MOB_DROPS !== 'undefined' && typeof DB !== 'undefined' && DB.mobs) {
            applyAllModifications();
        } else {
            injectPageDifficultyMods();
            injectPageTeleportBossMode();
            injectPseudoTradDrops();
        }
        installItemModalDexSearch();
        syncSharedInvFlagToPage();
        syncSharedGoldFlagToPage();
        syncStatDetailFlagToPage();
        syncAllyPresetFlagToPage();
        syncSquadMercUiFlagToPage();
            syncCollectionRevealFlagToPage();
        syncItemEffDetailFlagToPage();
                syncAllyArrowDmgFlagToPage();
        syncWpnEnPetHitFlagToPage();
                syncPetReevolveFlagToPage();
            syncPledgeJunkEnSellFlagToPage();
        syncCastleLoginFlagToPage();
                syncSuperBlackMarketFlagToPage();
        syncWhScrollEnhanceFlagToPage();
            syncSherineWorldCorrectFlagToPage();
        syncUiThrottleFlagToPage();
        applySquadSwitchVisibility();
        applyMobNamesStyle();
        applyFullRandomMode();
        renderAutomationControlPanel();
        tryInstallPageHooks();
    }, 1000);

    // =========================
    // ✔ 協力傭兵隊伍：名字旁「切換存檔」按鈕
    //    流程＝先 saveGame(目前角色) → currentSlot＝隊友來源格 → loadGame()
    //    須注入 page context（inline onclick + <script>），油猴隔離環境無法直接呼叫遊戲函式
    // =========================
    GM_addStyle(`
        .gm-ally-right-wrap {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
            margin-left: auto;
        }
        .gm-ally-switch-btn {
            padding: 3px 10px;
            font-size: 12px;
            line-height: 1.4;
            font-weight: 700;
            border-radius: 4px;
            border: 1px solid #0e7490;
            background: linear-gradient(180deg, #155e75 0%, #0c4a6e 100%);
            color: #a5f3fc;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .gm-ally-switch-btn:hover { filter: brightness(1.15); }
        .gm-ally-switch-btn:active { transform: scale(0.96); }
        html.gm-squad-switch-off .gm-ally-switch-btn { display: none !important; }
        /* 桌機：隊伍／夥伴面板吃滿左側剩餘高度、清單內捲（拿掉原版 46vh 上限）
           手機 Chaos 設定頁改由 .m-col-left 單一外層捲動；若此處再 overflow:hidden＋內層 visible，長隊伍會被裁切且無滾動條 */
        body:not(.m-mobile) #col-left {
            min-height: 0;
            height: 100%;
            overflow: hidden;
        }
        body:not(.m-mobile) #squad-panel {
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
        }
        body:not(.m-mobile) #squad-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        body:not(.m-mobile) #squad-tab-team,
        body:not(.m-mobile) #squad-tab-skill {
            max-height: none !important;
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
        }
        /* 手機：跟隨內容高度，捲動交給 .m-col-left（與 Chaos afk-mobile 一致） */
        body.m-mobile #squad-panel,
        body.m-mobile #squad-body {
            flex: 0 0 auto !important;
            overflow: visible !important;
            min-height: 0;
            height: auto !important;
            max-height: none !important;
        }
        body.m-mobile #squad-tab-team,
        body.m-mobile #squad-tab-skill {
            flex: 0 0 auto !important;
            max-height: none !important;
            overflow: visible !important;
            height: auto !important;
        }
        .gm-codex-card-t0 {
            border-color: #475569 !important;
            box-shadow: none;
        }
        .gm-codex-card-t1 {
            /* 普卡：接近原版灰框，不加銀光 */
            border-color: #64748b !important;
            box-shadow: none;
        }
        .gm-codex-card-t2 {
            border-color: #e2e8f0 !important;
            box-shadow: 0 0 8px rgba(203, 213, 225, 0.55);
        }
        .gm-codex-card-t3 {
            border-color: #fbbf24 !important;
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.55);
        }
        #gm-stat-tooltip {
            position: fixed;
            z-index: 2147483645;
            max-width: 360px;
            pointer-events: none;
            display: none;
            background: rgba(2, 6, 23, .96);
            border: 1px solid #0e7490;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 15px;
            line-height: 1.65;
            color: #e2e8f0;
            box-shadow: 0 0 18px rgba(14, 116, 144, .35);
        }
        #gm-stat-tooltip .gm-stat-title { font-weight: 700; color: #a5f3fc; margin-bottom: 4px; font-size: 15px; }
        #gm-stat-tooltip .gm-stat-line { color: #cbd5e1; }
        #gm-stat-tooltip .gm-stat-sub { color: #94a3b8; font-size: 13px; margin-top: 2px; }
        [data-gm-stat-hover="1"] { cursor: help !important; }
        .gm-squad-buff-bar {
            display: flex;
            flex-flow: row wrap;
            align-content: flex-start;
            gap: 3px;
            margin-bottom: 2px;
            min-height: 0;
        }
        .gm-squad-buff-bar:empty { display: none !important; }
        .gm-squad-buff-bar .status-icon {
            width: 22px;
            height: 22px;
            flex: 0 0 22px;
            opacity: .85;
        }
        .gm-squad-buff-bar .status-icon:hover { opacity: 1; }
        body.m-mobile .gm-squad-buff-bar .status-icon {
            width: 20px;
            height: 20px;
            flex: 0 0 20px;
        }
        .gm-squad-name-status {
            margin-left: 6px;
            white-space: nowrap;
        }
    `);

    function applySquadSwitchVisibility() {
        document.documentElement.classList.toggle('gm-squad-switch-off', !effectiveSquadSwitchEnabled());
    }

    const GM_PAGE_HOOKS_VER = 155;

    function injectPageHooks() {
        const old = document.getElementById('gm-ally-page-hooks');
        if (old) old.remove();
        const el = document.createElement('script');
        el.id = 'gm-ally-page-hooks';
        el.setAttribute('data-ver', String(GM_PAGE_HOOKS_VER));
        el.textContent = `
(function() {
    var PRESET_PREFIX = 'gm_idle_squad_';

    function allyPresetEnabled() {
        // 秋玥禁用；僅 Chaos 可用
        if (_gmIsAutumnEdition()) return false;
        if (window.__gmAllyPresetOn === false) return false;
        if (window.__gmAllyPresetOn === true) return true;
        try { return localStorage.getItem('gm_ally_preset_enabled') !== '0'; } catch (e) { return true; }
    }

    function squadMercUiEnabled() {
        if (window.__gmSquadMercUiOn === false) return false;
        if (window.__gmSquadMercUiOn === true) return true;
        try { return localStorage.getItem('gm_squad_merc_ui_enabled') !== '0'; } catch (e) { return true; }
    }

    function statDetailEnabled() {
        if (window.__gmStatDetailOn === false) return false;
        if (window.__gmStatDetailOn === true) return true;
        try { return localStorage.getItem('gm_stat_detail_enabled') !== '0'; } catch (e) { return true; }
    }

    function collectionRevealEnabled() {
        if (window.__gmCollectionRevealOn === false) return false;
        if (window.__gmCollectionRevealOn === true) return true;
        try { return localStorage.getItem('gm_collection_reveal_enabled') === '1'; } catch (e) { return false; }
    }

    function itemEffDetailEnabled() {
        if (window.__gmItemEffDetailOn === false) return false;
        if (window.__gmItemEffDetailOn === true) return true;
        try { return localStorage.getItem('gm_item_eff_detail_enabled') === '1'; } catch (e) { return false; }
    }

    function _gmIsAutumnEdition() {
        try {
            var sm = (typeof MASTERY_DATA !== 'undefined' && MASTERY_DATA.mage && MASTERY_DATA.mage.list)
                ? MASTERY_DATA.mage.list.m_summon : null;
            if (!sm) return false;
            var txt = String(sm.msg || '') + String(sm.d || '');
            return /眷屬|更頻繁地施展|強化迷魅與召喚/.test(txt)
                && !/魅力額外增加|魅力影響提升/.test(txt);
        } catch (e) {}
        return false;
    }
    function allyArrowDmgEnabled() {
        if (window.__gmAllyArrowDmgOn === false) return false;
        if (window.__gmAllyArrowDmgOn === true) return true;
        try { return localStorage.getItem('gm_ally_arrow_dmg_enabled') === '1'; } catch (e) { return false; }
    }

    function wpnEnPetHitEnabled() {
        if (window.__gmWpnEnPetHitOn === false) return false;
        if (window.__gmWpnEnPetHitOn === true) return true;
        try { return localStorage.getItem('gm_wpn_en_pet_hit_enabled') === '1'; } catch (e) { return false; }
    }

    function petReevolveEnabled() {
        // 秋玥／Chaos 皆可；需有 PET_BOOK（新寵物系統）才生效
        if (typeof PET_BOOK === 'undefined' || !PET_BOOK) return false;
        if (window.__gmPetReevolveOn === false) return false;
        if (window.__gmPetReevolveOn === true) return true;
        try { return localStorage.getItem('gm_pet_reevolve_enabled') === '1'; } catch (e) { return false; }
    }

    function pledgeJunkEnSellEnabled() {
        if (window.__gmPledgeJunkEnSellOn === false) return false;
        if (window.__gmPledgeJunkEnSellOn === true) return true;
        try { return localStorage.getItem('gm_pledge_junk_en_sell_enabled') === '1'; } catch (e) { return false; }
    }

    function castleLoginEnabled() {
        if (window.__gmCastleLoginOn === false) return false;
        if (window.__gmCastleLoginOn === true) return true;
        try { return localStorage.getItem('gm_castle_login_enabled') === '1'; } catch (e) { return false; }
    }

    function sherineWorldCorrectEnabled() {
        if (window.__gmSherineWorldCorrectOn === false) return false;
        if (window.__gmSherineWorldCorrectOn === true) return true;
        try { return localStorage.getItem('gm_sherine_world_correct_enabled') === '1'; } catch (e) { return false; }
    }

    function __gmSherineDrAdd(lv) {
        return Math.floor((lv || 1) / 3);
    }

    function __gmSherineAcSub(mob) {
        return mob && mob.boss ? 20 : 10;
    }

    function __gmUndoSherineAcDr(mob) {
        if (!mob || !mob._sherine || mob._gmSherineAcDrUndone) return;
        mob.ac = (mob.ac || 0) + __gmSherineAcSub(mob);
        mob.dr = Math.max(0, (mob.dr || 0) - __gmSherineDrAdd(mob.lv));
        mob._gmSherineAcDrUndone = true;
    }

    function __gmReapplySherineAcDr(mob) {
        if (!mob || !mob._sherine || !mob._gmSherineAcDrUndone) return;
        mob.ac = (mob.ac || 0) - __gmSherineAcSub(mob);
        mob.dr = (mob.dr || 0) + __gmSherineDrAdd(mob.lv);
        mob._gmSherineAcDrUndone = false;
    }

    window.__gmFixSherineMobsAcDr = function() {
        if (typeof mapState === 'undefined' || !mapState.mobs) return;
        var on = sherineWorldCorrectEnabled();
        mapState.mobs.forEach(function(m) {
            if (!m || !m._sherine) return;
            if (on) __gmUndoSherineAcDr(m);
            else __gmReapplySherineAcDr(m);
        });
    };

    function uiRefreshSec() {
        var s = null;
        if (typeof window.__gmUiRefreshSec !== 'undefined' && window.__gmUiRefreshSec !== null) s = Number(window.__gmUiRefreshSec);
        if (!isFinite(s)) {
            try { s = Number(localStorage.getItem('gm_ui_refresh_sec')); } catch (e) { s = 0; }
        }
        if (!isFinite(s) || s <= 0) return 0;
        if (s >= 3) return 3;
        return s >= 2 ? 2 : 1;
    }

    // 重負載（戰鬥 log／怪物卡／隊伍條／狀態列）：每 X 秒
    function _gmUiHeavyTick() {
        var sec = uiRefreshSec();
        if (sec <= 0) return true;
        return typeof state === 'undefined' || state.ticks % (sec * 10) === 0;
    }
    // 玩家左側血魔等核心 UI：節流開啟時仍維持每秒（避免「連玩家也被拖慢」）
    function _gmUiCoreTick() {
        if (uiRefreshSec() <= 0) return true;
        return typeof state === 'undefined' || state.ticks % 10 === 0;
    }
    // 相容舊呼叫名稱
    function _gmUiSecTick() { return _gmUiHeavyTick(); }

    function _gmShouldThrottleUi() {
        if (uiRefreshSec() <= 0) return false;
        if (typeof state === 'undefined' || !state) return false;
        try {
            if (document.documentElement.getAttribute('data-gm-ff-catchup') === '1') return false;
            if (document.documentElement.getAttribute('data-gm-afk-catchup') === '1') return false;
        } catch (e) {}
        if (state.ff || !state.running) return false;
        return true;
    }

    var _gmLogSysQueue = [];
    var _gmLogCombatQueue = [];
    var _gmLogQueueMax = 240;

    function _gmFlushUiLogs() {
        if (typeof window.logSys === 'function' && window.logSys.__gmUiThrottleOrig && _gmLogSysQueue.length) {
            var _origSys = window.logSys.__gmUiThrottleOrig;
            while (_gmLogSysQueue.length) {
                var a1 = _gmLogSysQueue.shift();
                try { _origSys.apply(window, a1); } catch (e) {}
            }
        }
        if (typeof window.logCombat === 'function' && window.logCombat.__gmUiThrottleOrig && _gmLogCombatQueue.length) {
            var _origCombat = window.logCombat.__gmUiThrottleOrig;
            while (_gmLogCombatQueue.length) {
                var a2 = _gmLogCombatQueue.shift();
                try { _origCombat.apply(window, a2); } catch (e) {}
            }
        }
    }

    function _gmCatchupBusy() {
        try {
            if (typeof state !== 'undefined' && state && state.ff) return true;
            if (document.documentElement.getAttribute('data-gm-afk-catchup') === '1') return true;
            if (document.documentElement.getAttribute('data-gm-ff-catchup') === '1') return true;
            if (typeof window.__afk !== 'undefined' && window.__afk
                && typeof window.__afk.isCatchupRunning === 'function') {
                return window.__afk.isCatchupRunning();
            }
        } catch (e) {}
        return false;
    }

    function _gmGameLoopWillCatchup() {
        try {
            if (typeof state === 'undefined' || !state || !state.running || player.dead) return false;
            var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            if (typeof _loopLast === 'undefined' || _loopLast == null) return false;
            var elapsed = now - _loopLast;
            if (elapsed < 0) elapsed = 0;
            var cap = (typeof MAX_CATCHUP_MS !== 'undefined' ? MAX_CATCHUP_MS : 300000);
            if (elapsed > cap) elapsed = cap;
            var debt = (typeof _tickDebt !== 'undefined' ? _tickDebt : 0) + elapsed;
            var tickMs = (typeof TICK_MS !== 'undefined' ? TICK_MS : 100);
            return Math.floor(debt / tickMs) > 1;
        } catch (e) { return false; }
    }

    // 重負載繪製許可（怪物／log／隊伍）
    function _gmAllowUiDraw() {
        if (window.__gmForceUiDraw) {
            _gmFlushUiLogs();
            return true;
        }
        if (!_gmShouldThrottleUi()) {
            _gmFlushUiLogs();
            return true;
        }
        if (!_gmUiHeavyTick()) return false;
        _gmFlushUiLogs();
        return true;
    }
    function _gmAllowUiCore() {
        if (window.__gmForceUiDraw) return true;
        if (!_gmShouldThrottleUi()) return true;
        return _gmUiCoreTick();
    }

    function _gmInstallUiThrottleHooks() {
        var UI_THROTTLE_VER = 7;
        if (typeof window.flushTickRender !== 'function') return;
        if (window.flushTickRender.__gmUiThrottleVer === UI_THROTTLE_VER) return;

        // 還原 v15.25 對 img.src 的節流（會讓普攻動畫看起來像「打一下才刷一次 UI」）
        if (window.__gmPetSrcThrottleInstalled) {
            try {
                var ifr = document.createElement('iframe');
                ifr.style.display = 'none';
                (document.body || document.documentElement).appendChild(ifr);
                var clean = ifr.contentWindow && Object.getOwnPropertyDescriptor(ifr.contentWindow.HTMLImageElement.prototype, 'src');
                if (clean && clean.get && clean.set) {
                    Object.defineProperty(HTMLImageElement.prototype, 'src', {
                        configurable: true,
                        enumerable: !!clean.enumerable,
                        get: clean.get,
                        set: clean.set
                    });
                }
                ifr.remove();
            } catch (eUndo) {}
            window.__gmPetSrcThrottleInstalled = false;
        }
        // 還原亂走攔截（亂走本身幾乎不吃效能）
        if (window._petWanderStep && window._petWanderStep.__gmUiThrottleWrap && window._petWanderStep.__gmUiThrottleOrig) {
            window._petWanderStep = window._petWanderStep.__gmUiThrottleOrig;
        }

        if (typeof window.gameLoop === 'function') {
            var _prevLoop = window.gameLoop;
            while (_prevLoop && _prevLoop.__gmUiThrottleWrap) _prevLoop = _prevLoop.__gmUiThrottleOrig;
            window.gameLoop = function() {
                var _ffCatch = _gmGameLoopWillCatchup();
                if (_ffCatch) {
                    try { document.documentElement.setAttribute('data-gm-ff-catchup', '1'); } catch (e) {}
                }
                try {
                    return _prevLoop.apply(this, arguments);
                } finally {
                    if (_ffCatch) {
                        try { document.documentElement.removeAttribute('data-gm-ff-catchup'); } catch (e) {}
                    }
                }
            };
            window.gameLoop.__gmUiThrottleWrap = true;
            window.gameLoop.__gmUiThrottleOrig = _prevLoop;
            try { if (typeof window.startGameTimers === 'function') window.startGameTimers(); } catch (e0) {}
        }

        if (typeof window.logSys === 'function' && !window.logSys.__gmUiThrottleWrap) {
            var _origLogSys = window.logSys;
            window.logSys = function() {
                if (_gmCatchupBusy()) return _origLogSys.apply(this, arguments);
                if (!_gmShouldThrottleUi()) return _origLogSys.apply(this, arguments);
                if (_gmUiHeavyTick()) {
                    _gmFlushUiLogs();
                    return _origLogSys.apply(this, arguments);
                }
                _gmLogSysQueue.push(Array.prototype.slice.call(arguments));
                if (_gmLogSysQueue.length > _gmLogQueueMax) _gmLogSysQueue.shift();
            };
            window.logSys.__gmUiThrottleWrap = true;
            window.logSys.__gmUiThrottleOrig = _origLogSys;
        }
        if (typeof window.logCombat === 'function' && !window.logCombat.__gmUiThrottleWrap) {
            var _origLogCombat = window.logCombat;
            window.logCombat = function() {
                if (_gmCatchupBusy()) return _origLogCombat.apply(this, arguments);
                if (!_gmShouldThrottleUi()) return _origLogCombat.apply(this, arguments);
                if (_gmUiHeavyTick()) {
                    _gmFlushUiLogs();
                    return _origLogCombat.apply(this, arguments);
                }
                _gmLogCombatQueue.push(Array.prototype.slice.call(arguments));
                if (_gmLogCombatQueue.length > _gmLogQueueMax) _gmLogCombatQueue.shift();
            };
            window.logCombat.__gmUiThrottleWrap = true;
            window.logCombat.__gmUiThrottleOrig = _origLogCombat;
        }

        var _prevMobsImpl = null;
        if (typeof window._renderMobsImpl === 'function') {
            _prevMobsImpl = window._renderMobsImpl;
            while (_prevMobsImpl && _prevMobsImpl.__gmUiThrottleWrap) _prevMobsImpl = _prevMobsImpl.__gmUiThrottleOrig;
        }

        // flush：核心 UI 每秒、重負載每 X 秒
        var _prevFlush = window.flushTickRender;
        while (_prevFlush && _prevFlush.__gmUiThrottleWrap) _prevFlush = _prevFlush.__gmUiThrottleOrig;
        window.flushTickRender = function() {
            if (window.__gmForceUiDraw || !_gmShouldThrottleUi()) {
                window.__gmUiAllowCore = true;
                window.__gmUiAllowHeavy = true;
                try {
                    _gmFlushUiLogs();
                    window.__gmMobsDrawPending = false;
                    return _prevFlush.apply(this, arguments);
                } finally {
                    window.__gmUiAllowCore = false;
                    window.__gmUiAllowHeavy = false;
                }
            }
            var coreOk = _gmUiCoreTick();
            var heavyOk = _gmUiHeavyTick();
            if (!coreOk && !heavyOk) return;
            window.__gmUiAllowCore = !!coreOk;
            window.__gmUiAllowHeavy = !!heavyOk;
            try {
                if (heavyOk) _gmFlushUiLogs();
                var ret = _prevFlush.apply(this, arguments);
                // 核心-only flush 會清掉 _mobsDirty 卻跳過繪製→記下，等重負載拍補畫
                if (heavyOk && window.__gmMobsDrawPending && _prevMobsImpl) {
                    window.__gmMobsDrawPending = false;
                    try { _prevMobsImpl.apply(window, []); } catch (eM) {}
                }
                return ret;
            } finally {
                window.__gmUiAllowCore = false;
                window.__gmUiAllowHeavy = false;
            }
        };
        window.flushTickRender.__gmUiThrottleWrap = true;
        window.flushTickRender.__gmUiThrottleOrig = _prevFlush;
        window.flushTickRender.__gmUiThrottleVer = UI_THROTTLE_VER;

        if (typeof window._updateUIImpl === 'function') {
            var _prevUiImpl = window._updateUIImpl;
            while (_prevUiImpl && _prevUiImpl.__gmUiThrottleWrap) _prevUiImpl = _prevUiImpl.__gmUiThrottleOrig;
            window._updateUIImpl = function() {
                if (window.__gmForceUiDraw) return _prevUiImpl.apply(this, arguments);
                if (!_gmShouldThrottleUi()) return _prevUiImpl.apply(this, arguments);
                if (window.__gmUiAllowCore || window.__gmUiAllowHeavy) return _prevUiImpl.apply(this, arguments);
                if (typeof state !== 'undefined' && state && !state.inTick) return _prevUiImpl.apply(this, arguments);
            };
            window._updateUIImpl.__gmUiThrottleWrap = true;
            window._updateUIImpl.__gmUiThrottleOrig = _prevUiImpl;
        }
        if (_prevMobsImpl) {
            window._renderMobsImpl = function() {
                if (window.__gmForceUiDraw) {
                    window.__gmMobsDrawPending = false;
                    return _prevMobsImpl.apply(this, arguments);
                }
                if (!_gmShouldThrottleUi()) {
                    window.__gmMobsDrawPending = false;
                    return _prevMobsImpl.apply(this, arguments);
                }
                // 僅重負載拍重繪怪物卡（普攻在 tick 內 renderMobs 只標 dirty，真正重繪在 flush）
                if (window.__gmUiAllowHeavy) {
                    window.__gmMobsDrawPending = false;
                    return _prevMobsImpl.apply(this, arguments);
                }
                // 核心-only flush：不要誤當成「玩家點擊」而放行（flush 時 inTick 已是 false）
                if (window.__gmUiAllowCore) {
                    window.__gmMobsDrawPending = true;
                    return;
                }
                // 真正的 tick 外操作（點怪、開面板）
                if (typeof state !== 'undefined' && state && !state.inTick) {
                    window.__gmMobsDrawPending = false;
                    return _prevMobsImpl.apply(this, arguments);
                }
            };
            window._renderMobsImpl.__gmUiThrottleWrap = true;
            window._renderMobsImpl.__gmUiThrottleOrig = _prevMobsImpl;
        }

        if (typeof window.renderSquadPanel === 'function') {
            var _prevSquad = window.renderSquadPanel;
            while (_prevSquad && _prevSquad.__gmUiThrottleWrap) _prevSquad = _prevSquad.__gmUiThrottleOrig;
            window.renderSquadPanel = function() {
                if (window.__gmForceUiDraw) return _prevSquad.apply(this, arguments);
                if (!_gmShouldThrottleUi()) return _prevSquad.apply(this, arguments);
                if (window.__gmUiAllowHeavy) return _prevSquad.apply(this, arguments);
                if (window.__gmUiAllowCore) return;
                if (typeof state !== 'undefined' && state && !state.inTick) return _prevSquad.apply(this, arguments);
            };
            window.renderSquadPanel.__gmUiThrottleWrap = true;
            window.renderSquadPanel.__gmUiThrottleOrig = _prevSquad;
        }

        if (typeof window.renderStatusEffects === 'function') {
            var _prevStatusFx = window.renderStatusEffects;
            while (_prevStatusFx && _prevStatusFx.__gmUiThrottleWrap) _prevStatusFx = _prevStatusFx.__gmUiThrottleOrig;
            window.renderStatusEffects = function() {
                if (!_gmAllowUiDraw()) return;
                return _prevStatusFx.apply(this, arguments);
            };
            window.renderStatusEffects.__gmUiThrottleWrap = true;
            window.renderStatusEffects.__gmUiThrottleOrig = _prevStatusFx;
        }
        if (typeof window.tick === 'function') {
            var _prevTick = window.tick;
            while (_prevTick && _prevTick.__gmUiThrottleWrap) _prevTick = _prevTick.__gmUiThrottleOrig;
            window.tick = function() {
                if (_gmCatchupBusy()) return _prevTick.apply(this, arguments);
                var saEl = document.getElementById('status-alerts');
                var saveText = null, saveCls = null;
                if (_gmShouldThrottleUi() && !_gmUiCoreTick() && saEl) {
                    saveText = saEl.innerText;
                    saveCls = saEl.className;
                }
                var ret = _prevTick.apply(this, arguments);
                if (saveText !== null && saEl) {
                    saEl.innerText = saveText;
                    saEl.className = saveCls;
                }
                return ret;
            };
            window.tick.__gmUiThrottleWrap = true;
            window.tick.__gmUiThrottleOrig = _prevTick;
        }
    }

    window.__gmSwitchToAllySlot = function(slotN) {
        slotN = String(slotN);
        if (typeof player === 'undefined' || !player || !player.cls) { alert('尚未進入遊戲'); return; }
        if (String(currentSlot) === slotN) return;
        if (typeof slotSummary !== 'function' || typeof saveGame !== 'function' || typeof loadGame !== 'function') {
            alert('遊戲尚未完全載入，請稍後再試'); return;
        }
        if (!slotSummary(slotN)) { alert('存檔 ' + slotN + ' 為空或不存在'); return; }
        if (player.dead) { alert('角色死亡中無法存檔，請先復活再切換'); return; }
        try { if (typeof _mercLedgerFlush === 'function') _mercLedgerFlush(); } catch (e) {}
        saveGame();
        currentSlot = Number(slotN);
        loadGame();
    };

    function presetKey(captainSlot, allySlot) {
        return PRESET_PREFIX + String(captainSlot) + '_' + String(allySlot);
    }

    function _gmNum(v) { return Number(v) || 0; }
    function _gmSigned(v) { return (v > 0 ? '+' : '') + v; }

    function _gmSetCounts(p) {
        var out = {}, seen = {};
        for (var k in (p && p.eq ? p.eq : {})) {
            var e = p.eq[k];
            if (!e || k === 'wpn' || k === 'offwpn') continue;
            var ed = (typeof DB !== 'undefined' && DB.items) ? DB.items[e.id] : null;
            if (!ed || !ed.set) continue;
            if (seen[e.id]) continue;
            seen[e.id] = 1;
            out[ed.set] = (out[ed.set] || 0) + 1;
        }
        return out;
    }

    function _gmHasEqId(p, id) {
        for (var k in (p && p.eq ? p.eq : {})) {
            var e = p.eq[k];
            if (e && e.id === id) return true;
        }
        return false;
    }

    function _gmCalcStatSource(stat) {
        var p = player || {};
        var d = p.d || {};
        var base = _gmNum(p.base && p.base[stat]);
        var alloc = _gmNum(p.alloc && p.alloc[stat]);
        var panacea = _gmNum(p.panacea && p.panacea[stat]);
        var natural = base + alloc + panacea;

        var equip = 0;
        for (var k in (p.eq || {})) {
            var e = p.eq[k];
            if (!e) continue;
            var ed = (typeof DB !== 'undefined' && DB.items) ? DB.items[e.id] : null;
            if (!ed) continue;
            equip += _gmNum(ed[stat]);
        }

        var buff = 0;
        for (var sid in (p.buffs || {})) {
            if (_gmNum(p.buffs[sid]) <= 0) continue;
            var sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[sid] : null;
            var sd = sk && sk.d ? sk.d : null;
            buff += _gmNum(sd && sd[stat]);
        }

        var setBonus = 0;
        var setCnt = _gmSetCounts(p);
        if (setCnt.icequeen_charm >= 3) {
            if (stat === 'str' || stat === 'cha') setBonus += 2;
        }
        if (setCnt.frost >= 3 && stat === 'con') setBonus += 3;
        if (setCnt.orin >= 2) setBonus += 1;
        if (setCnt.darkelf >= 3) {
            if (stat === 'str') setBonus -= 2;
            if (stat === 'dex') setBonus += 2;
        }
        if (setCnt.bluepirate >= 4 && stat === 'int') setBonus += 1;

        if (_gmHasEqId(p, 'acc_purify_earring')) {
            if (_gmHasEqId(p, 'acc_curse_red')) {
                if (stat === 'str') setBonus += 2;
                if (stat === 'con') setBonus -= 2;
            }
            if (_gmHasEqId(p, 'acc_curse_blue')) {
                if (stat === 'int') setBonus += 2;
                if (stat === 'wis') setBonus -= 2;
            }
            if (_gmHasEqId(p, 'acc_curse_green')) {
                if (stat === 'dex') setBonus += 2;
                if (stat === 'cha') setBonus -= 2;
            }
        }

        var other = 0;
        if (typeof equipCatComplete === 'function' && equipCatComplete('doll')) other += 1;

        var finalVal = _gmNum(d[stat]);
        var known = natural + equip + buff + setBonus + other;
        var residual = finalVal - known;

        return {
            base: base,
            alloc: alloc,
            panacea: panacea,
            natural: natural,
            equip: equip,
            buff: buff,
            setBonus: setBonus,
            other: other,
            residual: residual,
            finalVal: finalVal
        };
    }

    var GM_STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    var GM_STAT_LABEL = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '精神', cha: '魅力' };
    var GM_DERIVED_SPECS = [
        { stat: 'meleeDmg', id: 'dt-mdmg', label: '近距離傷害', extra: 'extraDmg', grp: 'melee' },
        { stat: 'meleeHit', id: 'dt-mhit', label: '近距離命中', extra: 'extraHit', grp: 'melee' },
        { stat: 'meleeCrit', id: 'dt-mcrit-p', label: '近距離爆擊率', isPct: true, grp: 'melee' },
        { stat: 'rangedDmg', id: 'dt-rdmg', label: '遠距離傷害', extra: 'extraDmg', grp: 'ranged' },
        { stat: 'rangedHit', id: 'dt-rhit', label: '遠距離命中', extra: 'extraHit', grp: 'ranged' },
        { stat: 'rangedCrit', id: 'dt-rcrit', label: '遠距離爆擊率', isPct: true, grp: 'ranged' },
        { stat: 'magicDmg', id: 'dt-mgdmg', label: '魔法傷害' },
        { stat: 'extraMp', id: 'dt-sp', label: '額外魔法點數' },
        { stat: 'magicHit', id: 'dt-mhit-mag', label: '魔法命中' },
        { stat: 'magicCrit', id: 'dt-mcrit', label: '魔法爆擊率', isPct: true },
        { stat: 'mpReduce', id: 'dt-mpreduce', label: 'MP消耗減免', isPct: true },
        { stat: 'hpR', id: 'dt-hpr', label: 'HP恢復量' },
        { stat: 'mpR', id: 'dt-mpr', label: 'MP恢復量' },
        { stat: 'er', id: 'dt-er', label: '迴避率 (ER)', isEffPct: true },
        { stat: 'dr', id: 'dt-dr', label: '傷害減免 (DR)' },
        { stat: 'resFire', id: 'dt-resfire', label: '火屬性抗性', isRes: true },
        { stat: 'resWater', id: 'dt-reswater', label: '水屬性抗性', isRes: true },
        { stat: 'resWind', id: 'dt-reswind', label: '風屬性抗性', isRes: true },
        { stat: 'resEarth', id: 'dt-researth', label: '地屬性抗性', isRes: true }
    ];
    var GM_DERIVED_LABEL = {};
    GM_DERIVED_SPECS.forEach(function(s) { GM_DERIVED_LABEL[s.stat] = s.label; });

    function _gmCombatAdd(b, k, v) {
        v = _gmNum(v);
        if (v) b[k] = (b[k] || 0) + v;
    }

    function _gmSherineSets(p) {
        var out = {};
        for (var k in (p.eq || {})) {
            var e = p.eq[k];
            if (e && e.seteff) {
                var g = e.seteff.slice(0, 2);
                out[g] = (out[g] || 0) + 1;
            }
        }
        return out;
    }

    function _gmPolyForm(p) {
        if (p._setPoly) return p._setPoly;
        if (p.buffs && p.buffs.poly > 0 && p.poly) return p.poly;
        return null;
    }

    function _gmClassLvBonus(p, stat) {
        var lv = p.lv || 1, cls = p.cls;
        if (stat === 'meleeDmg') {
            if (cls === 'knight') return Math.floor(lv / 4);
            if (cls === 'elf') return Math.floor(lv / 7);
            if (cls === 'dark') return Math.floor(lv / 5);
        }
        if (stat === 'rangedDmg') {
            if (cls === 'knight') return Math.floor(lv / 10);
            if (cls === 'elf') return Math.floor(lv / 4);
            if (cls === 'dark') return Math.floor(lv / 8);
        }
        if (stat === 'er') {
            if (cls === 'knight' || cls === 'dark' || cls === 'illusion' || cls === 'dragon') return Math.floor(lv / 4);
            if (cls === 'elf') return Math.floor(lv / 6);
            if (cls === 'royal') return Math.floor(lv / 8);
            if (cls === 'mage') return Math.floor(lv / 10);
        }
        if (stat === 'meleeCrit' && cls === 'dark') return 3;
        if (stat === 'rangedCrit' && cls === 'dark') return 3;
        return 0;
    }

    function _gmAttrBonus(stat) {
        var d = (player && player.d) ? player.d : {};
        try {
            if (stat === 'meleeDmg' && typeof getStrMeleeDmg === 'function') return getStrMeleeDmg(d.str);
            if (stat === 'meleeHit' && typeof getStrMeleeHit === 'function') return getStrMeleeHit(d.str);
            if (stat === 'meleeCrit' && typeof getStrMeleeCrit === 'function') return getStrMeleeCrit(d.str);
            if (stat === 'rangedDmg' && typeof getDexRangedDmg === 'function') return getDexRangedDmg(d.dex);
            if (stat === 'rangedHit' && typeof getDexRangedHit === 'function') return getDexRangedHit(d.dex);
            if (stat === 'rangedCrit' && typeof getDexRangedCrit === 'function') return getDexRangedCrit(d.dex);
            if (stat === 'er' && typeof getDexER === 'function') return getDexER(d.dex);
            if (stat === 'magicDmg' && typeof getIntMagicDmg === 'function') return getIntMagicDmg(d.int);
            if (stat === 'magicHit' && typeof getIntMagicHit === 'function') return getIntMagicHit(d.int);
            if (stat === 'magicCrit' && typeof getIntMagicCrit === 'function') return getIntMagicCrit(d.int);
            if (stat === 'extraMp' && typeof getIntExtraMp === 'function') return getIntExtraMp(d.int);
            if (stat === 'mpReduce' && typeof getIntMpReduce === 'function') return getIntMpReduce(d.int);
            if (stat === 'mpR' && typeof getWisMpRegen === 'function') return getWisMpRegen(d.wis);
        } catch (e) {}
        return 0;
    }

    function _gmApplyEquipBlessAnc(e, ed, stat, b, slot) {
        if (typeof applyBlessStats === 'function') {
            var tb = { extraDmg: 0, extraHit: 0, extraMp: 0, dr: 0, er: 0, magicDmg: 0 };
            applyBlessStats(tb, e.bless, slot);
            if (stat === 'extraMp') _gmCombatAdd(b, 'bless', tb.extraMp);
            if (stat === 'dr') _gmCombatAdd(b, 'bless', tb.dr);
        }
        if (typeof applyAncStats === 'function') {
            var ta = { extraDmg: 0, extraHit: 0, extraMp: 0, dr: 0, er: 0, magicDmg: 0 };
            applyAncStats(ta, e.anc, slot);
            if (stat === 'extraMp') _gmCombatAdd(b, 'ancient', ta.extraMp);
            if (stat === 'dr') _gmCombatAdd(b, 'ancient', ta.dr);
            if (stat === 'er') _gmCombatAdd(b, 'ancient', ta.er);
            if (stat === 'magicDmg') _gmCombatAdd(b, 'ancient', ta.magicDmg);
        }
    }

    function _gmSumBuffCombat(p, stat, b) {
        for (var sid in (p.buffs || {})) {
            if (_gmNum(p.buffs[sid]) <= 0) continue;
            var sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[sid] : null;
            var bd = sk && sk.d ? sk.d : null;
            if (bd && bd[stat]) _gmCombatAdd(b, 'buff', bd[stat]);
        }
    }

    function _gmSumEquipCombat(p, stat, b) {
        var eqFld = { meleeCrit: 'mcrit', rangedCrit: 'rcrit' };
        if (p.eq && p.eq.wpn) {
            var we = p.eq.wpn;
            var w = (typeof DB !== 'undefined' && DB.items) ? DB.items[we.id] : null;
            if (w) {
                var isRanged = !!w.ranged;
                var enW = (typeof enhanceWpnBonus === 'function') ? enhanceWpnBonus(we.en) : { dmg: 0, hit: 0 };
                var wEn = (typeof capWpnEn === 'function') ? capWpnEn(we.en) : (we.en || 0);
                if (stat === 'meleeDmg' && !isRanged) _gmCombatAdd(b, 'wpn', w.dmgBonus || 0);
                if (stat === 'rangedDmg' && isRanged) _gmCombatAdd(b, 'wpn', w.dmgBonus || 0);
                if (stat === 'meleeHit' && !isRanged) _gmCombatAdd(b, 'wpn', w.hit || 0);
                if (stat === 'rangedHit' && isRanged) _gmCombatAdd(b, 'wpn', w.hit || 0);
                if (stat === 'meleeDmg' || stat === 'rangedDmg') _gmCombatAdd(b, 'wpn', enW.dmg || 0);
                if (stat === 'meleeHit' || stat === 'rangedHit') _gmCombatAdd(b, 'wpn', enW.hit || 0);
                if (stat === 'magicDmg') _gmCombatAdd(b, 'wpn', w.mdmg || 0);
                if (stat === 'extraMp') {
                    _gmCombatAdd(b, 'wpn', w.extraMp || 0);
                    if (w.extraMpPerEn) _gmCombatAdd(b, 'wpn', wEn * w.extraMpPerEn);
                }
                if (stat === 'mpR') {
                    _gmCombatAdd(b, 'wpn', w.mpR || 0);
                    if (w.mpROverSafe && wEn > (w.safe || 0)) _gmCombatAdd(b, 'wpn', (wEn - (w.safe || 0)) * w.mpROverSafe);
                    if (w.mpRPerEn) _gmCombatAdd(b, 'wpn', wEn * w.mpRPerEn);
                }
                if (stat === 'hpR') _gmCombatAdd(b, 'wpn', w.hpR || 0);
                if (stat === 'dr') _gmCombatAdd(b, 'wpn', w.dr || 0);
                if (stat === 'meleeCrit' && w.mcrit) _gmCombatAdd(b, 'wpn', w.mcrit);
                if (stat === 'rangedCrit' && w.rcrit) _gmCombatAdd(b, 'wpn', w.rcrit);
                if (stat === 'meleeHit' && w.meleeHitPerEn) _gmCombatAdd(b, 'wpn', wEn * w.meleeHitPerEn);
                if (stat === 'magicDmg' && w.mdmgEnFrom7Max3) _gmCombatAdd(b, 'wpn', Math.min(3, Math.max(0, wEn - 6)));
                if (typeof getAttrAffix === 'function') {
                    var wAff = getAttrAffix(we.attr);
                    if (wAff && stat === 'extraMp') _gmCombatAdd(b, 'affix', wAff.mp || 0);
                }
                _gmApplyEquipBlessAnc(we, w, stat, b, 'wpn');
                if (typeof applyAncStats === 'function' && stat === 'magicDmg') {
                    var tmp = { magicDmg: 0 };
                    applyAncStats(tmp, we.anc, 'wpn');
                    _gmCombatAdd(b, 'wpn', tmp.magicDmg);
                }
            }
        }
        for (var k in (p.eq || {})) {
            var e = p.eq[k];
            if (!e || k === 'wpn' || k === 'offwpn') continue;
            var ed = (typeof DB !== 'undefined' && DB.items) ? DB.items[e.id] : null;
            if (!ed) continue;
            if (ed[stat]) _gmCombatAdd(b, 'equip', ed[stat]);
            if (eqFld[stat] && ed[eqFld[stat]]) _gmCombatAdd(b, 'equip', ed[eqFld[stat]]);
            if (stat === 'magicDmg' && ed.mdmgEnFrom4) {
                var cap = (typeof capEn === 'function') ? capEn(e.en, ed) : (e.en || 0);
                _gmCombatAdd(b, 'equip', Math.min(6, Math.max(0, cap - 3)));
            }
            if (stat === 'magicDmg' && ed.mdmgEnFrom7Max3) {
                var cap2 = (typeof capEn === 'function') ? capEn(e.en, ed) : (e.en || 0);
                _gmCombatAdd(b, 'equip', Math.min(3, Math.max(0, cap2 - 6)));
            }
            if (ed.armguard && (stat === 'meleeDmg' || stat === 'rangedDmg' || stat === 'magicDmg')) {
                var agEn = (typeof capEn === 'function') ? capEn(e.en, ed) : (e.en || 0);
                var ag = ed.armguard;
                var agV = (ag.base || 0) + (agEn >= 9 ? ag.th[2] : agEn >= 7 ? ag.th[1] : agEn >= 5 ? ag.th[0] : 0);
                if (agV && ag.stat === stat) _gmCombatAdd(b, 'equip', agV);
            }
            if (p.cls === 'elf' && e.id === 'clk_elf' && stat === 'hpR') _gmCombatAdd(b, 'equip', 1);
            var slot = (ed.slot === 'ring' || ed.slot === 'amulet' || ed.slot === 'belt' || ed.slot === 'ear') ? 'acc' : 'arm';
            _gmApplyEquipBlessAnc(e, ed, stat, b, slot);
            if (typeof applyAncStats === 'function' && stat === 'magicDmg') {
                var tmp2 = { magicDmg: 0 };
                applyAncStats(tmp2, e.anc, slot);
                _gmCombatAdd(b, 'equip', tmp2.magicDmg);
            }
        }
    }

    function _gmSumSetCombat(p, stat, b) {
        var setCnt = _gmSetCounts(p);
        if (setCnt.icequeen_charm >= 3 && stat === 'resWater') _gmCombatAdd(b, 'set', 20);
        if (setCnt.frost >= 3 && stat === 'resWater') _gmCombatAdd(b, 'set', 20);
        if (setCnt.mage >= 2 && stat === 'mpR') _gmCombatAdd(b, 'set', 1);
        if (setCnt.steel >= 5 && stat === 'dr') _gmCombatAdd(b, 'set', 2);
        if (setCnt.demon >= 4 && stat === 'hpR') _gmCombatAdd(b, 'set', 5);
        if (setCnt.icequeen_charm >= 3 && stat === 'mpR') _gmCombatAdd(b, 'set', 4);
        if (setCnt.frost >= 3 && stat === 'mpR') _gmCombatAdd(b, 'set', 4);
        if (setCnt.frost >= 3 && stat === 'hpR') _gmCombatAdd(b, 'set', 8);
        if (setCnt.kinglord >= 4) {
            if (stat === 'hpR') _gmCombatAdd(b, 'set', 10);
            if (stat === 'mpR') _gmCombatAdd(b, 'set', 10);
        }
        var sh = _gmSherineSets(p);
        if (sh['麗人'] >= 2) {
            if (stat === 'meleeDmg') _gmCombatAdd(b, 'set', 3);
            if (stat === 'meleeHit') _gmCombatAdd(b, 'set', 3);
        }
        if (sh['麗人'] >= 3 && stat === 'meleeCrit') _gmCombatAdd(b, 'set', 3);
        if (sh['疾風'] >= 2) {
            if (stat === 'rangedDmg') _gmCombatAdd(b, 'set', 3);
            if (stat === 'rangedHit') _gmCombatAdd(b, 'set', 3);
        }
        if (sh['疾風'] >= 3 && stat === 'rangedCrit') _gmCombatAdd(b, 'set', 3);
        if (sh['魔女'] >= 2 && stat === 'magicDmg') _gmCombatAdd(b, 'set', 3);
        if (sh['魔女'] >= 3) {
            if (stat === 'resWater') _gmCombatAdd(b, 'set', 10);
            if (stat === 'extraMp') _gmCombatAdd(b, 'set', 5);
        }
        if (sh['學徒'] >= 2) {
            if (stat === 'mpR') _gmCombatAdd(b, 'set', 5);
            if (stat === 'extraMp') _gmCombatAdd(b, 'set', 6);
        }
        if (sh['學徒'] >= 3 && stat === 'magicCrit') _gmCombatAdd(b, 'set', 3);
        if (sh['月光'] >= 3 && stat === 'er') _gmCombatAdd(b, 'set', 5);
        if (sh['紅獅'] >= 3 && stat === 'dr') _gmCombatAdd(b, 'set', 10);
        if (sh['鐵衛'] >= 2 && stat === 'dr') _gmCombatAdd(b, 'set', 5);
    }

    function _gmSumPolyCombat(p, stat, b) {
        var pf = _gmPolyForm(p);
        if (!pf) return;
        var map = { meleeDmg: 'md', meleeHit: 'mh', rangedDmg: 'rd', rangedHit: 'rh', magicDmg: 'mgd', extraMp: 'sp', mpR: 'mpr', er: 'er' };
        var pk = map[stat];
        if (pk && pf[pk]) _gmCombatAdd(b, 'poly', pf[pk]);
    }

    function _gmSumCardCombat(p, stat, b) {
        if (typeof cardRegionTier !== 'function' || typeof CARD_REGIONS === 'undefined') return;
        for (var r = 0; r < CARD_REGIONS.length; r++) {
            var reg = CARD_REGIONS[r];
            if (reg.stat !== stat) continue;
            var tier = cardRegionTier(reg.key);
            if (tier > 0) _gmCombatAdd(b, 'card', reg.vals[tier - 1]);
        }
    }

    function _gmSumOtherCombat(p, stat, b) {
        if (stat === 'meleeDmg' && p.skills && p.skills.indexOf('sk_warrior_crush') >= 0) {
            _gmCombatAdd(b, 'skill', 2 + Math.max(0, (p.lv || 1) - 44));
        }
        if (stat === 'dr' && p.buffs && p.buffs.sk_reduction_armor > 0) {
            _gmCombatAdd(b, 'buff', Math.floor((p.lv || 1) / 10));
        }
        if (stat === 'dr' && p.skills && p.skills.indexOf('sk_warrior_armorbody') >= 0) {
            var ac = _gmNum(p.d && p.d.ac);
            var div = (typeof hasMastery === 'function' && hasMastery('k_tough')) ? 5 : 10;
            _gmCombatAdd(b, 'skill', Math.floor((10 - ac) / div));
        }
        if (typeof hasMastery === 'function' && hasMastery('d_crit')) {
            if (stat === 'meleeCrit' || stat === 'rangedCrit') _gmCombatAdd(b, 'other', 3);
        }
        if (stat === 'magicDmg' && p.buffs && p.buffs.cautious > 0) _gmCombatAdd(b, 'other', 2);
        if (stat === 'mpR' && p.buffs && p.buffs.cautious > 0) _gmCombatAdd(b, 'other', 2);
        if (stat === 'mpR' && p.buffs && p.buffs.blue > 0 && typeof getWisBlueBonus === 'function') {
            try { _gmCombatAdd(b, 'other', getWisBlueBonus(p.d.wis)); } catch (e) {}
        }
        if (p.statuses && p.statuses.evilAura > 0 && stat === 'er') _gmCombatAdd(b, 'other', -10);
        if (p.buffs && p.buffs.sk_elf_singleres > 0 && p.elfEle) {
            if (stat === 'resFire' && p.elfEle === 'fire') _gmCombatAdd(b, 'other', 50);
            if (stat === 'resWater' && p.elfEle === 'water') _gmCombatAdd(b, 'other', 50);
            if (stat === 'resEarth' && p.elfEle === 'earth') _gmCombatAdd(b, 'other', 50);
            if (stat === 'resWind' && p.elfEle === 'wind') _gmCombatAdd(b, 'other', 50);
        }
        if (typeof teamIlluAura === 'function' && stat === 'magicDmg') {
            try {
                var mia = teamIlluAura(p);
                if (mia && mia.md) _gmCombatAdd(b, 'other', mia.md);
            } catch (e) {}
        }
        if (p.blessings) {
            var now = Date.now();
            if (stat === 'hpR' && p.blessings.blaze > now) _gmCombatAdd(b, 'other', 15);
            if (stat === 'mpR' && p.blessings.blaze > now) _gmCombatAdd(b, 'other', 3);
            if (stat === 'dr' && p.blessings.support > now) _gmCombatAdd(b, 'other', 3);
        }
    }

    function _gmCalcExtraSource(field) {
        var p = player || {};
        var b = {};
        if (p.eq && p.eq.wpn) {
            var we = p.eq.wpn, w = DB.items[we.id];
            if (w && w.extraDmg) _gmCombatAdd(b, 'wpn', w.extraDmg);
            if (typeof applyBlessStats === 'function') {
                var tb = { extraDmg: 0, extraHit: 0 };
                applyBlessStats(tb, we.bless, 'wpn');
                _gmCombatAdd(b, 'bless', tb[field] || 0);
            }
            if (typeof applyAncStats === 'function') {
                var ta = { extraDmg: 0, extraHit: 0 };
                applyAncStats(ta, we.anc, 'wpn');
                _gmCombatAdd(b, 'ancient', ta[field] || 0);
            }
            if (typeof getAttrAffix === 'function') {
                var aff = getAttrAffix(we.attr);
                if (aff && field === 'extraDmg') _gmCombatAdd(b, 'affix', aff.dmg || 0);
            }
        }
        if (p.eq && p.eq.offwpn) {
            if (typeof applyAncStats === 'function') {
                var ta2 = { extraDmg: 0, extraHit: 0 };
                applyAncStats(ta2, p.eq.offwpn.anc, 'wpn');
                _gmCombatAdd(b, 'ancient', ta2[field] || 0);
            }
            if (typeof getAttrAffix === 'function') {
                var aff2 = getAttrAffix(p.eq.offwpn.attr);
                if (aff2 && field === 'extraDmg') _gmCombatAdd(b, 'affix', aff2.dmg || 0);
            }
        }
        for (var k in (p.eq || {})) {
            var e = p.eq[k];
            if (!e || k === 'wpn' || k === 'offwpn') continue;
            var ed = DB.items[e.id];
            if (!ed) continue;
            if (ed[field]) _gmCombatAdd(b, 'equip', ed[field]);
            if (typeof applyAncStats === 'function') {
                var ta3 = { extraDmg: 0, extraHit: 0 };
                var slot = (ed.slot === 'ring' || ed.slot === 'amulet' || ed.slot === 'belt' || ed.slot === 'ear') ? 'acc' : 'arm';
                applyAncStats(ta3, e.anc, slot);
                _gmCombatAdd(b, 'ancient', ta3[field] || 0);
            }
        }
        var sh = _gmSherineSets(p);
        if (sh['紅獅'] >= 2 && field === 'extraDmg') _gmCombatAdd(b, 'set', 5);
        if (sh['月光'] >= 2 && field === 'extraDmg') _gmCombatAdd(b, 'set', 2);
        if (sh['月光'] >= 2 && field === 'extraHit') _gmCombatAdd(b, 'set', 3);
        if (sh['暗影'] >= 2 && field === 'extraDmg') _gmCombatAdd(b, 'set', 7);
        if (sh['白鳥'] >= 2 && field === 'extraHit') _gmCombatAdd(b, 'set', 5);
        _gmSumBuffCombat(p, field, b);
        var pf = _gmPolyForm(p);
        if (pf) {
            if (field === 'extraDmg' && pf.ed) _gmCombatAdd(b, 'poly', pf.ed);
            if (field === 'extraHit' && pf.eh) _gmCombatAdd(b, 'poly', pf.eh);
        }
        if (p.blessings) {
            var now = Date.now();
            if (field === 'extraHit' && p.blessings.precise > now) _gmCombatAdd(b, 'other', 3);
            if (field === 'extraDmg' && p.blessings.brave > now) _gmCombatAdd(b, 'other', 3);
        }
        if (typeof teamIlluAura === 'function') {
            try {
                var mia = teamIlluAura(p);
                if (mia) _gmCombatAdd(b, 'other', mia[field === 'extraDmg' ? 'ed' : 'eh'] || 0);
            } catch (e) {}
        }
        if (typeof cardRegionTier === 'function' && typeof CARD_REGIONS !== 'undefined') {
            for (var r = 0; r < CARD_REGIONS.length; r++) {
                var reg = CARD_REGIONS[r];
                if (reg.stat !== field) continue;
                var tier = cardRegionTier(reg.key);
                if (tier > 0) _gmCombatAdd(b, 'card', reg.vals[tier - 1]);
            }
        }
        var cls = p.cls;
        if (field === 'extraDmg' && (cls === 'illusion' || cls === 'dragon' || cls === 'warrior' || cls === 'royal')) {
            var lv = p.lv || 1;
            var v = cls === 'illusion' || cls === 'royal' ? Math.floor(lv / 5)
                : cls === 'dragon' ? Math.floor(lv / 3) : Math.floor(lv / 4);
            _gmCombatAdd(b, 'cls', v);
        }
        if (field === 'extraHit') {
            var lv2 = p.lv || 1;
            if (cls === 'knight') _gmCombatAdd(b, 'cls', Math.floor(lv2 / 3));
            else if (cls === 'elf') _gmCombatAdd(b, 'cls', Math.floor(lv2 / 5));
            else if (cls === 'dark') _gmCombatAdd(b, 'cls', Math.floor(lv2 / 3));
            else if (cls === 'illusion' || cls === 'dragon' || cls === 'royal') _gmCombatAdd(b, 'cls', Math.floor(lv2 / 5));
            else if (cls === 'warrior') _gmCombatAdd(b, 'cls', Math.floor(lv2 / 3));
        }
        var raw = _gmNum(p.d && p.d[field]);
        var known = 0;
        for (var bk in b) known += b[bk];
        return { buckets: b, rawFinal: raw, residual: raw - known };
    }

    function _gmCalcDerivedStatSource(stat) {
        var p = player || {};
        var b = {};
        _gmCombatAdd(b, 'attr', _gmAttrBonus(stat));
        _gmCombatAdd(b, 'cls', _gmClassLvBonus(p, stat));
        _gmSumEquipCombat(p, stat, b);
        _gmSumSetCombat(p, stat, b);
        _gmSumBuffCombat(p, stat, b);
        _gmSumPolyCombat(p, stat, b);
        _gmSumCardCombat(p, stat, b);
        _gmSumOtherCombat(p, stat, b);
        var raw = _gmNum(p.d && p.d[stat]);
        var known = 0;
        for (var k in b) known += b[k];
        return { buckets: b, rawFinal: raw, residual: raw - known };
    }

    function _gmConsolidateCombatBuckets(b) {
        return {
            base: _gmNum(b.attr) + _gmNum(b.cls),
            wpn: _gmNum(b.wpn),
            equip: _gmNum(b.equip) + _gmNum(b.bless) + _gmNum(b.ancient) + _gmNum(b.affix),
            buff: _gmNum(b.buff),
            set: _gmNum(b.set),
            other: _gmNum(b.poly) + _gmNum(b.skill) + _gmNum(b.card) + _gmNum(b.other)
        };
    }

    function _gmMergeCombatBuckets(a, b) {
        return {
            base: _gmNum(a.base) + _gmNum(b.base),
            wpn: _gmNum(a.wpn) + _gmNum(b.wpn),
            equip: _gmNum(a.equip) + _gmNum(b.equip),
            buff: _gmNum(a.buff) + _gmNum(b.buff),
            set: _gmNum(a.set) + _gmNum(b.set),
            other: _gmNum(a.other) + _gmNum(b.other)
        };
    }

    function _gmFormatCombatTooltipLines(c) {
        return {
            lineA: [c.base + ' 基礎', c.wpn + ' 武器', c.equip + ' 裝備', c.buff + ' 增益'].join(' / '),
            lineB: [c.set + ' 套裝', c.other + ' 其他'].join(' / ')
        };
    }

    function _gmCombatLegendHtml() {
        return '<div class="gm-stat-sub">基礎：屬性換算、等級成長</div>'
            + '<div class="gm-stat-sub">武器：主武器數值、強化加成</div>'
            + '<div class="gm-stat-sub">裝備：防具飾品、祝福、遠古、詞綴</div>'
            + '<div class="gm-stat-sub">增益：技能 buff</div>'
            + '<div class="gm-stat-sub">套裝：傳統套裝、席琳套裝</div>'
            + '<div class="gm-stat-sub">其他：變身、卡片、被動、傭兵光環、盟主祝福等</div>';
    }

    function _gmDerivedSpecByStat(stat) {
        for (var i = 0; i < GM_DERIVED_SPECS.length; i++) {
            if (GM_DERIVED_SPECS[i].stat === stat) return GM_DERIVED_SPECS[i];
        }
        return null;
    }

    function _gmFormatDerivedTooltip(stat) {
        var spec = _gmDerivedSpecByStat(stat);
        var label = spec ? spec.label : (GM_DERIVED_LABEL[stat] || stat);
        var sign = function(v) { return (v >= 0 ? '+' : '') + v; };
        var main = _gmCalcDerivedStatSource(stat);
        var c = _gmConsolidateCombatBuckets(main.buckets);
        var residual = main.residual;
        if (spec && spec.extra) {
            var ex = _gmCalcExtraSource(spec.extra);
            c = _gmMergeCombatBuckets(c, _gmConsolidateCombatBuckets(ex.buckets));
            residual += ex.residual;
        }
        var lines = _gmFormatCombatTooltipLines(c);
        var displayVal;
        if (spec && spec.isRes) {
            var rawRes = _gmNum(player.d && player.d[stat]);
            try {
                displayVal = (typeof effResistPct === 'function' ? effResistPct(rawRes) : rawRes) + '%';
            } catch (e) { displayVal = rawRes + '%'; }
        } else if (spec && spec.isEffPct) {
            var rawEr = _gmNum(player.d && player.d.er);
            try {
                displayVal = (typeof effResistPct === 'function' ? effResistPct(rawEr) : rawEr) + '%';
            } catch (e) { displayVal = rawEr + '%'; }
        } else if (spec && spec.isPct) {
            displayVal = main.rawFinal + '%';
        } else if (spec && spec.extra) {
            displayVal = sign(_gmNum(player.d[stat]) + _gmNum(player.d[spec.extra]));
        } else if ((stat === 'hpR' || stat === 'mpR') && typeof formatBonus === 'function') {
            try { displayVal = formatBonus(main.rawFinal); } catch (e) { displayVal = sign(main.rawFinal); }
        } else {
            displayVal = sign(main.rawFinal);
        }
        return '<div class="gm-stat-title">' + label + ' ' + displayVal + '</div>'
            + '<div class="gm-stat-line">' + lines.lineA + '</div>'
            + '<div class="gm-stat-line">' + lines.lineB + '</div>'
            + '<div class="gm-stat-sub">合計 ' + displayVal
            + (residual ? '（' + sign(residual) + ' 未分類）' : '')
            + (spec && spec.isRes ? ' · 原始抗性 ' + main.rawFinal : '')
            + (spec && spec.isEffPct ? ' · 原始 ER ' + main.rawFinal : '')
            + '</div>'
            + _gmCombatLegendHtml();
    }

    function _gmCountDerivedNodes(node) {
        if (!node || !node.querySelector) return 0;
        var count = 0;
        for (var i = 0; i < GM_DERIVED_SPECS.length; i++) {
            if (node.querySelector('#' + GM_DERIVED_SPECS[i].id)) count++;
        }
        return count;
    }

    function _gmMarkDerivedStatRow(el, stat) {
        if (!el) return;
        function mark(n) {
            n.setAttribute('data-gm-stat-hover', '1');
            n.setAttribute('data-gm-derived-stat', stat);
        }
        mark(el);
        var label = el.previousElementSibling;
        if (label && !label.id) mark(label);
        var node = el;
        for (var depth = 0; depth < 6 && node && node.parentElement; depth++) {
            var p = node.parentElement;
            if (_gmCountDerivedNodes(p) > 1) break;
            if (_gmCountDerivedNodes(p) === 1) {
                mark(p);
                var rowLabel = p.previousElementSibling;
                if (rowLabel && !rowLabel.id && _gmCountDerivedNodes(rowLabel) === 0) mark(rowLabel);
                node = p;
                continue;
            }
            break;
        }
    }

    function _gmStatTooltipEl() {
        var el = document.getElementById('gm-stat-tooltip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gm-stat-tooltip';
            document.body.appendChild(el);
        }
        return el;
    }

    function _gmFormatStatTooltip(stat) {
        var b = _gmCalcStatSource(stat);
        var lineA = [
            b.base + ' 基礎',
            b.alloc + ' 配點',
            b.panacea + ' 萬能藥',
            b.buff + ' 增益'
        ].join(' / ');
        var lineB = [
            b.equip + ' 裝備',
            b.setBonus + ' 套裝',
            b.other + ' 其他'
        ].join(' / ');
        var usedPan = (typeof player !== 'undefined' && player) ? (player.panaceaUsed || 0) : 0;
        var html = '<div class="gm-stat-title">' + GM_STAT_LABEL[stat] + ' ' + b.finalVal + '</div>'
            + '<div class="gm-stat-line">' + lineA + '</div>'
            + '<div class="gm-stat-line">' + lineB + '</div>'
            + '<div class="gm-stat-sub">合計 ' + b.finalVal
            + (b.residual ? '（含上限修正）' : '')
            + ' · 萬能藥 ( ' + usedPan + ' / 60 )</div>';
        return html;
    }

    function _gmCountStatNodes(node) {
        if (!node || !node.querySelector) return 0;
        var count = 0;
        for (var i = 0; i < GM_STAT_KEYS.length; i++) {
            if (node.querySelector('#dt-' + GM_STAT_KEYS[i])) count++;
        }
        return count;
    }

    function _gmBestStatRow(valueEl) {
        // 找到「只包含單一 dt-*」的最外層容器，通常就是該屬性列
        var best = valueEl;
        var node = valueEl;
        for (var depth = 0; depth < 8 && node && node.parentElement; depth++) {
            var p = node.parentElement;
            var cnt = _gmCountStatNodes(p);
            if (cnt <= 1) {
                best = p;
                node = p;
                continue;
            }
            break;
        }
        return best;
    }

    function _gmFindStatFromTarget(target) {
        if (!target || !target.closest) return null;
        var node = target;
        while (node && node !== document.documentElement) {
            if (node.id) {
                for (var j = 0; j < GM_DERIVED_SPECS.length; j++) {
                    if (node.id === GM_DERIVED_SPECS[j].id) return 'derived:' + GM_DERIVED_SPECS[j].stat;
                }
            }
            if (node.getAttribute && node.getAttribute('data-gm-derived-stat')) {
                return 'derived:' + node.getAttribute('data-gm-derived-stat');
            }
            if (node.getAttribute && node.getAttribute('data-gm-stat')) {
                return node.getAttribute('data-gm-stat');
            }
            node = node.parentElement;
        }
        return null;
    }

    function _gmMarkStatHoverTargets() {
        document.querySelectorAll('[data-gm-stat], [data-gm-derived-stat], [data-gm-stat-hover]').forEach(function(n) {
            n.removeAttribute('data-gm-stat');
            n.removeAttribute('data-gm-derived-stat');
            n.removeAttribute('data-gm-stat-hover');
        });
        if (!statDetailEnabled()) {
            _gmStatTooltipHide();
            return;
        }
        for (var i = 0; i < GM_STAT_KEYS.length; i++) {
            var s = GM_STAT_KEYS[i];
            var el = document.getElementById('dt-' + s);
            if (!el) continue;
            el.setAttribute('data-gm-stat-hover', '1');
            el.setAttribute('data-gm-stat', s);
            var row = _gmBestStatRow(el);
            if (!row) continue;
            row.setAttribute('data-gm-stat-hover', '1');
            row.setAttribute('data-gm-stat', s);
            var label = row.previousElementSibling;
            if (label) {
                label.setAttribute('data-gm-stat-hover', '1');
                label.setAttribute('data-gm-stat', s);
            }
            if (row.querySelectorAll) row.querySelectorAll('*').forEach(function(ch) {
                ch.setAttribute('data-gm-stat-hover', '1');
                ch.setAttribute('data-gm-stat', s);
            });
        }
        for (var di = 0; di < GM_DERIVED_SPECS.length; di++) {
            var spec = GM_DERIVED_SPECS[di];
            var del = document.getElementById(spec.id);
            if (!del || del.offsetParent === null) continue;
            if (spec.grp) {
                var grpWrap = del.closest('[data-grp="' + spec.grp + '"]');
                if (grpWrap && grpWrap.classList.contains('row-hidden')) continue;
            }
            _gmMarkDerivedStatRow(del, spec.stat);
        }
    }

    function _gmStatTooltipShow(ev, stat) {
        if (typeof player === 'undefined' || !player || !player.d) return;
        var el = _gmStatTooltipEl();
        if (stat.indexOf('derived:') === 0) {
            el.innerHTML = _gmFormatDerivedTooltip(stat.slice(8));
        } else {
            el.innerHTML = _gmFormatStatTooltip(stat);
        }
        el.style.display = 'block';
        window.__gmStatTooltipActive = stat;
        _gmStatTooltipMove(ev);
    }

    function _gmStatTooltipMove(ev) {
        var el = document.getElementById('gm-stat-tooltip');
        if (!el || el.style.display === 'none' || !ev) return;
        var x = ev.clientX + 14, y = ev.clientY + 12;
        var r = el.getBoundingClientRect();
        if (x + r.width > window.innerWidth - 8) x = Math.max(4, ev.clientX - r.width - 14);
        if (y + r.height > window.innerHeight - 8) y = Math.max(4, ev.clientY - r.height - 12);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }

    function _gmStatTooltipHide() {
        var el = document.getElementById('gm-stat-tooltip');
        if (el) el.style.display = 'none';
        window.__gmStatTooltipActive = null;
    }

    function _gmInstallStatTooltipHooks() {
        if (!window.__gmStatTooltipDelegation) {
            window.__gmStatTooltipDelegation = true;
            document.addEventListener('mousemove', function(ev) {
                if (!statDetailEnabled()) {
                    if (window.__gmStatTooltipActive) _gmStatTooltipHide();
                    return;
                }
                var stat = _gmFindStatFromTarget(ev.target);
                if (!stat) {
                    if (window.__gmStatTooltipActive) _gmStatTooltipHide();
                    return;
                }
                if (window.__gmStatTooltipActive !== stat) _gmStatTooltipShow(ev, stat);
                else _gmStatTooltipMove(ev);
            }, true);
            setInterval(function() {
                if (_gmCatchupBusy()) return;
                try { _gmMarkStatHoverTargets(); } catch (e) {}
            }, 1000);
            try { _gmMarkStatHoverTargets(); } catch (e) {}
        }
        ['updateUI', 'calcStats', 'recomputeStats'].forEach(function(name) {
            if (typeof window[name] !== 'function' || window[name].__gmStatTooltipWrap) return;
            var orig = window[name];
            window[name] = function() {
                var ret = orig.apply(this, arguments);
                if (!_gmCatchupBusy()) try { _gmMarkStatHoverTargets(); } catch (e) {}
                return ret;
            };
            window[name].__gmStatTooltipWrap = true;
        });
    }

    function _gmInstallAllyArrowHooks() {
        if (typeof window.__gmPatchAllyRangedDice !== 'function') {
            // 讀傭兵深拷貝 eq.arrow（buildAlly 快照），不消耗、不檢查數量
            window.__gmPeekAllyArrow = function(ally) {
                if (!allyArrowDmgEnabled() || !ally) return null;
                try {
                    var a = ally.eq && ally.eq.arrow;
                    if (!a || !a.id) return null;
                    if (typeof DB === 'undefined' || !DB.items) return null;
                    return DB.items[a.id] || null;
                } catch (e) { return null; }
            };
            // 公式同玩家：普攻/連射 = 弓骰+箭骰；三重矢 = 僅箭骰
            window.__gmPatchAllyRangedDice = function(dice, wpn, target, forTriple, ally) {
                if (!wpn || !wpn.isBow || !allyArrowDmgEnabled()) return dice;
                var ad = window.__gmPeekAllyArrow(ally);
                if (!ad || !target) return dice;
                var isL = target.s === 'L';
                if (forTriple) return isL ? ad.dmgL : ad.dmgS;
                return isL ? ((wpn.dmgL || 0) + (ad.dmgL || 0)) : ((wpn.dmgS || 0) + (ad.dmgS || 0));
            };
        }
        function _patchAllyFnDice(fnName, from, to) {
            var fn = window[fnName];
            if (typeof fn !== 'function' || fn.__gmAllyArrowDicePatched) return;
            var src = fn.toString();
            if (src.indexOf('__gmPatchAllyRangedDice') >= 0) { fn.__gmAllyArrowDicePatched = true; return; }
            if (src.indexOf(from) < 0) return;
            try {
                eval(fnName + ' = ' + src.replace(from, to));
                window[fnName].__gmAllyArrowDicePatched = true;
            } catch (e) {}
        }
        _patchAllyFnDice('allyStrikeRoll',
            "let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;",
            "let dice = wpn ? (t.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2; if (typeof __gmPatchAllyRangedDice === 'function' && wpn && wpn.isBow) dice = __gmPatchAllyRangedDice(dice, wpn, t, !!(typeof _allyInTriple !== 'undefined' && _allyInTriple), ally);");
        _patchAllyFnDice('allyAttackOnce',
            "let dice = wpn ? (isLarge ? wpn.dmgL : wpn.dmgS) : 2;",
            "let dice = wpn ? (isLarge ? wpn.dmgL : wpn.dmgS) : 2; if (typeof __gmPatchAllyRangedDice === 'function' && wpn && wpn.isBow) dice = __gmPatchAllyRangedDice(dice, wpn, t, !!(typeof _allyInTriple !== 'undefined' && _allyInTriple), ally);");
        _patchAllyFnDice('allyRapidfire',
            "let dice = wpn ? (mt.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2;",
            "let dice = wpn ? (mt.s === 'L' ? wpn.dmgL : wpn.dmgS) : 2; if (typeof __gmPatchAllyRangedDice === 'function' && wpn && wpn.isBow) dice = __gmPatchAllyRangedDice(dice, wpn, mt, !!(typeof _allyInTriple !== 'undefined' && _allyInTriple), ally);");
        if (typeof allyUnbonusBonus === 'function' && !allyUnbonusBonus.__gmAllyArrowWrap) {
            var _origAllyUnbonus = allyUnbonusBonus;
            allyUnbonusBonus = function(ally, t) {
                if (allyArrowDmgEnabled()) {
                    var wpn = (ally.eq && ally.eq.wpn) ? DB.items[ally.eq.wpn.id] : null;
                    if (wpn && wpn.isBow) {
                        var ad = window.__gmPeekAllyArrow(ally);
                        if (ad) {
                            if ((ad.unBonus || ad.unDice) && t && (t.un || t.isWolf)) return roll(1, 20);
                            return 0;
                        }
                    }
                }
                return _origAllyUnbonus(ally, t);
            };
            allyUnbonusBonus.__gmAllyArrowWrap = true;
        }
    }

    function _gmInstallWpnEnPetHitHooks() {
        window.__gmWpnEnPetHitBonus = function(owner, sm) {
            if (!wpnEnPetHitEnabled()) return 0;
            owner = owner || player;
            try {
                var inst = owner.eq && owner.eq.wpn;
                if (!inst || !inst.id || typeof DB === 'undefined' || !DB.items) return 0;
                var d = DB.items[inst.id];
                if (!d) return 0;
                var safe = (d.safe != null && isFinite(d.safe)) ? Number(d.safe) : 6;
                var en = (typeof capWpnEn === 'function') ? capWpnEn(inst.en || 0) : Math.min(15, Math.max(0, Number(inst.en) || 0));
                return (6 - safe + en) * 2;
            } catch (e) { return 0; }
        };
        // 項圈／寵物夥伴：加在 petGearBonus().hit（命中公式已含 pg.hit）；召喚命中不套用
        var _PET_HIT_GEAR_VER = 4;
        if (typeof window.petGearBonus === 'function') {
            var _basePetGear = window.petGearBonus.__gmWpnEnPetHitOrig || window.petGearBonus;
            if (!window.petGearBonus.__gmWpnEnPetHitWrap || window.petGearBonus.__gmWpnEnPetHitVer !== _PET_HIT_GEAR_VER) {
                window.petGearBonus = function() {
                    var g = _basePetGear.apply(this, arguments) || { dmg: 0, hit: 0 };
                    var bonus = 0;
                    try { bonus = (typeof __gmWpnEnPetHitBonus === 'function') ? __gmWpnEnPetHitBonus(player) : 0; } catch (e) { bonus = 0; }
                    if (bonus) g = { dmg: g.dmg || 0, hit: (g.hit || 0) + bonus };
                    return g;
                };
                window.petGearBonus.__gmWpnEnPetHitWrap = true;
                window.petGearBonus.__gmWpnEnPetHitVer = _PET_HIT_GEAR_VER;
                window.petGearBonus.__gmWpnEnPetHitOrig = _basePetGear;
            }
        }
    }

    // 卸下舊版體回／生祝補寵物召喚的 tick／logCombat 包裝（熱更新不整頁重整時）
    function _gmTeardownHotHealPetsSummonsHooks() {
        if (typeof window.logCombat === 'function' && window.logCombat.__gmHotHealPetsWrap) {
            var _lo = window.logCombat.__gmHotHealPetsOrig;
            if (typeof _lo === 'function') window.logCombat = _lo;
        }
        while (window.tick && window.tick.__gmHotHealPetsWrap) {
            var _unwrap = window.tick.__gmHotHealPetsOrig;
            if (typeof _unwrap !== 'function') break;
            window.tick = _unwrap;
        }
        try { delete window.__gmHotHealPetsDepth; } catch (e) {}
    }

    function _gmInstallDiffMagicHook() {
        if (typeof applyMobMagic !== 'function' || typeof dollDamageReduced !== 'function') return;
        if (!window.__gmDiffMagicInCall) window.__gmDiffMagicInCall = false;
        if (!dollDamageReduced.__gmDiffMagicPatch) {
            var _origDollDmgRed = dollDamageReduced;
            dollDamageReduced = function(dmg) {
                if (window.__gmDiffMagicInCall && typeof gmMobDmgOut === 'function') {
                    var g = window.__gmDifficulty;
                    if (g && g.dmg !== 1) return gmMobDmgOut(_origDollDmgRed(dmg));
                }
                return _origDollDmgRed(dmg);
            };
            dollDamageReduced.__gmDiffMagicPatch = true;
            dollDamageReduced.__gmDiffMagicOrig = _origDollDmgRed;
        }
        var _DIFF_MAGIC_HOOK_VER = 2;
        if (applyMobMagic.__gmDiffMagicWrap && applyMobMagic.__gmDiffMagicHookVer === _DIFF_MAGIC_HOOK_VER) return;
        var _origApplyMobMagic = applyMobMagic.__gmDiffMagicWrapOrig || applyMobMagic;
        applyMobMagic = function(mob, sk) {
            var g = window.__gmDifficulty;
            if (!g || g.dmg === 1 || !sk || !sk.dmg) {
                return _origApplyMobMagic.apply(this, arguments);
            }
            window.__gmDiffMagicInCall = true;
            try {
                return _origApplyMobMagic.apply(this, arguments);
            } finally {
                window.__gmDiffMagicInCall = false;
            }
        };
        applyMobMagic.__gmDiffMagicWrap = true;
        applyMobMagic.__gmDiffMagicWrapOrig = _origApplyMobMagic;
        applyMobMagic.__gmDiffMagicHookVer = _DIFF_MAGIC_HOOK_VER;
    }
    window.__gmInstallDiffMagicHook = _gmInstallDiffMagicHook;

    function _gmInstallSherineWorldCorrectHooks() {
        if (typeof applySherineBuff !== 'function' || applySherineBuff.__gmSherineCorrectWrap) return;
        var _origApplySherineBuff = applySherineBuff;
        applySherineBuff = function(idx) {
            var mob = mapState.mobs[idx];
            var savedAc, savedDr;
            if (sherineWorldCorrectEnabled() && mob) {
                savedAc = mob.ac;
                savedDr = mob.dr;
            }
            var ret = _origApplySherineBuff.apply(this, arguments);
            mob = mapState.mobs[idx];
            if (mob && mob._sherine) {
                if (sherineWorldCorrectEnabled()) {
                    mob.ac = savedAc !== undefined ? savedAc : (mob.ac || 0) + __gmSherineAcSub(mob);
                    mob.dr = savedDr !== undefined ? savedDr : Math.max(0, (mob.dr || 0) - __gmSherineDrAdd(mob.lv));
                    mob._gmSherineAcDrUndone = true;
                } else {
                    mob._gmSherineAcDrUndone = false;
                }
            }
            return ret;
        };
        applySherineBuff.__gmSherineCorrectWrap = true;
        if (typeof mobEffAC === 'function' && !mobEffAC.__gmSherineCorrectWrap) {
            var _origMobEffAC = mobEffAC;
            mobEffAC = function(m, actor) {
                var ac = _origMobEffAC(m, actor);
                if (sherineWorldCorrectEnabled() && m && m._sherine && !m._gmSherineAcDrUndone) {
                    ac += __gmSherineAcSub(m);
                }
                return ac;
            };
            mobEffAC.__gmSherineCorrectWrap = true;
        }
        try { __gmFixSherineMobsAcDr(); } catch (e) {}
    }

    function sherineGraceNoCdEnabled() {
        if (window.__gmSherineGraceNoCdOn === false) return false;
        if (window.__gmSherineGraceNoCdOn === true) return true;
        try { return localStorage.getItem('gm_sherine_grace_nocd_enabled') === '1'; } catch (e) { return false; }
    }

    function _gmInstallSherineGraceNoCdHooks() {
        if (typeof applySherineGrace !== 'function' || applySherineGrace.__gmGraceNoCdWrap) return;
        var _origApplySherineGrace = applySherineGrace;
        applySherineGrace = function(idx) {
            // 關閉時走原版；瘋狂席琳本身已無冷卻／可多隻，也走原版
            if (!sherineGraceNoCdEnabled() || (typeof sherineMadActive === 'function' && sherineMadActive())) {
                return _origApplySherineGrace.apply(this, arguments);
            }
            try {
                if (typeof sherineWorldActive !== 'function' || !sherineWorldActive()) return;
                if (typeof isSiegeArea === 'function' && isSiegeArea(mapState.current)) return;
                var mob = mapState.mobs[idx];
                if (!mob || mob.race === '血盟') return;
                if (Math.random() >= 0.01) return;
                // 無冷卻、允許多隻；一般席琳仍排除頭目；已恩賜不可再選（防 HP×10 疊爆）
                var _gc = mapState.mobs.filter(function(m) {
                    return m && !m._dead && m.curHp > 0 && m.race !== '血盟' && !m._grace && !m.boss;
                });
                if (!_gc.length) return;
                var g = _gc[Math.floor(Math.random() * _gc.length)];
                g._grace = true;
                g.hp = Math.floor(g.hp * 10); g.curHp = g.hp;
                g.exp = Math.floor((g.exp || 0) * 10);
                g.goldMin = Math.floor((g.goldMin || 0) * 10);
                g.goldMax = Math.floor((g.goldMax || 0) * 10);
                try { mapState.graceCdAt = 0; } catch (e) {}
                if (typeof logSys === 'function') {
                    logSys('<span class="grace-badge font-bold">✦ 席琳的恩賜降臨！</span><span class="c-sherine font-bold">' + g.n + '</span><span class="text-red-300"> 獲得了席琳的力量……擊敗它以奪取豐厚的報酬！</span>');
                }
            } catch (e) {}
        };
        applySherineGrace.__gmGraceNoCdWrap = true;
    }

    function _gmInstallCardDropMultHook() { /* 倍率由修改器負責 */ }

    // 腳本掉落（萬能藥／黑魔石／銀礦石／聖地遺物／進化果實／席琳結晶／區域額外／攜帶物等）皆乘 classicDropMult
    function _gmInstallClassicDropMultHook() { /* 倍率由修改器負責 */ }

    function _gmItemIdByName(name) {
        if (!name || typeof DB === 'undefined' || !DB.items) return null;
        for (var id in DB.items) {
            var d = DB.items[id];
            if (d && d.n === name) return id;
        }
        return null;
    }

    function _gmCodexImgName(card) {
        if (!card) return '';
        var imgs = card.querySelectorAll('img[alt]');
        for (var i = 0; i < imgs.length; i++) {
            var a = (imgs[i].getAttribute('alt') || '').trim();
            if (a) return a;
        }
        return '';
    }

    function _gmCodexTierFromBadge(card) {
        if (!card) return -1;
        var badge = card.querySelector('.absolute.top-1.right-1, .absolute');
        if (!badge) return -1;
        var t = (badge.textContent || '').trim();
        if (t.indexOf('金') >= 0) return 3;
        if (t.indexOf('銀') >= 0) return 2;
        if (t.indexOf('普') >= 0) return 1;
        return -1;
    }

    function _gmMarkCodexDexClick(card, name) {
        if (!card || !name) return;
        card.setAttribute('data-q', name);
        card.classList.add('gm-codex-dex-click', 'cursor-pointer');
        var tip = card.getAttribute('title') || '';
        if (tip.indexOf('掉落查詢') < 0) {
            card.setAttribute('title', (tip ? tip + ' · ' : '') + '點擊開啟掉落查詢');
        }
    }

    function _gmRevealItemBookTips(host) {
        if (!host || !collectionRevealEnabled()) return;
        var cards = host.querySelectorAll('div.relative.rounded-lg');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var nm = _gmCodexImgName(card);
            if (!nm) continue;

            var hasSilh = !!card.querySelector('.card-silhouette');
            var hasQ = false;
            var boldEls = card.querySelectorAll('.text-xs.font-bold, .text-sm.font-bold');
            for (var t = 0; t < boldEls.length; t++) {
                if ((boldEls[t].textContent || '').trim() === '？？？') { hasQ = true; break; }
            }
            // 未獲得：補 tip；已獲得原本就有 tip
            if ((hasSilh || hasQ) && !card.getAttribute('data-tip-id')) {
                var tipId = _gmItemIdByName(nm);
                if (tipId) {
                    card.setAttribute('data-tip-id', tipId);
                    card.classList.add('tip-host', 'cursor-help');
                }
            }
            _gmMarkCodexDexClick(card, nm);
        }
    }

    function _gmCardMapName(k) {
        if (typeof _cardMapName === 'function') {
            try { return _cardMapName(k); } catch (e) {}
        }
        return k;
    }

    function _gmRevealCardBookFull(host) {
        if (!host || !collectionRevealEnabled()) return;
        if (typeof CARD_MOB_INFO === 'undefined') return;
        var eleMap = (typeof _CARD_ELE !== 'undefined') ? _CARD_ELE : {
            fire: '火', water: '水', wind: '風', earth: '地', none: '無',
            holy: '聖', dark: '闇', undead: '不死', light: '光'
        };
        var cards = host.querySelectorAll('div.relative.rounded-lg');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var nm = _gmCodexImgName(card);
            if (!nm || !CARD_MOB_INFO[nm]) continue;
            var info = CARD_MOB_INFO[nm];
            var mob = info.mob || {};
            var tier = _gmCodexTierFromBadge(card);
            if (tier < 0) {
                tier = 0;
                try { if (typeof cardDexTier === 'function') tier = cardDexTier(nm) || 0; } catch (e) { tier = 0; }
            }

            // 未取得保留剪影；已取得不改圖示
            // 文字區改為完整資訊
            var textWrap = null;
            var kids = card.children;
            for (var c = 0; c < kids.length; c++) {
                if (kids[c].classList && kids[c].classList.contains('text-center')) {
                    textWrap = kids[c];
                    break;
                }
            }
            if (!textWrap) continue;

            var ele = eleMap[mob.e] || mob.e || '無';
            var maps = [];
            try {
                var rawMaps = (typeof CARD_MOB_MAPS !== 'undefined' && CARD_MOB_MAPS[nm]) ? CARD_MOB_MAPS[nm] : [];
                var seen = {};
                for (var mi = 0; mi < rawMaps.length; mi++) {
                    var mn = _gmCardMapName(rawMaps[mi]);
                    if (seen[mn]) continue;
                    seen[mn] = 1;
                    maps.push(mn);
                }
            } catch (e2) {}
            var shown = maps.slice(0, 5).join('、') + (maps.length > 5 ? ' …' : '');

            textWrap.innerHTML =
                '<div class="text-sm font-bold text-white truncate" title="' + nm + '">' + nm + '</div>' +
                '<div class="text-[11px] text-slate-500">Lv ' + (mob.lv != null ? mob.lv : '?') + '</div>' +
                '<div class="text-[11px] text-slate-300">HP ' + (mob.hp != null ? mob.hp : '?') + '・屬性 ' + ele + '</div>' +
                '<div class="text-[11px] text-slate-300">AC ' + (mob.ac != null ? mob.ac : '?') + '・MR ' + (mob.mr != null ? mob.mr : '?') + '</div>' +
                '<div class="text-[11px] text-slate-400 leading-tight mt-0.5">出沒：' + (shown || '—') + '</div>';

            // 階級色框與右上徽章對齊（0=未取得／1=普／2=銀／3=金）
            card.classList.remove('gm-codex-card-t0', 'gm-codex-card-t1', 'gm-codex-card-t2', 'gm-codex-card-t3');
            var tKey = 'gm-codex-card-t' + (tier >= 3 ? 3 : (tier >= 2 ? 2 : (tier >= 1 ? 1 : 0)));
            card.classList.add(tKey);
            _gmMarkCodexDexClick(card, nm);
        }
    }

    function _gmInstallRelicDescTypeHook() {
        var WRAP_VER = 6;
        if (typeof buildItemDescHTML !== 'function') return;
        if (buildItemDescHTML.__gmDescWrapVer === WRAP_VER) return;
        var _SLOT_TYPE = {
            helm: '頭盔', armor: '盔甲', shin: '脛甲', tshirt: '內衣', cloak: '斗篷',
            boots: '長靴', gloves: '手套', shield: '盾牌',
            amulet: '項鍊', ring: '戒指', belt: '腰帶', ear: '耳環', ear1: '耳環', ear2: '耳環',
            doll: '魔法娃娃', pet: '寵物裝備'
        };
        var _ELE_CN = { fire: '火屬性', water: '水屬性', wind: '風屬性', earth: '地屬性' };
        var _STATUS_CN = { stun: '暈眩', freeze: '冰凍', poison: '中毒', sleep: '睡眠', silence: '沉默' };
        // 特定物品手動覆寫（整段接在特效列後；優先於自動組字）
        var _ID_OVERRIDE = {};
        function relicEquipTypeLabel(id, d) {
            if (!d) return '';
            try {
                if (typeof equipCatKey === 'function' && typeof EQUIP_CATEGORIES !== 'undefined') {
                    var ck = equipCatKey(id, d);
                    if (ck) {
                        for (var i = 0; i < EQUIP_CATEGORIES.length; i++) {
                            if (EQUIP_CATEGORIES[i].key === ck) return EQUIP_CATEGORIES[i].name || '';
                        }
                    }
                }
            } catch (e) {}
            try {
                if (d.type === 'wpn' && typeof getWeaponTags === 'function') {
                    var tags = getWeaponTags(id) || [];
                    if (tags.length) return tags[0];
                }
            } catch (e2) {}
            if (d.type === 'wpn') {
                if (d.isBow) return /十字弓|弩/.test(d.n || '') ? '十字弓' : '弓';
                if (d.qigu) return '奇古獸';
                if (d.chainsword) return '鎖鏈劍';
                if (d.isWand) return '魔杖';
                if (d.w2h) return '雙手武器';
                return '武器';
            }
            if (d.armguard) return '臂甲';
            return _SLOT_TYPE[d.slot] || '';
        }
        function annotateRelicDesc(html, id) {
            if (!html || html.indexOf('【遺物】') < 0) return html;
            if (/【[^】]+】【遺物】/.test(html)) return html;
            var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
            if (!d) return html;
            var isR = false;
            try { isR = (typeof isRelic === 'function') ? !!isRelic(d) : !!d.relic; } catch (e) { isR = !!d.relic; }
            if (!isR) return html;
            var label = relicEquipTypeLabel(id, d);
            if (!label) return html;
            return html.replace('【遺物】', '【' + label + '】【遺物】');
        }
        function formatProcRateParts(d, baseOpt, perOpt) {
            var base = (baseOpt != null) ? baseOpt : ((d.procRateBase != null) ? d.procRateBase : 1);
            var per = (perOpt != null) ? perOpt : ((d.procRatePerEn != null) ? d.procRatePerEn : 1);
            var parts = ['基礎 ' + base + '%'];
            if (per) parts.push('每強化 +' + per + '%');
            return parts;
        }
        function formatSpellParts(sp) {
            var parts = [];
            if (!sp) return parts;
            var dmg = '';
            if (sp.dice && sp.dice.length >= 2) dmg = sp.dice[0] + 'D' + sp.dice[1];
            // spellProc 用 flat；少數資料可能直接寫 dmgBase
            var flat = (sp.flat != null) ? sp.flat : sp.dmgBase;
            if (flat) dmg += (dmg ? '+' : '') + flat;
            if (dmg) parts.push('傷害：' + dmg);
            if (sp.ele && _ELE_CN[sp.ele]) parts.push(_ELE_CN[sp.ele]);
            if (sp.aoe) parts.push(sp.skn ? ('全體（' + sp.skn + '）') : '全體');
            else if (sp.skn) parts.push('（' + sp.skn + '）');
            if (sp.heal) parts.push('吸取 ' + Math.round(sp.heal * 100) + '% HP');
            if (sp.status) {
                var sn = _STATUS_CN[sp.status.kind] || sp.status.kind;
                parts.push((sp.status.pct || 0) + '% ' + sn + (sp.status.dur ? (' ' + sp.status.dur + '秒') : ''));
            }
            return parts;
        }
        function formatSkillParts(skId) {
            var sk = (typeof DB !== 'undefined' && DB.skills) ? DB.skills[skId] : null;
            var parts = [];
            if (!sk) return parts;
            var dmg = '';
            if (sk.dmgDice && sk.dmgDice.length >= 2) dmg = sk.dmgDice[0] + 'D' + sk.dmgDice[1];
            if (sk.dmgBase) dmg += (dmg ? '+' : '') + sk.dmgBase;
            if (dmg) parts.push('傷害：' + dmg);
            if (sk.ele && _ELE_CN[sk.ele]) parts.push(_ELE_CN[sk.ele]);
            if (sk.aoe || sk.target === 'all') parts.push(sk.n ? ('全體（' + sk.n + '）') : '全體');
            else if (sk.n) parts.push('（' + sk.n + '）');
            if (sk.lifesteal) parts.push('吸取 HP');
            return parts;
        }
        function joinDetailParts(parts) {
            return parts.filter(Boolean).join(' / ');
        }
        function buildEffDetailLines(item, d) {
            var lines = [];
            if (_ID_OVERRIDE[item.id]) {
                lines.push(_ID_OVERRIDE[item.id]);
                return lines;
            }
            if (d.spellProc) {
                lines.push(joinDetailParts(formatProcRateParts(d).concat(formatSpellParts(d.spellProc))));
            }
            if (d.procSkill) {
                lines.push(joinDetailParts(formatProcRateParts(d).concat(formatSkillParts(d.procSkill))));
            }
            if (d.meleeHitSpell) {
                lines.push(joinDetailParts(['命中觸發'].concat(formatSpellParts(d.meleeHitSpell))));
            }
            if (d.procStatusSkill && d.procStatusSkill.skId) {
                var psk = (DB.skills && DB.skills[d.procStatusSkill.skId] && DB.skills[d.procStatusSkill.skId].n) || d.procStatusSkill.skId;
                lines.push(joinDetailParts(['基礎 ' + (d.procStatusSkill.rate || 0) + '%', '施放（' + psk + '）']));
            }
            if (d.redSpecter) {
                lines.push(joinDetailParts(formatProcRateParts(d, 4, 1).concat(['傷害：4D10', '水屬性', '吸取 10% HP'])));
            }
            if (d.blueSpecter) {
                lines.push(joinDetailParts(formatProcRateParts(d, 4, 1).concat(['恢復：3D6 MP'])));
            }
            var seen = {}, out = [];
            for (var li = 0; li < lines.length; li++) {
                var L = lines[li];
                if (!L || seen[L]) continue;
                seen[L] = true;
                out.push(L);
            }
            return out;
        }
        function annotateEffDetail(html, item) {
            if (!itemEffDetailEnabled() || !html || !item || !item.id) return html;
            if (html.indexOf('gm-item-eff-detail') >= 0) return html;
            var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
            if (!d || d.type !== 'wpn') return html;
            var marker = 'class="text-rose-300 font-bold">特效：';
            var idx = html.indexOf(marker);
            if (idx < 0) return html;
            var close = html.indexOf('</span>', idx);
            if (close < 0) return html;
            var detailLines = buildEffDetailLines(item, d);
            if (!detailLines.length) return html;
            var block = '';
            for (var i = 0; i < detailLines.length; i++) {
                block += '<br><span class="gm-item-eff-detail text-rose-200 text-xs">' + detailLines[i] + '</span>';
            }
            return html.slice(0, close + 7) + block + html.slice(close + 7);
        }
        var orig = buildItemDescHTML.__gmDescWrapOrig || buildItemDescHTML.__gmRelicTypeOrig || buildItemDescHTML;
        window.buildItemDescHTML = function(item) {
            var html = orig.apply(this, arguments);
            try {
                if (item && item.id) {
                    html = annotateRelicDesc(html, item.id);
                    html = annotateEffDetail(html, item);
                }
            } catch (e) {}
            return html;
        };
        window.buildItemDescHTML.__gmDescWrapVer = WRAP_VER;
        window.buildItemDescHTML.__gmDescWrapOrig = orig;
        window.buildItemDescHTML.__gmRelicTypeWrap = true;
        window.buildItemDescHTML.__gmRelicTypeOrig = orig;
    }

    function _gmInstallCollectionRevealHooks() {
        var itemSpecs = [
            { fn: 'renderEquipBook', host: 'equip-book-body' },
            { fn: 'renderMiscBook', host: 'misc-book-body' },
            { fn: 'renderRelicBook', host: 'relic-book-body' }
        ];
        for (var i = 0; i < itemSpecs.length; i++) {
            (function(spec) {
                if (typeof window[spec.fn] !== 'function' || window[spec.fn].__gmCodexReveal) return;
                var orig = window[spec.fn];
                window[spec.fn] = function() {
                    var ret = orig.apply(this, arguments);
                    try { _gmRevealItemBookTips(document.getElementById(spec.host)); } catch (e) {}
                    return ret;
                };
                window[spec.fn].__gmCodexReveal = true;
                window[spec.fn].__gmCodexRevealOrig = orig;
            })(itemSpecs[i]);
        }
        if (typeof window.renderCardBook === 'function' && !window.renderCardBook.__gmCodexReveal) {
            var _origCard = window.renderCardBook;
            window.renderCardBook = function() {
                var ret = _origCard.apply(this, arguments);
                try { _gmRevealCardBookFull(document.getElementById('card-book-body')); } catch (e) {}
                return ret;
            };
            window.renderCardBook.__gmCodexReveal = true;
            window.renderCardBook.__gmCodexRevealOrig = _origCard;
        }
    }

    window.__gmSnapshotAllySettings = function(ally) {
        if (!ally) return null;
        var snap = {
            atk: ally._atkSkill || '',
            heal: ally._healSkill || '',
            convert: ally._convertSkill || '',
            healHp: ally._healHpPct != null ? ally._healHpPct : 70,
            castMp: ally._castMpPct != null ? ally._castMpPct : 0,
            potHp: ally._potHpPct != null ? ally._potHpPct : 0,
            hpSkill: ally._hpSkillPct != null ? ally._hpSkillPct : 0
        };
        // 新版（如 3.1.9）每位傭兵有獨立「自動維持」勾選：存在才保存，舊版不受影響
        if (ally._autoBuff && typeof ally._autoBuff === 'object') {
            var autoBuff = {};
            for (var sid in ally._autoBuff) {
                if (!Object.prototype.hasOwnProperty.call(ally._autoBuff, sid)) continue;
                autoBuff[sid] = !!ally._autoBuff[sid];
            }
            snap.autoBuff = autoBuff;
        }
        return snap;
    };

    function normalizeAutoBuffMap(raw) {
        if (!raw || typeof raw !== 'object') return null;
        var out = {};
        for (var sid in raw) {
            if (!Object.prototype.hasOwnProperty.call(raw, sid)) continue;
            out[sid] = !!raw[sid];
        }
        return out;
    }

    function applyAutoBuffPresetIfSupported(ally, preset) {
        if (!ally || !preset || !preset.autoBuff) return;
        var map = normalizeAutoBuffMap(preset.autoBuff);
        if (!map) return;
        // 有 setAllyAutoBuff 代表新版 UI/流程已支援，逐項套用可同步觸發重算與儲存
        if (typeof setAllyAutoBuff === 'function' && ally._slot != null) {
            var slot = String(ally._slot);
            for (var sid in map) {
                if (!Object.prototype.hasOwnProperty.call(map, sid)) continue;
                try { setAllyAutoBuff(slot, sid, map[sid]); } catch (e) { /* ignore */ }
            }
            return;
        }
        // 後備：直接寫欄位（舊版通常不會讀此欄位，不影響行為）
        try { ally._autoBuff = map; } catch (e) { /* ignore */ }
    }

    window.__gmSaveAllyPreset = function(captainSlot, allySlot, preset) {
        if (!preset || captainSlot == null || allySlot == null) return;
        try { localStorage.setItem(presetKey(captainSlot, allySlot), JSON.stringify(preset)); } catch (e) {}
    };

    window.__gmLoadAllyPreset = function(captainSlot, allySlot) {
        try {
            var raw = localStorage.getItem(presetKey(captainSlot, allySlot));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    };

    window.__gmAllySkillValid = function(ally, kind, sid) {
        if (!sid) return true;
        if (!ally || !ally.skills || ally.skills.indexOf(sid) < 0) return false;
        if (typeof DB === 'undefined' || !DB.skills) return false;
        var sk = DB.skills[sid];
        if (!sk || sk.procOnly) return false;
        if (kind === 'atk') return sk.type === 'atk' && !sk.healSlot;
        if (kind === 'convert') return sk.type === 'convert' || sid === 'sk_illu_cube_harmony';
        if (kind === 'heal') {
            return (sk.type === 'heal' && !sk.autoBuff && ['sk_antidote', 'sk_holy_light', 'sk_cancel'].indexOf(sid) < 0)
                || (sk.type === 'atk' && sk.healSlot);
        }
        return false;
    };

    function clampPct(n, fallback) {
        var v = parseInt(n, 10);
        if (!isFinite(v)) return fallback;
        return Math.max(0, Math.min(100, v));
    }

    var SKILL_LABELS = { atk: '攻擊技能', heal: '治癒魔法', convert: '轉換技能' };
    var __gmPresetApplying = false;

    window.__gmApplyAllyPreset = function(ally, preset) {
        var skipped = [];
        if (!ally || !preset) return skipped;

        if (__gmAllySkillValid(ally, 'atk', preset.atk)) ally._atkSkill = preset.atk || '';
        else if (preset.atk) skipped.push(SKILL_LABELS.atk);

        if (__gmAllySkillValid(ally, 'heal', preset.heal)) ally._healSkill = preset.heal || '';
        else if (preset.heal) skipped.push(SKILL_LABELS.heal);

        if (__gmAllySkillValid(ally, 'convert', preset.convert)) ally._convertSkill = preset.convert || '';
        else if (preset.convert) skipped.push(SKILL_LABELS.convert);

        ally._healHpPct = clampPct(preset.healHp, 70);
        ally._castMpPct = clampPct(preset.castMp, 0);
        ally._potHpPct = clampPct(preset.potHp, 0);
        ally._hpSkillPct = clampPct(preset.hpSkill, 0);
        applyAutoBuffPresetIfSupported(ally, preset);
        return skipped;
    };

    function refreshSquadPanel() {
        try {
            if (typeof _squadSig !== 'undefined') _squadSig = '';
            if (typeof renderSquadPanel === 'function') renderSquadPanel();
        } catch (e) {}
    }

    function restoreAllyPreset(allySlot, preset) {
        if (!preset || typeof player === 'undefined' || !player) return;
        var ally = (player.allies || []).find(function(a) { return a && String(a._slot) === String(allySlot); });
        if (!ally) return;
        var skipped = [];
        __gmPresetApplying = true;
        try {
            skipped = __gmApplyAllyPreset(ally, preset);
        } finally {
            __gmPresetApplying = false;
        }
        if (typeof saveGame === 'function') saveGame();
        refreshSquadPanel();
        if (skipped.length && typeof logSys === 'function') {
            logSys('<span class="text-amber-300">[GM] 存檔 ' + allySlot + '：' + skipped.join('、') + ' 不存在，已保留遊戲預設。</span>');
        }
    }

    function wrapAllySetters() {
        var fns = [
            ['setAllyAtkSkill', 'atk'],
            ['setAllyHealSkill', 'heal'],
            ['setAllyConvertSkill', 'convert'],
            ['setAllyHealHp', 'healHp'],
            ['setAllyCastMp', 'castMp'],
            ['setAllyPotHp', 'potHp'],
            ['setAllyHpSkill', 'hpSkill']
        ];
        fns.forEach(function(pair) {
            var name = pair[0];
            if (typeof window[name] !== 'function' || window[name].__gmPresetWrap) return;
            var orig = window[name];
            window[name] = function(slot, val) {
                orig(slot, val);
                if (!allyPresetEnabled()) return;
                if (__gmPresetApplying) return;
                if (typeof player === 'undefined' || !player || currentSlot == null) return;
                var a = (player.allies || []).find(function(x) { return x && String(x._slot) === String(slot); });
                if (a) __gmSaveAllyPreset(currentSlot, slot, __gmSnapshotAllySettings(a));
            };
            window[name].__gmPresetWrap = true;
        });

        // 新版（3.1.9）額外的每兵自動維持開關：存在才包裝，舊版無此函式會自動跳過
        if (typeof window.setAllyAutoBuff === 'function' && !window.setAllyAutoBuff.__gmPresetWrap) {
            var _origAuto = window.setAllyAutoBuff;
            window.setAllyAutoBuff = function(slot, sid, on) {
                _origAuto(slot, sid, on);
                if (!allyPresetEnabled()) return;
                if (__gmPresetApplying) return;
                if (typeof player === 'undefined' || !player || currentSlot == null) return;
                var a = (player.allies || []).find(function(x) { return x && String(x._slot) === String(slot); });
                if (a) __gmSaveAllyPreset(currentSlot, slot, __gmSnapshotAllySettings(a));
            };
            window.setAllyAutoBuff.__gmPresetWrap = true;
        }
    }

    function wrapRehireAlly() {
        if (typeof rehireAlly !== 'function' || rehireAlly.__gmPresetWrap) return;
        var orig = rehireAlly;
        rehireAlly = function(slotN) {
            slotN = String(slotN);
            if (!allyPresetEnabled()) { orig(slotN); return; }
            var old = (player.allies || []).find(function(a) { return a && String(a._slot) === slotN; });
            var preset = old ? __gmSnapshotAllySettings(old) : __gmLoadAllyPreset(currentSlot, slotN);
            if (preset) __gmSaveAllyPreset(currentSlot, slotN, preset);
            orig(slotN);
            if (preset) restoreAllyPreset(slotN, preset);
        };
        rehireAlly.__gmPresetWrap = true;
    }

    function wrapToggleAlly() {
        if (typeof toggleAlly !== 'function' || toggleAlly.__gmPresetWrap) return;
        var orig = toggleAlly;
        toggleAlly = function(slotN) {
            slotN = String(slotN);
            if (!allyPresetEnabled()) { orig(slotN); return; }
            var wasActive = typeof isAllyActive === 'function' && isAllyActive(slotN);
            var preset = wasActive ? null : __gmLoadAllyPreset(currentSlot, slotN);
            orig(slotN);
            if (!wasActive && typeof isAllyActive === 'function' && isAllyActive(slotN) && preset) {
                restoreAllyPreset(slotN, preset);
            }
        };
        toggleAlly.__gmPresetWrap = true;
    }

    // ===== 傭兵隊伍共用背包：存檔時將可共用物品同步至「目前隊伍內傭兵」的存檔格 =====
    // 力量／治癒／敏捷魔法頭盔：依 id 排除，不論強化、祝福、席琳詞綴
    var SHARED_INV_EXCLUDE_IDS = { arm_45: 1, arm_46: 1, arm_47: 1 };
    // 即使在 WH_NO_STORE（不可入倉）仍要隊伍共用的物品
    var SHARED_INV_FORCE_SHARE_IDS = { new_item_241: 1 }; // 王族搜索狀

    function shouldNotShareItem(id) {
        if (!id || typeof DB === 'undefined' || !DB.items) return false;
        if (SHARED_INV_FORCE_SHARE_IDS[id]) return false;
        if (SHARED_INV_EXCLUDE_IDS[id]) return true;
        var d = DB.items[id];
        if (!d) return false;
        if (d.type === 'quest' || /^quest_/.test(id)) return true;
        if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(id) >= 0) return true;
        // 舊「寵物項圈」系統已移除，不再依 collar／項圈名稱排除（避免誤傷遺物尖刺項圈等）
        return false;
    }

    function cloneInvList(list) {
        return (list || []).map(function(it) {
            if (!it) return it;
            var c = JSON.parse(JSON.stringify(it));
            if (typeof uid === 'function') c.uid = uid();
            return c;
        });
    }

    function buildMergedInv(sourceInv, targetInv) {
        var shareable = (sourceInv || []).filter(function(it) { return it && !shouldNotShareItem(it.id); });
        var localOnly = (targetInv || []).filter(function(it) { return it && shouldNotShareItem(it.id); });
        return cloneInvList(shareable).concat(cloneInvList(localOnly));
    }

    function getPartySlots() {
        var slots = {};
        if (currentSlot != null) slots[String(currentSlot)] = true;
        (player.allies || []).forEach(function(a) {
            if (a && a._slot != null) slots[String(a._slot)] = true;
        });
        return Object.keys(slots);
    }

    function syncPartySlot(slotN, invOn, goldOn) {
        if (String(slotN) === String(currentSlot)) return;
        var raw = _lzGet('lineage_idle_save_' + slotN);
        if (!raw) return;
        var u = _saveUnwrap(raw);
        if (u.signed && !u.ok) return;
        if (!u.payload) return;
        var d;
        try { d = JSON.parse(u.payload); } catch (e) { return; }
        if (!d.p || !d.p.cls) return;
        if (invOn) d.p.inv = buildMergedInv(player.inv, d.p.inv);
        if (goldOn) d.p.gold = Math.max(0, Math.floor(Number(player.gold) || 0));
        _lzSet('lineage_idle_save_' + slotN, _saveWrap(JSON.stringify(d)));
    }

    function syncPartySaves() {
        try {
            var invOn = localStorage.getItem('gm_shared_inv_enabled') === '1';
            var goldOn = localStorage.getItem('gm_shared_gold_enabled') === '1';
            if (!invOn && !goldOn) return;
            if (typeof player === 'undefined' || !player || !player.cls || player.dead) return;
            var party = getPartySlots();
            if (party.length <= 1) return;
            party.forEach(function(slotN) { syncPartySlot(slotN, invOn, goldOn); });
        } catch (e) { console.log('[GM] 傭兵隊伍同步失敗:', e); }
    }

    function wrapSaveGame() {
        if (typeof saveGame !== 'function' || saveGame.__gmSharedInvWrap) return;
        var orig = saveGame;
        saveGame = function() {
            // 3.2.16+ 倉庫 whTxnCommit 依 saveGame() 回傳值判斷是否安全寫入；必須原樣回傳
            var ok = orig.apply(this, arguments);
            try { syncPartySaves(); } catch (e) {}
            return ok;
        };
        saveGame.__gmSharedInvWrap = true;
    }

    var _GM_ALLY_STATUS_ALERTS = [
        ['stun', '暈眩中'], ['freeze', '冰凍中'], ['stone', '石化中'], ['paralyze', '麻痺中'],
        ['silence', '沉默中'], ['magicseal', '魔法封印中'], ['poison', '中毒'], ['burn', '灼燒'],
        ['scald', '燙傷'], ['bleed', '出血'], ['sleep', '沉睡中'], ['slowAtk', '緩速']
    ];

    function _gmFormatAllyStatusAlert(ally) {
        var ss = (ally && ally.statuses) ? ally.statuses : {};
        var alerts = [];
        for (var i = 0; i < _GM_ALLY_STATUS_ALERTS.length; i++) {
            var pair = _GM_ALLY_STATUS_ALERTS[i];
            if ((ss[pair[0]] || 0) > 0) alerts.push(pair[1]);
        }
        return alerts.length ? '[' + alerts.join(', ') + ']' : '';
    }

    function _gmFindAllyNameEl(card) {
        return card ? card.querySelector('.font-bold.text-amber-200, .font-bold.text-slate-400') : null;
    }

    function _gmEnsureSquadNameStatus(slot, card) {
        var el = document.getElementById('squad-name-status-' + slot);
        if (el) return el;
        var nameEl = _gmFindAllyNameEl(card);
        if (!nameEl) return null;
        el = document.createElement('span');
        el.id = 'squad-name-status-' + slot;
        el.className = 'gm-squad-name-status';
        nameEl.insertAdjacentElement('afterend', el);
        return el;
    }

    function _gmUpdateAllyNameStatus(slot, ally) {
        var anchor = document.getElementById('squad-hp-' + slot) || document.getElementById('squad-rez-' + slot);
        if (!anchor) return;
        var card = anchor.closest('.rounded');
        if (!card) return;
        var el = _gmEnsureSquadNameStatus(slot, card);
        if (!el) return;
        var txt = _gmFormatAllyStatusAlert(ally);
        if (el._lastTxt !== txt) {
            el._lastTxt = txt;
            el.textContent = txt;
            el.className = txt
                ? 'gm-squad-name-status text-red-400 text-sm font-bold anim-flash'
                : 'gm-squad-name-status';
        }
        var legacy = document.getElementById('squad-status-' + slot);
        if (legacy) {
            legacy.textContent = '';
            legacy.style.display = 'none';
        }
    }

    var _GM_STATUS_ICON_SKILLS = {"sk_sunlight":"日光術","sk_shield":"保護罩","sk_holy_wpn":"神聖武器","sk_ench_wpn":"擬似魔法武器","sk_reveal":"無所遁形術","sk_load_up":"負重強化","sk_shield2":"鎧甲護持","sk_dex_up":"通暢氣脈術","sk_magic_shield":"魔法屏障","sk_meditation":"冥想術","sk_haste_spell":"加速術","sk_str_up":"體魄強健術","sk_bless_wpn":"祝福魔法武器","sk_greater_haste":"強力加速術","sk_berserk":"狂暴術","sk_holy_dash":"神聖疾走","sk_blizzard_storm":"冰雪颶風","sk_fire_prison":"火牢","sk_invisible":"隱身術","sk_holy_barrier":"聖結界","sk_soul_up":"靈魂昇華","sk_solid_shield":"堅固防護","sk_reduction_armor":"增幅防禦","sk_spike_armor":"尖刺盔甲","sk_counter_barrier":"反擊屏障","sk_elf_mr":"魔法防禦","sk_elf_purify":"淨化精神","sk_elf_eleres":"屬性防禦","sk_elf_singleres":"單屬性防禦","sk_elf_firewpn":"火焰武器","sk_elf_windshot":"風之神射","sk_elf_winddash":"風之疾走","sk_elf_earthguard":"大地防護","sk_elf_watervital":"水之元氣","sk_elf_dancefire":"舞躍之火","sk_elf_stormeye":"暴風之眼","sk_elf_earthshield":"大地屏障","sk_elf_earthbless":"大地的祝福","sk_elf_blazewpn":"烈炎武器","sk_elf_flamesoul":"烈焰之魂","sk_elf_stormshot":"暴風神射","sk_elf_preciseshot":"精準射擊","sk_elf_steelguard":"鋼鐵防護","sk_elf_attrfire":"屬性之火","sk_elf_physboost":"體能激發","sk_elf_energyboost":"能量激發","sk_elf_mirror":"鏡反射","sk_dark_str":"力量提升","sk_dark_mrup":"影之防護","sk_dark_stealth":"暗隱術","sk_dark_poison":"附加劇毒","sk_dark_dex":"敏捷提升","sk_dark_poisonres":"毒性抵抗","sk_dark_burn":"燃燒鬥志","sk_dark_walkhaste":"行走加速","sk_dark_fang":"暗影之牙","sk_dark_dodge":"暗影閃避","sk_dark_erup":"迴避提升","sk_dark_double":"雙重破壞","sk_illu_ogre":"幻覺：歐吉","sk_illu_cube_burn":"立方：燃燒","sk_illu_mirror":"鏡像","sk_illu_focus":"專注","sk_illu_lich":"幻覺：巫妖","sk_illu_cube_quake":"立方：地裂","sk_illu_golem":"幻覺：鑽石高崙","sk_illu_cube_shock":"立方：衝擊","sk_illu_endure":"耐力","sk_illu_avatar":"幻覺：化身","sk_illu_insight":"洞察","sk_illu_cube_harmony":"立方：和諧","sk_illu_pain":"疼痛的歡愉","sk_dragon_armor":"龍之護鎧","sk_dragon_flameslash":"燃燒擊砍","sk_dragon_awaken_antares":"覺醒：安塔瑞斯","sk_dragon_bloodlust":"血之渴望","sk_dragon_awaken_falion":"覺醒：法利昂","sk_dragon_deadlybody":"致命身軀","sk_dragon_awaken_baraka":"覺醒：巴拉卡斯","sk_royal_precise":"精準目標","sk_royal_burnweapon":"灼熱武器","sk_royal_bravewill":"勇猛意志","sk_royal_shield":"閃亮之盾","sk_warrior_throwaxe":"戰斧投擲","sk_warrior_endurance":"體能強化","sk_warrior_outlaw":"亡命之徒","sk_helm_dex1":"通暢氣脈術","sk_helm_dex2":"加速術","sk_helm_str1":"擬似魔法武器","sk_helm_str2":"無所遁形術","sk_helm_str3":"體魄強健術"};

    function _gmCollectEntityBuffIconRows(entity, withHots) {
        var rows = [], seen = new Set();
        var buffs = (entity && entity.buffs) ? entity.buffs : {};
        // 🤝 3.2.7+：傭兵常駐職業藥水（_mercPermanentPotions）不寫入 buff 計時，需依職業補圖示
        var mercPots = !!(entity && entity._mercPermanentPotions);
        var cls = (entity && entity.cls) || '';
        var add = function(name, seconds, label) {
            if (!name || seen.has(name)) return;
            seen.add(name);
            var sec = Math.max(0, Math.ceil(Number(seconds) || 0));
            rows.push({ name: name, ticks: Number(seconds) || 0, label: label || name, sec: sec });
        };
        if (buffs.haste > 0 || entity._equipHaste || mercPots) add('加速術', buffs.haste || 0, '加速');
        if (buffs.brave > 0 || (mercPots && ['knight', 'dragon', 'warrior', 'royal'].indexOf(cls) >= 0)) add('勇敢藥水', buffs.brave || 0, '勇敢藥水');
        // 藍色：非常駐，跟隨隊長勾選飲用後寫入 ally.buffs.blue
        if (buffs.blue > 0) add('藍色藥水', buffs.blue, '藍色藥水');
        // 慎重：法師傭兵常駐（與 recomputeStats _mercPots 一致；幻術士不常駐）
        if (buffs.cautious > 0 || (mercPots && cls === 'mage')) add('慎重藥水', buffs.cautious || 0, '慎重藥水');
        if (buffs.elfcookie > 0 || (mercPots && cls === 'elf')) add('精靈餅乾', buffs.elfcookie || 0, '精靈餅乾');
        // 變身：套裝 _setPoly 優先；卷軸 poly；若 _setPoly 尚未重算則由裝備套裝推導
        var polyForm = entity._setPoly || ((buffs.poly > 0 && entity.poly) ? entity.poly : null);
        if (!polyForm && entity.eq && typeof DB !== 'undefined' && DB.items) {
            var setCheck = {}, setSeen = {};
            for (var slot in entity.eq) {
                if (!Object.prototype.hasOwnProperty.call(entity.eq, slot)) continue;
                var eq = entity.eq[slot];
                if (!eq || !eq.id || setSeen[eq.id]) continue;
                var ed = DB.items[eq.id];
                if (!ed || !ed.set) continue;
                setSeen[eq.id] = true;
                setCheck[ed.set] = (setCheck[ed.set] || 0) + 1;
            }
            var SPF = (typeof SET_POLY_FORMS !== 'undefined') ? SET_POLY_FORMS : null;
            if (setCheck.dk >= 4) polyForm = SPF ? SPF.dk : { n: '真‧死亡騎士' };
            if (setCheck.kurt >= 4) polyForm = SPF ? SPF.kurt : { n: '真‧克特' };
            if (setCheck.demon >= 4) polyForm = SPF ? SPF.demon : { n: '惡魔' };
            if (setCheck.darkelf >= 3) polyForm = SPF ? SPF.darkelf : { n: '高等黑暗精靈' };
        }
        if (polyForm) add('變形術', buffs.poly || 0, polyForm.n || '變身');
        for (var id in _GM_STATUS_ICON_SKILLS) {
            if (!Object.prototype.hasOwnProperty.call(_GM_STATUS_ICON_SKILLS, id)) continue;
            if ((buffs[id] || 0) <= 0) continue;
            var iconName = _GM_STATUS_ICON_SKILLS[id];
            var label = iconName;
            if (typeof DB !== 'undefined' && DB.skills && DB.skills[id]) label = DB.skills[id].n;
            add(iconName, buffs[id], label);
        }
        if (withHots) {
            [['sk_regen', '體力回復術'], ['sk_elf_lifebless', '生命的祝福']].forEach(function(pair) {
                var sid = pair[0], hotName = pair[1];
                var h = entity.hots && entity.hots[sid];
                if (!h || h.ticksLeft <= 0) return;
                var remainTicks = Math.max(0, (h.ticksLeft - 1) * (h.interval || 0) + (h.cd || 0));
                var hotLabel = hotName;
                if (typeof DB !== 'undefined' && DB.skills && DB.skills[sid]) hotLabel = DB.skills[sid].n;
                add(hotName, Math.ceil(remainTicks / 10), hotLabel);
            });
        }
        return rows;
    }

    function _gmCollectPlayerBuffIconRows() {
        if (typeof player === 'undefined' || !player || !player.buffs) return [];
        return _gmCollectEntityBuffIconRows(player, true);
    }

    function _gmCollectAllyBuffRows(ally) {
        if (!ally) return [];
        return _gmCollectEntityBuffIconRows(ally, false);
    }

    function _gmInstallPlayerStatusIconHooks() {
        if (typeof window.renderStatusIconBar !== 'function' || window.renderStatusIconBar.__gmSecWrap) return;
        var orig = window.renderStatusIconBar;
        window.renderStatusIconBar = function() {
            if (typeof state !== 'undefined' && state.ff) return;
            var bar = document.getElementById('status-icon-bar');
            if (!bar || typeof player === 'undefined' || !player || !player.buffs) return;
            var sig = _gmCollectPlayerBuffIconRows().map(function(x) { return x.name + '|' + x.label; }).join('||');
            var secTick = typeof state === 'undefined' || state.ticks % 10 === 0;
            if (!secTick && sig === (bar.dataset.statusSig || '')) return;
            orig.apply(this, arguments);
        };
        window.renderStatusIconBar.__gmSecWrap = true;
    }

    function _gmEnsureSquadBuffBar(slot) {
        var barId = 'squad-buff-bar-' + slot;
        var bar = document.getElementById(barId);
        var anchor = document.getElementById('squad-hp-' + slot) || document.getElementById('squad-rez-' + slot);
        if (!anchor) {
            if (bar) bar.remove();
            return null;
        }
        var card = anchor.closest('.rounded');
        if (!card) return null;
        if (!bar) {
            bar = document.createElement('div');
            bar.id = barId;
            bar.className = 'gm-squad-buff-bar';
            bar.setAttribute('aria-label', '傭兵增益狀態');
            var nameEl = card.querySelector('.font-bold.text-amber-200, .font-bold.text-slate-400');
            var nameRow = nameEl ? nameEl.closest('.flex') : null;
            if (nameRow && nameRow.parentElement === card) card.insertBefore(bar, nameRow);
            else card.insertBefore(bar, card.firstChild);
        }
        return bar;
    }

    function _gmRenderAllyBuffBar(slot, ally) {
        var bar = _gmEnsureSquadBuffBar(slot);
        if (!bar) return;
        var rows = _gmCollectAllyBuffRows(ally);
        var sig = rows.map(function(x) { return x.name + '|' + x.label; }).join('||');
        if (bar.dataset.statusSig !== sig) {
            bar.dataset.statusSig = sig;
            if (!rows.length) {
                bar.innerHTML = '';
                bar.style.display = 'none';
                return;
            }
            bar.style.display = '';
            bar.innerHTML = rows.map(function(x, i) {
                var title = x.label + (x.ticks > 0 ? '｜剩餘 ' + x.sec + ' 秒' : '');
                return '<div class="status-icon" data-status-index="' + i + '" title="' + title + '"><img src="assets/state-icons/' + encodeURIComponent(x.name) + '.jpg" alt="' + x.label + '"></div>';
            }).join('');
        } else {
            bar.style.display = rows.length ? '' : 'none';
            if (typeof state !== 'undefined' && state.ticks % 10 !== 0) return;
            rows.forEach(function(x, i) {
                var icon = bar.querySelector('[data-status-index="' + i + '"]');
                if (!icon) return;
                icon.title = x.label + (x.ticks > 0 ? '｜剩餘 ' + x.sec + ' 秒' : '');
            });
        }
    }

    function _gmClearSquadMercUi(slot) {
        var bar = document.getElementById('squad-buff-bar-' + slot);
        if (bar) bar.remove();
        var nameSt = document.getElementById('squad-name-status-' + slot);
        if (nameSt) nameSt.remove();
        var legacy = document.getElementById('squad-status-' + slot);
        if (legacy) legacy.style.display = '';
    }

    function _gmUpdateAllSquadBuffBars() {
        if (typeof state !== 'undefined' && state.ff) return;
        if (typeof player === 'undefined' || !player || !player.allies) return;
        var allies = player.allies.filter(function(a) { return !!a; });
        if (!squadMercUiEnabled()) {
            allies.forEach(function(a) {
                if (a._slot == null) return;
                _gmClearSquadMercUi(a._slot);
            });
            return;
        }
        allies.forEach(function(a) {
            if (a._slot == null) return;
            _gmRenderAllyBuffBar(a._slot, a);
            _gmUpdateAllyNameStatus(a._slot, a);
        });
    }

    window.__gmUpdateSquadMercUi = _gmUpdateAllSquadBuffBars;

    function _gmInstallSquadBuffHooks() {
        if (typeof window.renderSquadPanel === 'function' && !window.renderSquadPanel.__gmBuffWrap) {
            var _origSquad = window.renderSquadPanel;
            window.renderSquadPanel = function() {
                var ret = _origSquad.apply(this, arguments);
                try { _gmUpdateAllSquadBuffBars(); } catch (e) {}
                return ret;
            };
            window.renderSquadPanel.__gmBuffWrap = true;
        }
    }

    // 插件／UI 若在 loadGame 的 calcStats 之前觸發 petsOutList→petRoster，
    // 會用尚未重算的魅力跑 _petEnforceCarry，把出戰寵物收回並寫入保管桶。
    function _gmInstallPetCarryGuard() {
        if (!window.__gmPetCarryGuardInit) {
            window.__gmPetCarryGuardInit = true;
            window.__gmStatsReadyForPets = false;
        }
        if (typeof window.loadGame === 'function' && !window.loadGame.__gmPetCarryWrap) {
            var _prevLoad = window.loadGame;
            window.loadGame = function() {
                window.__gmStatsReadyForPets = false;
                return _prevLoad.apply(this, arguments);
            };
            window.loadGame.__gmPetCarryWrap = true;
        }
        if (typeof window.calcStats === 'function' && !window.calcStats.__gmPetCarryWrap) {
            var _prevCalc = window.calcStats;
            window.calcStats = function() {
                var ret = _prevCalc.apply(this, arguments);
                window.__gmStatsReadyForPets = true;
                return ret;
            };
            window.calcStats.__gmPetCarryWrap = true;
        }
        if (typeof window._petEnforceCarry === 'function' && !window._petEnforceCarry.__gmPetCarryWrap) {
            var _prevEnforce = window._petEnforceCarry;
            window._petEnforceCarry = function() {
                if (!window.__gmStatsReadyForPets) return;
                if (typeof player === 'undefined' || !player || !player.d) return;
                return _prevEnforce.apply(this, arguments);
            };
            window._petEnforceCarry.__gmPetCarryWrap = true;
        }
        // 已在遊戲中（hooks 晚掛）→ 視為魅力已就緒
        try {
            if (typeof player !== 'undefined' && player && player.cls && player.d
                && document.getElementById('game-screen')
                && !document.getElementById('game-screen').classList.contains('hidden')) {
                window.__gmStatsReadyForPets = true;
            }
        } catch (e) {}
    }

    // 攻城獲勝期間：讀檔／上線改到城堡安全區（原版 loadGame 固定 setMapSelectors(getHomeTown())）
    // 只攔截「讀檔當下第一次」getHomeTown，避免離線補跑結束／死亡回村的 homeTown() 被誤導向城堡
    function _gmInstallCastleLoginHooks() {
        if (typeof window.getHomeTown !== 'function' || typeof window.loadGame !== 'function') return;
        var VER = 3;
        if (window.getHomeTown.__gmCastleLoginVer === VER
            && window.loadGame.__gmCastleLoginVer === VER) return;

        var _prevHome = window.getHomeTown.__gmCastleLoginOrig || window.getHomeTown;
        while (_prevHome && _prevHome.__gmCastleLoginWrap) _prevHome = _prevHome.__gmCastleLoginOrig;
        window.getHomeTown = function() {
            if (window.__gmCastleLoginPending) {
                window.__gmCastleLoginPending = false;
                if (castleLoginEnabled()) {
                    try {
                        // 占領剛過期：先跑自動續約（若有），再判定能否進城堡
                        if (typeof player !== 'undefined' && player && player.siege
                            && player.siege.victoryCity
                            && Number(player.siege.victoryUntil) > 0
                            && Date.now() >= Number(player.siege.victoryUntil)
                            && typeof siegeUpkeepTick === 'function') {
                            try { siegeUpkeepTick(); } catch (eU) {}
                        }
                        if (typeof siegeVictoryActive === 'function' && siegeVictoryActive()
                            && typeof victoryCityCfg === 'function') {
                            var cfg = victoryCityCfg();
                            if (cfg && cfg.castle) return cfg.castle;
                        }
                    } catch (e0) {}
                }
            }
            return _prevHome.apply(this, arguments);
        };
        window.getHomeTown.__gmCastleLoginWrap = true;
        window.getHomeTown.__gmCastleLoginVer = VER;
        window.getHomeTown.__gmCastleLoginOrig = _prevHome;

        var _prevLoad = window.loadGame.__gmCastleLoginOrig || window.loadGame;
        while (_prevLoad && _prevLoad.__gmCastleLoginWrap) _prevLoad = _prevLoad.__gmCastleLoginOrig;
        window.loadGame = function() {
            window.__gmCastleLoginPending = true;
            try {
                return _prevLoad.apply(this, arguments);
            } finally {
                window.__gmCastleLoginPending = false;
            }
        };
        window.loadGame.__gmCastleLoginWrap = true;
        window.loadGame.__gmCastleLoginVer = VER;
        window.loadGame.__gmCastleLoginOrig = _prevLoad;
    }

    function _gmInstallPetReevolveHooks() {
        var REEVO_VER = 8;
        var REEVO_FRUIT = 'item_victory_fruit';
        if (window.__gmPetReevoInstalledVer === REEVO_VER
            && typeof window.renderPetStorageNPC === 'function'
            && window.renderPetStorageNPC.__gmPetReevoWrap
            && typeof window.__gmRefreshPetReevolveUi === 'function') {
            return;
        }
        // 遊戲寵物模組尚未就緒：稍後由 installHooks 再試，勿標記已安裝
        if (typeof window.renderPetStorageNPC !== 'function') return;
        function _gmPetReEsc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
        function _gmPetIsEvolved(p) {
            if (!p || typeof PET_BOOK === 'undefined') return false;
            var def = PET_BOOK[p.form];
            return !!(def && (def.tier || 0) > 0);
        }
        function _gmPetReverseBase(form) {
            if (!form || form === '黃金龍' || typeof PET_BOOK === 'undefined' || !PET_BOOK) return null;
            var keys = Object.keys(PET_BOOK);
            for (var i = 0; i < keys.length; i++) {
                var d = PET_BOOK[keys[i]];
                if (d && (d.tier || 0) === 0 && d.evo === form) return keys[i];
            }
            return null;
        }
        function _gmPetBaseFormList() {
            var out = [];
            if (typeof PET_BOOK === 'undefined' || !PET_BOOK) return out;
            Object.keys(PET_BOOK).forEach(function(name) {
                var d = PET_BOOK[name];
                if (d && (d.tier || 0) === 0 && d.evo) out.push(name);
            });
            return out;
        }
        function _gmPetUpBound(arr, which) {
            if (!arr) return 0;
            return which === 'max' ? (arr[1] != null ? arr[1] : arr[0] || 0) : (arr[0] || 0);
        }
        function _gmPetAvg(a, b) {
            return Math.round((Number(a) + Number(b)) / 2);
        }
        // 與原版寵物升級相同：hpUp/mpUp 區間隨機（lootRng committed）
        function _gmPetRollStatUp(def, kind) {
            var arr = kind === 'mp' ? def.mpUp : def.hpUp;
            var lo = (arr && arr[0]) || 0;
            var hi = (arr && arr[1] != null) ? arr[1] : lo;
            if (hi < lo) { var t = lo; lo = hi; hi = t; }
            if (typeof lootRng === 'function') {
                return lo + Math.floor(lootRng(kind === 'mp' ? 'petMp' : 'petHp') * (hi - lo + 1));
            }
            return lo + Math.floor(Math.random() * (hi - lo + 1));
        }
        // 預覽：隨機成長上下限之均值（實際骰值可能有誤差）
        function _gmPetReevolveExpect(p, baseForm) {
            var baseDef = PET_BOOK[baseForm];
            var evoDef = p && PET_BOOK[p.form];
            if (!baseDef || !evoDef) return null;
            var L = Math.max(1, Math.floor(Number(p.lv) || 1));
            var baseLv0 = baseDef.lv0 || 1;
            var baseSteps = Math.max(0, L - baseLv0);
            var evoSteps = Math.max(0, L - 1);
            var baseHp0 = baseDef.hp0 != null ? baseDef.hp0 : 30;
            var baseMp0 = baseDef.mp0 != null ? baseDef.mp0 : 0;
            var baseHpMin = baseHp0 + baseSteps * _gmPetUpBound(baseDef.hpUp, 'min');
            var baseHpMax = baseHp0 + baseSteps * _gmPetUpBound(baseDef.hpUp, 'max');
            var baseMpMin = baseMp0 + baseSteps * _gmPetUpBound(baseDef.mpUp, 'min');
            var baseMpMax = baseMp0 + baseSteps * _gmPetUpBound(baseDef.mpUp, 'max');
            var halfHpMin = Math.max(1, Math.floor(baseHpMin * 0.5));
            var halfHpMax = Math.max(1, Math.floor(baseHpMax * 0.5));
            var halfMpMin = Math.max(0, Math.floor(baseMpMin * 0.5));
            var halfMpMax = Math.max(0, Math.floor(baseMpMax * 0.5));
            var evoHpMin = evoSteps * _gmPetUpBound(evoDef.hpUp, 'min');
            var evoHpMax = evoSteps * _gmPetUpBound(evoDef.hpUp, 'max');
            var evoMpMin = evoSteps * _gmPetUpBound(evoDef.mpUp, 'min');
            var evoMpMax = evoSteps * _gmPetUpBound(evoDef.mpUp, 'max');
            var halfHp = _gmPetAvg(halfHpMin, halfHpMax);
            var halfMp = _gmPetAvg(halfMpMin, halfMpMax);
            var evoHp = _gmPetAvg(evoHpMin, evoHpMax);
            var evoMp = _gmPetAvg(evoMpMin, evoMpMax);
            var mhp = Math.max(1, _gmPetAvg(halfHpMin + evoHpMin, halfHpMax + evoHpMax));
            var mmp = Math.max(0, _gmPetAvg(halfMpMin + evoMpMin, halfMpMax + evoMpMax));
            return {
                lv: L,
                halfHp: halfHp, halfMp: halfMp,
                evoHp: evoHp, evoMp: evoMp,
                mhp: mhp, mmp: mmp
            };
        }
        // 實際套用：逐級骰成長（與 pets 升級同公式）
        function _gmPetReevolveRoll(p, baseForm) {
            var baseDef = PET_BOOK[baseForm];
            var evoDef = PET_BOOK[p.form];
            if (!baseDef || !evoDef) return null;
            var L = Math.max(1, Math.floor(Number(p.lv) || 1));
            var hp = baseDef.hp0 != null ? baseDef.hp0 : 30;
            var mp = baseDef.mp0 != null ? baseDef.mp0 : 0;
            var i0 = baseDef.lv0 || 1;
            for (var i = i0; i < L; i++) {
                hp += _gmPetRollStatUp(baseDef, 'hp');
                mp += _gmPetRollStatUp(baseDef, 'mp');
            }
            var halfHp = Math.max(1, Math.floor(hp * 0.5));
            var halfMp = Math.max(0, Math.floor(mp * 0.5));
            var evoHp = 0, evoMp = 0;
            for (var j = 1; j < L; j++) {
                evoHp += _gmPetRollStatUp(evoDef, 'hp');
                evoMp += _gmPetRollStatUp(evoDef, 'mp');
            }
            return {
                halfHp: halfHp, halfMp: halfMp,
                evoHp: evoHp, evoMp: evoMp,
                mhp: Math.max(1, halfHp + evoHp),
                mmp: Math.max(0, halfMp + evoMp),
                lv: L
            };
        }
        function _gmPetVictoryFruitCnt() {
            return (player.inv || []).filter(function(i) { return i && i.id === REEVO_FRUIT; })
                .reduce(function(s, i) { return s + (i.cnt || 0); }, 0);
        }
        function _gmPetVictoryFruitName() {
            try {
                if (typeof DB !== 'undefined' && DB.items && DB.items[REEVO_FRUIT]) return DB.items[REEVO_FRUIT].n;
            } catch (e) {}
            return '勝利果實';
        }
        function _gmPetReCloseOverlay() {
            var old = document.getElementById('gm-pet-reevolve-overlay');
            if (old) old.remove();
        }
        function _gmPetReShowOverlay(title, tip, bodyHtml) {
            _gmPetReCloseOverlay();
            var ov = document.createElement('div');
            ov.id = 'gm-pet-reevolve-overlay';
            ov.style.cssText = 'position:fixed;inset:0;z-index:98;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
            ov.addEventListener('click', function(ev) { if (ev.target === ov) ov.remove(); });
            ov.innerHTML = '<div data-gm-reevo-panel="1" style="width:360px;max-height:80vh;overflow:auto;background:#0b1220;border:1px solid #6d28d9;border-radius:8px;padding:14px;font-size:13px;">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
                + '<span class="text-purple-300 font-bold">' + title + '</span>'
                + '<button type="button" class="btn" style="padding:2px 10px;border:1px solid #475569;border-radius:4px;" data-gm-reevo-x="1">✕</button>'
                + '</div>'
                + (tip ? '<div class="text-slate-400" style="font-size:11px;margin-bottom:6px;">' + tip + '</div>' : '')
                + bodyHtml
                + '</div>';
            ov.querySelector('[data-gm-reevo-x]').addEventListener('click', function() { ov.remove(); });
            document.body.appendChild(ov);
            return ov;
        }
        function _gmPetReConfirm(uidv, baseForm) {
            var p = typeof _petFind === 'function' ? _petFind(uidv) : null;
            if (!p || !baseForm || !PET_BOOK[baseForm]) return;
            var exp = _gmPetReevolveExpect(p, baseForm);
            if (!exp) return;
            var fN = _gmPetVictoryFruitName();
            var cnt = _gmPetVictoryFruitCnt();
            if (cnt <= 0) {
                if (typeof logSys === 'function') logSys('<span class="text-red-400">身上沒有 ' + fN + '，無法重新進化。</span>');
                return;
            }
            var body = '<div class="text-slate-300" style="font-size:12px;margin-bottom:8px;line-height:1.55;">'
                + '型態／等級不變。<br>'
                + '① 原型「' + _gmPetReEsc(baseForm) + '」Lv.' + exp.lv + ' 均值減半 → HP ' + exp.halfHp + '／MP ' + exp.halfMp + '<br>'
                + '② 「' + _gmPetReEsc(p.form) + '」進化後成長均值（Lv.1→' + exp.lv + '）→ HP +' + exp.evoHp + '／MP +' + exp.evoMp + '<br>'
                + '<span class="text-amber-300 font-bold">預計：HP ' + exp.mhp + '／MP ' + exp.mmp + '</span>'
                + '<span class="text-slate-500" style="font-size:11px;">（隨機可能有誤差）</span><br>'
                + '<span class="text-slate-400">目前：HP ' + (p.mhp || 0) + '／MP ' + (p.mmp || 0) + '</span>'
                + '</div>'
                + '<button type="button" class="btn" data-gm-reevo-ok="1" style="display:block;width:100%;text-align:left;padding:9px 12px;margin:5px 0;border:1px solid #eab308;border-radius:6px;background:linear-gradient(135deg,#713f12,#ca8a04);color:#fef9c3;font-weight:bold;">'
                + '確認重算基底<br><span style="font-size:11px;opacity:.85;font-weight:normal;">消耗 ' + _gmPetReEsc(fN) + '（擁有 ' + cnt + '）· 預計 HP ' + exp.mhp + '／MP ' + exp.mmp + '</span></button>';
            var ov = _gmPetReShowOverlay(
                '🐾 ' + _gmPetReEsc(typeof petDisplayName === 'function' ? petDisplayName(p) : p.form) + '：重新進化',
                '',
                body
            );
            ov.querySelector('[data-gm-reevo-ok]').addEventListener('click', function() {
                ov.remove();
                window.__gmPetReevolveDo(uidv, baseForm);
            });
        }
        window.__gmPetReevolveStart = function(uidv) {
            if (!petReevolveEnabled()) return;
            if (typeof _petFind !== 'function') return;
            var p = _petFind(uidv);
            if (!p || !_gmPetIsEvolved(p)) {
                if (typeof logSys === 'function') logSys('<span class="text-red-400">只有已進化的寵物可以重新進化。</span>');
                return;
            }
            if (_gmPetVictoryFruitCnt() <= 0) {
                if (typeof logSys === 'function') logSys('<span class="text-red-400">身上沒有 ' + _gmPetVictoryFruitName() + '，無法重新進化。</span>');
                return;
            }
            var base = _gmPetReverseBase(p.form);
            if (!base) {
                window.__gmPetReevolvePickBase(uidv);
                return;
            }
            _gmPetReConfirm(uidv, base);
        };
        window.__gmPetReevolvePickBase = function(uidv) {
            if (!petReevolveEnabled()) return;
            var p = typeof _petFind === 'function' ? _petFind(uidv) : null;
            if (!p) return;
            var list = _gmPetBaseFormList();
            var rows = list.map(function(name) {
                var exp = _gmPetReevolveExpect(p, name);
                var expectTxt = exp
                    ? ('<br><span style="font-size:11px;opacity:.85;color:#fcd34d;">預計 HP ' + exp.mhp + '／MP ' + exp.mmp + '</span>')
                    : '';
                return '<button type="button" class="btn" data-gm-reevo-base="' + _gmPetReEsc(name) + '" style="display:block;width:100%;text-align:left;padding:7px 10px;margin:3px 0;border:1px solid #475569;border-radius:4px;background:#0f172a;color:#e2e8f0;">'
                    + _gmPetReEsc(name) + expectTxt + '</button>';
            }).join('');
            var ov = _gmPetReShowOverlay(
                '🐾 ' + _gmPetReEsc(typeof petDisplayName === 'function' ? petDisplayName(p) : p.form) + '：選擇原型',
                '請選當初進化前的一般型態。預計為均值，實際可能有誤差。',
                rows || '<div class="text-slate-500">找不到一般型態清單。</div>'
            );
            ov.querySelectorAll('[data-gm-reevo-base]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var base = btn.getAttribute('data-gm-reevo-base');
                    ov.remove();
                    _gmPetReConfirm(uidv, base);
                });
            });
        };
        window.__gmPetReevolveDo = function(uidv, baseForm) {
            if (!petReevolveEnabled()) return;
            if (typeof _petFind !== 'function' || typeof _petMutationSnapshot !== 'function' || typeof _petCommitMutation !== 'function') return;
            var p = _petFind(uidv);
            if (!p || !_gmPetIsEvolved(p)) return;
            if (!baseForm || !PET_BOOK[baseForm]) return;
            var fruit = (player.inv || []).find(function(i) { return i && i.id === REEVO_FRUIT && (i.cnt || 0) > 0; });
            if (!fruit) {
                if (typeof logSys === 'function') logSys('<span class="text-red-400">身上沒有 ' + _gmPetVictoryFruitName() + '，無法重新進化。</span>');
                return;
            }
            if (!_gmPetReevolveExpect(p, baseForm)) return;
            var snap = _petMutationSnapshot();
            fruit.cnt--;
            if (fruit.cnt <= 0) player.inv = player.inv.filter(function(i) { return i.uid !== fruit.uid; });
            var rolled = _gmPetReevolveRoll(p, baseForm);
            if (!rolled) {
                _petMutationRestore(snap);
                return;
            }
            var useLv = p.lv || 1;
            var oldHp = p.mhp || 0, oldMp = p.mmp || 0;
            p.mhp = rolled.mhp;
            p.mmp = rolled.mmp;
            p.hp = p.mhp;
            p.mp = p.mmp;
            if (typeof petMarkDirty === 'function') petMarkDirty();
            if (!_petCommitMutation(snap)) return;
            if (typeof logSys === 'function') {
                logSys('<span class="c-legend font-bold">✨ 重新進化成功！</span><span class="text-amber-200">'
                    + p.form + ' Lv.' + useLv + '（原型 ' + baseForm + '）隨機重算：HP '
                    + oldHp + '→</span><span class="text-amber-300 font-bold">' + p.mhp
                    + '</span><span class="text-amber-200">／MP ' + oldMp + '→</span><span class="text-amber-300 font-bold">'
                    + p.mmp + '</span><span class="text-slate-400">（減半 '
                    + rolled.halfHp + '/' + rolled.halfMp + '＋進化成長 +' + rolled.evoHp + '/+' + rolled.evoMp + '）</span>');
            }
            try { if (typeof renderTabs === 'function') renderTabs(); } catch (e) {}
            try { if (typeof renderSquadPanel === 'function') renderSquadPanel(); } catch (e2) {}
            try { window.__gmRefreshPetReevolveUi(); } catch (e3) {}
        };
        window.__gmRefreshPetReevolveUi = function() {
            try {
                // 對話框開啟時不要重繪保管列表，避免捲動被重置
                if (document.getElementById('gm-pet-reevolve-overlay')) return;
                var inner = document.querySelector('[data-petui="1"]');
                if (!inner || !inner.parentElement) return;
                var host = inner.parentElement;
                var scroller = inner.querySelector('.overflow-y-auto') || null;
                var prevTop = scroller ? scroller.scrollTop : 0;
                if (typeof renderPetStorageNPC === 'function') renderPetStorageNPC(host);
                var inner2 = document.querySelector('[data-petui="1"]');
                var scroller2 = inner2 ? inner2.querySelector('.overflow-y-auto') : null;
                if (scroller2) scroller2.scrollTop = prevTop;
            } catch (e) {}
        };
        function _gmPetReInjectButtons(div) {
            if (!petReevolveEnabled() || !div || typeof petRoster !== 'function') return;
            var list;
            try { list = petRoster() || []; } catch (e) { return; }
            list.forEach(function(p) {
                if (!_gmPetIsEvolved(p) || !p.uid) return;
                var uid = String(p.uid);
                if (div.querySelector('button[data-gm-pet-reevolve="' + uid + '"]')) return;
                var anchor = null;
                var all = div.querySelectorAll('button[onclick*="petDeployToggle"]');
                for (var i = 0; i < all.length; i++) {
                    if (String(all[i].getAttribute('onclick') || '').indexOf("'" + uid + "'") >= 0
                        || String(all[i].getAttribute('onclick') || '').indexOf('"' + uid + '"') >= 0) {
                        anchor = all[i];
                        break;
                    }
                }
                if (!anchor || !anchor.parentElement) return;
                var parent = anchor.parentElement;
                parent.style.maxWidth = '280px';
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn px-2 py-1 text-xs font-bold';
                btn.setAttribute('data-gm-pet-reevolve', uid);
                btn.style.cssText = 'background:linear-gradient(135deg,#4c1d95,#7c3aed);color:#ede9fe;border-color:#a78bfa;';
                btn.title = '寵物重新進化（不降等·需消耗勝利果實）';
                btn.textContent = '重新進化';
                btn.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    window.__gmPetReevolveStart(uid);
                });
                var evoBtn = parent.querySelector('button[onclick*="petEvolve"]');
                if (evoBtn && evoBtn.nextSibling) parent.insertBefore(btn, evoBtn.nextSibling);
                else if (evoBtn) parent.appendChild(btn);
                else if (anchor.nextSibling) parent.insertBefore(btn, anchor.nextSibling);
                else parent.appendChild(btn);
            });
        }
        if (typeof window.renderPetStorageNPC === 'function') {
            if (!window.renderPetStorageNPC.__gmPetReevoWrap || window.renderPetStorageNPC.__gmPetReevoVer !== REEVO_VER) {
                var _prev = window.renderPetStorageNPC;
                while (_prev && _prev.__gmPetReevoWrap) _prev = _prev.__gmPetReevoOrig;
                window.renderPetStorageNPC = function(div, confirmUid) {
                    var ret = _prev.apply(this, arguments);
                    try { _gmPetReInjectButtons(div); } catch (e) {}
                    return ret;
                };
                window.renderPetStorageNPC.__gmPetReevoWrap = true;
                window.renderPetStorageNPC.__gmPetReevoVer = REEVO_VER;
                window.renderPetStorageNPC.__gmPetReevoOrig = _prev;
            }
            window.__gmPetReevoInstalledVer = REEVO_VER;
            // 僅首次／升版掛鉤時補一次按鈕；之後交給 renderPetStorageNPC wrap
            try { window.__gmRefreshPetReevolveUi(); } catch (e0) {}
        }
    }

    function obelPrideTrackEnabled() {
        if (window.__gmObelPrideTrackOn === false) return false;
        if (window.__gmObelPrideTrackOn === true) return true;
        try { return localStorage.getItem('gm_obel_pride_track_enabled') === '1'; } catch (e) { return false; }
    }
    function _gmIsTrueHiddenTrackMap(id) {
        // 真正隱藏狩獵區（HIDDEN_AREA_NAMES）；hidden_cave＝大洞穴隱遁者村莊地區屬一般野外，不算
        try {
            if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES && HIDDEN_AREA_NAMES[id]) return true;
        } catch (e) {}
        return false;
    }
    function _gmHiddenTrackBaseName(id, hint) {
        try {
            if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES && HIDDEN_AREA_NAMES[id]) {
                return HIDDEN_AREA_NAMES[id];
            }
        } catch (e) {}
        if (hint && String(hint) !== String(id) && String(hint).indexOf('隱藏地圖_') !== 0) return String(hint);
        var raw = String(id || '').replace(/^hidden_/, '');
        return raw || String(id || '');
    }
    function _gmHiddenTrackTitle(id, hint) {
        // 與一般圖名可能重複 → 隱藏圖統一前綴
        return '隱藏地圖_' + _gmHiddenTrackBaseName(id, hint);
    }
    function _gmInstallObelPrideTrackHooks() {
        // 魔物追蹤：僅補真正隱藏狩獵區（傲塔已遊戲內建，不再注入）
        if (typeof window.obelMapList !== 'function') return;
        var OBEL_HIDDEN_VER = 6;
        if (window.obelMapList.__gmPrideFloorTrack && window.obelMapList.__gmPrideFloorTrackVer === OBEL_HIDDEN_VER) return;
        var _prev = window.obelMapList;
        while (_prev && _prev.__gmPrideFloorTrack) _prev = _prev.__gmPrideFloorTrackOrig;
        window.obelMapList = function() {
            var out = [];
            try { out = _prev.apply(this, arguments) || []; } catch (e) { out = []; }
            if (!Array.isArray(out)) out = [];
            if (!obelPrideTrackEnabled()) return out;
            var seen = {};
            for (var i = 0; i < out.length; i++) {
                if (!out[i] || !out[i].v) continue;
                var vid = String(out[i].v);
                if (_gmIsTrueHiddenTrackMap(vid)) {
                    out[i].t = _gmHiddenTrackTitle(vid, out[i].t);
                }
                seen[vid] = true;
            }
            // 只收 HIDDEN_AREA_NAMES；不掃全部 hidden_*，以免把 hidden_cave 當隱藏圖；不補傲塔
            var hiddenIds = [];
            try {
                if (typeof HIDDEN_AREA_NAMES !== 'undefined' && HIDDEN_AREA_NAMES) {
                    hiddenIds = Object.keys(HIDDEN_AREA_NAMES);
                }
            } catch (eH) {}
            for (var hi = 0; hi < hiddenIds.length; hi++) {
                var hid = hiddenIds[hi];
                if (!hid || seen[hid]) continue;
                if (typeof DB === 'undefined' || !DB.maps || !DB.maps[hid]) continue;
                if (typeof PURE_BOSS_MAPS !== 'undefined' && PURE_BOSS_MAPS && PURE_BOSS_MAPS.indexOf(hid) >= 0) continue;
                out.push({ v: hid, t: _gmHiddenTrackTitle(hid, null) });
                seen[hid] = true;
            }
            return out;
        };
        window.obelMapList.__gmPrideFloorTrack = true;
        window.obelMapList.__gmPrideFloorTrackVer = OBEL_HIDDEN_VER;
        window.obelMapList.__gmPrideFloorTrackOrig = _prev;
        // 追蹤中畫面：隱藏圖勿顯示原始 map id
        if (typeof window.renderObelNPC === 'function') {
            var needWrap = !window.renderObelNPC.__gmPrideTitleWrap || window.renderObelNPC.__gmPrideTitleVer !== OBEL_HIDDEN_VER;
            if (needWrap) {
                var _prevRender = window.renderObelNPC;
                while (_prevRender && _prevRender.__gmPrideTitleWrap) _prevRender = _prevRender.__gmPrideTitleOrig;
                window.renderObelNPC = function(div) {
                    var ret = _prevRender.apply(this, arguments);
                    try {
                        if (typeof player !== 'undefined' && player && player.tracking && player.tracking.map) {
                            var mid = player.tracking.map;
                            if (_gmIsTrueHiddenTrackMap(mid)) {
                                var pretty = _gmHiddenTrackTitle(mid, null);
                                if (pretty && pretty !== mid && div && div.querySelector) {
                                    var span = div.querySelector('.text-sky-300');
                                    if (span) {
                                        var cur = String(span.textContent || '');
                                        if (cur === mid || cur.indexOf('hidden_') === 0 || cur.indexOf('隱藏地圖_') !== 0) {
                                            span.textContent = pretty;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e2) {}
                    return ret;
                };
                window.renderObelNPC.__gmPrideTitleWrap = true;
                window.renderObelNPC.__gmPrideTitleVer = OBEL_HIDDEN_VER;
                window.renderObelNPC.__gmPrideTitleOrig = _prevRender;
            }
        }
    }

    function _gmInstallQuickCurseEnhanceHooks() {
        // 秋玥：仿 Chaos 快速強化——祝福卷旁加詛咒卷；勾選後「退階」＝把勾選裝強化值降回右側目標
        // （每 -1 耗 1 張、100% 成功、不爆裝；可退到 -1；飾品無詛咒卷跳過）
        // Chaos 已內建則跳過
        if (typeof window.buildQuickEnhanceHeader !== 'function' || typeof window.runQuickEnhance !== 'function') return;
        if (typeof window.setQuickCurse === 'function' && typeof window.runQuickCurse === 'function'
            && !window.runQuickCurse.__gmQuickCursePatch) return;
        var QE_CURSE_VER = 4;
        if (window.buildQuickEnhanceHeader.__gmQuickCurseVer === QE_CURSE_VER
            && window.runQuickEnhance.__gmQuickCurseVer === QE_CURSE_VER) return;

        window.setQuickBless = function(type, checked) {
            var st = quickEnh[type];
            if (!st) return;
            st.useBless = !!checked;
            if (checked) st.useCurse = false;
            if (!st.useCurse && st.target < 0) st.target = 0;
            try { renderTabs(true); } catch (e) {}
        };
        window.setQuickCurse = function(type, checked) {
            var st = quickEnh[type];
            if (!st) return;
            st.useCurse = !!checked;
            if (checked) st.useBless = false;
            else if (st.target < 0) st.target = 0;
            try { renderTabs(true); } catch (e) {}
        };

        window.runQuickCurse = function(type) {
            var st = quickEnh[type];
            if (!st) return;
            var goal = Number((document.getElementById('qe-target-' + type) || {}).value);
            if (!Number.isFinite(goal)) goal = st.target != null ? st.target : 0;
            var entries = (typeof _qeEligibleItems === 'function' ? _qeEligibleItems(type) : []).filter(function(i) {
                return st.sel[i.uid];
            });
            if (!entries.length) {
                try { logSys('<span class="text-red-400 font-bold">尚未勾選任何裝備。</span>'); } catch (e0) {}
                return;
            }
            var curseIds = ['scroll_weapon_c', 'scroll_armor_c'];
            var scrollStacks = {};
            curseIds.forEach(function(sid) {
                var it = player.inv.find(function(i) { return i.id === sid; });
                scrollStacks[sid] = { cnt: it ? (it.cnt || 0) : 0 };
            });
            var reached = 0, partial = 0, skipped = 0, noScroll = 0, usedTotal = 0;
            var removeUids = {};
            var survivors = [];
            entries.forEach(function(entry) {
                var d = DB.items[entry.id];
                var curseId = d && d.type === 'wpn' ? 'scroll_weapon_c' : (d && d.type === 'arm' ? 'scroll_armor_c' : null);
                var cnt = entry.cnt || 1;
                removeUids[entry.uid] = true;
                for (var u = 0; u < cnt; u++) {
                    var en = Number(entry.en) || 0;
                    if (!curseId) {
                        noScroll++;
                        survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid() }));
                        continue;
                    }
                    if (en <= goal) {
                        skipped++;
                        survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid() }));
                        continue;
                    }
                    var stk = scrollStacks[curseId];
                    // 可退到 -1（同 executeCurseDeEnhance）；不再卡在 +0
                    while (en > goal && en > -1 && stk && stk.cnt > 0) {
                        stk.cnt -= 1;
                        en -= 1;
                        usedTotal += 1;
                    }
                    if (en <= goal) reached++; else partial++;
                    survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid(), en: en, lock: false }));
                }
            });
            player.inv = player.inv.filter(function(i) { return !removeUids[i.uid]; });
            curseIds.forEach(function(sid) {
                var it = player.inv.find(function(i) { return i.id === sid; });
                if (it) {
                    it.cnt = scrollStacks[sid].cnt;
                    if (it.cnt <= 0) player.inv = player.inv.filter(function(x) { return x.uid !== it.uid; });
                }
            });
            survivors.forEach(function(s) {
                var ex = (typeof sameItemSig === 'function')
                    ? player.inv.find(function(x) { return sameItemSig(x, s); })
                    : null;
                if (ex) ex.cnt = (ex.cnt || 1) + 1;
                else player.inv.push(s);
            });
            st.active = false;
            st.sel = {};
            var parts = ['退階 ' + reached + ' 件'];
            if (partial) parts.push('詛咒卷不足停 ' + partial + ' 件');
            if (skipped) parts.push('已達標 ' + skipped + ' 件');
            if (noScroll) parts.push('飾品無法退階 ' + noScroll + ' 件');
            try {
                var goalLabel = goal < 0 ? String(goal) : ('+' + goal);
                logSys('<span class="c-cursed font-bold">快速詛咒退階完成（退回 ' + goalLabel + '）：</span>'
                    + parts.join('、') + '，消耗 ' + usedTotal + ' 張詛咒卷軸。');
            } catch (e1) {}
            try { calcStats(); } catch (e2) {}
            try { renderTabs(true); } catch (e3) {}
            try { saveGame(); } catch (e4) {}
        };
        window.runQuickCurse.__gmQuickCursePatch = true;

        var _prevHdr = window.buildQuickEnhanceHeader;
        while (_prevHdr && _prevHdr.__gmQuickCurseOrig) _prevHdr = _prevHdr.__gmQuickCurseOrig;
        window.buildQuickEnhanceHeader = function(type) {
            var st = quickEnh[type];
            if (!st || !st.active) return _prevHdr.apply(this, arguments);
            var hdr = document.createElement('div');
            hdr.className = 'classic-list-toolbar sticky top-0 z-10 bg-slate-800 pb-2';
            hdr.style.top = '-12px';
            hdr.style.marginTop = '-12px';
            hdr.style.paddingTop = '12px';
            var eligible = (typeof _qeEligibleItems === 'function') ? _qeEligibleItems(type) : [];
            var allSel = eligible.length > 0 && eligible.every(function(i) { return st.sel[i.uid]; });
            var someSel = eligible.some(function(i) { return st.sel[i.uid]; });
            var curse = !!st.useCurse;
            var target = st.target != null ? st.target : 6;
            var blessId = type === 'wpn' ? 'scroll_weapon_b' : 'scroll_armor_b';
            var curseScrollId = type === 'wpn' ? 'scroll_weapon_c' : 'scroll_armor_c';
            var blessCnt = 0, curseCnt = 0;
            try {
                var bi = player.inv.find(function(i) { return i.id === blessId; });
                blessCnt = bi ? (bi.cnt || 0) : 0;
                var ci = player.inv.find(function(i) { return i.id === curseScrollId; });
                curseCnt = ci ? (ci.cnt || 0) : 0;
            } catch (eC) {}
            var box = document.createElement('div');
            box.className = 'flex items-center gap-1 bg-slate-900/80 border ' + (curse ? 'border-red-800/70' : 'border-slate-700') + ' rounded p-1';

            function mkBtn(label, onclickName, cls) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = cls;
                b.textContent = label;
                b.onclick = function() { window[onclickName](type); };
                return b;
            }
            box.appendChild(mkBtn('取消', 'cancelQuickEnhance', 'btn border-slate-600 bg-slate-700 hover:bg-slate-600 px-2 py-1 text-xs font-bold text-white rounded'));
            box.appendChild(mkBtn(curse ? '退階' : '強化', 'runQuickEnhance',
                'btn ' + (curse
                    ? 'border-red-600 bg-red-800 hover:bg-red-700 text-red-100'
                    : 'border-blue-600 bg-blue-800 hover:bg-blue-700 text-blue-200')
                + ' px-2 py-1 text-xs font-bold rounded'));

            var blessLab = document.createElement('label');
            blessLab.className = 'flex items-center gap-1 text-xs ' + (curse ? 'text-slate-600' : (blessCnt > 0 ? 'text-yellow-300' : 'text-slate-500')) + ' cursor-pointer select-none whitespace-nowrap';
            blessLab.title = '勾選＝使用『祝福的卷軸』強化（成功時隨機 +1~+3）；不勾＝一般卷軸（+1）。飾品無祝福卷，恆以一般卷強化。';
            var blessCb = document.createElement('input');
            blessCb.type = 'checkbox';
            blessCb.checked = !!st.useBless;
            blessCb.disabled = !!curse;
            blessCb.onchange = function() { setQuickBless(type, this.checked); };
            blessLab.appendChild(blessCb);
            blessLab.appendChild(document.createTextNode(' 祝福卷(' + blessCnt + ')'));
            box.appendChild(blessLab);

            var curseLab = document.createElement('label');
            curseLab.className = 'flex items-center gap-1 text-xs ' + (curseCnt > 0 ? 'text-red-300' : 'text-slate-500') + ' cursor-pointer select-none whitespace-nowrap';
            curseLab.title = '勾選＝改用『詛咒的卷軸』退階：把勾選裝備的強化值降回右側指定等級（每 -1 消耗 1 張、100% 成功、不爆裝；最低可退到 -1）。飾品無詛咒卷、無法退階。';
            var curseCb = document.createElement('input');
            curseCb.type = 'checkbox';
            curseCb.checked = !!curse;
            curseCb.onchange = function() { setQuickCurse(type, this.checked); };
            curseLab.appendChild(curseCb);
            curseLab.appendChild(document.createTextNode(' 詛咒卷(' + curseCnt + ')'));
            box.appendChild(curseLab);

            var sel = document.createElement('select');
            sel.id = 'qe-target-' + type;
            sel.className = 'bg-slate-800 border border-slate-600 ' + (curse ? 'text-red-200' : 'text-blue-200') + ' text-xs font-bold rounded px-1 py-1 ml-auto';
            sel.title = curse ? '退回到此強化等級' : '目標強化等級';
            for (var t = (curse ? -1 : 0); t <= 12; t++) {
                var opt = document.createElement('option');
                opt.value = String(t);
                opt.textContent = t < 0 ? String(t) : ('+' + t);
                if (t === target) opt.selected = true;
                sel.appendChild(opt);
            }
            sel.onchange = function() { quickEnh[type].target = Number(this.value); };
            box.appendChild(sel);

            var allLab = document.createElement('label');
            allLab.className = 'flex items-center gap-1 text-xs text-slate-300 cursor-pointer select-none whitespace-nowrap';
            var allCb = document.createElement('input');
            allCb.type = 'checkbox';
            allCb.checked = !!allSel;
            allCb.indeterminate = !!(someSel && !allSel);
            allCb.onchange = function() { quickEnhanceSelectAll(type, this.checked); };
            allLab.appendChild(allCb);
            allLab.appendChild(document.createTextNode(' 全選'));
            box.appendChild(allLab);

            hdr.appendChild(box);
            return hdr;
        };
        window.buildQuickEnhanceHeader.__gmQuickCurseVer = QE_CURSE_VER;
        window.buildQuickEnhanceHeader.__gmQuickCurseOrig = _prevHdr;

        var _prevRun = window.runQuickEnhance;
        while (_prevRun && _prevRun.__gmQuickCurseOrig) _prevRun = _prevRun.__gmQuickCurseOrig;
        window.runQuickEnhance = function(type) {
            try {
                if (typeof traditionalActive === 'function' && traditionalActive()) return;
            } catch (eT) {}
            try {
                var st = quickEnh[type];
                if (st && st.useCurse) { window.runQuickCurse(type); return; }
            } catch (eR) {}
            return _prevRun.apply(this, arguments);
        };
        window.runQuickEnhance.__gmQuickCurseVer = QE_CURSE_VER;
        window.runQuickEnhance.__gmQuickCurseOrig = _prevRun;
    }

    // 倉庫掛鉤共用：避免 installHooks 每秒重跑時 ClassDim 在外層導致 Card 不斷巢狀 wrap
    // （仍 peel 舊版 Search wrap，升級後可卸掉殘留巢狀）
    function _gmWhPeelAllWarehouseWraps(fn) {
        var n = 0;
        while (fn && n++ < 80) {
            if (fn.__gmWhClsDimWrap) { fn = fn.__gmWhClsDimOrig; continue; }
            if (fn.__gmWhSearchWrap) { fn = fn.__gmWhSearchOrig; continue; }
            if (fn.__gmWhCardWrap) { fn = fn.__gmWhCardOrig; continue; }
            break;
        }
        return fn;
    }
    function _gmWhWarehouseChainVersOk(cardVer, dimVer) {
        var fn = window.renderWarehouseNPC;
        var got = { card: 0, dim: 0 };
        var n = 0;
        while (fn && n++ < 80) {
            if (fn.__gmWhClsDimWrap) {
                if (!got.dim) got.dim = fn.__gmWhClsDimVer || 0;
                fn = fn.__gmWhClsDimOrig;
                continue;
            }
            if (fn.__gmWhSearchWrap) {
                fn = fn.__gmWhSearchOrig;
                continue;
            }
            if (fn.__gmWhCardWrap) {
                if (!got.card) got.card = fn.__gmWhCardVer || 0;
                fn = fn.__gmWhCardOrig;
                continue;
            }
            break;
        }
        return got.card === cardVer && got.dim === dimVer
            && !!window.renderWarehouseNPC
            && window.renderWarehouseNPC.__gmWhClsDimWrap
            && window.renderWarehouseNPC.__gmWhClsDimVer === dimVer
            && !window.renderWarehouseNPC.__gmWhSearchWrap;
    }
    function _gmWhBindWarehouseRenderChain(bare, cardAfter, dimAfter, vers) {
        if (typeof bare !== 'function') return;
        var cardVer = vers.card, dimVer = vers.dim;
        var withCard = function() {
            var ret = bare.apply(this, arguments);
            try { if (typeof cardAfter === 'function') cardAfter(); } catch (eC) {}
            return ret;
        };
        withCard.__gmWhCardWrap = true;
        withCard.__gmWhCardVer = cardVer;
        withCard.__gmWhCardOrig = bare;
        var withDim = function() {
            var ret = withCard.apply(this, arguments);
            try { if (typeof dimAfter === 'function') dimAfter(); } catch (eD) {}
            return ret;
        };
        withDim.__gmWhClsDimWrap = true;
        withDim.__gmWhClsDimVer = dimVer;
        withDim.__gmWhClsDimOrig = withCard;
        window.renderWarehouseNPC = withDim;
    }
    function _gmWhEnsureWarehouseRenderChain() {
        if (typeof window.renderWarehouseNPC !== 'function') return;
        if (window.renderWarehouseNPC.__afkISearch) return;
        var cardVer = window.__gmWhCardVerWanted || 0;
        var dimVer = window.__gmWhClsDimVerWanted || 0;
        if (!cardVer || !dimVer) return;
        if (_gmWhWarehouseChainVersOk(cardVer, dimVer)) return;
        var bare = _gmWhPeelAllWarehouseWraps(window.renderWarehouseNPC);
        _gmWhBindWarehouseRenderChain(
            bare,
            window.__gmWhCardAfterRender,
            window.__gmWhClsDimAfterRender,
            { card: cardVer, dim: dimVer }
        );
    }
    function _gmWhTeardownLegacySearchUi() {
        try {
            var css = document.getElementById('gm-wh-search-css');
            if (css) css.remove();
        } catch (e0) {}
        try {
            var nodes = document.querySelectorAll('.gm-wh-isearch');
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n && n.parentNode) n.parentNode.removeChild(n);
            }
        } catch (e1) {}
        try { delete window.__gmWhSearchWrapFactory; } catch (e2) {}
        try { delete window.__gmWhSearchVerWanted; } catch (e3) {}
        try { delete window.__gmRefreshWarehouseSearch; } catch (e4) {}
        try { delete window.__gmWhSearchState; } catch (e5) {}
        try { delete window.__gmWarehouseSearchOn; } catch (e6) {}
    }

    function _gmInstallWarehouseCardQuickHooks() {
        // 倉庫列：在 Chaos「一鍵存入」前插入 存入卡片／取出卡片（不移動原按鈕，避免 onclick 失效）
        var WH_CARD_VER = 7;
        function _gmWhInjectCardCss() {
            var st = document.getElementById('gm-wh-card-css');
            if (!st) {
                st = document.createElement('style');
                st.id = 'gm-wh-card-css';
                document.head.appendChild(st);
            }
            // 新版倉庫有「搜尋」欄，分類列已滿：動作鈕改獨立一列，避免與搜尋擠在一起跑版
            // Mobile：動作列仍含一鍵鈕為直接子元素 → Chaos afk-mobile 的 flex:1 1 40% 規則仍生效（約 2×2）
            st.textContent = [
                '#gm-wh-action-row{',
                'display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;',
                'width:100%;box-sizing:border-box;',
                '}',
                '#gm-wh-deposit-cards,#gm-wh-withdraw-cards,',
                '#gm-wh-action-row > button{',
                'min-width:0;white-space:nowrap;flex:0 0 auto;',
                '}',
                'body.m-mobile #gm-wh-action-row{',
                'justify-content:stretch;',
                '}',
                'body.m-mobile #gm-wh-action-row > button{',
                'flex:1 1 40%!important;margin-left:0!important;height:36px!important;',
                '}'
            ].join('');
        }
        function _gmIsMonsterCardItem(it) {
            if (!it || !it.id) return false;
            if (/^card_[psg]_/i.test(it.id)) return true;
            try {
                var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[it.id] : null;
                if (d && (d.eff === 'card' || d.cardTier || d.cardMob)) return true;
            } catch (e) {}
            return false;
        }
        function _gmWhRefreshUi() {
            try { if (typeof renderTabs === 'function') renderTabs(true); } catch (e1) {}
            try { if (typeof updateUI === 'function') updateUI(); } catch (e2) {}
            try {
                var el = document.getElementById('interaction-content');
                if (typeof warehouseWindowIsOpen === 'function' && warehouseWindowIsOpen()) {
                    var floating = document.getElementById('warehouse-window-content');
                    if (floating) el = floating;
                }
                if (el && typeof renderWarehouseNPC === 'function') renderWarehouseNPC(el);
            } catch (e3) {}
        }
        // 秋玥：whTxnSnapshot／whTxnCommit；Chaos：無交易鎖，走 saveWarehouse + saveGame
        function _gmWhCanWrite() {
            return typeof loadWarehouse === 'function'
                && (typeof whTxnCommit === 'function' || typeof saveWarehouse === 'function');
        }
        function _gmWhSnap() {
            if (typeof whTxnSnapshot === 'function') {
                try { return whTxnSnapshot(); } catch (e) { return null; }
            }
            return null;
        }
        function _gmWhCommit(w, snap) {
            if (typeof whTxnCommit === 'function') {
                try { return !!whTxnCommit(w, snap); } catch (e) { return false; }
            }
            try {
                if (typeof saveWarehouse === 'function') saveWarehouse(w);
                if (typeof saveGame === 'function') saveGame();
                return true;
            } catch (e2) {
                return false;
            }
        }
        window.whDepositAllCards = function() {
            if (!_gmWhCanWrite()) {
                try { logSys('<span class="text-red-400">存入卡片失敗：倉庫 API 不可用。</span>'); } catch (e0) {}
                return;
            }
            var w = loadWarehouse();
            var _txn = _gmWhSnap();
            var deposited = 0, stacks = 0, full = false, skippedLock = 0;
            var list = (player.inv || []).slice();
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!_gmIsMonsterCardItem(it)) continue;
                if (it.lock) { skippedLock++; continue; }
                try {
                    if (typeof WH_NO_STORE !== 'undefined' && WH_NO_STORE.indexOf(it.id) >= 0) continue;
                } catch (eN) {}
                var idx = player.inv.findIndex(function(x) { return x.uid === it.uid; });
                if (idx < 0) continue;
                var cur = player.inv[idx];
                var stack = (typeof _whStackFind === 'function') ? _whStackFind(w.items, cur) : null;
                var max = (typeof WH_MAX !== 'undefined') ? WH_MAX : 200;
                if (!stack && w.items.length >= max) { full = true; break; }
                player.inv.splice(idx, 1);
                if (stack) stack.cnt = (stack.cnt || 1) + (cur.cnt || 1);
                else w.items.push(cur);
                deposited += (cur.cnt || 1);
                stacks++;
            }
            if (!_gmWhCommit(w, _txn)) { _gmWhRefreshUi(); return; }
            _gmWhRefreshUi();
            try {
                if (deposited > 0) {
                    logSys('<span class="text-amber-300 font-bold">存入卡片：已存入 '
                        + deposited + ' 張（' + stacks + ' 組）'
                        + (full ? '；倉庫已滿，部分未存入' : '')
                        + (skippedLock ? '；鎖定 ' + skippedLock + ' 組略過' : '')
                        + '。</span>');
                } else {
                    logSys(full
                        ? '<span class="text-red-400">倉庫已滿，無法存入卡片。</span>'
                        : '<span class="text-slate-400">背包沒有可存入的金／銀／普卡'
                            + (skippedLock ? '（有鎖定卡片需先解鎖）' : '')
                            + '。</span>');
                }
            } catch (eL) {}
        };
        window.whWithdrawAllCards = function() {
            if (!_gmWhCanWrite()) {
                try { logSys('<span class="text-red-400">取出卡片失敗：倉庫 API 不可用。</span>'); } catch (e0) {}
                return;
            }
            var w = loadWarehouse();
            var _txn = _gmWhSnap();
            var taken = 0, stacks = 0;
            var list = (w.items || []).slice();
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                if (!_gmIsMonsterCardItem(it)) continue;
                var idx = w.items.findIndex(function(x) { return x.uid === it.uid; });
                if (idx < 0) continue;
                var cur = w.items[idx];
                var total = cur.cnt || 1;
                w.items.splice(idx, 1);
                if (!cur.uid || player.inv.some(function(x) { return x.uid === cur.uid; })) {
                    try { cur.uid = uid(); } catch (eU) {}
                }
                var stack = (typeof _whStackFind === 'function') ? _whStackFind(player.inv, cur) : null;
                if (stack) stack.cnt = (stack.cnt || 1) + total;
                else player.inv.push(cur);
                try {
                    if (typeof registerEquipObtained === 'function') registerEquipObtained(cur.id);
                    if (typeof registerMiscObtained === 'function') registerMiscObtained(cur.id);
                    if (typeof registerRelicObtained === 'function') registerRelicObtained(cur.id);
                } catch (eR) {}
                taken += total;
                stacks++;
            }
            if (!_gmWhCommit(w, _txn)) { _gmWhRefreshUi(); return; }
            _gmWhRefreshUi();
            try {
                if (taken > 0) {
                    logSys('<span class="text-amber-300 font-bold">取出卡片：已領出 '
                        + taken + ' 張（' + stacks + ' 組）。</span>');
                } else {
                    logSys('<span class="text-slate-400">倉庫沒有金／銀／普卡可領。</span>');
                }
            } catch (eL2) {}
        };
        function _gmWhInjectCardBtns() {
            try { _gmWhInjectCardCss(); } catch (eCss) {}
            var qty = document.getElementById('wh-qty-amt');
            if (!qty || !qty.parentNode) return;
            var filterRow = qty.parentNode;
            // 壓縮右側說明，騰出分類列寬度
            try {
                var hints = filterRow.querySelectorAll('span.text-xs, span.text-slate-500');
                for (var hi = 0; hi < hints.length; hi++) {
                    var ht = hints[hi].textContent || '';
                    if (ht.indexOf('存入') >= 0 && ht.indexOf('分類') >= 0) {
                        hints[hi].style.display = 'none';
                        break;
                    }
                }
            } catch (eH) {}

            var oneClick = filterRow.querySelector('button[onclick*="whOneClickDeposit"]');
            var sortBtn = filterRow.querySelector('button[onclick*="sortWarehouse"]');
            var actionRow = document.getElementById('gm-wh-action-row');
            if (!actionRow) {
                actionRow = document.createElement('div');
                actionRow.id = 'gm-wh-action-row';
                actionRow.className = 'flex items-center gap-2 text-sm flex-wrap';
                if (filterRow.parentNode) {
                    filterRow.parentNode.insertBefore(actionRow, filterRow.nextSibling);
                }
            }

            // 把一鍵鈕移到獨立動作列（新版搜尋欄擠爆分類列；onclick 屬性仍在，功能不變）
            if (oneClick) {
                try { oneClick.classList.remove('ms-auto'); } catch (eM) {}
                try {
                    oneClick.className = String(oneClick.className || '').replace(/\bpx-4\b/g, 'px-2').replace(/\btext-sm\b/g, 'text-xs');
                    oneClick.classList.add('whitespace-nowrap');
                } catch (eC) {}
                if (oneClick.parentNode !== actionRow) actionRow.appendChild(oneClick);
            }
            if (sortBtn) {
                try {
                    sortBtn.className = String(sortBtn.className || '').replace(/\bpx-4\b/g, 'px-2').replace(/\btext-sm\b/g, 'text-xs');
                    sortBtn.classList.add('whitespace-nowrap');
                } catch (eS) {}
                if (sortBtn.parentNode !== actionRow) actionRow.appendChild(sortBtn);
            }

            if (document.getElementById('gm-wh-deposit-cards')) return;

            function mkBtn(id, label, title, onclickName, style) {
                var b = document.createElement('button');
                b.id = id;
                b.type = 'button';
                b.className = 'btn px-2 text-xs font-bold h-8 inline-flex items-center justify-center whitespace-nowrap';
                b.setAttribute('style', style);
                b.title = title;
                b.textContent = label;
                b.setAttribute('onclick', onclickName);
                return b;
            }
            var dep = mkBtn(
                'gm-wh-deposit-cards',
                '存入卡片',
                '把背包中所有未鎖定的金／銀／普卡一次存入倉庫',
                'whDepositAllCards()',
                'background:linear-gradient(135deg,#4a1d0c 0%,#b45309 28%,#3f1709 52%,#92400e 76%,#2a1008 100%);color:#ffedd5;border-color:#d97706;'
            );
            var wit = mkBtn(
                'gm-wh-withdraw-cards',
                '取出卡片',
                '把倉庫中所有金／銀／普卡一次領回背包',
                'whWithdrawAllCards()',
                'background:linear-gradient(135deg,#3b0764 0%,#7e22ce 28%,#2e1065 52%,#6b21a8 76%,#1e0538 100%);color:#f3e8ff;border-color:#a855f7;'
            );
            // 順序：存入卡片 → 取出卡片 → 一鍵存入 → 一鍵排列
            var anchor = actionRow.querySelector('button[onclick*="whOneClickDeposit"]') || actionRow.firstChild;
            if (anchor) {
                actionRow.insertBefore(dep, anchor);
                actionRow.insertBefore(wit, anchor);
            } else {
                actionRow.appendChild(dep);
                actionRow.appendChild(wit);
            }
        }
        window.__gmWhCardAfterRender = _gmWhInjectCardBtns;
        window.__gmWhCardVerWanted = WH_CARD_VER;
        try { _gmWhTeardownLegacySearchUi(); } catch (eTeardown) {}
        try { _gmWhEnsureWarehouseRenderChain(); } catch (eChain) {}
        try {
            if (document.getElementById('wh-qty-amt')) _gmWhInjectCardBtns();
        } catch (e0) {}
    }

    function _gmInstallWarehouseClassDimHooks() {
        // 倉庫／背包側：當前職業不能裝備 → Chaos 紅底＋[無法裝備]（仍可存取）
        // 注意：原版 .cannot-equip 只綁 .equipment-side-item，倉庫列加 cannot-equip 無效
        // 若原版 renderWarehouseNPC 已內建「無法裝備」＋checkCanEquip，不覆蓋 UI
        var WH_CLS_DIM_VER = 4;
        function _gmWhBareWarehouseRender() {
            return _gmWhPeelAllWarehouseWraps(window.renderWarehouseNPC);
        }
        function _gmWhNativeClassDimPresent() {
            try {
                var fn = _gmWhBareWarehouseRender();
                if (typeof fn !== 'function') return false;
                var src = Function.prototype.toString.call(fn);
                if (src.indexOf('checkCanEquip') < 0) return false;
                return src.indexOf('無法裝備') >= 0 || src.indexOf('_cantEquip') >= 0;
            } catch (e0) { return false; }
        }
        function _gmWhCleanupLegacyDimUi() {
            try {
                var oldCss = document.getElementById('gm-wh-cls-dim-css');
                if (oldCss) oldCss.remove();
            } catch (e1) {}
            ['wh-inv-list', 'wh-store-list'].forEach(function(id) {
                try {
                    var list = document.getElementById(id);
                    if (!list) return;
                    list.querySelectorAll('.gm-wh-cls-mismatch').forEach(function(el) {
                        el.classList.remove('gm-wh-cls-mismatch');
                    });
                    list.querySelectorAll('[data-gm-wh-cls-dim]').forEach(function(el) {
                        el.classList.remove('cannot-equip');
                        el.removeAttribute('data-gm-wh-cls-dim');
                        var tag = el.querySelector('.gm-wh-cls-tag');
                        if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
                    });
                } catch (e2) {}
            });
        }
        function _gmWhInjectClsDimCss() {
            var st = document.getElementById('gm-wh-cls-dim-css');
            if (!st) {
                st = document.createElement('style');
                st.id = 'gm-wh-cls-dim-css';
                document.head.appendChild(st);
            }
            // 對齊 Chaos 倉庫 mkBtn 紅底（不依賴 Tailwind purge／equipment-side-item）
            st.textContent = [
                '#wh-inv-list [data-gm-wh-cls-dim="1"],#wh-store-list [data-gm-wh-cls-dim="1"]{',
                'background:rgba(69,10,10,.45)!important;',
                'border-color:#7f1d1d!important;',
                '}',
                '#wh-inv-list [data-gm-wh-cls-dim="1"]:hover,#wh-store-list [data-gm-wh-cls-dim="1"]:hover{',
                'background:rgba(127,29,29,.88)!important;',
                '}',
                '#wh-inv-list .gm-wh-cls-tag,#wh-store-list .gm-wh-cls-tag{',
                'color:#ef4444;font-size:10px;font-weight:700;margin-left:4px;',
                '}'
            ].join('');
        }
        if (_gmWhNativeClassDimPresent()) {
            try {
                if (window.renderWarehouseNPC && window.renderWarehouseNPC.__gmWhClsDimWrap) {
                    // 由 chain ensure 重建；此處只清殘留並把 dim after 設成空
                }
            } catch (eU) {}
            _gmWhCleanupLegacyDimUi();
            window.__gmRefreshWarehouseClassDim = function() {};
            window.__gmWhClsDimVerWanted = WH_CLS_DIM_VER;
            window.__gmWhClsDimAfterRender = function() {};
            try { _gmWhEnsureWarehouseRenderChain(); } catch (eN) {}
            return;
        }
        function _gmWhIsGearDef(d) {
            if (!d) return false;
            if (d.type === 'wpn' || d.type === 'arm' || d.type === 'acc') return true;
            if (d.slot === 'petwpn' || d.slot === 'petarm' || d.slot === 'doll') return true;
            return false;
        }
        function _gmWhBuildUidMap() {
            var map = Object.create(null);
            try {
                var inv = (typeof player !== 'undefined' && player && player.inv) ? player.inv : [];
                for (var i = 0; i < inv.length; i++) {
                    var a = inv[i];
                    if (a && a.uid != null) map[String(a.uid)] = a;
                }
            } catch (e1) {}
            try {
                if (typeof loadWarehouse === 'function') {
                    var w = loadWarehouse();
                    var items = (w && w.items) ? w.items : [];
                    for (var j = 0; j < items.length; j++) {
                        var b = items[j];
                        if (b && b.uid != null) map[String(b.uid)] = b;
                    }
                }
            } catch (e2) {}
            return map;
        }
        function _gmWhClsMismatchCached(it, canCache) {
            if (!it || !it.id) return false;
            var id = String(it.id);
            if (Object.prototype.hasOwnProperty.call(canCache, id)) return canCache[id];
            var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[id] : null;
            if (!_gmWhIsGearDef(d)) {
                canCache[id] = false;
                return false;
            }
            var bad = false;
            if (typeof checkCanEquip === 'function') {
                try { bad = !checkCanEquip(it); } catch (e3) { bad = false; }
            } else if (d.req && d.req !== 'all') {
                try {
                    bad = !(player && player.cls && String(d.req).split(',').indexOf(player.cls) >= 0);
                } catch (e4) { bad = false; }
            }
            canCache[id] = bad;
            return bad;
        }
        function _gmWhClearOurDim(el) {
            if (!el || !el.getAttribute || el.getAttribute('data-gm-wh-cls-dim') !== '1') return;
            el.classList.remove('cannot-equip');
            el.classList.remove('gm-wh-cls-mismatch');
            el.removeAttribute('data-gm-wh-cls-dim');
            try {
                var tag = el.querySelector('.gm-wh-cls-tag');
                if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
            } catch (eT) {}
        }
        function _gmWhMarkDim(el) {
            el.setAttribute('data-gm-wh-cls-dim', '1');
            if (el.classList.contains('gm-wh-cls-mismatch')) el.classList.remove('gm-wh-cls-mismatch');
            if (el.classList.contains('cannot-equip')) el.classList.remove('cannot-equip');
            if (!el.querySelector('.gm-wh-cls-tag')) {
                var tag = document.createElement('span');
                tag.className = 'gm-wh-cls-tag';
                tag.textContent = '[無法裝備]';
                el.appendChild(document.createTextNode(' '));
                el.appendChild(tag);
            }
        }
        function _gmWhApplyClassDim(list, uidMap, canCache) {
            if (!list) return;
            var kids = list.children;
            for (var i = 0; i < kids.length; i++) {
                var el = kids[i];
                if (!el || !el.getAttribute) continue;
                if (el.classList && (el.classList.contains('gm-wh-isearch') || el.classList.contains('afk-isearch'))) continue;
                var uid = el.getAttribute('data-tip-uid');
                if (!uid) {
                    _gmWhClearOurDim(el);
                    continue;
                }
                var it = uidMap[String(uid)] || null;
                if (_gmWhClsMismatchCached(it, canCache)) _gmWhMarkDim(el);
                else _gmWhClearOurDim(el);
            }
        }
        function _gmWhApplyClassDimBoth() {
            try { _gmWhInjectClsDimCss(); } catch (eCss) {}
            var uidMap = _gmWhBuildUidMap();
            var canCache = Object.create(null);
            _gmWhApplyClassDim(document.getElementById('wh-inv-list'), uidMap, canCache);
            _gmWhApplyClassDim(document.getElementById('wh-store-list'), uidMap, canCache);
        }
        function _gmWhScheduleClassDim() {
            try {
                if (window.__gmWhClsDimRaf) cancelAnimationFrame(window.__gmWhClsDimRaf);
            } catch (eC) {}
            try {
                window.__gmWhClsDimRaf = requestAnimationFrame(function() {
                    window.__gmWhClsDimRaf = 0;
                    try { _gmWhApplyClassDimBoth(); } catch (eA) {}
                });
            } catch (eR) {
                try { _gmWhApplyClassDimBoth(); } catch (eF) {}
            }
        }
        window.__gmRefreshWarehouseClassDim = _gmWhScheduleClassDim;
        window.__gmWhClsDimVerWanted = WH_CLS_DIM_VER;
        window.__gmWhClsDimAfterRender = _gmWhScheduleClassDim;
        try { _gmWhEnsureWarehouseRenderChain(); } catch (eChain) {}
    }

    function _gmTeardownLegacyAutobuyHooks() {
        // 已移除自動購買魔法屏障卷軸；清掉舊版殘留 UI／tick wrap
        try {
            var box = document.getElementById('gm-autobuy-box');
            if (box) box.remove();
        } catch (e) {}
        try {
            if (window.tick && window.tick.__gmAutobuyWrap && window.__gmAutobuyTickBase) {
                window.tick = window.__gmAutobuyTickBase;
            }
        } catch (e2) {}
        try { delete window.__gmAutobuyCheck; } catch (e3) {}
        try { delete window.__gmAutobuyToggle; } catch (e4) {}
        try { delete window.__gmAutobuyInjectUi; } catch (e5) {}
        window.__gmAutobuyCoreReady = false;
    }

    function _gmInstallTasPanaceaTradeHook() {
        if (typeof CRAFT_RECIPES === 'undefined' || !CRAFT_RECIPES) return;
        // 旗標不可掛在 CRAFT_RECIPES 上：buildRecipeIndex 會 for…in 後 for…of，遇到 true 會整段炸掉→第一次開塔斯空白
        if (window.__gmTasPanaceaTrade) return;
        var list = CRAFT_RECIPES.npc_tas;
        if (!Array.isArray(list)) CRAFT_RECIPES.npc_tas = list = [];
        var ids = ['panacea_str', 'panacea_dex', 'panacea_con', 'panacea_int', 'panacea_wis', 'panacea_cha'];
        var hasReverse = list.some(function(r) {
            return r && r.result === 'panacea_white'
                && r.req && r.req[0]
                && ids.indexOf(r.req[0].id) >= 0;
        });
        if (!hasReverse) {
            ids.forEach(function(id) {
                list.push({ result: 'panacea_white', req: [{ id: id, cnt: 1 }] });
            });
        }
        // 若先前錯誤寫入過 CRAFT_RECIPES.__gmTasPanaceaTrade，清掉以免 buildRecipeIndex 再炸
        try { delete CRAFT_RECIPES.__gmTasPanaceaTrade; } catch (e0) {}
        window.__gmTasPanaceaTrade = true;
        try {
            if (typeof RECIPE_BY_RESULT !== 'undefined') {
                // 強制重建索引，讓新配方納入材料遞迴判斷
                if (typeof buildRecipeIndex === 'function') buildRecipeIndex();
            }
        } catch (eRebuild) {}
        try {
            if (typeof DB !== 'undefined' && DB.items && DB.items.panacea_white && DB.items.panacea_white.d
                && String(DB.items.panacea_white.d).indexOf('屬性萬能藥換回') < 0) {
                DB.items.panacea_white.d = String(DB.items.panacea_white.d)
                    + '亦可在塔斯處，以 1 個任意屬性萬能藥換回 1 個純白的萬能藥。';
            }
        } catch (e) {}
        try {
            if (typeof DB !== 'undefined' && DB.towns) {
                for (var tid in DB.towns) {
                    var tw = DB.towns[tid];
                    if (!tw || !tw.npcs) continue;
                    for (var i = 0; i < tw.npcs.length; i++) {
                        var n = tw.npcs[i];
                        if (!n || n.id !== 'npc_tas') continue;
                        if (n.d && String(n.d).indexOf('屬性萬能藥換回') < 0) {
                            n.d = String(n.d) + '亦可將任一屬性萬能藥 ×1 換回純白的萬能藥 ×1。';
                        }
                    }
                }
            }
        } catch (e2) {}
    }

    function _gmJunkPrefsHasItemId(id) {
        if (!id || typeof player === 'undefined' || !player || !player.junkPrefs) return false;
        var idStr = String(id);
        for (var k in player.junkPrefs) {
            if (!player.junkPrefs[k]) continue;
            if (String(k).split('|')[0] === idStr) return true;
        }
        return false;
    }

    // 血盟／攻城掉落加值裝備：廢品記憶有同 id 基底時直接賣出（不標記 junk、不寫入 junkPrefs）
    function _gmInstallPledgeJunkEnSellHooks() {
        if (typeof window.pledgeBonusDrop !== 'function') return;
        var VER = 2;
        if (window.pledgeBonusDrop.__gmPledgeJunkEnSellVer === VER) return;
        var _prev = window.pledgeBonusDrop.__gmPledgeJunkEnSellOrig || window.pledgeBonusDrop;
        window.pledgeBonusDrop = function(mob) {
            var beforeLen = 0;
            try {
                if (typeof player !== 'undefined' && player && Array.isArray(player.inv))
                    beforeLen = player.inv.length;
            } catch (e0) {}
            var ret = _prev.apply(this, arguments);
            try {
                if (!pledgeJunkEnSellEnabled()) return ret;
                if (typeof player === 'undefined' || !player || !Array.isArray(player.inv)) return ret;
                if (player.autoSellOn === false) return ret;
                if (!player.junkPrefs) return ret;
                var toSell = [];
                for (var i = beforeLen; i < player.inv.length; i++) {
                    var it = player.inv[i];
                    if (!it || it.lock) continue;
                    if (!(Number(it.en) > 0)) continue;
                    var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[it.id] : null;
                    if (!d || d.noSell || d.noJunk) continue;
                    var isEquip = ((d.type === 'wpn' && !d.isArrow) || d.type === 'arm' || d.type === 'acc');
                    if (!isEquip) continue;
                    if (typeof isRelic === 'function' && isRelic(d)) continue;
                    if (!_gmJunkPrefsHasItemId(it.id)) continue;
                    // 明確取消廢品標記，避免 +1~+6 累積進廢品記憶／面板
                    it.junk = false;
                    delete it.junkSince;
                    delete it._autoSellQty;
                    toSell.push(it);
                }
                if (!toSell.length) return ret;
                var totalGold = 0;
                var totalCount = 0;
                var grantSold = false;
                var sellUids = {};
                var nameParts = [];
                for (var s = 0; s < toSell.length; s++) {
                    var item = toSell[s];
                    var q = Math.max(1, Number(item.cnt) || 1);
                    var price = (typeof getSellPrice === 'function') ? Number(getSellPrice(item)) || 0 : 0;
                    totalGold += price * q;
                    totalCount += q;
                    sellUids[item.uid] = true;
                    var dd = (typeof DB !== 'undefined' && DB.items) ? DB.items[item.id] : null;
                    if (dd && dd.grantSkills) grantSold = true;
                    var fullName = (typeof getItemFullName === 'function')
                        ? getItemFullName(item)
                        : ((dd && dd.n) ? dd.n : String(item.id));
                    var colorClass = (typeof getItemColor === 'function') ? getItemColor(item) : 'text-slate-200';
                    nameParts.push('<span class="' + colorClass + ' font-bold">' + fullName + '</span>'
                        + (q > 1 ? ('×' + q) : '')
                        + '<span class="text-slate-400">(' + price * q + 'G)</span>');
                }
                player.inv = player.inv.filter(function(invIt) {
                    return !invIt || !sellUids[invIt.uid];
                });
                player.gold = (player.gold || 0) + totalGold;
                if (typeof logSys === 'function') {
                    logSys('<span class="text-amber-300">血盟加值裝備對應廢品·直接賣出：'
                        + nameParts.join('、')
                        + '　共 ' + totalCount + ' 個，獲得 <span class="text-yellow-400 font-bold">'
                        + totalGold + '</span> 金幣。</span>');
                }
                try { if (typeof renderTabs === 'function') renderTabs(); } catch (e1) {}
                try { if (typeof updateUI === 'function') updateUI(); } catch (e2) {}
                if (grantSold) {
                    try { if (typeof calcStats === 'function') calcStats(); } catch (e3) {}
                    try { if (typeof renderSkillSelects === 'function') renderSkillSelects(); } catch (e4) {}
                }
            } catch (e) {}
            return ret;
        };
        window.pledgeBonusDrop.__gmPledgeJunkEnSellVer = VER;
        window.pledgeBonusDrop.__gmPledgeJunkEnSellOrig = _prev;
    }

    function installHooks() {
        // 逐步 try/catch：單一掛鉤失敗不可讓整段 page hooks（切換角色／屬性詳細／傭兵 Buff）一起掛掉
        var steps = [
            _gmInstallDiffMagicHook,
            _gmInstallUiThrottleHooks,
            _gmTeardownLegacyAutobuyHooks,
            _gmInstallStatTooltipHooks,
            _gmInstallAllyArrowHooks,
            _gmInstallSherineWorldCorrectHooks,
            _gmInstallSherineGraceNoCdHooks,
            // 寵物命中補正
            _gmInstallWpnEnPetHitHooks,
            _gmTeardownHotHealPetsSummonsHooks,
            _gmInstallPlayerStatusIconHooks,
            _gmInstallSquadBuffHooks,
            _gmInstallPetCarryGuard,
            _gmInstallCastleLoginHooks,
            _gmInstallPetReevolveHooks,
            _gmInstallObelPrideTrackHooks,
            _gmInstallQuickCurseEnhanceHooks,
            _gmInstallWarehouseCardQuickHooks,
            _gmInstallWarehouseClassDimHooks,
            _gmInstallPledgeJunkEnSellHooks,
            _gmInstallCollectionRevealHooks,
            _gmInstallRelicDescTypeHook,
            _gmInstallTasPanaceaTradeHook,
            wrapAllySetters,
            wrapRehireAlly,
            wrapToggleAlly,
            wrapSaveGame
        ];
        for (var i = 0; i < steps.length; i++) {
            try { steps[i](); } catch (e) {}
        }
        try {
            var legacyBar = document.getElementById('gm-party-share-bar');
            if (legacyBar) legacyBar.remove();
        } catch (e) {}
    }

    installHooks();
    var _tries = 0;
    var _timer = setInterval(function() {
        installHooks();
        _tries++;
        if (_tries > 60) clearInterval(_timer);
    }, 500);
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }



    // 超級黑市：wrap _pandoraStock — 權重1裝備上架滿10次後保底抽遺物／脛甲（售價10億）
    // ＋收購欄：選完物品後價錢 placeholder 顯示區間；已登記收購時在「取消收購」旁顯示成功率
    const GM_SUPER_BM_HOOKS_VER = 6;
    function injectSuperBlackMarketPageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-super-bm-hooks');
        if (old && old.getAttribute('data-ver') === String(GM_SUPER_BM_HOOKS_VER)) return;
        if (old) old.remove();
        const el = document.createElement('script');
        el.id = 'gm-super-bm-hooks';
        el.setAttribute('data-ver', String(GM_SUPER_BM_HOOKS_VER));
        el.textContent = `
(function () {
    var VER = 6;
    var PITY_NEED = 10;
    var PITY_PRICE = 1000000000;

    function superBmEnabled() {
        if (window.__gmSuperBmOn === false) return false;
        if (window.__gmSuperBmOn === true) return true;
        try { return localStorage.getItem('gm_super_black_market_enabled') === '1'; } catch (e) { return false; }
    }
    function isEquipItem(d) {
        if (!d) return false;
        var t = d.type || '';
        return t === 'wpn' || t === 'arm' || t === 'acc';
    }
    function isRelicItem(d) {
        try {
            if (typeof isRelic === 'function') return !!isRelic(d);
        } catch (e) {}
        return !!(d && d.relic);
    }
    function buildRelicPool() {
        var pool = [];
        try {
            if (typeof DB === 'undefined' || !DB || !DB.items) return pool;
            for (var iid in DB.items) {
                var d = DB.items[iid];
                if (!d || !d.n) continue;
                if (isRelicItem(d)) pool.push(iid);
            }
        } catch (e) {}
        return pool;
    }
    function pickRelicId(pool) {
        if (!pool || !pool.length) return null;
        var i = Math.floor(Math.random() * pool.length);
        if (i < 0) i = 0;
        if (i >= pool.length) i = pool.length - 1;
        return pool[i];
    }
    function getW1Count() {
        try {
            if (typeof player === 'undefined' || !player) return 0;
            var n = player.gmSuperBmW1Count;
            return (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0;
        } catch (e) { return 0; }
    }
    function setW1Count(n) {
        try {
            if (typeof player === 'undefined' || !player) return;
            player.gmSuperBmW1Count = Math.max(0, Math.floor(n) || 0);
        } catch (e) {}
    }

    // 與原版收購擲價 pandoraBuyOrderPriceProfile 相同（可喊價物品含 gachaWeight:0 的製作傳說）
    function isBuyOrderAllowed(id) {
        try {
            if (typeof pandoraBuyOrderAllowed === 'function') return !!pandoraBuyOrderAllowed(id);
        } catch (e) {}
        try {
            if (typeof DB === 'undefined' || !DB.items) return false;
            var d = DB.items[id];
            if (!d || !d.n || d.relic || d.remains || d.doll) return false;
            if (d.type === 'skillbk' || d.eff === 'panacea') return true;
            return isEquipItem(d);
        } catch (e2) { return false; }
    }
    function priceParamsForId(id) {
        try {
            if (!id || !isBuyOrderAllowed(id)) return null;
            var r = null;
            try {
                if (typeof pandoraBuyOrderPriceProfile === 'function') r = pandoraBuyOrderPriceProfile(id);
            } catch (e0) { r = null; }
            if (!r) {
                if (typeof DB === 'undefined' || !DB.items) return null;
                var d = DB.items[id] || {};
                var premium = d.type === 'skillbk' || !!(d.legend && isEquipItem(d));
                var base = Math.max(0, Number(d.p) || 0);
                if (base <= 0 && isEquipItem(d)) base = 100000;
                if (base <= 0) base = 1000;
                r = { base: base, minMult: premium ? 100 : 10, maxMult: premium ? 2000 : 1000 };
            }
            var baseP = Math.max(1, Number(r.base) || 1);
            var lo = Math.max(1, Math.floor(Number(r.minMult) || 1));
            var hi = Math.max(lo, Math.floor(Number(r.maxMult) || lo));
            return {
                base: baseP, lo: lo, hi: hi,
                min: Math.max(1, Math.round(baseP * lo)),
                max: Math.max(1, Math.round(baseP * hi))
            };
        } catch (e) { return null; }
    }
    function priceRangeForId(id) {
        var p = priceParamsForId(id);
        return p ? { min: p.min, max: p.max } : null;
    }
    function successRatePct(id, price) {
        var p = priceParamsForId(id);
        if (!p) return null;
        price = Number(price);
        if (!Number.isFinite(price) || price <= 0) return null;
        // 原版：mult 為 [lo,hi] 整數均勻；命中條件 round(base*mult) <= price
        var total = p.hi - p.lo + 1;
        if (total <= 0) return null;
        var hit = 0;
        for (var m = p.lo; m <= p.hi; m++) {
            if (Math.round(p.base * m) <= price) hit++;
        }
        return (hit / total) * 100;
    }
    function formatRate(pct) {
        if (pct == null || !isFinite(pct)) return '';
        if (pct <= 0) return '0%';
        if (pct >= 99.95) return '100%';
        if (pct >= 10) return (Math.round(pct * 10) / 10).toFixed(1).replace(/\\.0$/, '') + '%';
        return (Math.round(pct * 10) / 10) + '%';
    }
    function findSellableIdByName(name) {
        try {
            name = String(name || '').trim();
            if (!name || typeof DB === 'undefined' || !DB.items) return null;
            var ids = Object.keys(DB.items);
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i];
                var d = DB.items[id];
                if (d && d.n === name && isBuyOrderAllowed(id)) return id;
            }
        } catch (e) {}
        return null;
    }
    function applyBuyPriceHint(nameOpt) {
        if (!superBmEnabled()) return;
        var priceEl = document.getElementById('pandora-buy-price');
        if (!priceEl) return;
        var name = nameOpt;
        if (name == null) {
            var nameEl = document.getElementById('pandora-buy-name');
            name = nameEl ? nameEl.value : '';
        }
        var id = findSellableIdByName(name);
        var r = id ? priceRangeForId(id) : null;
        if (!r) {
            if (!priceEl.getAttribute('data-gm-ph-default')) {
                priceEl.setAttribute('data-gm-ph-default', priceEl.placeholder || '收購價錢');
            }
            priceEl.placeholder = priceEl.getAttribute('data-gm-ph-default') || '收購價錢';
            priceEl.removeAttribute('title');
            return;
        }
        if (!priceEl.getAttribute('data-gm-ph-default')) {
            priceEl.setAttribute('data-gm-ph-default', priceEl.placeholder || '收購價錢');
        }
        var lo = r.min.toLocaleString();
        var hi = r.max.toLocaleString();
        priceEl.placeholder = lo + ' ~ ' + hi;
        priceEl.title = '黑市可能售價區間（喊價需 ≥ 擲出市價才會命中）';
    }
    function applyBuySuccessRate() {
        var old = document.getElementById('gm-pandora-buy-rate');
        if (!superBmEnabled()) {
            if (old) old.remove();
            return;
        }
        var status = document.querySelector('.pandora-buy-status');
        var btn = status ? status.querySelector('.pandora-buy-cancel') : null;
        if (!status || !btn) {
            if (old) old.remove();
            return;
        }
        var order = null;
        try {
            order = (typeof player !== 'undefined' && player && player.pandoraMarket2)
                ? player.pandoraMarket2.buyOrder : null;
        } catch (e) { order = null; }
        if (!order || !order.id) {
            if (old) old.remove();
            return;
        }
        var pct = successRatePct(order.id, order.price);
        if (pct == null) {
            if (old) old.remove();
            return;
        }
        var el = old;
        if (!el) {
            el = document.createElement('span');
            el.id = 'gm-pandora-buy-rate';
        }
        el.style.cssText = 'margin-left:6px;font-weight:700;color:#86efac;white-space:nowrap;';
        el.textContent = '成功率約 ' + formatRate(pct);
        el.title = '每 10 分鐘換 1 格時，擲出市價 ≤ 目前喊價的機率';
        // 靠左：接在「意者自行上架」同一段說明文字後面（避免 flex 中間飄）
        var info = null;
        var kids = status.children;
        for (var i = 0; i < kids.length; i++) {
            if (kids[i] !== btn && kids[i].tagName === 'SPAN' && kids[i].id !== 'gm-pandora-buy-rate') {
                info = kids[i];
                break;
            }
        }
        if (info) info.appendChild(el);
        else status.insertBefore(el, btn);
    }

    function _gmInstallSuperBmHooks() {
        if (typeof _pandoraStock === 'function') {
            if (!(_pandoraStock.__gmSuperBmWrap && _pandoraStock.__gmSuperBmVer === VER)) {
                var _prev = _pandoraStock.__gmSuperBmOrig || _pandoraStock;
                window._pandoraStock = function (nowT) {
                    var slot = _prev.apply(this, arguments);
                    try {
                        if (!superBmEnabled()) return slot;
                        if (!slot || !slot.id) return slot;
                        if (slot.weight !== 1) return slot;
                        var d = (typeof DB !== 'undefined' && DB.items) ? DB.items[slot.id] : null;
                        if (!isEquipItem(d)) return slot;
                        var cnt = getW1Count();
                        if (cnt >= PITY_NEED) {
                            var pool = buildRelicPool();
                            var rid = pickRelicId(pool);
                            if (rid) {
                                slot.id = rid;
                                slot.price = PITY_PRICE;
                                slot.weight = 1;
                                slot.gmSuper = true;
                                setW1Count(0);
                                return slot;
                            }
                            return slot;
                        }
                        setW1Count(cnt + 1);
                    } catch (e) {}
                    return slot;
                };
                window._pandoraStock.__gmSuperBmWrap = true;
                window._pandoraStock.__gmSuperBmVer = VER;
                window._pandoraStock.__gmSuperBmOrig = _prev;
            }
        }

        if (typeof pandoraChooseBuyItem === 'function') {
            if (!(pandoraChooseBuyItem.__gmSuperBmWrap && pandoraChooseBuyItem.__gmSuperBmVer === VER)) {
                var _prevChoose = pandoraChooseBuyItem.__gmSuperBmOrig || pandoraChooseBuyItem;
                window.pandoraChooseBuyItem = function (name) {
                    var ret = _prevChoose.apply(this, arguments);
                    try { applyBuyPriceHint(name); } catch (e0) {}
                    return ret;
                };
                window.pandoraChooseBuyItem.__gmSuperBmWrap = true;
                window.pandoraChooseBuyItem.__gmSuperBmVer = VER;
                window.pandoraChooseBuyItem.__gmSuperBmOrig = _prevChoose;
            }
        }

        if (typeof pandoraSuggestBuyItems === 'function') {
            if (!(pandoraSuggestBuyItems.__gmSuperBmWrap && pandoraSuggestBuyItems.__gmSuperBmVer === VER)) {
                var _prevSuggest = pandoraSuggestBuyItems.__gmSuperBmOrig || pandoraSuggestBuyItems;
                window.pandoraSuggestBuyItems = function (value) {
                    var ret = _prevSuggest.apply(this, arguments);
                    try { applyBuyPriceHint(value); } catch (e1) {}
                    return ret;
                };
                window.pandoraSuggestBuyItems.__gmSuperBmWrap = true;
                window.pandoraSuggestBuyItems.__gmSuperBmVer = VER;
                window.pandoraSuggestBuyItems.__gmSuperBmOrig = _prevSuggest;
            }
        }

        if (typeof pandoraRenderMarket === 'function') {
            if (!(pandoraRenderMarket.__gmSuperBmWrap && pandoraRenderMarket.__gmSuperBmVer === VER)) {
                var _prevRender = pandoraRenderMarket.__gmSuperBmOrig || pandoraRenderMarket;
                window.pandoraRenderMarket = function () {
                    var ret = _prevRender.apply(this, arguments);
                    try { applyBuyPriceHint(); } catch (e2) {}
                    try { applyBuySuccessRate(); } catch (e3) {}
                    return ret;
                };
                window.pandoraRenderMarket.__gmSuperBmWrap = true;
                window.pandoraRenderMarket.__gmSuperBmVer = VER;
                window.pandoraRenderMarket.__gmSuperBmOrig = _prevRender;
            }
        }
    }
    function _gmTrySuperBm() { try { _gmInstallSuperBmHooks(); } catch (e) {} }
    _gmTrySuperBm();
    var _n = 0;
    var _t = setInterval(function () {
        _gmTrySuperBm();
        _n++;
        if (_n > 60) clearInterval(_t);
    }, 500);
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }

    // 本圖效率：經驗 / 10分 旁標示 1 小時幾%（分母＝本級總經驗 getExpReq）
    const GM_AUDIT_EXP_PCT_HOOKS_VER = 1;
    function injectAuditExpHourPctPageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-audit-exp-pct-hooks');
        if (old && old.getAttribute('data-ver') === String(GM_AUDIT_EXP_PCT_HOOKS_VER)) return;
        if (old) old.remove();
        const el = document.createElement('script');
        el.id = 'gm-audit-exp-pct-hooks';
        el.setAttribute('data-ver', String(GM_AUDIT_EXP_PCT_HOOKS_VER));
        el.textContent = `
(function () {
    var VER = 1;

    function formatExpHourPct() {
        try {
            if (typeof _audit === 'undefined' || !_audit) return '';
            var mins = (Date.now() - _audit.start) / 60000;
            if (!isFinite(mins) || mins < 0.01) return '—';
            var sf = 10 / mins;
            var exp10 = Math.floor((_audit.exp || 0) * sf);
            var expPerHour = exp10 * 6;
            var lv = (typeof player !== 'undefined' && player) ? (player.lv || 1) : 1;
            if (lv >= 100) return '—';
            if (typeof getExpReq !== 'function') return '—';
            var req = getExpReq(lv);
            if (!req || !isFinite(req) || req <= 0) return '—';
            var pct = expPerHour / req * 100;
            if (!isFinite(pct) || pct <= 0) return '—';
            if (pct >= 100) return (Math.round(pct * 10) / 10).toLocaleString() + '%/時';
            if (pct >= 1) return (Math.round(pct * 10) / 10).toLocaleString() + '%/時';
            if (pct >= 0.01) return (Math.round(pct * 100) / 100).toLocaleString() + '%/時';
            return '<0.01%/時';
        } catch (e) { return '—'; }
    }
    function patchAuditExpHourPct() {
        try {
            var tab = document.getElementById('tab-audit');
            if (!tab || tab.classList.contains('hidden')) return;
            var inp = document.getElementById('audit-add-input');
            if (inp && document.activeElement === inp) return;
            var labels = tab.querySelectorAll('.text-slate-400.text-xs');
            for (var i = 0; i < labels.length; i++) {
                if ((labels[i].textContent || '').trim() !== '經驗 / 10分') continue;
                var valEl = labels[i].nextElementSibling;
                if (!valEl) return;
                var pct = formatExpHourPct();
                if (!pct) return;
                var base = (valEl.textContent || '').replace(/\\s*·\\s*.+$/, '').trim();
                valEl.innerHTML = base + ' <span class="text-slate-400 font-normal text-sm">· ' + pct + '</span>';
                return;
            }
        } catch (e) {}
    }
    function _gmInstallAuditExpPctHooks() {
        if (typeof renderAuditTab !== 'function') return;
        if (renderAuditTab.__gmAuditExpPctWrap && renderAuditTab.__gmAuditExpPctVer === VER) return;
        var _prev = renderAuditTab.__gmAuditExpPctOrig || renderAuditTab;
        window.renderAuditTab = function () {
            var ret = _prev.apply(this, arguments);
            patchAuditExpHourPct();
            return ret;
        };
        window.renderAuditTab.__gmAuditExpPctWrap = true;
        window.renderAuditTab.__gmAuditExpPctVer = VER;
        window.renderAuditTab.__gmAuditExpPctOrig = _prev;
    }
    function _gmTryAuditExpPct() { try { _gmInstallAuditExpPctHooks(); } catch (e) {} }
    _gmTryAuditExpPct();
    var _n = 0;
    var _t = setInterval(function () {
        _gmTryAuditExpPct();
        _n++;
        if (_n > 60) clearInterval(_t);
    }, 500);
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }

    // 潘朵拉黑市：珍稀／遺物頂部公告（刷新時顯示；點開黑市仍依原版清除；z-index 提高）
    const GM_PANDORA_RARE_NOTIFY_HOOKS_VER = 5;
    function injectPandoraRareNotifyPageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-pandora-rare-notify-hooks');
        if (old && old.getAttribute('data-ver') === String(GM_PANDORA_RARE_NOTIFY_HOOKS_VER)) return;
        if (old) old.remove();
        try {
            if (typeof GM_addStyle === 'function') {
                GM_addStyle('#pandora-banner{z-index:10050!important;}');
            }
        } catch (eCss) {}
        const el = document.createElement('script');
        el.id = 'gm-pandora-rare-notify-hooks';
        el.setAttribute('data-ver', String(GM_PANDORA_RARE_NOTIFY_HOOKS_VER));
        el.textContent = `
(function () {
    var VER = 5;

    function slotSig(s) {
        if (!s) return '';
        return String(s.id || '') + '|' + String(s.setTick || 0) + '|' + (s.sold ? '1' : '0');
    }
    function isRelicSlot(s) {
        try {
            if (!s || typeof DB === 'undefined' || !DB.items) return false;
            var d = DB.items[s.id];
            if (!d) return false;
            if (typeof isRelic === 'function') return !!isRelic(d);
            return !!d.relic;
        } catch (e) { return false; }
    }
    function isRareSlot(s) {
        return !!(s && !s.sold && (s.weight === 1 || isRelicSlot(s)));
    }
    function snapshotSlots(m) {
        if (!m || !Array.isArray(m.slots)) return null;
        var out = [];
        for (var i = 0; i < m.slots.length; i++) out.push(slotSig(m.slots[i]));
        return out;
    }
    function findLatestNewRare(before, slots) {
        if (!slots || !slots.length) return null;
        for (var i = slots.length - 1; i >= 0; i--) {
            var s = slots[i];
            if (!isRareSlot(s)) continue;
            if (!before || before[i] !== slotSig(s)) return { slot: s, idx: i };
        }
        return null;
    }
    function findLatestLiveRare(slots) {
        if (!slots || !slots.length) return null;
        var best = null;
        for (var i = 0; i < slots.length; i++) {
            var s = slots[i];
            if (!isRareSlot(s)) continue;
            if (!best || (s.setTick || 0) > (best.slot.setTick || 0)
                || ((s.setTick || 0) === (best.slot.setTick || 0) && i > best.idx)) {
                best = { slot: s, idx: i };
            }
        }
        return best;
    }
    function ensureBannerLayer() {
        try {
            var el = document.getElementById('pandora-banner');
            if (el) el.style.setProperty('z-index', '10050', 'important');
        } catch (e) {}
    }
    function announceRareSlot(hit, writeLatestLog) {
        if (!hit || !hit.slot) return;
        try {
            var m = (typeof player !== 'undefined' && player) ? player.pandoraMarket2 : null;
            if (m) m.lastIdx = hit.idx;
            if (typeof player !== 'undefined' && player) player.pandoraAnnounce = hit.slot.id;
            if (writeLatestLog && typeof _pandoraLogLatest === 'function') _pandoraLogLatest(hit.slot);
            if (typeof renderPandoraBanner === 'function') renderPandoraBanner();
            ensureBannerLayer();
            if (typeof renderSyslogPandora === 'function') renderSyslogPandora();
            if (typeof _pandoraDiv !== 'undefined' && _pandoraDiv && document.body.contains(_pandoraDiv) && _pandoraDiv.querySelector('#pandora-msg')) {
                try { if (typeof pandoraRenderMarket === 'function') pandoraRenderMarket(_pandoraDiv); } catch (e2) {}
            }
        } catch (e) {}
    }
    function reannounceLatestLiveRare() {
        try {
            var m = (typeof player !== 'undefined' && player) ? player.pandoraMarket2 : null;
            var hit = m && m.slots ? findLatestLiveRare(m.slots) : null;
            if (hit) announceRareSlot(hit, false);
            else {
                if (typeof player !== 'undefined' && player) player.pandoraAnnounce = null;
                if (typeof renderPandoraBanner === 'function') renderPandoraBanner();
                if (typeof renderSyslogPandora === 'function') renderSyslogPandora();
            }
        } catch (e) {}
    }
    function clearBanner() {
        try {
            if (typeof player !== 'undefined' && player) player.pandoraAnnounce = null;
            if (typeof renderPandoraBanner === 'function') renderPandoraBanner();
        } catch (e) {}
    }
    function _gmInstallPandoraRareNotifyHooks() {
        if (typeof refreshPandoraMarket !== 'function') return;
        if (refreshPandoraMarket.__gmRareNotifyWrap && refreshPandoraMarket.__gmRareNotifyVer === VER) return;
        var _prev = refreshPandoraMarket.__gmRareNotifyOrig || refreshPandoraMarket;
        window.refreshPandoraMarket = function (force) {
            var before = null;
            try {
                if (typeof player !== 'undefined' && player && player.pandoraMarket2) {
                    before = snapshotSlots(player.pandoraMarket2);
                }
            } catch (e0) {}
            var ret = _prev.apply(this, arguments);
            try {
                if (!ret) return ret;
                var m = (typeof player !== 'undefined' && player) ? player.pandoraMarket2 : null;
                if (!m || !m.slots) return ret;
                var hit = findLatestNewRare(before, m.slots);
                if (hit) announceRareSlot(hit, true);
            } catch (e1) {}
            return ret;
        };
        window.refreshPandoraMarket.__gmRareNotifyWrap = true;
        window.refreshPandoraMarket.__gmRareNotifyVer = VER;
        window.refreshPandoraMarket.__gmRareNotifyOrig = _prev;
    }
    function _gmInstallPandoraBuyRareHooks() {
        if (typeof buyPandoraItem !== 'function') return;
        if (buyPandoraItem.__gmRareNotifyWrap && buyPandoraItem.__gmRareNotifyVer === VER) return;
        var _prev = buyPandoraItem.__gmRareNotifyOrig || buyPandoraItem;
        window.buyPandoraItem = function () {
            var ret = _prev.apply(this, arguments);
            // 購買後：若面板開著，只在架上還有珍稀時維持公告；否則依原版清掉
            try {
                var panelOpen = (typeof _pandoraDiv !== 'undefined' && _pandoraDiv
                    && document.body.contains(_pandoraDiv) && _pandoraDiv.querySelector('#pandora-msg'));
                if (panelOpen) {
                    var m = (typeof player !== 'undefined' && player) ? player.pandoraMarket2 : null;
                    var hit = m && m.slots ? findLatestLiveRare(m.slots) : null;
                    if (hit) announceRareSlot(hit, false);
                    else clearBanner();
                } else {
                    reannounceLatestLiveRare();
                }
            } catch (e) {}
            return ret;
        };
        window.buyPandoraItem.__gmRareNotifyWrap = true;
        window.buyPandoraItem.__gmRareNotifyVer = VER;
        window.buyPandoraItem.__gmRareNotifyOrig = _prev;
    }
    // 點開潘朵拉：維持原版「清除頂部公告」（已看過貨）
    function _gmInstallPandoraOpenRareHooks() {
        if (typeof renderPandoraGacha !== 'function') return;
        if (renderPandoraGacha.__gmRareNotifyWrap && renderPandoraGacha.__gmRareNotifyVer === VER) return;
        var _prev = renderPandoraGacha.__gmRareNotifyOrig || renderPandoraGacha;
        window.renderPandoraGacha = function () {
            var ret = _prev.apply(this, arguments);
            clearBanner();
            return ret;
        };
        window.renderPandoraGacha.__gmRareNotifyWrap = true;
        window.renderPandoraGacha.__gmRareNotifyVer = VER;
        window.renderPandoraGacha.__gmRareNotifyOrig = _prev;
    }
    function _gmInstallPandoraBannerLayerHooks() {
        if (typeof renderPandoraBanner !== 'function') return;
        if (renderPandoraBanner.__gmRareNotifyWrap && renderPandoraBanner.__gmRareNotifyVer === VER) return;
        var _prev = renderPandoraBanner.__gmRareNotifyOrig || renderPandoraBanner;
        window.renderPandoraBanner = function () {
            var ret = _prev.apply(this, arguments);
            ensureBannerLayer();
            return ret;
        };
        window.renderPandoraBanner.__gmRareNotifyWrap = true;
        window.renderPandoraBanner.__gmRareNotifyVer = VER;
        window.renderPandoraBanner.__gmRareNotifyOrig = _prev;
    }
    function _gmTryPandoraRareNotify() {
        try { _gmInstallPandoraRareNotifyHooks(); } catch (e) {}
        try { _gmInstallPandoraBuyRareHooks(); } catch (e2) {}
        try { _gmInstallPandoraOpenRareHooks(); } catch (e3) {}
        try { _gmInstallPandoraBannerLayerHooks(); } catch (e4) {}
    }
    _gmTryPandoraRareNotify();
    var _n = 0;
    var _t = setInterval(function () {
        _gmTryPandoraRareNotify();
        _n++;
        if (_n > 60) clearInterval(_t);
    }, 500);
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }



    // 物品搜尋：武/防/道具共用關鍵字（有原生 #afk-isearch 則停用）
    const GM_INV_ITEM_SEARCH_HOOKS_VER = 2;
    function injectInvItemSearchPageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-inv-item-search-hooks');
        if (old && old.getAttribute('data-ver') === String(GM_INV_ITEM_SEARCH_HOOKS_VER)) return;
        if (old) old.remove();
        const el = document.createElement('script');
        el.id = 'gm-inv-item-search-hooks';
        el.setAttribute('data-ver', String(GM_INV_ITEM_SEARCH_HOOKS_VER));
        el.textContent = `
(function () {
    var VER = 2;
    var q = '';
    var TAB_IDS = ['tab-weapons', 'tab-armors', 'tab-items'];
    var BOX_ID = 'afk-isearch';
    var INPUT_ID = 'afk-isearch-input';

    function featureOn() {
        if (window.__gmInvItemSearchOn === false) return false;
        if (window.__gmInvItemSearchOn === true) return true;
        try { return localStorage.getItem('gm_inv_item_search_enabled') === '1'; } catch (e) { return false; }
    }
    function hasNative() {
        try {
            if (typeof window.renderTabs === 'function'
                && window.renderTabs.__afkISearch
                && !window.renderTabs.__gmInvSearch) return true;
            var ids = ['afk-isearch-wpn', 'afk-isearch-arm', 'afk-isearch-item'];
            for (var i = 0; i < ids.length; i++) {
                var el = document.getElementById(ids[i]);
                if (el && el.getAttribute('data-gm-inv-search') !== '1') return true;
            }
            var box = document.getElementById(BOX_ID);
            if (box && box.getAttribute('data-gm-inv-search') !== '1') return true;
            var inp = document.getElementById(INPUT_ID);
            if (inp && inp.getAttribute('data-gm-inv-search') !== '1') return true;
        } catch (e) {}
        return false;
    }
    function injectCss() {
        if (document.getElementById('gm-inv-isearch-css')) return;
        var st = document.createElement('style');
        st.id = 'gm-inv-isearch-css';
        st.textContent = [
            '.afk-isearch[data-gm-inv-search="1"]{position:sticky;top:0;z-index:6;padding:2px 0 4px;background:inherit;flex:none;width:100%;box-sizing:border-box;}',
            '.afk-isearch[data-gm-inv-search="1"] input{width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #475569;border-radius:8px;color:#e2e8f0;padding:6px 10px;font-size:13px;font-family:inherit;outline:none;}',
            '.afk-isearch[data-gm-inv-search="1"] input:focus{border-color:#b89243;}',
            '.afk-isearch[data-gm-inv-search="1"] input::placeholder{color:#64748b;}'
        ].join('\\n');
        document.head.appendChild(st);
    }
    function norm(s) { return String(s || '').toLowerCase(); }
    function setHidden(el, hide) {
        // 秋玥格狀背包 .list-item 使用 display:flex !important，一般 style.display 無效
        if (hide) el.style.setProperty('display', 'none', 'important');
        else el.style.removeProperty('display');
    }
    function filterContainer(container, kw, skipEl) {
        if (!container) return;
        kw = norm(kw).trim();
        for (var i = 0; i < container.children.length; i++) {
            var el = container.children[i];
            if (el === skipEl) continue;
            if (el.classList && (el.classList.contains('afk-isearch') || el.classList.contains('classic-inventory-shell')
                || el.classList.contains('classic-list-toolbar') || el.classList.contains('sticky'))) continue;
            if (el.dataset && el.dataset.afkKeep === '1') continue;
            if (el.classList && el.classList.contains('classic-grid-empty')) {
                setHidden(el, !!kw);
                continue;
            }
            var show = !kw || norm(el.textContent).indexOf(kw) >= 0;
            setHidden(el, !show);
        }
    }
    function filterTab(tab) {
        if (!tab) return;
        var vp = tab.querySelector('.classic-inventory-viewport');
        filterContainer(vp || tab, q, tab.querySelector('.afk-isearch'));
    }
    function applyAll() {
        for (var i = 0; i < TAB_IDS.length; i++) filterTab(document.getElementById(TAB_IDS[i]));
        var ae = document.activeElement;
        var inputs = document.querySelectorAll('input[data-gm-inv-search="1"]');
        for (var j = 0; j < inputs.length; j++) {
            if (inputs[j] === ae) continue; // 避免干擾正在輸入／IME 組字
            if (inputs[j].value !== q) inputs[j].value = q;
        }
    }
    function teardown() {
        try {
            var nodes = document.querySelectorAll('.afk-isearch[data-gm-inv-search="1"]');
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
            }
        } catch (e) {}
        try {
            var css = document.getElementById('gm-inv-isearch-css');
            if (css) css.remove();
        } catch (e2) {}
        q = '';
        for (var k = 0; k < TAB_IDS.length; k++) {
            var tab = document.getElementById(TAB_IDS[k]);
            if (!tab) continue;
            var vp = tab.querySelector('.classic-inventory-viewport');
            filterContainer(vp || tab, '', null);
        }
    }
    function makeBoxForTab(isPrimary) {
        var wrap = document.createElement('div');
        wrap.className = 'afk-isearch is-on';
        wrap.setAttribute('data-gm-inv-search', '1');
        if (isPrimary) wrap.id = BOX_ID;
        var inp = document.createElement('input');
        if (isPrimary) inp.id = INPUT_ID;
        inp.type = 'search';
        inp.autocomplete = 'off';
        inp.placeholder = '🔍 搜尋名稱…(武/防/道具共用)';
        inp.setAttribute('data-gm-inv-search', '1');
        inp.value = q;
        inp.addEventListener('input', function () {
            q = inp.value;
            applyAll();
        });
        wrap.appendChild(inp);
        return wrap;
    }
    function ensureSearch() {
        if (!featureOn() || hasNative()) {
            teardown();
            return;
        }
        injectCss();
        // 三個分頁各掛一框、共用關鍵字；僅武器頁使用 #afk-isearch / #afk-isearch-input（對齊 C 版）
        for (var i = 0; i < TAB_IDS.length; i++) {
            var host = document.getElementById(TAB_IDS[i]);
            if (!host) continue;
            var isPrimary = (TAB_IDS[i] === 'tab-weapons');
            var existing = null;
            var kids = host.querySelectorAll('.afk-isearch[data-gm-inv-search="1"]');
            for (var k = 0; k < kids.length; k++) {
                if (kids[k].parentNode === host) { existing = kids[k]; break; }
            }
            if (!existing) {
                if (isPrimary) {
                    var clash = document.getElementById(BOX_ID);
                    if (clash && clash.getAttribute('data-gm-inv-search') !== '1') return;
                }
                existing = makeBoxForTab(isPrimary);
                var quick = null;
                for (var c = 0; c < host.children.length; c++) {
                    var ch = host.children[c];
                    if (ch.classList && (ch.classList.contains('sticky') || ch.classList.contains('classic-list-toolbar'))) {
                        quick = ch;
                        break;
                    }
                }
                if (quick) host.insertBefore(existing, quick.nextSibling);
                else host.insertBefore(existing, host.firstChild);
            }
            if (host.firstElementChild && host.firstElementChild.classList
                && (host.firstElementChild.classList.contains('sticky') || host.firstElementChild.classList.contains('classic-list-toolbar'))) {
                host.firstElementChild.dataset.afkKeep = '1';
            }
        }
        applyAll();
    }
    function wrapRenderTabs() {
        if (typeof renderTabs !== 'function') return;
        if (renderTabs.__gmInvSearch && renderTabs.__gmInvSearchVer === VER) return;
        if (renderTabs.__afkISearch && !renderTabs.__gmInvSearch) return; // 原生 C 版外掛
        var _prev = renderTabs.__gmInvSearchOrig || renderTabs;
        while (_prev && _prev.__gmInvSearchOrig) _prev = _prev.__gmInvSearchOrig;
        var wrapped = function () {
            var ae = document.activeElement;
            var refocus = (ae && ae.id === INPUT_ID) ? true : false;
            var r = _prev.apply(this, arguments);
            try {
                ensureSearch();
                if (refocus) {
                    var ni = document.getElementById(INPUT_ID);
                    if (ni && document.activeElement !== ni) {
                        ni.focus();
                        try { ni.setSelectionRange(ni.value.length, ni.value.length); } catch (e1) {}
                    }
                }
            } catch (e) {}
            return r;
        };
        wrapped.__gmInvSearch = true;
        wrapped.__gmInvSearchVer = VER;
        wrapped.__gmInvSearchOrig = _prev;
        window.renderTabs = wrapped;
    }
    window.__gmRefreshInvItemSearch = function () {
        try {
            if (!featureOn() || hasNative()) teardown();
            else { wrapRenderTabs(); ensureSearch(); }
        } catch (e) {}
    };
    function install() {
        if (hasNative()) { teardown(); return; }
        wrapRenderTabs();
        ensureSearch();
    }
    install();
    var _n = 0, _t = setInterval(function () {
        install();
        _n++;
        if (_n > 80) clearInterval(_t);
    }, 500);
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }

    // 關閉置頂橫條 #_orig_pbar（轉載站非官方提示；有橫條才可開）
    const GM_HIDE_ORIG_PBAR_HOOKS_VER = 1;
    function injectHideOrigPbarPageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-hide-orig-pbar-hooks');
        if (old && old.getAttribute('data-ver') === String(GM_HIDE_ORIG_PBAR_HOOKS_VER)) return;
        if (old) old.remove();
        const el = document.createElement('script');
        el.id = 'gm-hide-orig-pbar-hooks';
        el.setAttribute('data-ver', String(GM_HIDE_ORIG_PBAR_HOOKS_VER));
        el.textContent = `
(function () {
    var VER = 1;
    function featureOn() {
        if (window.__gmHideOrigPbarOn === false) return false;
        if (window.__gmHideOrigPbarOn === true) return true;
        try { return localStorage.getItem('gm_hide_orig_pbar_enabled') === '1'; } catch (e) { return false; }
    }
    function apply() {
        var bar = document.getElementById('_orig_pbar');
        if (!bar) return;
        if (featureOn()) {
            if (!bar.hasAttribute('data-gm-pbar-prev-display')) {
                bar.setAttribute('data-gm-pbar-prev-display', bar.style.display || '');
            }
            bar.style.setProperty('display', 'none', 'important');
        } else if (bar.hasAttribute('data-gm-pbar-prev-display')) {
            var prev = bar.getAttribute('data-gm-pbar-prev-display');
            bar.removeAttribute('data-gm-pbar-prev-display');
            if (prev) bar.style.display = prev;
            else bar.style.removeProperty('display');
        }
    }
    apply();
    var _n = 0, _t = setInterval(function () {
        apply();
        _n++;
        if (_n > 120) clearInterval(_t);
    }, 500);
    setInterval(apply, 3000);
    try {
        var mo = new MutationObserver(function () { apply(); });
        mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }

    // 遺物掉落 Chrome 通知（已移除黑市珍稀通知與收購互動 UI）
    const GM_BUY_SHOUT_NOTIFY_HOOKS_VER = 12;
    function injectBuyShoutNotifyPageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-buy-shout-notify-hooks');
        if (old && old.getAttribute('data-ver') === String(GM_BUY_SHOUT_NOTIFY_HOOKS_VER)) return;
        if (old) old.remove();
        const el = document.createElement('script');
        el.id = 'gm-buy-shout-notify-hooks';
        el.setAttribute('data-ver', String(GM_BUY_SHOUT_NOTIFY_HOOKS_VER));
        el.textContent = `
(function () {
    var VER = 12;

    function featureOn() {
        if (window.__gmBuyShoutNotifyOn === false) return false;
        if (window.__gmBuyShoutNotifyOn === true) return true;
        try { return localStorage.getItem('gm_buy_shout_notify_enabled') === '1'; } catch (e) { return false; }
    }

    function stripHtml(html) {
        try {
            var d = document.createElement('div');
            d.innerHTML = String(html == null ? '' : html);
            return String(d.textContent || d.innerText || '').replace(/\\s+/g, ' ').trim();
        } catch (e) {
            return String(html == null ? '' : html).replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
        }
    }

    // 卸掉舊版收購互動殘留
    function teardownBuyInteract() {
        try {
            var fab = document.getElementById('gm-wander-list-fab');
            if (fab) fab.remove();
            var p1 = document.getElementById('gm-wander-choice-panel');
            if (p1) p1.remove();
            var p2 = document.getElementById('gm-wander-list-panel');
            if (p2) p2.remove();
            if (typeof openWanderingShoutMenu === 'function' && openWanderingShoutMenu.__gmBuyShoutOrig) {
                window.openWanderingShoutMenu = openWanderingShoutMenu.__gmBuyShoutOrig;
            }
            if (typeof renderWanderingBuyerDialog === 'function' && renderWanderingBuyerDialog.__gmBuyShoutOrig) {
                window.renderWanderingBuyerDialog = renderWanderingBuyerDialog.__gmBuyShoutOrig;
            }
        } catch (e) {}
    }

    function showNotify(title, html, tag) {
        if (!featureOn()) return;
        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        var text = stripHtml(html);
        if (!text) return;
        try {
            var n = new Notification(title, {
                body: text,
                tag: tag || 'gm-relic-drop',
                renotify: true
            });
            n.onclick = function () {
                try { window.focus(); } catch (e0) {}
                try { n.close(); } catch (e1) {}
            };
        } catch (e) {}
    }

    function wrapLogSys() {
        if (typeof logSys !== 'function') return;
        if (logSys.__gmBuyShoutWrap && logSys.__gmBuyShoutVer === VER) return;
        var _prev = logSys.__gmBuyShoutOrig || logSys;
        while (_prev && _prev.__gmBuyShoutOrig) _prev = _prev.__gmBuyShoutOrig;
        window.logSys = function () {
            try {
                var msg = arguments.length ? arguments[0] : '';
                if (typeof msg === 'string' &&
                    msg.indexOf('sys-item-gain') !== -1 &&
                    msg.indexOf('c-relic') !== -1) {
                    showNotify('獲得遺物', msg, 'gm-relic-drop');
                }
            } catch (e0) {}
            return _prev.apply(this, arguments);
        };
        window.logSys.__gmBuyShoutWrap = true;
        window.logSys.__gmBuyShoutVer = VER;
        window.logSys.__gmBuyShoutOrig = _prev;
        if (_prev.__gmUiThrottleWrap) {
            window.logSys.__gmUiThrottleWrap = true;
            window.logSys.__gmUiThrottleOrig = _prev.__gmUiThrottleOrig || _prev;
        }
    }

    function install() {
        try { teardownBuyInteract(); } catch (e0) {}
        try { wrapLogSys(); } catch (e1) {}
    }
    install();
    var _n = 0, _t = setInterval(function () {
        install();
        _n++;
        if (_n > 60) clearInterval(_t);
    }, 500);
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }

    // 武防卷倉庫可用：強化／一鍵／快速強化 — 背包優先，不足扣倉庫（開關預設關）
    const GM_WH_SCROLL_ENH_HOOKS_VER = 2;
    function injectWhScrollEnhancePageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-wh-scroll-enh-hooks');
        if (old && old.getAttribute('data-ver') === String(GM_WH_SCROLL_ENH_HOOKS_VER)) return;
        if (old) old.remove();
        const el = document.createElement('script');
        el.id = 'gm-wh-scroll-enh-hooks';
        el.setAttribute('data-ver', String(GM_WH_SCROLL_ENH_HOOKS_VER));
        el.textContent = `
(function () {
    var VER = 2;
    var SCROLL_IDS = {
        scroll_weapon: 1, scroll_armor: 1, scroll_acc: 1,
        scroll_weapon_b: 1, scroll_armor_b: 1,
        scroll_weapon_c: 1, scroll_armor_c: 1
    };

    // HTML onclick="..." 內必須用單引號包參數，不可用 JSON.stringify（會變成雙引號打斷屬性）
    function q(s) {
        return "'" + String(s == null ? '' : s).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'") + "'";
    }

    function featureOn() {
        if (window.__gmWhScrollEnhOn === false) return false;
        if (window.__gmWhScrollEnhOn === true) return true;
        try { return localStorage.getItem('gm_wh_scroll_enhance_enabled') === '1'; } catch (e) { return false; }
    }
    function invCnt(id) {
        try {
            if (typeof player === 'undefined' || !player || !player.inv) return 0;
            var n = 0;
            for (var i = 0; i < player.inv.length; i++) {
                var it = player.inv[i];
                if (it && it.id === id) n += (it.cnt || 1);
            }
            return n;
        } catch (e) { return 0; }
    }
    function whCnt(id) {
        try {
            if (typeof whCountId === 'function') return whCountId(id) || 0;
        } catch (e) {}
        return 0;
    }
    function totalCnt(id) {
        return invCnt(id) + whCnt(id);
    }
    function consumeScrolls(id, n) {
        n = Math.max(0, Math.floor(Number(n) || 0));
        if (n <= 0) return 0;
        try {
            if (typeof questConsumeId === 'function') {
                var before = totalCnt(id);
                questConsumeId(id, n);
                return Math.max(0, before - totalCnt(id));
            }
        } catch (e) {}
        return 0;
    }
    function ensureInvScroll(id) {
        try {
            var it = player.inv.find(function (i) { return i && i.id === id && (i.cnt || 0) > 0; });
            if (it) return it;
            if (whCnt(id) <= 0) return null;
            if (typeof whConsumeId === 'function') whConsumeId(id, 1);
            else return null;
            if (typeof gainItem === 'function') gainItem(id, 1, true, true);
            return player.inv.find(function (i) { return i && i.id === id && (i.cnt || 0) > 0; }) || null;
        } catch (e) { return null; }
    }
    function findInvOrNull(id) {
        try {
            return player.inv.find(function (i) { return i && i.id === id && (i.cnt || 0) > 0; }) || null;
        } catch (e) { return null; }
    }

    function wrapShowEnhanceOptions() {
        if (typeof showEnhanceOptions !== 'function') return;
        if (showEnhanceOptions.__gmWhScrollWrap && showEnhanceOptions.__gmWhScrollVer === VER) return;
        var _prev = showEnhanceOptions.__gmWhScrollOrig || showEnhanceOptions;
        window.showEnhanceOptions = function (uid, isEq) {
            if (!featureOn()) return _prev.apply(this, arguments);
            try {
                var item = isEq
                    ? Object.values(player.eq).find(function (e) { return e && e.uid === uid; })
                    : player.inv.find(function (i) { return i && i.uid === uid; });
                if (!item) return;
                var d = DB.items[item.id];
                if (!d) return _prev.apply(this, arguments);

                var scrollNormId = '', scrollCurseId = '';
                var normTotal = 0, blessTotal = 0, curseTotal = 0;

                if (d.type === 'wpn') {
                    scrollNormId = 'scroll_weapon';
                    scrollCurseId = 'scroll_weapon_c';
                    normTotal = totalCnt('scroll_weapon');
                    blessTotal = totalCnt('scroll_weapon_b');
                    curseTotal = totalCnt('scroll_weapon_c');
                } else if (d.type === 'arm') {
                    scrollNormId = 'scroll_armor';
                    scrollCurseId = 'scroll_armor_c';
                    normTotal = totalCnt('scroll_armor');
                    blessTotal = totalCnt('scroll_armor_b');
                    curseTotal = totalCnt('scroll_armor_c');
                } else if (d.type === 'acc') {
                    scrollNormId = 'scroll_acc';
                    normTotal = totalCnt('scroll_acc');
                } else {
                    return _prev.apply(this, arguments);
                }

                if (d.type === 'acc') {
                    if (normTotal <= 0) {
                        logSys('<span class="text-red-400 font-bold">強化卷軸不足。</span>');
                        return;
                    }
                    var ensuredAcc = ensureInvScroll('scroll_acc');
                    if (!ensuredAcc) {
                        logSys('<span class="text-red-400 font-bold">強化卷軸不足。</span>');
                        return;
                    }
                    activeScroll = ensuredAcc;
                    doEnhance(item.uid, isEq);
                    return;
                }

                if (normTotal <= 0 && blessTotal <= 0 && curseTotal <= 0) {
                    logSys('<span class="text-red-400 font-bold">強化卷軸不足。</span>');
                    return;
                }

                document.getElementById('modal-item-name').innerHTML = '強化 ' + getItemFullName(item);
                document.getElementById('modal-item-name').className = 'text-xl font-bold mb-3 border-b border-slate-600 pb-3 text-purple-300';
                document.getElementById('modal-item-desc').innerHTML = '請選擇你要使用的強化卷軸：';

                var act = '';
                if (normTotal > 0) {
                    act += '<button class="col-span-2 w-full btn border-slate-600 bg-slate-800 hover:bg-slate-700 py-3 text-base font-bold text-white shadow" onclick="__gmWhEnhUse(' + q(scrollNormId) + ',' + q(item.uid) + ',' + !!isEq + ')">使用 ' + DB.items[scrollNormId].n + ' (擁有: ' + normTotal + '·含倉庫)</button>';
                }
                if (blessTotal > 0) {
                    var blessId = d.type === 'wpn' ? 'scroll_weapon_b' : 'scroll_armor_b';
                    act += '<button class="col-span-2 w-full btn border-yellow-600 bg-yellow-900 hover:bg-yellow-800 py-3 text-base font-bold text-yellow-300 shadow" onclick="__gmWhEnhUse(' + q(blessId) + ',' + q(item.uid) + ',' + !!isEq + ')">使用 ' + DB.items[blessId].n + ' (擁有: ' + blessTotal + '·含倉庫)</button>';
                }
                if (curseTotal > 0) {
                    act += '<button class="col-span-2 w-full btn border-red-800 bg-red-950 hover:bg-red-900 py-3 text-base font-bold c-cursed shadow" onclick="executeCurseDeEnhance(' + q(item.uid) + ',' + !!isEq + ',' + q(scrollCurseId) + ')">使用 ' + DB.items[scrollCurseId].n + ' (擁有: ' + curseTotal + '·含倉庫)｜強化值 -1</button>';
                }
                if (normTotal > 0 && (d.type === 'wpn' || d.type === 'arm')) {
                    var safe = d.safe || 0;
                    var _cur = Number(item.en) || 0;
                    var _max = Math.min(enhanceCap(d), Math.max(safe, _cur) + 6);
                    var _def = Math.min(_max, Math.max(safe, _cur + 1));
                    var _opts = '';
                    for (var _t = _cur + 1; _t <= _max; _t++) {
                        _opts += '<option value="' + _t + '"' + (_t === _def ? ' selected' : '') + '>+' + _t + (_t <= safe ? '（安定）' : '') + '</option>';
                    }
                    act += '<div class="col-span-2 flex gap-2 mt-2">'
                        + '<button class="flex-1 btn border-blue-600 bg-blue-900 hover:bg-blue-800 py-3 text-base font-bold text-blue-300 shadow" onclick="executeAutoSafeEnhance(' + q(item.uid) + ',' + !!isEq + ',' + q(scrollNormId) + ',Number(document.getElementById(\\x27auto-enh-target\\x27).value))">一鍵強化到指定值</button>'
                        + '<select id="auto-enh-target" class="btn border-blue-700 bg-slate-800 text-blue-200 font-bold px-2 py-3 rounded shadow">' + _opts + '</select>'
                        + '</div>';
                }
                act += '<button class="col-span-2 w-full btn py-3 bg-slate-700 text-lg font-bold mt-2" onclick="returnToItemModal(' + q(item.uid) + ',' + !!isEq + ')">返回</button>';
                document.getElementById('modal-actions').innerHTML = act;
                document.getElementById('item-modal').classList.remove('hidden');
            } catch (e) {
                return _prev.apply(this, arguments);
            }
        };
        window.showEnhanceOptions.__gmWhScrollWrap = true;
        window.showEnhanceOptions.__gmWhScrollVer = VER;
        window.showEnhanceOptions.__gmWhScrollOrig = _prev;
    }

    window.__gmWhEnhUse = function (scrollId, targetUid, isEq) {
        try {
            if (!featureOn()) {
                var it0 = findInvOrNull(scrollId);
                if (it0) executeEnhance(it0.uid, targetUid, isEq);
                return;
            }
            var it = ensureInvScroll(scrollId);
            if (!it) {
                logSys('<span class="text-red-400 font-bold">強化卷軸不足。</span>');
                return;
            }
            activeScroll = it;
            doEnhance(targetUid, isEq);
        } catch (e) {
            console.warn('[GM] __gmWhEnhUse', e);
        }
    };

    function wrapConsumeForEnhance() {
        if (typeof consume !== 'function' || typeof doEnhance !== 'function') return;
        if (doEnhance.__gmWhScrollWrap && doEnhance.__gmWhScrollVer === VER) return;
        var _prevDo = doEnhance.__gmWhScrollOrig || doEnhance;
        window.doEnhance = function () {
            if (!featureOn()) return _prevDo.apply(this, arguments);
            var _prevConsume = consume;
            window.consume = function (item) {
                try {
                    if (item && item.id && SCROLL_IDS[item.id]) {
                        consumeScrolls(item.id, 1);
                        if (typeof renderTabs === 'function') renderTabs();
                        return;
                    }
                } catch (e) {}
                return _prevConsume.apply(this, arguments);
            };
            try {
                return _prevDo.apply(this, arguments);
            } finally {
                window.consume = _prevConsume;
            }
        };
        window.doEnhance.__gmWhScrollWrap = true;
        window.doEnhance.__gmWhScrollVer = VER;
        window.doEnhance.__gmWhScrollOrig = _prevDo;
    }

    function wrapAutoSafeEnhance() {
        if (typeof executeAutoSafeEnhance !== 'function') return;
        if (executeAutoSafeEnhance.__gmWhScrollWrap && executeAutoSafeEnhance.__gmWhScrollVer === VER) return;
        var _prev = executeAutoSafeEnhance.__gmWhScrollOrig || executeAutoSafeEnhance;
        window.executeAutoSafeEnhance = function (targetUid, isEq, scrollId, goal) {
            if (!featureOn()) return _prev.apply(this, arguments);
            try {
                var target = isEq
                    ? Object.values(player.eq).find(function (e) { return e && e.uid === targetUid; })
                    : player.inv.find(function (i) { return i && i.uid === targetUid; });
                if (!target) return;
                target.en = Number(target.en) || 0;
                var d = DB.items[target.id];
                var safe = d.safe || 0;
                var slot = isEq ? Object.keys(player.eq).find(function (k) { return player.eq[k] === target; }) : null;
                goal = Math.min(Number(goal) || 0, enhanceCap(d));
                if (goal <= target.en) {
                    logSys('<span class="text-red-400 font-bold">目標強化值必須高於目前 (+' + target.en + ')。</span>');
                    return;
                }
                var scrollName = DB.items[scrollId] ? DB.items[scrollId].n : '強化卷軸';
                if (totalCnt(scrollId) <= 0) {
                    logSys('<span class="text-red-400 font-bold">' + scrollName + ' 數量不足。</span>');
                    return;
                }
                if (!isEq && target.cnt > 1) {
                    target.cnt -= 1;
                    var singleItem = Object.assign({}, target, { cnt: 1, uid: uid() });
                    player.inv.push(singleItem);
                    target = singleItem;
                }
                var fn0 = getItemFullName(target);
                var used = 0, destroyed = false, hadRisk = false, ranOut = false;
                while (target.en < goal) {
                    if (totalCnt(scrollId) <= 0) { ranOut = true; break; }
                    if (consumeScrolls(scrollId, 1) <= 0) { ranOut = true; break; }
                    used += 1;
                    if (target.en < safe) {
                        target.en += 1;
                    } else {
                        hadRisk = true;
                        var _oc = enhanceRollOutcome(d, target.en);
                        if (_oc === 'ok') target.en += 1;
                        else if (_oc === 'none') continue;
                        else { destroyed = true; break; }
                    }
                }
                if (destroyed) {
                    if (isEq) { if (slot) player.eq[slot] = null; }
                    else { player.inv = player.inv.filter(function (i) { return i.uid !== target.uid; }); }
                    logSys('消耗了 ' + used + ' 張 ' + scrollName + '。<span class="text-red-500 font-bold">' + fn0 + ' 強烈的發出銀色的光芒就消失了。</span>');
                } else if (ranOut) {
                    logSys(scrollName + ' 不足，消耗了 ' + used + ' 張，<span class="text-yellow-400 font-bold">+' + target.en + ' ' + d.n + ' 發出銀色的光芒。</span>');
                } else {
                    var prefix = hadRisk ? '<span class="text-green-300 font-bold">強化成功！</span>' : '';
                    logSys(prefix + '消耗了 ' + used + ' 張 ' + scrollName + '，<span class="text-yellow-400 font-bold">+' + target.en + ' ' + d.n + ' 發出銀色的光芒。</span>');
                }
                calcStats();
                renderTabs();
                closeModal();
                saveGame();
            } catch (e) {
                return _prev.apply(this, arguments);
            }
        };
        window.executeAutoSafeEnhance.__gmWhScrollWrap = true;
        window.executeAutoSafeEnhance.__gmWhScrollVer = VER;
        window.executeAutoSafeEnhance.__gmWhScrollOrig = _prev;
    }

    function wrapCurseDeEnhance() {
        if (typeof executeCurseDeEnhance !== 'function') return;
        if (executeCurseDeEnhance.__gmWhScrollWrap && executeCurseDeEnhance.__gmWhScrollVer === VER) return;
        var _prev = executeCurseDeEnhance.__gmWhScrollOrig || executeCurseDeEnhance;
        window.executeCurseDeEnhance = function (targetUid, isEq, scrollId) {
            if (!featureOn()) return _prev.apply(this, arguments);
            try {
                if (totalCnt(scrollId) <= 0) {
                    var nm = DB.items[scrollId] ? DB.items[scrollId].n : '詛咒卷軸';
                    logSys('<span class="text-red-400 font-bold">' + nm + ' 數量不足。</span>');
                    return;
                }
                var ensured = ensureInvScroll(scrollId);
                if (!ensured) {
                    logSys('<span class="text-red-400 font-bold">詛咒卷軸不足。</span>');
                    return;
                }
                return _prev.apply(this, arguments);
            } catch (e) {
                return _prev.apply(this, arguments);
            }
        };
        window.executeCurseDeEnhance.__gmWhScrollWrap = true;
        window.executeCurseDeEnhance.__gmWhScrollVer = VER;
        window.executeCurseDeEnhance.__gmWhScrollOrig = _prev;
    }

    function wrapQuickEnhance() {
        if (typeof runQuickEnhance !== 'function') return;
        if (runQuickEnhance.__gmWhScrollWrap && runQuickEnhance.__gmWhScrollVer === VER) return;
        var _prev = runQuickEnhance.__gmWhScrollOrig || runQuickEnhance;
        window.runQuickEnhance = function (type) {
            if (!featureOn()) return _prev.apply(this, arguments);
            try {
                var st = quickEnh[type];
                if (st && st.useCurse) return _prev.apply(this, arguments);
                var goal = Number((document.getElementById('qe-target-' + type) || {}).value) || st.target || 0;
                var entries = _qeEligibleItems(type).filter(function (i) { return st.sel[i.uid]; });
                if (!entries.length) {
                    logSys('<span class="text-red-400 font-bold">尚未勾選任何裝備。</span>');
                    return;
                }
                var scrollIds = ['scroll_weapon', 'scroll_armor', 'scroll_acc', 'scroll_weapon_b', 'scroll_armor_b'];
                var scrollStacks = {};
                var startInv = {};
                var startWh = {};
                scrollIds.forEach(function (sid) {
                    startInv[sid] = invCnt(sid);
                    startWh[sid] = whCnt(sid);
                    scrollStacks[sid] = { cnt: startInv[sid] + startWh[sid] };
                });

                var reached = 0, destroyed = 0, partial = 0, skipped = 0, usedTotal = 0;
                var removeUids = {};
                var survivors = [];

                entries.forEach(function (entry) {
                    var d = DB.items[entry.id];
                    var cnt = entry.cnt || 1;
                    removeUids[entry.uid] = 1;
                    for (var u = 0; u < cnt; u++) {
                        if ((entry.en || 0) >= Math.min(goal, enhanceCap(d))) {
                            skipped++;
                            survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid() }));
                            continue;
                        }
                        var r = _quickEnhanceUnit(d, entry.en || 0, goal, scrollStacks, st.useBless);
                        usedTotal += r.used;
                        if (r.destroyed) { destroyed++; continue; }
                        if (r.en >= goal) reached++; else partial++;
                        survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid(), en: r.en, lock: false }));
                    }
                });

                player.inv = player.inv.filter(function (i) { return !removeUids[i.uid]; });
                scrollIds.forEach(function (sid) {
                    var remain = scrollStacks[sid].cnt;
                    var start = startInv[sid] + startWh[sid];
                    var used = Math.max(0, start - remain);
                    var useInv = Math.min(used, startInv[sid]);
                    var useWh = used - useInv;
                    var invLeft = startInv[sid] - useInv;
                    var it = player.inv.find(function (x) { return x && x.id === sid; });
                    if (it) {
                        it.cnt = invLeft;
                        if (it.cnt <= 0) player.inv = player.inv.filter(function (x) { return x.uid !== it.uid; });
                    }
                    if (useWh > 0 && typeof whConsumeId === 'function') whConsumeId(sid, useWh);
                });
                survivors.forEach(function (s) {
                    var ex = player.inv.find(function (x) { return sameItemSig(x, s); });
                    if (ex) ex.cnt = (ex.cnt || 1) + 1;
                    else player.inv.push(s);
                });

                st.active = false; st.sel = {};
                var parts = ['成功 ' + reached + ' 件'];
                if (partial) parts.push('卷軸不足停 ' + partial + ' 件');
                if (skipped) parts.push('已達標 ' + skipped + ' 件');
                parts.push('<span class="text-red-400">爆裝 ' + destroyed + ' 件</span>');
                logSys('<span class="text-blue-300 font-bold">快速強化完成（目標 +' + goal + (st.useBless ? '·祝福卷' : '') + '·含倉庫）：</span>' + parts.join('、') + '，消耗 ' + usedTotal + ' 張' + (st.useBless ? '祝福' : '') + '卷軸。');
                calcStats();
                renderTabs(true);
                saveGame();
            } catch (e) {
                return _prev.apply(this, arguments);
            }
        };
        window.runQuickEnhance.__gmWhScrollWrap = true;
        window.runQuickEnhance.__gmWhScrollVer = VER;
        window.runQuickEnhance.__gmWhScrollOrig = _prev;
    }

    function wrapQuickCurse() {
        if (typeof runQuickCurse !== 'function') return;
        if (runQuickCurse.__gmWhScrollWrap && runQuickCurse.__gmWhScrollVer === VER) return;
        var _prev = runQuickCurse.__gmWhScrollOrig || runQuickCurse;
        window.runQuickCurse = function (type) {
            if (!featureOn()) return _prev.apply(this, arguments);
            try {
                var st = quickEnh[type];
                if (!st) return;
                var goal = Number((document.getElementById('qe-target-' + type) || {}).value);
                if (!Number.isFinite(goal)) goal = st.target != null ? st.target : 0;
                var entries = (typeof _qeEligibleItems === 'function' ? _qeEligibleItems(type) : []).filter(function (i) {
                    return st.sel[i.uid];
                });
                if (!entries.length) {
                    logSys('<span class="text-red-400 font-bold">尚未勾選任何裝備。</span>');
                    return;
                }
                var curseIds = ['scroll_weapon_c', 'scroll_armor_c'];
                var scrollStacks = {};
                var startInv = {};
                var startWh = {};
                curseIds.forEach(function (sid) {
                    startInv[sid] = invCnt(sid);
                    startWh[sid] = whCnt(sid);
                    scrollStacks[sid] = { cnt: startInv[sid] + startWh[sid] };
                });
                var reached = 0, partial = 0, skipped = 0, noScroll = 0, usedTotal = 0;
                var removeUids = {};
                var survivors = [];
                entries.forEach(function (entry) {
                    var d = DB.items[entry.id];
                    var curseId = d && d.type === 'wpn' ? 'scroll_weapon_c' : (d && d.type === 'arm' ? 'scroll_armor_c' : null);
                    var cnt = entry.cnt || 1;
                    removeUids[entry.uid] = true;
                    for (var u = 0; u < cnt; u++) {
                        var en = Number(entry.en) || 0;
                        if (!curseId) {
                            noScroll++;
                            survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid() }));
                            continue;
                        }
                        if (en <= goal) {
                            skipped++;
                            survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid() }));
                            continue;
                        }
                        var stk = scrollStacks[curseId];
                        while (en > goal && en > -1 && stk && stk.cnt > 0) {
                            stk.cnt -= 1;
                            en -= 1;
                            usedTotal += 1;
                        }
                        if (en <= goal) reached++; else partial++;
                        survivors.push(Object.assign({}, entry, { cnt: 1, uid: uid(), en: en, lock: false }));
                    }
                });
                player.inv = player.inv.filter(function (i) { return !removeUids[i.uid]; });
                curseIds.forEach(function (sid) {
                    var remain = scrollStacks[sid].cnt;
                    var start = startInv[sid] + startWh[sid];
                    var used = Math.max(0, start - remain);
                    var useInv = Math.min(used, startInv[sid]);
                    var useWh = used - useInv;
                    var invLeft = startInv[sid] - useInv;
                    var it = player.inv.find(function (i) { return i && i.id === sid; });
                    if (it) {
                        it.cnt = invLeft;
                        if (it.cnt <= 0) player.inv = player.inv.filter(function (x) { return x.uid !== it.uid; });
                    }
                    if (useWh > 0 && typeof whConsumeId === 'function') whConsumeId(sid, useWh);
                });
                survivors.forEach(function (s) {
                    var ex = (typeof sameItemSig === 'function')
                        ? player.inv.find(function (x) { return sameItemSig(x, s); })
                        : null;
                    if (ex) ex.cnt = (ex.cnt || 1) + 1;
                    else player.inv.push(s);
                });
                st.active = false;
                st.sel = {};
                var parts = ['退階 ' + reached + ' 件'];
                if (partial) parts.push('詛咒卷不足停 ' + partial + ' 件');
                if (skipped) parts.push('已達標 ' + skipped + ' 件');
                if (noScroll) parts.push('飾品無法退階 ' + noScroll + ' 件');
                var goalLabel = goal < 0 ? String(goal) : ('+' + goal);
                logSys('<span class="c-cursed font-bold">快速詛咒退階完成（退回 ' + goalLabel + '·含倉庫）：</span>'
                    + parts.join('、') + '，消耗 ' + usedTotal + ' 張詛咒卷軸。');
                calcStats();
                renderTabs(true);
                saveGame();
            } catch (e) {
                return _prev.apply(this, arguments);
            }
        };
        window.runQuickCurse.__gmWhScrollWrap = true;
        window.runQuickCurse.__gmWhScrollVer = VER;
        window.runQuickCurse.__gmWhScrollOrig = _prev;
    }

    function wrapQuickEnhanceHeader() {
        if (typeof buildQuickEnhanceHeader !== 'function') return;
        if (buildQuickEnhanceHeader.__gmWhScrollWrap && buildQuickEnhanceHeader.__gmWhScrollVer === VER) return;
        var _prev = buildQuickEnhanceHeader.__gmWhScrollOrig || buildQuickEnhanceHeader;
        window.buildQuickEnhanceHeader = function (type) {
            var hdr = _prev.apply(this, arguments);
            if (!featureOn() || !hdr) return hdr;
            try {
                var st = quickEnh[type];
                if (!st || !st.active) return hdr;
                var blessId = type === 'wpn' ? 'scroll_weapon_b' : 'scroll_armor_b';
                var curseId = type === 'wpn' ? 'scroll_weapon_c' : 'scroll_armor_c';
                var blessTotal = totalCnt(blessId);
                var curseTotal = totalCnt(curseId);
                var labels = hdr.querySelectorAll('label');
                for (var li = 0; li < labels.length; li++) {
                    var lab = labels[li];
                    var txt = lab.textContent || '';
                    if (txt.indexOf('祝福卷') >= 0) {
                        lab.classList.toggle('text-yellow-300', blessTotal > 0 && !st.useCurse);
                        lab.classList.toggle('text-slate-500', !(blessTotal > 0 && !st.useCurse));
                        lab.title = (lab.title || '') + '（數量含倉庫）';
                        var nodes = lab.childNodes;
                        for (var ni = 0; ni < nodes.length; ni++) {
                            if (nodes[ni].nodeType === 3 && /祝福卷/.test(nodes[ni].textContent || '')) {
                                nodes[ni].textContent = ' 祝福卷(' + blessTotal + '·含倉)';
                            }
                        }
                    } else if (txt.indexOf('詛咒卷') >= 0) {
                        lab.classList.toggle('text-red-300', curseTotal > 0);
                        lab.classList.toggle('text-slate-500', curseTotal <= 0);
                        lab.title = (lab.title || '') + '（數量含倉庫）';
                        var nodes2 = lab.childNodes;
                        for (var nj = 0; nj < nodes2.length; nj++) {
                            if (nodes2[nj].nodeType === 3 && /詛咒卷/.test(nodes2[nj].textContent || '')) {
                                nodes2[nj].textContent = ' 詛咒卷(' + curseTotal + '·含倉)';
                            }
                        }
                    }
                }
            } catch (e) {}
            return hdr;
        };
        window.buildQuickEnhanceHeader.__gmWhScrollWrap = true;
        window.buildQuickEnhanceHeader.__gmWhScrollVer = VER;
        window.buildQuickEnhanceHeader.__gmWhScrollOrig = _prev;
    }

    function installAll() {
        try { wrapShowEnhanceOptions(); } catch (e) {}
        try { wrapConsumeForEnhance(); } catch (e2) {}
        try { wrapAutoSafeEnhance(); } catch (e3) {}
        try { wrapCurseDeEnhance(); } catch (e4) {}
        try { wrapQuickEnhance(); } catch (e5) {}
        try { wrapQuickCurse(); } catch (e5b) {}
        try { wrapQuickEnhanceHeader(); } catch (e6) {}
    }
    installAll();
    var _n = 0;
    var _t = setInterval(function () {
        installAll();
        _n++;
        if (_n > 60) clearInterval(_t);
    }, 500);
})();
`;
        (document.head || document.documentElement).appendChild(el);
    }

    function tryInstallPageHooks() {
        if (typeof document === 'undefined') return;
        const old = document.getElementById('gm-ally-page-hooks');
        if (!old || old.getAttribute('data-ver') !== String(GM_PAGE_HOOKS_VER)) {
        injectPageHooks();
        }
        try {
            var _deadRenew = document.getElementById('gm-castle-renew-hooks');
            if (_deadRenew) _deadRenew.remove();
            var _deadSwitch = document.getElementById('gm-castle-switch-hooks');
            if (_deadSwitch) _deadSwitch.remove();
            var _deadBtn = document.getElementById('gm-castle-switch-btn');
            if (_deadBtn) _deadBtn.remove();
        } catch (eCastleClean) {}
        try { injectSuperBlackMarketPageHooks(); } catch (eBm) {}
        try { injectWhScrollEnhancePageHooks(); } catch (eWh) {}
        try { injectBuyShoutNotifyPageHooks(); } catch (eBuy) {}
        try { injectHideOrigPbarPageHooks(); } catch (ePbar) {}
        try { injectInvItemSearchPageHooks(); } catch (eInvSearch) {}
        try { injectAuditExpHourPctPageHooks(); } catch (ePct) {}
        try { injectPandoraRareNotifyPageHooks(); } catch (eRare) {}
    }

    function collectAllySlots(teamEl) {
        const slots = new Set();
        // 只認 squad-hp-3 / squad-rez-3（存檔格 1~8）；排除 squad-hp-txt-3 等血條文字節點
        teamEl.querySelectorAll('[id^="squad-hp-"], [id^="squad-rez-"]').forEach((el) => {
            const m = el.id.match(/^squad-(?:hp|rez)-(\d+)$/);
            if (m) slots.add(m[1]);
        });
        return slots;
    }

    let _gmSquadBusy = false;
    let _gmSquadDebounce = null;

    function squadButtonsComplete(team) {
        if (team.querySelector('[id^="gm-switch-slot-txt-"]')) return false;
        const slots = collectAllySlots(team);
        for (const slot of slots) {
            const btn = document.getElementById('gm-switch-slot-' + slot);
            if (!btn) return false;
            const anchor = document.getElementById('squad-hp-' + slot)
                || document.getElementById('squad-rez-' + slot);
            if (!anchor) return false;
            const card = anchor.closest('.rounded');
            if (!card) return false;
            const rightWrap = card.querySelector('.gm-ally-right-wrap');
            const lvEl = card.querySelector('span.text-slate-400.text-xs, span.text-slate-600.text-xs');
            if (!rightWrap || !rightWrap.contains(btn) || !lvEl || !rightWrap.contains(lvEl)) return false;
            if (btn.nextElementSibling !== lvEl) return false;
        }
        return slots.size > 0;
    }

    function unwrapLegacyNameWrap(row, nameEl) {
        const legacy = nameEl && nameEl.closest('.gm-ally-name-wrap:not(.gm-ally-right-wrap)');
        if (legacy && legacy.parentElement === row) {
            row.insertBefore(nameEl, legacy);
            legacy.remove();
        }
    }

    function placeSwitchButton(card, slot, nameEl) {
        const btnId = 'gm-switch-slot-' + slot;
        const row = nameEl.parentElement;
        if (!row) return;

        unwrapLegacyNameWrap(row, nameEl);

        let lvEl = row.querySelector(':scope > span.text-slate-400.text-xs, :scope > span.text-slate-600.text-xs');
        if (!lvEl) {
            const inner = row.querySelector('.text-sm');
            if (inner) {
                lvEl = inner.querySelector('span.text-slate-400.text-xs, span.text-slate-600.text-xs');
            }
        }
        if (!lvEl) {
            const wrapLv = row.querySelector('.gm-ally-right-wrap span.text-slate-400.text-xs, .gm-ally-right-wrap span.text-slate-600.text-xs');
            if (wrapLv) lvEl = wrapLv;
        }
        if (!lvEl) return;

        let rightWrap = lvEl.closest('.gm-ally-right-wrap');
        if (!rightWrap) {
            rightWrap = document.createElement('span');
            rightWrap.className = 'gm-ally-right-wrap';
            lvEl.parentElement.insertBefore(rightWrap, lvEl);
            rightWrap.appendChild(lvEl);
        }

        let btn = document.getElementById(btnId);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = btnId;
            btn.type = 'button';
            btn.className = 'gm-ally-switch-btn';
            btn.textContent = '切換角色';
            btn.title = '儲存目前角色後，切換至存檔 ' + slot + ' 的實際角色';
            btn.setAttribute('onclick', "__gmSwitchToAllySlot('" + slot + "')");
        }
        // 已在正確位置就不動 DOM，避免 MutationObserver 來回重放造成閃爍
        if (btn.parentElement === rightWrap && btn.nextElementSibling === lvEl) return;
        rightWrap.insertBefore(btn, lvEl);
    }

    function injectSquadSwitchButtons(force) {
        if (_gmSquadBusy) return;
        const team = document.getElementById('squad-tab-team');
        if (!team) return;
        if (!effectiveSquadSwitchEnabled()) {
            team.querySelectorAll('.gm-ally-switch-btn, [id^="gm-switch-slot-"]').forEach((b) => b.remove());
            return;
        }
        if (!force && squadButtonsComplete(team)) return;

        _gmSquadBusy = true;
        try {
            team.querySelectorAll('[id^="gm-switch-slot-txt-"]').forEach((b) => b.remove());

            collectAllySlots(team).forEach((slot) => {
                const anchor = document.getElementById('squad-hp-' + slot)
                    || document.getElementById('squad-rez-' + slot);
                if (!anchor) return;

                const card = anchor.closest('.rounded');
                if (!card) return;

                const nameEl = card.querySelector('.font-bold.text-amber-200, .font-bold.text-slate-400');
                if (!nameEl) return;

                placeSwitchButton(card, slot, nameEl);
            });
        } finally {
            _gmSquadBusy = false;
        }
    }

    function _gmIsOwnSquadDomNode(n) {
        if (!n) return true;
        if (n.nodeType === 3) return true;
        if (n.nodeType !== 1) return false;
        const id = n.id || '';
        if (id.indexOf('gm-') === 0 || id.indexOf('squad-buff-bar-') === 0 || id.indexOf('squad-name-status-') === 0) return true;
        const cl = n.classList;
        if (!cl) return false;
        return cl.contains('gm-ally-switch-btn')
            || cl.contains('gm-ally-right-wrap')
            || cl.contains('gm-squad-buff-bar')
            || cl.contains('gm-squad-name-status')
            || cl.contains('status-icon');
    }

    function _gmOnlyOwnSquadMutations(mutations) {
        for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];
            if (m.type !== 'childList') continue;
            for (let j = 0; j < m.addedNodes.length; j++) {
                if (!_gmIsOwnSquadDomNode(m.addedNodes[j])) return false;
            }
            for (let k = 0; k < m.removedNodes.length; k++) {
                if (!_gmIsOwnSquadDomNode(m.removedNodes[k])) return false;
            }
        }
        return true;
    }

    function scheduleSquadInject(force) {
        clearTimeout(_gmSquadDebounce);
        // 隊伍面板重繪後必須同步補回按鈕（在瀏覽器繪製前），延遲會造成「消失再出現」閃爍
        if (force) {
            injectSquadSwitchButtons(true);
            return;
        }
        _gmSquadDebounce = setTimeout(() => injectSquadSwitchButtons(false), 0);
    }

    console.log('[ExtGM] 放置天堂 擴充功能 v1.0 已載入（功能／平衡／廢品／即時查詢）');

    function initSquadSwitchUI() {
        tryInstallPageHooks();
        applySquadSwitchVisibility();

        const team = document.getElementById('squad-tab-team');
        if (team) {
            const obs = new MutationObserver((mutations) => {
                if (_gmSquadBusy) return;
                if (_gmOnlyOwnSquadMutations(mutations)) return;
                // 同步注入：renderSquadPanel 清掉按鈕後，同一輪 microtask 補回，避免閃爍
                injectSquadSwitchButtons(true);
            });
            obs.observe(team, { childList: true, subtree: true });
        }

        const panel = document.getElementById('squad-panel');
        if (panel) {
            const panelObs = new MutationObserver(() => {
                scheduleSquadInject(true);
            });
            panelObs.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
        }

        scheduleSquadInject(true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSquadSwitchUI);
    } else {
        initSquadSwitchUI();
    }

})();