import os
from datetime import datetime, timezone
import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from ml.dataset import TrafficDatasetLoader

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "weights")
MODEL_PATH = os.path.join(WEIGHTS_DIR, "rf_traffic_model.pkl")

class SegmentSpeedPredictor:
    """Stage 1 ML Model: Random Forest Regressor for predicting real-time segment speeds."""
    
    def __init__(self):
        self.model = None
        self.load_or_train()

    def train_and_save(self):
        """Train Random Forest model on Bengaluru traffic dataset and persist weights."""
        os.makedirs(WEIGHTS_DIR, exist_ok=True)
        X, y = TrafficDatasetLoader.load_or_generate_dataset(num_samples=6000)
        
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=12,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X, y)
        joblib.dump(self.model, MODEL_PATH)

    def load_or_train(self):
        """Load trained weights or train if missing."""
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
            except Exception:
                self.train_and_save()
        else:
            self.train_and_save()

    def predict_segment_speed(
        self,
        road_type: int,
        time_of_day: int,
        day_of_week: int,
        historical_avg_speed: float,
        weather_condition: int,
        distance_km: float
    ) -> float:
        """Predict speed for a single road segment."""
        if self.model is None:
            self.load_or_train()

        features = np.array([[
            road_type,
            time_of_day,
            day_of_week,
            historical_avg_speed,
            weather_condition,
            distance_km
        ]])
        predicted_speed = float(self.model.predict(features)[0])
        return max(5.0, predicted_speed)

    def predict_speeds(self, segments: list[dict]) -> list[float]:
        """Batch predict real-time speeds for a list of road segment dicts, incorporating junction bottleneck weights."""
        if not segments:
            return []
        if self.model is None:
            self.load_or_train()

        now = datetime.now(timezone.utc)
        current_hour = now.hour
        current_day = now.weekday()

        feature_rows = []
        is_bottleneck_flags = []

        for s in segments:
            rt = s.get("road_type", 2)
            tod = s.get("time_of_day", current_hour)
            dow = s.get("day_of_week", current_day)
            h_speed = s.get("historical_avg_speed", 35.0)
            wc = s.get("weather_condition", 0)
            dist = s.get("distance_km", 1.0)
            is_bt = s.get("is_bottleneck", False)

            feature_rows.append([rt, tod, dow, h_speed, wc, dist])
            is_bottleneck_flags.append(is_bt)

        X_batch = np.array(feature_rows)
        preds = self.model.predict(X_batch)

        adjusted_preds = []
        for raw_sp, is_bt in zip(preds, is_bottleneck_flags):
            speed = float(raw_sp)
            # Inject junction bottleneck slowdown penalty (10-15 km/h at major signal bottlenecks)
            if is_bt:
                speed = min(speed, np.random.uniform(11.0, 15.5))
            adjusted_preds.append(max(5.0, speed))

        return adjusted_preds

# Singleton instance
predictor = SegmentSpeedPredictor()

if __name__ == "__main__":
    predictor.train_and_save()
    print(f"Random Forest model trained and saved to {MODEL_PATH}")
