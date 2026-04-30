$aiReviewDir = "ai_review"
$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        if ($raw -like "*較不適合怕吵的親子客群*") {
            $newRaw = $raw.Replace("較不適合怕吵的親子客群", "較不適合怕太安靜的親子客群")
            [System.IO.File]::WriteAllText($file.FullName, $newRaw, [System.Text.Encoding]::UTF8)
            Write-Host "Fixed contradictory phrase in $($file.Name)"
        }
    } catch { }
}