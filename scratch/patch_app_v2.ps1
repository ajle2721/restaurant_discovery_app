$appJsPath = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\app.js"
$content = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)

# Normalize content to LF for matching
$contentLf = $content.Replace("`r`n", "`n")

# 1. Add limits to state
$old_state = "    isUiNavigation: false,
    expandedRadius: false,
    detailViews: new Set(JSON.parse(sessionStorage.getItem('pwa_detail_views') || '[]'))
};"

$new_state = "    isUiNavigation: false,
    expandedRadius: false,
    recommendedLimit: 30,
    othersLimit: 30,
    detailViews: new Set(JSON.parse(sessionStorage.getItem('pwa_detail_views') || '[]'))
};"

$contentLf = $contentLf.Replace($old_state.Replace("`r`n", "`n"), $new_state.Replace("`r`n", "`n"))

# 2. Reset limits in selectLocation
$old_select = "function selectLocation(loc, source = 'other', pushState = true) {
    state.searchLocation = loc;
    state.showOthers = false; // Reset to only show High+Medium results on new search
    state.expandedRadius = false; // Reset search range expansion
    searchInput.value = loc.name;"

$new_select = "function selectLocation(loc, source = 'other', pushState = true) {
    state.searchLocation = loc;
    state.showOthers = false; // Reset to only show High+Medium results on new search
    state.expandedRadius = false; // Reset search range expansion
    state.recommendedLimit = 30; // Reset pagination limit
    state.othersLimit = 30; // Reset pagination limit
    searchInput.value = loc.name;"

$contentLf = $contentLf.Replace($old_select.Replace("`r`n", "`n"), $new_select.Replace("`r`n", "`n"))

# 3. Reset limits in Filter Chips listener
$old_filter = "            if (state.filters.has(filter)) {
                state.filters.delete(filter);
                chip.classList.remove('active');
                action = 'deselect';
            } else {
                state.filters.add(filter);
                chip.classList.add('active');
            }
            
            // Toggle active state in UI instantly, then defer heavy search execution"

$new_filter = "            if (state.filters.has(filter)) {
                state.filters.delete(filter);
                chip.classList.remove('active');
                action = 'deselect';
            } else {
                state.filters.add(filter);
                chip.classList.add('active');
            }
            
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            
            // Toggle active state in UI instantly, then defer heavy search execution"

$contentLf = $contentLf.Replace($old_filter.Replace("`r`n", "`n"), $new_filter.Replace("`r`n", "`n"))

# 4. Reset limits in Clear All Filters
$old_clear_filters = "    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            state.filters.clear();
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            
            // Reset active states in UI instantly, then defer heavy search execution"

$new_clear_filters = "    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            state.filters.clear();
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            state.recommendedLimit = 30; // Reset pagination limit
            state.othersLimit = 30; // Reset pagination limit
            
            // Reset active states in UI instantly, then defer heavy search execution"

$contentLf = $contentLf.Replace($old_clear_filters.Replace("`r`n", "`n"), $new_clear_filters.Replace("`r`n", "`n"))

# 5. Reset limits in Reset Search
$old_reset_search = "    // Reset Search
    resetSearchBtn.addEventListener('click', () => {
        state.searchLocation = null;
        state.userLocation = null;
        state.filters.clear();
        state.hideLowQualityMarkers = true; // Reset to default: hide low quality
        state.showOthers = false; // Reset to default: hide others list"

$new_reset_search = "    // Reset Search
    resetSearchBtn.addEventListener('click', () => {
        state.searchLocation = null;
        state.userLocation = null;
        state.filters.clear();
        state.hideLowQualityMarkers = true; // Reset to default: hide low quality
        state.showOthers = false; // Reset to default: hide others list
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit"

$contentLf = $contentLf.Replace($old_reset_search.Replace("`r`n", "`n"), $new_reset_search.Replace("`r`n", "`n"))

# 6. Reset limits in syncStateFromUrl
# Match without non-ASCII characters to avoid encoding issues
$old_sync = "    if (!searchStateMatches) {
        console.log('Syncing search state from URL...');"

$new_sync = "    if (!searchStateMatches) {
        console.log('Syncing search state from URL...');
        state.recommendedLimit = 30; // Reset pagination limit
        state.othersLimit = 30; // Reset pagination limit"

$contentLf = $contentLf.Replace($old_sync.Replace("`r`n", "`n"), $new_sync.Replace("`r`n", "`n"))

# 7. Reset limits in btnExpand
$old_expand = "                const btnExpand = document.getElementById('btn-expand-search');
                if (btnExpand) {
                    btnExpand.onclick = (e) => {
                        e.preventDefault();
                        state.expandedRadius = true;
                        renderResults();
                    };
                }"

$new_expand = "                const btnExpand = document.getElementById('btn-expand-search');
                if (btnExpand) {
                    btnExpand.onclick = (e) => {
                        e.preventDefault();
                        state.expandedRadius = true;
                        state.recommendedLimit = 30; // Reset pagination limit
                        state.othersLimit = 30; // Reset pagination limit
                        renderResults();
                    };
                }"

$contentLf = $contentLf.Replace($old_expand.Replace("`r`n", "`n"), $new_expand.Replace("`r`n", "`n"))

# 8. Reset limit in Toggle Others event handler
$old_toggle_others = "        state.showOthers = !state.showOthers;
        state.hideLowQualityMarkers = !state.showOthers; // Sync map toggle with list expansion
        if (hideMarkersToggle) hideMarkersToggle.checked = state.hideLowQualityMarkers;
        
        // Toggle expansion instantly, then defer heavy rendering
        setTimeout(() => {
            renderResults();
        }, 20);"

$new_toggle_others = "        state.showOthers = !state.showOthers;
        state.hideLowQualityMarkers = !state.showOthers; // Sync map toggle with list expansion
        if (hideMarkersToggle) hideMarkersToggle.checked = state.hideLowQualityMarkers;
        
        // Reset othersLimit when toggled
        state.othersLimit = 30;
        
        // Toggle expansion instantly, then defer heavy rendering
        setTimeout(() => {
            renderResults();
        }, 20);"

$contentLf = $contentLf.Replace($old_toggle_others.Replace("`r`n", "`n"), $new_toggle_others.Replace("`r`n", "`n"))

# 9. Render split, lazy rendering, and pagination
$old_render = "        state.currentResults = sorted; 

        recommended.forEach(res => renderCard(res, recommendedList, res.dynamicLevel));
        others.forEach(res => renderCard(res, othersList, res.dynamicLevel));"

$new_render = "        state.currentResults = sorted; 

        // Render recommended cards up to the recommendedLimit
        const visibleRecommended = recommended.slice(0, state.recommendedLimit);
        visibleRecommended.forEach(res => renderCard(res, recommendedList, res.dynamicLevel));

        // If there are more recommended items, render the Load More button
        if (recommended.length > state.recommendedLimit) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'btn-load-more';
            loadMoreBtn.textContent = '\u8f09\u5165\u66f4\u591a\u63a8\u85a6';
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
                loadMoreBtn.textContent = '\u8f09\u5165\u66f4\u591a\u9078\u9805';
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
        }"

$contentLf = $contentLf.Replace($old_render.Replace("`r`n", "`n"), $new_render.Replace("`r`n", "`n"))

# Restore CRLF
$contentFinal = $contentLf.Replace("`n", "`r`n")

[System.IO.File]::WriteAllText($appJsPath, $contentFinal, [System.Text.Encoding]::UTF8)
Write-Host "Done patching app.js!"
