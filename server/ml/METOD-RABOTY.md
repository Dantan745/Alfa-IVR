# Новый метод антифрода (для Даниила Иваненко)

Привет. Как скоринг живёт в Alfa Кошелёк ЦР **сейчас**.  
Твои файлы **не меняем**:

- `anti_fraud.joblib`
- `anti_fraud_infer.py`

Их вызывает только обёртка `score.py`.

Живой админ: https://alfa-koshelek-cr.fly.dev/admin  
Ключ: `AlfaDev-2026` (заголовок `X-Admin-Key`).

---

## Два поля модели — и всё

Модель отдаёт **два поля**. Бэкенд сам фрод не решает: нет z-score, нет баллов по клиенту, нет шкалы «из 100».

| Поле | Что это | Что видно в админке |
|------|---------|---------------------|
| `anomaly` | `0` или `1` | метка **Норма** или **Фрод** |
| `final_score` | непрерывный скор, **не вероятность** | число `round(final_score × 100) / 100`, например `0.66` или `1.12` |

Порог сидит внутри joblib. Его читает только `anti_fraud_infer.py`. Если модель не ответила, в админке **нет оценки**, а не «Норма».

Клиенту **ни метка, ни число не отдаются**. В ответе `/api/me` и снимке кошелька поля `ml*` / `risk*` вырезаются. При отказе клиент видит нейтральное «Операция отклонена…», без score.

---

## Что происходит в момент операции

1. `features.mjs` → `buildFraudSample` собирает фичи под `bundle['features']`.
2. `score.py` вызывает твой `score_transfer` и возвращает `{ score, final_score, anomaly }`.
3. Решение: **только** `anomaly === 1` → перевод / QR / массовый / пополнение отклоняются.
4. На транзакцию пишется `mlScore` (= `final_score`) и `mlAnomaly`. Если Python не ответил, оба поля пустые, платёж не помечается фродом.
5. Админка пишет метку из `anomaly` и число `final_score`.
6. Ручная заморозка в админке — отдельно, это не решение модели.

Z-score, «Мошенник / Терпимо» и риск клиента баллами из админки убраны.

Отдельного размеченного CSV на GitHub нет. В модель уходят фичи новой операции, которые сервер собирает в момент платежа. Список колонок — `bundle['features']` в `anti_fraud.joblib`.

### Что из этого видно в админке

- `anomaly = 0`: платёж сохраняется. Вкладки **Операции**, карточка клиента и **ML / прогноз** показывают **Норма**, число `round(final_score × 100) / 100` и шкалу `min(100, round(final_score × 100))`. Пересчёт модели идёт в фоне и не останавливает сервер.
- Список «Фрод» — только строки с `anomaly = 1`.
- `anomaly = 1`: платёж отклоняется до записи. В списке операций его нет. Клиент видит «Операция отклонена…» без скора; `final_score` остаётся в логе сервера.

---

## Файлы

| Файл | Роль |
|------|------|
| `anti_fraud.joblib` | IsolationForest, как сохранил |
| `anti_fraud_infer.py` | `score_transfer(sample)` → `anomaly` + `final_score` |
| `score.py` | stdin JSON → stdout JSON, поле `engine` |
| `features.mjs` | сбор фичей |
| `index.mjs` | отчёт админки, прогноз, scored |
| `server/index.mjs` | вызов на платеже, отказ по `anomaly`, скрытие от клиента |

Локальный прогон:

```bat
cd /d D:\AlfaKoshelekCR\server\ml
pip install joblib numpy scikit-learn==1.6.1
echo {"log_amount":10.8,"amount_to_avg_ratio":4.2,"hour":2,"is_night":1,"is_new_payee":1,"login_attempts":5,"time_since_last_transaction":30,"is_new_device":1,"amount_to_balance":0.9} | python score.py
```

Ответ вида `{"score":..., "final_score":..., "anomaly":0|1, "engine":"anti_fraud.joblib"}`.

---

## Как обновить модель

1. Положи новый `anti_fraud.joblib` рядом с `anti_fraud_infer.py`.
2. Бандл: `model`, `features`, `threshold` (сейчас 0.71), `min`, `max`.
3. Сигнатура `score_transfer` та же — обёртку не трогаем.
4. Другой набор фичей — напиши в `features.mjs` или скажи поля.

---

## Чего не делать

- Не править `anti_fraud.joblib` / `anti_fraud_infer.py` из чужих рефакторингов.
- Не коммитить `server/data.json`, `notify.json`, `.env`.
- Не показывать клиенту `anomaly` / `final_score` / «Фрод».
- Не решать Фрод по числу скора, z-score или баллам: решение только `anomaly`.

Старая короткая шпаргалка: `server/ml/README.md`.
