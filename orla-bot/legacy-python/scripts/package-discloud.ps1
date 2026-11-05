[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Initial", "Update")]
    [string]$Mode
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildRoot = Join-Path $projectRoot ".build"
$timestamp = Get-Date -Format "yyyyMMddHHmm"
$zipName = if ($Mode -eq "Initial") {
    "orla-bot-initial-$timestamp.zip"
} else {
    "orla-bot-update-$timestamp.zip"
}
New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null

$stagePath = Join-Path ([System.IO.Path]::GetTempPath()) ("orla-discloud-" + [guid]::NewGuid().ToString("N"))
$stageRoot = [System.IO.Path]::GetFullPath($stagePath)
New-Item -ItemType Directory -Path $stageRoot | Out-Null

try {
    foreach ($file in @("discloud.config", "main.py", "requirements.txt", "alembic.ini")) {
        $sourcePath = Join-Path $projectRoot $file
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Arquivo necessário não encontrado: $sourcePath"
        }

        Copy-Item -LiteralPath $sourcePath -Destination $stageRoot
    }

    $deploymentEnv = "DATABASE_URL=sqlite+aiosqlite:///./data/orla.sqlite3`n"
    [System.IO.File]::WriteAllText(
        (Join-Path $stageRoot ".env"),
        $deploymentEnv,
        [System.Text.UTF8Encoding]::new($false)
    )

    foreach ($folder in @("src", "alembic", "scripts", "assets")) {
        $sourceRoot = Join-Path $projectRoot $folder
        if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
            throw "Pasta necessária não encontrada: $sourceRoot"
        }

        Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
            Where-Object {
                $_.FullName -notmatch '[\\/](?:__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache)[\\/]' -and
                $_.Extension -ne ".pyc"
            } |
            ForEach-Object {
                $relativePath = $_.FullName.Substring($sourceRoot.Length).TrimStart([char[]]@('\', '/'))
                $archivePath = Join-Path $stageRoot (Join-Path $folder $relativePath)
                $archiveDirectory = Split-Path -Parent $archivePath
                New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null
                Copy-Item -LiteralPath $_.FullName -Destination $archivePath
            }
    }

    if ($Mode -eq "Initial") {
        $databasePath = Join-Path $projectRoot "data\orla.sqlite3"
        if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
            throw "Banco SQLite não encontrado: $databasePath. Crie e inicialize data\orla.sqlite3 antes do pacote inicial."
        }

        $archiveDataPath = Join-Path $stageRoot "data"
        New-Item -ItemType Directory -Path $archiveDataPath | Out-Null
        Copy-Item -LiteralPath $databasePath -Destination $archiveDataPath
    }

    $zipPath = Join-Path $buildRoot $zipName
    Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath -Force
    Write-Host "Pacote criado: $zipPath"
    if ($Mode -eq "Initial") {
        Write-Host "Este pacote inclui data\orla.sqlite3. Pare o bot local antes de gerá-lo para copiar o banco com segurança."
    } else {
        Write-Host "Este pacote não inclui a pasta data nem arquivos de banco de dados."
    }
}
finally {
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    $resolvedStage = [System.IO.Path]::GetFullPath($stageRoot)
    if (
        $resolvedStage.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedStage).StartsWith("orla-discloud-", [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
