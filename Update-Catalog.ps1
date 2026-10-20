<#
.SYNOPSIS
  Script otomatis untuk memperbarui songs.json berdasarkan file di folder audio/
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AudioDir = Join-Path $ScriptDir "audio"
$SongsJsonPath = Join-Path $ScriptDir "songs.json"

if (-not (Test-Path $AudioDir)) {
    Write-Host "Folder audio/ tidak ditemukan!" -ForegroundColor Red
    exit 1
}

$catalog = [ordered]@{
    repository = "Upacara Song Repository"
    version = "1.0.0"
    description = "Katalog Lagu Upacara Bendera & Koor untuk Upacara Player"
    songs = @()
}

$existingSongs = @()
if (Test-Path $SongsJsonPath) {
    try {
        $raw = Get-Content $SongsJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($raw.repository) { $catalog.repository = $raw.repository }
        if ($raw.version) { $catalog.version = $raw.version }
        if ($raw.description) { $catalog.description = $raw.description }
        if ($raw.driveFolderUrl) { $catalog.driveFolderUrl = $raw.driveFolderUrl }
        $existingSongs = @($raw.songs)
    } catch {
        Write-Host "Peringatan: Gagal membaca songs.json lama, membuat daftar baru..." -ForegroundColor Yellow
        $existingSongs = @()
    }
}

$audioFiles = Get-ChildItem -Path $AudioDir -File | Where-Object { $_.Extension -match '\.(mp3|mid|midi|wav|ogg)$' }

$songsList = [System.Collections.Generic.List[PSObject]]::new()
$existingDirectUrls = @{}

foreach ($s in $existingSongs) {
    $songsList.Add($s)
    if ($s.directUrl) {
        $existingDirectUrls[$s.directUrl.ToLower()] = $true
    }
}

$newCount = 0
foreach ($file in $audioFiles) {
    $relUrl = "audio/" + $file.Name
    $checkKey = $relUrl.ToLower()
    $checkKeyAlt = "./audio/" + $file.Name.ToLower()

    if (-not $existingDirectUrls.ContainsKey($checkKey) -and -not $existingDirectUrls.ContainsKey($checkKeyAlt)) {
        $ext = $file.Extension.ToLower()
        $isMidi = ($ext -eq '.mid' -or $ext -eq '.midi')
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
        $cleanId = ($baseName -replace '[^a-zA-Z0-9_]', '_').ToLower() + ($ext -replace '\.', '_')
        $cleanTitle = ($baseName -replace '_', ' ').Trim()

        $newSong = [PSCustomObject]@{
            id = $cleanId
            title = $cleanTitle
            category = "Lagu Nasional"
            directUrl = $relUrl
            isMidi = $isMidi
            description = "Lagu pengiring upacara"
        }

        $songsList.Add($newSong)
        $existingDirectUrls[$checkKey] = $true
        $newCount++
        Write-Host "  [+] Menambahkan lagu baru: $($file.Name)" -ForegroundColor Green
    }
}

$catalog.songs = $songsList
$jsonOutput = $catalog | ConvertTo-Json -Depth 5
$jsonOutput | Set-Content -Path $SongsJsonPath -Encoding UTF8

Write-Host "Katalog berhasil diperbarui!" -ForegroundColor Cyan
Write-Host "Total lagu: $($songsList.Count) (Baru ditambahkan: $newCount)" -ForegroundColor Cyan
