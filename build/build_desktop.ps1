[CmdletBinding()]
param(
    [switch]$SkipBackend
)

$ErrorActionPreference = 'Stop'

trap {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$BuildScriptDir = $PSScriptRoot
$ProjectRoot = Split-Path $BuildScriptDir -Parent

$DesktopRoot = Join-Path $ProjectRoot 'desktop'
$BackendDir = Join-Path $DesktopRoot 'backend'
$BackendExe = Join-Path $BackendDir 'Visualizer.exe'

$Python = Join-Path $ProjectRoot 'venv\Scripts\python.exe'

$BuildRoot = $BuildScriptDir
$FinalExe = Join-Path $ProjectRoot 'dist\VisualizerDesktop.exe'

$Launcher = Join-Path $BuildScriptDir 'visualizer_launcher.py'

if (-not (Test-Path -LiteralPath $DesktopRoot -PathType Container)) {
    throw "Electron project not found at $DesktopRoot."
}

if (-not $SkipBackend) {
    if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
        throw "Python venv not found at $Python. Create it first: python -m venv venv"
    }

    & $Python -c "import PyInstaller" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller is not installed in the venv. Run: .\venv\Scripts\python.exe -m pip install pyinstaller"
    }

    New-Item -ItemType Directory -Path $BackendDir, $BuildRoot -Force | Out-Null
    Write-Host 'Building Python backend...'
    Push-Location $ProjectRoot
    try {
        & $Python -m PyInstaller `
            --noconfirm `
            --clean `
            --onefile `
            --console `
            --name Visualizer `
            --distpath $BackendDir `
            --workpath (Join-Path $BuildRoot 'backend') `
            --specpath (Join-Path $BuildRoot 'backend') `
            --add-data "$(Join-Path $ProjectRoot 'templates');templates" `
            --add-data "$(Join-Path $ProjectRoot 'static');static" `
            --collect-all yt_dlp `
            $Launcher

        if ($LASTEXITCODE -ne 0) {
            throw "PyInstaller failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath $BackendExe -PathType Leaf)) {
    throw "Backend executable not found at $BackendExe. Run without -SkipBackend to build it."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js was not found in PATH.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm was not found in PATH.'
}

Push-Location $DesktopRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $DesktopRoot 'node_modules\electron'))) {
        Write-Host 'Installing Electron dependencies...'
        & cmd.exe /c 'npm ci --no-audit --no-fund'
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE."
        }
    }

    # Start from a clean output directory so no stale asar/app files survive.
    $ElectronDist = Join-Path $DesktopRoot 'dist'
    if (Test-Path -LiteralPath $ElectronDist) {
        Remove-Item -LiteralPath $ElectronDist -Recurse -Force
    }

    # Keep Electron from trying to use a code-signing certificate.
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

    Write-Host 'Building Electron desktop app...'
    & cmd.exe /c 'npm run dist'
    if ($LASTEXITCODE -ne 0) {
        throw "electron-builder failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$BuiltExe = Get-ChildItem -LiteralPath (Join-Path $DesktopRoot 'dist') -Filter 'Visualizer-*.exe' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $BuiltExe) {
    throw 'electron-builder finished, but no Visualizer-*.exe was found.'
}

New-Item -ItemType Directory -Path (Split-Path $FinalExe -Parent) -Force | Out-Null
Copy-Item -LiteralPath $BuiltExe.FullName -Destination $FinalExe -Force
$SizeMb = [math]::Round((Get-Item -LiteralPath $FinalExe).Length / 1MB, 1)
Write-Host "Built: $FinalExe ($SizeMb MB)"
