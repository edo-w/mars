$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $repoRoot 'dev/mars-vscode'
$publishedServer = Join-Path $repoRoot 'dev/mars-lsp/dist/aot/Mars.Lsp.exe'
$packagedServerDirectory = Join-Path $extensionRoot 'server/win32-x64'
$packagedServer = Join-Path $packagedServerDirectory 'Mars.Lsp.exe'

if (-not (Test-Path -LiteralPath $publishedServer -PathType Leaf)) {
	throw "The Native AOT server is missing: $publishedServer"
}

New-Item -ItemType Directory -Force -Path $packagedServerDirectory | Out-Null
Copy-Item -LiteralPath $publishedServer -Destination $packagedServer -Force

Push-Location $extensionRoot
try {
	bun run package
	if ($LASTEXITCODE -ne 0) {
		exit $LASTEXITCODE
	}
}
finally {
	Pop-Location
}
