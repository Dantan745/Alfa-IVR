'''Инференс рекомендации одного клиента. JSON на stdin, JSON на stdout.'''
import json
import sys

from recommend import infer_client


def main():
    payload = json.loads(sys.stdin.read() or '{}')
    rows = payload.get('transactions', payload if isinstance(payload, list) else [])
    with_text = bool(payload.get('text', True)) if isinstance(payload, dict) else True
    print(json.dumps(infer_client(rows, with_text=with_text), ensure_ascii=False))


if __name__ == '__main__':
    main()
