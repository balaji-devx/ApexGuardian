import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from ml.dataset import TrafficDatasetLoader

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "rf_traffic_model.pkl")

def train_and_evaluate():
    """Trains Random Forest Regressor on real Kaggle dataset, evaluates R2/MAE metrics, and saves model weights."""
    print("==================================================")
    print("  TRAINING RANDOM FOREST ON REAL KAGGLE DATASET   ")
    print("==================================================")
    
    X, y = TrafficDatasetLoader.load_dataset()

    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    print(f"Training Random Forest Regressor on {len(X_train)} real Kaggle samples...")
    model = RandomForestRegressor(
        n_estimators=120,
        max_depth=12,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    print(f"Random Forest Model Metrics -> R^2 Score: {r2:.4f}, MAE: {mae:.2f} km/h")

    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Saved Random Forest model weights to: {MODEL_PATH}")
    return model

if __name__ == "__main__":
    train_and_evaluate()
