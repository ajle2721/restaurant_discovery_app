param(
    [ValidateRange(1, 65535)]
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue

if ($npmCommand -and -not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    Write-Host 'Installing project dependencies for the first run...' -ForegroundColor Yellow
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Dependency installation failed.' -ForegroundColor Red
        Read-Host 'Press Enter to close'
        exit $LASTEXITCODE
    }
}

$addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -ne '127.0.0.1' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.AddressState -eq 'Preferred'
    } |
    Sort-Object InterfaceAlias

Write-Host 'Restaurant Map remote preview' -ForegroundColor Cyan
Write-Host 'Listening on every network interface.' -ForegroundColor Green
Write-Host 'Keep this window open. Press Ctrl+C or close it to stop the server.'
Write-Host ''
if ($addresses) {
    Write-Host 'Open a reachable URL from your phone:' -ForegroundColor Green
    foreach ($address in $addresses) {
        Write-Host ("  {0,-24} http://{1}:{2}/" -f $address.InterfaceAlias, $address.IPAddress, $Port)
    }
} else {
    Write-Host 'No reachable IPv4 address was found. Connect the network and try again.' -ForegroundColor Yellow
}
Write-Host ''
Write-Host "If the phone cannot connect, Windows Firewall may need to allow TCP port $Port on this network." -ForegroundColor Yellow
Write-Host ''

if ($npmCommand) {
    & npm.cmd run dev -- --host 0.0.0.0 --port $Port --strictPort
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Host ''
        Write-Host "The preview server stopped with exit code $exitCode." -ForegroundColor Red
        Read-Host 'Press Enter to close'
    }
    exit $exitCode
}

Write-Host 'Node.js is not installed; using the built-in Windows static server.' -ForegroundColor Yellow
Write-Host 'This mode serves the current project files and reloads changes when the page is refreshed.'
Write-Host ''

$mimeTypes = @{
    '.css' = 'text/css; charset=utf-8'
    '.gif' = 'image/gif'
    '.html' = 'text/html; charset=utf-8'
    '.ico' = 'image/x-icon'
    '.jpeg' = 'image/jpeg'
    '.jpg' = 'image/jpeg'
    '.js' = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.map' = 'application/json; charset=utf-8'
    '.png' = 'image/png'
    '.svg' = 'image/svg+xml'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.webp' = 'image/webp'
    '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'
}

$rootPath = [System.IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)

try {
    $listener.Start()
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
            $requestLine = $reader.ReadLine()
            while ($reader.ReadLine()) { }

            $method = ''
            $target = '/'
            if ($requestLine -match '^(GET|HEAD)\s+([^\s]+)\s+HTTP/') {
                $method = $Matches[1]
                $target = $Matches[2]
            }

            $requestPath = [System.Uri]::UnescapeDataString(($target -split '[?#]')[0]).TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($requestPath)) {
                $requestPath = 'index.html'
            }
            $filePath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $requestPath.Replace('/', '\')))

            $status = '200 OK'
            $body = [byte[]]@()
            $contentType = 'application/octet-stream'
            if ($method -notin @('GET', 'HEAD')) {
                $status = '405 Method Not Allowed'
            } elseif (-not $filePath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or
                -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $status = '404 Not Found'
            } else {
                $body = [System.IO.File]::ReadAllBytes($filePath)
                $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                if ($mimeTypes.ContainsKey($extension)) {
                    $contentType = $mimeTypes[$extension]
                }
            }

            if ($status -ne '200 OK') {
                $body = [System.Text.Encoding]::UTF8.GetBytes($status)
                $contentType = 'text/plain; charset=utf-8'
            }
            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($method -ne 'HEAD' -and $body.Length -gt 0) {
                $stream.Write($body, 0, $body.Length)
            }
        } catch {
            Write-Warning $_.Exception.Message
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}
