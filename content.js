(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  Configuration                                                      */
    /* ------------------------------------------------------------------ */
    const CONFIG = {
        CSS_ID: 'yt-fullwindow-style',
        BODY_CLASS: 'yt-fullwindow-active',
        BUTTON_CLASS: 'ytp-fullwindow-button',
        Z_INDEX: 3000,
        TRANSITION_DELAY: 100,
        REINIT_DELAY: 1000,
    };

    /* ------------------------------------------------------------------ */
    /*  State                                                              */
    /* ------------------------------------------------------------------ */
    let state = {
        fullWindowActive: false,
        handlingFullscreenFromFullWindow: false,
        doubleClickHandler: null,
        urlObserver: null,
        domObserver: null,
        lastUrl: '',
    };

    /* ------------------------------------------------------------------ */
    /*  Mode detection                                                     */
    /* ------------------------------------------------------------------ */

    function getWatchFlexy() {
        return document.querySelector('ytd-watch-flexy');
    }

    function getCurrentMode() {
        if (state.fullWindowActive) return 'fullwindow';
        const wf = getWatchFlexy();
        if (!wf) return 'default';
        if (wf.hasAttribute('fullscreen')) return 'fullscreen';
        if (wf.hasAttribute('theater') || wf.hasAttribute('full-bleed-player')) return 'theater';
        return 'default';
    }

    function isTheater() {
        const wf = getWatchFlexy();
        return wf && (wf.hasAttribute('theater') || wf.hasAttribute('full-bleed-player'));
    }

    /* ------------------------------------------------------------------ */
    /*  CSS injection                                                      */
    /* ------------------------------------------------------------------ */

    function addFullscreenStyles() {
        if (document.getElementById(CONFIG.CSS_ID)) return;

        const style = document.createElement('style');
        style.id = CONFIG.CSS_ID;
        style.textContent = [
            'body.' + CONFIG.BODY_CLASS + ' #full-bleed-container.ytd-watch-flexy {',
            '    position: fixed !important;',
            '    top: 0 !important;',
            '    left: 0 !important;',
            '    z-index: ' + CONFIG.Z_INDEX + ' !important;',
            '    width: 100vw !important;',
            '    height: 100vh !important;',
            '    max-height: 100vh !important;',
            '    background: #000 !important;',
            '}',
            'body.' + CONFIG.BODY_CLASS + ' {',
            '    overflow: hidden !important;',
            '    height: 100% !important;',
            '}',
            'html:has(body.' + CONFIG.BODY_CLASS + ') {',
            '    overflow: hidden !important;',
            '    height: 100% !important;',
            '}',
            '.ytp-fullscreen .ytp-size-button,',
            '.ytp-size-button {',
            '    display: inline-block !important;',
            '    opacity: 1 !important;',
            '    visibility: visible !important;',
            '}',
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /*  Theater / fullscreen toggles                                       */
    /* ------------------------------------------------------------------ */

    function clickSizeButton() {
        const btn = document.querySelector('.ytp-size-button.ytp-button');
        if (btn) { btn.click(); return true; }
        return false;
    }

    function clickFullscreenButton() {
        const btn = document.querySelector('.ytp-fullscreen-button.ytp-button');
        if (btn) { btn.click(); return true; }
        return false;
    }

    function exitTheaterMode() {
        if (isTheater()) return clickSizeButton();
        return false;
    }

    /* ------------------------------------------------------------------ */
    /*  Full-window mode toggle                                            */
    /* ------------------------------------------------------------------ */

    function enterFullWindow() {
        if (state.fullWindowActive) return;
        state.fullWindowActive = true;
        document.body.classList.add(CONFIG.BODY_CLASS);

        if (!isTheater()) {
            clickSizeButton();
        }
        updateButtonState(true);
    }

    function exitFullWindow() {
        if (!state.fullWindowActive) return;
        state.fullWindowActive = false;
        document.body.classList.remove(CONFIG.BODY_CLASS);

        if (isTheater()) {
            exitTheaterMode();
        }
        updateButtonState(false);
    }

    function toggleFullWindow() {
        if (state.fullWindowActive) {
            exitFullWindow();
        } else {
            enterFullWindow();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Control-bar button                                                 */
    /* ------------------------------------------------------------------ */

    const FULLWINDOW_ICON = '<svg height="24" viewBox="0 0 24 24" width="24">' +
        '<path d="M4 4h16v16H4V4zm2 2v12h12V6H6z" fill="white"/>' +
        '<path d="M2 6V2h4M18 2h4v4M2 18v4h4M18 22h4v-4" fill="none" stroke="white" stroke-width="2"/>' +
        '</svg>';

    var tooltipEl = null;

    function showTooltip(btn, text) {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'ytp-fullwindow-tooltip';
            tooltipEl.style.cssText = [
                'position: fixed',
                'background: rgba(28,28,28,0.9)',
                'color: #fff',
                'padding: 5px 9px',
                'border-radius: 4px',
                'font-size: 11px',
                'font-family: "YouTube Noto", Roboto, Arial, sans-serif',
                'line-height: 14px',
                'white-space: nowrap',
                'pointer-events: none',
                'z-index: 99999',
            ].join(';');
            document.body.appendChild(tooltipEl);
        }
        tooltipEl.textContent = text;

        var rect = btn.getBoundingClientRect();
        tooltipEl.style.left = (rect.left + rect.width / 2) + 'px';
        tooltipEl.style.top = (rect.top - 30) + 'px';
        tooltipEl.style.transform = 'translate(-50%, -100%)';
        tooltipEl.style.display = '';
    }

    function hideTooltip() {
        if (tooltipEl) tooltipEl.style.display = 'none';
    }

    function injectButton() {
        if (document.querySelector('.' + CONFIG.BUTTON_CLASS)) return;

        const controls = document.querySelector('.ytp-right-controls');
        if (!controls) return;

        const btn = document.createElement('button');
        btn.className = CONFIG.BUTTON_CLASS + ' ytp-button';
        btn.setAttribute('data-priority', '10');
        btn.setAttribute('aria-label', '全屏窗口模式 键盘快捷键 W');
        btn.setAttribute('aria-keyshortcuts', 'w');
        btn.innerHTML = FULLWINDOW_ICON;

        btn.addEventListener('mouseenter', function() {
            showTooltip(btn, '全屏窗口模式 (W)');
        });
        btn.addEventListener('mouseleave', hideTooltip);

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleFullWindow();
        });

        const fullscreenBtn = controls.querySelector('.ytp-fullscreen-button');
        if (fullscreenBtn && fullscreenBtn.parentNode) {
            fullscreenBtn.parentNode.insertBefore(btn, fullscreenBtn);
        } else {
            controls.appendChild(btn);
        }
    }

    function updateButtonState(active) {
        const btn = document.querySelector('.' + CONFIG.BUTTON_CLASS);
        if (!btn) return;
        if (active) {
            btn.setAttribute('aria-pressed', 'true');
            btn.style.opacity = '1';
        } else {
            btn.removeAttribute('aria-pressed');
            btn.style.opacity = '';
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Keyboard handler                                                   */
    /* ------------------------------------------------------------------ */

    function handleKeyDown(event) {
        var key = event.key;

        var el = document.activeElement;
        var isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
        if (isInput && key !== 'Escape') return;

        var mode = getCurrentMode();

        // W key - toggle full-window mode
        if (key === 'w' || key === 'W') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            toggleFullWindow();
            return;
        }

        // F key - toggle native fullscreen
        if (key === 'f' || key === 'F') {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (mode === 'fullwindow') {
                state.handlingFullscreenFromFullWindow = true;
                exitFullWindow();
                setTimeout(function() {
                    clickFullscreenButton();
                    state.handlingFullscreenFromFullWindow = false;
                }, CONFIG.TRANSITION_DELAY);
            } else if (mode === 'default') {
                clickFullscreenButton();
            } else if (mode === 'theater') {
                exitTheaterMode();
                setTimeout(function() {
                    clickFullscreenButton();
                }, CONFIG.TRANSITION_DELAY);
            } else if (mode === 'fullscreen') {
                clickFullscreenButton();
            }
            return;
        }

        // Escape - exit to default view
        if (key === 'Escape') {
            if (mode === 'fullwindow') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                exitFullWindow();
                return;
            }
            if (mode === 'fullscreen' || mode === 'theater') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                if (mode === 'fullscreen') {
                    clickFullscreenButton();
                } else {
                    clickSizeButton();
                }
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Fullscreen button click from theater -> fullscreen transition      */
    /* ------------------------------------------------------------------ */

    function setupFullscreenButtonListener() {
        document.addEventListener('click', function(event) {
            var btn = event.target.closest('.ytp-fullscreen-button.ytp-button');
            if (!btn) return;

            var mode = getCurrentMode();

            if (mode === 'fullwindow' && !state.handlingFullscreenFromFullWindow) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                state.handlingFullscreenFromFullWindow = true;
                exitFullWindow();
                setTimeout(function() {
                    clickFullscreenButton();
                    state.handlingFullscreenFromFullWindow = false;
                }, CONFIG.TRANSITION_DELAY);
            } else if (mode === 'theater') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                exitTheaterMode();
                setTimeout(function() {
                    clickFullscreenButton();
                }, CONFIG.TRANSITION_DELAY);
            }
        }, true);
    }

    /* ------------------------------------------------------------------ */
    /*  Double-click from theater -> fullscreen transition                 */
    /* ------------------------------------------------------------------ */

    function setupDoubleClickListener() {
        if (state.doubleClickHandler) {
            document.removeEventListener('dblclick', state.doubleClickHandler, true);
        }

        state.doubleClickHandler = function(event) {
            var mode = getCurrentMode();

            if (mode === 'fullwindow') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                state.handlingFullscreenFromFullWindow = true;
                exitFullWindow();
                setTimeout(function() {
                    clickFullscreenButton();
                    state.handlingFullscreenFromFullWindow = false;
                }, CONFIG.TRANSITION_DELAY);
            } else if (mode === 'theater') {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                exitTheaterMode();
                setTimeout(function() {
                    clickFullscreenButton();
                }, CONFIG.TRANSITION_DELAY);
            }
        };

        document.addEventListener('dblclick', state.doubleClickHandler, true);
    }

    /* ------------------------------------------------------------------ */
    /*  SPA navigation handling                                            */
    /* ------------------------------------------------------------------ */

    function handlePageChange() {
        state.handlingFullscreenFromFullWindow = false;
        if (state.fullWindowActive) {
            exitFullWindow();
        }
        addFullscreenStyles();
        setTimeout(injectButton, CONFIG.REINIT_DELAY);
        setTimeout(setupFullscreenButtonListener, CONFIG.REINIT_DELAY);
        setTimeout(setupDoubleClickListener, CONFIG.REINIT_DELAY);
    }

    function setupControlsObserver() {
        var observer = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === 'childList') {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var node = m.addedNodes[j];
                        if (node.nodeType === 1) {
                            if (node.querySelector && node.querySelector('.ytp-right-controls')) {
                                setTimeout(injectButton, 500);
                                return;
                            }
                            if (node.classList && node.classList.contains('ytp-right-controls')) {
                                setTimeout(injectButton, 500);
                                return;
                            }
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function setupObservers() {
        if (state.domObserver) state.domObserver.disconnect();
        state.domObserver = new MutationObserver(function(mutations) {
            var shouldReinit = false;
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                if (mutation.type === 'childList') {
                    var nodes = mutation.addedNodes;
                    for (var j = 0; j < nodes.length; j++) {
                        if (nodes[j].nodeType === 1 && nodes[j].tagName === 'YTD-WATCH-FLEXY') {
                            shouldReinit = true;
                            break;
                        }
                    }
                }
                if (shouldReinit) break;
            }
            if (shouldReinit) setTimeout(handlePageChange, 100);
        });
        state.domObserver.observe(document.body, { childList: true, subtree: true });

        if (state.urlObserver) state.urlObserver.disconnect();
        state.lastUrl = location.href;
        state.urlObserver = new MutationObserver(function() {
            var url = location.href;
            if (url !== state.lastUrl) {
                state.lastUrl = url;
                handlePageChange();
            }
        });
        state.urlObserver.observe(document, { subtree: true, childList: true });
    }

    /* ------------------------------------------------------------------ */
    /*  Bootstrap                                                          */
    /* ------------------------------------------------------------------ */

    function init() {
        addFullscreenStyles();
        document.addEventListener('keydown', handleKeyDown, true);
        injectButton();
        setupFullscreenButtonListener();
        setupDoubleClickListener();
        setupControlsObserver();
        setupObservers();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
