$baseDir = Get-Location
$responseDir = Join-Path $baseDir "response"
$aiReviewDir = Join-Path $baseDir "ai_review"

$posPatterns = @(
    "有包廂", "獨立包廂", "包廂很", "包廂[內裡外]", "小包廂", "大包廂", "包廂空間", 
    "包廂低消", "預訂包廂", "訂包廂", "個室", "獨立空間", "獨立區域", "包房",
    "可以包場", "提供包場", "有包場", "適合包場", "包場辦", "包場聚", "包場活動"
)

$negPatterns = @(
    "(沒有|無|未提供|不提供|不設|沒)包廂", "無提供包廂", "不設包廂",
    "(沒有|無|未提供|不提供|不開放|不設|沒)包場", "不能包場", "無法包場"
)

$responseFiles = Get-ChildItem -Path $responseDir -Filter "*.json"
$updatedCount = 0

Write-Host "🚀 正在掃描評論以識別包廂與包場空間..."

foreach ($file in $responseFiles) {
    $placeId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $aiPath = Join-Path $aiReviewDir "$placeId.json"
    
    if (-not (Test-Path $aiPath)) { continue }
    
    # Load AI Review
    $aiRaw = [System.IO.File]::ReadAllText($aiPath, [System.Text.Encoding]::UTF8)
    if ($aiRaw.StartsWith("`u{FEFF}")) { $aiRaw = $aiRaw.Substring(1) }
    $aiData = $aiRaw | ConvertFrom-Json
    
    # Check if already has a Yes with existing manual evidence
    if (Get-Member -InputObject $aiData -Name "has_private_room" -MemberType Properties) {
        if ($aiData.has_private_room -and $aiData.has_private_room.result -eq "Yes" -and $aiData.has_private_room.evidence) {
            continue
        }
    }
    
    # Load Response
    $respRaw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $respData = $respRaw | ConvertFrom-Json
    
    $reviews = $respData.reviews
    if (-not $reviews) { continue }
    
    $foundEvidence = $null
    $hasNegation = $false
    
    foreach ($r in $reviews) {
        $text = ""
        if ($r.originalText) { $text = $r.originalText.text }
        elseif ($r.text) { $text = $r.text.text }
        
        if (-not $text) { continue }
        
        # Split into sentences using common punctuation
        $sentences = $text -split "[。！!？?，,；;\n\r]"
        foreach ($s in $sentences) {
            $s = $s.Trim()
            if (-not $s) { continue }
            
            # Check negation
            $negMatch = $false
            foreach ($pat in $negPatterns) {
                if ($s -match $pat) {
                    $negMatch = $true
                    break
                }
            }
            if ($negMatch) {
                $hasNegation = $true
                continue
            }
            
            # Check positive
            $posMatch = $false
            foreach ($pat in $posPatterns) {
                if ($s -match $pat) {
                    $posMatch = $true
                    break
                }
            }
            if ($posMatch) {
                $foundEvidence = $s
                break
            }
        }
        if ($foundEvidence) { break }
    }
    
    if ($foundEvidence -and -not $hasNegation) {
        # Ensure has_private_room object exists or overwrite
        if (Get-Member -InputObject $aiData -Name "has_private_room" -MemberType Properties) {
            $aiData.has_private_room.result = "Yes"
            $aiData.has_private_room.evidence = $foundEvidence
            $aiData.has_private_room.confidence = 0.9
        } else {
            Add-Member -InputObject $aiData -NotePropertyName "has_private_room" -NotePropertyValue ([PSCustomObject]@{
                result = "Yes"
                evidence = $foundEvidence
                confidence = 0.9
            })
        }
        
        # Save back
        $jsonData = ConvertTo-Json -InputObject $aiData -Depth 10
        [System.IO.File]::WriteAllText($aiPath, $jsonData, [System.Text.Encoding]::UTF8)
        $updatedCount++
    }
}

Write-Host "✅ 完成！共更新了 $updatedCount 間餐廳的『包廂或可包場』屬性。"
