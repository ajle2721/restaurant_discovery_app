import { trackEvent } from "../analytics/events.js";
import {
    attributeIcons,
    attributeLabels,
    ESTIMATED_ATTRIBUTE_TOOLTIP,
    isPositiveAttributeValue,
} from "./attributes.js";
import { getDisplayPriceSymbol } from "../search/price-filter.js";
import { getDynamicStatus } from "../search/scoring.js";
import {
    fixSimplifiedAddress,
    formatRestaurantName,
    getDisplaySummary,
    patchAiSummary,
} from "./presentation.js";
import { calculateDistance, calculateTravelTimes } from "../search/distance.js";
import { state } from "../state/app-state.js";

export function createRestaurantDetailController({
    detailContent,
    getLocationContext,
    getPFSummaryTags,
    getViewedRestaurantCount,
    isInAppBrowser,
    openFeedbackModal,
    showToast,
    submitAiFeedback,
    trackAiSummaryFeedbackVote,
}) {
    function setupEstimatedTagToggles(root) {
        const note = root.querySelector('#estimated-tag-note');
        const tags = Array.from(root.querySelectorAll('.tag.likely'));
        if (!note || !tags.length) return;
    
        const closeNote = () => {
            note.classList.add('hidden');
            tags.forEach(tag => {
                tag.classList.remove('expanded');
                tag.setAttribute('aria-expanded', 'false');
            });
        };
    
        const toggleNote = (tag) => {
            const isExpanded = tag.classList.contains('expanded') && !note.classList.contains('hidden');
            closeNote();
            if (isExpanded) return;
    
            note.textContent = tag.getAttribute('title') || ESTIMATED_ATTRIBUTE_TOOLTIP;
            note.classList.remove('hidden');
            tag.classList.add('expanded');
            tag.setAttribute('aria-expanded', 'true');
        };
    
        tags.forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.preventDefault();
                toggleNote(tag);
            });
            tag.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                toggleNote(tag);
            });
        });
    }
    
    function setupAiSummaryTooltip(root) {
        const button = root.querySelector('#ai-summary-info-btn');
        const tooltip = root.querySelector('#ai-summary-tooltip');
        if (!button || !tooltip) return;
    
        let pinnedOpen = false;
    
        const setOpen = (isOpen) => {
            tooltip.hidden = !isOpen;
            tooltip.classList.toggle('active', isOpen);
            button.setAttribute('aria-expanded', String(isOpen));
        };
    
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pinnedOpen = !pinnedOpen;
            setOpen(pinnedOpen);
        });
    
        button.addEventListener('mouseenter', () => {
            if (!pinnedOpen) setOpen(true);
        });
    
        button.addEventListener('mouseleave', () => {
            if (!pinnedOpen) setOpen(false);
        });
    
        button.addEventListener('focus', () => setOpen(true));
        button.addEventListener('blur', () => {
            if (!pinnedOpen) setOpen(false);
        });
    
        button.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            pinnedOpen = false;
            setOpen(false);
            button.blur();
        });
    
        root.addEventListener('click', (e) => {
            if (tooltip.hidden || button.contains(e.target) || tooltip.contains(e.target)) return;
            pinnedOpen = false;
            setOpen(false);
        });
    }
    
    function normalizeExternalActionUrl(url) {
        const value = String(url || '').trim();
        if (!value) return '';
        if (/^(https?:)?\/\//i.test(value)) return value.startsWith('//') ? `https:${value}` : value;
        return `https://${value}`;
    }
    
    function normalizePhoneHref(phone) {
        const value = String(phone || '').trim();
        if (!value) return '';
        const normalized = value.replace(/[^+\d]/g, '');
        return normalized ? `tel:${normalized}` : '';
    }
    
    function getRestaurantActionPayload(restaurant) {
        return {
            restaurant_name: restaurant?.name || "",
            place_id: restaurant?.place_id || "",
            viewed_restaurant_count: getViewedRestaurantCount(),
            location_context: getLocationContext()
        };
    }
    
    function buildVisitActionsHtml(restaurant, googleMapsUrl, mapTarget) {
        const reservationUrl = normalizeExternalActionUrl(restaurant?.reservation_url || restaurant?.reservationUrl);
        const websiteUrl = normalizeExternalActionUrl(restaurant?.website_url || restaurant?.website || restaurant?.websiteUri);
        const phone = String(restaurant?.phone || restaurant?.national_phone_number || restaurant?.international_phone_number || '').trim();
        const phoneHref = normalizePhoneHref(phone);
        const buttons = [];
    
        if (reservationUrl) {
            buttons.push(`<a id="btn-open-reservation" class="visit-action-btn reservation" href="${reservationUrl}" target="_blank" rel="noopener noreferrer">線上訂位</a>`);
        }
        if (phoneHref) {
            buttons.push(`<a id="btn-call-restaurant" class="visit-action-btn phone" href="${phoneHref}">電話詢問</a>`);
        }
        if (websiteUrl) {
            buttons.push(`<a id="btn-open-website" class="visit-action-btn website" href="${websiteUrl}" target="_blank" rel="noopener noreferrer">官網</a>`);
        }
        buttons.push(`<a id="btn-open-google-maps" class="visit-action-btn map" href="${googleMapsUrl}" target="${mapTarget}" rel="noopener noreferrer">Google 地圖</a>`);
    
        return `
            <div class="visit-actions-section">
                <div class="visit-actions-title">行前確認或訂位：</div>
                <div class="visit-actions-grid">${buttons.join('')}</div>
            </div>
        `;
    }
    
    function bindVisitActionTracking(restaurant) {
        const bind = (id, eventName) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.onclick = () => {
                try {
                    trackEvent(eventName, getRestaurantActionPayload(restaurant));
                } catch (e) {}
            };
        };
        bind('btn-open-reservation', 'click_reservation');
        bind('btn-call-restaurant', 'click_phone');
        bind('btn-open-website', 'click_website');
        bind('btn-open-google-maps', 'open_google_maps');
    }
    
    function renderDetailContent(restaurant) {
        let dist = undefined;
        let originLabel = '';
        const isSpecificRestaurant = state.searchLocation && state.searchLocation.type === '特定餐廳';
        if (isSpecificRestaurant) {
            if (state.userLocation) {
                dist = calculateDistance(state.userLocation.lat, state.userLocation.lng, restaurant.latitude, restaurant.longitude);
                originLabel = '目前位置';
            } else if (state.lastGeographicLocation) {
                dist = calculateDistance(state.lastGeographicLocation.lat, state.lastGeographicLocation.lng, restaurant.latitude, restaurant.longitude);
                if (state.lastGeographicLocation.type === '行政區') {
                    originLabel = `「${state.lastGeographicLocation.name}中心點」`;
                } else {
                    originLabel = `「${state.lastGeographicLocation.name}」`;
                }
            }
        } else if (state.searchLocation && restaurant.latitude && restaurant.longitude) {
            if (state.searchLocation.type === '多地點') {
                let minDistance = Infinity;
                let nearestLoc = null;
                state.searchLocation.locations.forEach(loc => {
                    const d = calculateDistance(loc.lat, loc.lng, restaurant.latitude, restaurant.longitude);
                    if (d < minDistance) {
                        minDistance = d;
                        nearestLoc = loc;
                    }
                });
                dist = minDistance;
                originLabel = `「${nearestLoc ? nearestLoc.name : '搜尋起點'}」`;
            } else if (state.searchLocation.type === '捷運站周邊') {
                const mrtStations = state.locationData.filter(l => l.type === '捷運站' || l.name.endsWith('站'));
                let minMrtDist = Infinity;
                let nearestMrt = null;
                mrtStations.forEach(mrt => {
                    const d = calculateDistance(mrt.lat, mrt.lng, restaurant.latitude, restaurant.longitude);
                    if (d < minMrtDist) {
                        minMrtDist = d;
                        nearestMrt = mrt;
                    }
                });
                dist = minMrtDist;
                originLabel = `「${nearestMrt ? nearestMrt.name : '捷運站'}」`;
            } else {
                dist = calculateDistance(state.searchLocation.lat, state.searchLocation.lng, restaurant.latitude, restaurant.longitude);
                if (state.searchLocation.type === '行政區') {
                    originLabel = `「${state.searchLocation.name}中心點」`;
                } else {
                    originLabel = `「${state.searchLocation.name}」`;
                }
            }
        }
        if (restaurant.ai_summary && !restaurant._ai_summary_patched) {
            restaurant.ai_summary = patchAiSummary(restaurant, restaurant.ai_summary, { maxSentences: 4, maxChars: 360 });
            restaurant._ai_summary_patched = true;
        }
        if (restaurant.card_summary && !restaurant._card_summary_patched) {
            restaurant.card_summary = patchAiSummary(restaurant, restaurant.card_summary, { maxSentences: 3, maxChars: 220 });
            restaurant._card_summary_patched = true;
        }
    
        let tagsHtml = '';
        const attributes = restaurant.attributes || {};
        const orderedKeys = ['has_tableware', 'high_chair_available', 'has_diaper_table', 'kids_menu', 'kid_noise_tolerant', 'spacious_seating', 'has_play_area', 'has_private_room'];
        orderedKeys.forEach(attr => {
            const val = attributes[attr];
            if (isPositiveAttributeValue(val) && attributeLabels[attr]) {
                const isMatched = state.filters && state.filters.has(attr);
                const isLikely = val === 'likely' || val === 'likely_room' || val === 'likely_venue';
                
                let tagClass = 'tag amenity-available';
                if (isMatched) tagClass += ' selected-filter';
                if (isLikely) tagClass += ' likely';
                
                const titleAttr = isLikely ? ` title="${ESTIMATED_ATTRIBUTE_TOOLTIP}" role="button" tabindex="0" aria-expanded="false" aria-controls="estimated-tag-note"` : '';
                const statusIcon = isLikely ? '≈' : '✓';
                const suffix = isLikely ? '<span class="tag-estimate-suffix">(估)</span><span class="tag-estimate-info" aria-hidden="true">ⓘ</span>' : '';
                const selectedBadge = isMatched ? '<span class="tag-user-condition">你的條件</span>' : '';
                
                tagsHtml += `<span class="${tagClass}"${titleAttr}><span class="tag-availability-icon" aria-hidden="true">${statusIcon}</span><span aria-hidden="true">${attributeIcons[attr] || '✨'}</span> <span class="tag-label">${attributeLabels[attr]}${suffix}</span>${selectedBadge}</span>`;
            }
        });
    
        if (!tagsHtml) {
            tagsHtml = '<div style="color: var(--text-muted); font-size: 0.9rem; font-style: italic;">未看到明確的親子友善資訊</div>';
        }
    
        const status = getDynamicStatus(restaurant, state.filters);
        const level = status.level;
        const displayLabel = status.label;
        const levelClass = status.class;
        
        // Calculate match count for detail view
        let matchCount = 0;
        const attributes_for_count = restaurant.attributes || {};
        if (state.filters && state.filters.size > 0) {
            state.filters.forEach(f => {
                if (isPositiveAttributeValue(attributes_for_count[f])) matchCount++;
            });
        }
        
        let summaryTags = getPFSummaryTags(restaurant, level, true);
        if (!state.filters || state.filters.size === 0) {
            summaryTags = '💡 評估依據：系統根據店家的親子硬體設備與環境進行綜合分析。';
        } else if (summaryTags) {
            if (summaryTags.startsWith('留意：')) {
                summaryTags = '⚠️ ' + summaryTags;
            } else if (summaryTags.startsWith('符合')) {
                summaryTags = '🔍 ' + summaryTags;
            } else if (summaryTags.startsWith('具備其他')) {
                summaryTags = '✨ ' + summaryTags;
            } else if (summaryTags.startsWith('目前整理資料未提及')) {
                summaryTags = 'ℹ️ ' + summaryTags;
            }
        }
    
        const isWholeCity = !isSpecificRestaurant && state.searchLocation && (state.searchLocation.type === '全市' || state.searchLocation.name === '整個台北市' || state.searchLocation.type === '多行政區');
        const times = (!isWholeCity && dist !== undefined) ? calculateTravelTimes(dist) : null;
        let timeHtml = '';
        if (times) {
            timeHtml = `
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <span style="background: #f1f5f9; padding: 0.25rem 0.6rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 600; color: #475569;">🚶/🚗 從${originLabel}步行約 ${times.walking} 分鐘、開車約 ${times.driving} 分鐘</span>
                </div>
            `;
        }
    
        const cleanAddrForMap = fixSimplifiedAddress(restaurant.address || '');
        let googleMapsUrl = restaurant.google_maps_url || restaurant.url;
        if (!googleMapsUrl) {
            const query = encodeURIComponent((restaurant.name || '') + ' ' + cleanAddrForMap);
            googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
        }
    
        const isApp = isInAppBrowser();
        const mapTarget = isApp ? '_self' : '_blank';
    
        const priceSymbol = getDisplayPriceSymbol(restaurant);
        const detailMetaParts = [];
        if (restaurant.cuisine) {
            detailMetaParts.push(restaurant.cuisine);
        }
        if (priceSymbol) {
            detailMetaParts.push(priceSymbol);
        }
        const detailMetaHtml = detailMetaParts.join(' <span class="card-meta-dot">·</span> ');
        const visitActionsHtml = buildVisitActionsHtml(restaurant, googleMapsUrl, mapTarget);
    
        detailContent.innerHTML = `
            <h1 style="margin-bottom: 0.5rem; color: var(--text-main);">${formatRestaurantName(restaurant.name || '未命名餐廳')}</h1>
            ${detailMetaHtml ? `<div class="restaurant-meta" style="font-size: 1.1rem; margin-bottom: 0.5rem;">${detailMetaHtml}</div>` : ''}
            <div class="restaurant-address" style="font-size: 0.9rem; margin-bottom: 0.85rem;">📍 ${fixSimplifiedAddress(restaurant.address || '')}</div>
            
            ${timeHtml}
    
            <div style="font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">親子友善建議</div>
            <div style="margin-bottom: 1.5rem;">
                <div class="decision-summary ${levelClass}">
                    <span class="status-dot"></span>
                    ${displayLabel}
                </div>
                ${summaryTags ? `<div class="summary-tags-text ${levelClass}" style="font-size: 0.85rem; font-weight: 600; margin-top: 0.5rem; line-height: 1.5;">${summaryTags}</div>` : ''}
            </div>
            
            <div style="font-weight: 700; margin-bottom: 0.35rem; color: var(--text-muted);">這間餐廳有的親子友善設施與環境</div>
            <div class="amenity-status-legend">✓ 已確認提供；標示「估」的項目為推估資料</div>
            <div class="tag-container" style="gap: 0.75rem; margin-bottom: 1.5rem;">
                ${tagsHtml}
            </div>
            <div id="estimated-tag-note" class="estimated-tag-note hidden" aria-live="polite">${ESTIMATED_ATTRIBUTE_TOOLTIP}</div>
    
            <div class="ai-summary" style="margin-bottom: 1.5rem;">
                <div class="ai-summary-header">
                    <div class="ai-summary-title">
                        AI親子用餐摘要
                        <button class="ai-summary-info-btn" id="ai-summary-info-btn" type="button" aria-label="查看摘要來源說明" aria-expanded="false" aria-controls="ai-summary-tooltip">i</button>
                    </div>
                </div>
                <div class="ai-summary-tooltip" id="ai-summary-tooltip" role="tooltip" hidden>AI 整理公開資訊後產生，部分內容經人工或使用者回饋校正，僅供參考。</div>
                <div class="ai-summary-text">${getDisplaySummary(restaurant, restaurant.ai_summary, { maxSentences: 4, maxChars: 360 }).replace(/\n/g, '<br>')}</div>
            </div>
    
            ${visitActionsHtml}
            
            <div class="detail-feedback-section" id="ai-summary-feedback-container" style="margin-top: 1.5rem; margin-bottom: 1.5rem; border-top: 1px solid #e2e8f0; padding-top: 1.25rem;">
                <div class="detail-feedback-heading">
                    <div class="detail-feedback-title">本頁資訊有幫助嗎？</div>
                </div>
                <div id="ai-feedback-options" style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem;">
                    <button class="feedback-vote-btn" id="btn-feedback-helpful" style="display: inline-flex; align-items: center; gap: 0.25rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--text-main); cursor: pointer; transition: all 0.2s;">
                        👍 有幫助
                    </button>
                    <button class="feedback-vote-btn" id="btn-feedback-unhelpful" style="display: inline-flex; align-items: center; gap: 0.25rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--text-main); cursor: pointer; transition: all 0.2s;">
                        👎 沒幫助
                    </button>
                    <button id="btn-trigger-feedback" class="btn-feedback-trigger compact inline-report">
                        <span>🚩</span> 回報/貢獻此餐廳資訊
                    </button>
                </div>
                <div id="ai-feedback-form-container" class="hidden" style="margin-top: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; font-size: 0.9rem; color: var(--text-main);">
                    <div style="font-weight: 700; margin-bottom: 0.75rem; color: #475569;">哪裡沒有幫助？</div>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                        <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                            <input type="checkbox" class="ai-feedback-issue" value="找不到符合需求的餐廳"> 找不到符合需求的餐廳
                        </label>
                        <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                            <input type="checkbox" class="ai-feedback-issue" value="餐廳資訊不夠完整"> 餐廳資訊不夠完整
                        </label>
                        <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                            <input type="checkbox" class="ai-feedback-issue" value="資料似乎不準確"> 資料似乎不準確
                        </label>
                        <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                            <input type="checkbox" class="ai-feedback-issue" value="缺少我在意的條件"> 缺少我在意的條件
                        </label>
                        <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                            <input type="checkbox" class="ai-feedback-issue" value="其他"> 其他
                        </label>
                    </div>
                    
                    <div style="font-weight: 700; margin-bottom: 0.5rem; color: #475569;">願意多告訴我一些嗎？（選填）</div>
                    <textarea id="ai-feedback-more-text" rows="3" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font-family: inherit; font-size: 0.9rem; margin-bottom: 1rem; box-sizing: border-box; resize: vertical;" placeholder="請輸入說明..."></textarea>
                    
                    <div style="font-weight: 700; margin-bottom: 0.5rem; color: #475569;">願意接受後續訪談嗎？（選填 Email）</div>
                    <input type="email" id="ai-feedback-email" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font-family: inherit; font-size: 0.9rem; margin-bottom: 1rem; box-sizing: border-box;" placeholder="example@email.com">
                    
                    <button class="btn btn-primary" id="btn-submit-ai-feedback" style="width: 100%; padding: 0.75rem; font-size: 0.9rem; font-weight: 700; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                        提交回饋
                    </button>
                </div>
                <div id="ai-feedback-thank-you" class="hidden" style="font-weight: 700; color: #16a34a; margin-top: 0.5rem; font-size: 0.95rem;">
                    感謝回饋！
                </div>
            </div>
    
    
        `;
    
        setupEstimatedTagToggles(detailContent);
        setupAiSummaryTooltip(detailContent);
    
        const detailFavBtn = document.getElementById('btn-detail-fav');
        if (detailFavBtn) {
            detailFavBtn.dataset.placeId = restaurant.place_id;
            const isNowFav = state.favorites.has(restaurant.place_id);
            detailFavBtn.classList.toggle('active', isNowFav);
            detailFavBtn.innerHTML = isNowFav ? '❤️' : '🤍';
            detailFavBtn.title = isNowFav ? '移出口袋名單' : '加入口袋名單';
        }
    
        bindVisitActionTracking(restaurant);
    
        const feedbackTriggerBtn = document.getElementById('btn-trigger-feedback');
        if (feedbackTriggerBtn) {
            feedbackTriggerBtn.onclick = () => {
                openFeedbackModal(restaurant);
            };
        }
    
        // AI Summary Feedback event listeners
        const btnHelpful = document.getElementById('btn-feedback-helpful');
        const btnUnhelpful = document.getElementById('btn-feedback-unhelpful');
        const feedbackOptions = document.getElementById('ai-feedback-options');
        const feedbackFormContainer = document.getElementById('ai-feedback-form-container');
        const feedbackThankYou = document.getElementById('ai-feedback-thank-you');
        const btnSubmitAiFeedback = document.getElementById('btn-submit-ai-feedback');
    
        if (btnHelpful) {
            btnHelpful.onclick = () => {
                trackAiSummaryFeedbackVote(restaurant, true);
                feedbackOptions.classList.add('hidden');
                feedbackThankYou.classList.remove('hidden');
                submitAiFeedback(true, [], '', '', restaurant);
            };
        }
    
        if (btnUnhelpful) {
            btnUnhelpful.onclick = () => {
                trackAiSummaryFeedbackVote(restaurant, false);
                feedbackOptions.classList.add('hidden');
                feedbackFormContainer.classList.remove('hidden');
            };
        }
    
        if (btnSubmitAiFeedback) {
            btnSubmitAiFeedback.onclick = async () => {
                const checkedIssues = [];
                document.querySelectorAll('.ai-feedback-issue:checked').forEach(cb => {
                    checkedIssues.push(cb.value);
                });
                const comment = document.getElementById('ai-feedback-more-text').value.trim();
                const email = document.getElementById('ai-feedback-email').value.trim();
    
                const originalBtnText = btnSubmitAiFeedback.innerHTML;
                btnSubmitAiFeedback.disabled = true;
                btnSubmitAiFeedback.innerHTML = '⌛ 提交中...';
    
                await submitAiFeedback(false, checkedIssues, comment, email, restaurant);
    
                btnSubmitAiFeedback.disabled = false;
                btnSubmitAiFeedback.innerHTML = originalBtnText;
    
                feedbackFormContainer.classList.add('hidden');
                feedbackThankYou.classList.remove('hidden');
                showToast('感謝您的寶貴回饋！');
            };
        }
    }

    return { renderDetailContent };
}
