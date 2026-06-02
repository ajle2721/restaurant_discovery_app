$baseDir = Get-Location
$responseDir = Join-Path $baseDir "response"
$aiReviewDir = Join-Path $baseDir "ai_review"

# Positive patterns using Unicode escapes:
# \u5305\u5ec2 = 包廂
# \u5305\u5834 = 包場
# \u7368\u7acb\u7a7a\u9593 = 獨立空間
# \u7368\u7acb\u5340\u57df = 獨立區域
# \u500b\u5ba4 = 個室
# \u5305\u623f = 包房
$posPatterns = @(
    "\u5305\u5ec2",
    "\u5305\u5834",
    "\u7368\u7acb\u7a7a\u9593",
    "\u7368\u7acb\u5340\u57df",
    "\u500b\u5ba4",
    "\u5305\u623f"
)

# Negation patterns using Unicode escapes:
# (\u6c92\u6709|\u7121|\u672a\u63d0\u4f9b|\u4e0d\u63d0\u4f9b|\u4e0d\u8a2d|\u6c92)\u5305\u5ec2 = (沒有|無|未提供|不提供|不設|沒)包廂
# (\u6c92\u6709|\u7121|\u672a\u63d0\u4f9b|\u4e0d\u63d0\u4f9b|\u4e0d\u958b\u653e|\u4e0d\u8a2d|\u6c92)\u5305\u5834 = (沒有|無|未提供|不提供|不開放|不設|沒)包場
# \u4e0d\u80fd\u5305\u5834 = 不能包場
# \u7121\u6cd5\u5305\u5834 = 無法包場
$negPatterns = @(
    "(\u6c92\u6709|\u7121|\u672a\u63d0\u4f9b|\u4e0d\u63d0\u4f9b|\u4e0d\u8a2d|\u6c92)\u5305\u5ec2",
    "(\u6c92\u6709|\u7121|\u672a\u63d0\u4f9b|\u4e0d\u63d0\u4f9b|\u4e0d\u958b\u653e|\u4e0d\u8a2d|\u6c92)\u5305\u5834",
    "\u4e0d\u80fd\u5305\u5834",
    "\u7121\u6cd5\u5305\u5834"
)

$responseFiles = Get-ChildItem -Path $responseDir -Filter "*.json"
$updatedCount = 0

Write-Host "Scanning reviews for private rooms and booking capability..."

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

Write-Host "Done! Updated $updatedCount restaurants."
