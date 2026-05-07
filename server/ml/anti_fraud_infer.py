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


def score_transfer(sample):
    bundle = load_bundle()
    model = bundle['model']
    features = list(bundle['features'])
    values = [float(sample[name]) for name in features]
    raw = float(-model.decision_function(np.array([values], dtype=float))[0])
    score = (raw - float(bundle['min'])) / (float(bundle['max']) - float(bundle['min']) + 1e-10)
    anomaly = int(score >= float(bundle['threshold']))
    return {
        'score': score,
        'final_score': score,
        'anomaly': anomaly,
    }
