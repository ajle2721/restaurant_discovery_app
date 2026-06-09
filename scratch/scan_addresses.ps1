$content = [System.IO.File]::ReadAllText("ai_review/index.js", [System.Text.Encoding]::UTF8)
$addressMatches = [regex]::Matches($content, '"address":\s*"([^"]+)"')
$allAddrs = $addressMatches | ForEach-Object { $_.Groups[1].Value }

# Current char map keys already handled
$alreadyMapped = [System.Collections.Generic.HashSet[string]]@(
    '东','义','万','区','号','楼','湾','台','国','学','发','电','复','关','园',
    '龙','兴','庄','丰','双','华','临','庆','宝','宁','辽','阳','桥','铁','营',
    '头','观','门','乐','艺','爱','广','苏','芦','温','叶','荣','卫','丽','罗',
    '恒','馆','栋','柜','县','镇','乡'
)

# Comprehensive simplified -> traditional map for Taiwanese address chars
$simplifiedMap = @{
    '长'='長'; '场'='場'; '达'='達'; '进'='進'; '远'='遠'; '边'='邊'; '过'='過';
    '话'='話'; '说'='說'; '带'='帶'; '车'='車'; '风'='風'; '来'='來'; '样'='樣';
    '时'='時'; '间'='間'; '动'='動'; '历'='歷'; '开'='開'; '现'='現'; '联'='聯';
    '线'='線'; '纪'='紀'; '经'='經'; '继'='繼'; '给'='給'; '级'='級'; '纯'='純';
    '节'='節'; '结'='結'; '规'='規'; '确'='確'; '设'='設'; '识'='識'; '还'='還';
    '选'='選'; '钱'='錢'; '领'='領'; '总'='總'; '统'='統'; '终'='終'; '组'='組';
    '辞'='辭'; '详'='詳'; '语'='語'; '读'='讀'; '运'='運'; '连'='連'; '购'='購';
    '证'='證'; '积'='積'; '误'='誤'; '请'='請'; '该'='該'; '论'='論'; '员'='員';
    '卖'='賣'; '实'='實'; '际'='際'; '专'='專'; '业'='業'; '产'='產'; '务'='務';
    '处'='處'; '属'='屬'; '数'='數'; '据'='據'; '进'='進'; '递'='遞'; '输'='輸';
    '转'='轉'; '报'='報'; '试'='試'; '验'='驗'; '观'='觀'; '势'='勢'; '势'='勢'
}

# Remove any that are already in the map
$simplifiedMap.Keys | Where-Object { $alreadyMapped.Contains($_) } | ForEach-Object { $simplifiedMap.Remove($_) }

$found = @{}
foreach ($addr in $allAddrs) {
    for ($i = 0; $i -lt $addr.Length; $i++) {
        $c = [string]$addr[$i]
        if ($simplifiedMap.ContainsKey($c)) {
            if (-not $found.ContainsKey($c)) { $found[$c] = [System.Collections.Generic.List[string]]::new() }
            if (-not $found[$c].Contains($addr)) { $found[$c].Add($addr) }
        }
    }
}

if ($found.Count -eq 0) {
    Write-Host "No unhandled simplified characters found in addresses!"
} else {
    Write-Host "Found $($found.Count) unhandled simplified characters:"
    $found.GetEnumerator() | Sort-Object Key | ForEach-Object {
        Write-Host "  '$($_.Key)' -> '$($simplifiedMap[$_.Key])' in:"
        $_.Value | ForEach-Object { Write-Host "    - $_" }
    }
}

# Also output all unique addresses that have ANY simplified char (handled or not) for reference
Write-Host "`n--- Addresses still containing handled-but-present simplified chars ---"
$allAddrs | Where-Object { 
    $addr = $_
    $found2 = $false
    foreach ($c in ($alreadyMapped | ForEach-Object { $_ })) {
        if ($addr.Contains($c)) { $found2 = $true; break }
    }
    $found2
} | Select-Object -Unique | ForEach-Object { Write-Host "  - $_" }
