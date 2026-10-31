@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Alfa Кошелёк ЦР: сервер + веб ===
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set LAN=%%a
)
set LAN=%LAN: =%

start "Alfa CR API" cmd /k "cd /d "%~dp0server" && node index.mjs"
timeout /t 1 /nobreak >nul
start "Alfa CR Web" cmd /k "cd /d "%~dp0web" && set PORT=8443&& npm run dev"

echo.
echo Этот компьютер:   http://localhost:8443/
if not "%LAN%"=="" echo Телефоны в Wi-Fi: http://%LAN%:8443/
echo API:              http://localhost:8787/api/health
echo Демо:             ivan@alfa.demo / Demo1234
echo.
echo Окна сервера и веба открыты. Не закрывайте их.
pause
