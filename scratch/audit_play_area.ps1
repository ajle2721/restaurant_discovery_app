$ai_dir = "ai_review"
$resp_dir = "response"
$files = Get-ChildItem -Path $ai_dir -Filter *.json
$found = @()

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding utf8
        $data = ConvertFrom-Json $content
        
        $pa = $data.has_play_area
        if ($pa -and $pa.result -eq "Yes") {
            $respPath = Join-Path $resp_dir $file.Name
            $name = ""
            if (Test-Path $respPath) {
                $respRaw = Get-Content $respPath -Raw -Encoding utf8
                $respData = ConvertFrom-Json $respRaw
                $name = $respData.displayName.text
            }
            
            $found += [PSCustomObject]@{
                File = $file.Name
                Name = $name
                Result = $pa.result
                Evidence = $pa.evidence
                Confidence = $pa.confidence
            }
        }
    } catch {
        # Ignore
    }
}

Write-Output "Restaurants with Play Area set to Yes:"
$found | Format-List
