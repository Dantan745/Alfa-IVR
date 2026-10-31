# ML-контракт (для Даниила Иваненко)

Приложение уже рисует баннер аномалии и блокирует перевод при `shouldBlock = true`.  
Сейчас стоит `HeuristicAnomalyDetector` — правила на сумме / новом получателе / ночи. **Не тащи TFLite в debug, пока модель не готова:** на слабом телефоне это лишние десятки мегабайт RAM.

## Вход

`TxFeatures` (`ru.raidzyu.alfacr.ml.TxFeatures`):

| Поле | Смысл |
|------|--------|
| amountKopecks | сумма в копейках |
| hourOfDay | 0–23 |
| isNewPayee | получателя нет в адресной книге |
| dailySpendKopecks | расход за сегодня + эта операция |
| avgAbsAmountKopecks | средняя \|сумма\| (пока константа, можно считать из Room) |
| category | категория |

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
