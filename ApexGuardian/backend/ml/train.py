import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ml.dataset import TrafficDataPipeline

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "congestion_model_v3_fixed.pkl")

def train_and_evaluate():
    """Trains XGBoost Regressor for Congestion Factor and saves model weights."""
    print("==================================================")
    print("  TRAINING XGBOOST CONGESTION MODEL (V3.0 FIXED)  ")
    print("==================================================")
    
    print("[Trainer] Loading chronological splits...")
    X_train, y_train, X_val, y_val, X_test, y_test, feature_names = TrafficDataPipeline.get_train_val_test_splits()
    
    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Features: {feature_names}")
    
    model = xgb.XGBRegressor(
        n_estimators=100, 
        max_depth=6, 
        learning_rate=0.05, 
        random_state=42, 
        n_jobs=-1
    )
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
