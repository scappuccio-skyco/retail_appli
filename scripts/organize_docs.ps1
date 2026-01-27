# Script d'organisation des documents .md
# Usage: .\scripts\organize_docs.ps1

$archiveBase = "docs\archive"
$currentYear = Get-Date -Format "yyyy"
$currentMonth = Get-Date -Format "MM"
$currentFolder = "$currentYear-$currentMonth"

# Créer les dossiers d'archive si nécessaire
$folders = @("2024-12", "2025-01", "2025-02")
foreach ($folder in $folders) {
    $path = Join-Path $archiveBase $folder
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "✅ Créé: $path"
    }
}

# Documents à archiver (par pattern)
$patternsToArchive = @{
    "VAGUE_*.md" = "2025-01"
    "RESUME_*.md" = "2025-01"
    "BILAN_*.md" = "2025-01"
    "DECOUPLAGE_*.md" = "2025-01"
    "PLAN_*.md" = "2025-01"
    "ANALYSE_DECOUPLAGE_*.md" = "2025-01"
}

Write-Host "`n📁 Organisation des documents..."
Write-Host "================================`n"

foreach ($pattern in $patternsToArchive.Keys) {
    $targetFolder = $patternsToArchive[$pattern]
    $files = Get-ChildItem -Path . -Filter $pattern -File | Where-Object { $_.FullName -notlike "*\docs\*" -and $_.FullName -notlike "*\frontend\*" }
    
    foreach ($file in $files) {
        $targetPath = Join-Path $archiveBase $targetFolder $file.Name
        if (-not (Test-Path $targetPath)) {
            Move-Item -Path $file.FullName -Destination $targetPath -Force
            Write-Host "📦 Archivé: $($file.Name) → archive/$targetFolder/"
        }
    }
}

Write-Host "`n✅ Organisation terminée!"
Write-Host "`n📋 Documents de référence (non archivés):"
Write-Host "  - .cursorrules (SOURCE DE VÉRITÉ)"
Write-Host "  - README.md"
Write-Host "  - CHANGELOG.md"
Write-Host "  - AUDIT_ARCHITECTURAL_CRITIQUE.md"
Write-Host "  - SYNTHESE_ARCHITECTURE_POST_REFACTORING.md"
