import os
import joblib
import numpy as np
from typing import List, Dict, Any

class XGBoostTrafficPredictor:
    """Inference Engine for XGBoost / GradientBoosting Traffic Congestion Model."""

    def __init__(self):
        self.model_path = os.path.join(os.path.dirname(__file__), "weights", "xgboost_traffic.pkl")
        self.model = self._load_or_train_model()

    def _load_or_train_model(self):
        if os.path.exists(self.model_path):
            try:
                return joblib.load(self.model_path)
            except Exception as e:
                print(f"[XGBoost] Error loading model weights: {e}. Training new model...")

        try:
            from ml.train_xgboost import train_xgboost_model
            model, _, _ = train_xgboost_model()
            return model
        except ModuleNotFoundError:
            # Fallback to GradientBoostingRegressor if xgboost wheel is downloading
            from sklearn.ensemble import GradientBoostingRegressor
            from ml.dataset import TrafficDataPipeline

            print("[XGBoost] Falling back to sklearn GradientBoostingRegressor while xgboost wheel finishes...")
            X, y, _ = TrafficDataPipeline.prepare_training_data()
            model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.08, max_depth=5, random_state=42)
            model.fit(X, y)
            
            os.makedirs(os.path.join(os.path.dirname(__file__), "weights"), exist_ok=True)
            joblib.dump(model, self.model_path)
            return model

    def predict_edge_speeds(self, edges: List[Dict[str, Any]]) -> List[float]:
        """Predicts speed in km/h for a list of graph edge feature dictionaries."""
        if not edges:
            return []

        feature_rows = []
        for edge in edges:
            road_type = edge.get("road_type", 2)
            time_of_day = edge.get("time_of_day", 17.5) # default peak hour 5:30 PM
            day_of_week = edge.get("day_of_week", 2)
            school_zone_active = 1 if edge.get("school_zone_active") else 0
            market_peak_active = 1 if edge.get("market_peak_active") else 0
            weather_severity = edge.get("weather_severity", 0)

            feature_rows.append([
                road_type,
                time_of_day,
                day_of_week,
                school_zone_active,
                market_peak_active,
                weather_severity
            ])

        X = np.array(feature_rows)
        predicted_speeds = self.model.predict(X)
        return [float(np.clip(s, 5.0, 65.0)) for s in predicted_speeds]

xgb_predictor = XGBoostTrafficPredictor()
