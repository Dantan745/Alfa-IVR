# Alfa Кошелёк ЦР

Учебный Android-прототип кошелька цифрового рубля для кейса Альфа-Банка (молодая аудитория).  
**Не является банковским продуктом и не подключен к платформе ЦБ.**

Дизайн: тёмная тема Figma Make (акцент `#00D2D3`, фон `#121212`).  
Сценарий MVP: **первый перевод ЦР** (онбординг → баланс → перевод с лимитами и ML-проверкой → история).

## Запуск на другом компьютере

1. Android Studio (Ladybug / 2024.2+) и **JDK 17+** (подойдёт JBR из Studio).
2. SDK Platform **35 или 36**, Build-Tools, Android SDK.
3. Клонировать репозиторий. **Не копировать** `local.properties` — Studio создаст его сама (`sdk.dir=...`).
4. File → Open на корень проекта → Sync → Run.
5. Из консоли (Windows), если `JAVA_HOME` указывает на JDK 17+, а не на Java 8:

```bat
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat assembleDebug
```

На Windows путь с кириллицей (`Рабочий стол`) разрешён через `android.overridePathCheck=true` в `gradle.properties`.

Если на диске C: мало места, перед сборкой:

```bat
set GRADLE_USER_HOME=D:\gradle-home
```

### Демо-вход

| Поле | Значение |
|------|----------|
| Email | `ivan@alfa.demo` |
| Пароль | `Demo1234` |
| PIN | `1234` |
| SMS-код | любой (прототип) |

Кнопки «Альфа-Банк» / «Госуслуги» — демо без OAuth.

Шрифты Roboto и Manrope лежат в `app/src/main/res/font` (без CDN).

- `minSdk 24` (Android 7.0) — телефоны, планшеты, Android Go, складные.
- Камера и отпечаток **не required**.
- На широких экранах UI центрируется (макс. 480 dp), на узких — на всю ширину.
- Не нужен Google Play Services.

## Архитектура (для ML и backend)

```
ui/          Compose-экраны
data/        Room + WalletRepository
data/security  PBKDF2, EncryptedSharedPreferences
ml/          AnomalyDetector — подмена без смены UI
data/remote  заглушка API
```

Подключение модели: [docs/ml-contract.md](docs/ml-contract.md).  
Продуктовый кейс: [docs/product-case.md](docs/product-case.md).

Теги в коде: `ML:`, `BACKEND:`, `DEMO:`.

## Память

Нет WebView и TensorFlow в MVP. Списки — LazyColumn. Баланс в копейках (`Long`). Release: R8 + shrinkResources.

## Важно

Это прототип с **локальной SQLite**. Деньги не настоящие. Паспорт на регистрации хэшируется и не логируется.
