from pathlib import Path
import joblib
import numpy as np


BUNDLE_PATH = Path(__file__).with_name('anti_fraud.joblib')
bundle = None

def load_bundle(path=BUNDLE_PATH):
    global bundle
    if bundle is None:
        bundle = joblib.load(path)
    return bundle


def score_transfer(sample, is_night=0):
    bundle = load_bundle()
    model = bundle['model']
    features = list(bundle['features'])
    values = [float(sample[name]) for name in features]
    raw = float(-model.decision_function(np.array([values], dtype=float))[0])
    score = (raw - float(bundle['min'])) / (float(bundle['max']) - float(bundle['min']) + 1e-10)
    final_score = score + float(bundle.get('night_weight', 0) or 0) * int(is_night)
    anomaly = int(final_score >= float(bundle['threshold']))
    return {
        'score': score,
        'final_score': final_score,
        'anomaly': anomaly,
    }
