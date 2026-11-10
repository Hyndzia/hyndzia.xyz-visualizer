#Requires -Version 5.1

<#
.SYNOPSIS
    Build and run the Visualizer Docker image on Windows.

.DESCRIPTION
    Windows equivalent of build_linux.sh. Requires Docker Desktop with the
    Linux container engine enabled. The container is recreated when it already
    exists, and cookies.txt from the project root is mounted into the container.

.PARAMETER ImageName
    Name of the Docker image to build. Default: visual.

.PARAMETER ContainerName
    Name of the container to run. Default: visual_container.

.PARAMETER HostPort
    Port exposed on Windows. Default: 8989.

.PARAMETER ContainerPort
    Port the app listens on inside the container. Default: 8989.

.PARAMETER CookieFile
    Path to the cookies file mounted into the container. Default: cookies.txt
    in the project root. It is created as an empty file when missing.
#>
[CmdletBinding()]
param(
    [string]$ImageName = 'visual',
    [string]$ContainerName = 'visual_container',
    [int]$HostPort = 8989,
    [int]$ContainerPort = 8989,
    [string]$CookieFile = 'cookies.txt'
)

$ErrorActionPreference = 'Stop'

trap {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Dockerfile = Join-Path $PSScriptRoot 'Dockerfile'

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & docker @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed (exit code $LASTEXITCODE): docker $($Arguments -join ' ')"
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found in PATH. Install Docker Desktop, start it, and reopen the terminal."
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running. Start Docker Desktop and try again."
}

if (-not (Test-Path -LiteralPath $Dockerfile -PathType Leaf)) {
    throw "Dockerfile was not found at $Dockerfile."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.env') -PathType Leaf)) {
    throw ".env was not found. Copy .env.example to .env and set SECRET_KEY before building."
}

if (-not [System.IO.Path]::IsPathRooted($CookieFile)) {
    $CookieFile = Join-Path $ProjectRoot $CookieFile
}
$CookieFile = [System.IO.Path]::GetFullPath($CookieFile)

if (-not (Test-Path -LiteralPath $CookieFile -PathType Leaf)) {
    New-Item -ItemType File -Path $CookieFile -Force | Out-Null
    Write-Warning "cookies.txt was not found; created an empty file at $CookieFile."
}

Push-Location $ProjectRoot
try {
    Write-Host "Building Docker image '$ImageName'..."
    Invoke-Docker @('build', '--file', $Dockerfile, '--tag', $ImageName, $ProjectRoot)

    $existingContainer = & docker ps --all --quiet --filter "name=^/${ContainerName}$"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not check for an existing container (exit code $LASTEXITCODE)."
    }

    if ($existingContainer) {
        Write-Host "Container '$ContainerName' exists. Removing..."
        Invoke-Docker @('rm', '--force', $ContainerName)
    }

    Write-Host "Running container '$ContainerName'..."
    $runArguments = @(
        'run',
        '--detach',
        '--name', $ContainerName,
        '--publish', "${HostPort}:${ContainerPort}",
        '--mount', "type=bind,source=$CookieFile,target=/app/cookies.txt",
        '--env', 'COOKIE_FILE=/app/cookies.txt',
        $ImageName
    )

    $containerId = (& docker @runArguments) -join ''
    if ($LASTEXITCODE -ne 0) {
        throw "Could not start the container (exit code $LASTEXITCODE)."
    }

    Write-Host "Container started: $($containerId.Trim())"
    Write-Host "App is available at http://127.0.0.1:$HostPort"
}
finally {
    Pop-Location
}
