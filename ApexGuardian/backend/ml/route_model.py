import os
from typing import Optional
import joblib
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ml.dataset import TrafficDataPipeline
from core.region import REGIONS, get_region

class RouteCongestionPredictor:
    """V3.0 ML Model for Apex Guardian.
    
    Predicts a Congestion Factor (multiplier) based on topological route features
    and temporal context, strictly avoiding origin/destination memorization.
    Supports distinct regional models (e.g. Bengaluru, Coimbatore).
    """
    
    def __init__(self):
        self.weights_dir = os.path.join(os.path.dirname(__file__), "weights")
        self._models: dict = {}
        
        if not os.path.exists(self.weights_dir):
            os.makedirs(self.weights_dir)
            
        self.load_models()

    def load_models(self):
        """Pre-load weights for all registered regions that have model files."""
        for key, reg in REGIONS.items():
            path = os.path.join(self.weights_dir, reg.model_filename)
            if os.path.exists(path):
                try:
                    self._models[key] = joblib.load(path)
                    print(f"[RouteCongestionPredictor] Loaded model for '{key}' from {path}")
                except Exception as e:
                    print(f"[RouteCongestionPredictor] Could not load model for '{key}': {e}")
            else:
                print(f"[RouteCongestionPredictor] No model found for '{key}' at {path}")

    @property
    def model(self):
        """Backward-compatibility: returns model for the default active region."""
        active_key = get_region().key
        return self.get_model(active_key)

    @model.setter
    def model(self, value):
        active_key = get_region().key
        self._models[active_key] = value

    def get_model(self, region_key: Optional[str] = None):
        """Retrieve the model for a specific region key."""
        key = (region_key or get_region().key).strip().lower()
        if key in self._models:
            return self._models[key]
        if key in REGIONS:
            path = os.path.join(self.weights_dir, REGIONS[key].model_filename)
            if os.path.exists(path):
                try:
                    self._models[key] = joblib.load(path)
                    return self._models[key]
                except Exception:
                    pass
        return None

    def predict_congestion_factor(self, osrm_dist: float, osrm_dur_min: float, steps_count: int, 
                                 turns: int, roundabouts: int, avg_step_len: float,
                                 hour: int, day_of_week: int, is_weekend: int, month: int,
                                 region_key: Optional[str] = None) -> float:
        """Predicts the congestion multiplier for a specific route within the given region."""
        model = self.get_model(region_key)
        if model is None:
            # Fallback to 1.0 (baseline standard travel time) if model is missing or region unsupported
            return 1.0
            
        features = np.array([[hour, day_of_week, is_weekend, month,
                              osrm_dist, osrm_dur_min, steps_count, turns, roundabouts, avg_step_len]])
        
        try:
            pred = model.predict(features)[0]
            # Never predict negative or zero time. Hard floor at 0.5x.
            return max(0.5, float(pred))
        except Exception:
            return 1.0


# Global instance
predictor = RouteCongestionPredictor()
