import { trackEvent } from "../analytics/events.js";
import { isPositiveAttributeValue } from "../restaurants/attributes.js";
import { state } from "../state/app-state.js";

const WEB3FORMS_ACCESS_KEY = "c7b3994f-f590-4126-a12f-111c28c58a19";

export function createFeedbackController({ getLocationContext, showToast }) {
    function openFeedbackModal(restaurant) {
        if (!restaurant) return;
        trackEvent('open_feedback_modal', { restaurant_name: restaurant.name });
        
        const modalOverlay = document.getElementById('feedback-modal-overlay');
        const modal = document.getElementById('feedback-modal');
        const nameInput = document.getElementById('feedback-restaurant-name');
        const idInput = document.getElementById('feedback-restaurant-id');
        const descriptionTextarea = document.getElementById('feedback-description');
        const emailInput = document.getElementById('feedback-email');
        const contextInput = document.getElementById('feedback-context');
        const title = modal ? modal.querySelector('.modal-title') : null;
        const subtitle = modal ? modal.querySelector('.modal-subtitle') : null;

        // Prefill
        if (title) title.textContent = '🚩 協助回報與貢獻資訊';
        if (subtitle) subtitle.textContent = '如果您有更準確的親子友善資訊，或發現內容有誤，歡迎協助回報與補充！';
        if (nameInput) {
            nameInput.value = restaurant.name || '';
            nameInput.placeholder = '';
            nameInput.readOnly = true;
            nameInput.classList.add('readonly');
        }
        if (idInput) idInput.value = restaurant.place_id || '';
        if (contextInput) contextInput.value = 'restaurant_update';
        if (descriptionTextarea) {
            descriptionTextarea.placeholder = '請協助描述更詳細的狀況，例如：店內只有兩張兒童椅、尿布台在女廁等，這能幫助我們更快審查...';
        }

        // Dynamically render issue checkboxes based on restaurant's current attributes
        const attrs = restaurant.attributes || {};
        const issueGrid = document.getElementById('feedback-issue-grid');
        if (issueGrid) {
            const specs = [
                {
                    key: 'has_tableware',
                    emoji: '🍽️',
                    yesLabel: '實際上無兒童餐具',
                    yesValue: '實際上無提供兒童餐具',
                    noLabel: '其實有兒童餐具',
                    noValue: '其實有提供兒童餐具'
                },
                {
                    key: 'high_chair_available',
                    emoji: '🪑',
                    yesLabel: '實際上無兒童椅',
                    yesValue: '實際上無提供兒童椅',
                    noLabel: '其實有兒童椅',
                    noValue: '其實有提供兒童椅'
                },
                {
                    key: 'has_diaper_table',
                    emoji: '🍼',
                    yesLabel: '實際上無尿布台',
                    yesValue: '實際上無尿布台',
                    noLabel: '其實有尿布台',
                    noValue: '其實有尿布台'
                },
                {
                    key: 'kids_menu',
                    emoji: '🥘',
                    yesLabel: '實際上無兒童餐',
                    yesValue: '實際上無提供兒童餐',
                    noLabel: '其實有兒童餐',
                    noValue: '其實有提供兒童餐'
                },
                {
                    key: 'kid_noise_tolerant',
                    emoji: '🥳',
                    yesLabel: '實際上氣氛安靜需留意',
                    yesValue: '實際上氣氛安靜不適合吵鬧',
                    noLabel: '其實環境不怕吵鬧',
                    noValue: '其實環境不怕吵鬧'
                },
                {
                    key: 'spacious_seating',
                    emoji: '🛋️',
                    yesLabel: '實際上空間較狹窄',
                    yesValue: '實際上空間較狹窄',
                    noLabel: '其實空間寬敞',
                    noValue: '其實空間寬敞'
                },
                {
                    key: 'has_play_area',
                    emoji: '🧸',
                    yesLabel: '實際上無遊樂區',
                    yesValue: '實際上無遊樂區',
                    noLabel: '其實有遊樂區',
                    noValue: '其實有遊樂區'
                },
                {
                    key: 'has_private_room',
                    emoji: '🚪',
                    yesLabel: '實際上無包廂且不可包場',
                    yesValue: '實際上無包廂且不可包場',
                    noLabel: '其實有包廂或可包場',
                    noValue: '其實有包廂或可包場'
                }
            ];

            let gridHtml = '';
            specs.forEach(spec => {
                const hasFeature = isPositiveAttributeValue(attrs[spec.key]);
                const label = hasFeature ? spec.yesLabel : spec.noLabel;
                const value = hasFeature ? spec.yesValue : spec.noValue;
                gridHtml += `
                    <label class="checkbox-label">
                        <input type="checkbox" class="feedback-issue-cb" value="${value}"> ${spec.emoji} ${label}
                    </label>
                `;
            });

            // Add static options: closed/moved and other
            gridHtml += `
                <label class="checkbox-label text-danger">
                    <input type="checkbox" class="feedback-issue-cb" value="餐廳已歇業或搬遷"> ⚠️ 餐廳已歇業/搬遷
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" class="feedback-issue-cb" value="其他"> 💬 其他建議或補充
                </label>
            `;

            issueGrid.innerHTML = gridHtml;
        }
        
        // Clear form text inputs
        if (descriptionTextarea) descriptionTextarea.value = '';
        if (emailInput) emailInput.value = '';
        
        // Show Modal
        if (modalOverlay) modalOverlay.classList.add('active');
        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock scrolling
    }

    function openContributionModal() {
        trackEvent('open_contribution_modal', {
            current_view: state.view,
            location_context: getLocationContext()
        });

        const modalOverlay = document.getElementById('feedback-modal-overlay');
        const modal = document.getElementById('feedback-modal');
        const nameInput = document.getElementById('feedback-restaurant-name');
        const idInput = document.getElementById('feedback-restaurant-id');
        const contextInput = document.getElementById('feedback-context');
        const descriptionTextarea = document.getElementById('feedback-description');
        const emailInput = document.getElementById('feedback-email');
        const issueGrid = document.getElementById('feedback-issue-grid');
        const title = modal ? modal.querySelector('.modal-title') : null;
        const subtitle = modal ? modal.querySelector('.modal-subtitle') : null;

        if (title) title.textContent = '貢獻台北市親子友善餐廳';
        if (subtitle) subtitle.textContent = '推薦你知道的餐廳，並勾選實際符合的親子友善條件。';
        if (nameInput) {
            nameInput.value = '';
            nameInput.placeholder = '請輸入餐廳名稱或分店名稱';
            nameInput.readOnly = false;
            nameInput.classList.remove('readonly');
        }
        if (idInput) idInput.value = '';
        if (contextInput) contextInput.value = 'restaurant_contribution';
        if (descriptionTextarea) {
            descriptionTextarea.value = '';
            descriptionTextarea.placeholder = '例如：地址、分店、你實際看到的設施、適合幾歲小孩，或任何補充資訊...';
        }
        if (emailInput) emailInput.value = '';

        if (issueGrid) {
            const options = [
                ['有兒童餐具', '🍽️'],
                ['有兒童椅', '🪑'],
                ['有尿布台', '🍼'],
                ['有兒童餐', '🥘'],
                ['環境不怕小孩吵', '🥳'],
                ['空間寬敞', '🛋️'],
                ['有遊樂區', '🧸'],
                ['有包廂或可包場', '🚪'],
                ['我不確定，想先推薦店家', '💬']
            ];

            issueGrid.innerHTML = options.map(([value, emoji]) => `
                <label class="checkbox-label">
                    <input type="checkbox" class="feedback-issue-cb" value="${value}"> ${emoji} ${value}
                </label>
            `).join('');
        }

        if (modalOverlay) modalOverlay.classList.add('active');
        if (modal) modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeFeedbackModal() {
        const modalOverlay = document.getElementById('feedback-modal-overlay');
        const modal = document.getElementById('feedback-modal');
        
        if (modalOverlay) modalOverlay.classList.remove('active');
        if (modal) modal.classList.remove('active');
        
        // Restore scrolling only if detail view is NOT active
        if (state.view !== 'detail') {
            document.body.style.overflow = '';
        }
    }

    function openSiteFeedbackModal() {
        trackEvent('open_site_feedback_modal', {
            current_view: state.view,
            location_context: getLocationContext(),
            has_filters: state.filters && state.filters.size > 0 ? 'yes' : 'no'
        });

        const modalOverlay = document.getElementById('site-feedback-modal-overlay');
        const modal = document.getElementById('site-feedback-modal');
        const form = document.getElementById('site-feedback-form');

        if (form) form.reset();
        if (modalOverlay) modalOverlay.classList.add('active');
        if (modal) {
            modal.classList.add('active');
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            modal.style.transform = window.matchMedia('(max-width: 600px)').matches
                ? 'translateY(0)'
                : 'translate(-50%, -50%) scale(1)';
        }
        document.body.style.overflow = 'hidden';
    }

    function closeSiteFeedbackModal() {
        const modalOverlay = document.getElementById('site-feedback-modal-overlay');
        const modal = document.getElementById('site-feedback-modal');

        if (modalOverlay) modalOverlay.classList.remove('active');
        if (modal) {
            modal.classList.remove('active');
            modal.style.opacity = '';
            modal.style.visibility = '';
            modal.style.transform = '';
        }

        if (state.view !== 'detail') {
            document.body.style.overflow = '';
        }
    }

    async function handleSiteFeedbackSubmit(e) {
        e.preventDefault();

        const form = e.currentTarget;
        const submitBtn = document.getElementById('btn-submit-site-feedback');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '送出回饋';
        const ratingInput = form.querySelector('input[name="site-feedback-rating"]:checked');
        const comment = document.getElementById('site-feedback-comment')?.value.trim() || '';
        const honeypot = form.querySelector('.hidden-honeypot');

        if (!ratingInput) {
            alert('請先選擇 1-5 分的好用度評分。');
            return;
        }

        if (honeypot && honeypot.checked) {
            console.warn('Bot detected');
            closeSiteFeedbackModal();
            return;
        }

        const rating = ratingInput.value;

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '送出中...';
            }

            const formData = new URLSearchParams();
            formData.append('access_key', WEB3FORMS_ACCESS_KEY);
            formData.append('name', '親子餐廳地圖 - 使用回饋');
            formData.append('subject', `使用回饋：好用度 ${rating}/5`);
            formData.append('feedback_type', 'site_usability');
            formData.append('helpfulness_rating', rating);
            formData.append('comment', comment);
            formData.append('current_view', state.view || '');
            formData.append('location_context', getLocationContext());
            formData.append('active_filters', Array.from(state.filters || []).join(', '));
            formData.append('shortlist_count', state.favorites ? String(state.favorites.size) : '0');
            formData.append('page_url', window.location.href);

            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData.toString()
            });

            const result = await response.json();

            if (response.ok && result.success) {
                trackEvent('submit_site_feedback_form', {
                    helpfulness_rating: rating,
                    has_comment: comment ? 'yes' : 'no',
                    current_view: state.view,
                    location_context: getLocationContext()
                });
                showToast('謝謝你的回饋，會用來繼續改善這個工具。');
                closeSiteFeedbackModal();
            } else {
                throw new Error(result.message || '送出失敗');
            }
        } catch (err) {
            console.error('Error submitting site feedback:', err);
            alert('送出失敗：' + err.message + '\n\n請稍後再試一次。');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    }

    async function handleFeedbackSubmit(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('btn-submit-feedback');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '提交回報';
        
        // Collect checked issues
        const checkedIssues = [];
        document.querySelectorAll('.feedback-issue-cb:checked').forEach(cb => {
            checkedIssues.push(cb.value);
        });
        
        const description = document.getElementById('feedback-description').value.trim();
        const email = document.getElementById('feedback-email').value.trim();
        const restaurantName = document.getElementById('feedback-restaurant-name').value.trim();
        const restaurantId = document.getElementById('feedback-restaurant-id').value;
        const feedbackContext = document.getElementById('feedback-context')?.value || 'restaurant_update';
        const isContribution = feedbackContext === 'restaurant_contribution';

        if (!restaurantName) {
            alert('請先輸入餐廳名稱。');
            return;
        }

        // Validation: Must select at least one issue, OR write a description
        if (checkedIssues.length === 0 && !description) {
            alert(isContribution ? '請至少勾選一個符合條件，或填寫補充說明！' : '請至少選擇一個欲回報或補充的項目，或填寫具體說明！');
            return;
        }

        // Spam honeypot check
        const honeypot = e.currentTarget.querySelector('.hidden-honeypot');
        if (honeypot && honeypot.checked) {
            console.warn('Bot detected');
            closeFeedbackModal();
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⌛ 提交中...';
            }

            // Construct form data payload for Web3Forms to prevent CORS preflight and PWA spam filters
            const formData = new URLSearchParams();
            formData.append('access_key', WEB3FORMS_ACCESS_KEY);
            formData.append('name', isContribution ? '親子餐廳地圖 - 新餐廳貢獻' : '親子餐廳地圖 - 資訊回報與貢獻');
            formData.append('subject', `${isContribution ? '貢獻新餐廳' : '🚩 餐廳資訊更新回報'}: ${restaurantName}`);
            formData.append('feedback_type', feedbackContext);
            formData.append('restaurant_name', restaurantName);
            formData.append('restaurant_id', restaurantId);
            formData.append(isContribution ? 'matched_conditions' : 'issues', checkedIssues.join(', '));
            formData.append('description', description);
            formData.append('page_url', window.location.href);
            if (email) {
                formData.append('email', email);
            }

            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData.toString()
            });

            const result = await response.json();

            if (response.ok && result.success) {
                trackEvent(isContribution ? 'submit_contribution_form' : 'submit_feedback_form', {
                    restaurant_name: restaurantName,
                    feedback_type: feedbackContext,
                    issue_count: checkedIssues.length,
                    has_description: description ? 'yes' : 'no',
                    has_email: email ? 'yes' : 'no'
                });
                showToast(isContribution ? '謝謝你的推薦！我們會核實後加入名單。' : '感謝您的回報與貢獻！我們會核實並儘快更新。');
                closeFeedbackModal();
            } else {
                throw new Error(result.message || '伺服器回應異常');
            }
        } catch (err) {
            console.error('Error submitting feedback:', err);
            alert('提交失敗：' + err.message + '\n\n【排查提示】\n如果您在手機上測試時使用的是局域網 IP (如 192.168.x.x) 或直接開檔案測試，Web3Forms 安全機制可能會因為網域不符而拒絕傳送。請部署至 GitHub Pages 後再在正式網址上測試，即可正常使用！');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    }

    async function submitAiFeedback(isHelpful, checkedIssues, comment, email, restaurant) {
        try {
            const formData = new URLSearchParams();
            formData.append('access_key', WEB3FORMS_ACCESS_KEY);
            formData.append('name', '親子餐廳地圖 - 詳情頁面意見回饋');
            formData.append('subject', `${isHelpful ? '👍' : '👎'} 詳情頁面回饋: ${restaurant.name || '未命名餐廳'}`);
            formData.append('restaurant_name', restaurant.name || '未命名餐廳');
            formData.append('restaurant_id', restaurant.place_id || '');
            formData.append('is_helpful', isHelpful ? '有幫助' : '沒幫助');
            if (!isHelpful) {
                formData.append('issues', checkedIssues.join(', ') || '無');
                formData.append('comment', comment || '無');
            }
            if (email) {
                formData.append('email', email);
            }

            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData.toString()
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                console.error('AI Feedback server error:', result.message);
            }
        } catch (err) {
            console.error('Error submitting AI feedback:', err);
        }
    }

    function handleHomeFeedbackLinkClick(e) {
        if (e.defaultPrevented) return;
        const link = e.target.closest('[data-home-feedback-action]');
        if (!link) return;

        e.preventDefault();
        const action = link.dataset.homeFeedbackAction;
        if (action === 'contribute') {
            openContributionModal();
        } else if (action === 'site-feedback') {
            openSiteFeedbackModal();
        }
    }

    return {
        closeFeedbackModal,
        closeSiteFeedbackModal,
        handleFeedbackSubmit,
        handleHomeFeedbackLinkClick,
        handleSiteFeedbackSubmit,
        openContributionModal,
        openFeedbackModal,
        openSiteFeedbackModal,
        submitAiFeedback,
    };
}
