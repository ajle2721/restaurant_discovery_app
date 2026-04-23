$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Unescape-Unicode([string]$str) {
    return [regex]::Replace($str, '\\u(?<Value>[a-fA-F0-9]{4})', {
        param($m)
        [char][int]::Parse($m.Groups['Value'].Value, [System.Globalization.NumberStyles]::HexNumber)
    })
}

$baseDir = "c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\ai_review"
$files = Get-ChildItem -Path $baseDir -Filter "*.json"

$countUpdated = 0

foreach ($file in $files) {
    try {
        $raw = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $data = ConvertFrom-Json $raw
        
        $seatVal = if ($null -ne $data.psobject.properties[' child_seat available']) { $data.psobject.properties[' child_seat available'].Value } else { $null }
        $seatRes = if ($null -ne $seatVal) { $seatVal.result } else { "UNKNOWN" }
        
        $menuVal = if ($null -ne $data.psobject.properties['Kids menu available']) { $data.psobject.properties['Kids menu available'].Value } else { $null }
        $menuRes = if ($null -ne $menuVal) { $menuVal.result } else { "UNKNOWN" }
        
        $spaceVal = if ($null -ne $data.psobject.properties['Spacious seating']) { $data.psobject.properties['Spacious seating'].Value } else { $null }
        $spaceRes = if ($null -ne $spaceVal) { $spaceVal.result } else { "UNKNOWN" }
        
        $noiseVal = if ($null -ne $data.psobject.properties['kid_noise_tolerant']) { $data.psobject.properties['kid_noise_tolerant'].Value } else { $null }
        $noiseRes = if ($null -ne $noiseVal) { $noiseVal.result } else { "UNKNOWN" }
        
        $totalScore = 0
        $reasons = @()
        
        if ($seatRes.ToUpper() -eq 'YES') { $totalScore++; $reasons += "有兒童椅" }
        if ($menuRes.ToUpper() -eq 'YES') { $totalScore++; $reasons += "有兒童餐" }
        if ($spaceRes.ToUpper() -eq 'YES') { $totalScore++; $reasons += "空間寬敞" }
        if ($noiseRes.ToUpper() -eq 'YES') { $totalScore++; $reasons += "不怕小孩吵" }
        
        $level = ""
        if ($totalScore -ge 3) {
            $level = "高"
        } elseif ($totalScore -eq 2) {
            $level = "中"
        } else {
            $level = "資訊不足"
        }
        
        if (($spaceRes.ToUpper() -eq 'NO' -or $noiseRes.ToUpper() -eq 'NO') -and ($level -eq "高")) {
            $level = "中"
        }
        
        $reasonStr = ""
        if ($reasons.Count -gt 0) {
            $reasonStr = $reasons -join "、"
        } else {
            $reasonStr = "目前缺乏明確的親子友善資訊"
        }
        
        if ($null -ne $data.psobject.properties['parent_friendly_score']) { $data.psobject.properties.Remove('parent_friendly_score') }
        if ($null -ne $data.psobject.properties['parent_friendly_level']) { $data.psobject.properties.Remove('parent_friendly_level') }
        if ($null -ne $data.psobject.properties['summary']) { $data.psobject.properties.Remove('summary') }
        if ($null -ne $data.psobject.properties['reason']) { $data.psobject.properties.Remove('reason') }
        
        $data | Add-Member -MemberType NoteProperty -Name "parent_friendly_score" -Value $totalScore
        $data | Add-Member -MemberType NoteProperty -Name "parent_friendly_level" -Value $level
        $data | Add-Member -MemberType NoteProperty -Name "reason" -Value $reasonStr
        
        $json = ConvertTo-Json $data -Depth 10
        $json = Unescape-Unicode $json
        
        [System.IO.File]::WriteAllText($file.FullName, $json, [System.Text.Encoding]::UTF8)
        $countUpdated++
    } catch {
        Write-Output "Error processing $($file.Name): $_"
    }
}

Write-Output "Successfully updated $countUpdated files with new score, level, and dynamic reason."
