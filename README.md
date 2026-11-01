# Alfa Кошелёк ЦР

Концепт **1-в-1 с видео** `Цифровой_рубль_итог.mp4` — веб-прототип Figma Make (рамка 393px, фон `#121212`).

## Структура

| Папка | Что это |
|-------|---------|
| `web\` | Итоговый UI как на ролике (React 19 + Vite + Tailwind) |
| `android\` | Учебный native-прототип (Jetpack Compose). **Не** пиксель-в-пиксель с видео |
| `docs\` | Короткие заметки |

Видео не копировали: оно остаётся в Документах.

## Запуск полноценного приложения (сервер на этом ПК)

Нужен Node.js 20+ (`node -v`). Дважды щёлкните `D:\AlfaKoshelekCR\start.bat` — поднимутся API (`:8787`) и веб (`:8443`).

```bat
cd /d D:\AlfaKoshelekCR
start.bat
```

- Этот компьютер: [http://localhost:8443/](http://localhost:8443/)
- Телефоны / планшеты / другие ПК в той же Wi‑Fi: `http://IP-ЭТОГО-ПК:8443/`
- API: [http://localhost:8787/api/health](http://localhost:8787/api/health)

Данные общие: регистрация, баланс, переводы между кошельками (по телефону, email или ID). База — файл `server\data.json`.

Демо: `ivan@alfa.demo` / `Demo1234`, SMS — любые 4 цифры. Новый аккаунт стартует с 0 ₽.

## Только UI без сервера (старый режим)

```bat
cd /d D:\AlfaKoshelekCR\web
npm install
set PORT=8443
npm run dev
```

Открыть в браузере: [http://localhost:8443/](http://localhost:8443/)

Демо: кнопка **Войти** → появляется SMS → **Подтвердить** (код любой).  
Либо **Альфа-Банк**. **Госуслуги** в макете без OAuth.

Экраны ролика: авторизация, перевод, главная, лимиты, платежи, смарт-контракт, адресная книга, история, профиль, регистрация.

## ML / антифрод (для Даниила)

Инструкция: [`server/ml/README.md`](server/ml/README.md).

Модель лежит в `server/ml/anti_fraud.joblib`, инференс — `server/ml/anti_fraud_infer.py` (эти два файла — зона ML, приложение их только вызывает).

Админка: [https://alfa-koshelek-cr.fly.dev/admin](https://alfa-koshelek-cr.fly.dev/admin) → вкладка **ML / прогноз**.

## Android (не эталон картинки)

Открыть в Android Studio папку `D:\AlfaKoshelekCR\android`.  
Файл `local.properties` Studio создаст сама (`sdk.dir=...`).

```bat
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set GRADLE_USER_HOME=D:\gradle-home
cd /d D:\AlfaKoshelekCR\android
gradlew.bat assembleDebug
```

Демо: `ivan@alfa.demo` / `Demo1234`, PIN `1234`.
