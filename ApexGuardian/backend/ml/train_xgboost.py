import os
import sys
import joblib
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
from xgboost import XGBRegressor

sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from ml.dataset import TrafficDataPipeline

def train_xgboost_model():
    print("==================================================")
    print("  TRAINING XGBOOST REGRESSOR ON REAL KAGGLE DATASET ")
    print("==================================================")

    X, y, feature_names = TrafficDataPipeline.prepare_training_data()

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(
        n_estimators=150,
        learning_rate=0.08,
        max_depth=6,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42
    )

    print(f"Training XGBRegressor on {len(X_train)} real Kaggle samples...")
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    r2 = r2_score(y_test, preds)
    mae = mean_absolute_error(y_test, preds)

    print(f"XGBoost Model R^2 Score: {r2:.4f}")
    print(f"XGBoost Model MAE:       {mae:.2f} km/h")

    weights_dir = os.path.join(os.path.dirname(__file__), "weights")
    os.makedirs(weights_dir, exist_ok=True)
    model_path = os.path.join(weights_dir, "xgboost_traffic.pkl")

    joblib.dump(model, model_path)
    print(f"Saved trained XGBoost model weights to: {model_path}")

    return model, r2, mae

if __name__ == "__main__":
    train_xgboost_model()
