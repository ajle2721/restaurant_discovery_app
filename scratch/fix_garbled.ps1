$appJsPath = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\app.js"
$content = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)

# Normalize CRLF
$contentLf = $content.Replace("`r`n", "`n")

# Target 1: Recommended Load More button text
$pattern1 = "loadMoreBtn\.className = 'btn-load-more';\s*loadMoreBtn\.textContent = '[^']+';"
$replacement1 = "loadMoreBtn.className = 'btn-load-more';`n            loadMoreBtn.textContent = '\u8f09\u5165\u66f4\u591a\u63a8\u85a6';"

# Target 2: Others Load More button text
# We can distinguish Target 2 because it's inside if (state.showOthers)
$pattern2 = "if \(state\.showOthers\) \{\s*const visibleOthers = others\.slice\(0, state\.othersLimit\);\s*visibleOthers\.forEach\(res => renderCard\(res, othersList, res\.dynamicLevel\)\);\s*if \(others\.length > state\.othersLimit\) \{\s*const loadMoreBtn = document\.createElement\('button'\);\s*loadMoreBtn\.className = 'btn-load-more';\s*loadMoreBtn\.textContent = '[^']+'"

$replacement2 = "if (state.showOthers) {`n            const visibleOthers = others.slice(0, state.othersLimit);`n            visibleOthers.forEach(res => renderCard(res, othersList, res.dynamicLevel));`n            if (others.length > state.othersLimit) {`n                const loadMoreBtn = document.createElement('button');`n                loadMoreBtn.className = 'btn-load-more';`n                loadMoreBtn.textContent = '\u8f09\u5165\u66f4\u591a\u9078\u9805'"

# Check matches first
if ($contentLf -match $pattern1) {
    $contentLf = $contentLf -replace $pattern1, $replacement1
    Write-Output "Fixed recommended button text."
} else {
    Write-Warning "Could not match pattern 1."
}

if ($contentLf -match $pattern2) {
    $contentLf = $contentLf -replace $pattern2, $replacement2
    Write-Output "Fixed others button text."
} else {
    Write-Warning "Could not match pattern 2."
}

# Restore CRLF
$contentFinal = $contentLf.Replace("`n", "`r`n")

[System.IO.File]::WriteAllText($appJsPath, $contentFinal, [System.Text.Encoding]::UTF8)
Write-Output "Completed."
