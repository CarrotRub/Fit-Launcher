

$ErrorActionPreference = "Stop"
Write-Host "STARTED"

try {
    $releases = Invoke-RestMethod -Uri "https://api.github.com/repos/mokurin000/aria2c-windows-hide-console/releases/latest"
    $latest = $releases | Select-Object -First 1
    $TAG = $latest.tag_name
    $TAG_VER = $TAG -replace "release-", ""

    # Paths
    $binariesPath = "./src-tauri/binaries"
    $destFile = "$binariesPath/aria2c-x86_64-pc-windows-msvc.exe"
    $versionFile = "$binariesPath/aria2c-version.txt"


    if ((Test-Path $destFile) -and (Test-Path $versionFile)) {
        $installedVersion = Get-Content $versionFile -ErrorAction SilentlyContinue
        if ($installedVersion -eq $TAG_VER) {
            Write-Host "Binary already up to date (version $TAG_VER), skipping download." -ForegroundColor Yellow
            exit 0
        }
    }

    $downloadUrl = "https://github.com/mokurin000/aria2c-windows-hide-console/releases/download/$TAG/aria2-$TAG_VER-win-64bit-build1.zip"
    $outputPath = "64bit.zip"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $outputPath

    if (-not (Test-Path -Path $binariesPath)) {
        New-Item -ItemType Directory -Path $binariesPath | Out-Null
    }

    Expand-Archive -Path $outputPath -DestinationPath . -Force
    $sourceFile = "aria2-$TAG_VER-win-64bit-build1/aria2c.exe"
    Move-Item -Path $sourceFile -Destination $destFile -Force

    $TAG_VER | Out-File $versionFile -Encoding ASCII -Force

    Remove-Item -Path $outputPath -Force
    Remove-Item -Path "aria2-$TAG_VER-win-64bit-build1" -Recurse -Force
}
catch {
    Write-Host "An error occurred: $_" -ForegroundColor Red
    exit 1
}

Write-Host "aria2c binary downloaded and extracted successfully!" -ForegroundColor Green
exit 0
