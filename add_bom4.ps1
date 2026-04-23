$bytes = [System.IO.File]::ReadAllBytes("c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\run_update4.ps1")
$bom = [byte[]](239,187,191)
$newBytes = $bom + $bytes
[System.IO.File]::WriteAllBytes("c:\Users\aou\Desktop\Alice\Study\side project\restaurant map\run_update4.ps1", $newBytes)
