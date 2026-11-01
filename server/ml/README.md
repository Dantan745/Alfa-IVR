# Инструкция для ML (Даниил Иваненко)

**Актуальная схема скоринга (2026):** [`METOD-RABOTY.md`](./METOD-RABOTY.md) — как баллы считаются на платеже, почему Python не блокирует сайт, что видит админ и чего не видит клиент.

Привет. Твои файлы модели **не трогаем**:

- `server/ml/anti_fraud.joblib`
- `server/ml/anti_fraud_infer.py`

Их вызывает обёртка `server/ml/score.py`. Если нужно обновить модель — просто замени `anti_fraud.joblib` (и при необходимости `anti_fraud_infer.py`) тем же API: `score_transfer(sample, is_night=0)`.

## Как это работает в приложении

1. Сервер собирает фичи в `server/ml/features.mjs`.
2. Вызов: `python server/ml/score.py` (JSON в stdin, JSON в stdout).
3. Скор пишется на перевод (`mlFeatures`, `mlScore`, `mlAnomaly`).
4. Если `anomaly` и `final_score >= 0.9` — перевод блокируется.
5. Админка `/admin` → вкладка **ML / прогноз** показывает отчёт и список фичей.

Живой сайт: https://alfa-koshelek-cr.fly.dev/admin

## Фичи, используемые для обучения модели антифрода

Имена должны совпадать с `bundle['features']` в joblib.

| Имя | Смысл |
|-----|--------|
| `amount` | абсолютная сумма операции |
| `amount_to_avg_ratio` | во сколько раз операция превышает средний чек пользователя |
| `hour` | час суток (0–23) |
| `is_night` | ночная операция с 23:00 до 06:00 (0/1). В твоём infer это вес после скора, не колонка IsolationForest |
| `is_new_payee` | первый перевод этому получателю (0/1) |
| `login_attempts` | попытки входа, от 1 и выше |
| `time_since_last_transaction` | секунды с последней транзакции этого пользователя |
| `new_device` | новая пара «id аккаунта + id устройства» (в модель уходит как `is_new_device`) |

Сейчас IsolationForest ждёт:

`amount`, `amount_to_avg_ratio`, `hour`, `login_attempts`, `is_new_payee`, `time_since_last_transaction`, `is_new_device`.

## Локальный прогон скора

Нужны Python 3, `joblib`, `numpy`, `scikit-learn` (лучше **1.6.1**, как при сохранении joblib).

```bat
cd /d D:\AlfaKoshelekCR\server\ml
pip install joblib numpy scikit-learn==1.6.1
echo {"amount":50000,"amount_to_avg_ratio":4.2,"hour":2,"is_night":1,"is_new_payee":1,"login_attempts":5,"time_since_last_transaction":30,"is_new_device":1} | python score.py
```

Ответ:

```json
{"score": 0.99, "final_score": 1.19, "anomaly": 1, "engine": "anti_fraud.joblib"}
```

## Как подложить новую модель

1. Положи новый `anti_fraud.joblib` рядом с `anti_fraud_infer.py`.
2. Сохрани в бандле ключи: `model`, `features`, `threshold`, `night_weight`, `min`, `max`.
3. Если сигнатура `score_transfer` не меняется — больше ничего править не нужно.
4. Если набор фичей другой — напиши в `features.mjs` (не правь прод-код вслепую) или скажи, какие поля ждать.

## API для проверки

- `GET /api/admin/ml` — отчёт (ключ админа в заголовке `X-Admin-Key`)
- `GET /api/admin/ml/features` — ряды + fraud-фичи для обучения

Ключ по умолчанию: `AlfaDev-2026` (консоль сервера).

## Android

Контракт экранов: `android/docs/ml-contract.md`.  
На телефоне пока эвристика с теми же 8 фичами; TFLite можно подставить в `AnomalyDetector`, UI не ломая.

## Что не делать

- Не коммить `server/data.json`, `server/notify.json`, `.env`.
- Не переименовывай `score_transfer`, если нет новой обёртки.
- Не клади TFLite в debug-сборку, пока модель не лёгкая.
