# AYA - Windows quick start: .env, database, packages, demo data, LiveKit and the site, in one go.
# Run through baslat.bat (double-click). Safe to run again: every step is idempotent.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "    $t" -ForegroundColor Green }
function Warn($t) { Write-Host "    $t" -ForegroundColor Yellow }
function Stop-With($t) { Write-Host ""; Write-Host "HATA: $t" -ForegroundColor Red; exit 1 }
function Test-Port($port) {
  try { $c = New-Object Net.Sockets.TcpClient; $r = $c.BeginConnect("127.0.0.1", $port, $null, $null); $ok = $r.AsyncWaitHandle.WaitOne(800) -and $c.Connected; $c.Close(); return $ok } catch { return $false }
}
function Wait-Port($port, $seconds) { for ($i = 0; $i -lt $seconds; $i++) { if (Test-Port $port) { return $true }; Start-Sleep -Seconds 1 }; return $false }
function Run($file, $arguments) { & $file @arguments; if ($LASTEXITCODE -ne 0) { Stop-With "'$file $($arguments -join ' ')' basarisiz oldu (kod $LASTEXITCODE)." } }

Step "1/7  Node.js kontrol ediliyor"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Stop-With "Node.js yuklu degil. https://nodejs.org adresinden LTS surumunu kurup bu dosyayi yeniden calistirin." }
$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -lt 18) { Stop-With "Node.js 18 veya daha yenisi gerekli (kurulu: $nodeMajor). https://nodejs.org" }
Ok "Node $(node -v)"

Step "2/7  .env dosyasi"
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) { Copy-Item (Join-Path $root ".env.example") $envPath; Ok ".env.example kopyalandi" }
$env_text = [IO.File]::ReadAllText($envPath)
if ($env_text -match 'DATABASE_URL="mysql://user:password@') {
  $env_text = $env_text -replace 'DATABASE_URL="[^"]*"', 'DATABASE_URL="mysql://root:@127.0.0.1:3306/aya"'
  Ok "DATABASE_URL = XAMPP varsayilani (root, sifresiz, veritabani: aya; yoksa otomatik olusturulur)"
}
if ($env_text -match 'AUTH_SECRET="change-me"') {
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $env_text = $env_text -replace 'AUTH_SECRET="change-me"', ('AUTH_SECRET="' + [Convert]::ToBase64String($bytes) + '"')
  Ok "AUTH_SECRET uretildi"
}
if ($env_text -match 'CRON_SECRET="change-me"') {
  $bytes = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $env_text = $env_text -replace 'CRON_SECRET="change-me"', ('CRON_SECRET="' + [Convert]::ToBase64String($bytes) + '"')
}
[IO.File]::WriteAllText($envPath, $env_text, (New-Object Text.UTF8Encoding($false)))
Ok ".env hazir"

Step "3/7  Veritabani sunucusu (MySQL / MariaDB, port 3306)"
if (Test-Port 3306) { Ok "3306 portunda bir veritabani sunucusu zaten calisiyor" }
else {
  $mysqld = "C:\xampp\mysql\bin\mysqld.exe"; $ini = "C:\xampp\mysql\bin\my.ini"
  if (Test-Path $mysqld) {
    Warn "XAMPP MySQL baslatiliyor..."
    Start-Process -WindowStyle Minimized -FilePath $mysqld -ArgumentList @("--defaults-file=$ini", "--standalone", "--console")
    if (-not (Wait-Port 3306 40)) { Stop-With "XAMPP MySQL baslamadi. XAMPP Control Panel'i acip MySQL satirinda Start'a basin, sonra bu dosyayi yeniden calistirin." }
    Ok "XAMPP MySQL calisiyor"
  } else {
    Stop-With "3306 portunda veritabani yok ve XAMPP bulunamadi. XAMPP Control Panel'den MySQL'i baslatin (ya da Docker: docker run -d -p 3306:3306 -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 -e MARIADB_DATABASE=aya mariadb:11) ve yeniden calistirin."
  }
}

$siteUp = Test-Port 3000   # a running site locks Prisma's engine file on Windows: do not reinstall or regenerate under it
Step "4/7  Paketler (ilk seferde birkac dakika surer)"
if ($siteUp -and (Test-Path (Join-Path $root "node_modules"))) { Warn "Site zaten acik; paket kurulumu atlandi." }
else { Run "npm.cmd" @("install", "--no-audit", "--no-fund"); Ok "paketler hazir" }

Step "5/7  Veritabani tablolari ve ornek veriler"
if (-not $siteUp) { Run "npx.cmd" @("prisma", "generate") }
Run "npx.cmd" @("prisma", "db", "push", "--skip-generate")
Run "npm.cmd" @("run", "seed:demo")
& node scripts\demo-trial.js
Ok "tablolar ve demo hesaplar hazir"

Step "6/7  Canli yayin sunucusu (LiveKit, port 7880)"
if (Test-Port 7880) { Ok "LiveKit zaten calisiyor" }
elseif (Test-Path (Join-Path $root "livekit-server.exe")) {
  Start-Process -WindowStyle Minimized -FilePath (Join-Path $root "livekit-server.exe") -ArgumentList @("--dev") -WorkingDirectory $root
  if (Wait-Port 7880 20) { Ok "LiveKit baslatildi" } else { Warn "LiveKit 7880 portunda gorunmuyor; canli yayin calismayabilir (Windows Guvenlik Duvari izin sorarsa 'Erisime izin ver' deyin)." }
} else { Warn "livekit-server.exe bulunamadi; canli yayin calismaz, site calisir." }

Step "7/7  Site baslatiliyor"
if (Test-Port 3000) { Warn "3000 portunda zaten bir sey calisiyor; o adres aciliyor." }
else {
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", "title AYA sunucusu && cd /d `"$root`" && npm.cmd run dev") -WorkingDirectory $root
  Write-Host "    Ilk acilista sayfalar derlenirken 20-60 sn beklenebilir..."
  if (-not (Wait-Port 3000 180)) { Stop-With "Site 3 dakika icinde acilmadi. 'AYA sunucusu' penceresindeki hatayi okuyun." }
}
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Green
Write-Host " AYA calisiyor:  http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "  Sifre (hepsi icin): Passw0rd!"
Write-Host "  Yonetici : admin@aya.test"
Write-Host "  Ogretmen : elif@aya.test   (onayli)"
Write-Host "  Ogretmen : mert@aya.test   (DENEME ogretmeni: yayini denetlenir)"
Write-Host "  Ogrenci  : ayse@aya.test"
Write-Host ""
Write-Host "  Ayni tarayicida tek hesap acik olur: digerleri icin gizli pencere kullanin."
Write-Host "  Kapatmak icin 'AYA sunucusu' ve LiveKit pencerelerini kapatin."
Write-Host "=============================================================" -ForegroundColor Green
