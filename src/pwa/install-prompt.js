import { trackEvent } from "../analytics/events.js";
import { state } from "../state/app-state.js";
import { safeLocal, safeSession } from "../state/storage.js";
let deferredPrompt = null;
if (!safeSession.getItem('pwa_session_start_time')) {
    safeSession.setItem('pwa_session_start_time', Date.now().toString());
}
let pwaSessionStartTime = parseInt(safeSession.getItem('pwa_session_start_time'), 10);

function getPwaBrowserContext() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const isIOSSafari = isIOS && /WebKit/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua) && !/EdgiOS/.test(ua) && !/GSA/.test(ua) && !/Line\//.test(ua) && !/FBAV/.test(ua) && !/FBAN/.test(ua) && !/Instagram/.test(ua);
    const isIOSChrome = isIOS && /CriOS/.test(ua);
    const isIOSInApp = isIOS && !isIOSSafari && !isIOSChrome;
    const isAndroidInApp = isAndroid && /Line\/|FBAV|FBAN|Instagram|MicroMessenger/.test(ua);
    return { ua, isIOS, isAndroid, isIOSSafari, isIOSChrome, isIOSInApp, isAndroidInApp };
}

function showPwaPrompt() {
    const promptEl = document.getElementById('pwa-install-prompt');
    if (!promptEl || promptEl.classList.contains('show')) return;

    preparePwaPromptForCurrentBrowser();
    promptEl.classList.remove('hidden');
    setTimeout(() => {
        promptEl.classList.add('show');
    }, 50);
}

function preparePwaPromptForCurrentBrowser() {
    const promptEl = document.getElementById('pwa-install-prompt');
    const cancelBtn = document.getElementById('pwa-btn-cancel');
    const installBtn = document.getElementById('pwa-btn-install');
    if (!promptEl) return;

    const context = getPwaBrowserContext();
    const titleEl = promptEl.querySelector('.pwa-prompt-title');
    const descEl = promptEl.querySelector('.pwa-prompt-desc');
    const iosGuideline = promptEl.querySelector('.pwa-ios-guideline');
    const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');

    if (iosGuideline) iosGuideline.classList.add('hidden');
    if (browserGuideline) browserGuideline.classList.add('hidden');
    if (cancelBtn) cancelBtn.textContent = '下次再說';
    if (installBtn) {
        installBtn.style.display = '';
        installBtn.textContent = '立即加入';
    }
    if (titleEl) titleEl.textContent = '將「帶小孩吃什麼」加入主畫面';

    if (context.isAndroid && deferredPrompt) {
        if (descEl) descEl.textContent = '按下「立即加入」後，瀏覽器會跳出加入主畫面的確認視窗。';
        promptEl.dataset.pwaMode = 'android-native';
    } else if (context.isAndroid) {
        if (descEl) descEl.textContent = '請使用瀏覽器選單中的「新增至主畫面」或「安裝應用程式」。';
        if (installBtn) installBtn.textContent = '查看步驟';
        promptEl.dataset.pwaMode = 'android-guideline';
    } else {
        if (descEl) descEl.textContent = '下次查詢更快速，還能享有全螢幕的體驗！';
        promptEl.dataset.pwaMode = 'default';
    }
}

function showPwaSafariInstallGuideline() {
    const promptEl = document.getElementById('pwa-install-prompt');
    const cancelBtn = document.getElementById('pwa-btn-cancel');
    const installBtn = document.getElementById('pwa-btn-install');
    if (!promptEl) return;

    const iosGuideline = promptEl.querySelector('.pwa-ios-guideline');
    const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
    const descEl = promptEl.querySelector('.pwa-prompt-desc');

    if (browserGuideline) browserGuideline.classList.add('hidden');
    if (iosGuideline) iosGuideline.classList.remove('hidden');
    if (installBtn) installBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.textContent = '我知道了';
    if (descEl) descEl.textContent = '依照下方導引，即可將此網頁加入主畫面。';
    promptEl.dataset.pwaMode = 'safari-guideline';
}

export function setupPwaInstallPrompt() {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
                .then(reg => console.log('Service Worker registered successfully:', reg.scope))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // 2. Track unique visits across sessions (using sessionStorage to guard new sessions)
    if (!safeSession.getItem('pwa_session_active')) {
        safeSession.setItem('pwa_session_active', 'true');
        let visitCount = parseInt(safeLocal.getItem('pwa_visit_count') || '0', 10);
        visitCount += 1;
        safeLocal.setItem('pwa_visit_count', visitCount.toString());
        console.log(`PWA Session visit count incremented: ${visitCount}`);
    }

    // 3. Listen for Android/Chrome native PWA install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        console.log('beforeinstallprompt event captured');
        preparePwaPromptForCurrentBrowser();
        
        // Check triggers when the browser says app is installable
        checkPwaInstallTrigger();
    });

    // 4. Setup prompt action buttons
    const promptEl = document.getElementById('pwa-install-prompt');
    const cancelBtn = document.getElementById('pwa-btn-cancel');
    const installBtn = document.getElementById('pwa-btn-install');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (cancelBtn.textContent === '我知道了') {
                trackEvent('close_pwa_tutorial');
            } else {
                trackEvent('click_pwa_cancel');
            }
            if (promptEl) promptEl.classList.remove('show');
            
            // Store session dismissal
            safeSession.setItem('pwa_dismissed_this_session', 'true');
            
            // Increment total dismiss count
            let dismissCount = parseInt(safeLocal.getItem('pwa_dismiss_count') || '0', 10);
            dismissCount++;
            safeLocal.setItem('pwa_dismiss_count', dismissCount.toString());
            
            console.log('PWA prompt dismissed by user. Total dismisses: ' + dismissCount);
        });
    }

    if (installBtn) {
        installBtn.addEventListener('click', () => {
            trackEvent('click_pwa_install', { pwa_mode: promptEl.dataset.pwaMode || 'unknown' });
            const ua = navigator.userAgent;
            const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
            const isAndroid = /Android/.test(ua);

            // --- Detect browser context ---
            const isIOSSafari   = isIOS && /WebKit/.test(ua) && !/CriOS/.test(ua) && !/GSA/.test(ua) && !/Line\//.test(ua) && !/FBAV/.test(ua) && !/FBAN/.test(ua) && !/Instagram/.test(ua);
            const isIOSChrome   = isIOS && /CriOS/.test(ua);
            const isIOSInApp    = isIOS && !isIOSSafari && !isIOSChrome; // LINE, GSA, FB, IG, Messenger, etc.
            const isAndroidInApp= isAndroid && /Line\/|FBAV|FBAN|Instagram|MicroMessenger/.test(ua);

            // Helper: show a guideline panel and transform buttons
            function showGuideline(guidelineEl, descText, injectUrlParam = false) {
                guidelineEl.classList.remove('hidden');
                installBtn.style.display = 'none';
                cancelBtn.textContent = '我知道了';
                const descEl = promptEl.querySelector('.pwa-prompt-desc');
                if (descEl) descEl.textContent = descText;

                if (injectUrlParam) {
                    const url = new URL(window.location.href);
                    if (!url.searchParams.has('open_pwa')) {
                        url.searchParams.set('open_pwa', '1');
                        window.history.replaceState({}, '', url);
                    }
                }
            }

            // Helper: build numbered step HTML
            function steps(arr) {
                return arr.map((s, i) =>
                    `<div class="pwa-step"><span class="pwa-step-num">${i + 1}</span><span class="pwa-step-desc">${s}</span></div>`
                ).join('');
            }

            if (isAndroid && deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        safeLocal.setItem('pwa_prompt_dismissed', 'true');
                        console.log('User accepted the PWA install prompt');
                    } else {
                        console.log('User dismissed the PWA install prompt');
                    }
                    deferredPrompt = null;
                });
                if (promptEl) promptEl.classList.remove('show');
                return;
            }

            if (isAndroid && !isAndroidInApp) {
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    browserText.innerHTML = steps([
                        '點擊右上角瀏覽器選單「⋮」',
                        '選擇「<strong>新增至主畫面</strong>」或「<strong>安裝應用程式</strong>」',
                        '依照瀏覽器畫面確認即可完成'
                    ]);
                    showGuideline(browserGuideline, '這個瀏覽器目前沒有提供一鍵安裝視窗，請依照下方步驟加入主畫面。');
                }
                return;
            }

            if (isIOSChrome) {
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    browserText.innerHTML = steps([
                        '點右上角的分享或選單按鈕',
                        '選擇「在 Safari 中開啟」',
                        'Safari 開啟後，會立刻出現加入主畫面的步驟'
                    ]);
                    showGuideline(browserGuideline, '請先用 Safari 開啟：', true);
                }
                return;
            }

            if (isIOSSafari) {
                // Show Safari-specific panel (arrow pointing down to bottom toolbar)
                const iosGuideline = promptEl.querySelector('.pwa-ios-guideline');
                if (iosGuideline) showGuideline(iosGuideline, '依照下方導引，即可將此網頁安裝至主畫面。');

            } else if (isIOSChrome) {
                // iOS Chrome: share button is at top right
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText      = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    browserText.innerHTML = steps([
                        '點擊右上角的分享圖示 ↑（網址列右側）',
                        '在選單中選擇「<strong>加入主畫面</strong>」➕',
                        '點擊右上角「加入」即完成！',
                    ]);
                    showGuideline(browserGuideline, '依照下方步驟，用 Chrome 加入主畫面：');
                }

            } else if (isIOSInApp) {
                // iOS in-app browser (LINE、Google App、Facebook、Instagram 等)
                // 只引導切換到外部瀏覽器，切換後 PWA 提示會自動重新出現
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText      = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    const isLINE = /Line\//.test(ua);
                    if (isLINE) {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 LINE 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊畫面<strong>右下角</strong>的 <strong>⋯</strong>',
                                '選擇「<strong>在瀏覽器中開啟</strong>」',
                                '網頁在 Safari 開啟後，提示將自動再次出現 🎉',
                            ]);
                    } else {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 App 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊瀏覽器的分享 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline; margin: 0 2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> 按鈕',
                                '選擇「<strong>在 Safari 中開啟</strong>」或「<strong>用瀏覽器開啟</strong>」',
                                '網頁在 Safari 開啟後，提示將自動再次出現 🎉',
                            ]);
                    }
                    showGuideline(browserGuideline, '請先切換到 Safari：', true);
                }

            } else if (deferredPrompt) {
                // Android Chrome (or other supporting browsers): native install prompt
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the PWA install prompt');
                    } else {
                        console.log('User dismissed the PWA install prompt');
                    }
                    deferredPrompt = null;
                });
                if (promptEl) promptEl.classList.remove('show');

            } else if (isAndroidInApp) {
                // Android in-app browser (LINE, Facebook, Instagram, WeChat...)
                // 只引導切換到外部瀏覽器，切換後 PWA 提示會自動重新出現
                const browserGuideline = promptEl.querySelector('.pwa-browser-guideline');
                const browserText      = promptEl.querySelector('.pwa-browser-text');
                if (browserGuideline && browserText) {
                    const isLINE = /Line\//.test(ua);
                    if (isLINE) {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 LINE 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊畫面<strong>右下角</strong>的 <strong>⋯</strong>',
                                '選擇「<strong>在瀏覽器中開啟</strong>」',
                                '網頁在 Chrome 開啟後，提示將自動再次出現 🎉',
                            ]);
                    } else {
                        browserText.innerHTML =
                            '<div style="margin-bottom:8px;">此頁在 App 內開啟，無法直接安裝。</div>' +
                            steps([
                                '點擊瀏覽器內的 <strong>⋯</strong> 選單或分享按鈕',
                                '選擇「<strong>用預設瀏覽器開啟</strong>」或「<strong>在 Chrome 中開啟</strong>」',
                                '網頁在 Chrome 開啟後，提示將自動再次出現 🎉',
                            ]);
                    }
                    showGuideline(browserGuideline, '請先切換到 Chrome：', true);
                }

            } else {
                // Fallback
                const descEl = promptEl.querySelector('.pwa-prompt-desc');
                if (descEl) {
                    descEl.innerHTML = '請點擊瀏覽器選單中的「<strong>新增至主畫面</strong>」或「<strong>安裝應用程式</strong>」即可安裝。';
                }
                installBtn.style.display = 'none';
            }
        });
    }

    // 5. Setup a periodic check for the duration trigger (every 10 seconds)
    setInterval(checkPwaInstallTrigger, 10000);
    
    // Check immediately on load (especially for ?open_pwa=1 Safari handoffs)
    setTimeout(checkPwaInstallTrigger, 100);
}

function checkPwaInstallTrigger() {
    const promptEl = document.getElementById('pwa-install-prompt');
    if (!promptEl) return;

    // Check for open_pwa parameter (from in-app browser handoff)
    const urlParams = new URLSearchParams(window.location.search);
    let forceShow = false;
    if (urlParams.get('open_pwa') === '1') {
        forceShow = true;
        urlParams.delete('open_pwa');
        const newSearch = urlParams.toString();
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
    }

    // Check if running in standalone/installed mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        console.log('PWA is already running in standalone mode');
        return;
    }

    // Check if dismissed (unless forced via URL)
    if (!forceShow) {
        // Hide if dismissed in current session
        if (safeSession.getItem('pwa_dismissed_this_session') === 'true') return;
        
        // Hide permanently if dismissed 3 or more times
        const dismissCount = parseInt(safeLocal.getItem('pwa_dismiss_count') || '0', 10);
        if (dismissCount >= 3) return;
        
        // Backwards compatibility for old dismissed flag
        if (safeLocal.getItem('pwa_prompt_dismissed') === 'true') return;
    }

    // Skip desktop users (devices with a precise pointer, i.e. mouse)
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (isDesktop && !forceShow) return;

    // Evaluate triggers (mobile only)
    const visitCount = parseInt(safeLocal.getItem('pwa_visit_count') || '0', 10);
    const sessionDuration = (Date.now() - pwaSessionStartTime) / 1000; // in seconds
    const pwaContext = getPwaBrowserContext();

    // Show if: forced from a browser handoff, OR used continuously for 60+ seconds.
    // Do not use visit count as an early trigger: on iOS Chrome this made the prompt
    // appear almost immediately for returning users.
    const hasViewedDetail = state.detailViews && state.detailViews.size > 0;
    const shouldShow = forceShow || (sessionDuration >= 60 && hasViewedDetail);

    if (shouldShow && !promptEl.classList.contains('show')) {
        console.log(`Triggering PWA install prompt: visits=${visitCount}, duration=${sessionDuration.toFixed(1)}s, forceShow=${forceShow}`);
        showPwaPrompt();
        if (forceShow && pwaContext.isIOSSafari) {
            setTimeout(showPwaSafariInstallGuideline, 80);
        }
    }
}
