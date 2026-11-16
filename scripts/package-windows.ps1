param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    $resources = Join-Path $root 'data/resources'
    if (-not (Test-Path (Join-Path $resources 'presets.json'))) { throw 'Missing development data/resources/presets.json.' }
    if (-not $SkipBuild) {
        # Merge Cargo's progress stderr inside cmd for Windows PowerShell 5.1.
        & cmd.exe /d /c 'npm run tauri -- build --no-bundle --ci 2>&1'
        if ($LASTEXITCODE -ne 0) { throw 'Tauri release build failed.' }
    }
    $version = (Get-Content 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json).version
    $exe = Join-Path $root 'src-tauri/target/release/dst-swapfit.exe'
    if (-not (Test-Path $exe)) { throw 'Missing release executable.' }
    $name = "DST-SwapFit-$version-windows-x64"
    $release = Join-Path $root 'release'
    $dest = Join-Path $release $name
    # Only replace this script's staging directory, never source resources/output.
    if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -LiteralPath $exe -Destination (Join-Path $dest 'DST SwapFit.exe')
    # Development data is collected under data; portable layout remains EXE/resources.
    Copy-Item -LiteralPath $resources -Destination (Join-Path $dest 'resources') -Recurse
    $readme = @'
DST SwapFit - DST artwork-to-swap-channel alignment tool

1. Extract the entire ZIP into a writable folder (not Program Files).
2. Run "DST SwapFit.exe".
3. Drag in a dish image, adjust it, then click the highlighted Make button.
4. Projects are created in the "output" folder next to the executable.

Keep the "resources" folder beside the EXE, with its original structure.
No Node.js, Rust or DST game installation is required.
Microsoft Edge WebView2 Runtime is required (usually preinstalled on Windows 10/11).
If missing, install it from https://developer.microsoft.com/microsoft-edge/webview2/

Unsigned build: Windows may show a security/reputation warning.
Do not run from inside the ZIP; extract first.
'@
    [System.IO.File]::WriteAllText((Join-Path $dest 'README.txt'), $readme, [System.Text.Encoding]::UTF8)
    $zip = Join-Path $release "$name.zip"
    if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
    Compress-Archive -LiteralPath $dest -DestinationPath $zip -CompressionLevel Optimal
    $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText("$zip.sha256", "$hash  $name.zip`n", [System.Text.Encoding]::ASCII)
    Write-Output "Portable directory: $dest"
    Write-Output "Distribution ZIP: $zip"
    Write-Output "SHA256: $hash"
} finally { Pop-Location }
