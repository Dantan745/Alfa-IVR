"""Обёртка над моделью коллеги. Сам anti_fraud_infer.py не меняем."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from anti_fraud_infer import score_transfer  # noqa: E402


def score_one(sample):
    is_night = int(sample.get("is_night") or 0)
    out = score_transfer(sample, is_night=is_night)
    out["engine"] = "anti_fraud.joblib"
    return out


def main():
    raw = sys.stdin.read() or "{}"
    payload = json.loads(raw)
    if isinstance(payload, list):
        print(json.dumps([score_one(s) for s in payload], ensure_ascii=False))
    else:
        print(json.dumps(score_one(payload), ensure_ascii=False))


if __name__ == "__main__":
    main()
