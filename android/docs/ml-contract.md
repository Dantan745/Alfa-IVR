# ML-контракт (для Даниила Иваненко)

Приложение уже рисует баннер аномалии и блокирует перевод при `shouldBlock = true`.  
Сейчас стоит `HeuristicAnomalyDetector` — правила на сумме / новом получателе / ночи. **Не тащи TFLite в debug, пока модель не готова:** на слабом телефоне это лишние десятки мегабайт RAM.

## Вход

`TxFeatures` (`ru.raidzyu.alfacr.ml.TxFeatures`) и серверные фичи обучения (`server/ml/features.mjs`):

## Фичи, используемые для обучения модели антифрода

1. `amount` — абсолютная сумма операции;
2. `amount_to_avg_ratio` — во сколько раз операция превышает средний чек пользователя;
3. `hour` — час суток (0-23);
4. `is_night` — бинарный флаг ночной операции (с 23:00 до 06:00);
5. `is_new_payee` — флаг первого перевода новому получателю (0 или 1);
6. `login_attempts` — количество попыток входа (от 1 и выше);
7. `time_since_last_transaction` — время после последней транзакции пользователя;
8. `new_device` — сопоставляет id девайса и id аккаунта и смотрит, была ли раньше такая пара.

На сервере модель коллеги: `server/ml/anti_fraud.joblib` + `anti_fraud_infer.py` (поля модели: amount, amount_to_avg_ratio, hour, login_attempts, is_new_payee, time_since_last_transaction, is_new_device; `is_night` идёт весом после скора).

## Выход

```json
{ "score": 0.72, "label": "high", "explanation": "…", "shouldBlock": false }
```

`score` 0..1. `label`: `low` | `medium` | `high`.

## Куда вставлять

1. Реализуй `AnomalyDetector` (TFLite Interpreter или HTTP к Python-сервису).
2. В `WalletRepository` конструктор: `detector: AnomalyDetector = MyDetector()`.
3. `PaymentForecaster` — прогноз расходов до конца месяца (карточка «Прогноз» на главной).

Не меняй Compose-экраны ради модели: они читают `ml_alerts` и `AnomalyResult`.

## Данные для обучения

Таблица `transactions` в `alfa_cr.db` (Device File Explorer). Экспорт можно сделать позже отдельным debug-экраном.
