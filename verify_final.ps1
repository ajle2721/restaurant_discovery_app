[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map"
$dataJsPath = Join-Path $baseDir "data.js"
$responseDir = Join-Path $baseDir "response"
Copy-Item -Path $dataJsPath -Destination "$($dataJsPath).bak_verify" -Force
Write-Output "Backup done."
$content = [System.IO.File]::ReadAllText($dataJsPath, [System.Text.Encoding]::UTF8)
$startIdx = $content.IndexOf("[")
$endIdx = $content.LastIndexOf("]")
$jsonStr = $content.Substring($startIdx, $endIdx - $startIdx + 1)
$restaurants = ConvertFrom-Json -InputObject $jsonStr
Write-Output "Loaded $($restaurants.Count) restaurants."
$updatedCount = 0
foreach ($r in $restaurants) {
  $placeId = $r.place_id
  if (-not $placeId) { continue }
  $respPath = Join-Path $responseDir "$placeId.json"
  if (-not (Test-Path $respPath)) { continue }
  $respData = Get-Content -Path $respPath -Encoding UTF8 -Raw | ConvertFrom-Json
  $reviewsText = ""
  if ($null -ne $respData.reviews) {
    foreach ($rev in $respData.reviews) {
      if ($null -ne $rev.text -and $null -ne $rev.text.text) { $reviewsText += $rev.text.text + "`n" }
      elseif ($null -ne $rev.originalText -and $null -ne $rev.originalText.text) { $reviewsText += $rev.originalText.text + "`n" }
    }
  }
  $attrs = @{ high_chair_available="unknown"; spacious_seating="unknown"; kids_menu="unknown"; kid_noise_tolerant="unknown" }
  $signals = @()
  $sentences = $reviewsText -split "[。！？`n`r；]+"
  foreach ($s in $sentences) {
    $s = $s.Trim()
    if ($s.Length -lt 3) { continue }
    $negChair = @("沒有兒童椅","沒提供餐椅","沒提供兒童椅","無兒童椅","未提供兒童椅","沒有提供兒童座椅","沒兒童椅","不提供兒童椅","沒有嬰兒椅","無餐椅")
    $posChair = @("兒童椅","嬰兒椅","寶寶椅","兒童餐椅","幼兒座椅","小孩椅子","兒童用椅","提供餐椅","備有餐椅","high chair","兒童坐椅","兒童座椅","嬰兒座椅","餐椅")
    $negSpace = @("擁擠","狹小","座位很近","小小的店","空間偏小","空間不大","太擠","很擠","偏擠","位子很擠","空間小","間距近","間距小","座位間很近")
    $posSpace = @("空間寬敞","推車方便","環境寬敞","座位寬敞","寬敞舒適","推嬰兒車方便","位子寬敞","座位大","場地大","很有空間")
    $negMenu = @("沒有兒童餐","沒提供兒童餐","無兒童餐","不提供兒童餐")
    $posMenu = @("兒童餐","寶寶粥","小人餐","兒童菜單","小孩餐","兒童專屬")
    $negNoise = @("不接待小孩","拒絕小孩","不適合小孩","不適合帶小孩","不能帶小孩","白眼","不歡迎小孩","謝絕兒童","不接待兒童")
    $posNoise = @("親子友善","對小孩友善","對兒童友善","歡迎小孩","適合小孩","適合帶小孩","很多家庭","很多小朋友","友善小孩","家庭友善","親子餐廳")
    $tryMatch = { param($list) foreach ($kw in $list) { if ($s -like "*$kw*") { return $true } }; return $false }
    $capS = if ($s.Length -gt 80) { $s.Substring(0,80) } else { $s }
    $matchN = & $tryMatch $negChair; $matchP = & $tryMatch $posChair
    if ($matchN) { $attrs["high_chair_available"]="no"; if (-not ($signals -contains $capS)) { $signals += $capS } }
    elseif ($matchP -and $attrs["high_chair_available"] -ne "no") { $attrs["high_chair_available"]="yes"; if (-not ($signals -contains $capS)) { $signals += $capS } }
    $matchN = & $tryMatch $negSpace; $matchP = & $tryMatch $posSpace
    if ($matchN) { $attrs["spacious_seating"]="no"; if (-not ($signals -contains $capS)) { $signals += $capS } }
    elseif ($matchP -and $attrs["spacious_seating"] -ne "no") { $attrs["spacious_seating"]="yes"; if (-not ($signals -contains $capS)) { $signals += $capS } }
    $matchN = & $tryMatch $negMenu; $matchP = & $tryMatch $posMenu
    if ($matchN) { $attrs["kids_menu"]="no"; if (-not ($signals -contains $capS)) { $signals += $capS } }
    elseif ($matchP -and $attrs["kids_menu"] -ne "no") { $attrs["kids_menu"]="yes"; if (-not ($signals -contains $capS)) { $signals += $capS } }
    $matchN = & $tryMatch $negNoise; $matchP = & $tryMatch $posNoise
    if ($matchN) { $attrs["kid_noise_tolerant"]="no"; if (-not ($signals -contains $capS)) { $signals += $capS } }
    elseif ($matchP -and $attrs["kid_noise_tolerant"] -ne "no") { $attrs["kid_noise_tolerant"]="yes"; if (-not ($signals -contains $capS)) { $signals += $capS } }
  }
  $posItems = @(); if ($attrs.high_chair_available -eq "yes") { $posItems += "兒童椅" }; if ($attrs.kids_menu -eq "yes") { $posItems += "兒童餐" }
  $negItems = @(); if ($attrs.high_chair_available -eq "no") { $negItems += "未提供兒童椅" }; if ($attrs.kids_menu -eq "no") { $negItems += "無兒童餐" }
  if ($attrs.spacious_seating -eq "no") { $negItems += "空間較為擁擠" }; if ($attrs.kid_noise_tolerant -eq "no") { $negItems += "較不適合帶小孩" }
  $sumParts = @()
  if ($posItems.Count -gt 0) { $sumParts += "餐廳提供" + ($posItems -join "與") + "。" }
  if ($attrs.spacious_seating -eq "yes") { $sumParts += "空間寬敞，適合家庭用餐。" }
  if ($attrs.kid_noise_tolerant -eq "yes") { $sumParts += "整體氛圍對親子友善。" }
  if ($negItems.Count -gt 0) { $sumParts += "不過評論指出" + ($negItems -join "、") + "，建議家長斟酌。" }
  $summary = if ($sumParts.Count -gt 0) { $sumParts -join " " } elseif ($signals.Count -gt 0) { "目前缺乏明確的親子友善標籤，請參考下方評論線索。" } else { "目前缺乏親子友善相關的詳細資訊。" }
  $score = 0; foreach ($v in $attrs.Values) { if ($v -eq "yes") { $score++ } }
  $level = if ($score -ge 3) { "高" } elseif ($score -ge 1) { "中" } else { "資訊不足" }
  $oldA = $r.attributes; $changed = $false
  if ($oldA.high_chair_available -ne $attrs.high_chair_available -or $oldA.spacious_seating -ne $attrs.spacious_seating -or $oldA.kids_menu -ne $attrs.kids_menu -or $oldA.kid_noise_tolerant -ne $attrs.kid_noise_tolerant) { $changed = $true }
  $oldSigs = @(); if ($null -ne $r.signals) { $oldSigs = @($r.signals) }
  if ($oldSigs.Count -ne $signals.Count) { $changed = $true }
  if ($changed) {
    $r.attributes.high_chair_available = $attrs.high_chair_available
    $r.attributes.spacious_seating = $attrs.spacious_seating
    $r.attributes.kids_menu = $attrs.kids_menu
    $r.attributes.kid_noise_tolerant = $attrs.kid_noise_tolerant
    $r.signals = $signals
    $r.ai_summary = $summary
    $r.parent_friendly_score = $score
    $r.parent_friendly_level = $level
    $updatedCount++
  }
}
$newJson = ConvertTo-Json -InputObject $restaurants -Depth 10 -Compress
$newJson = $newJson -replace '\},\{', "},`n{"
$final = $content.Substring(0,$startIdx) + $newJson + $content.Substring($endIdx+1)
[System.IO.File]::WriteAllText($dataJsPath, $final, [System.Text.Encoding]::UTF8)
Write-Output "Done. Updated $updatedCount restaurants."
