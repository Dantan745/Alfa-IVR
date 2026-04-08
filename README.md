# Alfa Кошелёк ЦР

Кошелёк цифрового рубля: веб, сервер и Android.

## Запуск

Нужен Node.js 20+. В корне репозитория:

```bat
start.bat
```

Поднимаются API (`:8787`) и веб (`:8443`).

- Этот компьютер: http://localhost:8443/
- Телефоны в той же Wi‑Fi: `http://IP-ЭТОГО-ПК:8443/`
- API: http://localhost:8787/api/health

Демо: `ivan@alfa.demo` / `Demo1234`. Код из SMS — любые 4 цифры.

База — PostgreSQL. Код на телефон приходит в Telegram [@AlfaKoshelekCRBot](https://t.me/AlfaKoshelekCRBot).

## Только веб без сервера

```bat
cd web
npm install
set PORT=8443
npm run dev
```

## Установка

Windows: `shell\release\AlfaKoshelekCR-Setup.exe`  
Android: `shell\android\app\build\outputs\apk\debug\app-debug.apk`

Сборка: `cd shell` → `npm install` → `npm run build:win` или `npm run build:android`.

## Android

Открыть папку `android` в Android Studio.

Демо: `ivan@alfa.demo` / `Demo1234`, PIN `1234`.
