import json
import sys

from recommend import discuss_client, infer_client


def main():
    payload = json.loads(sys.stdin.read() or '{}')
    rows = payload.get('transactions', payload if isinstance(payload, list) else [])
    if isinstance(payload, dict) and payload.get('messages') is not None:
        result = discuss_client(rows, payload.get('recommendation') or '', payload.get('messages') or [])
    else:
        with_text = bool(payload.get('text', True)) if isinstance(payload, dict) else True
        result = infer_client(rows, with_text=with_text)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
