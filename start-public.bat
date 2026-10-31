@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === Alfa Кошелёк ЦР: сервер + постоянная ссылка ===
echo.

start "Alfa CR API" cmd /k "cd /d "%~dp0server" && node index.mjs"
timeout /t 2 /nobreak >nul
start "Alfa CR Tunnel" cmd /k "cd /d "%~dp0" && node keep-tunnel.mjs"

echo.
echo Постоянная ссылка (пока компьютер включён):
echo   https://alfa-koshelek-cr.loca.lt
echo.
echo Не закрывайте окна API и Tunnel.
echo 2FA: коды на телефон (SMS.ru) или на почту (SMTP) — настройка в /admin
echo Демо без СМС: ivan@alfa.demo / Demo1234
echo.
pause
