# noahsark.su — настройка DNS для GitHub Pages через reg.ru API
# 1) Получаем текущие записи зоны
# 2) Удаляем все A-записи на @
# 3) Добавляем 4 A-записи @ → GH Pages IPs
# 4) Добавляем CNAME www → aslankaa1-droid.github.io

param(
    [string]$Domain = "noahsark.su",
    [string]$CertPath = "E:\Проекты Аслана\GrandHubAi - Агентский сервис\regru-api\my.crt",
    [string]$KeyPath  = "E:\Проекты Аслана\GrandHubAi - Агентский сервис\regru-api\my.key",
    [string]$CredFile = "C:\Users\ais001\Documents\Клод\пароли.txt"
)

$ErrorActionPreference = "Stop"

Write-Host "=== reg.ru DNS setup: $Domain ===" -ForegroundColor Cyan

$creds = @{}
Get-Content $CredFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match "^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$") { $creds[$matches[1].Trim()] = $matches[2].Trim() }
}
$Username = $creds["regru_username"]; if (-not $Username) { $Username = $creds["USERNAME"] }
$Password = $creds["regru_api_password"]; if (-not $Password) { $Password = $creds["ALT_API_PASSWORD"] }
if (-not $Password) { $Password = $creds["API_PASSWORD"] }
if (-not $Username -or -not $Password) { Write-Error "Нет username/password в $CredFile (ключи: $($creds.Keys -join ', '))" }
Write-Host "Аккаунт reg.ru: $Username" -ForegroundColor Gray

$cert = Get-PfxCertificate -FilePath $CertPath

function Invoke-RegRu {
    param([string]$Method, [hashtable]$Payload)
    $url = "https://api.reg.ru/api/regru2/$Method"
    $Payload["username"] = $Username
    $Payload["password"] = $Password
    $Payload["output_format"] = "json"
    $json = $Payload | ConvertTo-Json -Compress -Depth 6
    return Invoke-RestMethod -Uri $url -Method Post -Certificate $cert `
        -Body @{ input_data = $json; input_format = "json" } `
        -ContentType "application/x-www-form-urlencoded"
}

# 1. Получить текущие записи
Write-Host "`n--- 1. Текущие записи $Domain ---" -ForegroundColor Cyan
$rr = Invoke-RegRu "zone/get_resource_records" @{ domains = @(@{ dname = $Domain }) }
$rr | ConvertTo-Json -Depth 10 | Out-File "$PSScriptRoot\dns_before.json" -Encoding utf8
Write-Host "RAW ответ:" -ForegroundColor DarkGray
$rr | ConvertTo-Json -Depth 10 | Write-Host
$records = @()
if ($rr.answer -and $rr.answer.domains) {
    $records = $rr.answer.domains[0].rrs
}
if ($records) {
    $records | Format-Table subname, rectype, content -AutoSize | Out-String | Write-Host
} else {
    Write-Host "Записей не найдено или ошибка чтения зоны" -ForegroundColor Yellow
}

# 2. Удалить все A/AAAA/CNAME на @ и www
Write-Host "`n--- 2. Чистка @ и www ---" -ForegroundColor Cyan
foreach ($r in $records) {
    if (($r.subname -eq "@" -or $r.subname -eq "" -or $r.subname -eq "www") -and `
        ($r.rectype -in @("A","AAAA","CNAME"))) {
        Write-Host "  remove: $($r.subname) $($r.rectype) $($r.content)" -ForegroundColor Yellow
        $payload = @{
            domains   = @(@{ dname = $Domain })
            subdomain = if ($r.subname -eq "") { "@" } else { $r.subname }
            content   = $r.content
            record_type = $r.rectype
        }
        try {
            $resp = Invoke-RegRu "zone/remove_record" $payload
            if ($resp.result -eq "success") { Write-Host "    OK" -ForegroundColor Green }
            else { Write-Host "    ERR: $($resp.error_text)" -ForegroundColor Red }
        } catch { Write-Host "    EXC: $_" -ForegroundColor Red }
    }
}

# 3. Добавить 4 A-записи @ → GH Pages
Write-Host "`n--- 3. A-записи @ → GH Pages ---" -ForegroundColor Cyan
$ghIPs = @("185.199.108.153","185.199.109.153","185.199.110.153","185.199.111.153")
foreach ($ip in $ghIPs) {
    Write-Host "  add A: @ → $ip" -ForegroundColor Yellow
    $resp = Invoke-RegRu "zone/add_alias" @{
        domains = @(@{ dname = $Domain }); subdomain = "@"; ipaddr = $ip
    }
    if ($resp.result -eq "success") { Write-Host "    OK" -ForegroundColor Green }
    else { Write-Host "    ERR: $($resp.error_text)" -ForegroundColor Red }
}

# 4. CNAME www → aslankaa1-droid.github.io
Write-Host "`n--- 4. CNAME www → aslankaa1-droid.github.io ---" -ForegroundColor Cyan
$resp = Invoke-RegRu "zone/add_cname" @{
    domains = @(@{ dname = $Domain }); subdomain = "www"
    canonical_name = "aslankaa1-droid.github.io."
}
if ($resp.result -eq "success") { Write-Host "  OK" -ForegroundColor Green }
else { Write-Host "  ERR: $($resp.error_text)" -ForegroundColor Red }

# 5. Финальная сверка
Write-Host "`n--- 5. После изменений ---" -ForegroundColor Cyan
$rr2 = Invoke-RegRu "zone/get_resource_records" @{ domains = @(@{ dname = $Domain }) }
$rr2 | ConvertTo-Json -Depth 8 | Out-File "$PSScriptRoot\dns_after.json" -Encoding utf8
$rr2.answer.domains[0].rrs | Format-Table subname, rectype, content -AutoSize | Out-String | Write-Host

Write-Host "`n=== DONE ===" -ForegroundColor Green
