import os
import joblib
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from ml.dataset import TrafficDataPipeline

class RouteCongestionPredictor:
    """V3.0 ML Model for Apex Guardian.
    
    Predicts a Congestion Factor (multiplier) based on topological route features
    and temporal context, strictly avoiding origin/destination memorization.
    """
    
    def __init__(self):
        self.model = None
        self.weights_dir = os.path.join(os.path.dirname(__file__), "weights")
        self.model_path = os.path.join(self.weights_dir, "congestion_model_v3_fixed.pkl")
        
        if not os.path.exists(self.weights_dir):
            os.makedirs(self.weights_dir)
            
        self.load_model()
        
    def load_model(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            print(f"[RouteCongestionPredictor] Loaded fixed V3.0 congestion model from {self.model_path}")
        else:
            print("[RouteCongestionPredictor] No model found. Please train.")
            
    def predict_congestion_factor(self, osrm_dist: float, osrm_dur_min: float, steps_count: int, 
                                 turns: int, roundabouts: int, avg_step_len: float,
                                 hour: int, day_of_week: int, is_weekend: int, month: int) -> float:
        """Predicts the congestion multiplier for a specific route."""
        if self.model is None:
            # Fallback to 1.0 (no congestion) if model is missing
            return 1.0
            
        features = np.array([[hour, day_of_week, is_weekend, month,
                              osrm_dist, osrm_dur_min, steps_count, turns, roundabouts, avg_step_len]])
        
        pred = self.model.predict(features)[0]
        # Never predict negative or zero time. Hard floor at 0.5x.
        return max(0.5, float(pred))


# Global instance
predictor = RouteCongestionPredictor()

