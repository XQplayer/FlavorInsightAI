param([switch]$Check, [string]$ConfigPath = '', [ValidateRange(1024, 65535)][int]$Port = 18887)

$projectRoot = Split-Path -Parent $PSScriptRoot
$privateConfig = if ($ConfigPath) { [System.IO.Path]::GetFullPath($ConfigPath) } else { Join-Path $projectRoot '.env.local' }
if (-not (Test-Path -LiteralPath $privateConfig -PathType Leaf)) {
    throw 'Private .env.local is missing. Create it beside .env.example in this worktree.'
}

$allowedNames = @(
    'FLAVOR_AI_MODE', 'FLAVOR_AI_ALLOW_LOCAL_REAL', 'OPENAI_API_KEY', 'OPENAI_MODEL',
    'FLAVOR_AI_ALLOWED_ORIGINS', 'FLAVOR_AI_SUPABASE_URL', 'FLAVOR_AI_SUPABASE_ANON_KEY', 'FLAVOR_AI_PRIVATE_TASK_TOOLS_ENABLED',
    'FLAVOR_AI_MAX_INPUT_CHARS', 'FLAVOR_AI_MAX_OUTPUT_TOKENS', 'FLAVOR_AI_TIMEOUT_SECONDS',
    'FLAVOR_AI_REQUESTS_PER_MINUTE', 'FLAVOR_AI_REQUESTS_PER_DAY', 'FLAVOR_AI_CONCURRENT_PER_USER',
    'FLAVOR_AI_SESSION_WRITES_PER_MINUTE', 'FLAVOR_AI_MAX_CONVERSATIONS',
    'FLAVOR_AI_INPUT_USD_PER_MILLION', 'FLAVOR_AI_CACHED_INPUT_USD_PER_MILLION', 'FLAVOR_AI_OUTPUT_USD_PER_MILLION'
)

foreach ($rawLine in [System.IO.File]::ReadAllLines($privateConfig)) {
    $line = $rawLine.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -le 0) { throw 'Invalid .env.local entry; expected NAME=value.' }
    $name = $line.Substring(0, $separator).Trim()
    if ($name -cnotin $allowedNames) { throw "Unsupported .env.local setting: $name" }
    $value = $line.Substring($separator + 1).Trim()
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

if ($env:FLAVOR_AI_MODE -cne 'openai') { throw 'Set FLAVOR_AI_MODE=openai in .env.local.' }
if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY) -or [string]::IsNullOrWhiteSpace($env:OPENAI_MODEL)) {
    throw 'OPENAI_API_KEY and OPENAI_MODEL must both be configured in .env.local.'
}
if ($env:FLAVOR_AI_ALLOW_LOCAL_REAL -cne 'true') {
    throw 'Set FLAVOR_AI_ALLOW_LOCAL_REAL=true for the local-only verification session.'
}
if ([string]::IsNullOrWhiteSpace($env:FLAVOR_AI_ALLOWED_ORIGINS)) {
    $env:FLAVOR_AI_ALLOWED_ORIGINS = 'http://127.0.0.1:5195'
}

Write-Output 'AI local configuration: mode=openai; key=present; model=present; local-only access=enabled.'
if ($Check) {
    Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
    return
}

$env:HOST = '127.0.0.1'
$env:PORT = [string]$Port
$env:PUBLIC_SPECTRUM_INDEX_AUTO_INSTALL = 'false'
Push-Location $projectRoot
try { python -u fema_proxy_server.py }
finally {
    Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
    Pop-Location
}
