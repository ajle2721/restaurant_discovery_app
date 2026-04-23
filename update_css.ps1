# Append/Modify specific styles to the end of style.css
$cssRaw = [System.IO.File]::ReadAllText("c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\style.css", [System.Text.Encoding]::UTF8)

$newStyles = @"

/* --- New UI Styles --- */

.quick-filters-container {
    background: var(--bg-color);
    padding: 1.5rem 1.5rem 0.5rem;
    position: sticky;
    top: 0;
    z-index: 101;
}

.quick-filters-label {
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--text-main);
    margin-bottom: 0.75rem;
}

.quick-filters-scroll {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
    padding-bottom: 0.5rem;
}

.quick-filters-scroll::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
}

.quick-chip {
    flex: 0 0 auto;
    padding: 0.5rem 0.8rem;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 2rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    transition: var(--transition);
}

.quick-chip.active {
    background: var(--secondary);
    color: white;
    border-color: var(--secondary);
}

.decision-reason {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
}

.level-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 800;
    color: white;
}

.level-high { background: #4FB3AA; }
.level-mid { background: #FFB347; }
.level-low { background: #CBD5E1; color: #475569; }

.reason-text {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--secondary);
}

.distance-badge {
    background: #F1F5F9;
    color: #475569;
    padding: 0.2rem 0.6rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 700;
}

/* Fix sticky header */
.filter-section {
    padding-top: 0.5rem;
}

"@

$cssRaw += $newStyles
[System.IO.File]::WriteAllText("c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\style.css", $cssRaw, [System.Text.Encoding]::UTF8)
