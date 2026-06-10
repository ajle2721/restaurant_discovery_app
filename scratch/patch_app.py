import os

app_js_path = r"c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\app.js"

with open(app_js_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Reset limits in selectLocation
old_select = """function selectLocation(loc, source = 'other', pushState = true) {
    state.searchLocation = loc;
    state.showOthers = false; // Reset to only show High+Medium results on new search
    state.expandedRadius = false; // Reset search range expansion
    searchInput.value = loc.name;"""

new_select = """function selectLocation(loc, source = 'other', pushState = true) {
    state.searchLocation = loc;
    state.showOthers = false; // Reset to only show High+Medium results on new search
    state.expandedRadius = false; // Reset search range expansion
    state.recommendedLimit = 30; // Reset pagination limit
    state.othersLimit = 30; // Reset pagination limit
    searchInput.value = loc.name;"""

content = content.replace(old_select, new_select)
content = content.replace(old_select.replace("\n", "\r\n"), new_select.replace("\n", "\r\n"))

# 2. Reset limits in Filter Chips listener
old_filter = """            if (state.filters.has(filter)) {
                state.filters.delete(filter);
                chip.classList.remove('active');
                action = 'deselect';
            } else {
                state.filters.add(filter);
                chip.classList.add('active');
            }
            
            // Toggle active state in UI instantly, then defer heavy search execution"""

new_filter = """            if (state.filters.has(filter)) {
                state.filters.delete(filter);
                chip.classList.remove('active');
                action = 'deselect';
            } else {
                state.filters.add(filter);
                chip.classList.add('active');
            }
            
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            
            // Toggle active state in UI instantly, then defer heavy search execution"""

content = content.replace(old_filter, new_filter)
content = content.replace(old_filter.replace("\n", "\r\n"), new_filter.replace("\n", "\r\n"))

# 3. Reset limits in Clear All Filters
old_clear_filters = """    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            state.filters.clear();
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            
            // Reset active states in UI instantly, then defer heavy search execution"""

new_clear_filters = """    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            state.filters.clear();
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            
            // Reset active states in UI instantly, then defer heavy search execution"""

content = content.replace(old_clear_filters, new_clear_filters)
content = content.replace(old_clear_filters.replace("\n", "\r\n"), new_clear_filters.replace("\n", "\r\n"))

# 4. Reset limits in Reset Search
old_reset_search = """    // Reset Search
    resetSearchBtn.addEventListener('click', () => {
        state.searchLocation = null;
        state.userLocation = null;
        state.filters.clear();
        state.hideLowQualityMarkers = true; // Reset to default: hide low quality
        state.showOthers = false; // Reset to default: hide others list"""

new_reset_search = """    // Reset Search
    resetSearchBtn.addEventListener('click', () => {
        state.searchLocation = null;
        state.userLocation = null;
        state.filters.clear();
        state.hideLowQualityMarkers = true; // Reset to default: hide low quality
        state.showOthers = false; // Reset to default: hide others list
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit"""

content = content.replace(old_reset_search, new_reset_search)
content = content.replace(old_reset_search.replace("\n", "\r\n"), new_reset_search.replace("\n", "\r\n"))

# 5. Reset limits in syncStateFromUrl
old_sync = """    if (!searchStateMatches) {
        console.log('Syncing search state from URL...');
        // 2. 恢復過濾條件
        state.filters.clear();
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));"""

new_sync = """    if (!searchStateMatches) {
        console.log('Syncing search state from URL...');
        // 2. 恢復過濾條件
        state.filters.clear();
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));"""

content = content.replace(old_sync, new_sync)
content = content.replace(old_sync.replace("\n", "\r\n"), new_sync.replace("\n", "\r\n"))

# 6. Reset limits in btnExpand
old_expand = """                const btnExpand = document.getElementById('btn-expand-search');
                if (btnExpand) {
                    btnExpand.onclick = (e) => {
                        e.preventDefault();
                        state.expandedRadius = true;
                        renderResults();
                    };
                }"""

new_expand = """                const btnExpand = document.getElementById('btn-expand-search');
                if (btnExpand) {
                    btnExpand.onclick = (e) => {
                        e.preventDefault();
                        state.expandedRadius = true;
                        state.recommendedLimit = 30; // Reset pagination limit
                        state.othersLimit = 30; // Reset pagination limit
                        renderResults();
                    };
                }"""

content = content.replace(old_expand, new_expand)
content = content.replace(old_expand.replace("\n", "\r\n"), new_expand.replace("\n", "\r\n"))

# 7. Reset limit in Toggle Others event handler
old_toggle_others = """        state.showOthers = !state.showOthers;
        state.hideLowQualityMarkers = !state.showOthers; // Sync map toggle with list expansion
        if (hideMarkersToggle) hideMarkersToggle.checked = state.hideLowQualityMarkers;
        
        // Toggle expansion instantly, then defer heavy rendering
        setTimeout(() => {
            renderResults();
        }, 20);"""

new_toggle_others = """        state.showOthers = !state.showOthers;
        state.hideLowQualityMarkers = !state.showOthers; // Sync map toggle with list expansion
        if (hideMarkersToggle) hideMarkersToggle.checked = state.hideLowQualityMarkers;
        
        // Reset othersLimit when toggled
        state.othersLimit = 30;
        
        // Toggle expansion instantly, then defer heavy rendering
        setTimeout(() => {
            renderResults();
        }, 20);"""

content = content.replace(old_toggle_others, new_toggle_others)
content = content.replace(old_toggle_others.replace("\n", "\r\n"), new_toggle_others.replace("\n", "\r\n"))

# 8. Render split, lazy rendering, and pagination
old_render = """        state.currentResults = sorted; 

        recommended.forEach(res => renderCard(res, recommendedList, res.dynamicLevel));
        others.forEach(res => renderCard(res, othersList, res.dynamicLevel));"""

new_render = """        state.currentResults = sorted; 

        // Render recommended cards up to the recommendedLimit
        const visibleRecommended = recommended.slice(0, state.recommendedLimit);
        visibleRecommended.forEach(res => renderCard(res, recommendedList, res.dynamicLevel));

        // If there are more recommended items, render the Load More button
        if (recommended.length > state.recommendedLimit) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'btn-load-more';
            loadMoreBtn.textContent = '載入更多推薦';
            loadMoreBtn.addEventListener('click', () => {
                trackEvent('click_load_more_recommended', {
                    current_limit: state.recommendedLimit,
                    total_count: recommended.length
                });
                state.recommendedLimit += 30;
                renderResults();
            });
            recommendedList.appendChild(loadMoreBtn);
        }

        // Lazy Rendering of others list based on state.showOthers
        if (state.showOthers) {
            const visibleOthers = others.slice(0, state.othersLimit);
            visibleOthers.forEach(res => renderCard(res, othersList, res.dynamicLevel));

            // If there are more others items, render the Load More button
            if (others.length > state.othersLimit) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'btn-load-more';
                loadMoreBtn.textContent = '載入更多選項';
                loadMoreBtn.addEventListener('click', () => {
                    trackEvent('click_load_more_others', {
                        current_limit: state.othersLimit,
                        total_count: others.length
                    });
                    state.othersLimit += 30;
                    renderResults();
                });
                othersList.appendChild(loadMoreBtn);
            }
        }"""

content = content.replace(old_render, new_render)
content = content.replace(old_render.replace("\n", "\r\n"), new_render.replace("\n", "\r\n"))

with open(app_js_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully.")
