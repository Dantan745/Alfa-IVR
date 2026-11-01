import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

DIR = Path(__file__).resolve().parent
BUNDLE_PATH = DIR / 'recommended_clusters.joblib'
MSK = timezone(timedelta(hours=3))

RULES = [
    ('поездки', r'авиакомпани|авиалини|турист|круиз|отел|мотел|курорт|аренде автомобил|прокат автомобил|базы отдыха|аттракцион'),
    ('транспорт', r'такси|автобус|железн|бензозаправ|техобслуживан|транспортировк|транспорт|паркинг'),
    ('еда', r'продовольствен|супермаркет|бакалей|ресторан|закусоч|кондитер|булочн|молочн|общественного питания|бары|провизи|спиртн|кафе|продукт'),
    ('покупки', r'магазин|универмаг|одежд|обув|товары для дома|бытов|электронн|электроник|спорттовар|игруш|косметик|ювелир|зоомагаз|канцтовар|книжн|мебел|звукозапис'),
]
CLUSTER_COLUMNS = ['avg_check', 'counts', 'еда', 'транспорт', 'покупки', 'поездки']


def category_group(txt):
    s = str(txt).lower()
    for name, pattern in RULES:
        if re.search(pattern, s):
            return name
    return None


def _day_hour(row):
    if row.get('day') is not None and str(row.get('day')).strip() != '':
        day = int(float(row['day']))
        hour = int(float(row.get('hour') or 0))
        return day, hour
    raw_dt = row.get('tr_datetime')
    if raw_dt is not None and str(raw_dt).strip():
        time = str(raw_dt).split(' ', 1)
        day = int(float(time[0]))
        hour = int(time[1][0:2]) if len(time) > 1 else 0
        return day, hour
    ts = row.get('createdAt', row.get('created_at'))
    if ts is None:
        return 0, 0
    stamp = datetime.fromtimestamp(float(ts) / 1000, MSK)
    return stamp.date().toordinal(), stamp.hour


def expenses_from_rows(rows):
    parsed = []
    for row in rows or []:
        amount = row.get('amount')
        if amount is None:
            continue
        amount = float(amount)
        if not amount < 0:
            continue
        day, hour = _day_hour(row)
        mcc_description = row.get('mcc_description')
        if mcc_description is None or not str(mcc_description).strip():
            mcc_description = row.get('category') or row.get('name') or ''
        mcc_code = row.get('mcc_code')
        if mcc_code is None or not str(mcc_code).strip():
            mcc_code = mcc_description
        parsed.append({
            'mcc_code': str(mcc_code),
            'mcc_description': str(mcc_description),
            'day': day,
            'hour': hour,
            'amount': abs(amount),
        })
    frame = pd.DataFrame(parsed, columns=['mcc_code', 'mcc_description', 'day', 'hour', 'amount'])
    if frame.empty:
        return frame
    return frame.sort_values(['mcc_code', 'day', 'hour'])


def amount_change_90(one):
    rows = []

    for _, g in one.groupby('mcc_code'):
        g = g.sort_values(['day', 'hour']).copy()
        days = g['day'].to_numpy()
        amounts = g['amount'].to_numpy()

        change = []
        left = 0
        day_start = 0
        window_sum = 0.0
        window_count = 0
        for i in range(len(g)):
            if days[i] != days[day_start]:
                window_sum += amounts[day_start:i].sum()
                window_count += i - day_start
                day_start = i
                while left < day_start and days[left] < days[i] - 90:
                    window_sum -= amounts[left]
                    window_count -= 1
                    left += 1

            if window_count:
                change.append(amounts[i] - window_sum / window_count)
            else:
                change.append(float('NaN'))

        g['amount_change_90'] = change
        rows.append(g)

    return pd.concat(rows)


def prepare_client(frame):
    out = frame.sort_values(['mcc_code', 'day', 'hour']).copy()
    out['diff_days'] = out.groupby('mcc_code')['day'].diff()
    out = amount_change_90(out)
    out['diff_days'] = out['diff_days'].fillna('прошлого платежа ещё не было')
    out['amount_change_90'] = out['amount_change_90'].fillna('нет информации за три прошедших месяца')

    data_cluster = out.copy()
    data_cluster['customer_id'] = 0
    data_cluster['group'] = data_cluster['mcc_description'].map(category_group)
    sum_per_client = data_cluster.groupby('customer_id')['amount'].agg(sums='sum', counts='count')
    sum_per_client['avg_check'] = sum_per_client['sums'] / sum_per_client['counts']
    sums_per_cat_for_client = data_cluster.dropna(subset=['group']).groupby(['customer_id', 'group'])['amount'].sum().unstack(fill_value=0).reindex(columns=['еда', 'транспорт', 'покупки', 'поездки'], fill_value=0)
    sums_per_cat_for_client = sums_per_cat_for_client.div(sum_per_client['sums'], axis=0)
    features_for_clusters = sum_per_client[['avg_check', 'counts']].join(sums_per_cat_for_client).fillna(0)
    return out, features_for_clusters.iloc[0]


def load_clusters(path=None):
    return joblib.load(path or BUNDLE_PATH)


def assign_cluster(features, bundle):
    values = pd.DataFrame([{column: float(features[column]) for column in bundle['columns']}])
    scaled = bundle['scaler'].transform(values)[0]
    exemplars = np.asarray(bundle['exemplars'])
    labels = np.asarray(bundle['labels'])
    distances = np.linalg.norm(exemplars - scaled, axis=1)
    nearest = int(np.argmin(distances))
    return int(labels[nearest])


def build_prompt(regular, cluster_row, descriptions):
    prompt = (
        'По таблицам ниже напиши короткую рекомендацию этому клиенту на русском. '
        'Используй только числа и категории из таблиц. '
        'Если кластер равен -1, тему по кластеру не предлагай. '
        'Описание группы только поясняет номер кластера. '
        'Не называй клиента словами из описания кластера. '
        'Частая категория не означает регулярный платёж. '
        'Регулярной считай категорию только если разрыв между платежами устойчиво держится примерно от 7 до 40 дней и суммы близки. '
        'Разрыв около одного дня и сильно разные суммы - это частые траты, а не шаблон. '
        'Если такой категории нет, напиши, что регулярного платежа нет. '
        'Регулярный платёж упоминай только если он есть по этому правилу. '
        'Не предлагай категорию только потому, что в ней больше всего строк. '
        'Факты бери из его чека, числа операций и долей. '
        'В совете назови только долю, которая явно больше остальных. Долю около 5% и ниже не упоминай. '
        'Не называй долю основной, пока не сравнишь её сумму с суммами других категорий в таблице. Если другая категория больше в рублях, не пиши, что эта доля доминирует. '
        'Саму рекомендацию строй по заметной доле или по регулярному платежу, если он есть. '
        'В конце предложи одну конкретную услугу по этой доле или по регулярному платежу, например кэшбэк или бонус. Не заканчивай текст одним названием категории.'
        'Сначала найди регулярный платёж по разрыву и одинаковым суммам, даже если таких строк меньше, чем в других категориях. '
        'Разрывы и суммы посчитай кодом, не прикидывай по тексту. '
        'Если четыре доли близки к нулю, не выдумывай процент и не строй совет по самой частой категории.\n'
        + json.dumps(
            {
                'регулярность': regular.to_dict(orient='records'),
                'кластер': cluster_row,
                'описание_групп': descriptions,
            },
            ensure_ascii=False,
            default=str,
        )
    )
    return prompt


def _gigachat_messages(contents):
    messages = []
    for item in contents or []:
        role = 'assistant' if item.get('role') == 'model' else 'user'
        lines = []
        for part in item.get('parts') or []:
            text = part.get('text')
            if text:
                lines.append(text)
        line = '\n'.join(lines).strip()
        if line:
            messages.append({'role': role, 'content': line[:8000]})
    return messages


_gigachat_token_cache = {'token': '', 'until': 0.0}


def _urlopen(req, timeout):
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.URLError as error:
        if 'CERTIFICATE_VERIFY_FAILED' not in str(error.reason):
            raise
        return urllib.request.urlopen(req, timeout=timeout, context=ssl._create_unverified_context())


def _gigachat_token(auth):
    now = time.time()
    if _gigachat_token_cache['token'] and now < _gigachat_token_cache['until']:
        return _gigachat_token_cache['token'], None
    url = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
    body = b'scope=GIGACHAT_API_PERS'
    req = urllib.request.Request(url, data=body, headers={
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': str(uuid.uuid4()),
        'Authorization': 'Basic ' + auth,
    })
    try:
        with _urlopen(req, 20) as resp:
            result = json.load(resp)
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', errors='replace')[:500]
        return None, f'GigaChat auth {error.code}: {detail}'
    except urllib.error.URLError as error:
        return None, f'GigaChat auth: {error.reason}'
    token = result.get('access_token') or ''
    if not token:
        return None, 'GigaChat не выдал токен'
    _gigachat_token_cache['token'] = token
    _gigachat_token_cache['until'] = now + 25 * 60
    return token, None


def ask_gigachat(prompt=None, contents=None):
    auth = (os.environ.get('GIGACHAT_AUTH_KEY') or '').strip()
    if auth.lower().startswith('basic '):
        auth = auth[6:].strip()
    if not auth:
        return None, 'Нет GIGACHAT_AUTH_KEY'
    token, error = _gigachat_token(auth)
    if error:
        return None, error
    if contents is None:
        messages = [{'role': 'user', 'content': str(prompt or '')[:24000]}]
    else:
        messages = _gigachat_messages(contents)
    if not messages:
        return None, 'Нет сообщения'
    body = json.dumps({
        'model': 'GigaChat',
        'messages': messages,
        'temperature': 0.3,
        'max_tokens': 1200,
    }).encode()
    last_error = None
    for url in (
        'https://api.giga.chat/v1/chat/completions',
        'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
    ):
        req = urllib.request.Request(url, data=body, headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + token,
        })
        try:
            with _urlopen(req, 40) as resp:
                result = json.load(resp)
        except urllib.error.HTTPError as error:
            detail = error.read().decode('utf-8', errors='replace')[:500]
            last_error = f'GigaChat {error.code}: {detail}'
            continue
        except urllib.error.URLError as error:
            last_error = f'GigaChat: {error.reason}'
            continue
        choices = result.get('choices') or []
        if not choices:
            last_error = 'GigaChat не вернул текст'
            continue
        answer = choices[0].get('message', {}).get('content') or ''
        if not answer.strip():
            last_error = 'GigaChat не вернул текст'
            continue
        return answer.strip(), None
    return None, last_error


def _plain(value):
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float):
        return float(value)
    if isinstance(value, int):
        return int(value)
    return value


def client_prompt(rows, bundle=None):
    frame = expenses_from_rows(rows)
    if frame.empty:
        return None
    prepared, feature_row = prepare_client(frame)
    if bundle is None:
        bundle = load_clusters()
    cluster_row = feature_row.to_dict()
    cluster_row['cluster'] = assign_cluster(feature_row, bundle)
    regular = prepared[['mcc_description', 'hour', 'amount', 'diff_days', 'amount_change_90']]
    return build_prompt(regular, cluster_row, bundle['descriptions'])


def discuss_client(rows, recommendation, messages, bundle=None):
    prompt = client_prompt(rows, bundle)
    text = str(recommendation or '').strip()
    contents = [{'role': 'user', 'parts': [{'text': prompt or 'Обсуди рекомендацию с клиентом.'}]}]
    if text:
        contents.append({'role': 'model', 'parts': [{'text': text}]})
    for message in messages or []:
        role = 'model' if message.get('role') == 'model' else 'user'
        line = str(message.get('text') or '').strip()
        if line:
            contents.append({'role': role, 'parts': [{'text': line[:4000]}]})
    if not contents or contents[-1]['role'] != 'user':
        return {'reply': None, 'recommendation_error': 'Нет сообщения'}
    reply, error = ask_gigachat(contents=contents)
    return {'reply': reply, 'recommendation_error': error}


def infer_client(rows, bundle=None, with_text=True):
    frame = expenses_from_rows(rows)
    if frame.empty:
        return {
            'regularity': [],
            'cluster_features': {column: 0 for column in CLUSTER_COLUMNS},
            'cluster': None,
            'descriptions': {},
            'recommendation': 'Пока нет списаний, по которым можно собрать рекомендацию.',
            'recommendation_error': None,
        }
    prepared, feature_row = prepare_client(frame)
    if bundle is None:
        bundle = load_clusters()
    cluster_row = feature_row.to_dict()
    cluster_row['cluster'] = assign_cluster(feature_row, bundle)
    descriptions = bundle['descriptions']
    regular = prepared[['mcc_description', 'hour', 'amount', 'diff_days', 'amount_change_90']]
    recommendation = None
    error = None
    if with_text:
        prompt = build_prompt(regular, cluster_row, descriptions)
        recommendation, error = ask_gigachat(prompt)
    return {
        'regularity': regular.to_dict(orient='records'),
        'cluster_features': {column: _plain(cluster_row[column]) for column in CLUSTER_COLUMNS},
        'cluster': int(cluster_row['cluster']),
        'descriptions': descriptions,
        'recommendation': recommendation,
        'recommendation_error': error,
    }
