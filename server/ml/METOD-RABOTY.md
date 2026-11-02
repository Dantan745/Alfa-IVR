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

Модель отдаёт **два поля отдельно**. Шкалу в решение не превращаем.

| Поле | Что это | Кто смотрит |
|------|---------|-------------|
| `anomaly` | `0` или `1` | решение |
| `final_score` | непрерывный скор, **не вероятность** | насколько близко к порогу |

Порог внутри joblib: **0.71**.

- `final_score < 0.71` → `anomaly = 0` → метка **Норма**, платёж идёт.
- `final_score >= 0.71` → `anomaly = 1` → метка **Фрод**, платёж **отклоняется** до списания.

Примеры: **66/100 ещё Норма**, **71/100 уже Фрод** — потому что так сказала метка `anomaly`, а не потому что бэкенд сам режет по числу на шкале. **28** — спокойно, **66** — у границы, **99** — явный выброс.

Подпись «Фрод / Норма» берём **только из `anomaly`**.

---

## Как показывать `final_score` в админке

Скор может вылезти **выше 1** — это нормально для IsolationForest после нормировки, это не процент.

- Число: `round(final_score × 100) / 100` (например `0.66`, `0.71`, `1.12`).
- Шкала (полоска): `min(100, round(final_score × 100))`.
- Если скор > 1, **число на экране может быть больше 100**, полоска всё равно упирается в 100.

Клиенту **ни метка, ни число не отдаются**. В ответе `/api/me` и снимке кошелька поля `ml*` / `risk*` вырезаются. При отказе клиент видит нейтральное «Операция отклонена…», без score.

---

## Что происходит в момент операции

1. `features.mjs` → `buildFraudSample` собирает фичи под `bundle['features']`.
2. `score.py` вызывает твой `score_transfer` и возвращает `{ score, final_score, anomaly }`.
3. Решение: **только** `anomaly === 1` → перевод / QR / массовый / пополнение отклоняются.
4. На транзакцию пишется `mlScore` (= `final_score`), `mlAnomaly`, фичи.
5. Админка рисует метку из `mlAnomaly` и шкалу из `final_score`.
6. Ручная заморозка в админке — отдельно, не из шкалы.

Балльной таблицы (Норма / Терпимо / Мошенник по плюсикам) **больше нет**.

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
- Не решать Фрод по числу на шкале: решение только `anomaly`.

Старая короткая шпаргалка: `server/ml/README.md`.
