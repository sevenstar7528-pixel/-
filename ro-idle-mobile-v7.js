// ==UserScript==
// @name         RO Idle v1.12 手機 UI｜完整安全適配版
// @namespace    ro-idle-v112-mobile-safe
// @version      7.0.0
// @description  RO Idle v1.12 手機適配：鋅幣最左、UI 分排、自動高度、防遮擋
// @author       ChatGPT
// @match        https://nba9001-sys.github.io/ro-idle/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'ro-idle-v112-safe-mobile-v7';

    function installStyle() {

        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');

        style.id = STYLE_ID;

        style.textContent = `

/* =========================================================
   RO Idle v1.12
   Mobile Safe UI v7
   ========================================================= */


/* =========================================================
   手機版
   ========================================================= */

@media screen and (max-width: 768px) {

    /* -----------------------------------------------------
       基本設定
       ----------------------------------------------------- */

    html {

        width: 100% !important;

        max-width: 100vw !important;

        overflow-x: hidden !important;

        /*
         * 保留手機正常縮放
         */
        -webkit-text-size-adjust: 100% !important;
    }


    body {

        width: 100% !important;

        max-width: 100vw !important;

        min-width: 0 !important;

        margin: 0 !important;

        overflow-x: hidden !important;

        /*
         * 不禁止雙指縮放
         */
        touch-action: manipulation;
    }


    /* =====================================================
       遊戲外框
       ===================================================== */

    .game-shell {

        width: 100% !important;

        max-width: 100vw !important;

        min-width: 0 !important;

        /*
         * 不固定高度
         *
         * 讓 HUD 增高時，
         * 下方遊戲內容自然往下移
         */
        height: auto !important;

        min-height: 100vh !important;

        overflow: visible !important;
    }


    /* =====================================================
       HUD
       ===================================================== */

    .hud-bar {

        /*
         * 使用 Grid
         *
         * 不再依賴 Flex 壓縮
         */
        display: grid !important;

        width: 100% !important;

        max-width: 100vw !important;

        min-width: 0 !important;

        /*
         * 第一排：
         *
         * 鋅幣 | 角色
         *
         * 第二排：
         * HP/SP/EXP/JOB
         *
         * 第三排：
         * 所有功能
         */
        grid-template-columns:
            auto
            minmax(0, 1fr) !important;

        grid-template-rows:
            auto
            auto
            auto !important;

        align-items: center !important;

        justify-content: stretch !important;

        column-gap: 8px !important;

        row-gap: 5px !important;

        padding:
            6px 8px !important;

        margin: 0 !important;

        box-sizing: border-box !important;

        /*
         * 最重要：
         * 絕對不能讓內容被容器裁切
         */
        height: auto !important;

        min-height: 0 !important;

        max-height: none !important;

        overflow: visible !important;
    }


    /* =====================================================
       鋅幣
       ===================================================== */

    #hud-gold {

        /*
         * 第一排最左
         */
        grid-column: 1 !important;

        grid-row: 1 !important;

        justify-self: start !important;

        align-self: center !important;

        width: auto !important;

        min-width: 0 !important;

        max-width: 40vw !important;

        margin: 0 !important;

        padding: 0 !important;

        font-size:
            clamp(9px, 2.7vw, 13px) !important;

        line-height: 1.2 !important;

        font-weight: 700 !important;

        white-space: nowrap !important;

        overflow: hidden !important;

        text-overflow: ellipsis !important;

        box-sizing: border-box !important;

        /*
         * 不允許它蓋住其他 UI
         */
        position: static !important;
    }


    /* =====================================================
       角色資訊
       ===================================================== */

    .hud-left {

        /*
         * 第一排右側
         */
        grid-column: 2 !important;

        grid-row: 1 !important;

        width: 100% !important;

        min-width: 0 !important;

        max-width: 100% !important;

        margin: 0 !important;

        padding: 0 !important;

        overflow: hidden !important;

        box-sizing: border-box !important;
    }


    .hud-name-row {

        display: flex !important;

        align-items: baseline !important;

        gap: 4px !important;

        width: 100% !important;

        min-width: 0 !important;

        margin: 0 !important;

        padding: 0 !important;

        font-size:
            clamp(11px, 3vw, 14px) !important;

        line-height: 1.2 !important;

        white-space: nowrap !important;

        overflow: hidden !important;
    }


    #hud-name {

        min-width: 0 !important;

        max-width: 55vw !important;

        overflow: hidden !important;

        text-overflow: ellipsis !important;

        white-space: nowrap !important;
    }


    .hud-job-tag {

        flex: 0 0 auto !important;

        font-size:
            clamp(8px, 2.2vw, 11px) !important;

        white-space: nowrap !important;
    }


    .hud-lv {

        margin-top: 2px !important;

        font-size:
            clamp(8px, 2.2vw, 11px) !important;

        line-height: 1.2 !important;

        white-space: nowrap !important;

        overflow: hidden !important;

        text-overflow: ellipsis !important;
    }


    /* =====================================================
       HP / SP / EXP / JOB
       ===================================================== */

    .hud-bars {

        /*
         * 第二排
         */
        grid-column: 1 / -1 !important;

        grid-row: 2 !important;

        order: initial !important;

        width: 100% !important;

        max-width: none !important;

        min-width: 0 !important;

        flex: none !important;

        display: flex !important;

        flex-direction: column !important;

        gap: 3px !important;

        margin: 0 !important;

        padding: 0 !important;

        box-sizing: border-box !important;

        /*
         * 自動高度
         */
        height: auto !important;

        min-height: 0 !important;

        max-height: none !important;

        overflow: visible !important;
    }


    /* =====================================================
       HP / SP / EXP / JOB 血條
       ===================================================== */

    .bar-track {

        position: relative !important;

        width: 100% !important;

        height: 13px !important;

        min-height: 13px !important;

        max-height: 13px !important;

        box-sizing: border-box !important;

        border-radius: 20px !important;

        overflow: hidden !important;
    }


    .bar-track.small {

        height: 9px !important;

        min-height: 9px !important;

        max-height: 9px !important;
    }


    .bar-text {

        font-size:
            clamp(7px, 1.9vw, 9px) !important;

        line-height: 1 !important;

        white-space: nowrap !important;
    }


    /* =====================================================
       右側功能區
       ===================================================== */

    .hud-right {

        /*
         * 第三排
         *
         * 橫跨整個 HUD
         */
        grid-column: 1 / -1 !important;

        grid-row: 3 !important;

        width: 100% !important;

        min-width: 0 !important;

        max-width: none !important;

        /*
         * 不再使用原本的單行 Flex
         */
        display: grid !important;

        /*
         * 4 欄
         */
        grid-template-columns:
            repeat(4, minmax(0, 1fr)) !important;

        /*
         * 行高自動
         */
        grid-auto-rows: minmax(28px, auto) !important;

        align-items: stretch !important;

        justify-content: stretch !important;

        column-gap: 4px !important;

        row-gap: 4px !important;

        margin: 0 !important;

        padding: 0 !important;

        box-sizing: border-box !important;

        /*
         * 最重要：
         * 內容可以把 HUD 撐高
         */
        height: auto !important;

        min-height: 0 !important;

        max-height: none !important;

        overflow: visible !important;
    }


    /* =====================================================
       儲存
       匯出
       返回
       關於
       ===================================================== */

    .hud-right > .btn-save {

        width: 100% !important;

        min-width: 0 !important;

        max-width: 100% !important;

        height: auto !important;

        min-height: 28px !important;

        max-height: none !important;

        margin: 0 !important;

        padding:
            5px 3px !important;

        box-sizing: border-box !important;

        border-radius: 6px !important;

        font-size:
            clamp(9px, 2.5vw, 12px) !important;

        line-height: 1.1 !important;

        white-space: nowrap !important;

        overflow: hidden !important;

        text-overflow: ellipsis !important;

        /*
         * 防止原本 CSS 撐開
         */
        flex: none !important;
    }


    /* =====================================================
       音樂／音效／角色／技能
       ===================================================== */

    .volume-controls {

        /*
         * 自己佔完整一排
         */
        grid-column: 1 / -1 !important;

        width: 100% !important;

        min-width: 0 !important;

        max-width: none !important;

        display: grid !important;

        grid-template-columns:
            repeat(4, minmax(0, 1fr)) !important;

        grid-auto-rows: minmax(30px, auto) !important;

        gap: 4px !important;

        align-items: stretch !important;

        margin: 0 !important;

        padding: 0 !important;

        box-sizing: border-box !important;

        /*
         * 不固定高度
         */
        height: auto !important;

        min-height: 0 !important;

        max-height: none !important;

        overflow: visible !important;
    }


    .volume-label {

        width: 100% !important;

        min-width: 0 !important;

        height: auto !important;

        min-height: 30px !important;

        display: flex !important;

        align-items: center !important;

        justify-content: center !important;

        gap: 2px !important;

        margin: 0 !important;

        padding:
            2px !important;

        box-sizing: border-box !important;

        font-size:
            clamp(8px, 2.1vw, 10px) !important;

        line-height: 1 !important;

        white-space: nowrap !important;

        overflow: hidden !important;
    }


    .volume-label input[type="range"] {

        width: 45px !important;

        min-width: 20px !important;

        max-width: 55px !important;

        height: 12px !important;

        margin: 0 !important;

        padding: 0 !important;

        flex: 1 1 auto !important;
    }


    .volume-label span {

        width: 28px !important;

        min-width: 20px !important;

        max-width: 30px !important;

        margin: 0 !important;

        padding: 0 !important;

        text-align: right !important;

        font-size: 8px !important;

        flex: 0 0 auto !important;
    }


    /* =====================================================
       掛機收益
       ===================================================== */

    #btn-idle-report {

        width: 100% !important;

        min-width: 0 !important;

        max-width: 100% !important;

        height: auto !important;

        min-height: 30px !important;

        margin: 0 !important;

        padding:
            4px !important;

        box-sizing: border-box !important;

        border-radius: 6px !important;

        font-size: 14px !important;

        overflow: hidden !important;
    }


    /* =====================================================
       轉職提示
       ===================================================== */

    #btn-jobchange-alert {

        width: 100% !important;

        min-width: 0 !important;

        max-width: 100% !important;

        height: auto !important;

        min-height: 30px !important;

        margin: 0 !important;

        padding:
            4px !important;

        box-sizing: border-box !important;

        font-size:
            clamp(8px, 2vw, 10px) !important;

        line-height: 1.1 !important;

        white-space: nowrap !important;

        overflow: hidden !important;

        text-overflow: ellipsis !important;
    }


    /* =====================================================
       避免 HUD 任何子元素絕對定位造成遮擋
       ===================================================== */

    .hud-bar > *,
    .hud-right > *,
    .volume-controls > * {

        box-sizing: border-box !important;
    }


    /* =====================================================
       遊戲主體
       ===================================================== */

    .game-body {

        width: 100% !important;

        max-width: 100vw !important;

        min-width: 0 !important;

        height: auto !important;

        min-height: 0 !important;

        overflow: visible !important;
    }


    .battle-panel {

        width: 100% !important;

        max-width: 100% !important;

        min-width: 0 !important;

        height: auto !important;

        min-height: 320px !important;

        overflow: visible !important;

        box-sizing: border-box !important;
    }


    .side-panel {

        width: 100% !important;

        max-width: none !important;

        min-width: 0 !important;

        box-sizing: border-box !important;
    }


    /* =====================================================
       圖片 / Canvas
       ===================================================== */

    img,
    svg,
    video {

        max-width: 100% !important;
    }


    canvas {

        max-width: 100% !important;

        box-sizing: border-box !important;
    }


    /* =====================================================
       430px 以下
       ===================================================== */

    @media screen and (max-width: 430px) {

        .hud-bar {

            column-gap: 6px !important;

            row-gap: 4px !important;

            padding:
                5px 6px !important;
        }


        #hud-gold {

            max-width: 38vw !important;

            font-size: 9px !important;
        }


        .hud-name-row {

            font-size: 11px !important;
        }


        .hud-job-tag {

            font-size: 8px !important;
        }


        .hud-lv {

            font-size: 8px !important;
        }


        .bar-track {

            height: 12px !important;

            min-height: 12px !important;

            max-height: 12px !important;
        }


        .bar-track.small {

            height: 8px !important;

            min-height: 8px !important;

            max-height: 8px !important;
        }


        .hud-right {

            column-gap: 3px !important;

            row-gap: 3px !important;

            grid-auto-rows:
                minmax(27px, auto) !important;
        }


        .hud-right > .btn-save {

            min-height: 27px !important;

            padding:
                4px 2px !important;

            font-size: 8px !important;
        }


        .volume-controls {

            grid-auto-rows:
                minmax(29px, auto) !important;

            gap: 3px !important;
        }


        .volume-label {

            min-height: 29px !important;

            font-size: 7px !important;
        }


        .volume-label input[type="range"] {

            width: 32px !important;

            min-width: 16px !important;

            max-width: 42px !important;
        }


        .volume-label span {

            width: 23px !important;

            min-width: 18px !important;

            font-size: 7px !important;
        }
    }


    /* =====================================================
       390px 以下
       ===================================================== */

    @media screen and (max-width: 390px) {

        .hud-bar {

            column-gap: 5px !important;

            padding:
                4px 5px !important;
        }


        #hud-gold {

            max-width: 36vw !important;

            font-size: 8px !important;
        }


        .hud-name-row {

            font-size: 10px !important;
        }


        .hud-job-tag {

            font-size: 7px !important;
        }


        .hud-lv {

            font-size: 7px !important;
        }


        .bar-track {

            height: 11px !important;

            min-height: 11px !important;

            max-height: 11px !important;
        }


        .bar-track.small {

            height: 7px !important;

            min-height: 7px !important;

            max-height: 7px !important;
        }


        .hud-right {

            grid-auto-rows:
                minmax(25px, auto) !important;
        }


        .hud-right > .btn-save {

            min-height: 25px !important;

            padding:
                3px 2px !important;

            font-size: 8px !important;
        }


        .volume-controls {

            grid-auto-rows:
                minmax(27px, auto) !important;
        }


        .volume-label {

            min-height: 27px !important;

            font-size: 7px !important;
        }


        .volume-label input[type="range"] {

            width: 28px !important;

            min-width: 14px !important;
        }


        .volume-label span {

            display: none !important;
        }


        #btn-idle-report,
        #btn-jobchange-alert {

            min-height: 27px !important;
        }
    }


    /* =====================================================
       375px 以下
       ===================================================== */

    @media screen and (max-width: 375px) {

        .hud-bar {

            column-gap: 4px !important;

            row-gap: 3px !important;

            padding:
                4px !important;
        }


        #hud-gold {

            max-width: 34vw !important;

            font-size: 7px !important;
        }


        .hud-name-row {

            font-size: 9px !important;
        }


        .hud-job-tag {

            font-size: 7px !important;
        }


        .hud-lv {

            font-size: 7px !important;
        }


        .bar-track {

            height: 10px !important;

            min-height: 10px !important;

            max-height: 10px !important;
        }


        .bar-track.small {

            height: 6px !important;

            min-height: 6px !important;

            max-height: 6px !important;
        }


        .hud-right {

            grid-auto-rows:
                minmax(24px, auto) !important;
        }


        .hud-right > .btn-save {

            min-height: 24px !important;

            font-size: 7px !important;

            padding:
                3px 1px !important;
        }


        .volume-controls {

            grid-auto-rows:
                minmax(25px, auto) !important;
        }


        .volume-label {

            min-height: 25px !important;

            font-size: 6px !important;
        }


        .volume-label input[type="range"] {

            width: 24px !important;

            min-width: 12px !important;
        }


        #btn-idle-report,
        #btn-jobchange-alert {

            min-height: 25px !important;

            font-size: 7px !important;
        }
    }


    /* =====================================================
       防止任何主要區域產生水平捲軸
       ===================================================== */

    .game-shell,
    .hud-bar,
    .game-body,
    .battle-panel,
    .side-panel {

        overflow-x: hidden !important;
    }

}


/* =========================================================
   桌面版
   完全不修改
   ========================================================= */

@media screen and (min-width: 769px) {

    /*
     * 不覆蓋任何桌面 HUD CSS
     */

}

`;

        document.head.appendChild(style);
    }


    /* =========================================================
       Viewport
       ========================================================= */

    function setupViewport() {

        let viewport =
            document.querySelector(
                'meta[name="viewport"]'
            );

        if (!viewport) {

            viewport =
                document.createElement('meta');

            viewport.name = 'viewport';

            document.head.appendChild(viewport);
        }

        /*
         * 保留：
         * - 正常手機縮放
         * - 雙指放大縮小
         *
         * 不使用 user-scalable=no
         */
        viewport.setAttribute(
            'content',
            'width=device-width, initial-scale=1.0, viewport-fit=cover'
        );
    }


    /* =========================================================
       初始化
       ========================================================= */

    function start() {

        setupViewport();

        installStyle();
    }


    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            start,
            { once: true }
        );

    } else {

        start();
    }


    /* =========================================================
       旋轉螢幕
       ========================================================= */

    window.addEventListener(
        'orientationchange',
        function () {

            /*
             * 全部由 CSS 自動重新排版
             */
        }
    );

})();
