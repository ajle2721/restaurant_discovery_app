$ai_dir = "ai_review"
$files = Get-ChildItem -Path $ai_dir -Filter *.json
$count = 0

$char_gao = [char]0x9ad8
$char_zhong = [char]0x4e2d
$str_insufficient = "$([char]0x8cc7)$([char]0x8a0a)$([char]0x4e0d)$([char]0x8db3)"

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding utf8
        $data = ConvertFrom-Json $content
        
        # Determine properties securely using psObject
        $has_tableware = $false
        if ($null -ne $data.has_tableware -and $data.has_tableware.result -eq "Yes") {
            $has_tableware = $true
        }
        
        $has_high_chair = $false
        $cs1 = $data." child_seat available"
        $cs2 = $data."child_seat available"
        if (($null -ne $cs1 -and $cs1.result -eq "Yes") -or ($null -ne $cs2 -and $cs2.result -eq "Yes")) {
            $has_high_chair = $true
        }
        
        $has_kids_menu = $false
        $km = $data."Kids menu available"
        if ($null -ne $km -and $km.result -eq "Yes") {
            $has_kids_menu = $true
        }
        
        $has_play_area = $false
        $pa = $data.has_play_area
        if ($null -ne $pa -and $pa.result -eq "Yes") {
            $has_play_area = $true
        }
        
        $is_recommended = ($has_tableware -and $has_high_chair) -or ($has_kids_menu -or $has_play_area)
        
        # Count total yes
        $keys = @(" child_seat available", "child_seat available", "Spacious seating", "Kids menu available", "kid_noise_tolerant", "has_play_area", "has_private_room", "has_tableware", "has_diaper_table")
        $total_yes = 0
        foreach ($k in $keys) {
            if ($null -ne $data.$k -and $data.$k.result -eq "Yes") {
                $total_yes++
            }
        }
        
        $new_level = $str_insufficient
        if ($is_recommended) {
            $new_level = $char_gao
        } elseif ($total_yes -ge 1) {
            $new_level = $char_zhong
        }
        
        if ($data.parent_friendly_level -ne $new_level) {
            $data.parent_friendly_level = $new_level
            $new_json = $data | ConvertTo-Json -Depth 20
            [System.IO.File]::WriteAllText($file.FullName, $new_json, [System.Text.Encoding]::UTF8)
            $count++
        }
    } catch {
        # Ignore
    }
}
Write-Host "Successfully updated levels for $count files."
