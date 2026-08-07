import os
import numpy as np
from typing import Tuple, Dict, Any, List

class TrafficDataPipeline:
    """Feature Engineering Pipeline for Real Kaggle Bengaluru Traffic Dataset."""

    CSV_PATH = os.path.join(os.path.dirname(__file__), "datasets", "cleaned_traffic.csv")

    @classmethod
    def load_kaggle_bengaluru_dataset(cls) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Loads real 6,001-row Kaggle Bengaluru traffic dataset from cleaned_traffic.csv."""
        if not os.path.exists(cls.CSV_PATH):
            print(f"[Dataset WARNING] Real dataset file not found at {cls.CSV_PATH}. Using synthetic fallback...")
            return cls._generate_synthetic_fallback()

        try:
            # Read CSV using NumPy for high performance and zero external pandas dependency
            raw_data = np.genfromtxt(cls.CSV_PATH, delimiter=',', skip_header=1)
            
            # Columns: road_type, time_of_day, day_of_week, historical_avg_speed, weather_condition, distance_km, actual_speed
            X = raw_data[:, :6]
            y = raw_data[:, 6]
            feature_names = ["road_type", "time_of_day", "day_of_week", "historical_avg_speed", "weather_condition", "distance_km"]

            print(f"[Dataset SUCCESS] Successfully loaded real Kaggle dataset from {cls.CSV_PATH} ({len(X)} rows × {X.shape[1]} features).")
            return X, y, feature_names
        except Exception as err:
            print(f"[Dataset ERROR] Error parsing {cls.CSV_PATH}: {err}. Using synthetic fallback...")
            return cls._generate_synthetic_fallback()

    @staticmethod
    def _generate_synthetic_fallback(num_samples: int = 5000) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Synthetic fallback generator in case cleaned_traffic.csv is missing."""
        np.random.seed(42)

        time_of_day = np.random.uniform(0.0, 24.0, num_samples)
        day_of_week = np.random.randint(0, 7, num_samples)
        road_type = np.random.choice([1, 2, 3], size=num_samples, p=[0.25, 0.45, 0.30])
        weather_severity = np.random.choice([0, 1, 2], size=num_samples, p=[0.70, 0.20, 0.10])
        distance_km = np.random.uniform(0.5, 8.0, num_samples)
        historical_avg_speed = np.where(road_type == 1, 55.0, np.where(road_type == 2, 38.0, 24.0))

        actual_speed = historical_avg_speed - np.random.uniform(2.0, 15.0, num_samples)
        actual_speed = np.clip(actual_speed, 6.0, 65.0)

        feature_names = ["road_type", "time_of_day", "day_of_week", "historical_avg_speed", "weather_condition", "distance_km"]
        X = np.column_stack([road_type, time_of_day, day_of_week, historical_avg_speed, weather_severity, distance_km])
        y = actual_speed

        return X, y, feature_names

    @classmethod
    def prepare_training_data(cls) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepares feature matrix X and target vector y for model training."""
        return cls.load_kaggle_bengaluru_dataset()

class TrafficDatasetLoader:
    """Legacy compatibility loader for Random Forest and Stage 1 models."""
    @staticmethod
    def load_dataset() -> Tuple[np.ndarray, np.ndarray]:
        X, y, _ = TrafficDataPipeline.load_kaggle_bengaluru_dataset()
        return X, y

    @staticmethod
    def load_or_generate_dataset(num_samples: int = 6000) -> Tuple[np.ndarray, np.ndarray]:
        X, y, _ = TrafficDataPipeline.load_kaggle_bengaluru_dataset()
        return X, y

pipeline = TrafficDataPipeline()
