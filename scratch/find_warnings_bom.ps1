$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Get-ChildItem -Path "ai_review/*.json" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    if ($content -match "未提及|較少提及|未特別提及|未提及及") {
        $json = $content | ConvertFrom-Json
        $name = $json.restaurant_name
        $sum = $json.generated_summary
        $cardSum = $json.card_summary
        
        $chair = $json." child_seat available".result -eq "Yes" -or $json."High chair available".result -eq "Yes"
        $tableware = $json.has_tableware.result -eq "Yes"
        
        if ($chair -or $tableware) {
            Write-Output "--- $($name) ($($_.BaseName)) ---"
            Write-Output "  Chair: $chair, Tableware: $tableware"
            Write-Output "  Summary: $sum"
            if ($cardSum) {
                Write-Output "  Card Summary: $cardSum"
            }
        }
    }
}

