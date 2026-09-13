from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Apex Guardian API"
    API_V1_STR: str = "/api/v1"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    MODEL_WEIGHTS_PATH: str = "ml/weights/congestion_model_v3_fixed.pkl"
    DATASET_PATH: str = "ml/datasets/cleaned_traffic.csv"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )

settings = Settings()
