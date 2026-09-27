$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$cacheRoot = Join-Path $repoRoot '.cache'
$coverageRoot = Join-Path $repoRoot 'coverage'
$rawResults = Join-Path $coverageRoot 'raw'
$manifest = Join-Path $repoRoot '.config/dotnet-tools.json'
$solution = Join-Path $repoRoot 'dev/mars.slnx'

$resolvedRawResults = [System.IO.Path]::GetFullPath($rawResults)
$repoPrefix = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$isInsideRepo = $resolvedRawResults.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)

if (-not $isInsideRepo) {
	throw "Coverage results path is outside the repository: $resolvedRawResults"
}

$env:DOTNET_CLI_HOME = Join-Path $cacheRoot 'dotnet'
$env:NUGET_PACKAGES = Join-Path $cacheRoot 'nuget'
$env:NUGET_HTTP_CACHE_PATH = Join-Path $cacheRoot 'nuget-http'
$env:TEMP = Join-Path $cacheRoot 'tmp'
$env:TMP = $env:TEMP
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'

New-Item -ItemType Directory -Path $env:DOTNET_CLI_HOME, $env:NUGET_PACKAGES, $env:NUGET_HTTP_CACHE_PATH, $env:TEMP -Force | Out-Null

if (-not (Test-Path -LiteralPath $manifest)) {
	throw "ReportGenerator tool manifest is missing: $manifest"
}

Set-Location $repoRoot

dotnet restore $solution --packages $env:NUGET_PACKAGES --no-http-cache
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

dotnet tool restore --tool-manifest $manifest --no-cache
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

if (Test-Path -LiteralPath $rawResults) {
	Remove-Item -LiteralPath $rawResults -Recurse -Force
}

New-Item -ItemType Directory -Path $rawResults -Force | Out-Null

dotnet test $solution --no-restore --collect:'XPlat Code Coverage' --results-directory $rawResults
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

$reportPattern = Join-Path $rawResults '**/coverage.cobertura.xml'
$reportArgument = "-reports:$reportPattern"
$targetArgument = "-targetdir:$coverageRoot"
$generatedFileFilter = '-filefilters:-*/obj/*;-*\obj\*'

dotnet tool run reportgenerator -- $reportArgument $targetArgument '-reporttypes:Html' $generatedFileFilter
if ($LASTEXITCODE -ne 0) {
	exit $LASTEXITCODE
}

$indexPath = Join-Path $coverageRoot 'index.html'
Write-Output "Coverage report: $indexPath"
