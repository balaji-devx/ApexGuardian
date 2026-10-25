import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ml.dataset import TrafficDataPipeline
from core.region import get_region

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, get_region().model_filename)

def train_and_evaluate():
    """Trains XGBoost Regressor for Congestion Factor and saves model weights."""
    print("==================================================")
    print("  TRAINING XGBOOST CONGESTION MODEL (V3.0 FIXED)  ")
    print("==================================================")
    
    print("[Trainer] Loading chronological splits...")
    X_train, y_train, X_val, y_val, X_test, y_test, feature_names = TrafficDataPipeline.get_train_val_test_splits()
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Features: {feature_names}")
    
    # Preserve the original Bengaluru training parameters exactly. For the much larger
    # Coimbatore synthetic dataset, use histogram trees and two worker threads to reduce
    # peak RAM/CPU pressure on typical student laptops.
    model_kwargs = {
        "n_estimators": 100,
        "max_depth": 6,
        "learning_rate": 0.05,
        "random_state": 42,
        "n_jobs": -1,
    }
    region = get_region()
    if region.key == "coimbatore":
        model_kwargs["tree_method"] = "hist"
        model_kwargs["n_jobs"] = min(2, os.cpu_count() or 1)
    model = xgb.XGBRegressor(**model_kwargs)
    model.fit(X_train, y_train)
    
    val_preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, val_preds)
    r2 = r2_score(y_val, val_preds)
    print(f"Validation -> MAE: {mae:.3f}x, R2: {r2:.2f}")
    
    # Test set evaluation
    test_preds = model.predict(X_test)
    test_mae = mean_absolute_error(y_test, test_preds)
    test_rmse = np.sqrt(mean_squared_error(y_test, test_preds))
    test_r2 = r2_score(y_test, test_preds)
    test_mape = np.mean(np.abs((y_test - test_preds) / y_test))
    
    print("\n=== FINAL TEST METRICS (Unseen Future Data) ===")
    print(f"MAE:  {test_mae:.3f}x")
    print(f"RMSE: {test_rmse:.3f}x")
    print(f"R²:   {test_r2:.2f}")
    print(f"MAPE: {test_mape:.2f}")

    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Saved XGBoost model weights to: {MODEL_PATH}")
    return model

if __name__ == "__main__":
    train_and_evaluate()
