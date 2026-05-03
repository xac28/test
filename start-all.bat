@echo off
title Namaste Enterprise - Kontrol Paneli
color 0A

:menu
cls
echo =======================================================
echo          NAMASTE YOGA PLATFORMU - BASLATICI
echo =======================================================
echo.
echo 1. Web'i Gelistirme Modunda Baslat (npm run dev)
echo 2. Web'i Uretim (Production) Modunda Baslat
echo 3. Mobil Uygulamayi Baslat (Expo Start)
echo 4. HER SEYI BASLAT (Web Dev + Mobil + LiveKit)
echo 5. Sadece Veritabanini Guncelle (Prisma DB Push)
echo 6. LiveKit Video Sunucusunu Baslat
echo 7. Cikis
echo.
echo =======================================================
set /p secim="Lutfen bir islem secin (1-7): "

if "%secim%"=="1" goto dev
if "%secim%"=="2" goto prod
if "%secim%"=="3" goto mobile
if "%secim%"=="4" goto start_all
if "%secim%"=="5" goto dbpush
if "%secim%"=="6" goto livekit
if "%secim%"=="7" goto end

goto menu

:dev
cls
echo [1/2] Veritabani guncelleniyor...
call npx prisma db push
echo.
echo [2/2] Web Gelistirme sunucusu baslatiliyor...
npm run dev
pause
goto menu

:prod
cls
echo [1/4] Onbellek (Cache) temizleniyor... (Eski CSS sorunlari icin)
if exist .next rmdir /s /q .next

echo [2/4] Veritabani hazirlaniyor...
call npx prisma db push
echo.
echo [3/4] Proje Enterprise seviyesinde derleniyor (Build)...
call npm run build
echo.
echo [4/4] Canli sunucu baslatiliyor...
npm run start
pause
goto menu

:mobile
cls
echo Mobil uygulama klasorune geciliyor...
cd namaste-mobile
echo Expo baslatiliyor... Lutfen QR kodu bekleyin.
npx expo start -c
cd ..
pause
goto menu

:start_all
cls
echo =======================================================
echo HER SEY AYNI ANDA BASLATILIYOR... (Ayri Pencerelerde)
echo =======================================================
echo.
echo 1. Veritabani Guncelleniyor...
call npx prisma db push

echo 2. LiveKit Baslatiliyor...
start cmd /k "title LiveKit Server && if exist livekit-server.exe (livekit-server.exe --dev) else (docker run -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev)"

echo 3. Web Sunucusu (Production) Baslatiliyor...
start cmd /k "title Namaste Web Server && npm run build && npm run start"

echo 4. Mobil Sunucu (Expo) Baslatiliyor...
start cmd /k "title Namaste Mobile (Expo) && cd namaste-mobile && npx expo start -c"

echo.
echo Tum sistemler ayri pencerelerde baslatildi!
pause
goto menu

:dbpush
cls
echo Veritabani tablolari MySQL'e gonderiliyor...
call npx prisma db push
echo Islem tamamlandi!
pause
goto menu

:livekit
cls
echo LiveKit Video Sunucusu baslatiliyor...
if exist livekit-server.exe (
    echo [BILGI] livekit-server.exe bulundu. Direkt olarak baslatiliyor...
    livekit-server.exe --dev
) else (
    echo [BILGI] livekit-server.exe bulunamadi. Docker uzerinden deneniyor...
    docker run -d -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev
    echo LiveKit arka planda Docker ile baslatildi!
)
pause
goto menu

:end
exit
