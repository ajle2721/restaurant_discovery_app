$aiReviewDir = "ai_review"
$responseDir = "response"
$outputPath = Join-Path $aiReviewDir "index.js"

$files = Get-ChildItem -Path $aiReviewDir -Filter "*.json" | Where-Object { $_.Name -ne "index.js" -and $_.Name -ne "index_new.js" }
foreach ($file in $files) {
    if ($file.Name -eq "ChIJo5uKl5ipQjQRUDGwOBCHUWs.json") {
        Write-Host "Found file: $($file.FullName)"
        $aiRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        try {
            $aiData = $aiRaw | ConvertFrom-Json
            Write-Host "Parsed AI Data"
            $respPath = Join-Path $responseDir $file.Name
            if (Test-Path $respPath) {
                Write-Host "Found Response File"
                $respRaw = [System.IO.File]::ReadAllText($respPath, [System.Text.Encoding]::UTF8)
                $respData = $respRaw | ConvertFrom-Json
                Write-Host "Parsed Response Data"
            } else {
                Write-Host "Response File NOT FOUND"
            }
        } catch {
            Write-Host "ERROR Parsing JSON: $_"
        }
    }
}