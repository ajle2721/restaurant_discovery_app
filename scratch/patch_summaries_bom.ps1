$OutputEncoding = [System.Text.Encoding]::UTF8

Get-ChildItem -Path "ai_review/*.json" | ForEach-Object {
    $filePath = $_.FullName
    $jsonContent = Get-Content $filePath -Raw -Encoding UTF8
    $json = $jsonContent | ConvertFrom-Json
    
    $chair = $false
    $tableware = $false
    
    # Extract properties safely
    if ($json.PSObject.Properties[" child_seat available"]) {
        $chair = $json." child_seat available".result -eq "Yes"
    }
    if (-not $chair -and $json.PSObject.Properties["High chair available"]) {
        $chair = $json."High chair available".result -eq "Yes"
    }
    if ($json.PSObject.Properties["has_tableware"]) {
        $tableware = $json.has_tableware.result -eq "Yes"
    }
    
    if ($chair -or $tableware) {
        $modified = $false
        $regex = "(目前)?評論中?(較少|未|尚未)提及(及)?(與)?([，、或與及和等座椅椅餐具遊戲區設施尿布台包廂包場空間細節獨立空間設備資訊具體親子相關的其他用餐的]*)(等設施|等具體親子設施|等親子設施|等具體資訊|等資訊|等設備|等設施需求|相關的具體資訊|相關細節|等具體設施|具體細節)?"
        
        # Update generated_summary
        $sum = $json.generated_summary
        if ($sum) {
            $matches = [regex]::Matches($sum, $regex)
            foreach ($match in $matches) {
                $matchText = $match.Value
                if ($matchText -match "椅|座椅|餐具") {
                    $replacement = ""
                    if ($chair -and $tableware) {
                        $replacement = "應備有兒童椅與兒童餐具，但目前評論中未特別提及尿布台等設施"
                    } elseif ($chair) {
                        $replacement = "應備有兒童椅，但目前評論中未特別提及餐具與尿布台等設施"
                    } else {
                        $replacement = "應備有兒童餐具，但目前評論中未特別提及兒童椅與尿布台等設施"
                    }
                    $sum = $sum.Replace($matchText, $replacement)
                    $modified = $true
                }
            }
            $json.generated_summary = $sum
        }
        
        # Update card_summary
        $cardSum = $json.card_summary
        if ($cardSum) {
            $matches = [regex]::Matches($cardSum, $regex)
            foreach ($match in $matches) {
                $matchText = $match.Value
                if ($matchText -match "椅|座椅|餐具") {
                    $replacement = ""
                    if ($chair -and $tableware) {
                        $replacement = "應備有兒童椅與兒童餐具，但目前評論中未特別提及尿布台等設施"
                    } elseif ($chair) {
                        $replacement = "應備有兒童椅，但目前評論中未特別提及餐具與尿布台等設施"
                    } else {
                        $replacement = "應備有兒童餐具，但目前評論中未特別提及兒童椅與尿布台等設施"
                    }
                    $cardSum = $cardSum.Replace($matchText, $replacement)
                    $modified = $true
                }
            }
            $json.card_summary = $cardSum
        }
        
        if ($modified) {
            Write-Output "Updating $($json.restaurant_name) ($($_.Name))"
            # Format JSON back nicely
            $newJsonContent = ConvertTo-Json $json -Depth 100
            [System.IO.File]::WriteAllText($filePath, $newJsonContent, [System.Text.Encoding]::UTF8)
        }
    }
}

