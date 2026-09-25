# Code dump: `E:\PROJECTS\ApexGuardian V2.0\ApexGuardian V2.0\ApexGuardian`

Total files: 60

## Table of contents

- `apex_codebase_audit.md`
- `backend\api\__init__.py`
- `backend\api\v1\__init__.py`
- `backend\api\v1\endpoints.py`
- `backend\core\__init__.py`
- `backend\core\config.py`
- `backend\core\region.py`
- `backend\main.py`
- `backend\ml\__init__.py`
- `backend\ml\dataset.py`
- `backend\ml\datasets\tml\osrm_cache.json`
- `backend\ml\recommender.py`
- `backend\ml\route_model.py`
- `backend\ml\train.py`
- `backend\requirements.txt`
- `backend\schemas\__init__.py`
- `backend\schemas\navigation.py`
- `backend\services\__init__.py`
- `backend\services\congestion_detector.py`
- `backend\services\nominatim.py`
- `backend\services\notification_service.py`
- `backend\services\osrm.py`
- `backend\services\reroute_engine.py`
- `backend\services\route_selection.py`
- `backend\services\traffic_scenario.py`
- `backend\services\traffic_service.py`
- `backend\tests\__init__.py`
- `backend\tests\test_api.py`
- `backend\tests\test_ml_pipeline.py`
- `backend\tests\test_new_features.py`
- `backend\tests\test_reroute_validation.py`
- `frontend\next-env.d.ts`
- `frontend\package-lock.json`
- `frontend\package.json`
- `frontend\postcss.config.js`
- `frontend\src\app\globals.css`
- `frontend\src\app\layout.tsx`
- `frontend\src\app\page.tsx`
- `frontend\src\components\map\MapCanvas.tsx`
- `frontend\src\components\ui\AdvanceAlertBanner.tsx`
- `frontend\src\components\ui\FloatingSearchPanel.tsx`
- `frontend\src\components\ui\MapControls.tsx`
- `frontend\src\components\ui\NavigationControlsHUD.tsx`
- `frontend\src\components\ui\NoFasterRouteToast.tsx`
- `frontend\src\components\ui\RerouteModal.tsx`
- `frontend\src\components\ui\RouteCard.tsx`
- `frontend\src\components\ui\TrafficLegend.tsx`
- `frontend\src\components\ui\TurnByTurnDrawer.tsx`
- `frontend\src\context\NavigationContext.tsx`
- `frontend\src\lib\alertManager.ts`
- `frontend\src\lib\api.ts`
- `frontend\src\lib\layoutZones.ts`
- `frontend\src\lib\maneuverInstructions.ts`
- `frontend\src\lib\pushNotificationService.ts`
- `frontend\src\lib\rerouteEngine.ts`
- `frontend\src\lib\trafficScenario.ts`
- `frontend\src\lib\ttsService.ts`
- `frontend\tailwind.config.ts`
- `frontend\tsconfig.json`
- `generate_codebase_md.py`

---


## `apex_codebase_audit.md`

````markdown
# Apex Guardian Codebase Audit
**Generated:** 2026-09-13 22:24:12

## Directory Tree
```text
backend/
    .env
    .env.example
    main.py
    requirements.txt
    .pytest_cache/
        .gitignore
        CACHEDIR.TAG
        README.md
        v/
            cache/
                lastfailed
                nodeids
    api/
        __init__.py
        v1/
            endpoints.py
            __init__.py
    core/
        config.py
        region.py
        __init__.py
    ml/
        dataset.py
        recommender.py
        route_model.py
        train.py
        __init__.py
    schemas/
        navigation.py
        __init__.py
    services/
        congestion_detector.py
        nominatim.py
        notification_service.py
        osrm.py
        reroute_engine.py
        traffic_service.py
        __init__.py
    tests/
        test_api.py
        test_ml_pipeline.py
        test_new_features.py
        test_reroute_validation.py
        __init__.py
frontend/
    .env.example
    .gitkeep
    next-env.d.ts
    next.config.mjs
    package-lock.json
    package.json
    postcss.config.js
    tailwind.config.ts
    tsconfig.json
    tsconfig.tsbuildinfo
    .pytest_cache/
        .gitignore
        CACHEDIR.TAG
        README.md
        v/
            cache/
                nodeids
    src/
        app/
            globals.css
            layout.tsx
            page.tsx
        components/
            map/
                MapCanvas.tsx
            ui/
                AdvanceAlertBanner.tsx
                FloatingSearchPanel.tsx
                MapControls.tsx
                NavigationControlsHUD.tsx
                NoFasterRouteToast.tsx
                RerouteModal.tsx
                RouteCard.tsx
                TrafficLegend.tsx
                TurnByTurnDrawer.tsx
        context/
            NavigationContext.tsx
        lib/
            alertManager.ts
            api.ts
            maneuverInstructions.ts
            pushNotificationService.ts
            rerouteEngine.ts
            ttsService.ts
```

## File Contents

### backend/.env
```
PORT=8000
ENVIRONMENT=development
OSRM_BASE_URL=https://router.project-osrm.org
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
MODEL_WEIGHTS_PATH=ml/weights/xgboost_traffic.pkl
DATASET_PATH=ml/datasets/cleaned_traffic.csv

```

### backend/.env.example
```
PROJECT_NAME="Apex Guardian API"
API_V1_STR="/api/v1"
PORT=8000
ENVIRONMENT="development"
NOMINATIM_BASE_URL="https://nominatim.openstreetmap.org"
OSRM_BASE_URL="https://router.project-osrm.org"
MODEL_WEIGHTS_PATH="ml/weights/congestion_model_v3_fixed.pkl"
DATASET_PATH="ml/datasets/cleaned_traffic.csv"
CORS_ORIGINS='["http://localhost:3000", "http://127.0.0.1:3000"]'

```

### backend/main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.v1.endpoints import router as api_v1_router

app = FastAPI(title="Apex Guardian Navigation Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "message": "Welcome to Apex Guardian Navigation Engine API",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
        "search": f"{settings.API_V1_STR}/search?q=Indiranagar"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


```

### backend/requirements.txt
```
fastapi>=0.110.0
uvicorn>=0.28.0
httpx>=0.27.0
pydantic>=2.6.4
pydantic-settings>=2.2.1
pytest>=8.1.1
scikit-learn>=1.4.0
joblib>=1.3.0
numpy>=1.26.0
pandas>=2.0.0
xgboost>=2.0.0
openlocationcode>=1.0.0

```

### backend/.pytest_cache/.gitignore
```
# Created by pytest automatically.
*

```

### backend/.pytest_cache/CACHEDIR.TAG
```
Signature: 8a477f597d28d172789f06886806bc55
# This file is a cache directory tag created by pytest.
# For information about cache directory tags, see:
#	https://bford.info/cachedir/spec.html

```

### backend/.pytest_cache/README.md
```markdown
# pytest cache directory #

This directory contains data from the pytest's cache plugin,
which provides the `--lf` and `--ff` options, as well as the `cache` fixture.

**Do not** commit this to version control.

See [the docs](https://docs.pytest.org/en/stable/how-to/cache.html) for more information.

```

### backend/.pytest_cache/v/cache/lastfailed
```
{}
```

### backend/.pytest_cache/v/cache/nodeids
```
[
  "tests/test_api.py::test_health_endpoint",
  "tests/test_api.py::test_reverse_endpoint_missing_params",
  "tests/test_api.py::test_route_missing_body",
  "tests/test_api.py::test_search_endpoint_empty",
  "tests/test_ml_pipeline.py::test_computed_fields",
  "tests/test_ml_pipeline.py::test_emergency_mode_bypass",
  "tests/test_new_features.py::test_congestion_detector_analyze",
  "tests/test_new_features.py::test_dynamic_incident_injection",
  "tests/test_new_features.py::test_dynamic_reroute_endpoint",
  "tests/test_new_features.py::test_health_features",
  "tests/test_new_features.py::test_live_traffic_service_point_factors",
  "tests/test_new_features.py::test_nearest_point_along_route_calculation",
  "tests/test_new_features.py::test_push_notification_service",
  "tests/test_new_features.py::test_traffic_factors_endpoint",
  "tests/test_new_features.py::test_traffic_hotspots_endpoint"
]
```

### backend/api/__init__.py
```python
# API package initialization

```

### backend/api/v1/endpoints.py
```python
from datetime import datetime, timezone
import logging
import uuid
import math
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Body
from core.region import BengaluruRegionManager
from schemas.navigation import (
    LocationSearchResponse, 
    RouteRequest, 
    RouteResponse, 
    CandidateRoute,
    TrafficFactorsRequest,
    TrafficFactorData,
    RerouteRequest,
    RerouteRecommendation,
    PushNotificationPayload
)
from services.nominatim import NominatimService
from services.osrm import OSRMService
from services.traffic_service import LiveTrafficService
from services.congestion_detector import CongestionDetector
from services.reroute_engine import DynamicRerouteEngine
from services.notification_service import PushNotificationService
from ml.recommender import RouteScorer

logger = logging.getLogger("apexguardian.api")
router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "online",
        "region": "Bengaluru",
        "features": [
            "congestion_point_identification",
            "real_time_traffic_factors",
            "predictive_congestion",
            "advance_alert_messages",
            "mobile_push_notifications",
            "voice_tts_guidance",
            "dynamic_ml_reexecution",
            "dynamic_alternative_rerouting",
            "fastest_route_recommendation",
            "route_eta_updates"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/search", response_model=List[LocationSearchResponse])
async def search_locations(q: str = Query(..., min_length=1, description="Location search query")):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    try:
        results = await NominatimService.search_places(q)
        return results
    except Exception as e:
        logger.error(f"Error searching locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Location search failed: {str(e)}")

@router.get("/reverse")
async def reverse_geocode(lat: float = Query(..., description="Latitude"), lon: float = Query(..., description="Longitude")):
    try:
        display_name = await NominatimService.reverse_geocode(lat, lon)
        return {
            "display_name": display_name,
            "lat": lat,
            "lon": lon
        }
    except Exception as e:
        logger.error(f"Error reverse geocoding ({lat}, {lon}): {str(e)}")
        return {
            "display_name": f"Location ({lat:.5f}, {lon:.5f})",
            "lat": lat,
            "lon": lon
        }

@router.post("/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest):
    """Calculates driving routes with ML scoring, multi-colored congestion segments, and hotspot detection."""
    origin_in_bounds = BengaluruRegionManager.is_within_bounds(request.origin_lat, request.origin_lon)
    dest_in_bounds = BengaluruRegionManager.is_within_bounds(request.dest_lat, request.dest_lon)

    if not origin_in_bounds:
        logger.warning(f"Origin coordinates ({request.origin_lat}, {request.origin_lon}) are outside Bengaluru bounding box.")
    if not dest_in_bounds:
        logger.warning(f"Destination coordinates ({request.dest_lat}, {request.dest_lon}) are outside Bengaluru bounding box.")

    try:
        # 1. Fetch High-Resolution OSRM Street Driving Polylines
        raw_candidates = await OSRMService.get_routes(
            origin_lat=request.origin_lat,
            origin_lon=request.origin_lon,
            dest_lat=request.dest_lat,
            dest_lon=request.dest_lon
        )

        # 2. Evaluate Candidates with Route-Level ML Model
        ml_evaluated_candidates = RouteScorer.evaluate_routes(
            raw_candidates,
            request.origin_lat,
            request.origin_lon,
            request.dest_lat,
            request.dest_lon,
            is_emergency_mode=request.is_emergency_mode
        )

        # 3. Analyze each candidate for Segmented Congestion & Predictive Hotspots (Features 1 & 3)
        processed_candidates: List[CandidateRoute] = []
        for candidate in ml_evaluated_candidates:
            route_dist_m = candidate.get("distance_meters", 0.0)
            base_dur_s = candidate.get("duration_seconds", 0.0)
            geometry = candidate.get("geometry", {})
            steps = candidate.get("steps", [])

            # Hard Geometry Validation
            coords = geometry.get("coordinates", [])
            if not coords or len(coords) < 2:
                logger.error("Rejecting route: insufficient coordinates")
                continue
                
            has_nan = any(math.isnan(c[0]) or math.isnan(c[1]) for c in coords)
            if has_nan:
                logger.error("Rejecting route: contains NaN coordinates")
                continue

            if not steps:
                logger.error("Rejecting route: no steps found")
                continue

            candidate["route_id"] = str(uuid.uuid4())
            candidate["source"] = "initial-osrm"
            candidate["original_route_index"] = candidate.get("route_index", 0)

            analysis = CongestionDetector.analyze_route(
                geometry=geometry,
                steps=steps,
                total_distance_m=route_dist_m,
                base_duration_s=base_dur_s,
                is_emergency_mode=request.is_emergency_mode
            )

            candidate["segments"] = analysis["segments"]
            candidate["hotspots"] = analysis["hotspots"]
            candidate["clear_distance_km"] = analysis["clear_distance_km"]
            candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
            candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
            candidate["severe_distance_km"] = analysis["severe_distance_km"]
            candidate["total_delay_seconds"] = analysis["total_delay_seconds"]

            # Incorporate segment-level live delays with ML duration
            live_delay = analysis["total_delay_seconds"]
            ml_predicted_dur = candidate.get("predicted_duration_seconds", base_dur_s)
            final_predicted_dur = max(ml_predicted_dur, base_dur_s + live_delay)
            
            candidate["predicted_duration_seconds"] = final_predicted_dur
            candidate["predicted_duration_minutes"] = round(final_predicted_dur / 60.0, 1)

            processed_candidates.append(CandidateRoute(**candidate))

        return RouteResponse(
            success=True,
            routes_count=len(processed_candidates),
            candidates=processed_candidates
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching routes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Routing service error: {str(e)}")

@router.post("/reroute/evaluate", response_model=RerouteRecommendation)
async def evaluate_reroute(request: RerouteRequest):
    """Dynamically generates alternative routes from CURRENT user location and recommends the fastest (Features 8 & 9)."""
    recommendation = await DynamicRerouteEngine.evaluate_reroute(
        current_lat=request.current_lat,
        current_lon=request.current_lon,
        dest_lat=request.dest_lat,
        dest_lon=request.dest_lon,
        original_remaining_duration_s=request.original_remaining_duration_seconds,
        avoid_hotspots=request.avoid_hotspots,
        is_emergency_mode=request.is_emergency_mode
    )
    return recommendation

@router.get("/traffic/factors", response_model=TrafficFactorData)
async def get_traffic_factors(lat: float = Query(...), lon: float = Query(...)):
    """Returns real-time traffic factor metrics for a location (Feature 2)."""
    factors = LiveTrafficService.get_point_traffic_factors(lat, lon)
    return TrafficFactorData(
        location_name=factors["location_name"],
        current_speed_kmh=factors["current_speed_kmh"],
        freeflow_speed_kmh=factors["freeflow_speed_kmh"],
        density_index=factors["density_index"],
        congestion_level=factors["congestion_level"],
        congestion_factor=factors["congestion_factor"],
        incident_description=factors["incident_description"],
        historical_baseline_speed_kmh=35.0
    )

@router.get("/traffic/hotspots")
async def get_traffic_hotspots():
    """Returns all active bottleneck hotspots across Bengaluru."""
    hotspots = LiveTrafficService.get_all_active_hotspots()
    return {"success": True, "count": len(hotspots), "hotspots": hotspots}



@router.post("/notifications/dispatch", response_model=PushNotificationPayload)
async def dispatch_push_notification(payload: PushNotificationPayload):
    """Dispatches a mobile push notification (Feature 5)."""
    PushNotificationService._log_dispatch(payload)
    return payload

@router.get("/notifications/recent")
async def get_recent_notifications():
    """Retrieves recent push notification dispatch log."""
    dispatches = PushNotificationService.get_recent_dispatches()
    return {"dispatches": dispatches}

```

### backend/api/v1/__init__.py
```python
# API v1 package initialization

```

### backend/core/config.py
```python
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

```

### backend/core/region.py
```python
from typing import List, Tuple

class BengaluruRegionManager:
    """Centralized geographical metadata for Bengaluru region."""
    CENTER: Tuple[float, float] = (12.9716, 77.5946)
    BOUNDING_BOX: List[float] = [77.4600, 12.8000, 77.7500, 13.1500]  # Min Lon, Min Lat, Max Lon, Max Lat
    DEFAULT_ZOOM: int = 12

    @classmethod
    def is_within_bounds(cls, lat: float, lon: float) -> bool:
        """Check if a coordinate pair sits inside the Bengaluru bounding box."""
        min_lon, min_lat, max_lon, max_lat = cls.BOUNDING_BOX
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon

```

### backend/core/__init__.py
```python
# Core package initialization

```

### backend/ml/dataset.py
```python
import os
import pandas as pd
import numpy as np
from typing import Tuple, List, Dict
from openlocationcode import openlocationcode as olc
import asyncio
import time

class TrafficDataPipeline:
    """Feature engineering pipeline for Apex Guardian V2.0 Route-Level Model."""

    DATASETS_DIR = os.path.join(os.path.dirname(__file__), "datasets")
    TML_TRAFFIC_CSV = os.path.join(DATASETS_DIR, "tml", "csv-traffic-bangalore.csv")
    CACHE_FILE = os.path.join(DATASETS_DIR, "tml", "osrm_cache.json")
    
    BLR_LAT = 12.9716
    BLR_LON = 77.5946
    
    _osrm_cache = {}

    @classmethod
    def _decode_plus_code(cls, code: str) -> Tuple[float, float]:
        if len(code) <= 8 and '+' in code:
            full_code = olc.recoverNearest(code, cls.BLR_LAT, cls.BLR_LON)
        else:
            full_code = code
        decoded = olc.decode(full_code)
        return decoded.latitudeCenter, decoded.longitudeCenter
        
    @classmethod
    async def _build_osrm_cache(cls, unique_routes: pd.DataFrame):
        from services.osrm import OSRMService
        import json
        
        # Load from disk cache if exists
        if os.path.exists(cls.CACHE_FILE):
            try:
                with open(cls.CACHE_FILE, 'r') as f:
                    cls._osrm_cache = json.load(f)
                    print(f"Loaded {len(cls._osrm_cache)} routes from disk cache.")
            except Exception:
                pass

        needs_save = False
        for _, row in unique_routes.iterrows():
            o_lat, o_lon = row['origin_lat'], row['origin_lon']
            d_lat, d_lon = row['destination_lat'], row['destination_lon']
            key = f"{o_lat},{o_lon},{d_lat},{d_lon}"
            
            if key in cls._osrm_cache:
                continue
                
            # Rate limit backoff
            raw = None
            for attempt in range(5):
                try:
                    raw = await OSRMService.get_routes(o_lat, o_lon, d_lat, d_lon)
                    if raw:
                        break
                except Exception as e:
                    print(f"OSRM attempt {attempt+1} failed: {e}")
                print("Sleeping to respect OSRM rate limits...")
                await asyncio.sleep(3 * (attempt + 1))
                
            if not raw:
                raise RuntimeError(f"OSRM Route resolution failed for {key}. Halting dataset compilation.")
                
            route = raw[0]
            dist_km = route.get('distance_meters', 0) / 1000.0
            dur_sec = route.get('duration_seconds', 0)
            
            if dist_km <= 0 or dur_sec <= 0:
                raise RuntimeError(f"OSRM Route returned invalid metrics for {key}. Dist: {dist_km}, Dur: {dur_sec}")
                
            steps = route.get('steps', [])
            num_steps = max(1, len(steps))
            turns = 0
            roundabouts = 0
            for step in steps:
                mtype = step.get('maneuver', {}).get('type', '')
                if mtype in ['turn', 'merge', 'ramp']:
                    turns += 1
                if mtype in ['roundabout', 'rotary']:
                    roundabouts += 1
                    
            feats = {
                'osrm_dist': dist_km,
                'osrm_dur_min': dur_sec / 60.0,
                'steps_count': num_steps,
                'turns': turns,
                'roundabouts': roundabouts,
                'avg_step_len': dist_km / num_steps
            }
            cls._osrm_cache[key] = feats
            needs_save = True
            print(f"Resolved {key} -> Dist: {dist_km:.2f}km, Dur: {dur_sec/60.0:.2f}m, Steps: {num_steps}, Status: OK")
            
        if needs_save:
            with open(cls.CACHE_FILE, 'w') as f:
                json.dump(cls._osrm_cache, f)

    @classmethod
    def load_canonical_dataset(cls) -> pd.DataFrame:
        if not os.path.exists(cls.TML_TRAFFIC_CSV):
            raise FileNotFoundError(f"Missing TML dataset at {cls.TML_TRAFFIC_CSV}")
            
        df = pd.read_csv(cls.TML_TRAFFIC_CSV)
        df['timestamp'] = pd.to_datetime(df['date'] + ' ' + df['time'])
        
        def resolve_route(rc: str):
            parts = str(rc).split('|')
            if len(parts) == 2:
                o_lat, o_lon = cls._decode_plus_code(parts[0])
                d_lat, d_lon = cls._decode_plus_code(parts[1])
                return pd.Series([o_lat, o_lon, d_lat, d_lon])
            return pd.Series([np.nan, np.nan, np.nan, np.nan])
            
        df[['origin_lat', 'origin_lon', 'destination_lat', 'destination_lon']] = df['route_code'].apply(resolve_route)
        df = df.dropna(subset=['origin_lat'])
        unique_routes = df[['route_code', 'origin_lat', 'origin_lon', 'destination_lat', 'destination_lon']].drop_duplicates()
        
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
            
        if loop and loop.is_running():
            raise RuntimeError("load_canonical_dataset must be run in a separate sync wrapper")
        else:
            asyncio.run(cls._build_osrm_cache(unique_routes))
            
        def apply_osrm(row):
            key = f"{row['origin_lat']},{row['origin_lon']},{row['destination_lat']},{row['destination_lon']}"
            f = cls._osrm_cache[key]
            return pd.Series([
                f['osrm_dist'],
                f['osrm_dur_min'],
                f['steps_count'],
                f['turns'],
                f['roundabouts'],
                f['avg_step_len']
            ])
            
        df[['osrm_dist', 'osrm_dur_min', 'steps_count', 'turns', 'roundabouts', 'avg_step_len']] = df.apply(apply_osrm, axis=1)
        df = df[df['osrm_dur_min'] > 0]
        
        df['distance_km'] = df['distance']
        df['observed_duration_min'] = df['duration']
        df['congestion_factor'] = df['observed_duration_min'] / df['osrm_dur_min']
        
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['month'] = df['timestamp'].dt.month
        
        canonical_cols = [
            'timestamp', 'route_code', 'origin_lat', 'origin_lon', 
            'destination_lat', 'destination_lon', 'observed_duration_min', 
            'osrm_dist', 'osrm_dur_min', 'steps_count', 'turns', 'roundabouts', 'avg_step_len',
            'congestion_factor', 'hour', 'day_of_week', 'is_weekend', 'month'
        ]
        
        return df[canonical_cols].copy()

    @classmethod
    def get_train_val_test_splits(cls):
        df = cls.load_canonical_dataset()
        
        # SANITY CHECKS BEFORE SPLIT
        if (df['osrm_dur_min'] == 1.0).all():
            raise RuntimeError("SANITY CHECK FAILED: All OSRM durations are exactly 1.0! Dataset is corrupted.")
        if df['osrm_dur_min'].min() <= 0:
            raise RuntimeError("SANITY CHECK FAILED: OSRM duration <= 0 found!")
        
        print("\n--- SANITY CHECKS ---")
        print(f"Valid Rows: {len(df)}")
        print(f"OSRM Duration Mean: {df['osrm_dur_min'].mean():.2f}")
        print("Congestion Factor Stats:")
        print(df['congestion_factor'].describe(percentiles=[0.9, 0.95, 0.99]))
        
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        features = [
            'hour', 'day_of_week', 'is_weekend', 'month',
            'osrm_dist', 'osrm_dur_min', 'steps_count', 'turns', 'roundabouts', 'avg_step_len'
        ]
            
        X = df[features].values
        y = df['congestion_factor'].values
        
        n = len(df)
        train_idx = int(0.75 * n)
        val_idx = int(0.85 * n)
        
        X_train, y_train = X[:train_idx], y[:train_idx]
        X_val, y_val = X[train_idx:val_idx], y[train_idx:val_idx]
        X_test, y_test = X[val_idx:], y[val_idx:]
        
        return X_train, y_train, X_val, y_val, X_test, y_test, features

```

### backend/ml/recommender.py
```python
import math
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta

from ml.route_model import predictor as congestion_predictor

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
    lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class RouteScorer:
    """Evaluates multiple route candidates by fetching the Congestion Factor."""
    
    KNOWN_CORNERS = [
        (12.9514, 77.6590), # Example Indiranagar/Old Airport Road area
        (12.9345, 77.6200), # Koramangala
        (13.1989, 77.7069), # Airport
        (12.9716, 77.5946), # MG Road
        (12.9279, 77.6271), # Silk Board
        (12.9698, 77.7499), # Whitefield
        (13.0354, 77.5988), # Hebbal
    ]
    
    @classmethod
    def determine_coverage(cls, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> str:
        o_dists = [haversine(origin_lat, origin_lon, lat, lon) for lat, lon in cls.KNOWN_CORNERS]
        d_dists = [haversine(dest_lat, dest_lon, lat, lon) for lat, lon in cls.KNOWN_CORNERS]
        
        o_min = min(o_dists) if o_dists else float('inf')
        d_min = min(d_dists) if d_dists else float('inf')
        
        if o_min <= 3.0 and d_min <= 3.0:
            return "High (Historical)"
        elif o_min <= 8.0 and d_min <= 8.0:
            return "Medium (Similar)"
        else:
            return "Low (Extrapolated)"

    @classmethod
    def evaluate_routes(cls, routes: List[Dict[str, Any]], origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float, is_emergency_mode: bool = False) -> List[Dict[str, Any]]:
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(ist_tz)
        hour = now.hour
        day_of_week = now.weekday()
        is_weekend = int(day_of_week in [5, 6])
        month = now.month
        
        confidence = cls.determine_coverage(origin_lat, origin_lon, dest_lat, dest_lon)
        
        for idx, route in enumerate(routes):
            dist_km = route.get('distance_meters', 0) / 1000.0
            dur_sec = route.get('duration_seconds', 0)
            
            # OSRM Feature Extraction
            steps = route.get('steps', [])
            num_steps = len(steps)
            turns = 0
            roundabouts = 0
            for step in steps:
                mtype = step.get('maneuver', {}).get('type', '')
                if mtype in ['turn', 'merge', 'ramp']:
                    turns += 1
                if mtype in ['roundabout', 'rotary']:
                    roundabouts += 1
            
            avg_step_len = dist_km / max(1, num_steps)
            osrm_dur_min = dur_sec / 60.0 if dur_sec > 0 else 1.0
            
            # Congestion Factor prediction
            if is_emergency_mode:
                cf = 1.0
            else:
                cf = congestion_predictor.predict_congestion_factor(
                    osrm_dist=dist_km,
                    osrm_dur_min=osrm_dur_min,
                    steps_count=num_steps,
                    turns=turns,
                    roundabouts=roundabouts,
                    avg_step_len=avg_step_len,
                    hour=hour,
                    day_of_week=day_of_week,
                    is_weekend=is_weekend,
                    month=month
                )
            
            predicted_dur_sec = dur_sec * cf
            predicted_dur_min = predicted_dur_sec / 60.0
            
            route['route_index'] = idx
            route['predicted_duration_seconds'] = predicted_dur_sec
            route['predicted_duration_minutes'] = predicted_dur_min
            route['standard_duration_seconds'] = dur_sec
            route['standard_duration_minutes'] = dur_sec / 60.0
            route['congestion_factor'] = cf
            route['confidence'] = confidence
            route['is_ai_recommended'] = False
            route['recommendation_label'] = ""
            route['predicted_average_speed_kmh'] = dist_km / (predicted_dur_min / 60.0) if predicted_dur_min > 0 else 0.0
            route['delay_savings_minutes'] = 0.0

        if not routes:
            return routes
            
        # Recommender ranks by the ML predicted duration
        routes.sort(key=lambda r: r['predicted_duration_seconds'])
        
        slowest_predicted_min = max(r['predicted_duration_minutes'] for r in routes)
        for route in routes:
            route['delay_savings_minutes'] = slowest_predicted_min - route['predicted_duration_minutes']
        
        # Determine labels based strictly on multiple-route existence
        if len(routes) == 1:
            routes[0]['is_ai_recommended'] = True
            routes[0]['recommendation_label'] = "Recommended Route"
        else:
            # Shortest ML predicted duration wins AI recommendation
            routes[0]['is_ai_recommended'] = True
            routes[0]['recommendation_label'] = "AI Recommended"
            
            # Find the first OSRM candidate (original route_index == 0) and label it OSRM Preferred Route
            for route in routes:
                if route['route_index'] == 0:
                    # Don't overwrite if it also happens to be the AI Recommended route
                    if not route['is_ai_recommended']:
                        route['recommendation_label'] = "OSRM Preferred Route"
                    break
                    
        return routes

```

### backend/ml/route_model.py
```python
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


```

### backend/ml/train.py
```python
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

```

### backend/ml/__init__.py
```python
# ML package initialization

```

### backend/schemas/navigation.py
```python
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class LocationSearchResponse(BaseModel):
    """Geocoded location search result."""
    display_name: str
    lat: float
    lon: float
    place_id: str
    address_type: str

class RouteRequest(BaseModel):
    """Driving route query between origin and destination coordinates."""
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    is_emergency_mode: bool = False

class CongestionSegment(BaseModel):
    """Sub-segment of a route with localized real-time and predicted congestion metrics."""
    segment_index: int
    coordinates: List[List[float]] = Field(default_factory=list, description="[[lon, lat], ...]")
    distance_meters: float = 0.0
    duration_seconds: float = 0.0
    freeflow_speed_kmh: float = 45.0
    current_speed_kmh: float = 45.0
    delay_seconds: float = 0.0
    congestion_level: str = "CLEAR"  # CLEAR, MODERATE, HEAVY, SEVERE
    color: str = "#10B981"  # Hex color for MapLibre rendering
    congestion_factor: float = 1.0
    density_index: float = 20.0  # 0 to 100
    predicted_arrival_time_min: float = 0.0
    road_name: Optional[str] = "Main Road"

class CongestionHotspot(BaseModel):
    """Identified critical congestion bottleneck along a route."""
    hotspot_id: str
    location_name: str
    lat: float
    lon: float
    distance_from_origin_m: float
    congestion_level: str = "HEAVY"  # MODERATE, HEAVY, SEVERE
    average_speed_kmh: float = 15.0
    estimated_delay_seconds: float = 0.0
    description: str = ""
    cause: str = "High Vehicle Volume / Choke Point"

class CandidateRoute(BaseModel):
    """Complete candidate route with ML scoring and segmented traffic breakdown."""
    route_id: str = ""
    source: str = "initial-osrm"
    original_route_index: int = 0
    route_index: int
    distance_meters: float
    duration_seconds: float
    geometry: Dict[str, Any]
    steps: List[Dict[str, Any]]
    is_ai_recommended: bool = False
    recommendation_label: str = ""
    congestion_factor: float = 1.0
    predicted_average_speed_kmh: float = 0.0
    predicted_duration_seconds: float = 0.0
    predicted_duration_minutes: float = 0.0
    standard_duration_seconds: float = 0.0
    standard_duration_minutes: float = 0.0
    delay_savings_minutes: float = 0.0
    confidence: str = ""
    
    # Feature 1 & 2: Segmented congestion breakdown & Hotspots
    segments: List[CongestionSegment] = Field(default_factory=list)
    hotspots: List[CongestionHotspot] = Field(default_factory=list)
    clear_distance_km: float = 0.0
    moderate_distance_km: float = 0.0
    heavy_distance_km: float = 0.0
    severe_distance_km: float = 0.0
    total_delay_seconds: float = 0.0

class RouteResponse(BaseModel):
    """Response returned by route calculation endpoint."""
    success: bool
    routes_count: int
    candidates: List[CandidateRoute]

class TrafficFactorsRequest(BaseModel):
    """Query live traffic metrics for a location or corridor."""
    lat: float
    lon: float
    radius_km: float = 2.0

class TrafficFactorData(BaseModel):
    """Real-time traffic factor telemetry."""
    location_name: str
    current_speed_kmh: float
    freeflow_speed_kmh: float
    density_index: float
    congestion_level: str
    congestion_factor: float
    incident_description: Optional[str] = None
    historical_baseline_speed_kmh: float = 35.0

class RerouteRequest(BaseModel):
    """Dynamic alternative rerouting query from user's current GPS position."""
    current_lat: float
    current_lon: float
    dest_lat: float
    dest_lon: float
    original_route_index: int = 0
    original_remaining_duration_seconds: float = 0.0
    avoid_hotspots: List[Dict[str, float]] = Field(default_factory=list)
    is_emergency_mode: bool = False

class RerouteRecommendation(BaseModel):
    """Fastest alternative route recommendation evaluated from current location."""
    is_reroute_recommended: bool = False
    time_saved_seconds: float = 0.0
    time_saved_minutes: float = 0.0
    original_remaining_seconds: float = 0.0
    recommended_duration_seconds: float = 0.0
    recommended_route: Optional[CandidateRoute] = None
    alternative_routes: List[CandidateRoute] = Field(default_factory=list)
    reason: str = ""

class PushNotificationPayload(BaseModel):
    """Mobile / Web Push Notification Dispatch Payload."""
    title: str
    body: str
    icon: Optional[str] = "/icons/alert-icon.png"
    badge: Optional[str] = "/icons/badge.png"
    tag: Optional[str] = "apex-traffic-alert"
    data: Optional[Dict[str, Any]] = None

```

### backend/schemas/__init__.py
```python
# Schemas package initialization

```

### backend/services/congestion_detector.py
```python
import math
from typing import List, Dict, Any, Tuple
from services.traffic_service import LiveTrafficService

class CongestionDetector:
    """Congestion Point Identification and Predictive Detection Engine (Features 1 & 3).
    
    Responsibilities:
    - Splits full route coordinate polylines into discrete, analytical sub-segments.
    - Evaluates localized speed, density, and congestion level for each sub-segment.
    - Performs PREDICTIVE congestion detection before the user physically arrives at downstream segments.
    - Identifies discrete Congestion Hotspots along the path for advance alert generation.
    - Calculates distance breakdown by traffic condition (Clear, Moderate, Heavy, Severe).
    """

    @staticmethod
    def haversine_distance(coord1: List[float], coord2: List[float]) -> float:
        """Calculates distance in meters between [lon1, lat1] and [lon2, lat2]."""
        lon1, lat1 = coord1[0], coord1[1]
        lon2, lat2 = coord2[0], coord2[1]
        r = 6371000.0  # Earth radius in meters
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def analyze_route(
        cls, 
        geometry: Dict[str, Any], 
        steps: List[Dict[str, Any]], 
        total_distance_m: float, 
        base_duration_s: float,
        is_emergency_mode: bool = False
    ) -> Dict[str, Any]:
        """Analyzes a candidate route and returns segmented traffic breakdown, hotspots, and predictive metrics."""
        coordinates: List[List[float]] = geometry.get("coordinates", [])
        if not coordinates or len(coordinates) < 2:
            return {
                "segments": [],
                "hotspots": [],
                "clear_distance_km": round(total_distance_m / 1000.0, 2),
                "moderate_distance_km": 0.0,
                "heavy_distance_km": 0.0,
                "severe_distance_km": 0.0,
                "total_delay_seconds": 0.0,
            }

        # Step 1: Divide route coordinate polyline into chunks of ~400m to 800m
        segment_chunks: List[List[List[float]]] = []
        current_chunk: List[List[float]] = [coordinates[0]]
        accumulated_dist = 0.0
        target_chunk_size_m = max(350.0, min(800.0, total_distance_m / 12.0))

        for i in range(1, len(coordinates)):
            d = cls.haversine_distance(coordinates[i - 1], coordinates[i])
            accumulated_dist += d
            current_chunk.append(coordinates[i])
            
            if accumulated_dist >= target_chunk_size_m or i == len(coordinates) - 1:
                segment_chunks.append(current_chunk)
                current_chunk = [coordinates[i]]
                accumulated_dist = 0.0

        if len(current_chunk) > 1:
            segment_chunks.append(current_chunk)

        # Step 2: Evaluate each segment with Predictive Downstream Traffic
        evaluated_segments = []
        hotspots = []
        
        cumulative_dist_m = 0.0
        cumulative_elapsed_s = 0.0
        
        clear_dist_m = 0.0
        moderate_dist_m = 0.0
        heavy_dist_m = 0.0
        severe_dist_m = 0.0
        total_delay_s = 0.0

        for seg_idx, chunk_coords in enumerate(segment_chunks):
            # Calculate segment length
            seg_dist_m = 0.0
            for j in range(1, len(chunk_coords)):
                seg_dist_m += cls.haversine_distance(chunk_coords[j - 1], chunk_coords[j])
            
            # Midpoint coordinate of the segment
            mid_idx = len(chunk_coords) // 2
            mid_lon, mid_lat = chunk_coords[mid_idx][0], chunk_coords[mid_idx][1]

            # Predictive arrival offset: When will the driver physically reach this segment?
            prediction_offset_min = cumulative_elapsed_s / 60.0

            # Real-time traffic factor telemetry at that predicted timestamp
            traffic_factors = LiveTrafficService.get_point_traffic_factors(
                lat=mid_lat, 
                lon=mid_lon, 
                prediction_offset_min=prediction_offset_min
            )

            # In emergency mode, emergency vehicles experience lower baseline congestion
            if is_emergency_mode:
                traffic_factors["current_speed_kmh"] = min(
                    traffic_factors["freeflow_speed_kmh"], 
                    traffic_factors["current_speed_kmh"] * 1.5 + 10.0
                )
                if traffic_factors["congestion_level"] == "SEVERE":
                    traffic_factors["congestion_level"] = "HEAVY"
                elif traffic_factors["congestion_level"] == "HEAVY":
                    traffic_factors["congestion_level"] = "MODERATE"
                elif traffic_factors["congestion_level"] == "MODERATE":
                    traffic_factors["congestion_level"] = "CLEAR"

            current_speed_kmh = max(5.0, traffic_factors["current_speed_kmh"])
            freeflow_speed_kmh = max(20.0, traffic_factors["freeflow_speed_kmh"])
            
            # Duration and delay calculation
            speed_ms = (current_speed_kmh * 1000.0) / 3600.0
            freeflow_ms = (freeflow_speed_kmh * 1000.0) / 3600.0
            
            seg_duration_s = seg_dist_m / max(0.5, speed_ms)
            seg_freeflow_s = seg_dist_m / max(0.5, freeflow_ms)
            seg_delay_s = max(0.0, seg_duration_s - seg_freeflow_s)

            # Find matching step road name if available
            matching_road_name = "Arterial Road"
            seg_center_dist = cumulative_dist_m + (seg_dist_m / 2.0)
            step_acc_dist = 0.0
            for step in steps:
                step_d = step.get("distance", 0.0)
                if step_acc_dist <= seg_center_dist <= (step_acc_dist + step_d):
                    if step.get("name"):
                        matching_road_name = step["name"]
                    break
                step_acc_dist += step_d

            # Accumulate distance categories
            level = traffic_factors["congestion_level"]
            if level == "CLEAR":
                clear_dist_m += seg_dist_m
            elif level == "MODERATE":
                moderate_dist_m += seg_dist_m
            elif level == "HEAVY":
                heavy_dist_m += seg_dist_m
            elif level == "SEVERE":
                severe_dist_m += seg_dist_m

            total_delay_s += seg_delay_s

            evaluated_segments.append({
                "segment_index": seg_idx,
                "coordinates": chunk_coords,
                "distance_meters": round(seg_dist_m, 1),
                "duration_seconds": round(seg_duration_s, 1),
                "freeflow_speed_kmh": round(freeflow_speed_kmh, 1),
                "current_speed_kmh": round(current_speed_kmh, 1),
                "delay_seconds": round(seg_delay_s, 1),
                "congestion_level": level,
                "color": traffic_factors["color"],
                "congestion_factor": traffic_factors["congestion_factor"],
                "density_index": traffic_factors["density_index"],
                "predicted_arrival_time_min": round(prediction_offset_min, 1),
                "road_name": matching_road_name,
            })

            # Detect if this segment qualifies as a critical Bottleneck Hotspot
            if level in ["MODERATE", "HEAVY", "SEVERE"]:
                # Include heavy/severe bottlenecks, or moderate segments with meaningful delay or named bottlenecks
                if level in ["HEAVY", "SEVERE"] or seg_delay_s >= 20.0 or (traffic_factors.get("location_name") and traffic_factors.get("location_name") != "Urban Arterial Corridor"):
                    hotspot_id = f"hotspot_{seg_idx}_{round(mid_lat, 3)}_{round(mid_lon, 3)}"
                    loc_name = traffic_factors.get("location_name") or matching_road_name
                    if loc_name == "Urban Arterial Corridor":
                        loc_name = f"Near {matching_road_name}"

                    # Avoid duplicate adjacent hotspots
                    if not hotspots or hotspots[-1]["location_name"] != loc_name:
                        hotspots.append({
                            "hotspot_id": hotspot_id,
                            "location_name": loc_name,
                            "lat": round(mid_lat, 5),
                            "lon": round(mid_lon, 5),
                            "distance_from_origin_m": round(cumulative_dist_m, 1),
                            "congestion_level": level,
                            "average_speed_kmh": round(current_speed_kmh, 1),
                            "estimated_delay_seconds": round(seg_delay_s, 1),
                            "description": traffic_factors.get("incident_description") or f"Slow moving traffic at {round(current_speed_kmh)} km/h",
                            "cause": "Traffic Volume & Choke Point Bottleneck",
                        })

            cumulative_dist_m += seg_dist_m
            cumulative_elapsed_s += seg_duration_s

        return {
            "segments": evaluated_segments,
            "hotspots": hotspots,
            "clear_distance_km": round(clear_dist_m / 1000.0, 2),
            "moderate_distance_km": round(moderate_dist_m / 1000.0, 2),
            "heavy_distance_km": round(heavy_dist_m / 1000.0, 2),
            "severe_distance_km": round(severe_dist_m / 1000.0, 2),
            "total_delay_seconds": round(total_delay_s, 1),
        }

```

### backend/services/nominatim.py
```python
from typing import List, Dict, Any
import httpx
from core.config import settings

class NominatimService:
    @staticmethod
    async def search_places(query: str) -> List[Dict[str, Any]]:
        """Search places via Nominatim API bounded to Bengaluru region with static fallback for reliability."""
        sanitized_query = query.strip()
        if "bengaluru" not in sanitized_query.lower() and "bangalore" not in sanitized_query.lower():
            sanitized_query = f"{sanitized_query}, Bengaluru, India"

        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "q": sanitized_query,
            "format": "json",
            "viewbox": "77.46,13.15,77.75,12.80",
            "bounded": "1",
            "limit": "5"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/search", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data:
                        results.append({
                            "display_name": item.get("display_name", ""),
                            "lat": float(item.get("lat", 0.0)),
                            "lon": float(item.get("lon", 0.0)),
                            "place_id": str(item.get("place_id", "")),
                            "address_type": item.get("addresstype", item.get("type", "unknown"))
                        })
                    if results:
                        return results
                    return []
        except Exception as err:
            print(f"[Nominatim WARNING] Search place online lookup failed: {err}")

        return []

    @staticmethod
    async def reverse_geocode(lat: float, lon: float) -> str:
        """Reverse geocode latitude & longitude coordinates to a clean street/place name."""
        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "format": "json",
            "lat": lat,
            "lon": lon,
            "zoom": "18",
            "addressdetails": "1"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/reverse", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    address = data.get("address", {})
                    short_name = (
                        address.get("road") or
                        address.get("suburb") or
                        address.get("neighbourhood") or
                        address.get("amenity") or
                        data.get("display_name", "").split(",")[0]
                    )
                    if short_name:
                        suburb = address.get("suburb", "")
                        if suburb and suburb.lower() not in short_name.lower():
                            return f"{short_name}, {suburb}"
                        return short_name
                    if data.get("display_name"):
                        return data["display_name"].split(",")[0]
        except Exception:
            pass

        return f"Location ({lat:.5f}, {lon:.5f})"

```

### backend/services/notification_service.py
```python
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from schemas.navigation import PushNotificationPayload

logger = logging.getLogger("apexguardian.notifications")

class PushNotificationService:
    """Mobile Push Notification Service (Feature 5).
    
    Dispatches alerts to mobile devices and browsers (via Web Push / Firebase Cloud Messaging).
    Triggers:
    a) Upcoming congestion alerts on user's active route
    b) Dynamic route change & faster reroute suggestions
    """

    _dispatch_log = []

    @classmethod
    def create_congestion_alert(
        cls, 
        location_name: str, 
        distance_meters: float, 
        delay_minutes: float, 
        speed_kmh: float
    ) -> PushNotificationPayload:
        """Generates proactive push notification payload for upcoming congestion."""
        dist_str = f"{distance_meters / 1000.0:.1f} km" if distance_meters >= 1000 else f"{int(distance_meters)} m"
        title = f"⚠️ Congestion Ahead ({dist_str})"
        body = f"Heavy traffic near {location_name}. Flow speed: {int(speed_kmh)} km/h (+{int(delay_minutes)} min delay)."
        
        payload = PushNotificationPayload(
            title=title,
            body=body,
            icon="/icons/alert-icon.png",
            tag="congestion-alert",
            data={
                "type": "CONGESTION_ALERT",
                "location_name": location_name,
                "distance_meters": distance_meters,
                "delay_minutes": delay_minutes,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        cls._log_dispatch(payload)
        return payload

    @classmethod
    def create_reroute_alert(
        cls, 
        time_saved_minutes: float, 
        via_road: str
    ) -> PushNotificationPayload:
        """Generates push notification payload for faster alternative route."""
        title = f"🚀 Faster Route Available (Save {int(time_saved_minutes)} min)"
        body = f"We found a faster alternative via {via_road} that bypasses upcoming delays."
        
        payload = PushNotificationPayload(
            title=title,
            body=body,
            icon="/icons/reroute-icon.png",
            tag="reroute-suggestion",
            data={
                "type": "REROUTE_SUGGESTION",
                "time_saved_minutes": time_saved_minutes,
                "via_road": via_road,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        cls._log_dispatch(payload)
        return payload

    @classmethod
    def _log_dispatch(cls, payload: PushNotificationPayload):
        entry = {
            "title": payload.title,
            "body": payload.body,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        cls._dispatch_log.append(entry)
        if len(cls._dispatch_log) > 100:
            cls._dispatch_log.pop(0)
        logger.info(f"[PushNotification] Dispatched: {payload.title} - {payload.body}")

    @classmethod
    def get_recent_dispatches(cls):
        return list(reversed(cls._dispatch_log))

```

### backend/services/osrm.py
```python
from typing import List, Dict, Any
import httpx
from fastapi import HTTPException
from core.config import settings


class OSRMService:
    """Street-snapped driving route service via OSRM public API."""

    @staticmethod
    async def get_routes(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> List[Dict[str, Any]]:
        """Fetch street-snapped driving routes between origin and destination from OSRM.
        
        Returns a list of candidate route dicts. Raises HTTPException if OSRM is unreachable.
        """
        endpoints = [
            f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}",
            f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        ]

        headers = {
            "User-Agent": "ApexGuardian/2.0 (navigation@apexguardian.local)"
        }
        params = {
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "true",
            "steps": "true",
        }

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            for base_url in endpoints:
                try:
                    response = await client.get(base_url, params=params, headers=headers)
                    if response.status_code != 200:
                        print(f"[OSRM] Endpoint returned {response.status_code}, trying next...")
                        continue

                    data = response.json()
                    raw_routes = data.get("routes", [])

                    if data.get("code") == "Ok" and raw_routes:
                        candidates = []
                        for idx, route in enumerate(raw_routes):
                            all_steps = []
                            for leg in route.get("legs", []):
                                all_steps.extend(leg.get("steps", []))

                            distance = float(route.get("distance", 0.0))
                            duration = float(route.get("duration", 0.0))
                            geometry = route.get("geometry", {})

                            # Validate route data
                            if distance <= 0 or duration <= 0:
                                continue
                            if not geometry or not geometry.get("coordinates"):
                                continue

                            candidates.append({
                                "route_index": idx,
                                "distance_meters": distance,
                                "duration_seconds": duration,
                                "geometry": geometry,
                                "steps": all_steps,
                            })

                        if candidates:
                            print(f"[OSRM] Success: {len(candidates)} route(s) returned.")
                            return candidates

                except Exception as err:
                    print(f"[OSRM] Endpoint {base_url} failed: {err}")
                    continue

        # All endpoints failed — do NOT fabricate routes
        raise HTTPException(
            status_code=503,
            detail="Routing service temporarily unavailable. All OSRM endpoints failed."
        )

```

### backend/services/reroute_engine.py
```python
import logging
import uuid
import math
from typing import List, Dict, Any, Optional
from services.osrm import OSRMService
from services.congestion_detector import CongestionDetector
from ml.recommender import RouteScorer
from schemas.navigation import CandidateRoute, RerouteRecommendation

logger = logging.getLogger("apexguardian.reroute")

def haversine_distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(dlambda / 2.0) ** 2
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class DynamicRerouteEngine:
    """Dynamic Alternative Route Generation & Fastest Route Recommender (Features 8 & 9).
    
    Responsibilities:
    - Generates candidate alternative routes strictly originating from the user's
      CURRENT vehicle coordinates (not the starting point) to the final destination.
    - Avoids known heavy/severe congestion coordinates by calculating bypass corridors.
    - Evaluates all candidate alternatives with the XGBoost ML model and real-time traffic factors.
    - Compares remaining travel time on the current path vs candidate alternatives.
    - Recommends the fastest route with calculated time-savings.
    """

    @classmethod
    async def evaluate_reroute(
        cls,
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        original_remaining_duration_s: float,
        avoid_hotspots: Optional[List[Dict[str, float]]] = None,
        is_emergency_mode: bool = False
    ) -> RerouteRecommendation:
        """Evaluates whether an alternative route from user's current location saves meaningful time."""
        try:
            # 1. Fetch fresh OSRM routes from CURRENT location to destination
            raw_candidates = await OSRMService.get_routes(
                origin_lat=current_lat,
                origin_lon=current_lon,
                dest_lat=dest_lat,
                dest_lon=dest_lon
            )

            # 2. Evaluate with RouteScorer ML model
            ml_evaluated = RouteScorer.evaluate_routes(
                raw_candidates,
                origin_lat=current_lat,
                origin_lon=current_lon,
                dest_lat=dest_lat,
                dest_lon=dest_lon,
                is_emergency_mode=is_emergency_mode
            )

            # 3. Apply CongestionDetector to each candidate to get segment breakdown & live delays
            processed_candidates: List[CandidateRoute] = []
            for candidate in ml_evaluated:
                route_dist_m = candidate.get("distance_meters", 0.0)
                base_dur_s = candidate.get("duration_seconds", 0.0)
                geometry = candidate.get("geometry", {})
                steps = candidate.get("steps", [])

                # Hard Geometry Validation
                coords = geometry.get("coordinates", [])
                if not coords or len(coords) < 2:
                    logger.error("Rejecting reroute candidate: insufficient coordinates")
                    continue
                
                has_nan = any(math.isnan(c[0]) or math.isnan(c[1]) for c in coords)
                if has_nan:
                    logger.error("Rejecting reroute candidate: contains NaN coordinates")
                    continue

                if not steps:
                    logger.error("Rejecting reroute candidate: no steps found")
                    continue

                # 6. Validate Reroute Start Point (tolerance ~250m)
                start_lon, start_lat = coords[0]
                dist_from_vehicle = haversine_distance_m(current_lon, current_lat, start_lon, start_lat)
                if dist_from_vehicle > 250:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=current-point-mismatch candidateStartDistanceMeters={dist_from_vehicle:.1f}")
                    continue
                
                # 7. Validate Reroute End Point (tolerance ~250m)
                end_lon, end_lat = coords[-1]
                dist_from_dest = haversine_distance_m(dest_lon, dest_lat, end_lon, end_lat)
                if dist_from_dest > 250:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=destination-point-mismatch candidateEndDistanceMeters={dist_from_dest:.1f}")
                    continue

                # 8. Calculate Actual Polyline Length
                polyline_dist_m = 0.0
                max_jump_m = 0.0
                for i in range(1, len(coords)):
                    d = haversine_distance_m(coords[i-1][0], coords[i-1][1], coords[i][0], coords[i][1])
                    polyline_dist_m += d
                    if d > max_jump_m: max_jump_m = d
                
                if max_jump_m > 2000.0:  # >2km between consecutive points is suspicious
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=teleport-geometry-detected maxJumpMeters={max_jump_m:.1f}")
                    continue
                
                if polyline_dist_m < 50.0 and route_dist_m > 1000.0:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=absurd-distance-mismatch polylineDistance={polyline_dist_m:.1f} reported={route_dist_m:.1f}")
                    continue

                # 9. Absolute Protection Against Screenshot Bug
                # If current vehicle is > 5000m from destination, candidate route must be at least somewhat proportional.
                dist_to_dest_direct = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
                if dist_to_dest_direct > 5000.0 and route_dist_m < 1000.0:
                    logger.warning(f"[REROUTE CANDIDATE REJECTED] reason=route-too-short-for-distance currentToDest={dist_to_dest_direct:.1f} routeDist={route_dist_m:.1f}")
                    continue

                candidate["route_id"] = str(uuid.uuid4())
                candidate["source"] = "reroute"
                candidate["original_route_index"] = candidate.get("route_index", 0)

                analysis = CongestionDetector.analyze_route(
                    geometry=geometry,
                    steps=steps,
                    total_distance_m=route_dist_m,
                    base_duration_s=base_dur_s,
                    is_emergency_mode=is_emergency_mode
                )

                candidate["segments"] = analysis["segments"]
                candidate["hotspots"] = analysis["hotspots"]
                candidate["clear_distance_km"] = analysis["clear_distance_km"]
                candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
                candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
                candidate["severe_distance_km"] = analysis["severe_distance_km"]
                candidate["total_delay_seconds"] = analysis["total_delay_seconds"]

                # Adjust predicted duration with live segment delays
                live_delay = analysis["total_delay_seconds"]
                ml_predicted_dur = candidate.get("predicted_duration_seconds", base_dur_s)
                final_predicted_dur = max(ml_predicted_dur, base_dur_s + live_delay)
                
                candidate["predicted_duration_seconds"] = final_predicted_dur
                candidate["predicted_duration_minutes"] = round(final_predicted_dur / 60.0, 1)

                processed_candidates.append(CandidateRoute(**candidate))

            if not processed_candidates:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="No viable alternative paths found from current location."
                )

            # Sort by predicted duration (fastest first)
            processed_candidates.sort(key=lambda r: r.predicted_duration_seconds)
            best_route = processed_candidates[0]
            best_duration_s = best_route.predicted_duration_seconds

            # If original duration wasn't provided, use the 2nd best route or standard time as reference
            reference_duration_s = original_remaining_duration_s if original_remaining_duration_s > 0 else (
                processed_candidates[1].predicted_duration_seconds if len(processed_candidates) > 1 else best_duration_s
            )

            time_saved_s = max(0.0, reference_duration_s - best_duration_s)
            time_saved_min = round(time_saved_s / 60.0, 1)

            # Threshold for recommending a reroute: saves at least 90 seconds (1.5 min)
            is_recommended = time_saved_s >= 90.0

            # Tag best route (Point 12: DO NOT mark "Optimal Route" when no reroute exists)
            best_route.is_ai_recommended = is_recommended
            if is_recommended:
                best_route.recommendation_label = f"Fastest Route (Save {int(time_saved_min)}m)"
            else:
                best_route.recommendation_label = None

            reason = ""
            if is_recommended:
                avoided_names = [h.location_name for h in best_route.hotspots if h.congestion_level in ["HEAVY", "SEVERE"]]
                if avoided_names:
                    reason = f"Bypasses congestion near {avoided_names[0]} to save ~{int(time_saved_min)} minutes."
                else:
                    reason = f"Clearer traffic corridor saves ~{int(time_saved_min)} minutes."
            else:
                reason = "Current route remains the fastest available path."
                best_route = None

            # 25. Add a full reroute debug object
            logger.info(f"[REROUTE DEBUG] evaluated_candidate_eta_s={best_duration_s if best_route else -1} original_remaining_eta_s={original_remaining_duration_s} saved_s={time_saved_s} is_recommended={is_recommended} reason='{reason}'")

            return RerouteRecommendation(
                is_reroute_recommended=is_recommended,
                time_saved_seconds=round(time_saved_s, 1),
                time_saved_minutes=time_saved_min,
                original_remaining_seconds=round(reference_duration_s, 1),
                recommended_duration_seconds=round(best_duration_s, 1),
                recommended_route=best_route,
                alternative_routes=processed_candidates,
                reason=reason
            )

        except Exception as e:
            logger.error(f"Error during dynamic reroute evaluation: {str(e)}")
            return RerouteRecommendation(
                is_reroute_recommended=False,
                time_saved_seconds=0.0,
                time_saved_minutes=0.0,
                original_remaining_seconds=original_remaining_duration_s,
                recommended_duration_seconds=original_remaining_duration_s,
                recommended_route=None,
                alternative_routes=[],
                reason=f"Rerouting engine encountered an error: {str(e)}"
            )

```

### backend/services/traffic_service.py
```python
import math
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

class LiveTrafficService:
    """Real-Time Traffic Factor Integration Service (Feature 2).
    
    Ingests and synthesizes real-time traffic telemetry including:
    - Average vehicle speeds (km/h)
    - Traffic density index (0 to 100 vehicles/km)
    - Freeflow baseline speeds
    - Incident / bottleneck choke points
    - Time-of-day historical modulation
    - Pluggable external Traffic API feeds (TomTom / Google Traffic / live probe streams)
    """

    # Major Bengaluru Traffic Corridors & Historical Bottleneck Nodes
    KNOWN_BOTTLENECKS = [
        {
            "id": "silk_board",
            "name": "Central Silk Board Junction",
            "lat": 12.9177,
            "lon": 77.6238,
            "radius_km": 1.2,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 12.0,
            "density_peak": 92.0,
            "incident": "High Volume Choke Point & Metro Construction",
        },
        {
            "id": "marathahalli",
            "name": "Marathahalli Innovative Multiplex Bridge",
            "lat": 12.9562,
            "lon": 77.7011,
            "radius_km": 1.0,
            "freeflow_speed": 50.0,
            "typical_peak_speed": 14.0,
            "density_peak": 88.0,
            "incident": "ORR Heavy Commuter Inflow",
        },
        {
            "id": "tin_factory",
            "name": "Tin Factory / KR Puram Hanging Bridge",
            "lat": 12.9982,
            "lon": 77.6749,
            "radius_km": 1.1,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 10.0,
            "density_peak": 95.0,
            "incident": "Old Madras Road & Outer Ring Road Convergence",
        },
        {
            "id": "hebbal",
            "name": "Hebbal Flyover Junction",
            "lat": 13.0358,
            "lon": 77.5970,
            "radius_km": 1.2,
            "freeflow_speed": 60.0,
            "typical_peak_speed": 16.0,
            "density_peak": 85.0,
            "incident": "Airport Corridor Merge",
        },
        {
            "id": "koramangala_sony",
            "name": "Sony World Signal, Koramangala 80ft Road",
            "lat": 12.9348,
            "lon": 77.6276,
            "radius_km": 0.8,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 15.0,
            "density_peak": 82.0,
            "incident": "Commercial Corridor Density",
        },
        {
            "id": "whitefield_itpl",
            "name": "ITPL Main Road, Whitefield",
            "lat": 12.9857,
            "lon": 77.7318,
            "radius_km": 1.0,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 13.0,
            "density_peak": 87.0,
            "incident": "Tech Park Peak Exit Delay",
        },
        {
            "id": "indiranagar_100ft",
            "name": "100ft Road / 12th Main Indiranagar",
            "lat": 12.9719,
            "lon": 77.6412,
            "radius_km": 0.7,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 18.0,
            "density_peak": 75.0,
            "incident": "Retail Traffic & Curbside Friction",
        },
        {
            "id": "mg_road_trinity",
            "name": "MG Road / Trinity Circle",
            "lat": 12.9733,
            "lon": 77.6186,
            "radius_km": 0.8,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 17.0,
            "density_peak": 78.0,
            "incident": "CBD Core Intersection",
        },
        {
            "id": "ecity_toll",
            "name": "Electronic City Toll Gate / Elevated Tollway",
            "lat": 12.8452,
            "lon": 77.6602,
            "radius_km": 1.0,
            "freeflow_speed": 65.0,
            "typical_peak_speed": 22.0,
            "density_peak": 79.0,
            "incident": "Hosur Road Commute Surge",
        },
    ]


    @classmethod
    def haversine_km(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Computes great-circle distance in kilometers between two GPS coordinates."""
        r = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def get_time_of_day_traffic_intensity(cls, dt: Optional[datetime] = None) -> float:
        """Returns time-of-day traffic intensity multiplier (0.0 to 1.0) based on Bengaluru commuting curves."""
        if dt is None:
            dt = datetime.now(timezone.utc)
            
        # Convert UTC to Indian Standard Time (UTC+5:30)
        ist_hour = (dt.hour + 5 + (dt.minute + 30) // 60) % 24
        ist_minute = (dt.minute + 30) % 60
        time_dec = ist_hour + ist_minute / 60.0
        is_weekend = dt.weekday() in [5, 6]

        if is_weekend:
            # Weekend peak (12:00 PM to 9:00 PM)
            if 12.0 <= time_dec <= 21.0:
                return 0.65 + 0.25 * math.sin((time_dec - 12.0) / 9.0 * math.pi)
            elif 21.0 < time_dec <= 23.5:
                return 0.40
            else:
                return 0.20

        # Weekday: Morning Peak (8:30 AM to 11:30 AM) & Evening Peak (5:00 PM to 9:30 PM)
        if 8.5 <= time_dec <= 11.5:
            return 0.85 + 0.15 * math.sin((time_dec - 8.5) / 3.0 * math.pi)
        elif 17.0 <= time_dec <= 21.5:
            return 0.90 + 0.10 * math.sin((time_dec - 17.0) / 4.5 * math.pi)
        elif 11.5 < time_dec < 17.0:
            return 0.55  # Moderate afternoon traffic
        elif 21.5 < time_dec <= 23.5:
            return 0.35  # Late evening tapering
        else:
            return 0.15  # Night / early morning freeflow

    @classmethod
    def get_point_traffic_factors(
        cls, 
        lat: float, 
        lon: float, 
        prediction_offset_min: float = 0.0,
        now_dt: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Calculates real-time & predictive traffic factors for a given point.
        
        Considers:
        - Proximity to known bottleneck hubs
        - Time-of-day curve (evaluated at current time + prediction_offset_min)
        - Dynamic live incident feeds
        """
        if now_dt is None:
            now_dt = datetime.now(timezone.utc)

        future_timestamp = now_dt.timestamp() + (prediction_offset_min * 60)
        future_dt = datetime.fromtimestamp(future_timestamp, tz=timezone.utc)
        time_intensity = cls.get_time_of_day_traffic_intensity(future_dt)

        # Baseline freeflow conditions
        freeflow_speed = 45.0
        current_speed = freeflow_speed
        density_index = 20.0 + (time_intensity * 35.0)  # Base density 20 - 55%
        active_hotspot = None
        min_dist = float('inf')

        # Check proximity to known bottleneck nodes
        for node in cls.KNOWN_BOTTLENECKS:
            dist = cls.haversine_km(lat, lon, node["lat"], node["lon"])
            if dist <= node["radius_km"]:
                if dist < min_dist:
                    min_dist = dist
                    active_hotspot = node


        if active_hotspot:
            # Inside a bottleneck impact zone
            radius = max(0.1, active_hotspot.get("radius_km", 1.0))
            impact_ratio = max(0.0, min(1.0, 1.0 - (min_dist / radius)))
            peak_speed = active_hotspot.get("typical_peak_speed", 12.0)
            node_freeflow = active_hotspot.get("freeflow_speed", 45.0)
            
            effective_intensity = max(0.65, time_intensity)
            
            # Speed degradation proportional to proximity & intensity
            speed_drop = (node_freeflow - peak_speed) * effective_intensity * impact_ratio
            current_speed = max(5.0, node_freeflow - speed_drop)
            freeflow_speed = node_freeflow
            
            peak_density = active_hotspot.get("density_peak", 90.0)
            density_index = min(98.0, density_index + (peak_density - density_index) * impact_ratio * effective_intensity)
            location_name = active_hotspot["name"]
            incident_desc = active_hotspot.get("incident", "High Congestion Area")
        else:
            # General urban arterial (non-bottleneck road segments)
            # Rebalanced so ordinary roads stay CLEAR under standard and moderate peak conditions,
            # ensuring congestion colors (amber/red/crimson) are concentrated at actual bottlenecks.
            general_drop = 5.0 * time_intensity
            current_speed = max(25.0, freeflow_speed - general_drop)
            location_name = "Urban Arterial Corridor"
            incident_desc = None

        # Determine Congestion Level & Factor
        speed_ratio = current_speed / max(1.0, freeflow_speed)
        congestion_factor = freeflow_speed / max(1.0, current_speed)

        if speed_ratio >= 0.80:
            congestion_level = "CLEAR"
            color = "#10B981"  # Emerald Green
        elif speed_ratio >= 0.50:
            congestion_level = "MODERATE"
            color = "#F59E0B"  # Amber Orange
        elif speed_ratio >= 0.25:
            congestion_level = "HEAVY"
            color = "#EF4444"  # Red
        else:
            congestion_level = "SEVERE"
            color = "#991B1B"  # Deep Crimson Maroon

        return {
            "location_name": location_name,
            "lat": lat,
            "lon": lon,
            "current_speed_kmh": round(current_speed, 1),
            "freeflow_speed_kmh": round(freeflow_speed, 1),
            "density_index": round(density_index, 1),
            "congestion_level": congestion_level,
            "congestion_factor": round(congestion_factor, 2),
            "color": color,
            "incident_description": incident_desc,
            "time_intensity": round(time_intensity, 2)
        }


    @classmethod
    def get_all_active_hotspots(cls) -> List[Dict[str, Any]]:
        """Returns list of all active bottleneck locations with real-time status."""
        results = []
        for bn in cls.KNOWN_BOTTLENECKS:
            tf = cls.get_point_traffic_factors(bn["lat"], bn["lon"])
            results.append({
                **bn,
                **tf
            })
        return results

```

### backend/services/__init__.py
```python
# Services package initialization

```

### backend/tests/test_api.py
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "timestamp" in data

def test_search_endpoint_empty():
    response = client.get("/api/v1/search?q=")
    assert response.status_code == 422 or response.status_code == 400

def test_reverse_endpoint_missing_params():
    response = client.get("/api/v1/reverse")
    assert response.status_code == 422

# Add mock tests for /route to prevent actual network calls during CI
def test_route_missing_body():
    response = client.post("/api/v1/route", json={})
    assert response.status_code == 422

```

### backend/tests/test_ml_pipeline.py
```python
import pytest
from ml.recommender import RouteScorer

def test_emergency_mode_bypass():
    mock_routes = [{
        "distance_meters": 10000.0,
        "duration_seconds": 1200.0,
        "steps": []
    }]
    
    # Run in emergency mode
    evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51, is_emergency_mode=True)
    
    assert len(evaluated) == 1
    # Congestion factor must be exactly 1.0
    assert evaluated[0]["congestion_factor"] == 1.0
    # Predicted duration should match standard duration
    assert evaluated[0]["predicted_duration_seconds"] == 1200.0

def test_computed_fields():
    mock_routes = [
        {
            "distance_meters": 10000.0, # 10km
            "duration_seconds": 1200.0, # 20 mins
            "steps": []
        },
        {
            "distance_meters": 12000.0, # 12km
            "duration_seconds": 1800.0, # 30 mins
            "steps": []
        }
    ]
    
    evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51, is_emergency_mode=True)
    
    assert len(evaluated) == 2
    
    route1 = next(r for r in evaluated if r["distance_meters"] == 10000.0)
    route2 = next(r for r in evaluated if r["distance_meters"] == 12000.0)
    
    assert route1["predicted_average_speed_kmh"] == 30.0 # 10km / (20/60)h
    assert route2["predicted_average_speed_kmh"] == 24.0 # 12km / (30/60)h
    
    # Route 2 is the slowest (30 mins). Delay savings for route 1 = 30 - 20 = 10 mins
    assert route1["delay_savings_minutes"] == 10.0
    # Route 2 saves nothing compared to itself
    assert route2["delay_savings_minutes"] == 0.0

```

### backend/tests/test_new_features.py
```python
import pytest
from fastapi.testclient import TestClient
from main import app
from services.traffic_service import LiveTrafficService
from services.congestion_detector import CongestionDetector
from services.notification_service import PushNotificationService

client = TestClient(app)

def test_health_features():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "features" in data
    assert "congestion_point_identification" in data["features"]
    assert "dynamic_alternative_rerouting" in data["features"]

def test_live_traffic_service_point_factors():
    # Silk board area coordinates
    factors = LiveTrafficService.get_point_traffic_factors(12.9177, 77.6238)
    assert "current_speed_kmh" in factors
    assert "congestion_level" in factors
    assert factors["current_speed_kmh"] > 0
    assert factors["congestion_level"] in ["CLEAR", "MODERATE", "HEAVY", "SEVERE"]
    assert factors["color"].startswith("#")



def test_congestion_detector_analyze():
    # Synthetic route between Indiranagar and Silk Board
    dummy_geometry = {
        "type": "LineString",
        "coordinates": [
            [77.6412, 12.9719],
            [77.6350, 12.9500],
            [77.6276, 12.9348],
            [77.6238, 12.9177]
        ]
    }
    dummy_steps = [
        {"name": "100 Feet Rd", "distance": 1500.0, "duration": 180.0},
        {"name": "Intermediate Ring Rd", "distance": 2500.0, "duration": 300.0},
        {"name": "Hosur Rd", "distance": 2000.0, "duration": 250.0}
    ]

    analysis = CongestionDetector.analyze_route(
        geometry=dummy_geometry,
        steps=dummy_steps,
        total_distance_m=6000.0,
        base_duration_s=730.0,
        is_emergency_mode=False
    )

    assert "segments" in analysis
    assert len(analysis["segments"]) > 0
    assert "hotspots" in analysis
    assert "clear_distance_km" in analysis
    assert "total_delay_seconds" in analysis
    
    first_seg = analysis["segments"][0]
    assert "color" in first_seg
    assert "congestion_level" in first_seg
    assert "predicted_arrival_time_min" in first_seg

def test_push_notification_service():
    payload = PushNotificationService.create_congestion_alert(
        location_name="Silk Board",
        distance_meters=1200.0,
        delay_minutes=8.0,
        speed_kmh=12.0
    )
    assert "Silk Board" in payload.body
    assert "1.2 km" in payload.title
    
    reroute_payload = PushNotificationService.create_reroute_alert(
        time_saved_minutes=7.0,
        via_road="Koramangala 100ft Road"
    )
    assert "7 min" in reroute_payload.title

def test_traffic_factors_endpoint():
    response = client.get("/api/v1/traffic/factors?lat=12.9716&lon=77.5946")
    assert response.status_code == 200
    data = response.json()
    assert "current_speed_kmh" in data
    assert "density_index" in data

def test_traffic_hotspots_endpoint():
    response = client.get("/api/v1/traffic/hotspots")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["hotspots"]) > 0

def test_dynamic_reroute_endpoint():
    payload = {
        "current_lat": 12.9756,
        "current_lon": 77.6066,
        "dest_lat": 12.9352,
        "dest_lon": 77.6245,
        "remaining_seconds": 1200.0,
        "is_emergency_mode": False
    }
    response = client.post("/api/v1/reroute/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "is_reroute_recommended" in data
    assert "reason" in data
    assert "original_remaining_seconds" in data
    assert "recommended_duration_seconds" in data

def test_nearest_point_along_route_calculation():
    # Verify spatial projection logic for seamless reroute vehicle alignment
    coords = [
        [77.6000, 12.9700],
        [77.6050, 12.9700],
        [77.6100, 12.9700],
        [77.6150, 12.9700],
    ]
    current_pt = [77.6052, 12.9701]

    # Calculate nearest coordinate index
    min_dist = float("inf")
    closest_idx = 0
    for i, c in enumerate(coords):
        d = CongestionDetector.haversine_distance(current_pt, c)
        if d < min_dist:
            min_dist = d
            closest_idx = i

    assert closest_idx == 1  # [77.6050, 12.9700] is nearest

    # Calculate cumulative distance up to closest point
    running_dist = 0.0
    for i in range(1, closest_idx + 1):
        running_dist += CongestionDetector.haversine_distance(coords[i-1], coords[i])
    assert running_dist > 500.0


```

### backend/tests/test_reroute_validation.py
```python
import pytest
import math
from services.reroute_engine import DynamicRerouteEngine, haversine_distance_m

@pytest.mark.asyncio
async def test_reject_short_teleport_reroute():
    """
    Test that a 100m route is rejected when the vehicle is 9km away from destination.
    """
    # Current location
    current_lat, current_lon = 12.9716, 77.5946
    
    # Destination ~ 9km away
    dest_lat, dest_lon = 13.0520, 77.5946
    dist_to_dest = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
    assert dist_to_dest > 8000
    
    # Mock candidate geometry that is only 100m long, but starts near the vehicle
    # The end point of this candidate is nowhere near the destination
    end_lat, end_lon = 12.9725, 77.5946
    candidate = {
        "distance_meters": 100.0,
        "duration_seconds": 12.0,
        "geometry": {
            "coordinates": [[current_lon, current_lat], [end_lon, end_lat]]
        },
        "steps": [{"distance": 100, "duration": 12}]
    }
    
    # Patch the OSRM & ML parts
    import services.osrm
    import ml.recommender
    
    async def mock_get_routes(*args, **kwargs):
        return [candidate]
        
    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    
    try:
        rec = await DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1500
        )
        
        # Should reject because end point is not near destination
        assert rec.is_reroute_recommended is False
        assert rec.recommended_route is None
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

@pytest.mark.asyncio
async def test_accept_valid_faster_reroute():
    """
    Test that a valid alternative route that saves time is recommended.
    """
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0520, 77.5946
    
    candidate = {
        "distance_meters": 8000.0,
        "duration_seconds": 1000.0,  # ~16 mins
        "geometry": {
            "coordinates": [
                [current_lon, current_lat],
                [current_lon, 13.0100],
                [dest_lon, dest_lat]
            ]
        },
        "steps": [{"distance": 8000, "duration": 1000}]
    }
    
    import services.osrm
    import ml.recommender
    
    async def mock_get_routes(*args, **kwargs):
        return [candidate]
        
    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    
    try:
        # Original ETA is 26 minutes (1560s)
        rec = await DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1560
        )
        
        # Savings: 1560 - 1000 = 560s (> 90s threshold)
        assert rec.is_reroute_recommended is True
        assert rec.recommended_route is not None
        assert rec.time_saved_seconds == 560.0
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

```

### backend/tests/__init__.py
```python
# Tests package initialization

```

### frontend/.env.example
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1

```

### frontend/.gitkeep
```
# Placeholder directory for Phase 2 Next.js frontend

```

### frontend/next-env.d.ts
```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.

```

### frontend/next.config.mjs
```
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

```

### frontend/package-lock.json
```json
{
  "name": "apexguardian-frontend",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "apexguardian-frontend",
      "version": "0.1.0",
      "dependencies": {
        "clsx": "^2.1.0",
        "framer-motion": "^11.0.8",
        "lucide-react": "^0.358.0",
        "maplibre-gl": "^4.1.1",
        "next": "^14.2.24",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "tailwind-merge": "^2.2.1"
      },
      "devDependencies": {
        "@types/node": "^20.11.28",
        "@types/react": "^18.2.66",
        "@types/react-dom": "^18.2.22",
        "autoprefixer": "^10.4.18",
        "postcss": "^8.4.35",
        "tailwindcss": "^3.4.1",
        "typescript": "^5.4.2"
      }
    },
    "node_modules/@alloc/quick-lru": {
      "version": "5.2.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@mapbox/geojson-rewind": {
      "version": "0.5.2",
      "license": "ISC",
      "dependencies": {
        "get-stream": "^6.0.1",
        "minimist": "^1.2.6"
      },
      "bin": {
        "geojson-rewind": "geojson-rewind"
      }
    },
    "node_modules/@mapbox/jsonlint-lines-primitives": {
      "version": "2.0.3",
      "license": "MIT",
      "engines": {
        "node": ">= 22"
      }
    },
    "node_modules/@mapbox/point-geometry": {
      "version": "0.1.0",
      "license": "ISC"
    },
    "node_modules/@mapbox/tiny-sdf": {
      "version": "2.2.0",
      "license": "BSD-2-Clause"
    },
    "node_modules/@mapbox/unitbezier": {
      "version": "0.0.1",
      "license": "BSD-2-Clause"
    },
    "node_modules/@mapbox/vector-tile": {
      "version": "1.3.1",
      "license": "BSD-3-Clause",
      "dependencies": {
        "@mapbox/point-geometry": "~0.1.0"
      }
    },
    "node_modules/@mapbox/whoots-js": {
      "version": "3.1.0",
      "license": "ISC",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@maplibre/maplibre-gl-style-spec": {
      "version": "20.4.0",
      "license": "ISC",
      "dependencies": {
        "@mapbox/jsonlint-lines-primitives": "~2.0.2",
        "@mapbox/unitbezier": "^0.0.1",
        "json-stringify-pretty-compact": "^4.0.0",
        "minimist": "^1.2.8",
        "quickselect": "^2.0.0",
        "rw": "^1.3.3",
        "tinyqueue": "^3.0.0"
      },
      "bin": {
        "gl-style-format": "dist/gl-style-format.mjs",
        "gl-style-migrate": "dist/gl-style-migrate.mjs",
        "gl-style-validate": "dist/gl-style-validate.mjs"
      }
    },
    "node_modules/@maplibre/maplibre-gl-style-spec/node_modules/quickselect": {
      "version": "2.0.0",
      "license": "ISC"
    },
    "node_modules/@next/env": {
      "version": "14.2.35",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-14.2.35.tgz",
      "integrity": "sha512-DuhvCtj4t9Gwrx80dmz2F4t/zKQ4ktN8WrMwOuVzkJfBilwAwGr6v16M5eI8yCuZ63H9TTuEU09Iu2HqkzFPVQ==",
      "license": "MIT"
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-14.2.33.tgz",
      "integrity": "sha512-HqYnb6pxlsshoSTubdXKu15g3iivcbsMXg4bYpjL2iS/V6aQot+iyF4BUc2qA/J/n55YtvE4PHMKWBKGCF/+wA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.33.tgz",
      "integrity": "sha512-8HGBeAE5rX3jzKvF593XTTFg3gxeU4f+UWnswa6JPhzaR6+zblO5+fjltJWIZc4aUalqTclvN2QtTC37LxvZAA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-14.2.33.tgz",
      "integrity": "sha512-JXMBka6lNNmqbkvcTtaX8Gu5by9547bukHQvPoLe9VRBx1gHwzf5tdt4AaezW85HAB3pikcvyqBToRTDA4DeLw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-14.2.33.tgz",
      "integrity": "sha512-Bm+QulsAItD/x6Ih8wGIMfRJy4G73tu1HJsrccPW6AfqdZd0Sfm5Imhgkgq2+kly065rYMnCOxTBvmvFY1BKfg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-14.2.33.tgz",
      "integrity": "sha512-FnFn+ZBgsVMbGDsTqo8zsnRzydvsGV8vfiWwUo1LD8FTmPTdV+otGSWKc4LJec0oSexFnCYVO4hX8P8qQKaSlg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-14.2.33.tgz",
      "integrity": "sha512-345tsIWMzoXaQndUTDv1qypDRiebFxGYx9pYkhwY4hBRaOLt8UGfiWKr9FSSHs25dFIf8ZqIFaPdy5MljdoawA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-14.2.33.tgz",
      "integrity": "sha512-nscpt0G6UCTkrT2ppnJnFsYbPDQwmum4GNXYTeoTIdsmMydSKFz9Iny2jpaRupTb+Wl298+Rh82WKzt9LCcqSQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-ia32-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-ia32-msvc/-/swc-win32-ia32-msvc-14.2.33.tgz",
      "integrity": "sha512-pc9LpGNKhJ0dXQhZ5QMmYxtARwwmWLpeocFmVG5Z0DzWq5Uf0izcI8tLc+qOpqxO1PWqZ5A7J1blrUIKrIFc7Q==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz",
      "integrity": "sha512-nOjfZMy8B94MdisuzZo9/57xuFVLHJaDj5e/xrduJp9CV2/HrfxTRH2fbyLe+K9QT41WBLUd4iXX3R7jBp0EUg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@swc/counter": {
      "version": "0.1.3",
      "resolved": "https://registry.npmjs.org/@swc/counter/-/counter-0.1.3.tgz",
      "integrity": "sha512-e2BR4lsJkkRlKZ/qCHPw9ZaSxc0MVUd7gtbtaB7aMvHeJVYe8sOB8DBZkP2DtISHGSku9sCK6T6cnY0CtXrOCQ==",
      "license": "Apache-2.0"
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.5",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.5.tgz",
      "integrity": "sha512-KGYxvIOXcceOAbEk4bi/dVLEK9z8sZ0uBB3Il5b1rhfClSpcX0yfRO0KmTkqR2cnQDymwLB+25ZyMzICg/cm/A==",
      "license": "Apache-2.0",
      "dependencies": {
        "@swc/counter": "^0.1.3",
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@types/geojson": {
      "version": "7946.0.16",
      "license": "MIT"
    },
    "node_modules/@types/geojson-vt": {
      "version": "3.2.5",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*"
      }
    },
    "node_modules/@types/mapbox__point-geometry": {
      "version": "0.1.4",
      "license": "MIT"
    },
    "node_modules/@types/mapbox__vector-tile": {
      "version": "1.3.4",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*",
        "@types/mapbox__point-geometry": "*",
        "@types/pbf": "*"
      }
    },
    "node_modules/@types/node": {
      "version": "20.19.43",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/pbf": {
      "version": "3.0.5",
      "license": "MIT"
    },
    "node_modules/@types/prop-types": {
      "version": "15.7.15",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/react": {
      "version": "18.3.31",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "@types/prop-types": "*",
        "csstype": "^3.2.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "18.3.7",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^18.0.0"
      }
    },
    "node_modules/@types/supercluster": {
      "version": "7.1.3",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*"
      }
    },
    "node_modules/any-promise": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/anymatch": {
      "version": "3.1.3",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "normalize-path": "^3.0.0",
        "picomatch": "^2.0.4"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/arg": {
      "version": "5.0.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/autoprefixer": {
      "version": "10.5.4",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/autoprefixer"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "browserslist": "^4.28.6",
        "caniuse-lite": "^1.0.30001806",
        "fraction.js": "^5.3.4",
        "picocolors": "^1.1.1",
        "postcss-value-parser": "^4.2.0"
      },
      "bin": {
        "autoprefixer": "bin/autoprefixer"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      },
      "peerDependencies": {
        "postcss": "^8.1.0"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.11.11",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/binary-extensions": {
      "version": "2.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/browserslist": {
      "version": "4.28.7",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "baseline-browser-mapping": "^2.10.44",
        "caniuse-lite": "^1.0.30001806",
        "electron-to-chromium": "^1.5.393",
        "node-releases": "^2.0.51",
        "update-browserslist-db": "^1.2.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/busboy": {
      "version": "1.6.0",
      "dependencies": {
        "streamsearch": "^1.1.0"
      },
      "engines": {
        "node": ">=10.16.0"
      }
    },
    "node_modules/camelcase-css": {
      "version": "2.0.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001806",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chokidar": {
      "version": "3.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "anymatch": "~3.1.2",
        "braces": "~3.0.2",
        "glob-parent": "~5.1.2",
        "is-binary-path": "~2.1.0",
        "is-glob": "~4.0.1",
        "normalize-path": "~3.0.0",
        "readdirp": "~3.6.0"
      },
      "engines": {
        "node": ">= 8.10.0"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/chokidar/node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/chokidar/node_modules/glob-parent": {
      "version": "5.1.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "license": "MIT"
    },
    "node_modules/clsx": {
      "version": "2.1.1",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/commander": {
      "version": "4.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/cssesc": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "bin": {
        "cssesc": "bin/cssesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/csstype": {
      "version": "3.2.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/didyoumean": {
      "version": "1.2.2",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/dlv": {
      "version": "1.1.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/earcut": {
      "version": "3.2.3",
      "license": "ISC"
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.399",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fast-glob/node_modules/glob-parent": {
      "version": "5.1.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/fastq": {
      "version": "1.20.1",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/fraction.js": {
      "version": "5.3.4",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "*"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/rawify"
      }
    },
    "node_modules/framer-motion": {
      "version": "11.18.2",
      "license": "MIT",
      "dependencies": {
        "motion-dom": "^11.18.1",
        "motion-utils": "^11.18.1",
        "tslib": "^2.4.0"
      },
      "peerDependencies": {
        "@emotion/is-prop-valid": "*",
        "react": "^18.0.0 || ^19.0.0",
        "react-dom": "^18.0.0 || ^19.0.0"
      },
      "peerDependenciesMeta": {
        "@emotion/is-prop-valid": {
          "optional": true
        },
        "react": {
          "optional": true
        },
        "react-dom": {
          "optional": true
        }
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/geojson-vt": {
      "version": "4.0.3",
      "license": "ISC"
    },
    "node_modules/get-stream": {
      "version": "6.0.1",
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/gl-matrix": {
      "version": "3.4.4",
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/global-prefix": {
      "version": "4.0.0",
      "license": "MIT",
      "dependencies": {
        "ini": "^4.1.3",
        "kind-of": "^6.0.3",
        "which": "^4.0.0"
      },
      "engines": {
        "node": ">=16"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "license": "ISC"
    },
    "node_modules/hasown": {
      "version": "2.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/ieee754": {
      "version": "1.2.1",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/ini": {
      "version": "4.1.3",
      "license": "ISC",
      "engines": {
        "node": "^14.17.0 || ^16.13.0 || >=18.0.0"
      }
    },
    "node_modules/is-binary-path": {
      "version": "2.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "binary-extensions": "^2.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.16.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/isexe": {
      "version": "3.1.5",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/jiti": {
      "version": "1.21.7",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "bin": {
        "jiti": "bin/jiti.js"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "license": "MIT"
    },
    "node_modules/json-stringify-pretty-compact": {
      "version": "4.0.0",
      "license": "MIT"
    },
    "node_modules/kdbush": {
      "version": "4.1.0",
      "license": "ISC"
    },
    "node_modules/kind-of": {
      "version": "6.0.3",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/lilconfig": {
      "version": "3.1.3",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/antonk52"
      }
    },
    "node_modules/lines-and-columns": {
      "version": "1.2.4",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/loose-envify": {
      "version": "1.4.0",
      "license": "MIT",
      "dependencies": {
        "js-tokens": "^3.0.0 || ^4.0.0"
      },
      "bin": {
        "loose-envify": "cli.js"
      }
    },
    "node_modules/lucide-react": {
      "version": "0.358.0",
      "license": "ISC",
      "peerDependencies": {
        "react": "^16.5.1 || ^17.0.0 || ^18.0.0"
      }
    },
    "node_modules/maplibre-gl": {
      "version": "4.7.1",
      "license": "BSD-3-Clause",
      "dependencies": {
        "@mapbox/geojson-rewind": "^0.5.2",
        "@mapbox/jsonlint-lines-primitives": "^2.0.2",
        "@mapbox/point-geometry": "^0.1.0",
        "@mapbox/tiny-sdf": "^2.0.6",
        "@mapbox/unitbezier": "^0.0.1",
        "@mapbox/vector-tile": "^1.3.1",
        "@mapbox/whoots-js": "^3.1.0",
        "@maplibre/maplibre-gl-style-spec": "^20.3.1",
        "@types/geojson": "^7946.0.14",
        "@types/geojson-vt": "3.2.5",
        "@types/mapbox__point-geometry": "^0.1.4",
        "@types/mapbox__vector-tile": "^1.3.4",
        "@types/pbf": "^3.0.5",
        "@types/supercluster": "^7.1.3",
        "earcut": "^3.0.0",
        "geojson-vt": "^4.0.2",
        "gl-matrix": "^3.4.3",
        "global-prefix": "^4.0.0",
        "kdbush": "^4.0.2",
        "murmurhash-js": "^1.0.0",
        "pbf": "^3.3.0",
        "potpack": "^2.0.0",
        "quickselect": "^3.0.0",
        "supercluster": "^8.0.1",
        "tinyqueue": "^3.0.0",
        "vt-pbf": "^3.1.3"
      },
      "engines": {
        "node": ">=16.14.0",
        "npm": ">=8.1.0"
      },
      "funding": {
        "url": "https://github.com/maplibre/maplibre-gl-js?sponsor=1"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/motion-dom": {
      "version": "11.18.1",
      "license": "MIT",
      "dependencies": {
        "motion-utils": "^11.18.1"
      }
    },
    "node_modules/motion-utils": {
      "version": "11.18.1",
      "license": "MIT"
    },
    "node_modules/murmurhash-js": {
      "version": "1.0.0",
      "license": "MIT"
    },
    "node_modules/mz": {
      "version": "2.7.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0",
        "object-assign": "^4.0.1",
        "thenify-all": "^1.0.0"
      }
    },
    "node_modules/nanoid": {
      "version": "3.3.16",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/next": {
      "version": "14.2.35",
      "resolved": "https://registry.npmjs.org/next/-/next-14.2.35.tgz",
      "integrity": "sha512-KhYd2Hjt/O1/1aZVX3dCwGXM1QmOV4eNM2UTacK5gipDdPN/oHHK/4oVGy7X8GMfPMsUTUEmGlsy0EY1YGAkig==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "14.2.35",
        "@swc/helpers": "0.5.5",
        "busboy": "1.6.0",
        "caniuse-lite": "^1.0.30001579",
        "graceful-fs": "^4.2.11",
        "postcss": "8.4.31",
        "styled-jsx": "5.1.1"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": ">=18.17.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "14.2.33",
        "@next/swc-darwin-x64": "14.2.33",
        "@next/swc-linux-arm64-gnu": "14.2.33",
        "@next/swc-linux-arm64-musl": "14.2.33",
        "@next/swc-linux-x64-gnu": "14.2.33",
        "@next/swc-linux-x64-musl": "14.2.33",
        "@next/swc-win32-arm64-msvc": "14.2.33",
        "@next/swc-win32-ia32-msvc": "14.2.33",
        "@next/swc-win32-x64-msvc": "14.2.33"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.41.2",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/next/node_modules/postcss": {
      "version": "8.4.31",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.6",
        "picocolors": "^1.0.0",
        "source-map-js": "^1.0.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/node-releases": {
      "version": "2.0.51",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/normalize-path": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-hash": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/pbf": {
      "version": "3.3.0",
      "license": "BSD-3-Clause",
      "dependencies": {
        "ieee754": "^1.1.12",
        "resolve-protobuf-schema": "^2.1.0"
      },
      "bin": {
        "pbf": "bin/pbf"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "2.3.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pify": {
      "version": "2.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/pirates": {
      "version": "4.0.7",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.25",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "nanoid": "^3.3.16",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/postcss-import": {
      "version": "15.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "postcss-value-parser": "^4.0.0",
        "read-cache": "^1.0.0",
        "resolve": "^1.1.7"
      },
      "engines": {
        "node": ">=14.0.0"
      },
      "peerDependencies": {
        "postcss": "^8.0.0"
      }
    },
    "node_modules/postcss-js": {
      "version": "4.1.0",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "camelcase-css": "^2.0.1"
      },
      "engines": {
        "node": "^12 || ^14 || >= 16"
      },
      "peerDependencies": {
        "postcss": "^8.4.21"
      }
    },
    "node_modules/postcss-load-config": {
      "version": "6.0.1",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "lilconfig": "^3.1.1"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "jiti": ">=1.21.0",
        "postcss": ">=8.0.9",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        },
        "postcss": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/postcss-nested": {
      "version": "6.2.0",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "postcss-selector-parser": "^6.1.1"
      },
      "engines": {
        "node": ">=12.0"
      },
      "peerDependencies": {
        "postcss": "^8.2.14"
      }
    },
    "node_modules/postcss-selector-parser": {
      "version": "6.1.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cssesc": "^3.0.0",
        "util-deprecate": "^1.0.2"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/postcss-value-parser": {
      "version": "4.2.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/potpack": {
      "version": "2.1.0",
      "license": "ISC"
    },
    "node_modules/protocol-buffers-schema": {
      "version": "3.6.1",
      "license": "MIT"
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/quickselect": {
      "version": "3.0.0",
      "license": "ISC"
    },
    "node_modules/react": {
      "version": "18.3.1",
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "loose-envify": "^1.1.0"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "18.3.1",
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "loose-envify": "^1.1.0",
        "scheduler": "^0.23.2"
      },
      "peerDependencies": {
        "react": "^18.3.1"
      }
    },
    "node_modules/read-cache": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "pify": "^2.3.0"
      }
    },
    "node_modules/readdirp": {
      "version": "3.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "picomatch": "^2.2.1"
      },
      "engines": {
        "node": ">=8.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.12",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve-protobuf-schema": {
      "version": "2.1.0",
      "license": "MIT",
      "dependencies": {
        "protocol-buffers-schema": "^3.3.1"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/rw": {
      "version": "1.3.3",
      "license": "BSD-3-Clause"
    },
    "node_modules/scheduler": {
      "version": "0.23.2",
      "license": "MIT",
      "dependencies": {
        "loose-envify": "^1.1.0"
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/streamsearch": {
      "version": "1.1.0",
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.1",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/sucrase": {
      "version": "3.35.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.2",
        "commander": "^4.0.0",
        "lines-and-columns": "^1.1.6",
        "mz": "^2.7.0",
        "pirates": "^4.0.1",
        "tinyglobby": "^0.2.11",
        "ts-interface-checker": "^0.1.9"
      },
      "bin": {
        "sucrase": "bin/sucrase",
        "sucrase-node": "bin/sucrase-node"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/supercluster": {
      "version": "8.0.1",
      "license": "ISC",
      "dependencies": {
        "kdbush": "^4.0.2"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tailwind-merge": {
      "version": "2.6.1",
      "license": "MIT",
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/dcastil"
      }
    },
    "node_modules/tailwindcss": {
      "version": "3.4.19",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@alloc/quick-lru": "^5.2.0",
        "arg": "^5.0.2",
        "chokidar": "^3.6.0",
        "didyoumean": "^1.2.2",
        "dlv": "^1.1.3",
        "fast-glob": "^3.3.2",
        "glob-parent": "^6.0.2",
        "is-glob": "^4.0.3",
        "jiti": "^1.21.7",
        "lilconfig": "^3.1.3",
        "micromatch": "^4.0.8",
        "normalize-path": "^3.0.0",
        "object-hash": "^3.0.0",
        "picocolors": "^1.1.1",
        "postcss": "^8.4.47",
        "postcss-import": "^15.1.0",
        "postcss-js": "^4.0.1",
        "postcss-load-config": "^4.0.2 || ^5.0 || ^6.0",
        "postcss-nested": "^6.2.0",
        "postcss-selector-parser": "^6.1.2",
        "resolve": "^1.22.8",
        "sucrase": "^3.35.0"
      },
      "bin": {
        "tailwind": "lib/cli.js",
        "tailwindcss": "lib/cli.js"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/thenify": {
      "version": "3.3.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0"
      }
    },
    "node_modules/thenify-all": {
      "version": "1.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "thenify": ">= 3.1.0 < 4"
      },
      "engines": {
        "node": ">=0.8"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyglobby/node_modules/fdir": {
      "version": "6.5.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/tinyglobby/node_modules/picomatch": {
      "version": "4.0.5",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/tinyqueue": {
      "version": "3.0.0",
      "license": "ISC"
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/ts-interface-checker": {
      "version": "0.1.13",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "license": "0BSD"
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/update-browserslist-db": {
      "version": "1.2.3",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/vt-pbf": {
      "version": "3.1.3",
      "license": "MIT",
      "dependencies": {
        "@mapbox/point-geometry": "0.1.0",
        "@mapbox/vector-tile": "^1.3.1",
        "pbf": "^3.2.1"
      }
    },
    "node_modules/which": {
      "version": "4.0.0",
      "license": "ISC",
      "dependencies": {
        "isexe": "^3.1.1"
      },
      "bin": {
        "node-which": "bin/which.js"
      },
      "engines": {
        "node": "^16.13.0 || >=18.0.0"
      }
    }
  }
}

```

### frontend/package.json
```json
{
  "name": "apexguardian-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "clsx": "^2.1.0",
    "framer-motion": "^11.0.8",
    "lucide-react": "^0.358.0",
    "maplibre-gl": "^4.1.1",
    "next": "^14.2.24",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.28",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2"
  }
}

```

### frontend/postcss.config.js
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

### frontend/tailwind.config.ts
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;

```

### frontend/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```

### frontend/tsconfig.tsbuildinfo
```
{"fileNames":["./node_modules/typescript/lib/lib.es5.d.ts","./node_modules/typescript/lib/lib.es2015.d.ts","./node_modules/typescript/lib/lib.es2016.d.ts","./node_modules/typescript/lib/lib.es2017.d.ts","./node_modules/typescript/lib/lib.es2018.d.ts","./node_modules/typescript/lib/lib.es2019.d.ts","./node_modules/typescript/lib/lib.es2020.d.ts","./node_modules/typescript/lib/lib.es2021.d.ts","./node_modules/typescript/lib/lib.es2022.d.ts","./node_modules/typescript/lib/lib.es2023.d.ts","./node_modules/typescript/lib/lib.es2024.d.ts","./node_modules/typescript/lib/lib.esnext.d.ts","./node_modules/typescript/lib/lib.dom.d.ts","./node_modules/typescript/lib/lib.dom.iterable.d.ts","./node_modules/typescript/lib/lib.es2015.core.d.ts","./node_modules/typescript/lib/lib.es2015.collection.d.ts","./node_modules/typescript/lib/lib.es2015.generator.d.ts","./node_modules/typescript/lib/lib.es2015.iterable.d.ts","./node_modules/typescript/lib/lib.es2015.promise.d.ts","./node_modules/typescript/lib/lib.es2015.proxy.d.ts","./node_modules/typescript/lib/lib.es2015.reflect.d.ts","./node_modules/typescript/lib/lib.es2015.symbol.d.ts","./node_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts","./node_modules/typescript/lib/lib.es2016.array.include.d.ts","./node_modules/typescript/lib/lib.es2016.intl.d.ts","./node_modules/typescript/lib/lib.es2017.arraybuffer.d.ts","./node_modules/typescript/lib/lib.es2017.date.d.ts","./node_modules/typescript/lib/lib.es2017.object.d.ts","./node_modules/typescript/lib/lib.es2017.sharedmemory.d.ts","./node_modules/typescript/lib/lib.es2017.string.d.ts","./node_modules/typescript/lib/lib.es2017.intl.d.ts","./node_modules/typescript/lib/lib.es2017.typedarrays.d.ts","./node_modules/typescript/lib/lib.es2018.asyncgenerator.d.ts","./node_modules/typescript/lib/lib.es2018.asynciterable.d.ts","./node_modules/typescript/lib/lib.es2018.intl.d.ts","./node_modules/typescript/lib/lib.es2018.promise.d.ts","./node_modules/typescript/lib/lib.es2018.regexp.d.ts","./node_modules/typescript/lib/lib.es2019.array.d.ts","./node_modules/typescript/lib/lib.es2019.object.d.ts","./node_modules/typescript/lib/lib.es2019.string.d.ts","./node_modules/typescript/lib/lib.es2019.symbol.d.ts","./node_modules/typescript/lib/lib.es2019.intl.d.ts","./node_modules/typescript/lib/lib.es2020.bigint.d.ts","./node_modules/typescript/lib/lib.es2020.date.d.ts","./node_modules/typescript/lib/lib.es2020.promise.d.ts","./node_modules/typescript/lib/lib.es2020.sharedmemory.d.ts","./node_modules/typescript/lib/lib.es2020.string.d.ts","./node_modules/typescript/lib/lib.es2020.symbol.wellknown.d.ts","./node_modules/typescript/lib/lib.es2020.intl.d.ts","./node_modules/typescript/lib/lib.es2020.number.d.ts","./node_modules/typescript/lib/lib.es2021.promise.d.ts","./node_modules/typescript/lib/lib.es2021.string.d.ts","./node_modules/typescript/lib/lib.es2021.weakref.d.ts","./node_modules/typescript/lib/lib.es2021.intl.d.ts","./node_modules/typescript/lib/lib.es2022.array.d.ts","./node_modules/typescript/lib/lib.es2022.error.d.ts","./node_modules/typescript/lib/lib.es2022.intl.d.ts","./node_modules/typescript/lib/lib.es2022.object.d.ts","./node_modules/typescript/lib/lib.es2022.string.d.ts","./node_modules/typescript/lib/lib.es2022.regexp.d.ts","./node_modules/typescript/lib/lib.es2023.array.d.ts","./node_modules/typescript/lib/lib.es2023.collection.d.ts","./node_modules/typescript/lib/lib.es2023.intl.d.ts","./node_modules/typescript/lib/lib.es2024.arraybuffer.d.ts","./node_modules/typescript/lib/lib.es2024.collection.d.ts","./node_modules/typescript/lib/lib.es2024.object.d.ts","./node_modules/typescript/lib/lib.es2024.promise.d.ts","./node_modules/typescript/lib/lib.es2024.regexp.d.ts","./node_modules/typescript/lib/lib.es2024.sharedmemory.d.ts","./node_modules/typescript/lib/lib.es2024.string.d.ts","./node_modules/typescript/lib/lib.esnext.array.d.ts","./node_modules/typescript/lib/lib.esnext.collection.d.ts","./node_modules/typescript/lib/lib.esnext.intl.d.ts","./node_modules/typescript/lib/lib.esnext.disposable.d.ts","./node_modules/typescript/lib/lib.esnext.promise.d.ts","./node_modules/typescript/lib/lib.esnext.decorators.d.ts","./node_modules/typescript/lib/lib.esnext.iterator.d.ts","./node_modules/typescript/lib/lib.esnext.float16.d.ts","./node_modules/typescript/lib/lib.esnext.error.d.ts","./node_modules/typescript/lib/lib.esnext.sharedmemory.d.ts","./node_modules/typescript/lib/lib.decorators.d.ts","./node_modules/typescript/lib/lib.decorators.legacy.d.ts","./node_modules/next/dist/styled-jsx/types/css.d.ts","./node_modules/@types/react/global.d.ts","./node_modules/csstype/index.d.ts","./node_modules/@types/prop-types/index.d.ts","./node_modules/@types/react/index.d.ts","./node_modules/next/dist/styled-jsx/types/index.d.ts","./node_modules/next/dist/styled-jsx/types/macro.d.ts","./node_modules/next/dist/styled-jsx/types/style.d.ts","./node_modules/next/dist/styled-jsx/types/global.d.ts","./node_modules/next/dist/shared/lib/amp.d.ts","./node_modules/next/amp.d.ts","./node_modules/@types/node/compatibility/disposable.d.ts","./node_modules/@types/node/compatibility/indexable.d.ts","./node_modules/@types/node/compatibility/iterators.d.ts","./node_modules/@types/node/compatibility/index.d.ts","./node_modules/@types/node/globals.typedarray.d.ts","./node_modules/@types/node/buffer.buffer.d.ts","./node_modules/@types/node/globals.d.ts","./node_modules/@types/node/web-globals/abortcontroller.d.ts","./node_modules/@types/node/web-globals/domexception.d.ts","./node_modules/@types/node/web-globals/events.d.ts","./node_modules/undici-types/header.d.ts","./node_modules/undici-types/readable.d.ts","./node_modules/undici-types/file.d.ts","./node_modules/undici-types/fetch.d.ts","./node_modules/undici-types/formdata.d.ts","./node_modules/undici-types/connector.d.ts","./node_modules/undici-types/client.d.ts","./node_modules/undici-types/errors.d.ts","./node_modules/undici-types/dispatcher.d.ts","./node_modules/undici-types/global-dispatcher.d.ts","./node_modules/undici-types/global-origin.d.ts","./node_modules/undici-types/pool-stats.d.ts","./node_modules/undici-types/pool.d.ts","./node_modules/undici-types/handlers.d.ts","./node_modules/undici-types/balanced-pool.d.ts","./node_modules/undici-types/agent.d.ts","./node_modules/undici-types/mock-interceptor.d.ts","./node_modules/undici-types/mock-agent.d.ts","./node_modules/undici-types/mock-client.d.ts","./node_modules/undici-types/mock-pool.d.ts","./node_modules/undici-types/mock-errors.d.ts","./node_modules/undici-types/proxy-agent.d.ts","./node_modules/undici-types/env-http-proxy-agent.d.ts","./node_modules/undici-types/retry-handler.d.ts","./node_modules/undici-types/retry-agent.d.ts","./node_modules/undici-types/api.d.ts","./node_modules/undici-types/interceptors.d.ts","./node_modules/undici-types/util.d.ts","./node_modules/undici-types/cookies.d.ts","./node_modules/undici-types/patch.d.ts","./node_modules/undici-types/websocket.d.ts","./node_modules/undici-types/eventsource.d.ts","./node_modules/undici-types/filereader.d.ts","./node_modules/undici-types/diagnostics-channel.d.ts","./node_modules/undici-types/content-type.d.ts","./node_modules/undici-types/cache.d.ts","./node_modules/undici-types/index.d.ts","./node_modules/@types/node/web-globals/fetch.d.ts","./node_modules/@types/node/assert.d.ts","./node_modules/@types/node/assert/strict.d.ts","./node_modules/@types/node/async_hooks.d.ts","./node_modules/@types/node/buffer.d.ts","./node_modules/@types/node/child_process.d.ts","./node_modules/@types/node/cluster.d.ts","./node_modules/@types/node/console.d.ts","./node_modules/@types/node/constants.d.ts","./node_modules/@types/node/crypto.d.ts","./node_modules/@types/node/dgram.d.ts","./node_modules/@types/node/diagnostics_channel.d.ts","./node_modules/@types/node/dns.d.ts","./node_modules/@types/node/dns/promises.d.ts","./node_modules/@types/node/domain.d.ts","./node_modules/@types/node/events.d.ts","./node_modules/@types/node/fs.d.ts","./node_modules/@types/node/fs/promises.d.ts","./node_modules/@types/node/http.d.ts","./node_modules/@types/node/http2.d.ts","./node_modules/@types/node/https.d.ts","./node_modules/@types/node/inspector.generated.d.ts","./node_modules/@types/node/module.d.ts","./node_modules/@types/node/net.d.ts","./node_modules/@types/node/os.d.ts","./node_modules/@types/node/path.d.ts","./node_modules/@types/node/perf_hooks.d.ts","./node_modules/@types/node/process.d.ts","./node_modules/@types/node/punycode.d.ts","./node_modules/@types/node/querystring.d.ts","./node_modules/@types/node/readline.d.ts","./node_modules/@types/node/readline/promises.d.ts","./node_modules/@types/node/repl.d.ts","./node_modules/@types/node/sea.d.ts","./node_modules/@types/node/stream.d.ts","./node_modules/@types/node/stream/promises.d.ts","./node_modules/@types/node/stream/consumers.d.ts","./node_modules/@types/node/stream/web.d.ts","./node_modules/@types/node/string_decoder.d.ts","./node_modules/@types/node/test.d.ts","./node_modules/@types/node/timers.d.ts","./node_modules/@types/node/timers/promises.d.ts","./node_modules/@types/node/tls.d.ts","./node_modules/@types/node/trace_events.d.ts","./node_modules/@types/node/tty.d.ts","./node_modules/@types/node/url.d.ts","./node_modules/@types/node/util.d.ts","./node_modules/@types/node/v8.d.ts","./node_modules/@types/node/vm.d.ts","./node_modules/@types/node/wasi.d.ts","./node_modules/@types/node/worker_threads.d.ts","./node_modules/@types/node/zlib.d.ts","./node_modules/@types/node/index.d.ts","./node_modules/next/dist/server/get-page-files.d.ts","./node_modules/@types/react/canary.d.ts","./node_modules/@types/react/experimental.d.ts","./node_modules/@types/react-dom/index.d.ts","./node_modules/@types/react-dom/canary.d.ts","./node_modules/@types/react-dom/experimental.d.ts","./node_modules/next/dist/compiled/webpack/webpack.d.ts","./node_modules/next/dist/server/config.d.ts","./node_modules/next/dist/lib/load-custom-routes.d.ts","./node_modules/next/dist/shared/lib/image-config.d.ts","./node_modules/next/dist/build/webpack/plugins/subresource-integrity-plugin.d.ts","./node_modules/next/dist/server/body-streams.d.ts","./node_modules/next/dist/server/future/route-kind.d.ts","./node_modules/next/dist/server/future/route-definitions/route-definition.d.ts","./node_modules/next/dist/server/future/route-matches/route-match.d.ts","./node_modules/next/dist/client/components/app-router-headers.d.ts","./node_modules/next/dist/server/request-meta.d.ts","./node_modules/next/dist/server/config-shared.d.ts","./node_modules/next/dist/server/base-http/index.d.ts","./node_modules/next/dist/server/api-utils/index.d.ts","./node_modules/next/dist/server/node-environment.d.ts","./node_modules/next/dist/server/require-hook.d.ts","./node_modules/next/dist/server/node-polyfill-crypto.d.ts","./node_modules/next/dist/lib/page-types.d.ts","./node_modules/next/dist/build/analysis/get-page-static-info.d.ts","./node_modules/next/dist/build/webpack/loaders/get-module-build-info.d.ts","./node_modules/next/dist/build/webpack/plugins/middleware-plugin.d.ts","./node_modules/next/dist/server/lib/revalidate.d.ts","./node_modules/next/dist/server/render-result.d.ts","./node_modules/next/dist/server/future/helpers/i18n-provider.d.ts","./node_modules/next/dist/server/web/next-url.d.ts","./node_modules/next/dist/compiled/@edge-runtime/cookies/index.d.ts","./node_modules/next/dist/server/web/spec-extension/cookies.d.ts","./node_modules/next/dist/server/web/spec-extension/request.d.ts","./node_modules/next/dist/server/web/spec-extension/fetch-event.d.ts","./node_modules/next/dist/server/web/spec-extension/response.d.ts","./node_modules/next/dist/server/web/types.d.ts","./node_modules/next/dist/lib/setup-exception-listeners.d.ts","./node_modules/next/dist/lib/constants.d.ts","./node_modules/next/dist/build/index.d.ts","./node_modules/next/dist/build/webpack/plugins/pages-manifest-plugin.d.ts","./node_modules/next/dist/shared/lib/router/utils/route-regex.d.ts","./node_modules/next/dist/shared/lib/router/utils/route-matcher.d.ts","./node_modules/next/dist/shared/lib/router/utils/parse-url.d.ts","./node_modules/next/dist/server/base-http/node.d.ts","./node_modules/next/dist/server/font-utils.d.ts","./node_modules/next/dist/build/webpack/plugins/flight-manifest-plugin.d.ts","./node_modules/next/dist/server/future/route-modules/route-module.d.ts","./node_modules/next/dist/server/load-components.d.ts","./node_modules/next/dist/shared/lib/router/utils/middleware-route-matcher.d.ts","./node_modules/next/dist/build/webpack/plugins/next-font-manifest-plugin.d.ts","./node_modules/next/dist/server/future/route-definitions/locale-route-definition.d.ts","./node_modules/next/dist/server/future/route-definitions/pages-route-definition.d.ts","./node_modules/next/dist/shared/lib/mitt.d.ts","./node_modules/next/dist/client/with-router.d.ts","./node_modules/next/dist/client/router.d.ts","./node_modules/next/dist/client/route-loader.d.ts","./node_modules/next/dist/client/page-loader.d.ts","./node_modules/next/dist/shared/lib/bloom-filter.d.ts","./node_modules/next/dist/shared/lib/router/router.d.ts","./node_modules/next/dist/shared/lib/router-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/loadable-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/loadable.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/image-config-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/hooks-client-context.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/head-manager-context.shared-runtime.d.ts","./node_modules/next/dist/server/future/route-definitions/app-page-route-definition.d.ts","./node_modules/next/dist/shared/lib/modern-browserslist-target.d.ts","./node_modules/next/dist/shared/lib/constants.d.ts","./node_modules/next/dist/build/webpack/loaders/metadata/types.d.ts","./node_modules/next/dist/build/page-extensions-type.d.ts","./node_modules/next/dist/build/webpack/loaders/next-app-loader.d.ts","./node_modules/next/dist/server/lib/app-dir-module.d.ts","./node_modules/next/dist/server/response-cache/types.d.ts","./node_modules/next/dist/server/response-cache/index.d.ts","./node_modules/next/dist/server/lib/incremental-cache/index.d.ts","./node_modules/next/dist/client/components/hooks-server-context.d.ts","./node_modules/next/dist/client/components/static-generation-async-storage.external.d.ts","./node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.d.ts","./node_modules/next/dist/server/async-storage/draft-mode-provider.d.ts","./node_modules/next/dist/server/web/spec-extension/adapters/headers.d.ts","./node_modules/next/dist/client/components/request-async-storage.external.d.ts","./node_modules/next/dist/server/app-render/create-error-handler.d.ts","./node_modules/next/dist/server/app-render/app-render.d.ts","./node_modules/next/dist/shared/lib/server-inserted-html.shared-runtime.d.ts","./node_modules/next/dist/shared/lib/amp-context.shared-runtime.d.ts","./node_modules/next/dist/server/future/route-modules/app-page/vendored/contexts/entrypoints.d.ts","./node_modules/next/dist/server/future/route-modules/app-page/module.compiled.d.ts","./node_modules/@types/react/jsx-runtime.d.ts","./node_modules/next/dist/client/components/error-boundary.d.ts","./node_modules/next/dist/client/components/router-reducer/create-initial-router-state.d.ts","./node_modules/next/dist/client/components/app-router.d.ts","./node_modules/next/dist/client/components/layout-router.d.ts","./node_modules/next/dist/client/components/render-from-template-context.d.ts","./node_modules/next/dist/client/components/action-async-storage.external.d.ts","./node_modules/next/dist/build/webpack/plugins/app-build-manifest-plugin.d.ts","./node_modules/next/dist/build/utils.d.ts","./node_modules/next/dist/client/components/static-generation-bailout.d.ts","./node_modules/next/dist/client/components/static-generation-searchparams-bailout-provider.d.ts","./node_modules/next/dist/client/components/searchparams-bailout-proxy.d.ts","./node_modules/next/dist/client/components/not-found-boundary.d.ts","./node_modules/next/dist/server/app-render/rsc/preloads.d.ts","./node_modules/next/dist/server/app-render/rsc/taint.d.ts","./node_modules/next/dist/server/app-render/entry-base.d.ts","./node_modules/next/dist/build/templates/app-page.d.ts","./node_modules/next/dist/server/future/route-modules/app-page/module.d.ts","./node_modules/next/dist/server/app-render/types.d.ts","./node_modules/next/dist/client/components/router-reducer/fetch-server-response.d.ts","./node_modules/next/dist/client/components/router-reducer/router-reducer-types.d.ts","./node_modules/next/dist/shared/lib/app-router-context.shared-runtime.d.ts","./node_modules/next/dist/server/future/route-modules/pages/vendored/contexts/entrypoints.d.ts","./node_modules/next/dist/server/future/route-modules/pages/module.compiled.d.ts","./node_modules/next/dist/build/templates/pages.d.ts","./node_modules/next/dist/server/future/route-modules/pages/module.d.ts","./node_modules/next/dist/server/render.d.ts","./node_modules/next/dist/server/future/route-definitions/pages-api-route-definition.d.ts","./node_modules/next/dist/server/future/route-matches/pages-api-route-match.d.ts","./node_modules/next/dist/server/future/route-matchers/route-matcher.d.ts","./node_modules/next/dist/server/future/route-matcher-providers/route-matcher-provider.d.ts","./node_modules/next/dist/server/future/route-matcher-managers/route-matcher-manager.d.ts","./node_modules/next/dist/server/future/normalizers/normalizer.d.ts","./node_modules/next/dist/server/future/normalizers/locale-route-normalizer.d.ts","./node_modules/next/dist/server/future/normalizers/request/pathname-normalizer.d.ts","./node_modules/next/dist/server/future/normalizers/request/suffix.d.ts","./node_modules/next/dist/server/future/normalizers/request/rsc.d.ts","./node_modules/next/dist/server/future/normalizers/request/prefix.d.ts","./node_modules/next/dist/server/future/normalizers/request/postponed.d.ts","./node_modules/next/dist/server/future/normalizers/request/prefetch-rsc.d.ts","./node_modules/next/dist/server/future/normalizers/request/next-data.d.ts","./node_modules/next/dist/server/base-server.d.ts","./node_modules/next/dist/server/image-optimizer.d.ts","./node_modules/next/dist/server/next-server.d.ts","./node_modules/next/dist/lib/coalesced-function.d.ts","./node_modules/next/dist/trace/types.d.ts","./node_modules/next/dist/trace/trace.d.ts","./node_modules/next/dist/trace/shared.d.ts","./node_modules/next/dist/trace/index.d.ts","./node_modules/next/dist/build/load-jsconfig.d.ts","./node_modules/next/dist/build/webpack-config.d.ts","./node_modules/next/dist/build/webpack/plugins/define-env-plugin.d.ts","./node_modules/next/dist/build/swc/index.d.ts","./node_modules/next/dist/server/dev/parse-version-info.d.ts","./node_modules/next/dist/server/dev/hot-reloader-types.d.ts","./node_modules/next/dist/telemetry/storage.d.ts","./node_modules/next/dist/server/lib/types.d.ts","./node_modules/next/dist/server/lib/router-utils/types.d.ts","./node_modules/next/dist/server/lib/render-server.d.ts","./node_modules/next/dist/server/lib/router-server.d.ts","./node_modules/next/dist/shared/lib/router/utils/path-match.d.ts","./node_modules/next/dist/server/lib/router-utils/filesystem.d.ts","./node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.d.ts","./node_modules/next/dist/server/lib/dev-bundler-service.d.ts","./node_modules/next/dist/server/dev/static-paths-worker.d.ts","./node_modules/next/dist/server/dev/next-dev-server.d.ts","./node_modules/next/dist/server/next.d.ts","./node_modules/next/dist/lib/metadata/types/alternative-urls-types.d.ts","./node_modules/next/dist/lib/metadata/types/extra-types.d.ts","./node_modules/next/dist/lib/metadata/types/metadata-types.d.ts","./node_modules/next/dist/lib/metadata/types/manifest-types.d.ts","./node_modules/next/dist/lib/metadata/types/opengraph-types.d.ts","./node_modules/next/dist/lib/metadata/types/twitter-types.d.ts","./node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts","./node_modules/next/types/index.d.ts","./node_modules/next/dist/shared/lib/html-context.shared-runtime.d.ts","./node_modules/@next/env/dist/index.d.ts","./node_modules/next/dist/shared/lib/utils.d.ts","./node_modules/next/dist/pages/_app.d.ts","./node_modules/next/app.d.ts","./node_modules/next/dist/server/web/spec-extension/unstable-cache.d.ts","./node_modules/next/dist/server/web/spec-extension/revalidate-path.d.ts","./node_modules/next/dist/server/web/spec-extension/revalidate-tag.d.ts","./node_modules/next/dist/server/web/spec-extension/unstable-no-store.d.ts","./node_modules/next/cache.d.ts","./node_modules/next/dist/shared/lib/runtime-config.external.d.ts","./node_modules/next/config.d.ts","./node_modules/next/dist/pages/_document.d.ts","./node_modules/next/document.d.ts","./node_modules/next/dist/shared/lib/dynamic.d.ts","./node_modules/next/dynamic.d.ts","./node_modules/next/dist/pages/_error.d.ts","./node_modules/next/error.d.ts","./node_modules/next/dist/shared/lib/head.d.ts","./node_modules/next/head.d.ts","./node_modules/next/dist/client/components/draft-mode.d.ts","./node_modules/next/dist/client/components/headers.d.ts","./node_modules/next/headers.d.ts","./node_modules/next/dist/shared/lib/get-img-props.d.ts","./node_modules/next/dist/client/image-component.d.ts","./node_modules/next/dist/shared/lib/image-external.d.ts","./node_modules/next/image.d.ts","./node_modules/next/dist/client/link.d.ts","./node_modules/next/link.d.ts","./node_modules/next/dist/client/components/redirect-status-code.d.ts","./node_modules/next/dist/client/components/redirect.d.ts","./node_modules/next/dist/client/components/not-found.d.ts","./node_modules/next/dist/client/components/navigation.d.ts","./node_modules/next/navigation.d.ts","./node_modules/next/router.d.ts","./node_modules/next/dist/client/script.d.ts","./node_modules/next/script.d.ts","./node_modules/next/dist/server/web/spec-extension/user-agent.d.ts","./node_modules/next/dist/compiled/@edge-runtime/primitives/url.d.ts","./node_modules/next/dist/server/web/spec-extension/image-response.d.ts","./node_modules/next/dist/compiled/@vercel/og/satori/index.d.ts","./node_modules/next/dist/compiled/@vercel/og/emoji/index.d.ts","./node_modules/next/dist/compiled/@vercel/og/types.d.ts","./node_modules/next/server.d.ts","./node_modules/next/types/global.d.ts","./node_modules/next/types/compiled.d.ts","./node_modules/next/index.d.ts","./node_modules/next/image-types/global.d.ts","./next-env.d.ts","./node_modules/source-map-js/source-map.d.ts","./node_modules/postcss/lib/previous-map.d.ts","./node_modules/postcss/lib/input.d.ts","./node_modules/postcss/lib/css-syntax-error.d.ts","./node_modules/postcss/lib/declaration.d.ts","./node_modules/postcss/lib/root.d.ts","./node_modules/postcss/lib/warning.d.ts","./node_modules/postcss/lib/lazy-result.d.ts","./node_modules/postcss/lib/no-work-result.d.ts","./node_modules/postcss/lib/processor.d.ts","./node_modules/postcss/lib/result.d.ts","./node_modules/postcss/lib/document.d.ts","./node_modules/postcss/lib/rule.d.ts","./node_modules/postcss/lib/node.d.ts","./node_modules/postcss/lib/comment.d.ts","./node_modules/postcss/lib/container.d.ts","./node_modules/postcss/lib/at-rule.d.ts","./node_modules/postcss/lib/list.d.ts","./node_modules/postcss/lib/postcss.d.ts","./node_modules/postcss/lib/postcss.d.mts","./node_modules/tailwindcss/types/generated/corepluginlist.d.ts","./node_modules/tailwindcss/types/generated/colors.d.ts","./node_modules/tailwindcss/types/config.d.ts","./node_modules/tailwindcss/types/index.d.ts","./tailwind.config.ts","./src/lib/api.ts","./src/lib/alertmanager.ts","./src/lib/maneuverinstructions.ts","./src/lib/pushnotificationservice.ts","./src/lib/ttsservice.ts","./src/lib/rerouteengine.ts","./src/context/navigationcontext.tsx","./src/app/layout.tsx","./node_modules/@types/mapbox__point-geometry/index.d.ts","./node_modules/@mapbox/tiny-sdf/index.d.ts","./node_modules/@types/pbf/index.d.ts","./node_modules/@types/geojson/index.d.ts","./node_modules/@types/mapbox__vector-tile/index.d.ts","./node_modules/@maplibre/maplibre-gl-style-spec/dist/index.d.ts","./node_modules/@types/geojson-vt/index.d.ts","./node_modules/gl-matrix/index.d.ts","./node_modules/kdbush/index.d.ts","./node_modules/potpack/index.d.ts","./node_modules/@types/supercluster/index.d.ts","./node_modules/maplibre-gl/dist/maplibre-gl.d.ts","./src/components/map/mapcanvas.tsx","./node_modules/lucide-react/dist/lucide-react.d.ts","./src/components/ui/floatingsearchpanel.tsx","./src/components/ui/mapcontrols.tsx","./node_modules/motion-dom/dist/index.d.ts","./node_modules/motion-utils/dist/index.d.ts","./node_modules/framer-motion/dist/index.d.ts","./src/components/ui/routecard.tsx","./src/components/ui/turnbyturndrawer.tsx","./src/components/ui/advancealertbanner.tsx","./src/components/ui/reroutemodal.tsx","./src/components/ui/navigationcontrolshud.tsx","./src/components/ui/trafficlegend.tsx","./src/app/page.tsx","./.next/types/app/layout.ts","./.next/types/app/page.ts"],"fileIdsList":[[99,145,355,438],[99,145,355,464],[99,145,403,404],[99,145],[99,145,442],[99,145,439,441,442],[99,142,145],[99,144,145],[145],[99,145,150,178],[99,145,146,151,156,164,175,186],[99,145,146,147,156,164],[94,95,96,99,145],[99,145,148,187],[99,145,149,150,157,165],[99,145,150,175,183],[99,145,151,153,156,164],[99,144,145,152],[99,145,153,154],[99,145,155,156],[99,144,145,156],[99,145,156,157,158,175,186],[99,145,156,157,158,171,175,178],[99,145,153,156,159,164,175,186],[99,145,156,157,159,160,164,175,183,186],[99,145,159,161,175,183,186],[97,98,99,100,101,102,103,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192],[99,145,156,162],[99,145,163,186,191],[99,145,153,156,164,175],[99,145,165],[99,145,166],[99,144,145,167],[99,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192],[99,145,169],[99,145,170],[99,145,156,171,172],[99,145,171,173,187,189],[99,145,156,175,176,178],[99,145,177,178],[99,145,175,176],[99,145,178],[99,145,179],[99,142,145,175,180],[99,145,156,181,182],[99,145,181,182],[99,145,150,164,175,183],[99,145,184],[99,145,164,185],[99,145,159,170,186],[99,145,150,187],[99,145,175,188],[99,145,163,189],[99,145,190],[99,140,145],[99,140,145,156,158,167,175,178,186,189,191],[99,145,175,192],[87,99,145,197,198,199],[87,99,145,197,198],[87,99,145],[87,91,99,145,196,356,399],[87,91,99,145,195,356,399],[84,85,86,99,145],[87,99,145,282,455,456],[99,145,439,440,443,444,445,446,447,448,449],[92,99,145],[99,145,360],[99,145,362,363,364,365],[99,145,367],[99,145,202,211,217,219,356],[99,145,202,209,213,221,232],[99,145,211],[99,145,211,333],[99,145,266,281,297,402],[99,145,305],[99,145,194,202,211,215,220,232,264,266,269,289,299,356],[99,145,202,211,218,252,262,330,331,402],[99,145,218,402],[99,145,211,262,263,264,402],[99,145,211,218,252,402],[99,145,402],[99,145,218,219,402],[99,144,145,193],[87,99,145,282,283,284,302,303],[99,145,273],[87,99,145,196,282],[99,145,272,274,377],[87,99,145,282,283,300],[99,145,278,303,387,388],[87,99,145,282],[99,145,226,386],[99,144,145,193,226,272,273,274],[87,99,145,300,303],[99,145,300,302],[99,145,300,301,303],[99,144,145,193,212,221,269,270],[99,145,290],[87,99,145,203,380],[87,99,145,186,193],[87,99,145,218,250],[87,99,145,218],[99,145,248,253],[87,99,145,249,359],[87,91,99,145,159,193,195,196,356,397,398],[99,145,356],[99,145,201],[99,145,349,350,351,352,353,354],[99,145,351],[87,99,145,249,282,359],[87,99,145,282,357,359],[87,99,145,282,359],[99,145,159,193,212,359],[99,145,159,193,210,221,222,240,271,275,276,299,300],[99,145,270,271,275,283,285,286,287,288,291,292,293,294,295,296,402],[87,99,145,170,193,211,240,242,244,269,299,356,402],[99,145,159,193,212,213,226,227,272],[99,145,159,193,211,213],[99,145,159,175,193,210,212,213],[99,145,159,170,186,193,201,203,210,211,212,213,218,221,222,223,233,234,236,239,240,242,243,244,268,269,300,308,310,313,315,318,320,321,322,356],[99,145,159,175,193],[99,145,202,203,204,210,356,359,402],[99,145,159,175,186,193,207,332,334,335,402],[99,145,170,186,193,207,210,212,230,234,236,237,238,242,269,313,323,325,330,345,346],[99,145,211,215,269],[99,145,210,211],[99,145,223,314],[99,145,316],[99,145,314],[99,145,316,319],[99,145,316,317],[99,145,206,207],[99,145,206,245],[99,145,206],[99,145,208,223,312],[99,145,311],[99,145,207,208],[99,145,208,309],[99,145,207],[99,145,299],[99,145,159,193,210,222,241,260,266,277,280,298,300],[99,145,254,255,256,257,258,259,278,279,303,357],[99,145,307],[99,145,159,193,210,222,241,246,304,306,308,356,359],[99,145,159,186,193,203,210,211,268],[99,145,265],[99,145,159,193,338,344],[99,145,233,268,359],[99,145,330,339,345,348],[99,145,159,215,330,338,340],[99,145,202,211,233,243,342],[99,145,159,193,211,218,243,326,336,337,341,342,343],[99,145,194,240,241,356,359],[99,145,159,170,186,193,208,210,212,215,220,221,222,230,233,234,236,237,238,239,242,244,268,269,310,323,324,359],[99,145,159,193,210,211,215,325,347],[99,145,159,193,212,221],[87,99,145,159,170,193,201,203,210,213,222,239,240,242,244,307,356,359],[99,145,159,170,186,193,205,208,209,212],[99,145,206,267],[99,145,159,193,206,221,222],[99,145,159,193,211,223],[99,145,159,193],[99,145,226],[99,145,225],[99,145,227],[99,145,211,224,226,230],[99,145,211,224,226],[99,145,159,193,205,211,212,227,228,229],[87,99,145,300,301,302],[99,145,261],[87,99,145,203],[87,99,145,236],[87,99,145,194,239,244,356,359],[99,145,203,380,381],[87,99,145,253],[87,99,145,170,186,193,201,247,249,251,252,359],[99,145,212,218,236],[99,145,170,193],[99,145,235],[87,99,145,157,159,170,193,201,253,262,356,357,358],[83,87,88,89,90,99,145,195,196,356,399],[99,145,150],[99,145,327,328,329],[99,145,327],[99,145,369],[99,145,371],[99,145,373],[99,145,375],[99,145,378],[99,145,382],[91,93,99,145,356,361,366,368,370,372,374,376,379,383,385,390,391,393,400,401,402],[99,145,384],[99,145,389],[99,145,249],[99,145,392],[99,144,145,227,228,229,230,394,395,396,399],[99,145,193],[87,91,99,145,159,161,170,193,195,196,197,199,201,213,348,355,359,399],[99,145,421],[99,145,419,421],[99,145,410,418,419,420,422,424],[99,145,408],[99,145,411,416,421,424],[99,145,407,424],[99,145,411,412,415,416,417,424],[99,145,411,412,413,415,416,424],[99,145,408,409,410,411,412,416,417,418,420,421,422,424],[99,145,424],[99,145,406,408,409,410,411,412,413,415,416,417,418,419,420,421,422,423],[99,145,406,424],[99,145,411,413,414,416,417,424],[99,145,415,424],[99,145,416,417,421,424],[99,145,409,419],[99,145,426,427],[99,145,425,428],[99,112,116,145,186],[99,112,145,175,186],[99,107,145],[99,109,112,145,183,186],[99,145,164,183],[99,107,145,193],[99,109,112,145,164,186],[99,104,105,108,111,145,156,175,186],[99,112,119,145],[99,104,110,145],[99,112,133,134,145],[99,108,112,145,178,186,193],[99,133,145,193],[99,106,107,145,193],[99,112,145],[99,106,107,108,109,110,111,112,113,114,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,134,135,136,137,138,139,145],[99,112,127,145],[99,112,119,120,145],[99,110,112,120,121,145],[99,111,145],[99,104,107,112,145],[99,112,116,120,121,145],[99,116,145],[99,110,112,115,145,186],[99,104,109,112,119,145],[99,145,175],[99,107,112,133,145,191,193],[99,145,403,437],[87,99,145,437,451,452,453,454,458,459,460,461,462,463],[87,99,145,431,437,450],[87,99,145,432,435,452,457],[87,99,145,431,437,452],[87,99,145,437,451,452],[87,99,145,431,433,434,435,437,452,457],[87,99,145,431,452,457],[87,99,145,437,452,457],[87,99,145,452],[87,99,145,433,437,452,457],[87,99,145,431,432,433,434,435,436],[99,145,431],[99,145,431,434,435],[99,145,429]],"fileInfos":[{"version":"c430d44666289dae81f30fa7b2edebf186ecc91a2d4c71266ea6ae76388792e1","affectsGlobalScope":true,"impliedFormat":1},{"version":"45b7ab580deca34ae9729e97c13cfd999df04416a79116c3bfb483804f85ded4","impliedFormat":1},{"version":"3facaf05f0c5fc569c5649dd359892c98a85557e3e0c847964caeb67076f4d75","impliedFormat":1},{"version":"e44bb8bbac7f10ecc786703fe0a6a4b952189f908707980ba8f3c8975a760962","impliedFormat":1},{"version":"5e1c4c362065a6b95ff952c0eab010f04dcd2c3494e813b493ecfd4fcb9fc0d8","impliedFormat":1},{"version":"68d73b4a11549f9c0b7d352d10e91e5dca8faa3322bfb77b661839c42b1ddec7","impliedFormat":1},{"version":"5efce4fc3c29ea84e8928f97adec086e3dc876365e0982cc8479a07954a3efd4","impliedFormat":1},{"version":"feecb1be483ed332fad555aff858affd90a48ab19ba7272ee084704eb7167569","impliedFormat":1},{"version":"ee7bad0c15b58988daa84371e0b89d313b762ab83cb5b31b8a2d1162e8eb41c2","impliedFormat":1},{"version":"27bdc30a0e32783366a5abeda841bc22757c1797de8681bbe81fbc735eeb1c10","impliedFormat":1},{"version":"8fd575e12870e9944c7e1d62e1f5a73fcf23dd8d3a321f2a2c74c20d022283fe","impliedFormat":1},{"version":"2ab096661c711e4a81cc464fa1e6feb929a54f5340b46b0a07ac6bbf857471f0","impliedFormat":1},{"version":"080941d9f9ff9307f7e27a83bcd888b7c8270716c39af943532438932ec1d0b9","affectsGlobalScope":true,"impliedFormat":1},{"version":"2e80ee7a49e8ac312cc11b77f1475804bee36b3b2bc896bead8b6e1266befb43","affectsGlobalScope":true,"impliedFormat":1},{"version":"c57796738e7f83dbc4b8e65132f11a377649c00dd3eee333f672b8f0a6bea671","affectsGlobalScope":true,"impliedFormat":1},{"version":"dc2df20b1bcdc8c2d34af4926e2c3ab15ffe1160a63e58b7e09833f616efff44","affectsGlobalScope":true,"impliedFormat":1},{"version":"515d0b7b9bea2e31ea4ec968e9edd2c39d3eebf4a2d5cbd04e88639819ae3b71","affectsGlobalScope":true,"impliedFormat":1},{"version":"0559b1f683ac7505ae451f9a96ce4c3c92bdc71411651ca6ddb0e88baaaad6a3","affectsGlobalScope":true,"impliedFormat":1},{"version":"0dc1e7ceda9b8b9b455c3a2d67b0412feab00bd2f66656cd8850e8831b08b537","affectsGlobalScope":true,"impliedFormat":1},{"version":"ce691fb9e5c64efb9547083e4a34091bcbe5bdb41027e310ebba8f7d96a98671","affectsGlobalScope":true,"impliedFormat":1},{"version":"8d697a2a929a5fcb38b7a65594020fcef05ec1630804a33748829c5ff53640d0","affectsGlobalScope":true,"impliedFormat":1},{"version":"4ff2a353abf8a80ee399af572debb8faab2d33ad38c4b4474cff7f26e7653b8d","affectsGlobalScope":true,"impliedFormat":1},{"version":"fb0f136d372979348d59b3f5020b4cdb81b5504192b1cacff5d1fbba29378aa1","affectsGlobalScope":true,"impliedFormat":1},{"version":"d15bea3d62cbbdb9797079416b8ac375ae99162a7fba5de2c6c505446486ac0a","affectsGlobalScope":true,"impliedFormat":1},{"version":"68d18b664c9d32a7336a70235958b8997ebc1c3b8505f4f1ae2b7e7753b87618","affectsGlobalScope":true,"impliedFormat":1},{"version":"eb3d66c8327153d8fa7dd03f9c58d351107fe824c79e9b56b462935176cdf12a","affectsGlobalScope":true,"impliedFormat":1},{"version":"38f0219c9e23c915ef9790ab1d680440d95419ad264816fa15009a8851e79119","affectsGlobalScope":true,"impliedFormat":1},{"version":"69ab18c3b76cd9b1be3d188eaf8bba06112ebbe2f47f6c322b5105a6fbc45a2e","affectsGlobalScope":true,"impliedFormat":1},{"version":"a680117f487a4d2f30ea46f1b4b7f58bef1480456e18ba53ee85c2746eeca012","affectsGlobalScope":true,"impliedFormat":1},{"version":"2f11ff796926e0832f9ae148008138ad583bd181899ab7dd768a2666700b1893","affectsGlobalScope":true,"impliedFormat":1},{"version":"4de680d5bb41c17f7f68e0419412ca23c98d5749dcaaea1896172f06435891fc","affectsGlobalScope":true,"impliedFormat":1},{"version":"954296b30da6d508a104a3a0b5d96b76495c709785c1d11610908e63481ee667","affectsGlobalScope":true,"impliedFormat":1},{"version":"ac9538681b19688c8eae65811b329d3744af679e0bdfa5d842d0e32524c73e1c","affectsGlobalScope":true,"impliedFormat":1},{"version":"0a969edff4bd52585473d24995c5ef223f6652d6ef46193309b3921d65dd4376","affectsGlobalScope":true,"impliedFormat":1},{"version":"9e9fbd7030c440b33d021da145d3232984c8bb7916f277e8ffd3dc2e3eae2bdb","affectsGlobalScope":true,"impliedFormat":1},{"version":"811ec78f7fefcabbda4bfa93b3eb67d9ae166ef95f9bff989d964061cbf81a0c","affectsGlobalScope":true,"impliedFormat":1},{"version":"717937616a17072082152a2ef351cb51f98802fb4b2fdabd32399843875974ca","affectsGlobalScope":true,"impliedFormat":1},{"version":"d7e7d9b7b50e5f22c915b525acc5a49a7a6584cf8f62d0569e557c5cfc4b2ac2","affectsGlobalScope":true,"impliedFormat":1},{"version":"71c37f4c9543f31dfced6c7840e068c5a5aacb7b89111a4364b1d5276b852557","affectsGlobalScope":true,"impliedFormat":1},{"version":"576711e016cf4f1804676043e6a0a5414252560eb57de9faceee34d79798c850","affectsGlobalScope":true,"impliedFormat":1},{"version":"89c1b1281ba7b8a96efc676b11b264de7a8374c5ea1e6617f11880a13fc56dc6","affectsGlobalScope":true,"impliedFormat":1},{"version":"74f7fa2d027d5b33eb0471c8e82a6c87216223181ec31247c357a3e8e2fddc5b","affectsGlobalScope":true,"impliedFormat":1},{"version":"d6d7ae4d1f1f3772e2a3cde568ed08991a8ae34a080ff1151af28b7f798e22ca","affectsGlobalScope":true,"impliedFormat":1},{"version":"063600664504610fe3e99b717a1223f8b1900087fab0b4cad1496a114744f8df","affectsGlobalScope":true,"impliedFormat":1},{"version":"934019d7e3c81950f9a8426d093458b65d5aff2c7c1511233c0fd5b941e608ab","affectsGlobalScope":true,"impliedFormat":1},{"version":"52ada8e0b6e0482b728070b7639ee42e83a9b1c22d205992756fe020fd9f4a47","affectsGlobalScope":true,"impliedFormat":1},{"version":"3bdefe1bfd4d6dee0e26f928f93ccc128f1b64d5d501ff4a8cf3c6371200e5e6","affectsGlobalScope":true,"impliedFormat":1},{"version":"59fb2c069260b4ba00b5643b907ef5d5341b167e7d1dbf58dfd895658bda2867","affectsGlobalScope":true,"impliedFormat":1},{"version":"639e512c0dfc3fad96a84caad71b8834d66329a1f28dc95e3946c9b58176c73a","affectsGlobalScope":true,"impliedFormat":1},{"version":"368af93f74c9c932edd84c58883e736c9e3d53cec1fe24c0b0ff451f529ceab1","affectsGlobalScope":true,"impliedFormat":1},{"version":"af3dd424cf267428f30ccfc376f47a2c0114546b55c44d8c0f1d57d841e28d74","affectsGlobalScope":true,"impliedFormat":1},{"version":"995c005ab91a498455ea8dfb63aa9f83fa2ea793c3d8aa344be4a1678d06d399","affectsGlobalScope":true,"impliedFormat":1},{"version":"959d36cddf5e7d572a65045b876f2956c973a586da58e5d26cde519184fd9b8a","affectsGlobalScope":true,"impliedFormat":1},{"version":"965f36eae237dd74e6cca203a43e9ca801ce38824ead814728a2807b1910117d","affectsGlobalScope":true,"impliedFormat":1},{"version":"3925a6c820dcb1a06506c90b1577db1fdbf7705d65b62b99dce4be75c637e26b","affectsGlobalScope":true,"impliedFormat":1},{"version":"0a3d63ef2b853447ec4f749d3f368ce642264246e02911fcb1590d8c161b8005","affectsGlobalScope":true,"impliedFormat":1},{"version":"8cdf8847677ac7d20486e54dd3fcf09eda95812ac8ace44b4418da1bbbab6eb8","affectsGlobalScope":true,"impliedFormat":1},{"version":"8444af78980e3b20b49324f4a16ba35024fef3ee069a0eb67616ea6ca821c47a","affectsGlobalScope":true,"impliedFormat":1},{"version":"3287d9d085fbd618c3971944b65b4be57859f5415f495b33a6adc994edd2f004","affectsGlobalScope":true,"impliedFormat":1},{"version":"b4b67b1a91182421f5df999988c690f14d813b9850b40acd06ed44691f6727ad","affectsGlobalScope":true,"impliedFormat":1},{"version":"df83c2a6c73228b625b0beb6669c7ee2a09c914637e2d35170723ad49c0f5cd4","affectsGlobalScope":true,"impliedFormat":1},{"version":"436aaf437562f276ec2ddbee2f2cdedac7664c1e4c1d2c36839ddd582eeb3d0a","affectsGlobalScope":true,"impliedFormat":1},{"version":"8e3c06ea092138bf9fa5e874a1fdbc9d54805d074bee1de31b99a11e2fec239d","affectsGlobalScope":true,"impliedFormat":1},{"version":"87dc0f382502f5bbce5129bdc0aea21e19a3abbc19259e0b43ae038a9fc4e326","affectsGlobalScope":true,"impliedFormat":1},{"version":"b1cb28af0c891c8c96b2d6b7be76bd394fddcfdb4709a20ba05a7c1605eea0f9","affectsGlobalScope":true,"impliedFormat":1},{"version":"2fef54945a13095fdb9b84f705f2b5994597640c46afeb2ce78352fab4cb3279","affectsGlobalScope":true,"impliedFormat":1},{"version":"ac77cb3e8c6d3565793eb90a8373ee8033146315a3dbead3bde8db5eaf5e5ec6","affectsGlobalScope":true,"impliedFormat":1},{"version":"56e4ed5aab5f5920980066a9409bfaf53e6d21d3f8d020c17e4de584d29600ad","affectsGlobalScope":true,"impliedFormat":1},{"version":"4ece9f17b3866cc077099c73f4983bddbcb1dc7ddb943227f1ec070f529dedd1","affectsGlobalScope":true,"impliedFormat":1},{"version":"0a6282c8827e4b9a95f4bf4f5c205673ada31b982f50572d27103df8ceb8013c","affectsGlobalScope":true,"impliedFormat":1},{"version":"1c9319a09485199c1f7b0498f2988d6d2249793ef67edda49d1e584746be9032","affectsGlobalScope":true,"impliedFormat":1},{"version":"e3a2a0cee0f03ffdde24d89660eba2685bfbdeae955a6c67e8c4c9fd28928eeb","affectsGlobalScope":true,"impliedFormat":1},{"version":"811c71eee4aa0ac5f7adf713323a5c41b0cf6c4e17367a34fbce379e12bbf0a4","affectsGlobalScope":true,"impliedFormat":1},{"version":"51ad4c928303041605b4d7ae32e0c1ee387d43a24cd6f1ebf4a2699e1076d4fa","affectsGlobalScope":true,"impliedFormat":1},{"version":"60037901da1a425516449b9a20073aa03386cce92f7a1fd902d7602be3a7c2e9","affectsGlobalScope":true,"impliedFormat":1},{"version":"d4b1d2c51d058fc21ec2629fff7a76249dec2e36e12960ea056e3ef89174080f","affectsGlobalScope":true,"impliedFormat":1},{"version":"22adec94ef7047a6c9d1af3cb96be87a335908bf9ef386ae9fd50eeb37f44c47","affectsGlobalScope":true,"impliedFormat":1},{"version":"196cb558a13d4533a5163286f30b0509ce0210e4b316c56c38d4c0fd2fb38405","affectsGlobalScope":true,"impliedFormat":1},{"version":"73f78680d4c08509933daf80947902f6ff41b6230f94dd002ae372620adb0f60","affectsGlobalScope":true,"impliedFormat":1},{"version":"c5239f5c01bcfa9cd32f37c496cf19c61d69d37e48be9de612b541aac915805b","affectsGlobalScope":true,"impliedFormat":1},{"version":"8e7f8264d0fb4c5339605a15daadb037bf238c10b654bb3eee14208f860a32ea","affectsGlobalScope":true,"impliedFormat":1},{"version":"782dec38049b92d4e85c1585fbea5474a219c6984a35b004963b00beb1aab538","affectsGlobalScope":true,"impliedFormat":1},{"version":"0990a7576222f248f0a3b888adcb7389f957928ce2afb1cd5128169086ff4d29","impliedFormat":1},{"version":"eb5b19b86227ace1d29ea4cf81387279d04bb34051e944bc53df69f58914b788","affectsGlobalScope":true,"impliedFormat":1},{"version":"ac51dd7d31333793807a6abaa5ae168512b6131bd41d9c5b98477fc3b7800f9f","impliedFormat":1},{"version":"87d9d29dbc745f182683f63187bf3d53fd8673e5fca38ad5eaab69798ed29fbc","impliedFormat":1},{"version":"09ddcfcfbe77a8232d155ca1030005106b1328f6210df43629d0be750da07c16","affectsGlobalScope":true,"impliedFormat":1},{"version":"cc69795d9954ee4ad57545b10c7bf1a7260d990231b1685c147ea71a6faa265c","impliedFormat":1},{"version":"8bc6c94ff4f2af1f4023b7bb2379b08d3d7dd80c698c9f0b07431ea16101f05f","impliedFormat":1},{"version":"1b61d259de5350f8b1e5db06290d31eaebebc6baafd5f79d314b5af9256d7153","impliedFormat":1},{"version":"57194e1f007f3f2cbef26fa299d4c6b21f4623a2eddc63dfeef79e38e187a36e","impliedFormat":1},{"version":"0f6666b58e9276ac3a38fdc80993d19208442d6027ab885580d93aec76b4ef00","impliedFormat":1},{"version":"05fd364b8ef02fb1e174fbac8b825bdb1e5a36a016997c8e421f5fab0a6da0a0","impliedFormat":1},{"version":"70521b6ab0dcba37539e5303104f29b721bfb2940b2776da4cc818c07e1fefc1","affectsGlobalScope":true,"impliedFormat":1},{"version":"ab41ef1f2cdafb8df48be20cd969d875602483859dc194e9c97c8a576892c052","affectsGlobalScope":true,"impliedFormat":1},{"version":"d153a11543fd884b596587ccd97aebbeed950b26933ee000f94009f1ab142848","affectsGlobalScope":true,"impliedFormat":1},{"version":"21d819c173c0cf7cc3ce57c3276e77fd9a8a01d35a06ad87158781515c9a438a","impliedFormat":1},{"version":"98cffbf06d6bab333473c70a893770dbe990783904002c4f1a960447b4b53dca","affectsGlobalScope":true,"impliedFormat":1},{"version":"ba481bca06f37d3f2c137ce343c7d5937029b2468f8e26111f3c9d9963d6568d","affectsGlobalScope":true,"impliedFormat":1},{"version":"6d9ef24f9a22a88e3e9b3b3d8c40ab1ddb0853f1bfbd5c843c37800138437b61","affectsGlobalScope":true,"impliedFormat":1},{"version":"1db0b7dca579049ca4193d034d835f6bfe73096c73663e5ef9a0b5779939f3d0","affectsGlobalScope":true,"impliedFormat":1},{"version":"9798340ffb0d067d69b1ae5b32faa17ab31b82466a3fc00d8f2f2df0c8554aaa","affectsGlobalScope":true,"impliedFormat":1},{"version":"f26b11d8d8e4b8028f1c7d618b22274c892e4b0ef5b3678a8ccbad85419aef43","affectsGlobalScope":true,"impliedFormat":1},{"version":"5929864ce17fba74232584d90cb721a89b7ad277220627cc97054ba15a98ea8f","impliedFormat":1},{"version":"763fe0f42b3d79b440a9b6e51e9ba3f3f91352469c1e4b3b67bfa4ff6352f3f4","impliedFormat":1},{"version":"25c8056edf4314820382a5fdb4bb7816999acdcb929c8f75e3f39473b87e85bc","impliedFormat":1},{"version":"c464d66b20788266e5353b48dc4aa6bc0dc4a707276df1e7152ab0c9ae21fad8","impliedFormat":1},{"version":"78d0d27c130d35c60b5e5566c9f1e5be77caf39804636bc1a40133919a949f21","impliedFormat":1},{"version":"c6fd2c5a395f2432786c9cb8deb870b9b0e8ff7e22c029954fabdd692bff6195","impliedFormat":1},{"version":"1d6e127068ea8e104a912e42fc0a110e2aa5a66a356a917a163e8cf9a65e4a75","impliedFormat":1},{"version":"5ded6427296cdf3b9542de4471d2aa8d3983671d4cac0f4bf9c637208d1ced43","impliedFormat":1},{"version":"7f182617db458e98fc18dfb272d40aa2fff3a353c44a89b2c0ccb3937709bfb5","impliedFormat":1},{"version":"cadc8aced301244057c4e7e73fbcae534b0f5b12a37b150d80e5a45aa4bebcbd","impliedFormat":1},{"version":"385aab901643aa54e1c36f5ef3107913b10d1b5bb8cbcd933d4263b80a0d7f20","impliedFormat":1},{"version":"9670d44354bab9d9982eca21945686b5c24a3f893db73c0dae0fd74217a4c219","impliedFormat":1},{"version":"0b8a9268adaf4da35e7fa830c8981cfa22adbbe5b3f6f5ab91f6658899e657a7","impliedFormat":1},{"version":"11396ed8a44c02ab9798b7dca436009f866e8dae3c9c25e8c1fbc396880bf1bb","impliedFormat":1},{"version":"ba7bc87d01492633cb5a0e5da8a4a42a1c86270e7b3d2dea5d156828a84e4882","impliedFormat":1},{"version":"4893a895ea92c85345017a04ed427cbd6a1710453338df26881a6019432febdd","impliedFormat":1},{"version":"c21dc52e277bcfc75fac0436ccb75c204f9e1b3fa5e12729670910639f27343e","impliedFormat":1},{"version":"13f6f39e12b1518c6650bbb220c8985999020fe0f21d818e28f512b7771d00f9","impliedFormat":1},{"version":"9b5369969f6e7175740bf51223112ff209f94ba43ecd3bb09eefff9fd675624a","impliedFormat":1},{"version":"4fe9e626e7164748e8769bbf74b538e09607f07ed17c2f20af8d680ee49fc1da","impliedFormat":1},{"version":"24515859bc0b836719105bb6cc3d68255042a9f02a6022b3187948b204946bd2","impliedFormat":1},{"version":"ea0148f897b45a76544ae179784c95af1bd6721b8610af9ffa467a518a086a43","impliedFormat":1},{"version":"24c6a117721e606c9984335f71711877293a9651e44f59f3d21c1ea0856f9cc9","impliedFormat":1},{"version":"dd3273ead9fbde62a72949c97dbec2247ea08e0c6952e701a483d74ef92d6a17","impliedFormat":1},{"version":"405822be75ad3e4d162e07439bac80c6bcc6dbae1929e179cf467ec0b9ee4e2e","impliedFormat":1},{"version":"0db18c6e78ea846316c012478888f33c11ffadab9efd1cc8bcc12daded7a60b6","impliedFormat":1},{"version":"e61be3f894b41b7baa1fbd6a66893f2579bfad01d208b4ff61daef21493ef0a8","impliedFormat":1},{"version":"bd0532fd6556073727d28da0edfd1736417a3f9f394877b6d5ef6ad88fba1d1a","impliedFormat":1},{"version":"89167d696a849fce5ca508032aabfe901c0868f833a8625d5a9c6e861ef935d2","impliedFormat":1},{"version":"615ba88d0128ed16bf83ef8ccbb6aff05c3ee2db1cc0f89ab50a4939bfc1943f","impliedFormat":1},{"version":"a4d551dbf8746780194d550c88f26cf937caf8d56f102969a110cfaed4b06656","impliedFormat":1},{"version":"8bd86b8e8f6a6aa6c49b71e14c4ffe1211a0e97c80f08d2c8cc98838006e4b88","impliedFormat":1},{"version":"317e63deeb21ac07f3992f5b50cdca8338f10acd4fbb7257ebf56735bf52ab00","impliedFormat":1},{"version":"4732aec92b20fb28c5fe9ad99521fb59974289ed1e45aecb282616202184064f","impliedFormat":1},{"version":"2e85db9e6fd73cfa3d7f28e0ab6b55417ea18931423bd47b409a96e4a169e8e6","impliedFormat":1},{"version":"c46e079fe54c76f95c67fb89081b3e399da2c7d109e7dca8e4b58d83e332e605","impliedFormat":1},{"version":"bf67d53d168abc1298888693338cb82854bdb2e69ef83f8a0092093c2d562107","impliedFormat":1},{"version":"b52476feb4a0cbcb25e5931b930fc73cb6643fb1a5060bf8a3dda0eeae5b4b68","affectsGlobalScope":true,"impliedFormat":1},{"version":"e2677634fe27e87348825bb041651e22d50a613e2fdf6a4a3ade971d71bac37e","impliedFormat":1},{"version":"7394959e5a741b185456e1ef5d64599c36c60a323207450991e7a42e08911419","impliedFormat":1},{"version":"8c0bcd6c6b67b4b503c11e91a1fb91522ed585900eab2ab1f61bba7d7caa9d6f","impliedFormat":1},{"version":"8cd19276b6590b3ebbeeb030ac271871b9ed0afc3074ac88a94ed2449174b776","affectsGlobalScope":true,"impliedFormat":1},{"version":"696eb8d28f5949b87d894b26dc97318ef944c794a9a4e4f62360cd1d1958014b","impliedFormat":1},{"version":"3f8fa3061bd7402970b399300880d55257953ee6d3cd408722cb9ac20126460c","impliedFormat":1},{"version":"35ec8b6760fd7138bbf5809b84551e31028fb2ba7b6dc91d95d098bf212ca8b4","affectsGlobalScope":true,"impliedFormat":1},{"version":"5524481e56c48ff486f42926778c0a3cce1cc85dc46683b92b1271865bcf015a","impliedFormat":1},{"version":"68bd56c92c2bd7d2339457eb84d63e7de3bd56a69b25f3576e1568d21a162398","affectsGlobalScope":true,"impliedFormat":1},{"version":"3e93b123f7c2944969d291b35fed2af79a6e9e27fdd5faa99748a51c07c02d28","impliedFormat":1},{"version":"9d19808c8c291a9010a6c788e8532a2da70f811adb431c97520803e0ec649991","impliedFormat":1},{"version":"87aad3dd9752067dc875cfaa466fc44246451c0c560b820796bdd528e29bef40","impliedFormat":1},{"version":"4aacb0dd020eeaef65426153686cc639a78ec2885dc72ad220be1d25f1a439df","impliedFormat":1},{"version":"f0bd7e6d931657b59605c44112eaf8b980ba7f957a5051ed21cb93d978cf2f45","impliedFormat":1},{"version":"8db0ae9cb14d9955b14c214f34dae1b9ef2baee2fe4ce794a4cd3ac2531e3255","affectsGlobalScope":true,"impliedFormat":1},{"version":"15fc6f7512c86810273af28f224251a5a879e4261b4d4c7e532abfbfc3983134","impliedFormat":1},{"version":"58adba1a8ab2d10b54dc1dced4e41f4e7c9772cbbac40939c0dc8ce2cdb1d442","impliedFormat":1},{"version":"641942a78f9063caa5d6b777c99304b7d1dc7328076038c6d94d8a0b81fc95c1","impliedFormat":1},{"version":"1123a83f35cf56c97de746f0a7250012153c61a167e4a61668bf50e558162d14","impliedFormat":1},{"version":"855cd5f7eb396f5f1ab1bc0f8580339bff77b68a770f84c6b254e319bbfd1ac7","impliedFormat":1},{"version":"5650cf3dace09e7c25d384e3e6b818b938f68f4e8de96f52d9c5a1b3db068e86","impliedFormat":1},{"version":"1354ca5c38bd3fd3836a68e0f7c9f91f172582ba30ab15bb8c075891b91502b7","affectsGlobalScope":true,"impliedFormat":1},{"version":"7e20d899c28ca26a2a7afc98beaa69e63ff7fba0a8bc47b4e3bf3ede5e09e424","impliedFormat":1},{"version":"2d2fcaab481b31a5882065c7951255703ddbe1c0e507af56ea42d79ac3911201","impliedFormat":1},{"version":"a192fe8ec33f75edbc8d8f3ed79f768dfae11ff5735e7fe52bfa69956e46d78d","impliedFormat":1},{"version":"ca867399f7db82df981d6915bcbb2d81131d7d1ef683bc782b59f71dda59bc85","affectsGlobalScope":true,"impliedFormat":1},{"version":"372413016d17d804e1d139418aca0c68e47a83fb6669490857f4b318de8cccb3","affectsGlobalScope":true,"impliedFormat":1},{"version":"9e043a1bc8fbf2a255bccf9bf27e0f1caf916c3b0518ea34aa72357c0afd42ec","impliedFormat":1},{"version":"b4f70ec656a11d570e1a9edce07d118cd58d9760239e2ece99306ee9dfe61d02","impliedFormat":1},{"version":"3bc2f1e2c95c04048212c569ed38e338873f6a8593930cf5a7ef24ffb38fc3b6","impliedFormat":1},{"version":"6e70e9570e98aae2b825b533aa6292b6abd542e8d9f6e9475e88e1d7ba17c866","impliedFormat":1},{"version":"f9d9d753d430ed050dc1bf2667a1bab711ccbb1c1507183d794cc195a5b085cc","impliedFormat":1},{"version":"9eece5e586312581ccd106d4853e861aaaa1a39f8e3ea672b8c3847eedd12f6e","impliedFormat":1},{"version":"085f552d005479e2e6a7311cdbbe5d8c55c497b4d19274285df161ee9684cd9c","impliedFormat":1},{"version":"37ba7b45141a45ce6e80e66f2a96c8a5ab1bcef0fc2d0f56bb58df96ec67e972","impliedFormat":1},{"version":"45650f47bfb376c8a8ed39d4bcda5902ab899a3150029684ee4c10676d9fbaee","impliedFormat":1},{"version":"007faacc9268357caa21d24169f3f3f2497af3e9241308df2d89f6e6d9bb3f2e","affectsGlobalScope":true,"impliedFormat":1},{"version":"74cf591a0f63db318651e0e04cb55f8791385f86e987a67fd4d2eaab8191f730","impliedFormat":1},{"version":"5eab9b3dc9b34f185417342436ec3f106898da5f4801992d8ff38ab3aff346b5","impliedFormat":1},{"version":"12ed4559eba17cd977aa0db658d25c4047067444b51acfdcbf38470630642b23","affectsGlobalScope":true,"impliedFormat":1},{"version":"f3ffabc95802521e1e4bcba4c88d8615176dc6e09111d920c7a213bdda6e1d65","impliedFormat":1},{"version":"809821b8a065e3234a55b3a9d7846231ed18d66dd749f2494c66288d890daf7f","impliedFormat":1},{"version":"ae56f65caf3be91108707bd8dfbccc2a57a91feb5daabf7165a06a945545ed26","impliedFormat":1},{"version":"a136d5de521da20f31631a0a96bf712370779d1c05b7015d7019a9b2a0446ca9","impliedFormat":1},{"version":"c3b41e74b9a84b88b1dca61ec39eee25c0dbc8e7d519ba11bb070918cfacf656","affectsGlobalScope":true,"impliedFormat":1},{"version":"4737a9dc24d0e68b734e6cfbcea0c15a2cfafeb493485e27905f7856988c6b29","affectsGlobalScope":true,"impliedFormat":1},{"version":"36d8d3e7506b631c9582c251a2c0b8a28855af3f76719b12b534c6edf952748d","impliedFormat":1},{"version":"1ca69210cc42729e7ca97d3a9ad48f2e9cb0042bada4075b588ae5387debd318","impliedFormat":1},{"version":"f5ebe66baaf7c552cfa59d75f2bfba679f329204847db3cec385acda245e574e","impliedFormat":1},{"version":"ed59add13139f84da271cafd32e2171876b0a0af2f798d0c663e8eeb867732cf","affectsGlobalScope":true,"impliedFormat":1},{"version":"b7c5e2ea4a9749097c347454805e933844ed207b6eefec6b7cfd418b5f5f7b28","impliedFormat":1},{"version":"b1810689b76fd473bd12cc9ee219f8e62f54a7d08019a235d07424afbf074d25","impliedFormat":1},{"version":"8caa5c86be1b793cd5f599e27ecb34252c41e011980f7d61ae4989a149ff6ccc","impliedFormat":1},{"version":"f9fd93190acb1ffe0bc0fb395df979452f8d625071e9ffc8636e4dfb86ab2508","impliedFormat":1},{"version":"5f41fd8732a89e940c58ce22206e3df85745feb8983e2b4c6257fb8cbb118493","impliedFormat":1},{"version":"17ed71200119e86ccef2d96b73b02ce8854b76ad6bd21b5021d4269bec527b5f","impliedFormat":1},{"version":"1cfa8647d7d71cb03847d616bd79320abfc01ddea082a49569fda71ac5ece66b","impliedFormat":1},{"version":"bb7a61dd55dc4b9422d13da3a6bb9cc5e89be888ef23bbcf6558aa9726b89a1c","impliedFormat":1},{"version":"db6d2d9daad8a6d83f281af12ce4355a20b9a3e71b82b9f57cddcca0a8964a96","impliedFormat":1},{"version":"cfe4ef4710c3786b6e23dae7c086c70b4f4835a2e4d77b75d39f9046106e83d3","impliedFormat":1},{"version":"cbea99888785d49bb630dcbb1613c73727f2b5a2cf02e1abcaab7bcf8d6bf3c5","impliedFormat":1},{"version":"98817124fd6c4f60e0b935978c207309459fb71ab112cf514f26f333bf30830e","impliedFormat":1},{"version":"a86f82d646a739041d6702101afa82dcb935c416dd93cbca7fd754fd0282ce1f","impliedFormat":1},{"version":"2dad084c67e649f0f354739ec7df7c7df0779a28a4f55c97c6b6883ae850d1ce","impliedFormat":1},{"version":"fa5bbc7ab4130dd8cdc55ea294ec39f76f2bc507a0f75f4f873e38631a836ca7","impliedFormat":1},{"version":"df45ca1176e6ac211eae7ddf51336dc075c5314bc5c253651bae639defd5eec5","impliedFormat":1},{"version":"cf86de1054b843e484a3c9300d62fbc8c97e77f168bbffb131d560ca0474d4a8","impliedFormat":1},{"version":"a28e69b82de8008d23b88974aeb6fba7195d126c947d0da43c16e6bc2f719f9f","impliedFormat":1},{"version":"528637e771ee2e808390d46a591eaef375fa4b9c99b03749e22b1d2e868b1b7c","impliedFormat":1},{"version":"6faf62b01899a492bf7f9a69318b4e6b83057a6cd32d2b943550a5624309577f","impliedFormat":1},{"version":"fc46f093d1b754a8e3e34a071a1dd402f42003927676757a9a10c6f1d195a35b","impliedFormat":1},{"version":"b7b3258e8d47333721f9d4c287361d773f8fa88e52d1148812485d9fc06d2577","impliedFormat":1},{"version":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","impliedFormat":1},{"version":"a9af0e608929aaf9ce96bd7a7b99c9360636c31d73670e4af09a09950df97841","impliedFormat":1},{"version":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","impliedFormat":1},{"version":"c86fe861cf1b4c46a0fb7d74dffe596cf679a2e5e8b1456881313170f092e3fa","impliedFormat":1},{"version":"e8db7e1cf8a10b4bbb58002ce9e7e73493abac738a09855c499fb56f773a729c","impliedFormat":1},{"version":"47e5af2a841356a961f815e7c55d72554db0c11b4cba4d0caab91f8717846a94","impliedFormat":1},{"version":"4c91cc1ab59b55d880877ccf1999ded0bb2ebc8e3a597c622962d65bf0e76be8","impliedFormat":1},{"version":"fa1ea09d3e073252eccff2f6630a4ce5633cc2ff963ba672dd8fd6783108ea83","impliedFormat":1},{"version":"f5f541902bf7ae0512a177295de9b6bcd6809ea38307a2c0a18bfca72212f368","impliedFormat":1},{"version":"e8da637cbd6ed1cf6c36e9424f6bcee4515ca2c677534d4006cbd9a05f930f0c","impliedFormat":1},{"version":"ca1b882a105a1972f82cc58e3be491e7d750a1eb074ffd13b198269f57ed9e1b","impliedFormat":1},{"version":"fc3e1c87b39e5ba1142f27ec089d1966da168c04a859a4f6aab64dceae162c2b","impliedFormat":1},{"version":"3867ca0e9757cc41e04248574f4f07b8f9e3c0c2a796a5eb091c65bfd2fc8bdb","impliedFormat":1},{"version":"6c66f6f7d9ff019a644ff50dd013e6bf59be4bf389092948437efa6b77dc8f9a","impliedFormat":1},{"version":"4e10622f89fea7b05dd9b52fb65e1e2b5cbd96d4cca3d9e1a60bb7f8a9cb86a1","impliedFormat":1},{"version":"ef2d1bd01d144d426b72db3744e7a6b6bb518a639d5c9c8d86438fb75a3b1934","impliedFormat":1},{"version":"b9750fe7235da7d8bf75cb171bf067b7350380c74271d3f80f49aea7466b55b5","impliedFormat":1},{"version":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","impliedFormat":1},{"version":"c9e73dfb3f0afe113c123ced1cd45da14f82c66898209bab35b7d273e0fc6990","impliedFormat":1},{"version":"e9e731cc4d5767a85639ad3d203d4a54b0038177b91819badee8c7efcf23a743","impliedFormat":1},{"version":"ac60bbee0d4235643cc52b57768b22de8c257c12bd8c2039860540cab1fa1d82","impliedFormat":1},{"version":"973b59a17aaa817eb205baf6c132b83475a5c0a44e8294a472af7793b1817e89","impliedFormat":1},{"version":"ada39cbb2748ab2873b7835c90c8d4620723aedf323550e8489f08220e477c7f","impliedFormat":1},{"version":"6e5f5cee603d67ee1ba6120815497909b73399842254fc1e77a0d5cdc51d8c9c","impliedFormat":1},{"version":"f79e0681538ef94c273a46bb1a073b4fe9fdc93ef7f40cc2c3abd683b85f51fc","impliedFormat":1},{"version":"70f3814c457f54a7efe2d9ce9d2686de9250bb42eb7f4c539bd2280a42e52d33","impliedFormat":1},{"version":"17ace83a5bea3f1da7e0aef7aab0f52bca22619e243537a83a89352a611b837d","impliedFormat":1},{"version":"ef61792acbfa8c27c9bd113f02731e66229f7d3a169e3c1993b508134f1a58e0","impliedFormat":1},{"version":"afcb759e8e3ad6549d5798820697002bc07bdd039899fad0bf522e7e8a9f5866","impliedFormat":1},{"version":"f6404e7837b96da3ea4d38c4f1a3812c96c9dcdf264e93d5bdb199f983a3ef4b","impliedFormat":1},{"version":"c5426dbfc1cf90532f66965a7aa8c1136a78d4d0f96d8180ecbfc11d7722f1a5","impliedFormat":1},{"version":"65a15fc47900787c0bd18b603afb98d33ede930bed1798fc984d5ebb78b26cf9","impliedFormat":1},{"version":"9d202701f6e0744adb6314d03d2eb8fc994798fc83d91b691b75b07626a69801","impliedFormat":1},{"version":"de9d2df7663e64e3a91bf495f315a7577e23ba088f2949d5ce9ec96f44fba37d","impliedFormat":1},{"version":"c7af78a2ea7cb1cd009cfb5bdb48cd0b03dad3b54f6da7aab615c2e9e9d570c5","impliedFormat":1},{"version":"1dc574e42493e8bf9bb37be44d9e38c5bd7bbc04f884e5e58b4d69636cb192b3","impliedFormat":1},{"version":"9deab571c42ed535c17054f35da5b735d93dc454d83c9a5330ecc7a4fb184e9e","affectsGlobalScope":true,"impliedFormat":1},{"version":"db01d18853469bcb5601b9fc9826931cc84cc1a1944b33cad76fd6f1e3d8c544","affectsGlobalScope":true,"impliedFormat":1},{"version":"dba114fb6a32b355a9cfc26ca2276834d72fe0e94cd2c3494005547025015369","impliedFormat":1},{"version":"903e299a28282fa7b714586e28409ed73c3b63f5365519776bf78e8cf173db36","affectsGlobalScope":true,"impliedFormat":1},{"version":"fa6c12a7c0f6b84d512f200690bfc74819e99efae69e4c95c4cd30f6884c526e","impliedFormat":1},{"version":"f1c32f9ce9c497da4dc215c3bc84b722ea02497d35f9134db3bb40a8d918b92b","impliedFormat":1},{"version":"b73c319af2cc3ef8f6421308a250f328836531ea3761823b4cabbd133047aefa","affectsGlobalScope":true,"impliedFormat":1},{"version":"e433b0337b8106909e7953015e8fa3f2d30797cea27141d1c5b135365bb975a6","impliedFormat":1},{"version":"dd3900b24a6a8745efeb7ad27629c0f8a626470ac229c1d73f1fe29d67e44dca","impliedFormat":1},{"version":"ddff7fc6edbdc5163a09e22bf8df7bef75f75369ebd7ecea95ba55c4386e2441","impliedFormat":1},{"version":"106c6025f1d99fd468fd8bf6e5bda724e11e5905a4076c5d29790b6c3745e50c","impliedFormat":1},{"version":"ec29be0737d39268696edcec4f5e97ce26f449fa9b7afc2f0f99a86def34a418","impliedFormat":1},{"version":"4d4481ad9bd6783871db9d06eedc06214b24587c1d94b1d3cbe2e99d4d73d665","impliedFormat":1},{"version":"ec6cba1c02c675e4dd173251b156792e8d3b0c816af6d6ad93f1a55d674591aa","impliedFormat":1},{"version":"b620391fe8060cf9bedc176a4d01366e6574d7a71e0ac0ab344a4e76576fcbb8","impliedFormat":1},{"version":"41acd266e78e6880cdf79bacac97be0cf597e8d2b9ad8e27704ad43426eb8f2a","impliedFormat":1},{"version":"e15d3c84d5077bb4a3adee4c791022967b764dc41cb8fa3cfa44d4379b2c95f5","impliedFormat":1},{"version":"78244a2a8ab1080e0dd8fc3633c204c9a4be61611d19912f4b157f7ef7367049","impliedFormat":1},{"version":"e1fc1a1045db5aa09366be2b330e4ce391550041fc3e925f60998ca0b647aa97","impliedFormat":1},{"version":"b3751ab2273a6abc16e56cb61246db847fb0c6d4b71dad6c04761ca0c6c99fc3","impliedFormat":1},{"version":"43ba4f2fa8c698f5c304d21a3ef596741e8e85a810b7c1f9b692653791d8d97a","impliedFormat":1},{"version":"abf9bfffaa0bb56e8afa78b8fabd0ba5923803444b92e87577a90f3537404526","impliedFormat":1},{"version":"3556cfbab7b43da96d15a442ddbb970e1f2fc97876d055b6555d86d7ac57dae5","impliedFormat":1},{"version":"437751e0352c6e924ddf30e90849f1d9eb00ca78c94d58d6a37202ec84eb8393","impliedFormat":1},{"version":"48e8af7fdb2677a44522fd185d8c87deff4d36ee701ea003c6c780b1407a1397","impliedFormat":1},{"version":"606e6f841ba9667de5d83ca458449f0ed8c511ba635f753eaa731e532dea98c7","impliedFormat":1},{"version":"d860ce4d43c27a105290c6fdf75e13df0d40e3a4e079a3c47620255b0e396c64","impliedFormat":1},{"version":"b064dd7dd6aa5efef7e0cc056fed33fc773ea39d1e43452ee18a81d516fb762c","impliedFormat":1},{"version":"2e4f37ffe8862b14d8e24ae8763daaa8340c0df0b859d9a9733def0eee7562d9","impliedFormat":1},{"version":"13283350547389802aa35d9f2188effaeac805499169a06ef5cd77ce2a0bd63f","impliedFormat":1},{"version":"680793958f6a70a44c8d9ae7d46b7a385361c69ac29dcab3ed761edce1c14ab8","impliedFormat":1},{"version":"6ac6715916fa75a1f7ebdfeacac09513b4d904b667d827b7535e84ff59679aff","impliedFormat":1},{"version":"b838d4c72740eb0afd284bf7575b74c624b105eff2e8c7b4aeead57e7ac320ff","impliedFormat":1},{"version":"3d1a2f2bcad11d489f6502087379ad28a773461e1dca80297d2219e89d778a31","impliedFormat":1},{"version":"ccccbca40b0615f5b14902e7d960f0c7a96b75d9ea6a20d9c1a88f5874fe55e5","impliedFormat":1},{"version":"5fe23bd829e6be57d41929ac374ee9551ccc3c44cee893167b7b5b77be708014","impliedFormat":1},{"version":"8755047a16970243683d857754a93863da6fed6bf1737d195f55444c667ae8ee","impliedFormat":1},{"version":"438c7513b1df91dcef49b13cd7a1c4720f91a36e88c1df731661608b7c055f10","impliedFormat":1},{"version":"ad444a874f011d3a797f1a41579dbfcc6b246623f49c20009f60e211dbd5315e","impliedFormat":1},{"version":"361e2b13c6765d7f85bb7600b48fde782b90c7c41105b7dab1f6e7871071ba20","impliedFormat":1},{"version":"1f5730d4bbb923addc1eb475056b464327d5720702481c799a0c0a36a4f7fa70","impliedFormat":1},{"version":"4c335d3a693925d96a8412087b3d675d20f04aa94f49581d1ecefb7373d458a1","impliedFormat":1},{"version":"0c62ce5d1677ebb0192a92bb9268b276f43c678dabc85a4a218304c913ecb8c4","impliedFormat":1},{"version":"9c250db4bab4f78fad08be7f4e43e962cc143e0f78763831653549ceb477344a","impliedFormat":1},{"version":"021a9498000497497fd693dd315325484c58a71b5929e2bbb91f419b04b24cea","impliedFormat":1},{"version":"9385cdc09850950bc9b59cca445a3ceb6fcca32b54e7b626e746912e489e535e","impliedFormat":1},{"version":"0a72186f94215d020cb386f7dca81d7495ab6c17066eb07d0f44a5bf33c1b21a","impliedFormat":1},{"version":"d6786782daa690925e139faad965b2d1745f71380c26861717f10525790566d9","impliedFormat":1},{"version":"63a8e96f65a22604eae82737e409d1536e69a467bb738bec505f4f97cce9d878","impliedFormat":1},{"version":"3fd78152a7031315478f159c6a5872c712ece6f01212c78ea82aef21cb0726e2","impliedFormat":1},{"version":"c59596fe28e8c57bed899681e48881c580f3d6111bda02708b68fc796da98563","impliedFormat":1},{"version":"cda4052f66b1e6cb7cf1fdfd96335d1627aa24a3b8b82ba4a9f873ec3a7bcde8","impliedFormat":1},{"version":"0869acd1c5d6d68ebad5471a7f1dead17adf6d31b597f9d55e2c64e87f02c6dc","impliedFormat":1},{"version":"85125b1b2d5cc89fe2a6aa79ea8b83719690d526ab24b0715dad0147eb1f8ab4","impliedFormat":1},{"version":"fd933f824347f9edd919618a76cdb6a0c0085c538115d9a287fa0c7f59957ab3","impliedFormat":1},{"version":"6ac6715916fa75a1f7ebdfeacac09513b4d904b667d827b7535e84ff59679aff","impliedFormat":1},{"version":"6a1aa3e55bdc50503956c5cd09ae4cd72e3072692d742816f65c66ca14f4dfdd","impliedFormat":1},{"version":"ab75cfd9c4f93ffd601f7ca1753d6a9d953bbedfbd7a5b3f0436ac8a1de60dfa","impliedFormat":1},{"version":"28ebfca21bccf412dbb83a1095ee63eaa65dfc31d06f436f3b5f24bfe3ede7fa","impliedFormat":1},{"version":"b73cbf0a72c8800cf8f96a9acfe94f3ad32ca71342a8908b8ae484d61113f647","impliedFormat":1},{"version":"bae6dd176832f6423966647382c0d7ba9e63f8c167522f09a982f086cd4e8b23","impliedFormat":1},{"version":"1364f64d2fb03bbb514edc42224abd576c064f89be6a990136774ecdd881a1da","impliedFormat":1},{"version":"c9958eb32126a3843deedda8c22fb97024aa5d6dd588b90af2d7f2bfac540f23","impliedFormat":1},{"version":"950fb67a59be4c2dbe69a5786292e60a5cb0e8612e0e223537784c731af55db1","impliedFormat":1},{"version":"e927c2c13c4eaf0a7f17e6022eee8519eb29ef42c4c13a31e81a611ab8c95577","impliedFormat":1},{"version":"07ca44e8d8288e69afdec7a31fa408ce6ab90d4f3d620006701d5544646da6aa","impliedFormat":1},{"version":"70246ad95ad8a22bdfe806cb5d383a26c0c6e58e7207ab9c431f1cb175aca657","impliedFormat":1},{"version":"f00f3aa5d64ff46e600648b55a79dcd1333458f7a10da2ed594d9f0a44b76d0b","impliedFormat":1},{"version":"772d8d5eb158b6c92412c03228bd9902ccb1457d7a705b8129814a5d1a6308fc","impliedFormat":1},{"version":"4e4475fba4ed93a72f167b061cd94a2e171b82695c56de9899275e880e06ba41","impliedFormat":1},{"version":"97c5f5d580ab2e4decd0a3135204050f9b97cd7908c5a8fbc041eadede79b2fa","impliedFormat":1},{"version":"49b2375c586882c3ac7f57eba86680ff9742a8d8cb2fe25fe54d1b9673690d41","impliedFormat":1},{"version":"802e797bcab5663b2c9f63f51bdf67eff7c41bc64c0fd65e6da3e7941359e2f7","impliedFormat":1},{"version":"f97939cd243089f1b611457c08e7e4180b070494b3409c92daae451113d5cee0","impliedFormat":1},{"version":"3ecfccf916fea7c6c34394413b55eb70e817a73e39b4417d6573e523784e3f8e","impliedFormat":1},{"version":"7f1025a79ac3f9d1d61315c7a82b0d449feac81fdb399f05b76efd7acb5cff22","impliedFormat":1},{"version":"6459054aabb306821a043e02b89d54da508e3a6966601a41e71c166e4ea1474f","impliedFormat":1},{"version":"05c97cddbaf99978f83d96de2d8af86aded9332592f08ce4a284d72d0952c391","impliedFormat":1},{"version":"71bc9bc7afa31a36fb61f66a668b44ee0e7c9ed0f2f364ca0185ffff8bc8f174","impliedFormat":1},{"version":"bbc183d2d69f4b59fd4dd8799ffdf4eb91173d1c4ad71cce91a3811c021bf80c","impliedFormat":1},{"version":"7b6ff760c8a240b40dab6e4419b989f06a5b782f4710d2967e67c695ef3e93c4","impliedFormat":1},{"version":"8dbc4134a4b3623fc476be5f36de35c40f2768e2e3d9ed437e0d5f1c4cd850f6","impliedFormat":1},{"version":"d97cc318e24afd656c6a749ff37537691939eab81a7e352a245472cdc771c643","impliedFormat":1},{"version":"3ceeb1a114a85d03997d2c611c45cf3c5f26eeb63dd9b5fd9dc9eb04af98b2a4","impliedFormat":1},{"version":"eb8b35932068daa1ca6199109bf932fd0ceec9abd68506034cf8573e96ff7d09","impliedFormat":1},{"version":"f974e4a06953682a2c15d5bd5114c0284d5abf8bc0fe4da25cb9159427b70072","impliedFormat":1},{"version":"443fbe38a293542919fdeb3118772f4c0096681bbc0c59bc6b9939ddee8dd066","impliedFormat":1},{"version":"94404c4a878fe291e7578a2a80264c6f18e9f1933fbb57e48f0eb368672e389c","impliedFormat":1},{"version":"5c1b7f03aa88be854bc15810bfd5bd5a1943c5a7620e1c53eddd2a013996343e","impliedFormat":1},{"version":"f416c9c3eee9d47ff49132c34f96b9180e50485d435d5748f0e8b72521d28d2e","impliedFormat":1},{"version":"b4a49b80b0c625e4c7a9d6fcd95cd7d6a94ca6116b056d144de0cf70c03e4697","impliedFormat":1},{"version":"60a86278bd85866c81bc8e48d23659279b7a2d5231b06799498455586f7c8138","impliedFormat":1},{"version":"01aa917531e116485beca44a14970834687b857757159769c16b228eb1e49c5f","impliedFormat":1},{"version":"fbcde1fdade133b4a976480c0d4c692e030306f53909d7765dfef98436dec777","impliedFormat":1},{"version":"4f1ce48766482ed4c19da9b1103f87690abb7ba0a2885a9816c852bfad6881a1","impliedFormat":1},{"version":"187a6fdbdecb972510b7555f3caacb44b58415da8d5825d03a583c4b73fde4cf","impliedFormat":1},{"version":"d4c3250105a612202289b3a266bb7e323db144f6b9414f9dea85c531c098b811","impliedFormat":1},{"version":"18e2ae9d03e8bdc58ffecd37018bdb33969b1804a24de412f3c866324904b485","impliedFormat":1},{"version":"741067675daa6d4334a2dc80a4452ca3850e89d5852e330db7cb2b5f867173b1","impliedFormat":1},{"version":"a1c8542ed1189091dd39e732e4390882a9bcd15c0ca093f6e9483eba4e37573f","impliedFormat":1},{"version":"131b1475d2045f20fb9f43b7aa6b7cb51f25250b5e4c6a1d4aa3cf4dd1a68793","impliedFormat":1},{"version":"3a17f09634c50cce884721f54fd9e7b98e03ac505889c560876291fcf8a09e90","impliedFormat":1},{"version":"32531dfbb0cdc4525296648f53b2b5c39b64282791e2a8c765712e49e6461046","impliedFormat":1},{"version":"0ce1b2237c1c3df49748d61568160d780d7b26693bd9feb3acb0744a152cd86d","impliedFormat":1},{"version":"e489985388e2c71d3542612685b4a7db326922b57ac880f299da7026a4e8a117","impliedFormat":1},{"version":"76264a4df0b7c78b7b12dfaedc05d9f1016f27be1f3d0836417686ff6757f659","impliedFormat":1},{"version":"272692898cec41af73cb5b65f4197a7076007aecd30c81514d32fdb933483335","affectsGlobalScope":true,"impliedFormat":1},{"version":"fd1b9d883b9446f1e1da1e1033a6a98995c25fbf3c10818a78960e2f2917d10c","impliedFormat":1},{"version":"19252079538942a69be1645e153f7dbbc1ef56b4f983c633bf31fe26aeac32cd","impliedFormat":1},{"version":"bc11f3ac00ac060462597add171220aed628c393f2782ac75dd29ff1e0db871c","impliedFormat":1},{"version":"616775f16134fa9d01fc677ad3f76e68c051a056c22ab552c64cc281a9686790","impliedFormat":1},{"version":"65c24a8baa2cca1de069a0ba9fba82a173690f52d7e2d0f1f7542d59d5eb4db0","impliedFormat":1},{"version":"ec9fd890d681789cb0aa9efbc50b1e0afe76fbf3c49c3ac50ff80e90e29c6bcb","impliedFormat":1},{"version":"5fbd292aa08208ae99bf06d5da63321fdc768ee43a7a104980963100a3841752","impliedFormat":1},{"version":"9eac5a6beea91cfb119688bf44a5688b129b804ede186e5e2413572a534c21bb","impliedFormat":1},{"version":"e81bf06c0600517d8f04cc5de398c28738bfdf04c91fb42ad835bfe6b0d63a23","impliedFormat":1},{"version":"363996fe13c513a7793aa28ffb05b5d0230db2b3d21b7bfaf21f79e4cde54b4e","impliedFormat":1},{"version":"b7fff2d004c5879cae335db8f954eb1d61242d9f2d28515e67902032723caeab","impliedFormat":1},{"version":"5f3dc10ae646f375776b4e028d2bed039a93eebbba105694d8b910feebbe8b9c","impliedFormat":1},{"version":"bb18bf4a61a17b4a6199eb3938ecfa4a59eb7c40843ad4a82b975ab6f7e3d925","impliedFormat":1},{"version":"4545c1a1ceca170d5d83452dd7c4994644c35cf676a671412601689d9a62da35","impliedFormat":1},{"version":"15959543f93f27e8e2b1a012fe28e14b682034757e2d7a6c1f02f87107fc731e","impliedFormat":1},{"version":"a2d648d333cf67b9aeac5d81a1a379d563a8ffa91ddd61c6179f68de724260ff","impliedFormat":1},{"version":"2b664c3cc544d0e35276e1fb2d4989f7d4b4027ffc64da34ec83a6ccf2e5c528","impliedFormat":1},{"version":"a3f41ed1b4f2fc3049394b945a68ae4fdefd49fa1739c32f149d32c0545d67f5","impliedFormat":1},{"version":"3cd8f0464e0939b47bfccbb9bb474a6d87d57210e304029cd8eb59c63a81935d","impliedFormat":1},{"version":"47699512e6d8bebf7be488182427189f999affe3addc1c87c882d36b7f2d0b0e","impliedFormat":1},{"version":"3026abd48e5e312f2328629ede6e0f770d21c3cd32cee705c450e589d015ee09","impliedFormat":1},{"version":"4a8bae6576783c910147d19ec6bef24fd2a24e83acbbb2043a60eec7134738e6","impliedFormat":1},{"version":"7663d2c19ce5ef8288c790edba3d45af54e58c84f1b37b1249f6d49d962f3d91","impliedFormat":1},{"version":"f72ee46ae3f73e6c5ff0da682177251d80500dd423bfd50286124cd0ca11e160","impliedFormat":1},{"version":"898b714aad9cfd0e546d1ad2c031571de7622bd0f9606a499bee193cf5e7cf0c","impliedFormat":1},{"version":"94f4c1779dc2bbe0cf909eb8700898b1869ed8563acb3ec26cbe8047d642c269","impliedFormat":1},{"version":"fedebeae32c5cdd1a85b4e0504a01996e4a8adf3dfa72876920d3dd6e42978e7","impliedFormat":1},{"version":"5d26aae738fa3efc87c24f6e5ec07c54694e6bcf431cc38d3da7576d6bb35bd6","impliedFormat":1},{"version":"cdf21eee8007e339b1b9945abf4a7b44930b1d695cc528459e68a3adc39a622e","impliedFormat":1},{"version":"db036c56f79186da50af66511d37d9fe77fa6793381927292d17f81f787bb195","impliedFormat":1},{"version":"65c2c49eda6c44aa170bfd449ef6f6970843b005356624a393cc887310752c5c","impliedFormat":1},{"version":"e769eb743cd01a0b7ffbb59293d2e4fa5848ab39430e196941143af6ecd4569e","impliedFormat":1},{"version":"68f81dad9e8d7b7aa15f35607a70c8b68798cf579ac44bd85325b8e2f1fb3600","impliedFormat":1},{"version":"1de80059b8078ea5749941c9f863aa970b4735bdbb003be4925c853a8b6b4450","impliedFormat":1},{"version":"1d079c37fa53e3c21ed3fa214a27507bda9991f2a41458705b19ed8c2b61173d","impliedFormat":1},{"version":"94fd3ce628bd94a2caf431e8d85901dbe3a64ab52c0bd1dbe498f63ca18789f7","impliedFormat":1},{"version":"5835a6e0d7cd2738e56b671af0e561e7c1b4fb77751383672f4b009f4e161d70","impliedFormat":1},{"version":"c0eeaaa67c85c3bb6c52b629ebbfd3b2292dc67e8c0ffda2fc6cd2f78dc471e6","impliedFormat":1},{"version":"4b7f74b772140395e7af67c4841be1ab867c11b3b82a51b1aeb692822b76c872","impliedFormat":1},{"version":"27be6622e2922a1b412eb057faa854831b95db9db5035c3f6d4b677b902ab3b7","impliedFormat":1},{"version":"b95a6f019095dd1d48fd04965b50dfd63e5743a6e75478343c46d2582a5132bf","impliedFormat":99},{"version":"c2008605e78208cfa9cd70bd29856b72dda7ad89df5dc895920f8e10bcb9cd0a","impliedFormat":99},{"version":"b97cb5616d2ab82a98ec9ada7b9e9cabb1f5da880ec50ea2b8dc5baa4cbf3c16","impliedFormat":99},{"version":"16fd66ae997b2f01c972531239da90fbf8ab4022bb145b9587ef746f6cecde5a","affectsGlobalScope":true,"impliedFormat":1},{"version":"fc8fbee8f73bf5ffd6ba08ba1c554d6f714c49cae5b5e984afd545ab1b7abe06","affectsGlobalScope":true,"impliedFormat":1},{"version":"3586f5ea3cc27083a17bd5c9059ede9421d587286d5a47f4341a4c2d00e4fa91","impliedFormat":1},{"version":"a6df929821e62f4719551f7955b9f42c0cd53c1370aec2dd322e24196a7dfe33","impliedFormat":1},{"version":"b789bf89eb19c777ed1e956dbad0925ca795701552d22e68fd130a032008b9f9","impliedFormat":1},"e462a655754db9df18b4a657454a7b6a88717ffded4e89403b2b3a47c6603fc3",{"version":"402e5c534fb2b85fa771170595db3ac0dd532112c8fa44fc23f233bc6967488b","impliedFormat":1},{"version":"52dcc257df5119fb66d864625112ce5033ac51a4c2afe376a0b299d2f7f76e4a","impliedFormat":1},{"version":"e5bab5f871ef708d52d47b3e5d0aa72a08ee7a152f33931d9a60809711a2a9a3","impliedFormat":1},{"version":"e16dc2a81595736024a206c7d5c8a39bfe2e6039208ef29981d0d95434ba8fcf","impliedFormat":1},{"version":"cc4a4903fb698ca1d961d4c10dce658aa3a479faf40509d526f122b044eaf6a4","impliedFormat":1},{"version":"19ee8416e6473ed6c7adb868fa796b5653cf0fa2a337658e677eaa0d134388c3","impliedFormat":1},{"version":"1328ab4e442614b28cdb3d4b414cf68325c0da0dca07287a338d0654b7a00261","impliedFormat":1},{"version":"a039dc21f045919f3cbee2ec13812cc6cc3eebc99dae4be00973230f468d19a6","impliedFormat":1},{"version":"3fbe57af01460e49dcd29df55d6931e1672bc6f1be0fb073d11410bc16f9037d","impliedFormat":1},{"version":"f760be449e8562ec5c09bb5187e8e1eabf3c113c0c58cddda53ef8c69f3e2131","impliedFormat":1},{"version":"44325ed13294fce6ab825b82947bbeed2611db7dad9d9135260192f375e5a189","impliedFormat":1},{"version":"e392e8fb5b514eafc585601c1d781485aa6dd6a320e75daf1064a4c6918a1b45","impliedFormat":1},{"version":"46e4a36e8ddbdfb4e7330e11c81c970dc8b218611df9183d39c41c5f8c653b55","impliedFormat":1},{"version":"3cc8a3d123b6b232d48d34b51b785f9da8d193f5b5817fa521fcd2f3b9315c55","impliedFormat":1},{"version":"6332f565867cf4a740a70e30f31cefba37ef7cebcf74f22eab8d744fde6d193e","impliedFormat":1},{"version":"2977b7884aedc895a1d0c9c210c7cf3272c29d6959a08a6fa3ff71e0aff08175","impliedFormat":1},{"version":"17f2922d41ddd032830a91371c948cd9ce903b35c95adca72271a54584f19b0b","impliedFormat":1},{"version":"3eed76ede2a1a14d7c9bb0a642041282dcc264811139d3dd275c9fe14efc9840","impliedFormat":1},{"version":"354a7f8e1287d9d6b7561bc97fdd8cbc2f7c1dd79e4cb37b942e8a5cfaff1085","impliedFormat":1},{"version":"8d369483f0c2b9ee388129cfdb6a43bc8112b377e86a41884bd06e19ce04f4c1","impliedFormat":99},{"version":"b558c9a18ea4e6e4157124465c3ef1063e64640da139e67be5edb22f534f2f08","impliedFormat":1},{"version":"01374379f82be05d25c08d2f30779fa4a4c41895a18b93b33f14aeef51768692","impliedFormat":1},{"version":"b0dee183d4e65cf938242efaf3d833c6b645afb35039d058496965014f158141","impliedFormat":1},{"version":"c0bbbf84d3fbd85dd60d040c81e8964cc00e38124a52e9c5dcdedf45fea3f213","impliedFormat":1},"8880e4796c3e98b43dc5ff31b58960cf23324c0c46fba345f985c98f34dc126d",{"version":"3505c5403ad73e6529725f4522a4e6572a912a8f9e3808a30864fb629a97b911","signature":"af92d593b475b85ee4c7e2011d26997f092d9aaea7f5306b7df09c5bcdbd2ab3"},{"version":"ca0c26cad841e3830b8cbade2e18398a41ff1ab6e5e823c4cef4d02aca4c8d8b","signature":"9256bc8a24e88517aea9151a807a93e11a1be65d75427121bad65e664a9915f7"},{"version":"a3aba605d06c5a44ac0a556a0abca13ee9cfe3abc870a8e2fd43493ae641cf9f","signature":"7aab394c990ccdcbfdbf20b2d9d2ebd169b4ba9bec9fbd2256a1bfdfb39f4778"},{"version":"c75d90e0bb8e16a75cffc3a97ab4d8fd146e8b4e4061982895dec59cd10e6406","signature":"b57a8b43d842df5b6b6decf10ca068a7a9deefee15dfe794b6961b45aeb28d3d"},{"version":"0be73ce065a7b6a1dba1eb6233ed6184d3432b0dd5e779693b66565aaa0b921c","signature":"779a42ca77c7bc5f30d02b417d186b3f1b943f8071892b5dc8d1865854d19745"},"33c471b5806e7587e5a71a41ca64c113434b7f780d4c03cebad7d180e2f3f7e0","4cba97c3450bd284681bed4dc08ab30963cef63f3278b941453eb69dc5eb7292","8f1ebd4342ae8fe3f63d5d3ba6018d50720cdfd72af78d2d06ef8aac73dc17de",{"version":"ae4cda96b058f20db053c1f57e51257d1cffff9c0880326d2b8129ade5363402","impliedFormat":1},{"version":"775da84ca8dc28ebbb6f94de3be89605d181ef4aaf1147edec853b72d2483476","impliedFormat":99},{"version":"12115a2a03125cb3f600e80e7f43ef57f71a2951bb6e60695fb00ac8e12b27f3","impliedFormat":1},{"version":"d30e67059f5c545c5f8f0cc328a36d2e03b8c4a091b4301bc1d6afb2b1491a3a","impliedFormat":1},{"version":"02f7c65c690af708e9da6b09698c86d34b6b39a05acd8288a079859d920aea9f","impliedFormat":1},{"version":"a7243d69c14d02ca27b3953399d469598f19141e3151d517c51c3cbce8789853","impliedFormat":99},{"version":"37550007de426cbbb418582008deae1a508935eaebbd4d41e22805ad3b485ad4","impliedFormat":1},{"version":"e2cc1b44fe89c8955cc6034f5c923897aec13f9212170addd1fc26907725abda","impliedFormat":1},{"version":"aa15321e9d6378de4939e961e45fe8da3cf8bc2271496ceb23f493b26dc4e950","impliedFormat":99},{"version":"b8d91fed56c50865ffd379f7086e7ffeda50f819d6015318a4fd07c0a26ad910","impliedFormat":99},{"version":"e3913b35c221b4468658743d6496b83323c895f8e5b566c48d8844c01bf24738","impliedFormat":1},{"version":"60a5de2e20d5d925ddc58570831c6d849ce9a88f5eb1d190e27d1a52ab7263b0","impliedFormat":1},"266a8f9531b3c0c0bf4562cfb21c17e2046024dde189f113f55947977faefad4",{"version":"294aaaf86f5751a4a39647bc17c0c76ec981d0aecb610b1ddb1da55d68e1322c","impliedFormat":1},"04f69c7930568d6fb25d0dc6ed6747b82017ae0916ac42fe325bc554f78f761a","95387fe6d7270ffafb66c9ebac93209e691c95aada30247da369d7dcb84f5194",{"version":"38479e9851ea5f43f60baaa6bc894a49dba0a74dd706ce592d32bcb8b59e3be9","affectsGlobalScope":true,"impliedFormat":1},{"version":"9592f843d45105b9335c4cd364b9b2562ce4904e0895152206ac4f5b2d1bb212","impliedFormat":1},{"version":"f9ff719608ace88cae7cb823f159d5fb82c9550f2f7e6e7d0f4c6e41d4e4edb4","affectsGlobalScope":true,"impliedFormat":1},"7361bbe7e894781129006413258a5cd52273561dfee552ea1d61a649aec81e31","50e387e392984a4c8988bf471046be9a480117c06edfeb887a7d326989247b60",{"version":"cbd90995936dc6bb4483eea81ca665df5f71deb21e535b37bee0b578d81e4ee0","signature":"2923a12a35ff5574d4aba52ac23e575213500288106e5a394498bd90b397ef22"},{"version":"72df39f04a932eff07d413b999c612a16bdc9f401a0491ce476fd9ec4e8b9f05","signature":"06e629746fe1f78b4f034ce42c0d249ddc28cf8ea7a4afdb2a54912f8e1a642a"},"7ad399924e483915799173d2f1bc1ecdfb7fd1882286610ba0faa5b4f52de25e",{"version":"3b6fcdf4ba1c1ba1f21546e363e1d85000ed661be7927d40fc026713e694590d","signature":"93ea62d16aab491272fa27d22cd72935e23f19e00146948977fe8eebc7ec44f9"},"577df0159e26a071eaa0f57594291591096ad2f4d030c0993a4961098fe1ab84","3b91291179c055e2b7024dab68ddd8c3ba10b3fd172b232c430fccf1738b97f0","b42c095d754a5884c30472b09f4d79b4642ed6fbca5d065eafd58becb13ecac2"],"root":[405,[430,438],451,453,454,[458,466]],"options":{"allowJs":true,"esModuleInterop":true,"jsx":1,"module":99,"skipLibCheck":true,"strict":true,"target":1},"referencedMap":[[465,1],[466,2],[405,3],[440,4],[444,4],[358,4],[445,5],[442,4],[439,4],[443,6],[142,7],[143,7],[144,8],[99,9],[145,10],[146,11],[147,12],[94,4],[97,13],[95,4],[96,4],[148,14],[149,15],[150,16],[151,17],[152,18],[153,19],[154,19],[155,20],[156,21],[157,22],[158,23],[100,4],[98,4],[159,24],[160,25],[161,26],[193,27],[162,28],[163,29],[164,30],[165,31],[166,32],[167,33],[168,34],[169,35],[170,36],[171,37],[172,37],[173,38],[174,4],[175,39],[177,40],[176,41],[178,42],[179,43],[180,44],[181,45],[182,46],[183,47],[184,48],[185,49],[186,50],[187,51],[188,52],[189,53],[190,54],[101,4],[102,4],[103,4],[141,55],[191,56],[192,57],[441,4],[86,4],[198,58],[199,59],[197,60],[195,61],[196,62],[84,4],[87,63],[282,60],[449,5],[85,4],[457,64],[446,4],[447,4],[452,60],[450,65],[455,4],[456,4],[93,66],[361,67],[366,68],[368,69],[218,70],[233,71],[331,72],[264,4],[334,73],[298,74],[306,75],[290,76],[332,77],[219,78],[263,4],[265,79],[289,4],[333,80],[240,81],[220,82],[244,81],[234,81],[204,81],[288,83],[209,4],[285,84],[377,85],[283,86],[378,87],[270,4],[286,88],[389,89],[294,90],[388,4],[386,4],[387,91],[287,60],[275,92],[284,93],[301,94],[302,95],[293,4],[271,96],[291,97],[292,90],[381,98],[384,99],[251,100],[250,101],[249,102],[392,60],[248,103],[225,4],[395,4],[398,4],[397,60],[399,104],[200,4],[326,4],[232,105],[202,106],[349,4],[350,4],[352,4],[355,107],[351,4],[353,108],[354,108],[217,4],[231,4],[360,109],[369,110],[373,111],[213,112],[277,113],[276,4],[297,114],[295,4],[296,4],[300,115],[273,116],[212,117],[238,118],[323,119],[205,120],[211,121],[201,72],[336,122],[347,123],[335,4],[346,124],[239,4],[223,125],[315,126],[314,4],[322,127],[316,128],[320,129],[321,130],[319,128],[318,130],[317,128],[260,131],[245,131],[309,132],[246,132],[207,133],[206,4],[313,134],[312,135],[311,136],[310,137],[208,138],[281,139],[299,140],[280,141],[305,142],[307,143],[304,141],[241,138],[194,4],[324,144],[266,145],[345,146],[269,147],[340,148],[221,4],[341,149],[343,150],[344,151],[339,4],[338,120],[242,152],[325,153],[348,154],[214,4],[216,4],[222,155],[308,156],[210,157],[215,4],[268,158],[267,159],[224,160],[274,161],[272,162],[226,163],[228,164],[396,4],[227,165],[229,166],[363,4],[364,4],[362,4],[365,4],[394,4],[230,167],[279,60],[92,4],[303,168],[252,4],[262,169],[371,60],[380,170],[259,60],[375,90],[258,171],[357,172],[257,170],[203,4],[382,173],[255,60],[256,60],[247,4],[261,4],[254,174],[253,175],[243,176],[237,177],[342,4],[236,178],[235,4],[367,4],[278,60],[359,179],[83,4],[91,180],[88,60],[89,4],[90,4],[337,181],[330,182],[329,4],[328,183],[327,4],[370,184],[372,185],[374,186],[376,187],[379,188],[404,189],[383,189],[403,190],[385,191],[390,192],[391,193],[393,194],[400,195],[402,4],[401,196],[356,197],[422,198],[420,199],[421,200],[409,201],[410,199],[417,202],[408,203],[413,204],[423,4],[414,205],[419,206],[425,207],[424,208],[407,209],[415,210],[416,211],[411,212],[418,198],[412,213],[448,4],[406,4],[428,214],[427,4],[426,4],[429,215],[81,4],[82,4],[13,4],[14,4],[16,4],[15,4],[2,4],[17,4],[18,4],[19,4],[20,4],[21,4],[22,4],[23,4],[24,4],[3,4],[25,4],[26,4],[4,4],[27,4],[31,4],[28,4],[29,4],[30,4],[32,4],[33,4],[34,4],[5,4],[35,4],[36,4],[37,4],[38,4],[6,4],[42,4],[39,4],[40,4],[41,4],[43,4],[7,4],[44,4],[49,4],[50,4],[45,4],[46,4],[47,4],[48,4],[8,4],[54,4],[51,4],[52,4],[53,4],[55,4],[9,4],[56,4],[57,4],[58,4],[60,4],[59,4],[61,4],[62,4],[10,4],[63,4],[64,4],[65,4],[11,4],[66,4],[67,4],[68,4],[69,4],[70,4],[1,4],[71,4],[72,4],[12,4],[76,4],[74,4],[79,4],[78,4],[73,4],[77,4],[75,4],[80,4],[119,216],[129,217],[118,216],[139,218],[110,219],[109,220],[138,196],[132,221],[137,222],[112,223],[126,224],[111,225],[135,226],[107,227],[106,196],[136,228],[108,229],[113,230],[114,4],[117,230],[104,4],[140,231],[130,232],[121,233],[122,234],[124,235],[120,236],[123,237],[133,196],[115,238],[116,239],[125,240],[105,241],[128,232],[127,230],[131,4],[134,242],[438,243],[464,244],[451,245],[460,246],[453,247],[454,248],[462,249],[461,250],[458,251],[463,252],[459,253],[437,254],[432,255],[431,4],[433,4],[434,255],[436,256],[435,4],[430,257]],"affectedFilesPendingEmit":[465,466,438,464,451,460,453,454,462,461,458,463,459,437,432,431,433,434,436,435,430],"version":"5.9.3"}
```

### frontend/.pytest_cache/.gitignore
```
# Created by pytest automatically.
*

```

### frontend/.pytest_cache/CACHEDIR.TAG
```
Signature: 8a477f597d28d172789f06886806bc55
# This file is a cache directory tag created by pytest.
# For information about cache directory tags, see:
#	https://bford.info/cachedir/spec.html

```

### frontend/.pytest_cache/README.md
```markdown
# pytest cache directory #

This directory contains data from the pytest's cache plugin,
which provides the `--lf` and `--ff` options, as well as the `cache` fixture.

**Do not** commit this to version control.

See [the docs](https://docs.pytest.org/en/stable/how-to/cache.html) for more information.

```

### frontend/.pytest_cache/v/cache/nodeids
```
[]
```

### frontend/src/app/globals.css
```css
@import "maplibre-gl/dist/maplibre-gl.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #0f172a;
}

html,
body,
#root,
main {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
}

.glass-panel-dark {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

/* Custom scrollbars for drawers */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
}

```

### frontend/src/app/layout.tsx
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { NavigationProvider } from "@/context/NavigationContext";

export const metadata: Metadata = {
  title: "Apex Guardian - AI Navigation Engine",
  description: "AI-powered predictive navigation engine for Bengaluru",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body className="h-full w-full overflow-hidden bg-slate-900 text-slate-900 antialiased">
        <NavigationProvider>
          {children}
        </NavigationProvider>
      </body>
    </html>
  );
}

```

### frontend/src/app/page.tsx
```tsx
"use client";

import React from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { FloatingSearchPanel } from "@/components/ui/FloatingSearchPanel";
import { MapControls } from "@/components/ui/MapControls";
import { RouteCard } from "@/components/ui/RouteCard";
import { TurnByTurnDrawer } from "@/components/ui/TurnByTurnDrawer";
import { AdvanceAlertBanner } from "@/components/ui/AdvanceAlertBanner";
import { RerouteModal } from "@/components/ui/RerouteModal";
import { NavigationControlsHUD } from "@/components/ui/NavigationControlsHUD";
import { TrafficLegend } from "@/components/ui/TrafficLegend";
import { useNavigation } from "@/context/NavigationContext";
import { ShieldCheck, Wifi, WifiOff, Siren } from "lucide-react";

export default function Home() {
  const {
    backendOnline,
    isEmergencyMode,
    isNavigating,
    activeAlert,
    dismissAlert,
    activeRerouteRecommendation,
    dismissReroute,
    acceptReroute,
    triggerDynamicRerouteCheck,
    isApplyingReroute,
  } = useNavigation();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Full-bleed Map Canvas Base Layer */}
      <MapCanvas />

      {/* Feature 4: Advance Distance-Decrementing Proactive Alert Banner */}
      <AdvanceAlertBanner
        alert={activeAlert}
        onDismiss={dismissAlert}
        onCheckReroute={() => triggerDynamicRerouteCheck(true)}
        fasterRouteAvailable={!!activeRerouteRecommendation?.is_reroute_recommended}
      />

      {/* Feature 8 & 9: Fastest Alternative Route Modal */}
      <RerouteModal
        recommendation={activeRerouteRecommendation}
        onAccept={acceptReroute}
        onDismiss={dismissReroute}
        isApplying={isApplyingReroute}
      />

      {/* Active Driving Turn-by-Turn HUD & Simulation Controls */}
      <NavigationControlsHUD />

      {/* Feature 1: Traffic Classification Color Legend */}
      <TrafficLegend />

      {/* Left Sidebar UI Layout */}
      {!isNavigating && (
        <div className="fixed left-4 top-4 bottom-4 z-20 flex flex-col gap-4 w-[calc(100vw-32px)] sm:w-[420px] pointer-events-none">
          <FloatingSearchPanel />
          <RouteCard />
          <TurnByTurnDrawer />
        </div>
      )}

      {/* Standard Map Controls (Zoom, Recenter, Layers) */}
      <MapControls />

      {/* Top-Right Backend Health & Mode Status Badges */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
        {isEmergencyMode && (
          <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-black text-rose-600 border border-rose-500/50 bg-rose-50/95 animate-pulse">
            <Siren className="w-3.5 h-3.5 fill-current" />
            <span className="tracking-wide uppercase">Emergency Mode</span>
          </div>
        )}

        <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-semibold">
          <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="hidden sm:inline text-slate-700 font-bold">Apex Backend:</span>
          {backendOnline === null ? (
            <span className="text-slate-400">Connecting...</span>
          ) : backendOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-500 font-bold">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
        </div>
      </div>
    </main>
  );
}

```

### frontend/src/components/map/MapCanvas.tsx
```tsx
"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigation, BENGALURU_CENTER } from "@/context/NavigationContext";
import { reverseGeocode, CongestionHotspot } from "@/lib/api";

export const mapRefContainer: { current: maplibregl.Map | null } = { current: null };

export const BENGALURU_MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
  [77.4000, 12.8000], // South-West
  [77.8000, 13.1500], // North-East
];

export const MapCanvas: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const lastCameraFollowTimeRef = useRef<number>(0);

  const {
    selectedOrigin,
    setSelectedOrigin,
    setSourceQuery,
    selectedDestination,
    setSelectedDestination,
    setDestinationQuery,
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    recenterTrigger,
    setCurrentZoom,
    pinDropMode,
    setPinDropMode,
    calculateRoutes,
    activeLayerMode,
    isEmergencyMode,
    isNavigating,
    currentLocation,
    vehicleBearing,
    activeRerouteRecommendation,
  } = useNavigation();

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-positron-hd": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "carto-positron-hd-layer",
            type: "raster",
            source: "carto-positron-hd",
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [BENGALURU_CENTER.lon, BENGALURU_CENTER.lat],
      zoom: 12.5,
      minZoom: 10,
      maxZoom: 19,
      maxBounds: BENGALURU_MAX_BOUNDS,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on("load", () => {
      map.resize();
    });

    map.on("zoom", () => setCurrentZoom(map.getZoom()));
    map.on("zoomend", () => setCurrentZoom(map.getZoom()));

    mapRef.current = map;
    mapRefContainer.current = map;

    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      mapRefContainer.current = null;
    };
  }, [setCurrentZoom]);

  // Window Resize Listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapContainerRef.current) return;

    const handleResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mapContainerRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Update cursor based on pinDropMode
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = pinDropMode !== "none" ? "crosshair" : "";
    }
  }, [pinDropMode]);


  // Map Click Listener for Pin Drop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: maplibregl.MapMouseEvent) => {
      if (pinDropMode === "none") return;

      const { lng, lat } = e.lngLat;
      const roundedLat = parseFloat(lat.toFixed(5));
      const roundedLon = parseFloat(lng.toFixed(5));

      let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
      try {
        const rev = await reverseGeocode(roundedLat, roundedLon);
        if (rev && rev.display_name) resolvedName = rev.display_name;
      } catch (err) {
        console.error("Reverse geocode error:", err);
      }

      if (pinDropMode === "source") {
        const newOrigin = { lat: roundedLat, lon: roundedLon, name: resolvedName };
        setSelectedOrigin(newOrigin);
        setSourceQuery(resolvedName);
        setPinDropMode("none");
        if (selectedDestination) {
          await calculateRoutes(newOrigin, selectedDestination);
        }
      } else if (pinDropMode === "destination") {
        const newDest = { lat: roundedLat, lon: roundedLon, name: resolvedName };
        setSelectedDestination(newDest);
        setDestinationQuery(resolvedName);
        setPinDropMode("none");
        if (selectedOrigin) {
          await calculateRoutes(selectedOrigin, newDest);
        }
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [
    pinDropMode,
    selectedOrigin,
    selectedDestination,
    setSelectedOrigin,
    setSelectedDestination,
    setSourceQuery,
    setDestinationQuery,
    setPinDropMode,
    calculateRoutes,
  ]);

  // Origin Marker (Section 5: Matching Drop-Pin Style in Emerald Green)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedOrigin) {
      if (!originMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#10B981"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#047857"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedOrigin.lon, selectedOrigin.lat])
          .addTo(map);

        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));

          let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
          try {
            const rev = await reverseGeocode(roundedLat, roundedLon);
            if (rev && rev.display_name) resolvedName = rev.display_name;
          } catch (err) {
            console.error("Reverse geocode drag error:", err);
          }

          const newOrigin = { lat: roundedLat, lon: roundedLon, name: resolvedName };
          setSelectedOrigin(newOrigin);
          setSourceQuery(resolvedName);
          if (selectedDestination) {
            await calculateRoutes(newOrigin, selectedDestination);
          }
        });

        originMarkerRef.current = marker;
      } else {
        originMarkerRef.current.setLngLat([selectedOrigin.lon, selectedOrigin.lat]);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
  }, [selectedOrigin, selectedDestination, setSelectedOrigin, setSourceQuery, calculateRoutes]);

  // Destination Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedDestination) {
      if (!destMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#EA4335"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#7A0000"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedDestination.lon, selectedDestination.lat])
          .addTo(map);

        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));

          let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
          try {
            const rev = await reverseGeocode(roundedLat, roundedLon);
            if (rev && rev.display_name) resolvedName = rev.display_name;
          } catch (err) {
            console.error("Reverse geocode drag error:", err);
          }

          const newDest = { lat: roundedLat, lon: roundedLon, name: resolvedName };
          setSelectedDestination(newDest);
          setDestinationQuery(resolvedName);
          if (selectedOrigin) {
            await calculateRoutes(selectedOrigin, newDest);
          }
        });

        destMarkerRef.current = marker;
      } else {
        destMarkerRef.current.setLngLat([selectedDestination.lon, selectedDestination.lat]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [selectedDestination, selectedOrigin, setSelectedDestination, setDestinationQuery, calculateRoutes]);

  // Smooth Vehicle Marker & Camera Follow (Section 4)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isNavigating && currentLocation) {
      if (!vehicleMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "relative flex items-center justify-center pointer-events-none";
        el.style.width = "42px";
        el.style.height = "42px";
        el.innerHTML = `
          <div class="absolute w-10 h-10 rounded-full bg-blue-500/25 animate-ping"></div>
          <div class="vehicle-inner relative w-9 h-9 rounded-full bg-slate-900 border-2 border-white shadow-2xl flex items-center justify-center transition-transform duration-75 ease-out">
            <svg class="w-5 h-5 text-blue-400 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>
        `;

        vehicleMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([currentLocation.lon, currentLocation.lat])
          .addTo(map);
      } else {
        // Smooth fractional position updates
        vehicleMarkerRef.current.setLngLat([currentLocation.lon, currentLocation.lat]);
        const innerIcon = vehicleMarkerRef.current.getElement().querySelector(".vehicle-inner") as HTMLElement;
        if (innerIcon) {
          innerIcon.style.transform = `rotate(${vehicleBearing}deg)`;
        }
      }

      // Smooth camera follow without competing with marker animation
      const now = performance.now();
      if (now - lastCameraFollowTimeRef.current > 200) {
        lastCameraFollowTimeRef.current = now;
        map.easeTo({
          center: [currentLocation.lon, currentLocation.lat],
          duration: 250,
          easing: (t) => t,
          zoom: Math.max(14.5, map.getZoom()),
        });
      }
    } else if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }
  }, [isNavigating, currentLocation, vehicleBearing]);

  // Render Multi-Color Congestion Segments & Congestion Drop Pins (Sections 3 & 6)
  const renderedLayersRef = useRef<string[]>([]);
  const renderedSourcesRef = useRef<string[]>([]);
  const renderedListenersRef = useRef<{ layerId: string; listener: any }[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cleanupOldRoutes = () => {
      renderedLayersRef.current.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });
      renderedLayersRef.current = [];

      renderedSourcesRef.current.forEach((sourceId) => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });
      renderedSourcesRef.current = [];

      renderedListenersRef.current.forEach(({ layerId, listener }) => {
        map.off("click", layerId, listener);
      });
      renderedListenersRef.current = [];

      // Clear all hotspot drop pin markers
      hotspotMarkersRef.current.forEach((m) => m.remove());
      hotspotMarkersRef.current = [];
    };

    const renderPolylines = () => {
      cleanupOldRoutes();
      if (!routes || routes.length === 0) return;

      // Draw non-active routes first, then active route on top
      const sortedIndices = routes.map((_, idx) => idx).sort((a, b) => {
        if (a === activeRouteIndex) return 1;
        if (b === activeRouteIndex) return -1;
        return 0;
      });

      sortedIndices.forEach((idx) => {
        const route = routes[idx];
        if (!route || !route.geometry) return;

        const isSelected = idx === activeRouteIndex;
        const isAI = Boolean(route.is_ai_recommended);

        // Layer Mode Filtering
        if (activeLayerMode === "AI_ONLY" && !isAI && routes.length > 1) return;
        if (activeLayerMode === "STANDARD_ONLY" && isAI && routes.length > 1) return;

        if (route.segments && route.segments.length > 0) {
          // Render Segmented Color-Coded Polyline for All Routes
          route.segments.forEach((seg, sIdx) => {
            const sourceId = `seg-source-${idx}-${sIdx}`;
            const casingLayerId = `seg-casing-${idx}-${sIdx}`;
            const lineLayerId = `seg-line-${idx}-${sIdx}`;

            let segmentColor = seg.color;
            if (!isAI && seg.congestion_level === "CLEAR") {
              segmentColor = "#3B82F6";
            }

            map.addSource(sourceId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: { level: seg.congestion_level, color: segmentColor, routeIndex: idx },
                geometry: {
                  type: "LineString",
                  coordinates: seg.coordinates,
                },
              },
            });
            renderedSourcesRef.current.push(sourceId);

            // Casing Glow
            map.addLayer({
              id: casingLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": isSelected ? "#0F172A" : "#1E293B",
                "line-width": isSelected ? 12 : 8,
                "line-opacity": isSelected ? 0.45 : 0.2,
              },
            });
            renderedLayersRef.current.push(casingLayerId);

            // Segment Line
            map.addLayer({
              id: lineLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": segmentColor,
                "line-width": isSelected ? 7 : 5,
                "line-opacity": isSelected ? 1.0 : 0.65,
              },
            });
            renderedLayersRef.current.push(lineLayerId);

            // Click-to-switch behavior
            if (!isSelected) {
              const clickListener = () => {
                if (!isNavigating) {
                  setActiveRouteIndex(idx);
                }
              };
              map.on("click", lineLayerId, clickListener);
              renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
            }
          });

          // Section 3: Render Distinct Congestion Drop Pins Anchored Directly at Hotspot GPS Points
          if (route.hotspots && route.hotspots.length > 0) {
            route.hotspots.forEach((hotspot) => {
              const el = document.createElement("div");
              const level = hotspot.congestion_level || "HEAVY";
              const isSevere = level === "SEVERE";
              const isModerate = level === "MODERATE";
              const delayM = Math.max(1, Math.round((hotspot.estimated_delay_seconds || 120) / 60));

              let pinFill = "#DC2626"; // Red (Heavy)
              let pinStroke = "#F87171";
              let shadowColor = "rgba(220, 38, 38, 0.4)";
              let iconSvg = "";
              let titleColor = "text-rose-400";
              let badgeBg = "bg-rose-600 text-white";

              if (isModerate) {
                pinFill = "#D97706"; // Amber (Moderate)
                pinStroke = "#FBBF24";
                shadowColor = "rgba(217, 119, 6, 0.35)";
                titleColor = "text-amber-400";
                badgeBg = "bg-amber-600 text-white";
                // Shape: Single vehicle silhouette
                iconSvg = `
                  <path d="M22 13H14c-.5 0-.9.3-1.1.7L11.5 16v4.5c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7V16l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#D97706"/>
                `;
              } else if (isSevere) {
                pinFill = "#991B1B"; // Crimson Maroon (Severe)
                pinStroke = "#E11D48";
                shadowColor = "rgba(225, 29, 72, 0.6)";
                titleColor = "text-rose-400";
                badgeBg = "bg-rose-700 text-white ring-1 ring-rose-400";
                // Shape: Queued vehicles + warning badge (!)
                iconSvg = `
                  <path d="M19 10h-4c-.3 0-.5.2-.6.4L13.5 12h7l-.7-1.6c-.1-.2-.4-.4-.8-.4z" fill="#991B1B" opacity="0.6"/>
                  <path d="M22 13.5H14c-.5 0-.9.3-1.1.7L11.5 16.5V21c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-4.5l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#991B1B"/>
                  <circle cx="28" cy="8" r="5.5" fill="#FBBF24" stroke="#78350F" stroke-width="1"/>
                  <path d="M28 5v4M28 10v1" stroke="#991B1B" stroke-width="1.5" stroke-linecap="round"/>
                `;
              } else {
                // Shape: Group of 3 vehicles
                iconSvg = `
                  <path d="M15 13H11c-.3 0-.5.2-.6.4l-1.4 1.8V18c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-.5h6v.5c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-2.8l-1.4-1.8c-.1-.2-.3-.4-.6-.4zm-4.1.5h4.2l.4 1.2h-5l.4-1.2zm4.1 3c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm-4 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z" fill="#DC2626" opacity="0.5"/>
                  <path d="M26 13h-4c-.3 0-.5.2-.6.4L20 15.2V18c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-.5h6v.5c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-2.8l-1.4-1.8c-.1-.2-.3-.4-.6-.4zm-4.1.5h4.2l.4 1.2h-5l.4-1.2zm4.1 3c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm-4 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z" fill="#DC2626" opacity="0.5"/>
                  <path d="M22 17.5h-8c-.5 0-.9.3-1.1.7L11.5 20.5V25c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-4.5l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#DC2626"/>
                `;
              }
              // Opacity for non-selected route pins
              if (!isSelected) {
                el.style.opacity = "0.5";
                el.style.pointerEvents = "none";
              } else {
                el.style.opacity = "1";
              }

              el.className = "relative cursor-pointer group";
              el.style.width = "36px";
              el.style.height = "48px";
              el.innerHTML = `
                <div class="relative flex flex-col items-center transform -translate-x-1/2 -translate-y-full hover:scale-110 active:scale-95 transition duration-200" style="filter: drop-shadow(0 4px 10px ${shadowColor});">
                  ${isSevere && isSelected ? '<span class="absolute -bottom-1 w-6 h-6 rounded-full bg-rose-500/40 animate-ping pointer-events-none"></span>' : ''}

                  <!-- Teardrop Pin SVG (36x48) -->
                  <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <!-- Outer Pin Teardrop Shape -->
                    <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 48 18 48C18 48 36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="${pinFill}" stroke="${pinStroke}" stroke-width="1.5"/>
                    <!-- Inner White Emblem Circle -->
                    <circle cx="18" cy="18" r="11.5" fill="#FFFFFF"/>
                    <!-- Severity Icon Glyphs -->
                    ${iconSvg}
                  </svg>

                  <!-- Delay Badge Mini Tag -->
                  <div class="absolute -top-1.5 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-black shadow-md border border-white/40 ${badgeBg}">
                    +${delayM}m
                  </div>
                </div>
              `;

              // Interactive Popup on Click / Hover (only if selected)
              if (isSelected) {
                const popupContent = `
                  <div class="p-2.5 rounded-xl bg-slate-900/95 text-white text-xs space-y-1 shadow-2xl border border-slate-700 min-w-[170px] backdrop-blur-md">
                    <div class="font-extrabold text-xs flex items-center gap-1.5 ${titleColor}">
                      <span>${hotspot.location_name}</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300 font-semibold pt-1 border-t border-slate-800 text-[11px]">
                      <span>Estimated Delay:</span>
                      <span class="font-black text-rose-400">+${delayM} min</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300 text-[11px]">
                      <span>Average Speed:</span>
                      <span class="font-bold text-amber-300">${hotspot.average_speed_kmh} km/h</span>
                    </div>
                    <div class="text-[10px] text-slate-400 font-medium pt-0.5">
                      ${hotspot.description || hotspot.cause || "Traffic congestion bottleneck"}
                    </div>
                  </div>
                `;

                const popup = new maplibregl.Popup({
                  offset: [0, -42],
                  closeButton: false,
                  className: "custom-hotspot-popup",
                }).setHTML(popupContent);

                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .setPopup(popup)
                  .addTo(map);

                hotspotMarkersRef.current.push(marker);
              } else {
                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .addTo(map);
                hotspotMarkersRef.current.push(marker);
              }
            });
          }
        } else {
          // Fallback if no segments data (should not happen, but safe)
          const sourceId = `route-source-${idx}`;
          const casingLayerId = `route-casing-${idx}`;
          const lineLayerId = `route-line-${idx}`;

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { routeIndex: idx },
              geometry: route.geometry as any,
            },
          });
          renderedSourcesRef.current.push(sourceId);

          map.addLayer({
            id: casingLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": isSelected ? "#0F172A" : "#1E293B",
              "line-width": isSelected ? 12 : 8,
              "line-opacity": isSelected ? 0.45 : 0.2,
            },
          });
          renderedLayersRef.current.push(casingLayerId);

          map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": isSelected ? (isEmergencyMode ? "#EF4444" : "#3B82F6") : "#64748B",
              "line-width": isSelected ? 7 : 5,
              "line-opacity": isSelected ? 1.0 : 0.65,
            },
          });
          renderedLayersRef.current.push(lineLayerId);

          if (!isSelected) {
            const clickListener = () => {
              if (!isNavigating) {
                setActiveRouteIndex(idx);
              }
            };
            map.on("click", lineLayerId, clickListener);
            renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
          }
        }
      });

      // Render Ghost Reroute Line if active (Features 8 & 9)
      if (activeRerouteRecommendation?.recommended_route?.geometry) {
        const rerouteSourceId = "ghost-reroute-source";
        const rerouteLineId = "ghost-reroute-line";

        map.addSource(rerouteSourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: activeRerouteRecommendation.recommended_route.geometry as any,
          },
        });
        renderedSourcesRef.current.push(rerouteSourceId);

        map.addLayer({
          id: rerouteLineId,
          type: "line",
          source: rerouteSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#10B981",
            "line-width": 6,
            "line-dasharray": [2, 2],
            "line-opacity": 0.9,
          },
        });
        renderedLayersRef.current.push(rerouteLineId);
      }

      // Auto-fit bounds when not actively driving
      if (!isNavigating) {
        const bounds = new maplibregl.LngLatBounds();
        let hasPoints = false;
        routes.forEach((r) => {
          if (r.geometry && r.geometry.coordinates) {
            r.geometry.coordinates.forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
              hasPoints = true;
            });
          }
        });

        if (hasPoints) {
          map.fitBounds(bounds, {
            padding: { top: 100, bottom: 180, left: 100, right: 100 },
            maxZoom: 15,
            duration: 800,
          });
        }
      }
    };

    if (map.isStyleLoaded()) {
      renderPolylines();
    } else {
      map.once("load", renderPolylines);
    }
  }, [
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    activeLayerMode,
    isEmergencyMode,
    isNavigating,
    activeRerouteRecommendation,
  ]);

  // Recenter trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterTrigger === 0) return;

    if (currentLocation) {
      map.flyTo({
        center: [currentLocation.lon, currentLocation.lat],
        zoom: 15,
        duration: 1200,
      });
    } else if (selectedDestination) {
      map.flyTo({
        center: [selectedDestination.lon, selectedDestination.lat],
        zoom: 14,
        duration: 1200,
      });
    } else {
      map.flyTo({
        center: [BENGALURU_CENTER.lon, BENGALURU_CENTER.lat],
        zoom: 12.5,
        duration: 1200,
      });
    }
  }, [recenterTrigger, selectedDestination, currentLocation]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <div
        ref={mapContainerRef}
        className="pointer-events-auto"
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      />
      {pinDropMode !== "none" && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-blue-500/50 backdrop-blur-md animate-pulse">
          <p className="text-sm font-bold tracking-wide text-center">
            Tap the map to set your <span className="text-blue-400">{pinDropMode === "source" ? "starting" : "destination"}</span> point
          </p>
        </div>
      )}
    </div>
  );
};

```

### frontend/src/components/ui/AdvanceAlertBanner.tsx
```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Gauge, Clock, X, Volume2, ShieldAlert } from "lucide-react";
import { ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService } from "@/lib/ttsService";

interface AdvanceAlertBannerProps {
  alert: ActiveCongestionAlert | null;
  onDismiss: () => void;
  onCheckReroute?: () => void;
  fasterRouteAvailable?: boolean;
}

export const AdvanceAlertBanner: React.FC<AdvanceAlertBannerProps> = ({
  alert,
  onDismiss,
  onCheckReroute,
  fasterRouteAvailable = false,
}) => {
  if (!alert) return null;

  const isSevere = alert.congestionLevel === "SEVERE";
  const isHeavy = alert.congestionLevel === "HEAVY";

  const handleSpeak = () => {
    TTSService.speakCongestionAlert(
      alert.locationName,
      alert.distanceText,
      alert.averageSpeedKmh,
      alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 w-[92vw] max-w-xl pointer-events-auto"
      >
        <div
          className={`relative rounded-2xl p-4 shadow-2xl backdrop-blur-xl border flex flex-col gap-3 text-white overflow-hidden transition-all ${
            isSevere
              ? "bg-gradient-to-r from-red-950/95 via-rose-900/95 to-slate-900/95 border-rose-500/80 shadow-[0_0_35px_rgba(225,29,72,0.45)] ring-2 ring-rose-500/50"
              : isHeavy
              ? "bg-gradient-to-r from-red-900/95 via-orange-950/95 to-slate-900/95 border-red-500/70 shadow-[0_0_30px_rgba(239,68,68,0.35)]"
              : "bg-gradient-to-r from-amber-950/95 via-orange-900/95 to-slate-900/95 border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.3)]"
          }`}
        >
          {/* Pulsing Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-rose-500 to-red-600 animate-pulse" />

          {/* Top Row: Severity Tag & Countdown */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md animate-bounce ${
                  isSevere ? "bg-rose-600 text-white" : "bg-amber-500 text-slate-950"
                }`}
              >
                {isSevere ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-extrabold tracking-wider uppercase opacity-90">
                  {alert.stage === 3
                    ? "🚨 Imminent Congestion Ahead"
                    : alert.stage === 2
                    ? "⚠️ Approaching Bottleneck"
                    : "ℹ️ Proactive Advance Warning"}
                </span>
                <h4 className="text-base font-black tracking-tight text-white line-clamp-1">
                  {alert.locationName}
                </h4>
              </div>
            </div>

            {/* Distance Countdown Pill */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center gap-1.5 shadow-inner">
                <span className="text-xs font-bold text-slate-300">In</span>
                <span className="text-sm font-black text-amber-300">{alert.distanceText}</span>
              </div>

              <button
                onClick={onDismiss}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Middle Row: Speed & Delay Telemetry */}
          <div className="grid grid-cols-2 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-rose-400" />
              <span className="text-slate-300 font-medium">Flow Speed:</span>
              <span className="font-bold text-white">
                {Math.round(alert.averageSpeedKmh)} km/h
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-medium">Est. Delay:</span>
              <span className="font-bold text-amber-300">
                +{Math.max(1, Math.round((alert.estimatedDelaySeconds || 120) / 60))} min
              </span>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              onClick={handleSpeak}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5 transition text-slate-200"
            >
              <Volume2 className="w-3.5 h-3.5" /> Read Aloud
            </button>

            {onCheckReroute && fasterRouteAvailable && (
              <button
                onClick={onCheckReroute}
                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs font-extrabold text-white shadow-lg transition flex items-center gap-1.5 active:scale-95"
              >
                Find a faster route
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

```

### frontend/src/components/ui/FloatingSearchPanel.tsx
```tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, ArrowUpDown, Loader2, MousePointerClick, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { searchPlaces, PlaceSearchResult } from "@/lib/api";

export const FloatingSearchPanel: React.FC = () => {
  const {
    sourceQuery,
    setSourceQuery,
    destinationQuery,
    setDestinationQuery,
    searchResults,
    setSearchResults,
    selectedOrigin,
    setSelectedOrigin,
    selectedDestination,
    setSelectedDestination,
    calculateRoutes,
    swapSourceAndDestination,
    pinDropMode,
    setPinDropMode,
    isEmergencyMode,
    toggleEmergencyMode,
  } = useNavigation();

  const [activeInput, setActiveInput] = useState<"source" | "destination" | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search trigger for active input field
  useEffect(() => {
    const currentQuery = activeInput === "source" ? sourceQuery : activeInput === "destination" ? destinationQuery : "";
    const trimmed = currentQuery.trim();

    if (trimmed.length < 3) {
      setSearchResults([]);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(trimmed);
        setSearchResults(results);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [sourceQuery, destinationQuery, activeInput, setSearchResults]);

  // Click outside hook
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveInput(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlace = async (place: PlaceSearchResult) => {
    const coord = {
      lat: place.lat,
      lon: place.lon,
      name: place.display_name.split(",")[0],
    };

    if (activeInput === "source") {
      setSelectedOrigin(coord);
      setSourceQuery(coord.name);
      if (selectedDestination) {
        await calculateRoutes(coord, selectedDestination);
      }
    } else if (activeInput === "destination") {
      setSelectedDestination(coord);
      setDestinationQuery(coord.name);
      if (selectedOrigin) {
        await calculateRoutes(selectedOrigin, coord);
      }
    }

    setSearchResults([]);
    setActiveInput(null);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetIdx = selectedIndex >= 0 ? selectedIndex : 0;
      if (searchResults[targetIdx]) {
        handleSelectPlace(searchResults[targetIdx]);
      }
    } else if (e.key === "Escape") {
      setActiveInput(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative pointer-events-auto shrink-0">
      <div
        className={`glass-panel rounded-2xl p-3 shadow-2xl transition-all duration-300 space-y-2 border ${
          isEmergencyMode
            ? "border-rose-500/90 shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50 bg-rose-950/10"
            : "border-slate-200/80"
        }`}
      >
        {/* Emergency Mode Toggle Banner */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isEmergencyMode ? "bg-rose-500 animate-ping" : "bg-slate-300"
              }`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isEmergencyMode ? "text-rose-700 dark:text-rose-400" : "text-slate-500"
              }`}
            >
              <Siren className={`w-3.5 h-3.5 ${isEmergencyMode ? "text-rose-600 animate-pulse" : "text-slate-400"}`} />
              Emergency / Ambulance Mode
            </span>
          </div>

          <button
            onClick={toggleEmergencyMode}
            type="button"
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isEmergencyMode ? "bg-rose-600 shadow-sm shadow-rose-500/50" : "bg-slate-300"
            }`}
            role="switch"
            aria-checked={isEmergencyMode}
            title="Toggle Emergency / Ambulance Priority Mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEmergencyMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Source Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm shrink-0 ml-1" />
          <input
            type="text"
            value={sourceQuery}
            onChange={(e) => setSourceQuery(e.target.value)}
            onFocus={() => setActiveInput("source")}
            onKeyDown={handleKeyDown}
            placeholder="Choose starting point or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "source" && isSearching && (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          )}
          {sourceQuery && (
            <button
              onClick={() => {
                setSourceQuery("");
                setSelectedOrigin(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Swap & Pin Drop Action Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-2">
            <button
              onClick={() => setPinDropMode(pinDropMode === "source" ? "none" : "source")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "source"
                  ? "bg-emerald-600 text-white shadow-sm animate-pulse"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "source" ? "Click Map to Set Start" : "Drop Start Pin"}</span>
            </button>

            <button
              onClick={() => setPinDropMode(pinDropMode === "destination" ? "none" : "destination")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "destination"
                  ? "bg-rose-600 text-white shadow-sm animate-pulse"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "destination" ? "Click Map to Set Dest" : "Drop Dest Pin"}</span>
            </button>
          </div>

          <button
            onClick={swapSourceAndDestination}
            title="Swap Source and Destination"
            className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition shadow-sm"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <MapPin className="w-4 h-4 text-rose-600 shrink-0 ml-1" />
          <input
            type="text"
            value={destinationQuery}
            onChange={(e) => setDestinationQuery(e.target.value)}
            onFocus={() => setActiveInput("destination")}
            onKeyDown={handleKeyDown}
            placeholder="Choose destination or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "destination" && isSearching && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          )}
          {destinationQuery && (
            <button
              onClick={() => {
                setDestinationQuery("");
                setSelectedDestination(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {activeInput && searchResults.length > 0 && (
        <div className="absolute top-full mt-2 w-full glass-panel rounded-2xl shadow-2xl overflow-hidden z-30 border border-slate-200/80 max-h-80 overflow-y-auto">
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPlace(item)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-100 last:border-0 transition ${
                idx === selectedIndex ? "bg-blue-100/80 text-blue-900 font-semibold" : "hover:bg-blue-50/70"
              }`}
            >
              <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {item.display_name.split(",")[0]}
                </p>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {item.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

```

### frontend/src/components/ui/MapControls.tsx
```tsx
"use client";

import React, { useState } from "react";
import { Plus, Minus, Target, Layers, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { mapRefContainer } from "@/components/map/MapCanvas";

export const MapControls: React.FC = () => {
  const {
    triggerRecenter,
    activeLayerMode,
    toggleLayerMode,
    currentZoom,
    isEmergencyMode,
    toggleEmergencyMode,
  } = useNavigation();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleZoomIn = () => {
    if (mapRefContainer.current && currentZoom < 18) {
      mapRefContainer.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRefContainer.current && currentZoom > 10) {
      mapRefContainer.current.zoomOut();
    }
  };

  const handleLayerToggle = () => {
    toggleLayerMode();
    let msg = "Showing All Routes";
    if (activeLayerMode === "ALL") msg = "Showing Recommended Route Only";
    else if (activeLayerMode === "AI_ONLY") msg = "Showing Standard Route Only";

    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <>
      {toastMessage && (
        <div className="fixed right-16 bottom-8 z-30 px-3.5 py-2 rounded-xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-fade-in backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      <div className="fixed right-4 bottom-8 z-20 flex flex-col gap-2">
        <div className="glass-panel rounded-full p-1 flex flex-col gap-1 shadow-lg">
          <button
            onClick={handleZoomIn}
            disabled={currentZoom >= 18}
            title={currentZoom >= 18 ? "Maximum zoom reached (18)" : "Zoom In"}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-full h-px bg-slate-200" />
          <button
            onClick={handleZoomOut}
            disabled={currentZoom <= 10}
            title={currentZoom <= 10 ? "Minimum zoom reached (10)" : "Zoom Out"}
            className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={triggerRecenter}
          title="Re-center Viewport"
          className="w-11 h-11 rounded-full glass-panel flex items-center justify-center text-slate-700 hover:text-blue-600 transition shadow-lg hover:scale-105 active:scale-95"
        >
          <Target className="w-5 h-5" />
        </button>

        <button
          onClick={handleLayerToggle}
          title={`Layer View: ${activeLayerMode}`}
          className={`w-11 h-11 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            activeLayerMode === "AI_ONLY"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
              : activeLayerMode === "STANDARD_ONLY"
              ? "bg-slate-700 text-white border-slate-600"
              : "text-slate-700 hover:text-emerald-600"
          }`}
        >
          <Layers className="w-5 h-5" />
        </button>

        <button
          onClick={toggleEmergencyMode}
          title={isEmergencyMode ? "Emergency Mode Active (Ambulance Priority)" : "Enable Emergency / Ambulance Mode"}
          className={`w-11 h-11 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            isEmergencyMode
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-500/30 animate-pulse"
              : "text-slate-700 hover:text-rose-600"
          }`}
        >
          <Siren className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};

```

### frontend/src/components/ui/NavigationControlsHUD.tsx
```tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  FastForward,
  Flame,
  RotateCcw,
  Bell,
  BellRing,
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  XCircle,
  ShieldAlert
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { TTSService } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";

export const NavigationControlsHUD: React.FC = () => {
  const {
    isNavigating,
    setIsNavigating,
    currentVehicleSpeed,
    simProgressPercent,
    isSimPlaying,
    setIsSimPlaying,
    simSpeedMultiplier,
    setSimSpeedMultiplier,
    nextManeuver,
    nextManeuverDistanceM,
    routes,
    activeRouteIndex,
    triggerDynamicRerouteCheck,
    isEmergencyMode,
    currentLocation,
  } = useNavigation();

  const [isVoiceMuted, setIsVoiceMuted] = useState(TTSService.getMuted());
  const [isPushEnabled, setIsPushEnabled] = useState(PushNotificationService.isPermissionGranted());

  if (!isNavigating) return null;

  const handleToggleVoice = () => {
    const newMuted = TTSService.toggleMuted();
    setIsVoiceMuted(newMuted);
    if (!newMuted) {
      TTSService.speak("Voice guidance enabled", 2);
    }
  };

  const handleTogglePush = async () => {
    const granted = await PushNotificationService.requestPermission();
    setIsPushEnabled(granted);
    if (granted) {
      PushNotificationService.sendCongestionAlert("Navigation Demo", "500 m", 4, 15);
    }
  };

  const getManeuverIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="w-6 h-6 text-white" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="w-6 h-6 text-white" />;
    return <ArrowUp className="w-6 h-6 text-white" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[94vw] max-w-2xl pointer-events-auto"
    >
      <div className="rounded-3xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl bg-slate-900/95 border border-slate-700/80 text-white flex flex-col gap-3">
        {/* Top Progress & Maneuver Row */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          {/* Next Maneuver Capsule */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              isEmergencyMode ? "bg-rose-600" : "bg-blue-600"
            }`}>
              {getManeuverIcon(nextManeuver?.modifier)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-amber-300">
                  {nextManeuverDistanceM !== undefined
                    ? nextManeuverDistanceM >= 1000
                      ? `${(nextManeuverDistanceM / 1000).toFixed(1)} km`
                      : `${Math.round(nextManeuverDistanceM)} m`
                    : "500 m"}
                </span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Next Step
                </span>
              </div>
              <p className="text-sm font-bold text-white line-clamp-1">
                {nextManeuver ? getManeuverInstruction(nextManeuver) : "Continue along active corridor"}
              </p>
            </div>
          </div>

          {/* Speedometer Widget */}
          <div className="flex flex-col items-end px-3 py-1.5 rounded-2xl bg-black/40 border border-white/10 shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-400">
                {Math.round(currentVehicleSpeed)}
              </span>
              <span className="text-xs font-extrabold text-slate-400 uppercase">km/h</span>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Speed
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isEmergencyMode ? "bg-rose-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, simProgressPercent))}%` }}
          />
        </div>

        {/* Bottom Interactive Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          {/* Simulation Play / Pause / Multiplier */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setIsSimPlaying(!isSimPlaying)}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition active:scale-95"
              title={isSimPlaying ? "Pause Simulation" : "Play Simulation"}
            >
              {isSimPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => {
                const nextSpeed = simSpeedMultiplier === 1 ? 2 : simSpeedMultiplier === 2 ? 5 : 1;
                setSimSpeedMultiplier(nextSpeed);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black text-amber-300 flex items-center gap-1 transition active:scale-95"
              title="Simulation Speed Multiplier"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{simSpeedMultiplier}x</span>
            </button>
          </div>

          {/* Voice Guidance Toggle */}
          <button
            onClick={handleToggleVoice}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border ${
              !isVoiceMuted
                ? "bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-md"
                : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
            }`}
            title="Voice Alerts / TTS"
          >
            {!isVoiceMuted ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{!isVoiceMuted ? "Voice ON" : "Voice Muted"}</span>
          </button>

          {/* Push Notification Toggle */}
          <button
            onClick={handleTogglePush}
            className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border ${
              isPushEnabled
                ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50"
                : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
            }`}
            title="Push Notifications"
          >
            {isPushEnabled ? <BellRing className="w-4 h-4 text-emerald-400" /> : <Bell className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPushEnabled ? "Push ON" : "Enable Push"}</span>
          </button>



          {/* End Navigation Button */}
          <button
            onClick={() => setIsNavigating(false)}
            className="px-3 py-2 rounded-2xl bg-white/10 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/10"
          >
            <XCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

```

### frontend/src/components/ui/NoFasterRouteToast.tsx
```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";

interface NoFasterRouteToastProps {
  reason: string | null;
  onDismiss: () => void;
}

export const NoFasterRouteToast: React.FC<NoFasterRouteToastProps> = ({ reason, onDismiss }) => {
  if (!reason) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 w-[92vw] max-w-md pointer-events-auto"
      >
        <div className="relative rounded-2xl p-4 shadow-2xl backdrop-blur-xl bg-slate-900/95 border border-slate-700/80 text-white flex items-center justify-between gap-3 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                Optimal Path Active
              </span>
              <p className="text-xs font-semibold text-slate-200 line-clamp-2">
                {reason}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

```

### frontend/src/components/ui/RerouteModal.tsx
```tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ArrowRight, X, Clock, Check, Navigation, AlertCircle } from "lucide-react";
import { RerouteRecommendation } from "@/lib/api";

interface RerouteModalProps {
  recommendation: RerouteRecommendation | null;
  onAccept: (recommendation: RerouteRecommendation) => void;
  onDismiss: () => void;
  isApplying?: boolean;
}

export const RerouteModal: React.FC<RerouteModalProps> = ({
  recommendation,
  onAccept,
  onDismiss,
  isApplying = false,
}) => {
  if (!recommendation || !recommendation.is_reroute_recommended || !recommendation.recommended_route) {
    return null;
  }

  const newRoute = recommendation.recommended_route;
  const originalMin = Math.round(recommendation.original_remaining_seconds / 60);
  const newMin = Math.round(recommendation.recommended_duration_seconds / 60);
  const savedMin = Math.max(1, Math.round(recommendation.time_saved_minutes));
  const newDistKm = (newRoute.distance_meters / 1000).toFixed(1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 w-[94vw] max-w-lg pointer-events-auto"
      >
        <div className="relative rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl bg-slate-900/95 border-2 border-emerald-500/80 text-white overflow-hidden ring-4 ring-emerald-500/20">
          {/* Top Decorative Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-md animate-pulse">
                <Zap className="w-5 h-5 fill-current" />
              </span>
              <div>
                <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                  Faster Option Available
                </span>
                <h3 className="text-lg font-black text-white">Save Time with a New Route</h3>
              </div>
            </div>

            <button
              onClick={onDismiss}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Time Savings Comparison Grid */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/10 mb-3 text-center">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5">
              <span className="text-xs font-medium text-slate-400">Current Path</span>
              <span className="text-base font-extrabold text-slate-300 line-through">
                {originalMin > 0 ? `${originalMin} min` : "Delayed"}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <span className="text-xs font-bold text-emerald-300">New Path</span>
              <span className="text-xl font-black text-emerald-400">{newMin} min</span>
              <span className="text-xs text-slate-400">({newDistKm} km)</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">You Save</span>
              <span className="text-2xl font-black">-{savedMin}m</span>
            </div>
          </div>

          {/* Reroute Reason */}
          <div className="flex items-start gap-2 text-xs text-slate-300 bg-white/5 p-2.5 rounded-xl mb-4 border border-white/5">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {recommendation.reason || "Bypasses upcoming heavy traffic to get you there faster."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs transition active:scale-95"
            >
              Keep Current Route
            </button>

            <button
              disabled={isApplying}
              onClick={() => {
                if (isApplying) return;
                onAccept(recommendation);
              }}
              className="flex-[2] py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isApplying ? "Applying..." : "Switch to Faster Route"}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

```

### frontend/src/components/ui/RouteCard.tsx
```tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Zap,
  Siren,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";

export const RouteCard: React.FC = () => {
  const [showHotspotList, setShowHotspotList] = useState(false);
  const {
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    selectedDestination,
    isNavigating,
    setIsNavigating,
    isLoadingRoutes,
    isEmergencyMode,
  } = useNavigation();

  if (isLoadingRoutes) {
    return (
      <div
        className={`w-full relative pointer-events-auto shrink-0 glass-panel rounded-2xl p-6 flex items-center justify-center gap-3 shadow-2xl ${
          isEmergencyMode ? "border-rose-500/80 shadow-rose-500/20" : ""
        }`}
      >
        <Loader2 className={`w-6 h-6 animate-spin ${isEmergencyMode ? "text-rose-600" : "text-emerald-600"}`} />
        <span className="text-sm font-semibold text-slate-700">
          {isEmergencyMode
            ? "Evaluating Priority Corridors & transit speeds..."
            : "Evaluating real-time traffic factors & ML congestion..."}
        </span>
      </div>
    );
  }

  if (!selectedDestination || routes.length === 0) return null;

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute) return null;

  const durationMin = Math.round(
    (currentRoute.predicted_duration_seconds || currentRoute.duration_seconds) / 60
  );

  const distanceKm = (currentRoute.distance_meters / 1000).toFixed(1);
  const isAIRoute = Boolean(currentRoute.is_ai_recommended);

  // Format user-friendly route label
  let routeLabel = currentRoute.recommendation_label;
  if (!routeLabel) {
    if (isAIRoute) {
      routeLabel = isEmergencyMode ? "Emergency Priority Corridor" : "Recommended Route";
    } else {
      routeLabel = "Standard Route";
    }
  } else if (routeLabel === "OSRM Preferred Route") {
    routeLabel = "Standard Route";
  } else if (routeLabel === "AI Recommended") {
    routeLabel = "Recommended Route";
  }

  const clearKm = currentRoute.clear_distance_km || 0.0;
  const modKm = currentRoute.moderate_distance_km || 0.0;
  const heavyKm = currentRoute.heavy_distance_km || 0.0;
  const severeKm = currentRoute.severe_distance_km || 0.0;
  const totalDelayMin = Math.max(0, Math.round((currentRoute.total_delay_seconds || 0) / 60));
  const hotspots = currentRoute.hotspots || [];

  // Sort hotspots by delay descending to find the primary bottleneck causing the delay
  const sortedHotspots = [...hotspots].sort(
    (a, b) => (b.estimated_delay_seconds || 0) - (a.estimated_delay_seconds || 0)
  );
  const worstHotspot = sortedHotspots[0];
  const otherHotspotsCount = sortedHotspots.length - 1;
  const worstHotspotName = worstHotspot
    ? worstHotspot.location_name.replace(/^(Near\s+|Central\s+)/i, "").split(",")[0]
    : "";

  const getMainRoadName = (route: typeof currentRoute) => {
    if (route.steps && route.steps.length > 1) {
      const namedStep = route.steps.find((s) => s.name && s.name.trim() !== "");
      if (namedStep && namedStep.name) return `Via ${namedStep.name}`;
    }
    return "Via Optimal Corridor";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`w-full relative pointer-events-auto flex-1 min-h-0 glass-panel rounded-2xl p-5 shadow-2xl border overflow-y-auto transition-all duration-300 ${
          isEmergencyMode
            ? "border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
            : "border-slate-200/80"
        }`}
      >
        {/* Mode & Corridor Context Alert Header */}
        {isEmergencyMode ? (
          <div
            className={`mb-3 px-3.5 py-2 rounded-xl text-white flex items-center justify-between shadow-md ${
              isAIRoute
                ? "bg-gradient-to-r from-rose-600 to-red-600 ring-1 ring-rose-400/50"
                : "bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <Siren
                className={`w-4 h-4 fill-current ${isAIRoute ? "animate-bounce text-white" : "text-amber-400"}`}
              />
              <span className="text-xs font-black tracking-wider uppercase">
                {isAIRoute ? "Emergency Priority Corridor" : "Standard Alternate Path"}
              </span>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                isAIRoute ? "bg-white/20 text-white" : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {isAIRoute ? "PRIORITY ACCESS" : "RESTRICTED ACCESS"}
            </span>
          </div>
        ) : null}

        {/* Destination Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-md font-bold text-xs flex items-center gap-1 ${
                  isEmergencyMode
                    ? isAIRoute
                      ? "bg-rose-500/15 text-rose-700 border border-rose-500/30 font-extrabold"
                      : "bg-slate-200 text-slate-700 font-semibold"
                    : isAIRoute
                    ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-extrabold"
                    : "bg-blue-500/15 text-blue-700 border border-blue-500/30 font-extrabold"
                }`}
              >
                {isEmergencyMode && isAIRoute ? (
                  <Siren className="w-3 h-3 text-rose-600 fill-current" />
                ) : isAIRoute ? (
                  <Zap className="w-3 h-3 text-emerald-600 fill-current" />
                ) : null}
                {routeLabel}
              </span>
              <span className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Guarded
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
              {selectedDestination.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium">{getMainRoadName(currentRoute)}</p>
          </div>
        </div>

        {/* Primary ETA Display with Location-Tied Delay Chip */}
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <span
            className={`text-3xl font-extrabold tracking-tight ${
              isEmergencyMode
                ? isAIRoute
                  ? "text-rose-600"
                  : "text-slate-700"
                : isAIRoute
                ? "text-emerald-600"
                : "text-blue-600"
            }`}
          >
            {durationMin} min
          </span>
          <span className="text-sm font-semibold text-slate-500">({distanceKm} km)</span>

          {/* Location-tied delay chip: only shown if there is a real hotspot causing delay */}
          {totalDelayMin > 0 && worstHotspot && (
            <button
              type="button"
              onClick={() => otherHotspotsCount > 0 && setShowHotspotList(!showHotspotList)}
              className={`text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/90 shadow-sm flex items-center gap-1 transition ${
                otherHotspotsCount > 0 ? "cursor-pointer active:scale-95" : "cursor-default"
              }`}
              title={otherHotspotsCount > 0 ? "Click to view all congestion spots" : undefined}
            >
              <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                +{totalDelayMin}m delay near {worstHotspotName}
                {otherHotspotsCount > 0 ? ` · +${otherHotspotsCount} more` : ""}
              </span>
              {otherHotspotsCount > 0 && (
                showHotspotList ? (
                  <ChevronUp className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                )
              )}
            </button>
          )}
        </div>

        {/* Expanded Hotspots List (when chip is tapped) */}
        {showHotspotList && sortedHotspots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-black text-rose-900 uppercase tracking-wider px-1">
              <span>Congestion Hotspots On Route</span>
              <span className="text-[11px] font-semibold text-rose-600">{sortedHotspots.length} spots</span>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {sortedHotspots.map((h, hIdx) => {
                const delayM = Math.max(1, Math.round((h.estimated_delay_seconds || 120) / 60));
                return (
                  <div
                    key={hIdx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/90 border border-rose-100 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800 line-clamp-1">{h.location_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {h.average_speed_kmh} km/h avg speed
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded shadow-xs shrink-0">
                      +{delayM}m
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Traffic Breakdown Bar */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-600" /> Traffic on This Route
            </span>
            <span>Live Flow</span>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200">
            {clearKm > 0 && (
              <div
                className={`${isAIRoute ? "bg-emerald-500" : "bg-blue-500"} h-full`}
                style={{ width: `${(clearKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Clear: ${clearKm} km`}
              />
            )}
            {modKm > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${(modKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Moderate: ${modKm} km`}
              />
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <div
                className="bg-rose-600 h-full"
                style={{ width: `${((heavyKm + severeKm) / parseFloat(distanceKm)) * 100}%` }}
                title={`Heavy/Severe: ${heavyKm + severeKm} km`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500 flex-wrap gap-1">
            <span className={`${isAIRoute ? "text-emerald-700" : "text-blue-700"} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAIRoute ? "bg-emerald-500" : "bg-blue-500"}`} /> {clearKm} km clear
            </span>
            {modKm > 0 && (
              <span className="text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {modKm} km slowed
              </span>
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <span className="text-rose-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" /> {heavyKm + severeKm} km heavy
              </span>
            )}
          </div>
        </div>

        {/* Candidate Routes Comparison */}
        {routes.length > 1 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Other Route Options
            </p>
            <div className="grid grid-cols-1 gap-2">
              {routes.map((r, idx) => {
                const dur = Math.round((r.predicted_duration_seconds || r.duration_seconds) / 60);
                const dist = (r.distance_meters / 1000).toFixed(1);
                const isSelected = idx === activeRouteIndex;
                const isAI = Boolean(r.is_ai_recommended);
                let labelText = r.recommendation_label;
                if (!labelText) {
                  if (isAI) {
                    labelText = isEmergencyMode ? "Emergency Priority" : "Recommended Route";
                  } else {
                    labelText = "Standard Route";
                  }
                } else if (labelText === "OSRM Preferred Route") {
                  labelText = "Standard Route";
                } else if (labelText === "AI Recommended") {
                  labelText = "Recommended Route";
                }
                const roadName = getMainRoadName(r);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isNavigating) {
                        setActiveRouteIndex(idx);
                        setShowHotspotList(false);
                      }
                    }}
                    disabled={isNavigating && !isSelected}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? isEmergencyMode
                          ? isAI
                            ? "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 shadow-md"
                            : "bg-slate-700 text-white border-slate-700 shadow-md"
                          : isAI
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                          : "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white/80 hover:bg-white text-slate-800 border-slate-200/80 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isSelected
                              ? "text-white"
                              : isEmergencyMode && isAI
                              ? "text-rose-600"
                              : isAI
                              ? "text-emerald-600"
                              : "text-slate-800"
                          }`}
                        >
                          {dur} min
                        </span>
                        <span className={`text-xs ${isSelected ? "text-slate-100" : "text-slate-500"}`}>
                          • {dist} km
                        </span>
                      </div>
                      <p
                        className={`text-xs font-medium line-clamp-1 ${
                          isSelected ? "text-slate-100" : "text-slate-500"
                        }`}
                      >
                        {roadName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : isEmergencyMode && isAI
                            ? "bg-rose-100 text-rose-800"
                            : isAI
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isEmergencyMode && isAI ? (
                          <Siren className="w-3 h-3 fill-current" />
                        ) : isAI ? (
                          <Zap className="w-3 h-3 fill-current" />
                        ) : null}
                        {labelText}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => setIsNavigating(!isNavigating)}
          className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
            isNavigating
              ? "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/30"
              : isEmergencyMode
              ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-600/30"
              : isAIRoute
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
          }`}
        >
          {isEmergencyMode ? <Siren className="w-4 h-4" /> : <Navigation className="w-4 h-4 fill-current" />}
          <span>
            {isNavigating
              ? "End Active Navigation"
              : isEmergencyMode
              ? "Start Priority Navigation"
              : "Start Smart Navigation"}
          </span>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

```

### frontend/src/components/ui/TrafficLegend.tsx
```tsx
"use client";

import React, { useState } from "react";
import { Info, ChevronRight, Activity } from "lucide-react";

export const TrafficLegend: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-4 z-20 pointer-events-auto">
      <div
        className={`glass-panel rounded-2xl shadow-xl border border-slate-200/80 transition-all duration-300 ${
          isExpanded ? "p-3.5 w-64" : "p-2 cursor-pointer"
        }`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        {!isExpanded ? (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 select-none">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Live Traffic</span>
            <div className="flex items-center gap-1 ml-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Traffic on This Route</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="text-slate-400 hover:text-slate-700 text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Clear Flow</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">≥ 80% freeflow</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Slowed Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">50 - 80% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Heavy Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">25 - 50% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-900 shadow-sm" />
                  <span className="font-bold text-slate-700">Stopped / Barely Moving</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">&lt; 25% speed</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 pt-1 border-t border-slate-100 italic">
              ML dynamically forecasts downstream delays before arrival.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

```

### frontend/src/components/ui/TurnByTurnDrawer.tsx
```tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, CornerUpRight, CornerUpLeft, ArrowUp, Navigation, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";

export const TurnByTurnDrawer: React.FC = () => {
  const { routes, activeRouteIndex, isNavigating, isEmergencyMode } = useNavigation();
  const [isOpen, setIsOpen] = useState(false);

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute || !currentRoute.steps || currentRoute.steps.length === 0) return null;

  const getStepIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="w-4 h-4 text-blue-600" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="w-4 h-4 text-blue-600" />;
    return <ArrowUp className={`w-4 h-4 ${isEmergencyMode ? "text-rose-600" : "text-emerald-600"}`} />;
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={`w-full relative pointer-events-auto shrink-0 glass-panel rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
        isEmergencyMode
          ? "border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
          : isNavigating
          ? "border-2 border-blue-500/80"
          : ""
      }`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isEmergencyMode ? "bg-rose-600/15 text-rose-600" : "bg-blue-600/10 text-blue-600"
          }`}>
            {isEmergencyMode ? <Siren className="w-4 h-4 fill-current animate-pulse" /> : <Navigation className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>{isEmergencyMode ? "Emergency Transit" : "Directions"}</span>
              <span>({currentRoute.steps.length} steps)</span>
            </h4>
            <p className="text-sm text-slate-700 font-semibold line-clamp-1">
              {getManeuverInstruction(currentRoute.steps[0])}
            </p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-600">
          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-slate-200/80 max-h-60 overflow-y-auto space-y-3">
          {currentRoute.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3 text-xs">
              <div className="mt-0.5 shrink-0">
                {getStepIcon(step.maneuver?.modifier)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">
                  {getManeuverInstruction(step)}
                </p>
                {step.distance && (
                  <p className="text-slate-500 text-xs">
                    {(step.distance / 1000).toFixed(2)} km
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

```

### frontend/src/context/NavigationContext.tsx
```tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  PlaceSearchResult,
  CandidateRoute,
  checkHealth,
  fetchRoutes,
  RerouteRecommendation,
} from "@/lib/api";
import { AlertManager, ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService, SpeechPriority } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { RerouteEngine } from "@/lib/rerouteEngine";
import { getManeuverInstruction, getManeuverAnnouncement } from "@/lib/maneuverInstructions";

export interface Coordinate {
  lat: number;
  lon: number;
  name?: string;
}

export type PinDropMode = "none" | "source" | "destination";
export type LayerMode = "ALL" | "AI_ONLY" | "STANDARD_ONLY";

export function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateBearingAngle(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function projectPointOntoRoute(point: Coordinate, route: CandidateRoute): { projectedPoint: Coordinate; distanceAlongRouteMeters: number; distanceToRouteMeters: number; segmentIndex: number } {
  let minDistance = Infinity;
  let bestProj: Coordinate = point;
  let bestDistAlong = 0;
  let bestSegmentIdx = 0;

  const coords = route.geometry.coordinates;
  if (!coords || coords.length < 2) return { projectedPoint: point, distanceAlongRouteMeters: 0, distanceToRouteMeters: 0, segmentIndex: 0 };

  let currentRouteDist = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const lon1 = coords[i][0];
    const lat1 = coords[i][1];
    const lon2 = coords[i + 1][0];
    const lat2 = coords[i + 1][1];

    const segLen = haversineMeters(lon1, lat1, lon2, lat2);

    // Project point onto segment (lat1,lon1)-(lat2,lon2) using flat approximation
    // dlat/dlon in degrees - scale lon by cos(lat) to make Euclidean distance proportional to meters
    const cosLat = Math.cos((lat1 * Math.PI) / 180);
    const dx = (lon2 - lon1) * cosLat;
    const dy = lat2 - lat1;
    const px = (point.lon - lon1) * cosLat;
    const py = point.lat - lat1;
    
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq !== 0) {
      t = (px * dx + py * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projLon = lon1 + (lon2 - lon1) * t;
    const projLat = lat1 + (lat2 - lat1) * t;

    const distToProj = haversineMeters(point.lon, point.lat, projLon, projLat);

    if (distToProj < minDistance) {
      minDistance = distToProj;
      bestProj = { lon: projLon, lat: projLat };
      bestDistAlong = currentRouteDist + (segLen * t);
      bestSegmentIdx = i;
    }

    currentRouteDist += segLen;
  }

  return { projectedPoint: bestProj, distanceAlongRouteMeters: bestDistAlong, distanceToRouteMeters: minDistance, segmentIndex: bestSegmentIdx };
}

interface NavigationContextType {
  sourceQuery: string;
  setSourceQuery: (q: string) => void;
  destinationQuery: string;
  setDestinationQuery: (q: string) => void;
  searchResults: PlaceSearchResult[];
  setSearchResults: (results: PlaceSearchResult[]) => void;
  selectedOrigin: Coordinate | null;
  setSelectedOrigin: (coord: Coordinate | null) => void;
  selectedDestination: Coordinate | null;
  setSelectedDestination: (coord: Coordinate | null) => void;
  routes: CandidateRoute[];
  setRoutes: (routes: CandidateRoute[]) => void;
  activeRouteIndex: number;
  setActiveRouteIndex: (idx: number) => void;
  isNavigating: boolean;
  setIsNavigating: (nav: boolean) => void;
  backendOnline: boolean | null;
  activeLayerMode: LayerMode;
  setActiveLayerMode: (mode: LayerMode) => void;
  toggleLayerMode: () => void;
  recenterTrigger: number;
  triggerRecenter: () => void;
  isLoadingRoutes: boolean;
  setIsLoadingRoutes: (loading: boolean) => void;
  currentZoom: number;
  setCurrentZoom: (zoom: number) => void;
  pinDropMode: PinDropMode;
  setPinDropMode: (mode: PinDropMode) => void;
  isEmergencyMode: boolean;
  setIsEmergencyMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleEmergencyMode: () => void;
  swapSourceAndDestination: () => void;
  calculateRoutes: (origin?: Coordinate | null, dest?: Coordinate | null, emergencyOverride?: boolean) => Promise<void>;

  // Real-Time Navigation & Congestion States
  currentLocation: Coordinate | null;
  vehicleBearing: number;
  currentVehicleSpeed: number;
  simProgressPercent: number;
  isSimPlaying: boolean;
  setIsSimPlaying: (playing: boolean) => void;
  simSpeedMultiplier: number;
  setSimSpeedMultiplier: (mult: number) => void;
  activeAlert: ActiveCongestionAlert | null;
  dismissAlert: () => void;
  activeRerouteRecommendation: RerouteRecommendation | null;
  dismissReroute: () => void;
  acceptReroute: (recommendation: RerouteRecommendation) => void;
  triggerDynamicRerouteCheck: (force?: boolean) => Promise<void>;
  isApplyingReroute: boolean;

  nextManeuver: any;
  nextManeuverDistanceM: number;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const BENGALURU_CENTER: Coordinate = {
  lat: 12.9716,
  lon: 77.5946,
  name: "Bengaluru Center",
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sourceQuery, setSourceQuery] = useState("MG Road, Bengaluru");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Coordinate | null>({
    lat: 12.9756,
    lon: 77.6066,
    name: "MG Road, Bengaluru",
  });
  const [selectedDestination, setSelectedDestination] = useState<Coordinate | null>(null);
  const [routes, setRoutes] = useState<CandidateRoute[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("ALL");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12.5);
  const [pinDropMode, setPinDropMode] = useState<PinDropMode>("none");
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);

  // Real-Time Simulation & Navigation Telemetry
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [vehicleBearing, setVehicleBearing] = useState<number>(0);
  const [currentVehicleSpeed, setCurrentVehicleSpeed] = useState<number>(45.0);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [activeAlert, setActiveAlert] = useState<ActiveCongestionAlert | null>(null);
  const [activeRerouteRecommendation, setActiveRerouteRecommendation] = useState<RerouteRecommendation | null>(null);

  const [nextManeuver, setNextManeuver] = useState<any>(null);
  const [nextManeuverDistanceM, setNextManeuverDistanceM] = useState<number>(500);

  // Continuous Interpolation Distance and Animation References
  const simDistanceTraversedRef = useRef<number>(0);
  const currentBearingRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastAlertCheckDistanceRef = useRef<number>(-999);
  const lastAutoRerouteCheckTimeRef = useRef<number>(0);
  const spokenManeuverTiersRef = useRef<Map<number, Set<string>>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);
  const lastRerouteInteractionTimeRef = useRef<number>(0);
  const isTransitioningRouteRef = useRef<boolean>(false);
  const rerouteRequestIdRef = useRef<number>(0);
  const [isApplyingReroute, setIsApplyingReroute] = useState(false);
  
  const activeRouteRef = useRef<CandidateRoute | null>(null);
  useEffect(() => {
    activeRouteRef.current = routes[activeRouteIndex] || null;
  }, [routes, activeRouteIndex]);

  // Subscribe to AlertManager and RerouteEngine
  useEffect(() => {
    const unsubAlert = AlertManager.subscribe((alert) => {
      setActiveAlert(alert);
    });
    const unsubReroute = RerouteEngine.subscribe((rec) => {
      if (!rec || !rec.is_reroute_recommended || !rec.recommended_route) {
        setActiveRerouteRecommendation(null);
        return;
      }
      
      const now = Date.now();
      if (now - lastRerouteInteractionTimeRef.current < 30000) {
        // Cooldown active, ignore new recommendations
        return;
      }

      // Check if genuinely different
      const currentRoute = activeRouteRef.current;
      if (currentRoute) {
        // simple heuristic: if total distance is within 5% and bearing/steps are similar
        const distDiff = Math.abs(currentRoute.distance_meters - rec.recommended_route.distance_meters);
        if (distDiff < currentRoute.distance_meters * 0.05) {
          // Likely the same route, just advanced slightly
          return;
        }
      }

      setActiveRerouteRecommendation(rec);
    });
    return () => {
      unsubAlert();
      unsubReroute();
    };
  }, []);

  const toggleLayerMode = () => {
    setActiveLayerMode((prev) => {
      if (prev === "ALL") return "AI_ONLY";
      if (prev === "AI_ONLY") return "STANDARD_ONLY";
      return "ALL";
    });
  };

  const triggerRecenter = () => setRecenterTrigger((prev) => prev + 1);

  const calculateRoutes = async (
    origin?: Coordinate | null,
    dest?: Coordinate | null,
    emergencyOverride?: boolean
  ) => {
    const originCoord = origin || selectedOrigin;
    const destCoord = dest || selectedDestination;
    if (!originCoord || !destCoord) return;

    const emergency = emergencyOverride !== undefined ? emergencyOverride : isEmergencyMode;

    setIsLoadingRoutes(true);
    try {
      const response = await fetchRoutes(
        originCoord.lat,
        originCoord.lon,
        destCoord.lat,
        destCoord.lon,
        emergency
      );
      if (response.success && response.candidates.length > 0) {
        setRoutes(response.candidates);
        setActiveRouteIndex(0);
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        spokenManeuverTiersRef.current.clear();
        AlertManager.reset();
        RerouteEngine.dismissRecommendation();
      }
    } catch (err) {
      console.error("[NavigationContext] Routing calculation error:", err);
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  const toggleEmergencyMode = () => {
    const newEmergency = !isEmergencyMode;
    setIsEmergencyMode(newEmergency);
    if (selectedOrigin && selectedDestination) {
      calculateRoutes(selectedOrigin, selectedDestination, newEmergency);
    }
  };

  const swapSourceAndDestination = async () => {
    const oldOrigin = selectedOrigin;
    const oldDest = selectedDestination;
    const oldSrcQuery = sourceQuery;
    const oldDestQuery = destinationQuery;

    setSelectedOrigin(oldDest);
    setSelectedDestination(oldOrigin);
    setSourceQuery(oldDestQuery);
    setDestinationQuery(oldSrcQuery);

    if (oldDest && oldOrigin) {
      await calculateRoutes(oldDest, oldOrigin);
    }
  };

  const dismissAlert = () => {
    AlertManager.dismissCurrentAlert();
  };

  const dismissReroute = () => {
    lastRerouteInteractionTimeRef.current = Date.now();
    setActiveRerouteRecommendation(null);
    RerouteEngine.dismissRecommendation();
  };

  const activateRoute = (newRoute: CandidateRoute, preservePosition: boolean = false) => {
    if (isTransitioningRouteRef.current) return;
    if (!newRoute || !newRoute.geometry?.coordinates) return;

    // REROUTE STATE VERSIONING: Generate an activation ID
    const activationId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    
    isTransitioningRouteRef.current = true;

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const firstCoord = newRoute.geometry.coordinates[0];
    const lastCoord = newRoute.geometry.coordinates[newRoute.geometry.coordinates.length - 1];
    const totalRouteDistance = newRoute.distance_meters || 0;
    const distToDest = selectedDestination && currentLocation ? haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat) : 0;
    
    let proj: ReturnType<typeof projectPointOntoRoute> | null = null;
    let fallbackToStart = false;

    if (preservePosition && currentLocation) {
      proj = projectPointOntoRoute(currentLocation, newRoute);
      
      // VERIFY activateRoute safety
      const isImplausiblyFar = proj.distanceToRouteMeters > 500; // 500m off-route is implausible
      const isProjectedNearEndWhileNotActuallyNearDest = 
        (totalRouteDistance - proj.distanceAlongRouteMeters < 50) && (distToDest > 100);

      if (isImplausiblyFar || isProjectedNearEndWhileNotActuallyNearDest) {
        console.warn(`[NavigationContext] Reroute projection rejected. distanceToRouteMeters: ${proj.distanceToRouteMeters}m, projectedDist: ${proj.distanceAlongRouteMeters}m, totalRouteDist: ${totalRouteDistance}m, distToDest: ${distToDest}m`);
        fallbackToStart = true;
      } else {
        simDistanceTraversedRef.current = proj.distanceAlongRouteMeters;
        // IMPORTANT: Do not teleport the vehicle to the projected point (proj.projectedPoint).
        // Let the simulation loop smoothly interpolate from the physical currentLocation.
      }
    } else {
      fallbackToStart = true;
    }

    if (fallbackToStart) {
      simDistanceTraversedRef.current = 0;
      if (newRoute.geometry?.coordinates?.length > 0) {
        setCurrentLocation({ lon: firstCoord[0], lat: firstCoord[1] });
      }
    }

    // PART 1 & 2 - DETERMINISTIC DEBUG CHECK
    if (preservePosition && currentLocation && proj) {
      console.log(`[REROUTE ACTIVATION DEBUG]`, {
        routeId: newRoute.route_id,
        activationId,
        source: newRoute.source || "unknown",
        distance_meters: newRoute.distance_meters,
        duration_seconds: newRoute.duration_seconds,
        predicted_duration_seconds: newRoute.predicted_duration_seconds,
        geometryCoordinateCount: newRoute.geometry.coordinates.length,
        firstCoordinate: firstCoord,
        lastCoordinate: lastCoord,
        currentLocationBeforeActivation: { ...currentLocation },
        projectedPoint: proj.projectedPoint,
        projectedDistanceAlongRouteM: proj.distanceAlongRouteMeters,
        distanceToRouteMeters: proj.distanceToRouteMeters,
        currentLocationAfterActivation: fallbackToStart ? { lon: firstCoord[0], lat: firstCoord[1] } : { ...currentLocation },
        distanceCurrentToDestinationM: distToDest,
        totalRouteDistanceM: totalRouteDistance,
        simDistanceTraversedM: simDistanceTraversedRef.current
      });
    }

    lastFrameTimeRef.current = performance.now();
    lastAlertCheckDistanceRef.current = -999;
    lastAutoRerouteCheckTimeRef.current = Date.now();
    spokenManeuverTiersRef.current.clear();
    lastRerouteInteractionTimeRef.current = Date.now();
    
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    TTSService.clearQueue();

    // Make newRoute the active route at index 0
    setRoutes((prev) => [newRoute, ...prev.filter((r) => r.route_id !== newRoute.route_id)]);
    setActiveRouteIndex(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTransitioningRouteRef.current = false;
      });
    });
  };

  const acceptReroute = (recommendation: RerouteRecommendation) => {
    if (!recommendation || !recommendation.recommended_route) return;
    
    setIsApplyingReroute(true);
    TTSService.speak(
      `Reroute accepted. Taking alternative route saving ~${Math.round(recommendation.time_saved_minutes)} minutes.`,
      SpeechPriority.HIGH
    );

    activateRoute(recommendation.recommended_route, true);
    setIsApplyingReroute(false);
  };

  // Sync Simulation Speed with TTS Speech Rate (Section 6)
  useEffect(() => {
    TTSService.setRate(1.05 * Math.min(2.0, 1 + (simSpeedMultiplier - 1) * 0.25));
  }, [simSpeedMultiplier]);

  const triggerDynamicRerouteCheck = useCallback(
    async (force: boolean = false) => {
      const activeRoute = routes[activeRouteIndex];
      if (!activeRoute || !selectedDestination || !currentLocation || !isNavigating) return;

      const currentReqId = ++rerouteRequestIdRef.current;

      // Ensure we are physically on route before fetching a reroute
      const proj = projectPointOntoRoute(currentLocation, activeRoute);
      const distanceFromVehicleToRouteMeters = haversineMeters(currentLocation.lon, currentLocation.lat, proj.projectedPoint.lon, proj.projectedPoint.lat);
      if (distanceFromVehicleToRouteMeters > 500) {
        console.warn("[REROUTE BLOCKED] Current vehicle position is not on active route.");
        return;
      }

      // Check distance to destination
      const distToDest = haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat);
      
      const totalRouteDistance = activeRoute.distance_meters || 1;
      const traversedDist = simDistanceTraversedRef.current;
      const remainingDist = Math.max(0, totalRouteDistance - traversedDist);
      const progressRatio = Math.min(1.0, traversedDist / totalRouteDistance);
      
      // Calculate true remaining ETA instead of passing full route ETA
      const totalSeconds = activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 600;
      const remainingSec = Math.max(0, (1.0 - progressRatio) * totalSeconds);

      try {
        const rec = await RerouteEngine.checkAndReevaluate(
          currentLocation.lat,
          currentLocation.lon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          currentVehicleSpeed,
          isEmergencyMode,
          force
        );
        
        // Ignore stale responses
        if (currentReqId !== rerouteRequestIdRef.current) return;
      } catch (e) {
        console.error("Reroute check error", e);
      }
    },
    [routes, activeRouteIndex, selectedDestination, currentLocation, currentVehicleSpeed, isEmergencyMode]
  );

  const hasInitializedJourneyRef = useRef(false);

  // Active navigation start / stop handling
  useEffect(() => {
    if (isNavigating) {
      if (hasInitializedJourneyRef.current) return; // Do not reset if journey is already running

      const activeRoute = routes[activeRouteIndex];
      if (activeRoute && activeRoute.geometry?.coordinates?.length > 0) {
        const firstCoord = activeRoute.geometry.coordinates[0];
        setCurrentLocation({ lon: firstCoord[0], lat: firstCoord[1] });
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        spokenManeuverTiersRef.current.clear();
        setSimProgressPercent(0);
        setIsSimPlaying(true);
        lastFrameTimeRef.current = performance.now();

        TTSService.speak(
          isEmergencyMode
            ? "Starting Emergency Priority Navigation. Clear corridor mode active."
            : "Starting navigation. Drive safely.",
          SpeechPriority.HIGH
        );
        hasInitializedJourneyRef.current = true;
      }
    } else {
      hasInitializedJourneyRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      AlertManager.reset();
      RerouteEngine.dismissRecommendation();
      RerouteEngine.dismissNoRouteReason();
      setCurrentLocation(null);
    }
  }, [isNavigating, activeRouteIndex, routes, isEmergencyMode]);

  // High-Frequency Smooth Interpolated Driving Simulation Loop (Section 4 & 5)
  useEffect(() => {
    if (!isNavigating || !isSimPlaying) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    const activeRoute = routes[activeRouteIndex];
    if (!activeRoute || !activeRoute.geometry?.coordinates) return;

    const coords = activeRoute.geometry.coordinates as [number, number][];
    const totalPoints = coords.length;
    if (totalPoints < 2) return;

    // Precalculate segment lengths and cumulative distances
    const segmentDistances: number[] = [];
    const cumulativeDistances: number[] = [0];
    let totalRouteDistanceM = 0;

    for (let i = 1; i < totalPoints; i++) {
      const d = haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      segmentDistances.push(d);
      totalRouteDistanceM += d;
      cumulativeDistances.push(totalRouteDistanceM);
    }

    if (totalRouteDistanceM <= 0) return;

    // Initialize bearing from first segment
    if (currentBearingRef.current === 0 && totalPoints >= 2) {
      currentBearingRef.current = calculateBearingAngle(
        coords[0][0],
        coords[0][1],
        coords[1][0],
        coords[1][1]
      );
      setVehicleBearing(currentBearingRef.current);
    }

    lastFrameTimeRef.current = performance.now();

    const animateDrive = (now: number) => {
      if (isTransitioningRouteRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(animateDrive);
        return;
      }
      if (!isNavigating || !isSimPlaying || !activeRoute || !currentLocation) return;
      // Measure distance to route polyline once per route activation
      if (!lastFrameTimeRef.current || (now - lastFrameTimeRef.current < 100 && simDistanceTraversedRef.current === 0)) {
        const { distanceToRouteMeters } = projectPointOntoRoute(currentLocation, activeRoute);
        console.log(`[NavigationContext] initial frame - distance from physical location to route polyline: ${distanceToRouteMeters.toFixed(2)}m`);
      }

      const dtSeconds = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      const currentDist = simDistanceTraversedRef.current;

      // Section 3: Arrival sanity check
      if (currentDist >= totalRouteDistanceM) {
        // Enforce strict arrival: must actually be near destination
        const distToDest = selectedDestination && currentLocation 
          ? haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat)
          : 0;

        const MIN_REASONABLE_ROUTE_DISTANCE = 50; // Guard against 9m phantom routes
        
        if (totalRouteDistanceM < MIN_REASONABLE_ROUTE_DISTANCE && distToDest > 50) {
          console.error(`[NavigationContext] CATASTROPHIC ROUTE ERROR: Route is only ${Math.round(totalRouteDistanceM)}m long, but destination is ${Math.round(distToDest)}m away. ABORTING ARRIVAL.`);
          // We do not arrive. The route is fundamentally broken.
          // Fallback logic could go here, but for now we halt simulation to prevent teleportation.
          setIsSimPlaying(false);
          return;
        }

        if (distToDest <= 50) {
          if (totalRouteDistanceM < 50) {
            console.log("[NavigationContext] Arrived on short route segment:", Math.round(totalRouteDistanceM), "m");
          } else {
            console.log("[NavigationContext] Arrived at destination.");
          }
          setSimProgressPercent(100);
          setIsSimPlaying(false);
          const lastPt = coords[totalPoints - 1];
          setCurrentLocation({ lon: lastPt[0], lat: lastPt[1] });
          TTSService.speak("You have arrived at your destination.", SpeechPriority.CRITICAL);
          return;
        } else {
          // False arrival due to malformed route, do not trigger arrival.
          console.warn(`[NavigationContext] Suppressing false arrival: route end reached but destination is ${Math.round(distToDest)}m away.`);
          // Pause simulation to prevent out-of-bounds error, but do not arrive.
          setIsSimPlaying(false);
          return;
        }
      }

      // Progress ratio (0.0 to 1.0)
      const progressRatio = Math.min(1.0, currentDist / totalRouteDistanceM);

      // Determine current segment speed
      let speedKmh = 40.0;
      if (activeRoute.segments && activeRoute.segments.length > 0) {
        const segIdx = Math.min(
          activeRoute.segments.length - 1,
          Math.floor(progressRatio * activeRoute.segments.length)
        );
        const seg = activeRoute.segments[segIdx];
        if (seg && seg.current_speed_kmh) {
          speedKmh = seg.current_speed_kmh;
        }
      }

      // Simulation advancement: responsive pace scaling (~6x real-time at 1x)
      const simPaceMultiplier = 6.0;
      const speedMs = (speedKmh * 1000) / 3600;
      const deltaDistance = speedMs * simPaceMultiplier * simSpeedMultiplier * dtSeconds;
      const newDist = Math.min(totalRouteDistanceM, currentDist + deltaDistance);
      console.log("[REROUTE-DEBUG]", { event: "animateDrive_tick", dist: simDistanceTraversedRef.current, totalRouteDistanceM });
      simDistanceTraversedRef.current = newDist;

      // Find the segment containing newDist
      let segIndex = 0;
      for (let i = 0; i < segmentDistances.length; i++) {
        if (newDist >= cumulativeDistances[i] && newDist <= cumulativeDistances[i + 1]) {
          segIndex = i;
          break;
        }
        if (i === segmentDistances.length - 1) {
          segIndex = i;
        }
      }

      const p1 = coords[segIndex];
      const p2 = coords[Math.min(totalPoints - 1, segIndex + 1)];
      const segLen = Math.max(0.1, segmentDistances[segIndex] || 1);
      const segOffset = Math.max(0, newDist - cumulativeDistances[segIndex]);
      const t = Math.min(1.0, Math.max(0.0, segOffset / segLen));

      // Interpolate coordinates
      const interpLon = p1[0] + t * (p2[0] - p1[0]);
      const interpLat = p1[1] + t * (p2[1] - p1[1]);
      const newLocation = { lon: interpLon, lat: interpLat };

      // Interpolate Bearing smoothly with shortest angular distance
      const targetBearing = calculateBearingAngle(p1[0], p1[1], p2[0], p2[1]);
      const currBearing = currentBearingRef.current;
      const angleDiff = ((((targetBearing - currBearing) % 360) + 540) % 360) - 180;
      const smoothedBearing = (currBearing + angleDiff * Math.min(1.0, 8.0 * dtSeconds) + 360) % 360;
      currentBearingRef.current = smoothedBearing;

      // Update state
      setCurrentLocation(newLocation);
      setVehicleBearing(smoothedBearing);
      setCurrentVehicleSpeed(Math.round(speedKmh));
      setSimProgressPercent(Math.min(100, Math.round(progressRatio * 100)));

      // Speed-Aware Congestion Alert Evaluation (Throttled per ~80m of progress)
      if (Math.abs(newDist - lastAlertCheckDistanceRef.current) >= 80) {
        lastAlertCheckDistanceRef.current = newDist;
        const hotspots = activeRoute.hotspots || [];

        AlertManager.evaluatePosition(interpLat, interpLon, hotspots, speedKmh, (alert) => {
          TTSService.speakCongestionAlert(
            alert.locationName,
            alert.distanceText,
            alert.averageSpeedKmh,
            alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined
          );

          PushNotificationService.sendCongestionAlert(
            alert.locationName,
            alert.distanceText,
            alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : 3,
            alert.averageSpeedKmh
          );

          // Proactively check for reroute when a new congestion alert stage triggers
          // Only check if no recommendation is already pending
          if (selectedDestination && !RerouteEngine.getActiveRecommendation()) {
            const traversed = simDistanceTraversedRef.current;
            const activeRouteDist = activeRoute.distance_meters || 1;
            const activeRatio = Math.min(1.0, traversed / activeRouteDist);
            const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
            
            RerouteEngine.checkAndReevaluate(
              interpLat,
              interpLon,
              selectedDestination.lat,
              selectedDestination.lon,
              remainingSec,
              speedKmh,
              isEmergencyMode,
              true // Force check on new hotspot alert
            );
          }
        });
      }

      // Step-by-step Turn Maneuver Guidance & Two-Tier Voice Announcements
      if (activeRoute.steps && activeRoute.steps.length > 0) {
        let cumulativeStepDist = 0;
        let currentStepIndex = 0;
        let estDistToTurn = 0;

        for (let i = 0; i < activeRoute.steps.length; i++) {
          const step = activeRoute.steps[i];
          cumulativeStepDist += (step.distance || 0);
          if (cumulativeStepDist > currentDist) {
            currentStepIndex = i;
            estDistToTurn = cumulativeStepDist - currentDist;
            break;
          }
        }

        if (cumulativeStepDist <= currentDist) {
          currentStepIndex = activeRoute.steps.length - 1;
          estDistToTurn = 0;
        }

        const step = activeRoute.steps[currentStepIndex];

        if (step) {
          setNextManeuver(step);
          setNextManeuverDistanceM(Math.round(estDistToTurn));

          const stepTiers = spokenManeuverTiersRef.current.get(currentStepIndex) || new Set<string>();

          const advanceThreshold = 400 * simSpeedMultiplier;
          const imminentThreshold = 150 * simSpeedMultiplier;
          
          const routeId = activeRoute.route_id || `idx-${activeRouteIndex}`;

          // Tier 1: Advance Heads-up
          if (
            estDistToTurn <= advanceThreshold &&
            estDistToTurn > imminentThreshold &&
            !stepTiers.has("advance")
          ) {
            stepTiers.add("advance");
            spokenManeuverTiersRef.current.set(currentStepIndex, stepTiers);
            const announcement = getManeuverAnnouncement(step, estDistToTurn);
            if (announcement) {
              TTSService.speak(announcement, SpeechPriority.CRITICAL, 15, `${routeId}_${currentStepIndex}_advance`);
            }
          }

          // Tier 2: Imminent
          if (estDistToTurn <= imminentThreshold && !stepTiers.has("imminent")) {
            stepTiers.add("imminent");
            spokenManeuverTiersRef.current.set(currentStepIndex, stepTiers);
            let modifier = step.maneuver?.modifier || "ahead";
            const imminentText = `Turn ${modifier}`;
            TTSService.speak(imminentText, SpeechPriority.CRITICAL, 15, `${routeId}_${currentStepIndex}_imminent`);
          }
        }
      }

      // Continuous Automatic Reroute Re-Evaluation (Gated when recommendation is already displayed)
      const nowMs = Date.now();
      if (
        selectedDestination &&
        !RerouteEngine.getActiveRecommendation() &&
        nowMs - lastAutoRerouteCheckTimeRef.current > 7000
      ) {
        lastAutoRerouteCheckTimeRef.current = nowMs;
        const traversed = simDistanceTraversedRef.current;
        const activeRouteDist = activeRoute.distance_meters || 1;
        const activeRatio = Math.min(1.0, traversed / activeRouteDist);
        const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
        
        RerouteEngine.checkAndReevaluate(
          interpLat,
          interpLon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          speedKmh,
          isEmergencyMode,
          false
        );
      }

      animationFrameIdRef.current = requestAnimationFrame(animateDrive);
    };

    animationFrameIdRef.current = requestAnimationFrame(animateDrive);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [
    isNavigating,
    isSimPlaying,
    simSpeedMultiplier,
    routes,
    activeRouteIndex,
    selectedDestination,
    isEmergencyMode,
  ]);

  // Backend Health Polling
  useEffect(() => {
    const pollHealth = async () => {
      try {
        await checkHealth();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    pollHealth();
    const interval = setInterval(pollHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        sourceQuery,
        setSourceQuery,
        destinationQuery,
        setDestinationQuery,
        searchResults,
        setSearchResults,
        selectedOrigin,
        setSelectedOrigin,
        selectedDestination,
        setSelectedDestination,
        routes,
        setRoutes,
        activeRouteIndex,
        setActiveRouteIndex,
        isNavigating,
        setIsNavigating,
        backendOnline,

        activeLayerMode,
        setActiveLayerMode,
        toggleLayerMode,
        recenterTrigger,
        triggerRecenter,
        isLoadingRoutes,
        setIsLoadingRoutes,
        currentZoom,
        setCurrentZoom,
        pinDropMode,
        setPinDropMode,
        isEmergencyMode,
        setIsEmergencyMode,
        toggleEmergencyMode,
        swapSourceAndDestination,
        calculateRoutes,

        // Real-time navigation & congestion states
        currentLocation,
        vehicleBearing,
        isApplyingReroute,
        currentVehicleSpeed,
        simProgressPercent,
        isSimPlaying,
        setIsSimPlaying,
        simSpeedMultiplier,
        setSimSpeedMultiplier,
        activeAlert,
        dismissAlert,
        activeRerouteRecommendation,
        dismissReroute,
        acceptReroute,
        triggerDynamicRerouteCheck,

        nextManeuver,
        nextManeuverDistanceM,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
};

```

### frontend/src/lib/alertManager.ts
```typescript
import { CongestionHotspot } from "./api";

export interface ActiveCongestionAlert {
  hotspotId: string;
  locationName: string;
  distanceMeters: number;
  distanceText: string;
  stage: 1 | 2 | 3;
  congestionLevel: "MODERATE" | "HEAVY" | "SEVERE";
  averageSpeedKmh: number;
  estimatedDelaySeconds: number;
  description: string;
  timestamp: number;
  spoken: boolean;
}

export type AlertListener = (alert: ActiveCongestionAlert | null) => void;

export class AlertManager {
  private static listeners: Set<AlertListener> = new Set();
  private static activeAlert: ActiveCongestionAlert | null = null;
  private static triggeredStages: Map<string, Set<number>> = new Map();

  // Distance Thresholds in meters for proactive alert triggers
  public static readonly STAGE_1_THRESHOLD_M = 1200; // 1.2 km heads-up
  public static readonly STAGE_2_THRESHOLD_M = 500;  // 500 m approaching warning
  public static readonly STAGE_3_THRESHOLD_M = 200;  // 200 m imminent bottleneck

  public static subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    listener(this.activeAlert);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeAlert);
      } catch (err) {
        console.error("AlertManager listener error:", err);
      }
    });
  }

  public static formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }

  public static haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Evaluates user's current GPS position against route congestion hotspots.
   * Dynamically decrements distance (e.g. 1.1 km -> 500 m -> 200 m) and emits proactive alerts.
   * Speed-aware: thresholds adapt based on vehicle speed for journey-aware alerts.
   */
  public static evaluatePosition(
    userLat: number,
    userLon: number,
    hotspots: CongestionHotspot[],
    currentSpeedKmh: number,
    onNewStageAlert?: (alert: ActiveCongestionAlert) => void
  ): ActiveCongestionAlert | null {
    if (!hotspots || hotspots.length === 0) {
      if (this.activeAlert !== null) {
        this.activeAlert = null;
        this.notifyListeners();
      }
      return null;
    }

    // Calculate speed-aware thresholds based on time-to-reach
    // Stage 1: ~90s lookahead, Stage 2: ~40s lookahead, Stage 3: ~15s lookahead
    // Convert time to distance: distance_m = speed_kmh * (time_s / 3600) * 1000
    const safeSpeed = Math.max(5, Math.min(120, currentSpeedKmh)); // clamp to sane range
    const stage1ThresholdM = Math.max(150, Math.min(2500, (safeSpeed * 90) / 3.6)); // floor 150m, ceiling 2.5km
    const stage2ThresholdM = Math.max(100, Math.min(1000, (safeSpeed * 40) / 3.6)); // floor 100m, ceiling 1km
    const stage3ThresholdM = Math.max(50, Math.min(500, (safeSpeed * 15) / 3.6));   // floor 50m, ceiling 500m

    // Find closest upcoming hotspot ahead of user
    let closestHotspot: CongestionHotspot | null = null;
    let minDistance = Infinity;

    for (const hotspot of hotspots) {
      const dist = this.haversineMeters(userLat, userLon, hotspot.lat, hotspot.lon);
      if (dist < minDistance && dist <= stage1ThresholdM + 300) {
        minDistance = dist;
        closestHotspot = hotspot;
      }
    }

    if (!closestHotspot || minDistance > stage1ThresholdM + 100) {
      // User passed the hotspot or no hotspot within range
      if (this.activeAlert !== null) {
        this.activeAlert = null;
        this.notifyListeners();
      }
      return null;
    }

    // Determine Alert Stage based on distance
    let stage: 1 | 2 | 3 = 1;
    if (minDistance <= stage3ThresholdM) {
      stage = 3;
    } else if (minDistance <= stage2ThresholdM) {
      stage = 2;
    } else {
      stage = 1;
    }

    const hotspotStages = this.triggeredStages.get(closestHotspot.hotspot_id) || new Set<number>();
    const isNewStage = !hotspotStages.has(stage);

    if (isNewStage) {
      hotspotStages.add(stage);
      this.triggeredStages.set(closestHotspot.hotspot_id, hotspotStages);
    }

    const alertData: ActiveCongestionAlert = {
      hotspotId: closestHotspot.hotspot_id,
      locationName: closestHotspot.location_name,
      distanceMeters: minDistance,
      distanceText: this.formatDistance(minDistance),
      stage,
      congestionLevel: closestHotspot.congestion_level,
      averageSpeedKmh: closestHotspot.average_speed_kmh,
      estimatedDelaySeconds: closestHotspot.estimated_delay_seconds,
      description: closestHotspot.description,
      timestamp: Date.now(),
      spoken: !isNewStage,
    };

    this.activeAlert = alertData;
    this.notifyListeners();

    if (isNewStage && onNewStageAlert) {
      onNewStageAlert(alertData);
    }

    return alertData;
  }

  public static dismissCurrentAlert() {
    this.activeAlert = null;
    this.notifyListeners();
  }

  public static reset() {
    this.activeAlert = null;
    this.triggeredStages.clear();
    this.notifyListeners();
  }
}

```

### frontend/src/lib/api.ts
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export interface HealthResponse {
  status: string;
  region: string;
  features: string[];
  timestamp: string;
}

export interface PlaceSearchResult {
  display_name: string;
  lat: number;
  lon: number;
  place_id: string;
  address_type: string;
}

export interface CongestionSegment {
  segment_index: number;
  coordinates: number[][];
  distance_meters: number;
  duration_seconds: number;
  freeflow_speed_kmh: number;
  current_speed_kmh: number;
  delay_seconds: number;
  congestion_level: "CLEAR" | "MODERATE" | "HEAVY" | "SEVERE";
  color: string;
  congestion_factor: number;
  density_index: number;
  predicted_arrival_time_min: number;
  road_name?: string;
}

export interface CongestionHotspot {
  hotspot_id: string;
  location_name: string;
  lat: number;
  lon: number;
  distance_from_origin_m: number;
  congestion_level: "MODERATE" | "HEAVY" | "SEVERE";
  average_speed_kmh: number;
  estimated_delay_seconds: number;
  description: string;
  cause: string;
}

export interface CandidateRoute {
  route_id: string;
  source: string;
  original_route_index: number;
  route_index: number;
  distance_meters: number;
  duration_seconds: number;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  steps: Array<{
    maneuver?: {
      instruction?: string;
      type?: string;
      modifier?: string;
      location?: [number, number];
    };
    distance?: number;
    duration?: number;
    name?: string;
  }>;
  is_ai_recommended?: boolean;
  recommendation_label?: string;
  congestion_factor?: number;
  predicted_average_speed_kmh?: number;
  predicted_duration_seconds?: number;
  predicted_duration_minutes?: number;
  standard_duration_seconds?: number;
  standard_duration_minutes?: number;
  delay_savings_minutes?: number;
  confidence?: string;
  
  // Segmented Breakdown & Hotspots (Features 1 & 2)
  segments?: CongestionSegment[];
  hotspots?: CongestionHotspot[];
  clear_distance_km?: number;
  moderate_distance_km?: number;
  heavy_distance_km?: number;
  severe_distance_km?: number;
  total_delay_seconds?: number;
}

export interface RouteResponse {
  success: boolean;
  routes_count: number;
  candidates: CandidateRoute[];
}

export interface TrafficFactorData {
  location_name: string;
  current_speed_kmh: number;
  freeflow_speed_kmh: number;
  density_index: number;
  congestion_level: "CLEAR" | "MODERATE" | "HEAVY" | "SEVERE";
  congestion_factor: number;
  incident_description?: string;
  historical_baseline_speed_kmh: number;
}

export interface RerouteRecommendation {
  is_reroute_recommended: boolean;
  time_saved_seconds: number;
  time_saved_minutes: number;
  original_remaining_seconds: number;
  recommended_duration_seconds: number;
  recommended_route?: CandidateRoute;
  alternative_routes: CandidateRoute[];
  reason: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Backend service offline");
  return res.json();
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search places");
  return res.json();
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ display_name: string; lat: number; lon: number }> {
  const res = await fetch(`${API_BASE_URL}/reverse?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Reverse geocode failed");
  return res.json();
}

export async function fetchRoutes(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  isEmergencyMode: boolean = false
): Promise<RouteResponse> {
  const res = await fetch(`${API_BASE_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_lat: originLat,
      origin_lon: originLon,
      dest_lat: destLat,
      dest_lon: destLon,
      is_emergency_mode: isEmergencyMode,
    }),
  });
  if (!res.ok) throw new Error("Failed to calculate routes");
  return res.json();
}

export async function evaluateReroute(
  currentLat: number,
  currentLon: number,
  destLat: number,
  destLon: number,
  originalRemainingSeconds: number,
  avoidHotspots: Array<{ lat: number; lon: number }> = [],
  isEmergencyMode: boolean = false
): Promise<RerouteRecommendation> {
  const res = await fetch(`${API_BASE_URL}/reroute/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_lat: currentLat,
      current_lon: currentLon,
      dest_lat: destLat,
      dest_lon: destLon,
      original_remaining_duration_seconds: originalRemainingSeconds,
      avoid_hotspots: avoidHotspots,
      is_emergency_mode: isEmergencyMode,
    }),
  });
  if (!res.ok) throw new Error("Failed to evaluate alternative reroutes");
  return res.json();
}

export async function fetchTrafficFactors(lat: number, lon: number): Promise<TrafficFactorData> {
  const res = await fetch(`${API_BASE_URL}/traffic/factors?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Failed to fetch traffic factors");
  return res.json();
}

export async function fetchTrafficHotspots(): Promise<{ success: boolean; count: number; hotspots: any[] }> {
  const res = await fetch(`${API_BASE_URL}/traffic/hotspots`);
  if (!res.ok) throw new Error("Failed to fetch traffic hotspots");
  return res.json();
}



export async function dispatchPushNotification(payload: PushNotificationPayload): Promise<PushNotificationPayload> {
  const res = await fetch(`${API_BASE_URL}/notifications/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to dispatch push notification");
  return res.json();
}

```

### frontend/src/lib/maneuverInstructions.ts
```typescript
/**
 * Maneuver Instruction Builder
 *
 * Converts OSRM's raw maneuver objects (type, modifier, exit) into natural-language
 * turn-by-turn instructions, since OSRM API responses do not include pre-built instruction strings.
 */

export interface OSRMManeuver {
  type?: string;
  modifier?: string;
  exit?: number;
  bearing_after?: number;
  bearing_before?: number;
  location?: [number, number];
  instruction?: string;
}

export interface OSRMStep {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: OSRMManeuver;
  mode?: string;
  geometry?: any;
}

/**
 * Builds a natural-language instruction from an OSRM step's maneuver object and road name.
 */
export function getManeuverInstruction(step: OSRMStep): string {
  const maneuver = step.maneuver;
  const roadName = step.name?.trim() || "";

  if (!maneuver || !maneuver.type) {
    return roadName || "Continue straight ahead";
  }

  const type = maneuver.type.toLowerCase();
  let modifier = maneuver.modifier?.toLowerCase() || "";
  const exit = maneuver.exit;

  // Mathematically verify L/R directions
  if (maneuver.bearing_before !== undefined && maneuver.bearing_after !== undefined) {
    const bBefore = maneuver.bearing_before;
    const bAfter = maneuver.bearing_after;
    let diff = bAfter - bBefore;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    
    // diff < 0 is left, diff > 0 is right
    if (Math.abs(diff) > 10) { // Only override if it's a clear turn
      if (diff < -10 && modifier.includes("right")) {
        modifier = modifier.replace("right", "left");
      } else if (diff > 10 && modifier.includes("left")) {
        modifier = modifier.replace("left", "right");
      }
    }
  }

  // Helper to add road name
  const withRoad = (instruction: string): string => {
    if (roadName && roadName !== "") {
      return `${instruction} onto ${roadName}`;
    }
    return instruction;
  };

  // Departure
  if (type === "depart") {
    if (roadName) {
      return `Head out on ${roadName}`;
    }
    if (modifier.includes("left")) return "Head out turning left";
    if (modifier.includes("right")) return "Head out turning right";
    return "Head out";
  }

  // Arrival
  if (type === "arrive") {
    if (modifier === "left") return "Arrive at your destination on the left";
    if (modifier === "right") return "Arrive at your destination on the right";
    if (modifier === "straight") return "Arrive at your destination ahead";
    return "You have arrived at your destination";
  }

  // Turns
  if (type === "turn") {
    if (modifier === "left") return withRoad("Turn left");
    if (modifier === "right") return withRoad("Turn right");
    if (modifier === "slight left") return withRoad("Bear left");
    if (modifier === "slight right") return withRoad("Bear right");
    if (modifier === "sharp left") return withRoad("Make a sharp left");
    if (modifier === "sharp right") return withRoad("Make a sharp right");
    if (modifier === "uturn") return withRoad("Make a U-turn");
    if (modifier === "straight") return withRoad("Continue straight");
    return withRoad("Turn");
  }

  // Continue on new road name
  if (type === "new name" || type === "continue") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Merge
  if (type === "merge") {
    if (modifier === "left") return withRoad("Merge left");
    if (modifier === "right") return withRoad("Merge right");
    if (modifier === "slight left") return withRoad("Merge slightly left");
    if (modifier === "slight right") return withRoad("Merge slightly right");
    return withRoad("Merge");
  }

  // Fork
  if (type === "fork") {
    if (modifier === "left") return withRoad("Keep left at the fork");
    if (modifier === "right") return withRoad("Keep right at the fork");
    if (modifier === "slight left") return withRoad("Bear left at the fork");
    if (modifier === "slight right") return withRoad("Bear right at the fork");
    return withRoad("Continue at the fork");
  }

  // Roundabouts
  if (type === "roundabout" || type === "rotary") {
    if (exit !== undefined) {
      const exitOrdinal = getOrdinal(exit);
      return withRoad(`At the roundabout, take the ${exitOrdinal} exit`);
    }
    return withRoad("Enter the roundabout");
  }

  if (type === "roundabout turn") {
    if (modifier === "left") return withRoad("Turn left at the roundabout");
    if (modifier === "right") return withRoad("Turn right at the roundabout");
    return withRoad("Continue through the roundabout");
  }

  // Ramps
  if (type === "on ramp") {
    if (modifier === "left") return withRoad("Take the ramp on the left");
    if (modifier === "right") return withRoad("Take the ramp on the right");
    if (modifier === "slight left") return withRoad("Take the slight left ramp");
    if (modifier === "slight right") return withRoad("Take the slight right ramp");
    return withRoad("Take the ramp");
  }

  if (type === "off ramp") {
    if (modifier === "left") return withRoad("Take the exit on the left");
    if (modifier === "right") return withRoad("Take the exit on the right");
    if (modifier === "slight left") return withRoad("Take the slight left exit");
    if (modifier === "slight right") return withRoad("Take the slight right exit");
    return withRoad("Take the exit");
  }

  // End of road
  if (type === "end of road") {
    if (modifier === "left") return withRoad("At the end of the road, turn left");
    if (modifier === "right") return withRoad("At the end of the road, turn right");
    return withRoad("Continue at the end of the road");
  }

  // Notification (road name change, no action required)
  if (type === "notification") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Fallback for unknown types
  if (roadName) {
    return `Continue on ${roadName}`;
  }
  return "Continue straight ahead";
}

/**
 * Builds a distance-aware announcement for advance warnings.
 * Example: "In 300 meters, turn right onto 5th Cross Road"
 */
export function getManeuverAnnouncement(step: OSRMStep, distanceMeters: number): string {
  const instruction = getManeuverInstruction(step);
  const maneuver = step.maneuver;

  // Don't add distance prefix for arrivals or departures
  if (maneuver?.type === "arrive" || maneuver?.type === "depart") {
    return instruction;
  }

  // Format distance
  let distancePhrase = "";
  if (distanceMeters >= 1000) {
    const km = (distanceMeters / 1000).toFixed(1);
    distancePhrase = `In ${km} kilometers`;
  } else if (distanceMeters >= 100) {
    const roundedMeters = Math.round(distanceMeters / 50) * 50; // Round to nearest 50m
    distancePhrase = `In ${roundedMeters} meters`;
  } else {
    distancePhrase = "Now";
  }

  // For very short distances, just say the instruction without distance
  if (distanceMeters < 50) {
    return instruction;
  }

  // Combine distance + instruction
  // Lower-case first letter of instruction when prefixing with distance
  const instructionLower = instruction.charAt(0).toLowerCase() + instruction.slice(1);
  return `${distancePhrase}, ${instructionLower}`;
}

/**
 * Converts a number to its ordinal form (1 -> "1st", 2 -> "2nd", etc.)
 */
function getOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = n % 100;
  const suffix = suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
  return `${n}${suffix}`;
}

```

### frontend/src/lib/pushNotificationService.ts
```typescript
import { dispatchPushNotification, PushNotificationPayload } from "./api";

export class PushNotificationService {
  private static permissionGranted: boolean = false;

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  public static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    if (Notification.permission === "granted") {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === "granted";
      return this.permissionGranted;
    }

    return false;
  }

  public static isPermissionGranted(): boolean {
    if (!this.isSupported()) return false;
    return Notification.permission === "granted";
  }

  /**
   * Dispatches push notification for upcoming route congestion (Feature 5a).
   */
  public static async sendCongestionAlert(
    locationName: string,
    distanceText: string,
    delayMinutes: number,
    speedKmh: number
  ) {
    const title = `⚠️ Congestion Ahead (${distanceText})`;
    const body = `Heavy traffic near ${locationName}. Speed: ${Math.round(speedKmh)} km/h (+${Math.round(delayMinutes)}m delay).`;

    const payload: PushNotificationPayload = {
      title,
      body,
      tag: "apex-congestion-alert",
      data: {
        type: "CONGESTION",
        locationName,
        distanceText,
        delayMinutes,
      },
    };

    // 1. Dispatch locally via Browser Notification API (even in background)
    if (this.isSupported() && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-congestion-alert",
          });
        } else {
          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-congestion-alert",
          });
        }
      } catch (err) {
        console.warn("Local notification error:", err);
      }
    }

    // 2. Relay to backend notification logger
    try {
      await dispatchPushNotification(payload);
    } catch {
      // Offline fallback
    }
  }

  /**
   * Dispatches push notification for faster alternative route suggestion (Feature 5b).
   */
  public static async sendRerouteSuggestion(
    timeSavedMinutes: number,
    viaRoad: string
  ) {
    const title = `🚀 Faster Route Found (Save ${Math.round(timeSavedMinutes)} min)`;
    const body = `Alternative route via ${viaRoad} available to bypass congestion.`;

    const payload: PushNotificationPayload = {
      title,
      body,
      tag: "apex-reroute-alert",
      data: {
        type: "REROUTE",
        timeSavedMinutes,
        viaRoad,
      },
    };

    if (this.isSupported() && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-reroute-alert",
          });
        } else {
          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-reroute-alert",
          });
        }
      } catch (err) {
        console.warn("Local notification error:", err);
      }
    }

    try {
      await dispatchPushNotification(payload);
    } catch {
      // Offline fallback
    }
  }
}

```

### frontend/src/lib/rerouteEngine.ts
```typescript
import { evaluateReroute, RerouteRecommendation } from "./api";
import { TTSService } from "./ttsService";
import { PushNotificationService } from "./pushNotificationService";

export type RerouteListener = (
  recommendation: RerouteRecommendation | null,
  noRouteReason: string | null
) => void;

// Set to true only when diagnosing rerouting flow in development
const DEBUG = false;

export class RerouteEngine {
  private static activeRecommendation: RerouteRecommendation | null = null;
  private static lastNoRouteFoundReason: string | null = null;
  private static noRouteTimeout: NodeJS.Timeout | null = null;
  private static listeners: Set<RerouteListener> = new Set();
  private static isEvaluating: boolean = false;
  private static lastEvaluationTime: number = 0;
  private static lastEvaluatedSpeed: number = 40.0;

  public static subscribe(listener: RerouteListener): () => void {
    this.listeners.add(listener);
    listener(this.activeRecommendation, this.lastNoRouteFoundReason);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeRecommendation, this.lastNoRouteFoundReason);
      } catch (err) {
        console.error("[RerouteEngine] Listener notification error:", err);
      }
    });
  }

  /**
   * Asynchronously checks if real-time conditions warrant re-evaluating the ML model (Features 7 & 8).
   * Gated to prevent polling while a recommendation modal is already active.
   */
  public static async checkAndReevaluate(
    currentLat: number,
    currentLon: number,
    destLat: number,
    destLon: number,
    remainingSeconds: number,
    currentSpeedKmh: number,
    isEmergencyMode: boolean = false,
    forceReevaluate: boolean = false
  ): Promise<RerouteRecommendation | null> {
    // 1. Skip automatic background checking if a recommendation is already displayed
    if (!forceReevaluate && this.activeRecommendation !== null) {
      if (DEBUG) console.log("[RerouteEngine] Skipped: recommendation already active in modal");
      return this.activeRecommendation;
    }

    const now = Date.now();
    const timeSinceLastEval = now - this.lastEvaluationTime;
    const speedDropRatio = (this.lastEvaluatedSpeed - currentSpeedKmh) / Math.max(1, this.lastEvaluatedSpeed);
    const hasSignificantSpeedDrop = speedDropRatio >= 0.15;
    const isPeriodicTimeElapsed = timeSinceLastEval > 8000;

    if (DEBUG) {
      console.log(
        `[RerouteEngine] Evaluation check: speed=${currentSpeedKmh.toFixed(1)} km/h, drop=${(speedDropRatio * 100).toFixed(
          1
        )}%, elapsed=${(timeSinceLastEval / 1000).toFixed(1)}s, force=${forceReevaluate}`
      );
    }

    if (!forceReevaluate && !hasSignificantSpeedDrop && !isPeriodicTimeElapsed) {
      return this.activeRecommendation;
    }

    if (this.isEvaluating) {
      if (DEBUG) console.log("[RerouteEngine] Skipped: re-evaluation already in flight");
      return this.activeRecommendation;
    }

    this.isEvaluating = true;
    this.lastEvaluationTime = now;
    this.lastEvaluatedSpeed = currentSpeedKmh;

    try {
      // Dynamic Alternative Route Generation strictly from CURRENT position (Feature 8)
      const recommendation = await evaluateReroute(
        currentLat,
        currentLon,
        destLat,
        destLon,
        remainingSeconds,
        [],
        isEmergencyMode
      );

      if (DEBUG) console.log("[RerouteEngine] Backend recommendation response:", recommendation);

      if (recommendation && recommendation.is_reroute_recommended && recommendation.recommended_route) {
        this.activeRecommendation = recommendation;
        this.lastNoRouteFoundReason = null;
        if (this.noRouteTimeout) {
          clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = null;
        }
        this.notifyListeners();

        const viaName = recommendation.recommended_route.steps?.[0]?.name || "Alternative Bypass";

        // Voice Alert & Push Notification
        TTSService.speakRerouteSuggestion(recommendation.time_saved_minutes, viaName);
        PushNotificationService.sendRerouteSuggestion(recommendation.time_saved_minutes, viaName);
      } else {
        // Handle no faster route available
        if (forceReevaluate) {
          const reason =
            recommendation?.reason || "Current route remains the fastest available path.";
          this.lastNoRouteFoundReason = reason;
          if (this.noRouteTimeout) clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = setTimeout(() => {
            this.lastNoRouteFoundReason = null;
            this.notifyListeners();
          }, 5000);
          this.notifyListeners();
        } else if (this.activeRecommendation !== null) {
          this.activeRecommendation = null;
          this.notifyListeners();
        }
      }

      return recommendation;
    } catch (err) {
      console.error("[RerouteEngine] Async reroute evaluation failed:", err);
      return null;
    } finally {
      this.isEvaluating = false;
    }
  }

  public static dismissRecommendation() {
    this.activeRecommendation = null;
    this.notifyListeners();
  }

  public static dismissNoRouteReason() {
    this.lastNoRouteFoundReason = null;
    if (this.noRouteTimeout) {
      clearTimeout(this.noRouteTimeout);
      this.noRouteTimeout = null;
    }
    this.notifyListeners();
  }

  public static getActiveRecommendation(): RerouteRecommendation | null {
    return this.activeRecommendation;
  }

  public static getLastNoRouteReason(): string | null {
    return this.lastNoRouteFoundReason;
  }
}

```

### frontend/src/lib/ttsService.ts
```typescript
export enum SpeechPriority {
  NORMAL = 1,     // Congestion info, traffic telemetry
  HIGH = 2,       // Reroute recommendations
  CRITICAL = 3,   // Turn-by-turn maneuvers, immediate hazards
}

interface QueuedSpeech {
  id: string;
  text: string;
  priority: SpeechPriority;
  timestamp: number;
  dedupeKey?: string;
}

export class TTSService {
  private static isMuted: boolean = false;
  private static volume: number = 1.0;
  private static rate: number = 1.05; // Slightly brisk driving cadence
  private static pitch: number = 1.0;
  private static isSpeaking: boolean = false;
  private static speechQueue: QueuedSpeech[] = [];
  private static spokenHistory: Map<string, number> = new Map();
  private static cachedVoices: SpeechSynthesisVoice[] = [];
  private static isInitialized = false;

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private static initVoices() {
    if (this.isInitialized || !this.isSupported()) return;
    this.isInitialized = true;
    
    const loadVoices = () => {
      this.cachedVoices = window.speechSynthesis.getVoices();
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public static setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isSupported()) {
      window.speechSynthesis.cancel();
      this.speechQueue = [];
      this.isSpeaking = false;
    }
  }

  public static getMuted(): boolean {
    return this.isMuted;
  }

  public static toggleMuted(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public static clearQueue() {
    this.speechQueue = [];
    this.spokenHistory.clear();
    if (this.isSpeaking && this.isSupported()) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  public static setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public static setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  /**
   * Enqueues and speaks a message while ensuring no audio collisions
   * with turn-by-turn navigation instructions.
   */
  public static speak(text: string, priority: SpeechPriority = SpeechPriority.NORMAL, debounceSeconds: number = 15, dedupeKey?: string) {
    if (!this.isSupported()) return;
    this.initVoices();
    if (this.isMuted || !text.trim()) return;

    // Check debounce history to prevent repeating the same warning excessively
    const normalizedKey = dedupeKey ? dedupeKey.trim().toLowerCase() : text.trim().toLowerCase();
    const lastSpokenTime = this.spokenHistory.get(normalizedKey);
    const now = Date.now();

    if (lastSpokenTime && now - lastSpokenTime < debounceSeconds * 1000) {
      return;
    }

    const item: QueuedSpeech = {
      id: `${now}_${Math.random().toString(36).substring(2, 7)}`,
      text: text.trim(),
      priority,
      timestamp: now,
      dedupeKey,
    };

    // If critical maneuver, insert at front of queue or interrupt low priority
    if (priority === SpeechPriority.CRITICAL) {
      // Clear non-critical queue items
      this.speechQueue = this.speechQueue.filter((q) => q.priority === SpeechPriority.CRITICAL);
      this.speechQueue.unshift(item);
      if (this.isSpeaking) {
        window.speechSynthesis.cancel();
        this.isSpeaking = false;
      }
    } else {
      // Insert in priority order
      let inserted = false;
      for (let i = 0; i < this.speechQueue.length; i++) {
        if (priority > this.speechQueue[i].priority) {
          this.speechQueue.splice(i, 0, item);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.speechQueue.push(item);
      }
    }

    this.processQueue();
  }

  private static processQueue() {
    if (this.isSpeaking || this.speechQueue.length === 0 || !this.isSupported()) {
      return;
    }

    const item = this.speechQueue.shift();
    if (!item) return;

    this.isSpeaking = true;
    const cacheKey = item.dedupeKey ? item.dedupeKey.trim().toLowerCase() : item.text.trim().toLowerCase();
    this.spokenHistory.set(cacheKey, Date.now());

    try {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.volume = this.volume;
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;

      // Select an English voice if available
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => (v.lang.startsWith("en-IN") || v.lang.startsWith("en-US") || v.lang.startsWith("en-GB")) && v.name.includes("Natural")
      ) || voices.find((v) => v.lang.startsWith("en"));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        // Small pause between utterances for natural breathing
        setTimeout(() => this.processQueue(), 250);
      };

      utterance.onerror = (e) => {
        console.warn("TTS playback error:", e);
        this.isSpeaking = false;
        setTimeout(() => this.processQueue(), 250);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Failed to execute TTS utterance:", err);
      this.isSpeaking = false;
      setTimeout(() => this.processQueue(), 250);
    }
  }

  /**
   * Reads out proactive congestion alert.
   */
  public static speakCongestionAlert(
    locationName: string,
    distanceText: string,
    speedKmh: number,
    delayMinutes?: number,
    suggestRerouteOption: boolean = true
  ) {
    let msg = `Traffic alert: heavy congestion ahead in ${distanceText} near ${locationName}.`;
    if (speedKmh > 0) {
      msg += ` Flow speed is ${Math.round(speedKmh)} kilometers per hour.`;
    }
    if (delayMinutes && delayMinutes >= 2) {
      msg += ` Expected delay is ${Math.round(delayMinutes)} minutes.`;
    }
    if (suggestRerouteOption && delayMinutes && delayMinutes >= 2) {
      msg += ` Tap to check a faster route.`;
    }
    this.speak(msg, SpeechPriority.NORMAL, 20, `congestion_${locationName}`);
  }

  /**
   * Reads out reroute recommendation.
   */
  public static speakRerouteSuggestion(timeSavedMinutes: number, viaRoad?: string) {
    const minStr = Math.round(timeSavedMinutes);
    let msg = `Faster route found. You can save approximately ${minStr} minutes`;
    if (viaRoad) {
      msg += ` by taking ${viaRoad}.`;
    } else {
      msg += `. Tap accept on your screen to reroute.`;
    }
    this.speak(msg, SpeechPriority.HIGH, 30);
  }

  /**
   * Reads out turn-by-turn maneuver instruction (High Priority).
   */
  public static speakTurnManeuver(instruction: string) {
    this.speak(instruction, SpeechPriority.CRITICAL, 8);
  }
}

```
````


## `backend\api\__init__.py`

```python
# API package initialization
```


## `backend\api\v1\__init__.py`

```python
# API v1 package initialization
```


## `backend\api\v1\endpoints.py`

```python
from datetime import datetime, timezone
import logging
import uuid
import math
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Body
from core.region import BengaluruRegionManager
from schemas.navigation import (
    LocationSearchResponse, 
    RouteRequest, 
    RouteResponse, 
    CandidateRoute,
    TrafficFactorsRequest,
    TrafficFactorData,
    RerouteRequest,
    RerouteRecommendation,
    PushNotificationPayload
)
from services.nominatim import NominatimService
from services.osrm import OSRMService
from services.traffic_service import LiveTrafficService
from services.congestion_detector import CongestionDetector
from services.reroute_engine import DynamicRerouteEngine
from services.notification_service import PushNotificationService
from services.route_selection import rank_processed_routes
from services.traffic_scenario import apply_traffic_test_scenario
from ml.recommender import RouteScorer

logger = logging.getLogger("apexguardian.api")
router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "online",
        "region": "Bengaluru",
        "features": [
            "congestion_point_identification",
            "real_time_traffic_factors",
            "predictive_congestion",
            "advance_alert_messages",
            "mobile_push_notifications",
            "voice_tts_guidance",
            "dynamic_ml_reexecution",
            "dynamic_alternative_rerouting",
            "fastest_route_recommendation",
            "route_eta_updates"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/search", response_model=List[LocationSearchResponse])
async def search_locations(q: str = Query(..., min_length=1, description="Location search query")):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    try:
        results = await NominatimService.search_places(q)
        return results
    except Exception as e:
        logger.error(f"Error searching locations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Location search failed: {str(e)}")

@router.get("/reverse")
async def reverse_geocode(lat: float = Query(..., description="Latitude"), lon: float = Query(..., description="Longitude")):
    try:
        display_name = await NominatimService.reverse_geocode(lat, lon)
        return {
            "display_name": display_name,
            "lat": lat,
            "lon": lon
        }
    except Exception as e:
        logger.error(f"Error reverse geocoding ({lat}, {lon}): {str(e)}")
        return {
            "display_name": f"Location ({lat:.5f}, {lon:.5f})",
            "lat": lat,
            "lon": lon
        }

@router.post("/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest):
    """Calculates driving routes with ML scoring, multi-colored congestion segments, and hotspot detection."""
    origin_in_bounds = BengaluruRegionManager.is_within_bounds(request.origin_lat, request.origin_lon)
    dest_in_bounds = BengaluruRegionManager.is_within_bounds(request.dest_lat, request.dest_lon)

    if not origin_in_bounds:
        logger.warning(f"Origin coordinates ({request.origin_lat}, {request.origin_lon}) are outside Bengaluru bounding box.")
    if not dest_in_bounds:
        logger.warning(f"Destination coordinates ({request.dest_lat}, {request.dest_lon}) are outside Bengaluru bounding box.")

    try:
        # 1. Fetch High-Resolution OSRM Street Driving Polylines
        raw_candidates = await OSRMService.get_routes(
            origin_lat=request.origin_lat,
            origin_lon=request.origin_lon,
            dest_lat=request.dest_lat,
            dest_lon=request.dest_lon
        )

        # 2. Evaluate Candidates with Route-Level ML Model
        ml_evaluated_candidates = RouteScorer.evaluate_routes(
            raw_candidates,
            request.origin_lat,
            request.origin_lon,
            request.dest_lat,
            request.dest_lon,
            is_emergency_mode=request.is_emergency_mode
        )

        # 3. Analyze each candidate for Segmented Congestion & Predictive Hotspots (Features 1 & 3)
        processed_candidates: List[CandidateRoute] = []
        for candidate in ml_evaluated_candidates:
            route_dist_m = candidate.get("distance_meters", 0.0)
            base_dur_s = candidate.get("duration_seconds", 0.0)
            geometry = candidate.get("geometry", {})
            steps = candidate.get("steps", [])

            # Hard Geometry Validation
            coords = geometry.get("coordinates", [])
            if not coords or len(coords) < 2:
                logger.error("Rejecting route: insufficient coordinates")
                continue
                
            has_nan = any(math.isnan(c[0]) or math.isnan(c[1]) for c in coords)
            if has_nan:
                logger.error("Rejecting route: contains NaN coordinates")
                continue

            if not steps:
                logger.error("Rejecting route: no steps found")
                continue

            candidate["route_id"] = str(uuid.uuid4())
            candidate["source"] = "initial-osrm"
            candidate["original_route_index"] = candidate.get("route_index", 0)

            analysis = CongestionDetector.analyze_route(
                geometry=geometry,
                steps=steps,
                total_distance_m=route_dist_m,
                base_duration_s=base_dur_s,
                is_emergency_mode=request.is_emergency_mode
            )
            if not request.is_emergency_mode:
                analysis = apply_traffic_test_scenario(
                    analysis, request.traffic_test_mode, request.traffic_progress
                )

            candidate["segments"] = analysis["segments"]
            candidate["hotspots"] = analysis["hotspots"]
            candidate["clear_distance_km"] = analysis["clear_distance_km"]
            candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
            candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
            candidate["severe_distance_km"] = analysis["severe_distance_km"]
            candidate["total_delay_seconds"] = analysis["total_delay_seconds"]

            # Incorporate segment-level live delays with ML duration
            live_delay = analysis["total_delay_seconds"]
            ml_predicted_dur = candidate.get("predicted_duration_seconds", base_dur_s)
            final_predicted_dur = max(ml_predicted_dur, base_dur_s + live_delay)
            
            candidate["predicted_duration_seconds"] = final_predicted_dur
            candidate["predicted_duration_minutes"] = round(final_predicted_dur / 60.0, 1)

            processed_candidates.append(CandidateRoute(**candidate))

        # Rank by the final ETA after segment-level delays have been added.
        # This keeps ML as the primary estimate while allowing material road
        # congestion to affect the initial recommendation.
        rank_processed_routes(processed_candidates)

        return RouteResponse(
            success=True,
            routes_count=len(processed_candidates),
            candidates=processed_candidates
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching routes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Routing service error: {str(e)}")

@router.post("/reroute/evaluate", response_model=RerouteRecommendation)
async def evaluate_reroute(request: RerouteRequest):
    """Dynamically generates alternative routes from CURRENT user location and recommends the fastest (Features 8 & 9)."""
    recommendation = await DynamicRerouteEngine.evaluate_reroute(
        current_lat=request.current_lat,
        current_lon=request.current_lon,
        dest_lat=request.dest_lat,
        dest_lon=request.dest_lon,
        original_remaining_duration_s=request.original_remaining_duration_seconds,
        avoid_hotspots=request.avoid_hotspots,
        is_emergency_mode=request.is_emergency_mode,
        traffic_test_mode=request.traffic_test_mode,
        traffic_progress=request.traffic_progress,
    )
    return recommendation

@router.get("/traffic/factors", response_model=TrafficFactorData)
async def get_traffic_factors(lat: float = Query(...), lon: float = Query(...)):
    """Returns real-time traffic factor metrics for a location (Feature 2)."""
    factors = LiveTrafficService.get_point_traffic_factors(lat, lon)
    return TrafficFactorData(
        location_name=factors["location_name"],
        current_speed_kmh=factors["current_speed_kmh"],
        freeflow_speed_kmh=factors["freeflow_speed_kmh"],
        density_index=factors["density_index"],
        congestion_level=factors["congestion_level"],
        congestion_factor=factors["congestion_factor"],
        incident_description=factors["incident_description"],
        historical_baseline_speed_kmh=35.0
    )

@router.get("/traffic/hotspots")
async def get_traffic_hotspots():
    """Returns all active bottleneck hotspots across Bengaluru."""
    hotspots = LiveTrafficService.get_all_active_hotspots()
    return {"success": True, "count": len(hotspots), "hotspots": hotspots}



@router.post("/notifications/dispatch", response_model=PushNotificationPayload)
async def dispatch_push_notification(payload: PushNotificationPayload):
    """Dispatches a mobile push notification (Feature 5)."""
    PushNotificationService._log_dispatch(payload)
    return payload

@router.get("/notifications/recent")
async def get_recent_notifications():
    """Retrieves recent push notification dispatch log."""
    dispatches = PushNotificationService.get_recent_dispatches()
    return {"dispatches": dispatches}
```


## `backend\core\__init__.py`

```python
# Core package initialization
```


## `backend\core\config.py`

```python
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
```


## `backend\core\region.py`

```python
from typing import List, Tuple

class BengaluruRegionManager:
    """Centralized geographical metadata for Bengaluru region."""
    CENTER: Tuple[float, float] = (12.9716, 77.5946)
    BOUNDING_BOX: List[float] = [77.4600, 12.8000, 77.7500, 13.1500]  # Min Lon, Min Lat, Max Lon, Max Lat
    DEFAULT_ZOOM: int = 12

    @classmethod
    def is_within_bounds(cls, lat: float, lon: float) -> bool:
        """Check if a coordinate pair sits inside the Bengaluru bounding box."""
        min_lon, min_lat, max_lon, max_lat = cls.BOUNDING_BOX
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon
```


## `backend\main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.v1.endpoints import router as api_v1_router

app = FastAPI(title="Apex Guardian Navigation Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "message": "Welcome to Apex Guardian Navigation Engine API",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
        "search": f"{settings.API_V1_STR}/search?q=Indiranagar"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```


## `backend\ml\__init__.py`

```python
# ML package initialization
```


## `backend\ml\dataset.py`

```python
import os
import pandas as pd
import numpy as np
from typing import Tuple, List, Dict
from openlocationcode import openlocationcode as olc
import asyncio
import time

class TrafficDataPipeline:
    """Feature engineering pipeline for Apex Guardian V2.0 Route-Level Model."""

    DATASETS_DIR = os.path.join(os.path.dirname(__file__), "datasets")
    TML_TRAFFIC_CSV = os.path.join(DATASETS_DIR, "tml", "csv-traffic-bangalore.csv")
    CACHE_FILE = os.path.join(DATASETS_DIR, "tml", "osrm_cache.json")
    
    BLR_LAT = 12.9716
    BLR_LON = 77.5946
    
    _osrm_cache = {}

    @classmethod
    def _decode_plus_code(cls, code: str) -> Tuple[float, float]:
        if len(code) <= 8 and '+' in code:
            full_code = olc.recoverNearest(code, cls.BLR_LAT, cls.BLR_LON)
        else:
            full_code = code
        decoded = olc.decode(full_code)
        return decoded.latitudeCenter, decoded.longitudeCenter
        
    @classmethod
    async def _build_osrm_cache(cls, unique_routes: pd.DataFrame):
        from services.osrm import OSRMService
        import json
        
        # Load from disk cache if exists
        if os.path.exists(cls.CACHE_FILE):
            try:
                with open(cls.CACHE_FILE, 'r') as f:
                    cls._osrm_cache = json.load(f)
                    print(f"Loaded {len(cls._osrm_cache)} routes from disk cache.")
            except Exception:
                pass

        needs_save = False
        for _, row in unique_routes.iterrows():
            o_lat, o_lon = row['origin_lat'], row['origin_lon']
            d_lat, d_lon = row['destination_lat'], row['destination_lon']
            key = f"{o_lat},{o_lon},{d_lat},{d_lon}"
            
            if key in cls._osrm_cache:
                continue
                
            # Rate limit backoff
            raw = None
            for attempt in range(5):
                try:
                    raw = await OSRMService.get_routes(o_lat, o_lon, d_lat, d_lon)
                    if raw:
                        break
                except Exception as e:
                    print(f"OSRM attempt {attempt+1} failed: {e}")
                print("Sleeping to respect OSRM rate limits...")
                await asyncio.sleep(3 * (attempt + 1))
                
            if not raw:
                raise RuntimeError(f"OSRM Route resolution failed for {key}. Halting dataset compilation.")
                
            route = raw[0]
            dist_km = route.get('distance_meters', 0) / 1000.0
            dur_sec = route.get('duration_seconds', 0)
            
            if dist_km <= 0 or dur_sec <= 0:
                raise RuntimeError(f"OSRM Route returned invalid metrics for {key}. Dist: {dist_km}, Dur: {dur_sec}")
                
            steps = route.get('steps', [])
            num_steps = max(1, len(steps))
            turns = 0
            roundabouts = 0
            for step in steps:
                mtype = step.get('maneuver', {}).get('type', '')
                if mtype in ['turn', 'merge', 'ramp']:
                    turns += 1
                if mtype in ['roundabout', 'rotary']:
                    roundabouts += 1
                    
            feats = {
                'osrm_dist': dist_km,
                'osrm_dur_min': dur_sec / 60.0,
                'steps_count': num_steps,
                'turns': turns,
                'roundabouts': roundabouts,
                'avg_step_len': dist_km / num_steps
            }
            cls._osrm_cache[key] = feats
            needs_save = True
            print(f"Resolved {key} -> Dist: {dist_km:.2f}km, Dur: {dur_sec/60.0:.2f}m, Steps: {num_steps}, Status: OK")
            
        if needs_save:
            with open(cls.CACHE_FILE, 'w') as f:
                json.dump(cls._osrm_cache, f)

    @classmethod
    def load_canonical_dataset(cls) -> pd.DataFrame:
        if not os.path.exists(cls.TML_TRAFFIC_CSV):
            raise FileNotFoundError(f"Missing TML dataset at {cls.TML_TRAFFIC_CSV}")
            
        df = pd.read_csv(cls.TML_TRAFFIC_CSV)
        df['timestamp'] = pd.to_datetime(df['date'] + ' ' + df['time'])
        
        def resolve_route(rc: str):
            parts = str(rc).split('|')
            if len(parts) == 2:
                o_lat, o_lon = cls._decode_plus_code(parts[0])
                d_lat, d_lon = cls._decode_plus_code(parts[1])
                return pd.Series([o_lat, o_lon, d_lat, d_lon])
            return pd.Series([np.nan, np.nan, np.nan, np.nan])
            
        df[['origin_lat', 'origin_lon', 'destination_lat', 'destination_lon']] = df['route_code'].apply(resolve_route)
        df = df.dropna(subset=['origin_lat'])
        unique_routes = df[['route_code', 'origin_lat', 'origin_lon', 'destination_lat', 'destination_lon']].drop_duplicates()
        
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
            
        if loop and loop.is_running():
            raise RuntimeError("load_canonical_dataset must be run in a separate sync wrapper")
        else:
            asyncio.run(cls._build_osrm_cache(unique_routes))
            
        def apply_osrm(row):
            key = f"{row['origin_lat']},{row['origin_lon']},{row['destination_lat']},{row['destination_lon']}"
            f = cls._osrm_cache[key]
            return pd.Series([
                f['osrm_dist'],
                f['osrm_dur_min'],
                f['steps_count'],
                f['turns'],
                f['roundabouts'],
                f['avg_step_len']
            ])
            
        df[['osrm_dist', 'osrm_dur_min', 'steps_count', 'turns', 'roundabouts', 'avg_step_len']] = df.apply(apply_osrm, axis=1)
        df = df[df['osrm_dur_min'] > 0]
        
        df['distance_km'] = df['distance']
        df['observed_duration_min'] = df['duration']
        df['congestion_factor'] = df['observed_duration_min'] / df['osrm_dur_min']
        
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['month'] = df['timestamp'].dt.month
        
        canonical_cols = [
            'timestamp', 'route_code', 'origin_lat', 'origin_lon', 
            'destination_lat', 'destination_lon', 'observed_duration_min', 
            'osrm_dist', 'osrm_dur_min', 'steps_count', 'turns', 'roundabouts', 'avg_step_len',
            'congestion_factor', 'hour', 'day_of_week', 'is_weekend', 'month'
        ]
        
        return df[canonical_cols].copy()

    @classmethod
    def get_train_val_test_splits(cls):
        df = cls.load_canonical_dataset()
        
        # SANITY CHECKS BEFORE SPLIT
        if (df['osrm_dur_min'] == 1.0).all():
            raise RuntimeError("SANITY CHECK FAILED: All OSRM durations are exactly 1.0! Dataset is corrupted.")
        if df['osrm_dur_min'].min() <= 0:
            raise RuntimeError("SANITY CHECK FAILED: OSRM duration <= 0 found!")
        
        print("\n--- SANITY CHECKS ---")
        print(f"Valid Rows: {len(df)}")
        print(f"OSRM Duration Mean: {df['osrm_dur_min'].mean():.2f}")
        print("Congestion Factor Stats:")
        print(df['congestion_factor'].describe(percentiles=[0.9, 0.95, 0.99]))
        
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        features = [
            'hour', 'day_of_week', 'is_weekend', 'month',
            'osrm_dist', 'osrm_dur_min', 'steps_count', 'turns', 'roundabouts', 'avg_step_len'
        ]
            
        X = df[features].values
        y = df['congestion_factor'].values
        
        n = len(df)
        train_idx = int(0.75 * n)
        val_idx = int(0.85 * n)
        
        X_train, y_train = X[:train_idx], y[:train_idx]
        X_val, y_val = X[train_idx:val_idx], y[train_idx:val_idx]
        X_test, y_test = X[val_idx:], y[val_idx:]
        
        return X_train, y_train, X_val, y_val, X_test, y_test, features
```


## `backend\ml\datasets\tml\osrm_cache.json`

```json
{"13.0343125,77.55081249999999,12.9945625,77.6088125": {"osrm_dist": 9.8524, "osrm_dur_min": 12.835, "steps_count": 18, "turns": 11, "roundabouts": 0, "avg_step_len": 0.5473555555555555}, "13.0438125,77.5958125,12.9998125,77.6413125": {"osrm_dist": 9.899700000000001, "osrm_dur_min": 14.218333333333334, "steps_count": 19, "turns": 8, "roundabouts": 0, "avg_step_len": 0.5210368421052632}, "12.890062499999999,77.6391875,12.8311875,77.6803125": {"osrm_dist": 10.280299999999999, "osrm_dur_min": 13.883333333333333, "steps_count": 8, "turns": 3, "roundabouts": 0, "avg_step_len": 1.2850374999999998}, "12.907562500000001,77.57306249999999,12.916237500000001,77.647953125": {"osrm_dist": 9.7826, "osrm_dur_min": 12.229999999999999, "steps_count": 9, "turns": 5, "roundabouts": 0, "avg_step_len": 1.0869555555555557}, "12.9420625,77.5680625,12.9755625,77.6240625": {"osrm_dist": 9.0347, "osrm_dur_min": 11.425, "steps_count": 19, "turns": 7, "roundabouts": 2, "avg_step_len": 0.4755105263157895}, "12.9550625,77.5173125,12.8960625,77.5701875": {"osrm_dist": 10.5109, "osrm_dur_min": 10.866666666666667, "steps_count": 11, "turns": 5, "roundabouts": 0, "avg_step_len": 0.9555363636363636}, "12.9816875,77.5638125,12.934687499999999,77.6110625": {"osrm_dist": 9.6199, "osrm_dur_min": 12.658333333333333, "steps_count": 21, "turns": 10, "roundabouts": 1, "avg_step_len": 0.45809047619047616}, "12.9756875,77.6065625,13.1989375,77.7069375": {"osrm_dist": 33.429300000000005, "osrm_dur_min": 34.3, "steps_count": 27, "turns": 14, "roundabouts": 0, "avg_step_len": 1.2381222222222223}, "12.9859375,77.6450625,12.936187499999999,77.6061875": {"osrm_dist": 10.931299999999998, "osrm_dur_min": 13.663333333333332, "steps_count": 12, "turns": 4, "roundabouts": 0, "avg_step_len": 0.9109416666666665}, "12.9963125,77.6683125,12.9321875,77.6903125": {"osrm_dist": 11.2141, "osrm_dur_min": 16.548333333333332, "steps_count": 19, "turns": 3, "roundabouts": 0, "avg_step_len": 0.5902157894736842}, "12.9706875,77.7125625,12.9540625,77.6526875": {"osrm_dist": 9.4291, "osrm_dur_min": 11.251666666666667, "steps_count": 5, "turns": 2, "roundabouts": 0, "avg_step_len": 1.88582}, "12.9263125,77.5154375,12.9638125,77.5855625": {"osrm_dist": 10.350100000000001, "osrm_dur_min": 12.406666666666666, "steps_count": 15, "turns": 4, "roundabouts": 0, "avg_step_len": 0.6900066666666668}, "12.9073125,77.7058125,12.9249375,77.6294375": {"osrm_dist": 9.694, "osrm_dur_min": 14.681666666666667, "steps_count": 14, "turns": 9, "roundabouts": 0, "avg_step_len": 0.6924285714285715}}
```


## `backend\ml\recommender.py`

```python
import math
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta

from ml.route_model import predictor as congestion_predictor

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
    lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class RouteScorer:
    """Evaluates multiple route candidates by fetching the Congestion Factor."""
    
    KNOWN_CORNERS = [
        (12.9514, 77.6590), # Example Indiranagar/Old Airport Road area
        (12.9345, 77.6200), # Koramangala
        (13.1989, 77.7069), # Airport
        (12.9716, 77.5946), # MG Road
        (12.9279, 77.6271), # Silk Board
        (12.9698, 77.7499), # Whitefield
        (13.0354, 77.5988), # Hebbal
    ]
    
    @classmethod
    def determine_coverage(cls, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> str:
        o_dists = [haversine(origin_lat, origin_lon, lat, lon) for lat, lon in cls.KNOWN_CORNERS]
        d_dists = [haversine(dest_lat, dest_lon, lat, lon) for lat, lon in cls.KNOWN_CORNERS]
        
        o_min = min(o_dists) if o_dists else float('inf')
        d_min = min(d_dists) if d_dists else float('inf')
        
        if o_min <= 3.0 and d_min <= 3.0:
            return "High (Historical)"
        elif o_min <= 8.0 and d_min <= 8.0:
            return "Medium (Similar)"
        else:
            return "Low (Extrapolated)"

    @classmethod
    def evaluate_routes(cls, routes: List[Dict[str, Any]], origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float, is_emergency_mode: bool = False) -> List[Dict[str, Any]]:
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(ist_tz)
        hour = now.hour
        day_of_week = now.weekday()
        is_weekend = int(day_of_week in [5, 6])
        month = now.month
        
        confidence = cls.determine_coverage(origin_lat, origin_lon, dest_lat, dest_lon)
        
        for idx, route in enumerate(routes):
            dist_km = route.get('distance_meters', 0) / 1000.0
            dur_sec = route.get('duration_seconds', 0)
            
            # OSRM Feature Extraction
            steps = route.get('steps', [])
            num_steps = len(steps)
            turns = 0
            roundabouts = 0
            for step in steps:
                mtype = step.get('maneuver', {}).get('type', '')
                if mtype in ['turn', 'merge', 'ramp']:
                    turns += 1
                if mtype in ['roundabout', 'rotary']:
                    roundabouts += 1
            
            avg_step_len = dist_km / max(1, num_steps)
            osrm_dur_min = dur_sec / 60.0 if dur_sec > 0 else 1.0
            
            # Congestion Factor prediction
            if is_emergency_mode:
                cf = 1.0
            else:
                cf = congestion_predictor.predict_congestion_factor(
                    osrm_dist=dist_km,
                    osrm_dur_min=osrm_dur_min,
                    steps_count=num_steps,
                    turns=turns,
                    roundabouts=roundabouts,
                    avg_step_len=avg_step_len,
                    hour=hour,
                    day_of_week=day_of_week,
                    is_weekend=is_weekend,
                    month=month
                )
            
            predicted_dur_sec = dur_sec * cf
            predicted_dur_min = predicted_dur_sec / 60.0
            
            route['route_index'] = idx
            route['predicted_duration_seconds'] = predicted_dur_sec
            route['predicted_duration_minutes'] = predicted_dur_min
            route['standard_duration_seconds'] = dur_sec
            route['standard_duration_minutes'] = dur_sec / 60.0
            route['congestion_factor'] = cf
            route['confidence'] = confidence
            route['is_ai_recommended'] = False
            route['recommendation_label'] = ""
            route['predicted_average_speed_kmh'] = dist_km / (predicted_dur_min / 60.0) if predicted_dur_min > 0 else 0.0
            route['delay_savings_minutes'] = 0.0

        if not routes:
            return routes
            
        # Recommender ranks by the ML predicted duration
        routes.sort(key=lambda r: r['predicted_duration_seconds'])
        
        slowest_predicted_min = max(r['predicted_duration_minutes'] for r in routes)
        for route in routes:
            route['delay_savings_minutes'] = slowest_predicted_min - route['predicted_duration_minutes']
        
        # Determine labels based strictly on multiple-route existence
        if len(routes) == 1:
            routes[0]['is_ai_recommended'] = True
            routes[0]['recommendation_label'] = "Recommended Route"
        else:
            # Shortest ML predicted duration wins AI recommendation
            routes[0]['is_ai_recommended'] = True
            routes[0]['recommendation_label'] = "AI Recommended"
            
            # Find the first OSRM candidate (original route_index == 0) and label it OSRM Preferred Route
            for route in routes:
                if route['route_index'] == 0:
                    # Don't overwrite if it also happens to be the AI Recommended route
                    if not route['is_ai_recommended']:
                        route['recommendation_label'] = "OSRM Preferred Route"
                    break
                    
        return routes
```


## `backend\ml\route_model.py`

```python
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
```


## `backend\ml\train.py`

```python
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
```


## `backend\requirements.txt`

```
fastapi>=0.110.0
uvicorn>=0.28.0
httpx>=0.27.0
pydantic>=2.6.4
pydantic-settings>=2.2.1
pytest>=8.1.1
scikit-learn>=1.4.0
joblib>=1.3.0
numpy>=1.26.0
pandas>=2.0.0
xgboost>=2.0.0
openlocationcode>=1.0.0
```


## `backend\schemas\__init__.py`

```python
# Schemas package initialization
```


## `backend\schemas\navigation.py`

```python
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field

class CongestionLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HEAVY = "HEAVY"
    SEVERE = "SEVERE"

class TrafficTestMode(str, Enum):
    REAL = "real"
    NORMAL = "normal"
    MODERATE = "moderate"
    HEAVY = "heavy"
    SEVERE = "severe"
    DYNAMIC = "dynamic"

class LocationSearchResponse(BaseModel):
    """Geocoded location search result."""
    display_name: str
    lat: float
    lon: float
    place_id: str
    address_type: str

class RouteRequest(BaseModel):
    """Driving route query between origin and destination coordinates."""
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    is_emergency_mode: bool = False
    # Real traffic data is the production default; test modes are opt-in via the frontend dropdown only.
    traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL
    traffic_progress: float = Field(default=0.0, ge=0.0, le=1.0)

class CongestionSegment(BaseModel):
    """Sub-segment of a route with localized real-time and predicted congestion metrics."""
    segment_index: int
    coordinates: List[List[float]] = Field(default_factory=list, description="[[lon, lat], ...]")
    distance_meters: float = 0.0
    duration_seconds: float = 0.0
    freeflow_speed_kmh: float = 45.0
    current_speed_kmh: float = 45.0
    delay_seconds: float = 0.0
    congestion_level: CongestionLevel = CongestionLevel.LOW
    color: str = "#10B981"  # Hex color for MapLibre rendering
    congestion_factor: float = 1.0
    density_index: float = 20.0  # 0 to 100
    predicted_arrival_time_min: float = 0.0
    road_name: Optional[str] = "Main Road"

class CongestionHotspot(BaseModel):
    """Identified critical congestion bottleneck along a route."""
    hotspot_id: str
    location_name: str
    lat: float
    lon: float
    distance_from_origin_m: float
    congestion_level: CongestionLevel = CongestionLevel.HEAVY
    average_speed_kmh: float = 15.0
    estimated_delay_seconds: float = 0.0
    description: str = ""
    cause: str = "High Vehicle Volume / Choke Point"

class CandidateRoute(BaseModel):
    """Complete candidate route with ML scoring and segmented traffic breakdown."""
    route_id: str = ""
    source: str = "initial-osrm"
    original_route_index: int = 0
    route_index: int
    distance_meters: float
    duration_seconds: float
    geometry: Dict[str, Any]
    steps: List[Dict[str, Any]]
    is_ai_recommended: bool = False
    recommendation_label: str = ""
    congestion_factor: float = 1.0
    predicted_average_speed_kmh: float = 0.0
    predicted_duration_seconds: float = 0.0
    predicted_duration_minutes: float = 0.0
    standard_duration_seconds: float = 0.0
    standard_duration_minutes: float = 0.0
    delay_savings_minutes: float = 0.0
    confidence: str = ""
    
    # Feature 1 & 2: Segmented congestion breakdown & Hotspots
    segments: List[CongestionSegment] = Field(default_factory=list)
    hotspots: List[CongestionHotspot] = Field(default_factory=list)
    clear_distance_km: float = 0.0
    moderate_distance_km: float = 0.0
    heavy_distance_km: float = 0.0
    severe_distance_km: float = 0.0
    total_delay_seconds: float = 0.0

class RouteResponse(BaseModel):
    """Response returned by route calculation endpoint."""
    success: bool
    routes_count: int
    candidates: List[CandidateRoute]

class TrafficFactorsRequest(BaseModel):
    """Query live traffic metrics for a location or corridor."""
    lat: float
    lon: float
    radius_km: float = 2.0

class TrafficFactorData(BaseModel):
    """Real-time traffic factor telemetry."""
    location_name: str
    current_speed_kmh: float
    freeflow_speed_kmh: float
    density_index: float
    congestion_level: str
    congestion_factor: float
    incident_description: Optional[str] = None
    historical_baseline_speed_kmh: float = 35.0

class RerouteRequest(BaseModel):
    """Dynamic alternative rerouting query from user's current GPS position."""
    current_lat: float
    current_lon: float
    dest_lat: float
    dest_lon: float
    original_route_index: int = 0
    original_remaining_duration_seconds: float = 0.0
    avoid_hotspots: List[Dict[str, float]] = Field(default_factory=list)
    is_emergency_mode: bool = False
    # Real traffic data is the production default; test modes are opt-in via the frontend dropdown only.
    traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL
    traffic_progress: float = Field(default=0.0, ge=0.0, le=1.0)

class RerouteRecommendation(BaseModel):
    """Alternative route recommendation evaluated from the current location."""
    is_reroute_recommended: bool = False
    is_congestion_avoidance: bool = False
    time_saved_seconds: float = 0.0
    time_saved_minutes: float = 0.0
    original_remaining_seconds: float = 0.0
    recommended_duration_seconds: float = 0.0
    recommended_route: Optional[CandidateRoute] = None
    alternative_routes: List[CandidateRoute] = Field(default_factory=list)
    reason: str = ""

class PushNotificationPayload(BaseModel):
    """Mobile / Web Push Notification Dispatch Payload."""
    title: str
    body: str
    icon: Optional[str] = "/icons/alert-icon.png"
    badge: Optional[str] = "/icons/badge.png"
    tag: Optional[str] = "apex-traffic-alert"
    data: Optional[Dict[str, Any]] = None
```


## `backend\services\__init__.py`

```python
# Services package initialization
```


## `backend\services\congestion_detector.py`

```python
import math
from typing import List, Dict, Any, Tuple
from services.traffic_service import LiveTrafficService
from schemas.navigation import CongestionLevel

class CongestionDetector:
    """Congestion Point Identification and Predictive Detection Engine (Features 1 & 3).
    
    Responsibilities:
    - Splits full route coordinate polylines into discrete, analytical sub-segments.
    - Evaluates localized speed, density, and congestion level for each sub-segment.
    - Performs PREDICTIVE congestion detection before the user physically arrives at downstream segments.
    - Identifies discrete Congestion Hotspots along the path for advance alert generation.
    - Calculates distance breakdown by traffic condition (Clear, Moderate, Heavy, Severe).
    """

    @staticmethod
    def haversine_distance(coord1: List[float], coord2: List[float]) -> float:
        """Calculates distance in meters between [lon1, lat1] and [lon2, lat2]."""
        lon1, lat1 = coord1[0], coord1[1]
        lon2, lat2 = coord2[0], coord2[1]
        r = 6371000.0  # Earth radius in meters
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def analyze_route(
        cls, 
        geometry: Dict[str, Any], 
        steps: List[Dict[str, Any]], 
        total_distance_m: float, 
        base_duration_s: float,
        is_emergency_mode: bool = False
    ) -> Dict[str, Any]:
        """Analyzes a candidate route and returns segmented traffic breakdown, hotspots, and predictive metrics."""
        coordinates: List[List[float]] = geometry.get("coordinates", [])
        if not coordinates or len(coordinates) < 2:
            return {
                "segments": [],
                "hotspots": [],
                "clear_distance_km": round(total_distance_m / 1000.0, 2),
                "moderate_distance_km": 0.0,
                "heavy_distance_km": 0.0,
                "severe_distance_km": 0.0,
                "total_delay_seconds": 0.0,
            }

        # Step 1: Divide route coordinate polyline into chunks of ~400m to 800m
        segment_chunks: List[List[List[float]]] = []
        current_chunk: List[List[float]] = [coordinates[0]]
        accumulated_dist = 0.0
        target_chunk_size_m = max(350.0, min(800.0, total_distance_m / 12.0))

        for i in range(1, len(coordinates)):
            d = cls.haversine_distance(coordinates[i - 1], coordinates[i])
            accumulated_dist += d
            current_chunk.append(coordinates[i])
            
            if accumulated_dist >= target_chunk_size_m or i == len(coordinates) - 1:
                segment_chunks.append(current_chunk)
                current_chunk = [coordinates[i]]
                accumulated_dist = 0.0

        if len(current_chunk) > 1:
            segment_chunks.append(current_chunk)

        # Step 2: Evaluate each segment with Predictive Downstream Traffic
        evaluated_segments = []
        hotspots = []
        
        cumulative_dist_m = 0.0
        cumulative_elapsed_s = 0.0
        
        clear_dist_m = 0.0
        moderate_dist_m = 0.0
        heavy_dist_m = 0.0
        severe_dist_m = 0.0
        total_delay_s = 0.0

        for seg_idx, chunk_coords in enumerate(segment_chunks):
            # Calculate segment length
            seg_dist_m = 0.0
            for j in range(1, len(chunk_coords)):
                seg_dist_m += cls.haversine_distance(chunk_coords[j - 1], chunk_coords[j])
            
            # Midpoint coordinate of the segment
            mid_idx = len(chunk_coords) // 2
            mid_lon, mid_lat = chunk_coords[mid_idx][0], chunk_coords[mid_idx][1]

            # Predictive arrival offset: When will the driver physically reach this segment?
            prediction_offset_min = cumulative_elapsed_s / 60.0

            # Real-time traffic factor telemetry at that predicted timestamp
            traffic_factors = LiveTrafficService.get_point_traffic_factors(
                lat=mid_lat, 
                lon=mid_lon, 
                prediction_offset_min=prediction_offset_min
            )

            # In emergency mode, emergency vehicles experience lower baseline congestion
            if is_emergency_mode:
                traffic_factors["current_speed_kmh"] = min(
                    traffic_factors["freeflow_speed_kmh"], 
                    traffic_factors["current_speed_kmh"] * 1.5 + 10.0
                )
                if traffic_factors["congestion_level"] == CongestionLevel.SEVERE.value:
                    traffic_factors["congestion_level"] = CongestionLevel.HEAVY.value
                elif traffic_factors["congestion_level"] == CongestionLevel.HEAVY.value:
                    traffic_factors["congestion_level"] = CongestionLevel.MODERATE.value
                elif traffic_factors["congestion_level"] == CongestionLevel.MODERATE.value:
                    traffic_factors["congestion_level"] = CongestionLevel.LOW.value

            current_speed_kmh = max(5.0, traffic_factors["current_speed_kmh"])
            freeflow_speed_kmh = max(20.0, traffic_factors["freeflow_speed_kmh"])
            
            # Duration and delay calculation
            speed_ms = (current_speed_kmh * 1000.0) / 3600.0
            freeflow_ms = (freeflow_speed_kmh * 1000.0) / 3600.0
            
            seg_duration_s = seg_dist_m / max(0.5, speed_ms)
            seg_freeflow_s = seg_dist_m / max(0.5, freeflow_ms)
            seg_delay_s = max(0.0, seg_duration_s - seg_freeflow_s)

            # Find matching step road name if available
            matching_road_name = "Arterial Road"
            seg_center_dist = cumulative_dist_m + (seg_dist_m / 2.0)
            step_acc_dist = 0.0
            for step in steps:
                step_d = step.get("distance", 0.0)
                if step_acc_dist <= seg_center_dist <= (step_acc_dist + step_d):
                    if step.get("name"):
                        matching_road_name = step["name"]
                    break
                step_acc_dist += step_d

            # Accumulate distance categories
            level = traffic_factors["congestion_level"]
            if level == CongestionLevel.LOW.value:
                clear_dist_m += seg_dist_m
            elif level == CongestionLevel.MODERATE.value:
                moderate_dist_m += seg_dist_m
            elif level == CongestionLevel.HEAVY.value:
                heavy_dist_m += seg_dist_m
            elif level == CongestionLevel.SEVERE.value:
                severe_dist_m += seg_dist_m

            total_delay_s += seg_delay_s

            evaluated_segments.append({
                "segment_index": seg_idx,
                "coordinates": chunk_coords,
                "distance_meters": round(seg_dist_m, 1),
                "duration_seconds": round(seg_duration_s, 1),
                "freeflow_speed_kmh": round(freeflow_speed_kmh, 1),
                "current_speed_kmh": round(current_speed_kmh, 1),
                "delay_seconds": round(seg_delay_s, 1),
                "congestion_level": level,
                "color": traffic_factors["color"],
                "congestion_factor": traffic_factors["congestion_factor"],
                "density_index": traffic_factors["density_index"],
                "predicted_arrival_time_min": round(prediction_offset_min, 1),
                "road_name": matching_road_name,
            })

            # Detect if this segment qualifies as a critical Bottleneck Hotspot
            if level in [CongestionLevel.MODERATE.value, CongestionLevel.HEAVY.value, CongestionLevel.SEVERE.value]:
                # Include heavy/severe bottlenecks, or moderate segments with meaningful delay or named bottlenecks
                if level in [CongestionLevel.HEAVY.value, CongestionLevel.SEVERE.value] or seg_delay_s >= 20.0 or (traffic_factors.get("location_name") and traffic_factors.get("location_name") != "Urban Arterial Corridor"):
                    hotspot_id = f"hotspot_{seg_idx}_{round(mid_lat, 3)}_{round(mid_lon, 3)}"
                    loc_name = traffic_factors.get("location_name") or matching_road_name
                    if loc_name == "Urban Arterial Corridor":
                        loc_name = f"Near {matching_road_name}"

                    # Avoid duplicate adjacent hotspots
                    if not hotspots or hotspots[-1]["location_name"] != loc_name:
                        hotspots.append({
                            "hotspot_id": hotspot_id,
                            "location_name": loc_name,
                            "lat": round(mid_lat, 5),
                            "lon": round(mid_lon, 5),
                            "distance_from_origin_m": round(cumulative_dist_m + (seg_dist_m / 2.0), 1),
                            "congestion_level": level,
                            "average_speed_kmh": round(current_speed_kmh, 1),
                            "estimated_delay_seconds": round(seg_delay_s, 1),
                            "description": traffic_factors.get("incident_description") or f"Slow moving traffic at {round(current_speed_kmh)} km/h",
                            "cause": "Traffic Volume & Choke Point Bottleneck",
                        })

            cumulative_dist_m += seg_dist_m
            cumulative_elapsed_s += seg_duration_s

        return {
            "segments": evaluated_segments,
            "hotspots": hotspots,
            "clear_distance_km": round(clear_dist_m / 1000.0, 2),
            "moderate_distance_km": round(moderate_dist_m / 1000.0, 2),
            "heavy_distance_km": round(heavy_dist_m / 1000.0, 2),
            "severe_distance_km": round(severe_dist_m / 1000.0, 2),
            "total_delay_seconds": round(total_delay_s, 1),
        }
```


## `backend\services\nominatim.py`

```python
from typing import List, Dict, Any
import httpx
from core.config import settings

class NominatimService:
    @staticmethod
    async def search_places(query: str) -> List[Dict[str, Any]]:
        """Search places via Nominatim API bounded to Bengaluru region with static fallback for reliability."""
        sanitized_query = query.strip()
        if "bengaluru" not in sanitized_query.lower() and "bangalore" not in sanitized_query.lower():
            sanitized_query = f"{sanitized_query}, Bengaluru, India"

        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "q": sanitized_query,
            "format": "json",
            "viewbox": "77.46,13.15,77.75,12.80",
            "bounded": "1",
            "limit": "5"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/search", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    results = []
                    for item in data:
                        results.append({
                            "display_name": item.get("display_name", ""),
                            "lat": float(item.get("lat", 0.0)),
                            "lon": float(item.get("lon", 0.0)),
                            "place_id": str(item.get("place_id", "")),
                            "address_type": item.get("addresstype", item.get("type", "unknown"))
                        })
                    if results:
                        return results
                    return []
        except Exception as err:
            print(f"[Nominatim WARNING] Search place online lookup failed: {err}")

        return []

    @staticmethod
    async def reverse_geocode(lat: float, lon: float) -> str:
        """Reverse geocode latitude & longitude coordinates to a clean street/place name."""
        headers = {
            "User-Agent": "ApexGuardian/1.0 (contact@apexguardian.local)"
        }
        params = {
            "format": "json",
            "lat": lat,
            "lon": lon,
            "zoom": "18",
            "addressdetails": "1"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(f"{settings.NOMINATIM_BASE_URL}/reverse", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    address = data.get("address", {})
                    short_name = (
                        address.get("road") or
                        address.get("suburb") or
                        address.get("neighbourhood") or
                        address.get("amenity") or
                        data.get("display_name", "").split(",")[0]
                    )
                    if short_name:
                        suburb = address.get("suburb", "")
                        if suburb and suburb.lower() not in short_name.lower():
                            return f"{short_name}, {suburb}"
                        return short_name
                    if data.get("display_name"):
                        return data["display_name"].split(",")[0]
        except Exception:
            pass

        return f"Location ({lat:.5f}, {lon:.5f})"
```


## `backend\services\notification_service.py`

```python
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from schemas.navigation import PushNotificationPayload

logger = logging.getLogger("apexguardian.notifications")

class PushNotificationService:
    """Mobile Push Notification Service (Feature 5).
    
    Dispatches alerts to mobile devices and browsers (via Web Push / Firebase Cloud Messaging).
    Triggers:
    a) Upcoming congestion alerts on user's active route
    b) Dynamic route change & faster reroute suggestions
    """

    _dispatch_log = []

    @classmethod
    def create_congestion_alert(
        cls, 
        location_name: str, 
        distance_meters: float, 
        delay_minutes: float, 
        speed_kmh: float
    ) -> PushNotificationPayload:
        """Generates proactive push notification payload for upcoming congestion."""
        dist_str = f"{distance_meters / 1000.0:.1f} km" if distance_meters >= 1000 else f"{int(distance_meters)} m"
        title = f"⚠️ Congestion Ahead ({dist_str})"
        body = f"Heavy traffic near {location_name}. Flow speed: {int(speed_kmh)} km/h (+{int(delay_minutes)} min delay)."
        
        payload = PushNotificationPayload(
            title=title,
            body=body,
            icon="/icons/alert-icon.png",
            tag="congestion-alert",
            data={
                "type": "CONGESTION_ALERT",
                "location_name": location_name,
                "distance_meters": distance_meters,
                "delay_minutes": delay_minutes,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        cls._log_dispatch(payload)
        return payload

    @classmethod
    def create_reroute_alert(
        cls, 
        time_saved_minutes: float, 
        via_road: str
    ) -> PushNotificationPayload:
        """Generates push notification payload for faster alternative route."""
        title = f"🚀 Faster Route Available (Save {int(time_saved_minutes)} min)"
        body = f"We found a faster alternative via {via_road} that bypasses upcoming delays."
        
        payload = PushNotificationPayload(
            title=title,
            body=body,
            icon="/icons/reroute-icon.png",
            tag="reroute-suggestion",
            data={
                "type": "REROUTE_SUGGESTION",
                "time_saved_minutes": time_saved_minutes,
                "via_road": via_road,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        cls._log_dispatch(payload)
        return payload

    @classmethod
    def _log_dispatch(cls, payload: PushNotificationPayload):
        entry = {
            "title": payload.title,
            "body": payload.body,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        cls._dispatch_log.append(entry)
        if len(cls._dispatch_log) > 100:
            cls._dispatch_log.pop(0)
        logger.info(f"[PushNotification] Dispatched: {payload.title} - {payload.body}")

    @classmethod
    def get_recent_dispatches(cls):
        return list(reversed(cls._dispatch_log))
```


## `backend\services\osrm.py`

```python
from typing import Any, Dict, List, Sequence, Tuple

import httpx
from fastapi import HTTPException

from core.config import settings


class OSRMService:
    """Street-snapped driving route service via public OSRM-compatible APIs."""

    @staticmethod
    def _parse_osrm_response(data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse and validate route candidates returned by an OSRM-compatible server."""
        raw_routes = data.get("routes", [])
        if data.get("code") != "Ok" or not raw_routes:
            return []

        candidates = []
        for idx, route in enumerate(raw_routes):
            all_steps = []
            for leg in route.get("legs", []):
                all_steps.extend(leg.get("steps", []))

            distance = float(route.get("distance", 0.0))
            duration = float(route.get("duration", 0.0))
            geometry = route.get("geometry", {})
            coordinates = geometry.get("coordinates", []) if isinstance(geometry, dict) else []

            if distance <= 0 or duration <= 0 or len(coordinates) < 2 or not all_steps:
                continue

            candidates.append({
                "route_index": idx,
                "distance_meters": distance,
                "duration_seconds": duration,
                "geometry": geometry,
                "steps": all_steps,
            })
        return candidates

    @classmethod
    async def _fetch_candidates(cls, coordinate_string: str, alternatives: bool) -> List[Dict[str, Any]]:
        endpoints = [
            f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{coordinate_string}",
            f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{coordinate_string}",
        ]
        headers = {"User-Agent": "ApexGuardian/2.0 (navigation@apexguardian.local)"}
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
        }
        if alternatives:
            params["alternatives"] = "true"

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            for endpoint in endpoints:
                try:
                    response = await client.get(endpoint, params=params, headers=headers)
                    if response.status_code != 200:
                        print(f"[OSRM] Endpoint returned {response.status_code}, trying next...")
                        continue

                    candidates = cls._parse_osrm_response(response.json())
                    if candidates:
                        print(f"[OSRM] Success: {len(candidates)} route(s) returned.")
                        return candidates
                except Exception as err:
                    print(f"[OSRM] Endpoint {endpoint} failed: {err}")

        raise HTTPException(
            status_code=503,
            detail="Routing service temporarily unavailable. All OSRM endpoints failed.",
        )

    @classmethod
    async def get_routes(
        cls, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
    ) -> List[Dict[str, Any]]:
        """Fetch street-snapped driving alternatives between an origin and destination."""
        coordinate_string = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
        return await cls._fetch_candidates(coordinate_string, alternatives=True)

    @classmethod
    async def get_routes_via_waypoints(
        cls, waypoints: Sequence[Tuple[float, float]]
    ) -> List[Dict[str, Any]]:
        """Fetch a route constrained through ordered ``(latitude, longitude)`` waypoints."""
        if len(waypoints) < 3:
            raise ValueError("A bypass route requires an origin, a via waypoint, and a destination.")
        if any(not (-90 <= lat <= 90 and -180 <= lon <= 180) for lat, lon in waypoints):
            raise ValueError("OSRM waypoints must be valid (latitude, longitude) pairs.")

        coordinate_string = ";".join(f"{lon},{lat}" for lat, lon in waypoints)
        return await cls._fetch_candidates(coordinate_string, alternatives=False)
```


## `backend\services\reroute_engine.py`

```python
import logging
import math
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

from ml.recommender import RouteScorer
from schemas.navigation import CandidateRoute, RerouteRecommendation, TrafficTestMode
from services.congestion_detector import CongestionDetector
from services.osrm import OSRMService
from services.traffic_scenario import apply_traffic_test_scenario

logger = logging.getLogger("apexguardian.reroute")


def haversine_distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Return the great-circle distance between two longitude/latitude pairs."""
    earth_radius_m = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return earth_radius_m * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def compute_bypass_waypoint(
    hotspot_lat: float,
    hotspot_lon: float,
    approach_bearing_deg: float,
    offset_km: float = 1.0,
) -> Tuple[float, float]:
    """Place a waypoint to one side of a hotspot, perpendicular to the approach."""
    bearing = math.radians((approach_bearing_deg + 90.0) % 360.0)
    angular_distance = max(0.1, offset_km) / 6371.0
    lat1 = math.radians(hotspot_lat)
    lon1 = math.radians(hotspot_lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540.0) % 360.0 - 180.0


def _bearing_degrees(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> float:
    lat1 = math.radians(start_lat)
    lat2 = math.radians(end_lat)
    delta_lon = math.radians(end_lon - start_lon)
    y = math.sin(delta_lon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def _distance_from_point_to_segment_m(
    point_lon: float,
    point_lat: float,
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
) -> float:
    """Approximate the closest distance to a short route segment in local meters."""
    mean_lat = math.radians((point_lat + start_lat + end_lat) / 3.0)
    meters_per_degree_lat = 111_132.0
    meters_per_degree_lon = 111_320.0 * math.cos(mean_lat)
    ax = (start_lon - point_lon) * meters_per_degree_lon
    ay = (start_lat - point_lat) * meters_per_degree_lat
    bx = (end_lon - point_lon) * meters_per_degree_lon
    by = (end_lat - point_lat) * meters_per_degree_lat
    dx = bx - ax
    dy = by - ay
    length_squared = dx * dx + dy * dy
    t = 0.0 if length_squared == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length_squared))
    return math.hypot(ax + t * dx, ay + t * dy)


def route_intersects_avoid_hotspots(
    geometry: Dict[str, Any], avoid_hotspots: Sequence[Dict[str, float]]
) -> bool:
    """Check route vertices and segments against circular avoid zones."""
    coordinates = geometry.get("coordinates", []) if isinstance(geometry, dict) else []
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return False

    for zone in avoid_hotspots:
        try:
            lat = float(zone["lat"])
            lon = float(zone["lon"])
            radius_m = float(zone.get("radius_km", 0.6)) * 1000.0
        except (KeyError, TypeError, ValueError):
            continue
        if not all(math.isfinite(value) for value in (lat, lon, radius_m)) or radius_m <= 0:
            continue

        for coordinate in coordinates:
            if not isinstance(coordinate, (list, tuple)) or len(coordinate) < 2:
                continue
            route_lon, route_lat = float(coordinate[0]), float(coordinate[1])
            if math.isfinite(route_lon) and math.isfinite(route_lat):
                if haversine_distance_m(lon, lat, route_lon, route_lat) <= radius_m:
                    return True

        for start, end in zip(coordinates, coordinates[1:]):
            if len(start) < 2 or len(end) < 2:
                continue
            values = (float(start[0]), float(start[1]), float(end[0]), float(end[1]))
            if not all(math.isfinite(value) for value in values):
                continue
            if _distance_from_point_to_segment_m(lon, lat, *values) <= radius_m:
                return True
    return False


class DynamicRerouteEngine:
    """Generate and evaluate street-snapped alternatives from the current position."""

    @staticmethod
    def _process_candidate(
        candidate: Dict[str, Any],
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        dist_to_dest_direct: float,
        is_emergency_mode: bool,
        traffic_test_mode: TrafficTestMode,
        traffic_progress: float,
    ) -> Optional[CandidateRoute]:
        route_dist_m = candidate.get("distance_meters", 0.0)
        base_dur_s = candidate.get("duration_seconds", 0.0)
        geometry = candidate.get("geometry", {})
        steps = candidate.get("steps", [])

        if (
            not isinstance(route_dist_m, (int, float))
            or not isinstance(base_dur_s, (int, float))
            or not math.isfinite(route_dist_m)
            or not math.isfinite(base_dur_s)
            or route_dist_m <= 0
            or base_dur_s <= 0
        ):
            logger.warning("Rejecting reroute candidate with invalid distance or duration")
            return None

        coordinates = geometry.get("coordinates", []) if isinstance(geometry, dict) else []
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            logger.warning("Rejecting reroute candidate: insufficient coordinates")
            return None
        try:
            if any(
                not isinstance(point, (list, tuple))
                or len(point) < 2
                or not math.isfinite(float(point[0]))
                or not math.isfinite(float(point[1]))
                for point in coordinates
            ):
                logger.warning("Rejecting reroute candidate: malformed or non-finite coordinates")
                return None
            coordinates = [[float(point[0]), float(point[1])] for point in coordinates]
        except (TypeError, ValueError):
            logger.warning("Rejecting reroute candidate: malformed coordinates")
            return None

        if not isinstance(steps, list) or not steps:
            logger.warning("Rejecting reroute candidate: no steps found")
            return None

        start_lon, start_lat = coordinates[0]
        distance_from_vehicle = haversine_distance_m(current_lon, current_lat, start_lon, start_lat)
        if distance_from_vehicle > 250:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=current-point-mismatch candidateStartDistanceMeters=%.1f", distance_from_vehicle)
            return None

        end_lon, end_lat = coordinates[-1]
        distance_from_dest = haversine_distance_m(dest_lon, dest_lat, end_lon, end_lat)
        if distance_from_dest > 250:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=destination-point-mismatch candidateEndDistanceMeters=%.1f", distance_from_dest)
            return None

        if dist_to_dest_direct > 500.0 and route_dist_m < dist_to_dest_direct - 500.0:
            logger.warning(
                "[REROUTE CANDIDATE REJECTED] reason=reported-route-shorter-than-direct-distance directMeters=%.1f reportedRouteMeters=%.1f",
                dist_to_dest_direct,
                route_dist_m,
            )
            return None

        polyline_distance_m = 0.0
        max_jump_m = 0.0
        for start, end in zip(coordinates, coordinates[1:]):
            segment_distance = haversine_distance_m(start[0], start[1], end[0], end[1])
            polyline_distance_m += segment_distance
            max_jump_m = max(max_jump_m, segment_distance)

        if max_jump_m > 2_000.0:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=teleport-geometry-detected maxJumpMeters=%.1f", max_jump_m)
            return None
        if polyline_distance_m < 50.0 and route_dist_m > 1_000.0:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=absurd-distance-mismatch polylineDistance=%.1f reported=%.1f", polyline_distance_m, route_dist_m)
            return None
        if dist_to_dest_direct > 5_000.0 and route_dist_m < 1_000.0:
            logger.warning("[REROUTE CANDIDATE REJECTED] reason=route-too-short-for-distance currentToDest=%.1f routeDist=%.1f", dist_to_dest_direct, route_dist_m)
            return None

        candidate["route_id"] = str(uuid.uuid4())
        candidate["source"] = "reroute"
        candidate["original_route_index"] = candidate.get("route_index", 0)
        candidate["geometry"] = {**geometry, "coordinates": coordinates}

        analysis = CongestionDetector.analyze_route(
            geometry=candidate["geometry"],
            steps=steps,
            total_distance_m=route_dist_m,
            base_duration_s=base_dur_s,
            is_emergency_mode=is_emergency_mode,
        )
        if not is_emergency_mode:
            analysis = apply_traffic_test_scenario(analysis, traffic_test_mode, traffic_progress)

        candidate["segments"] = analysis["segments"]
        candidate["hotspots"] = analysis["hotspots"]
        candidate["clear_distance_km"] = analysis["clear_distance_km"]
        candidate["moderate_distance_km"] = analysis["moderate_distance_km"]
        candidate["heavy_distance_km"] = analysis["heavy_distance_km"]
        candidate["severe_distance_km"] = analysis["severe_distance_km"]
        candidate["total_delay_seconds"] = analysis["total_delay_seconds"]

        live_delay = analysis["total_delay_seconds"]
        ml_predicted_duration = candidate.get("predicted_duration_seconds", base_dur_s)
        final_predicted_duration = max(ml_predicted_duration, base_dur_s + live_delay)
        candidate["predicted_duration_seconds"] = final_predicted_duration
        candidate["predicted_duration_minutes"] = round(final_predicted_duration / 60.0, 1)
        return CandidateRoute(**candidate)

    @staticmethod
    def _score_and_process(
        raw_candidates: List[Dict[str, Any]],
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        dist_to_dest_direct: float,
        is_emergency_mode: bool,
        traffic_test_mode: TrafficTestMode,
        traffic_progress: float,
    ) -> List[CandidateRoute]:
        evaluated = RouteScorer.evaluate_routes(
            raw_candidates,
            origin_lat=current_lat,
            origin_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            is_emergency_mode=is_emergency_mode,
        )
        processed: List[CandidateRoute] = []
        for candidate in evaluated:
            try:
                route = DynamicRerouteEngine._process_candidate(
                    candidate,
                    current_lat,
                    current_lon,
                    dest_lat,
                    dest_lon,
                    dist_to_dest_direct,
                    is_emergency_mode,
                    traffic_test_mode,
                    traffic_progress,
                )
            except Exception:
                logger.exception("Rejecting reroute candidate after processing failure")
                continue
            if route is not None:
                processed.append(route)
        return processed

    @classmethod
    async def evaluate_reroute(
        cls,
        current_lat: float,
        current_lon: float,
        dest_lat: float,
        dest_lon: float,
        original_remaining_duration_s: float,
        avoid_hotspots: Optional[List[Dict[str, float]]] = None,
        is_emergency_mode: bool = False,
        traffic_test_mode: TrafficTestMode = TrafficTestMode.REAL,
        traffic_progress: float = 0.0,
    ) -> RerouteRecommendation:
        """Evaluate alternatives, attempting a waypoint bypass around supplied avoid zones."""
        try:
            direct_distance_m = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
            if direct_distance_m <= 500.0:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="You are close to your destination. Continue on the current route.",
                )

            # Emergency routing is defined as the physical fastest path; congestion
            # avoidance must not divert an emergency vehicle from that path.
            zones = [] if is_emergency_mode else list(avoid_hotspots or [])
            try:
                raw_candidates = await OSRMService.get_routes(current_lat, current_lon, dest_lat, dest_lon)
            except Exception as error:
                logger.warning("Native OSRM alternatives unavailable: %s", error)
                raw_candidates = []
            processed = cls._score_and_process(
                raw_candidates,
                current_lat,
                current_lon,
                dest_lat,
                dest_lon,
                direct_distance_m,
                is_emergency_mode,
                traffic_test_mode,
                traffic_progress,
            )

            clean_routes = [
                route for route in processed
                if not route_intersects_avoid_hotspots(route.geometry, zones)
            ]
            bypass_routes: List[CandidateRoute] = []

            if zones and not clean_routes:
                valid_zones = []
                for zone in zones:
                    try:
                        lat, lon = float(zone["lat"]), float(zone["lon"])
                        if math.isfinite(lat) and math.isfinite(lon):
                            valid_zones.append((lat, lon))
                    except (KeyError, TypeError, ValueError):
                        continue

                if valid_zones:
                    hotspot_lat, hotspot_lon = min(
                        valid_zones,
                        key=lambda point: haversine_distance_m(current_lon, current_lat, point[1], point[0])
                        + haversine_distance_m(point[1], point[0], dest_lon, dest_lat),
                    )
                    approach_bearing = _bearing_degrees(current_lat, current_lon, dest_lat, dest_lon)
                    left_waypoint = compute_bypass_waypoint(hotspot_lat, hotspot_lon, approach_bearing)
                    right_waypoint = compute_bypass_waypoint(hotspot_lat, hotspot_lon, approach_bearing + 180.0)
                    via_waypoint = min(
                        (left_waypoint, right_waypoint),
                        key=lambda point: haversine_distance_m(current_lon, current_lat, point[1], point[0])
                        + haversine_distance_m(point[1], point[0], dest_lon, dest_lat),
                    )

                    try:
                        bypass_candidates = await OSRMService.get_routes_via_waypoints(
                            [(current_lat, current_lon), via_waypoint, (dest_lat, dest_lon)]
                        )
                        bypass_routes = cls._score_and_process(
                            bypass_candidates,
                            current_lat,
                            current_lon,
                            dest_lat,
                            dest_lon,
                            direct_distance_m,
                            is_emergency_mode,
                            traffic_test_mode,
                            traffic_progress,
                        )
                    except Exception as error:
                        logger.warning("Waypoint bypass routing failed: %s", error)

                    clean_bypass_routes = [
                        route for route in bypass_routes
                        if not route_intersects_avoid_hotspots(route.geometry, zones)
                    ]
                    clean_routes.extend(clean_bypass_routes)

            # Avoidance is a route-intent request, not a faster-route request. Never
            # recommend a dirty fallback when the user explicitly asked to avoid zones.
            if zones and not clean_routes:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    is_congestion_avoidance=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="No alternate route avoids this stretch — continuing on the only available path.",
                )

            candidates = clean_routes if zones else processed
            candidates.sort(key=lambda route: route.predicted_duration_seconds)

            if not candidates:
                return RerouteRecommendation(
                    is_reroute_recommended=False,
                    is_congestion_avoidance=False,
                    time_saved_seconds=0.0,
                    time_saved_minutes=0.0,
                    original_remaining_seconds=original_remaining_duration_s,
                    recommended_duration_seconds=original_remaining_duration_s,
                    recommended_route=None,
                    alternative_routes=[],
                    reason="No viable alternative paths found from current location.",
                )

            best_route = candidates[0]
            for route in candidates:
                route.is_ai_recommended = False
                route.recommendation_label = ""
            best_duration_s = best_route.predicted_duration_seconds
            reference_duration_s = original_remaining_duration_s if original_remaining_duration_s > 0 else (
                candidates[1].predicted_duration_seconds if len(candidates) > 1 else best_duration_s
            )
            eta_delta_s = reference_duration_s - best_duration_s
            time_saved_s = eta_delta_s if zones else max(0.0, eta_delta_s)
            time_saved_min = round(time_saved_s / 60.0, 1)
            is_recommended = bool(zones) or time_saved_s >= 90.0

            best_route.is_ai_recommended = is_recommended
            if is_recommended and zones:
                best_route.recommendation_label = "Avoids Congestion"
            elif is_recommended and not zones:
                best_route.recommendation_label = f"Fastest Route (Save {int(time_saved_min)}m)"
            else:
                best_route.recommendation_label = ""

            if is_recommended and zones:
                if eta_delta_s < -30:
                    reason = f"A validated route avoids the reported congestion areas; estimated ETA is about {int(round(abs(time_saved_min)))} minutes longer."
                elif eta_delta_s <= 30:
                    reason = "A validated route avoids the reported congestion areas with a similar estimated ETA."
                else:
                    reason = f"A validated route avoids the reported congestion areas and is about {int(round(time_saved_min))} minutes faster."
            elif is_recommended:
                reason = f"Clearer traffic corridor saves about {int(time_saved_min)} minutes."
            else:
                reason = "Current route remains the fastest available path."

            recommended_route = best_route if is_recommended else None
            logger.info(
                "[REROUTE DEBUG] evaluated_candidate_eta_s=%.1f original_remaining_eta_s=%.1f saved_s=%.1f is_recommended=%s avoidance_requested=%s",
                best_duration_s,
                reference_duration_s,
                time_saved_s,
                is_recommended,
                bool(zones),
            )
            return RerouteRecommendation(
                is_reroute_recommended=is_recommended,
                is_congestion_avoidance=bool(zones and is_recommended),
                time_saved_seconds=round(time_saved_s, 1),
                time_saved_minutes=time_saved_min,
                original_remaining_seconds=round(reference_duration_s, 1),
                recommended_duration_seconds=round(best_duration_s, 1),
                recommended_route=recommended_route,
                alternative_routes=candidates,
                reason=reason,
            )
        except Exception as error:
            logger.exception("Error during dynamic reroute evaluation")
            return RerouteRecommendation(
                is_reroute_recommended=False,
                time_saved_seconds=0.0,
                time_saved_minutes=0.0,
                original_remaining_seconds=original_remaining_duration_s,
                recommended_duration_seconds=original_remaining_duration_s,
                recommended_route=None,
                alternative_routes=[],
                reason=f"Rerouting engine encountered an error: {error}",
            )
```


## `backend\services\route_selection.py`

```python
from typing import List, TypeVar

T = TypeVar("T")


def rank_processed_routes(routes: List[T]) -> List[T]:
    """Order fully scored routes by final predicted travel time and label the winner."""
    routes.sort(key=lambda route: route.predicted_duration_seconds)
    for index, route in enumerate(routes):
        route.is_ai_recommended = index == 0
        route.recommendation_label = "Recommended Route" if index == 0 else "Standard Route"
    return routes
```


## `backend\services\traffic_scenario.py`

```python
from typing import Any, Dict

from schemas.navigation import CongestionLevel, TrafficTestMode


SCENARIO_SPEED_RATIO = {
    CongestionLevel.LOW: 0.90,
    CongestionLevel.MODERATE: 0.68,
    CongestionLevel.HEAVY: 0.42,
    CongestionLevel.SEVERE: 0.20,
}

SCENARIO_COLOR = {
    CongestionLevel.LOW: "#16A34A",
    CongestionLevel.MODERATE: "#EAB308",
    CongestionLevel.HEAVY: "#F97316",
    CongestionLevel.SEVERE: "#DC2626",
}


def dynamic_traffic_phase(progress: float) -> CongestionLevel:
    if progress < 0.22:
        return CongestionLevel.LOW
    if progress < 0.43:
        return CongestionLevel.MODERATE
    if progress < 0.76:
        return CongestionLevel.HEAVY
    return CongestionLevel.LOW


def apply_traffic_test_scenario(
    analysis: Dict[str, Any], mode: TrafficTestMode, progress: float = 0.0
) -> Dict[str, Any]:
    """Apply controlled debug traffic to analyzed road segments, never to route geometry."""
    if mode == TrafficTestMode.REAL:
        return analysis

    phase = {
        TrafficTestMode.NORMAL: CongestionLevel.LOW,
        TrafficTestMode.MODERATE: CongestionLevel.MODERATE,
        TrafficTestMode.HEAVY: CongestionLevel.HEAVY,
        TrafficTestMode.SEVERE: CongestionLevel.SEVERE,
    }.get(mode, dynamic_traffic_phase(progress))

    segments = analysis["segments"]
    total_distance = sum(segment["distance_meters"] for segment in segments) or 1.0
    along = 0.0
    delay_total = 0.0
    distance_by_level = {level: 0.0 for level in CongestionLevel}
    hotspots = []
    focus_start = min(0.88, progress + 0.12) if mode == TrafficTestMode.DYNAMIC else 0.42
    focus_end = min(1.0, focus_start + 0.20) if mode == TrafficTestMode.DYNAMIC else 0.68

    for segment in segments:
        distance = segment["distance_meters"]
        center_ratio = (along + distance / 2.0) / total_distance
        in_focus = phase != CongestionLevel.LOW and focus_start <= center_ratio <= focus_end
        level = phase if in_focus else CongestionLevel.LOW
        ratio = SCENARIO_SPEED_RATIO[level]
        freeflow_speed = max(20.0, segment.get("freeflow_speed_kmh", 45.0))
        speed = freeflow_speed * ratio
        segment_duration = distance / max(0.5, speed / 3.6)
        freeflow_duration = distance / max(0.5, freeflow_speed / 3.6)
        delay = max(0.0, segment_duration - freeflow_duration)
        segment.update({
            "congestion_level": level.value,
            "current_speed_kmh": round(speed, 1),
            "duration_seconds": round(segment_duration, 1),
            "delay_seconds": round(delay, 1),
            "congestion_factor": round(1.0 / ratio, 2),
            "color": SCENARIO_COLOR[level],
        })
        delay_total += delay
        distance_by_level[level] += distance

        coordinates = segment.get("coordinates", [])
        if in_focus and coordinates:
            lon, lat = coordinates[len(coordinates) // 2]
            hotspots.append({
                "hotspot_id": f"test-{mode.value}-{segment['segment_index']}",
                "location_name": segment.get("road_name") or "Traffic ahead",
                "lat": lat,
                "lon": lon,
                "distance_from_origin_m": round(along + distance / 2.0, 1),
                "congestion_level": level.value,
                "average_speed_kmh": round(speed, 1),
                "estimated_delay_seconds": round(delay, 1),
                "description": "Traffic is moving more slowly on this road.",
                "cause": "Controlled traffic test",
            })
        along += distance

    analysis["hotspots"] = hotspots
    analysis["total_delay_seconds"] = round(delay_total, 1)
    analysis["clear_distance_km"] = round(distance_by_level[CongestionLevel.LOW] / 1000.0, 2)
    analysis["moderate_distance_km"] = round(distance_by_level[CongestionLevel.MODERATE] / 1000.0, 2)
    analysis["heavy_distance_km"] = round(distance_by_level[CongestionLevel.HEAVY] / 1000.0, 2)
    analysis["severe_distance_km"] = round(distance_by_level[CongestionLevel.SEVERE] / 1000.0, 2)
    return analysis
```


## `backend\services\traffic_service.py`

```python
import math
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from schemas.navigation import CongestionLevel

class LiveTrafficService:
    """Real-Time Traffic Factor Integration Service (Feature 2).
    
    Ingests and synthesizes real-time traffic telemetry including:
    - Average vehicle speeds (km/h)
    - Traffic density index (0 to 100 vehicles/km)
    - Freeflow baseline speeds
    - Incident / bottleneck choke points
    - Time-of-day historical modulation
    - Pluggable external Traffic API feeds (TomTom / Google Traffic / live probe streams)
    """

    # Major Bengaluru Traffic Corridors & Historical Bottleneck Nodes
    KNOWN_BOTTLENECKS = [
        {
            "id": "silk_board",
            "name": "Central Silk Board Junction",
            "lat": 12.9177,
            "lon": 77.6238,
            "radius_km": 1.2,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 12.0,
            "density_peak": 92.0,
            "incident": "High Volume Choke Point & Metro Construction",
        },
        {
            "id": "marathahalli",
            "name": "Marathahalli Innovative Multiplex Bridge",
            "lat": 12.9562,
            "lon": 77.7011,
            "radius_km": 1.0,
            "freeflow_speed": 50.0,
            "typical_peak_speed": 14.0,
            "density_peak": 88.0,
            "incident": "ORR Heavy Commuter Inflow",
        },
        {
            "id": "tin_factory",
            "name": "Tin Factory / KR Puram Hanging Bridge",
            "lat": 12.9982,
            "lon": 77.6749,
            "radius_km": 1.1,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 10.0,
            "density_peak": 95.0,
            "incident": "Old Madras Road & Outer Ring Road Convergence",
        },
        {
            "id": "hebbal",
            "name": "Hebbal Flyover Junction",
            "lat": 13.0358,
            "lon": 77.5970,
            "radius_km": 1.2,
            "freeflow_speed": 60.0,
            "typical_peak_speed": 16.0,
            "density_peak": 85.0,
            "incident": "Airport Corridor Merge",
        },
        {
            "id": "koramangala_sony",
            "name": "Sony World Signal, Koramangala 80ft Road",
            "lat": 12.9348,
            "lon": 77.6276,
            "radius_km": 0.8,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 15.0,
            "density_peak": 82.0,
            "incident": "Commercial Corridor Density",
        },
        {
            "id": "whitefield_itpl",
            "name": "ITPL Main Road, Whitefield",
            "lat": 12.9857,
            "lon": 77.7318,
            "radius_km": 1.0,
            "freeflow_speed": 45.0,
            "typical_peak_speed": 13.0,
            "density_peak": 87.0,
            "incident": "Tech Park Peak Exit Delay",
        },
        {
            "id": "indiranagar_100ft",
            "name": "100ft Road / 12th Main Indiranagar",
            "lat": 12.9719,
            "lon": 77.6412,
            "radius_km": 0.7,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 18.0,
            "density_peak": 75.0,
            "incident": "Retail Traffic & Curbside Friction",
        },
        {
            "id": "mg_road_trinity",
            "name": "MG Road / Trinity Circle",
            "lat": 12.9733,
            "lon": 77.6186,
            "radius_km": 0.8,
            "freeflow_speed": 40.0,
            "typical_peak_speed": 17.0,
            "density_peak": 78.0,
            "incident": "CBD Core Intersection",
        },
        {
            "id": "ecity_toll",
            "name": "Electronic City Toll Gate / Elevated Tollway",
            "lat": 12.8452,
            "lon": 77.6602,
            "radius_km": 1.0,
            "freeflow_speed": 65.0,
            "typical_peak_speed": 22.0,
            "density_peak": 79.0,
            "incident": "Hosur Road Commute Surge",
        },
    ]


    @classmethod
    def haversine_km(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Computes great-circle distance in kilometers between two GPS coordinates."""
        r = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
        return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @classmethod
    def get_time_of_day_traffic_intensity(cls, dt: Optional[datetime] = None) -> float:
        """Returns time-of-day traffic intensity multiplier (0.0 to 1.0) based on Bengaluru commuting curves."""
        if dt is None:
            dt = datetime.now(timezone.utc)
            
        # Convert UTC to Indian Standard Time (UTC+5:30)
        ist_hour = (dt.hour + 5 + (dt.minute + 30) // 60) % 24
        ist_minute = (dt.minute + 30) % 60
        time_dec = ist_hour + ist_minute / 60.0
        is_weekend = dt.weekday() in [5, 6]

        if is_weekend:
            # Weekend peak (12:00 PM to 9:00 PM)
            if 12.0 <= time_dec <= 21.0:
                return 0.65 + 0.25 * math.sin((time_dec - 12.0) / 9.0 * math.pi)
            elif 21.0 < time_dec <= 23.5:
                return 0.40
            else:
                return 0.20

        # Weekday: Morning Peak (8:30 AM to 11:30 AM) & Evening Peak (5:00 PM to 9:30 PM)
        if 8.5 <= time_dec <= 11.5:
            return 0.85 + 0.15 * math.sin((time_dec - 8.5) / 3.0 * math.pi)
        elif 17.0 <= time_dec <= 21.5:
            return 0.90 + 0.10 * math.sin((time_dec - 17.0) / 4.5 * math.pi)
        elif 11.5 < time_dec < 17.0:
            return 0.55  # Moderate afternoon traffic
        elif 21.5 < time_dec <= 23.5:
            return 0.35  # Late evening tapering
        else:
            return 0.15  # Night / early morning freeflow

    @classmethod
    def get_point_traffic_factors(
        cls, 
        lat: float, 
        lon: float, 
        prediction_offset_min: float = 0.0,
        now_dt: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Calculates real-time & predictive traffic factors for a given point.
        
        Considers:
        - Proximity to known bottleneck hubs
        - Time-of-day curve (evaluated at current time + prediction_offset_min)
        - Dynamic live incident feeds
        """
        if now_dt is None:
            now_dt = datetime.now(timezone.utc)

        future_timestamp = now_dt.timestamp() + (prediction_offset_min * 60)
        future_dt = datetime.fromtimestamp(future_timestamp, tz=timezone.utc)
        time_intensity = cls.get_time_of_day_traffic_intensity(future_dt)

        # Baseline freeflow conditions
        freeflow_speed = 45.0
        current_speed = freeflow_speed
        density_index = 20.0 + (time_intensity * 35.0)  # Base density 20 - 55%
        active_hotspot = None
        min_dist = float('inf')

        # Check proximity to known bottleneck nodes
        for node in cls.KNOWN_BOTTLENECKS:
            dist = cls.haversine_km(lat, lon, node["lat"], node["lon"])
            if dist <= node["radius_km"]:
                if dist < min_dist:
                    min_dist = dist
                    active_hotspot = node


        if active_hotspot:
            # Inside a bottleneck impact zone
            radius = max(0.1, active_hotspot.get("radius_km", 1.0))
            impact_ratio = max(0.0, min(1.0, 1.0 - (min_dist / radius)))
            peak_speed = active_hotspot.get("typical_peak_speed", 12.0)
            node_freeflow = active_hotspot.get("freeflow_speed", 45.0)
            
            effective_intensity = max(0.65, time_intensity)
            
            # Speed degradation proportional to proximity & intensity
            speed_drop = (node_freeflow - peak_speed) * effective_intensity * impact_ratio
            current_speed = max(5.0, node_freeflow - speed_drop)
            freeflow_speed = node_freeflow
            
            peak_density = active_hotspot.get("density_peak", 90.0)
            density_index = min(98.0, density_index + (peak_density - density_index) * impact_ratio * effective_intensity)
            location_name = active_hotspot["name"]
            incident_desc = active_hotspot.get("incident", "High Congestion Area")
        else:
            # General urban arterial (non-bottleneck road segments)
            # Rebalanced so ordinary roads stay CLEAR under standard and moderate peak conditions,
            # ensuring congestion colors (amber/red/crimson) are concentrated at actual bottlenecks.
            general_drop = 5.0 * time_intensity
            current_speed = max(25.0, freeflow_speed - general_drop)
            location_name = "Urban Arterial Corridor"
            incident_desc = None

        # Determine Congestion Level & Factor
        speed_ratio = current_speed / max(1.0, freeflow_speed)
        congestion_factor = freeflow_speed / max(1.0, current_speed)

        # Shared severity thresholds use current speed as a ratio of free-flow speed:
        # LOW >= 0.80, MODERATE >= 0.50, HEAVY >= 0.25, otherwise SEVERE.
        if speed_ratio >= 0.80:
            congestion_level = CongestionLevel.LOW
            color = "#16A34A"  # Green
        elif speed_ratio >= 0.50:
            congestion_level = CongestionLevel.MODERATE
            color = "#EAB308"  # Yellow
        elif speed_ratio >= 0.25:
            congestion_level = CongestionLevel.HEAVY
            color = "#F97316"  # Orange
        else:
            congestion_level = CongestionLevel.SEVERE
            color = "#DC2626"  # Red

        return {
            "location_name": location_name,
            "lat": lat,
            "lon": lon,
            "current_speed_kmh": round(current_speed, 1),
            "freeflow_speed_kmh": round(freeflow_speed, 1),
            "density_index": round(density_index, 1),
            "congestion_level": congestion_level.value,
            "congestion_factor": round(congestion_factor, 2),
            "color": color,
            "incident_description": incident_desc,
            "time_intensity": round(time_intensity, 2)
        }


    @classmethod
    def get_all_active_hotspots(cls) -> List[Dict[str, Any]]:
        """Returns list of all active bottleneck locations with real-time status."""
        results = []
        for bn in cls.KNOWN_BOTTLENECKS:
            tf = cls.get_point_traffic_factors(bn["lat"], bn["lon"])
            results.append({
                **bn,
                **tf
            })
        return results
```


## `backend\tests\__init__.py`

```python
# Tests package initialization
```


## `backend\tests\test_api.py`

```python
from fastapi.testclient import TestClient

from api.v1 import endpoints
from main import app


client = TestClient(app)


def test_route_defaults_to_real_traffic_without_test_hotspots(monkeypatch):
    origin_lat, origin_lon = 12.9756, 77.6066
    dest_lat, dest_lon = 12.9352, 77.6245
    candidate = {
        "route_index": 0,
        "distance_meters": 5200.0,
        "duration_seconds": 720.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [origin_lon, origin_lat],
                [77.6150, 12.9550],
                [dest_lon, dest_lat],
            ],
        },
        "steps": [{"name": "Test Road", "distance": 5200.0, "duration": 720.0}],
    }

    async def mock_get_routes(**kwargs):
        return [candidate.copy()]

    monkeypatch.setattr(endpoints.OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(
        endpoints.RouteScorer,
        "evaluate_routes",
        staticmethod(lambda routes, *args, **kwargs: routes),
    )

    response = client.post(
        "/api/v1/route",
        json={
            "origin_lat": origin_lat,
            "origin_lon": origin_lon,
            "dest_lat": dest_lat,
            "dest_lon": dest_lon,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["routes_count"] > 0
    assert all(
        hotspot.get("cause") != "Controlled traffic test"
        for route in data["candidates"]
        for hotspot in route["hotspots"]
    )
```


## `backend\tests\test_ml_pipeline.py`

```python
import pytest
from types import SimpleNamespace
from ml.recommender import RouteScorer
from services.route_selection import rank_processed_routes
from services.traffic_scenario import apply_traffic_test_scenario
from schemas.navigation import TrafficTestMode

def test_emergency_mode_bypass():
    mock_routes = [{
        "distance_meters": 10000.0,
        "duration_seconds": 1200.0,
        "steps": []
    }]
    
    # Run in emergency mode
    evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51, is_emergency_mode=True)
    
    assert len(evaluated) == 1
    # Congestion factor must be exactly 1.0
    assert evaluated[0]["congestion_factor"] == 1.0
    # Predicted duration should match standard duration
    assert evaluated[0]["predicted_duration_seconds"] == 1200.0

def test_computed_fields():
    mock_routes = [
        {
            "distance_meters": 10000.0, # 10km
            "duration_seconds": 1200.0, # 20 mins
            "steps": []
        },
        {
            "distance_meters": 12000.0, # 12km
            "duration_seconds": 1800.0, # 30 mins
            "steps": []
        }
    ]
    
    evaluated = RouteScorer.evaluate_routes(mock_routes, 12.9, 77.5, 12.91, 77.51, is_emergency_mode=True)
    
    assert len(evaluated) == 2
    
    route1 = next(r for r in evaluated if r["distance_meters"] == 10000.0)
    route2 = next(r for r in evaluated if r["distance_meters"] == 12000.0)
    
    assert route1["predicted_average_speed_kmh"] == 30.0 # 10km / (20/60)h
    assert route2["predicted_average_speed_kmh"] == 24.0 # 12km / (30/60)h
    
    # Route 2 is the slowest (30 mins). Delay savings for route 1 = 30 - 20 = 10 mins
    assert route1["delay_savings_minutes"] == 10.0
    # Route 2 saves nothing compared to itself
    assert route2["delay_savings_minutes"] == 0.0


def test_moderate_traffic_keeps_shorter_effective_eta():
    current = SimpleNamespace(predicted_duration_seconds=1200, is_ai_recommended=False, recommendation_label="")
    alternative = SimpleNamespace(predicted_duration_seconds=1380, is_ai_recommended=False, recommendation_label="")

    ranked = rank_processed_routes([alternative, current])

    assert ranked[0] is current
    assert current.is_ai_recommended is True
    assert alternative.is_ai_recommended is False


def test_heavy_or_severe_delay_can_change_recommended_route():
    current = SimpleNamespace(predicted_duration_seconds=2700, is_ai_recommended=False, recommendation_label="")
    alternative = SimpleNamespace(predicted_duration_seconds=1440, is_ai_recommended=False, recommendation_label="")

    ranked = rank_processed_routes([current, alternative])

    assert ranked[0] is alternative
    assert alternative.recommendation_label == "Recommended Route"


def test_test_traffic_scenarios_change_only_backend_segment_evaluation():
    base_analysis = {
        "segments": [
            {
                "segment_index": index,
                "coordinates": [[77.60 + index * 0.0054, 12.97], [77.60 + (index + 1) * 0.0054, 12.97]],
                "distance_meters": 500.0,
                "duration_seconds": 40.0,
                "freeflow_speed_kmh": 45.0,
                "current_speed_kmh": 45.0,
                "delay_seconds": 0.0,
                "congestion_level": "LOW",
                "color": "#16A34A",
                "congestion_factor": 1.0,
                "density_index": 20.0,
                "predicted_arrival_time_min": float(index),
                "road_name": "Test Road",
            }
            for index in range(10)
        ],
        "hotspots": [],
        "clear_distance_km": 5.0,
        "moderate_distance_km": 0.0,
        "heavy_distance_km": 0.0,
        "severe_distance_km": 0.0,
        "total_delay_seconds": 0.0,
    }

    real_result = apply_traffic_test_scenario(base_analysis, TrafficTestMode.REAL)
    assert real_result is base_analysis
    assert all(segment["congestion_level"] == "LOW" for segment in real_result["segments"])

    test_result = apply_traffic_test_scenario(base_analysis, TrafficTestMode.SEVERE)
    severe_segments = [segment for segment in test_result["segments"] if segment["congestion_level"] == "SEVERE"]
    assert severe_segments
    assert test_result["hotspots"]
    assert all(hotspot["congestion_level"] == "SEVERE" for hotspot in test_result["hotspots"])
    assert all(segment["color"] == "#DC2626" for segment in severe_segments)
```


## `backend\tests\test_new_features.py`

```python
import pytest
from fastapi.testclient import TestClient
from main import app
from services.traffic_service import LiveTrafficService
from services.congestion_detector import CongestionDetector
from services.notification_service import PushNotificationService

client = TestClient(app)

def test_health_features():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "features" in data
    assert "congestion_point_identification" in data["features"]
    assert "dynamic_alternative_rerouting" in data["features"]

def test_live_traffic_service_point_factors():
    # Silk board area coordinates
    factors = LiveTrafficService.get_point_traffic_factors(12.9177, 77.6238)
    assert "current_speed_kmh" in factors
    assert "congestion_level" in factors
    assert factors["current_speed_kmh"] > 0
    assert factors["congestion_level"] in ["LOW", "MODERATE", "HEAVY", "SEVERE"]
    assert factors["color"].startswith("#")



def test_congestion_detector_analyze():
    # Synthetic route between Indiranagar and Silk Board
    dummy_geometry = {
        "type": "LineString",
        "coordinates": [
            [77.6412, 12.9719],
            [77.6350, 12.9500],
            [77.6276, 12.9348],
            [77.6238, 12.9177]
        ]
    }
    dummy_steps = [
        {"name": "100 Feet Rd", "distance": 1500.0, "duration": 180.0},
        {"name": "Intermediate Ring Rd", "distance": 2500.0, "duration": 300.0},
        {"name": "Hosur Rd", "distance": 2000.0, "duration": 250.0}
    ]

    analysis = CongestionDetector.analyze_route(
        geometry=dummy_geometry,
        steps=dummy_steps,
        total_distance_m=6000.0,
        base_duration_s=730.0,
        is_emergency_mode=False
    )

    assert "segments" in analysis
    assert len(analysis["segments"]) > 0
    assert "hotspots" in analysis
    assert "clear_distance_km" in analysis
    assert "total_delay_seconds" in analysis
    
    first_seg = analysis["segments"][0]
    assert "color" in first_seg
    assert "congestion_level" in first_seg
    assert "predicted_arrival_time_min" in first_seg

def test_push_notification_service():
    payload = PushNotificationService.create_congestion_alert(
        location_name="Silk Board",
        distance_meters=1200.0,
        delay_minutes=8.0,
        speed_kmh=12.0
    )
    assert "Silk Board" in payload.body
    assert "1.2 km" in payload.title
    
    reroute_payload = PushNotificationService.create_reroute_alert(
        time_saved_minutes=7.0,
        via_road="Koramangala 100ft Road"
    )
    assert "7 min" in reroute_payload.title

def test_traffic_factors_endpoint():
    response = client.get("/api/v1/traffic/factors?lat=12.9716&lon=77.5946")
    assert response.status_code == 200
    data = response.json()
    assert "current_speed_kmh" in data
    assert "density_index" in data

def test_traffic_hotspots_endpoint():
    response = client.get("/api/v1/traffic/hotspots")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["hotspots"]) > 0

def test_dynamic_reroute_endpoint():
    payload = {
        "current_lat": 12.9756,
        "current_lon": 77.6066,
        "dest_lat": 12.9352,
        "dest_lon": 77.6245,
        "remaining_seconds": 1200.0,
        "is_emergency_mode": False
    }
    response = client.post("/api/v1/reroute/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "is_reroute_recommended" in data
    assert "reason" in data
    assert "original_remaining_seconds" in data
    assert "recommended_duration_seconds" in data

def test_nearest_point_along_route_calculation():
    # Verify spatial projection logic for seamless reroute vehicle alignment
    coords = [
        [77.6000, 12.9700],
        [77.6050, 12.9700],
        [77.6100, 12.9700],
        [77.6150, 12.9700],
    ]
    current_pt = [77.6052, 12.9701]

    # Calculate nearest coordinate index
    min_dist = float("inf")
    closest_idx = 0
    for i, c in enumerate(coords):
        d = CongestionDetector.haversine_distance(current_pt, c)
        if d < min_dist:
            min_dist = d
            closest_idx = i

    assert closest_idx == 1  # [77.6050, 12.9700] is nearest

    # Calculate cumulative distance up to closest point
    running_dist = 0.0
    for i in range(1, closest_idx + 1):
        running_dist += CongestionDetector.haversine_distance(coords[i-1], coords[i])
    assert running_dist > 500.0
```


## `backend\tests\test_reroute_validation.py`

```python
import asyncio
import math
from services.reroute_engine import DynamicRerouteEngine, haversine_distance_m

def test_reject_short_teleport_reroute():
    """
    Test that a 100m route is rejected when the vehicle is 9km away from destination.
    """
    # Current location
    current_lat, current_lon = 12.9716, 77.5946
    
    # Destination ~ 9km away
    dest_lat, dest_lon = 13.0520, 77.5946
    dist_to_dest = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
    assert dist_to_dest > 8000
    
    # Mock candidate geometry that is only 100m long, but starts near the vehicle
    # The end point of this candidate is nowhere near the destination
    end_lat, end_lon = 12.9725, 77.5946
    candidate = {
        "distance_meters": 100.0,
        "duration_seconds": 12.0,
        "geometry": {
            "coordinates": [[current_lon, current_lat], [end_lon, end_lat]]
        },
        "steps": [{"distance": 100, "duration": 12}]
    }
    
    # Patch the OSRM & ML parts
    import services.osrm
    import ml.recommender
    
    async def mock_get_routes(*args, **kwargs):
        return [candidate]
        
    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    
    try:
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1500
        ))
        
        # Should reject because end point is not near destination
        assert rec.is_reroute_recommended is False
        assert rec.recommended_route is None
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

def test_accept_valid_faster_reroute():
    """
    Test that a valid alternative route that saves time is recommended.
    """
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0520, 77.5946
    
    candidate = {
        "route_index": 0,
        "distance_meters": 9200.0,
        "duration_seconds": 1000.0,  # ~16 mins
        "geometry": {
            "coordinates": [
                [current_lon, current_lat],
                [current_lon, 12.9866],
                [current_lon, 13.0016],
                [current_lon, 13.0166],
                [current_lon, 13.0316],
                [current_lon, 13.0466],
                [dest_lon, dest_lat]
            ]
        },
        "steps": [{"distance": 9200, "duration": 1000}]
    }
    
    import services.osrm
    import ml.recommender
    
    async def mock_get_routes(*args, **kwargs):
        return [candidate]
        
    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    
    try:
        # Original ETA is 26 minutes (1560s)
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1560
        ))
        
        # The segment analyzer may add delay to the OSRM/ML estimate.
        assert rec.is_reroute_recommended is True
        assert rec.recommended_route is not None
        assert abs(rec.time_saved_seconds - (1560.0 - rec.recommended_duration_seconds)) < 0.1
        assert rec.time_saved_seconds >= 90.0
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

def test_reject_zero_distance_reroute_even_when_geometry_reaches_destination():
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 12.9916, 77.5946
    candidate = {
        "route_index": 0,
        "distance_meters": 0.0,
        "duration_seconds": 0.0,
        "geometry": {"coordinates": [[current_lon, current_lat], [dest_lon, dest_lat]]},
        "steps": [{"distance": 0.0, "duration": 0.0}],
    }

    import services.osrm
    import ml.recommender

    async def mock_get_routes(*args, **kwargs):
        return [candidate]

    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    try:
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=1200,
        ))
        assert rec.is_reroute_recommended is False
        assert rec.recommended_route is None
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval

def test_does_not_evaluate_reroutes_within_500m_of_destination():
    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 12.97175, 77.5946
    distance_m = haversine_distance_m(current_lon, current_lat, dest_lon, dest_lat)
    candidate = {
        "route_index": 0,
        "distance_meters": distance_m,
        "duration_seconds": 5.0,
        "geometry": {"coordinates": [[current_lon, current_lat], [dest_lon, dest_lat]]},
        "steps": [{"distance": distance_m, "duration": 5.0}],
    }

    import services.osrm
    import ml.recommender

    async def mock_get_routes(*args, **kwargs):
        return [candidate]

    def mock_evaluate_routes(routes, *args, **kwargs):
        return routes

    original_get = services.osrm.OSRMService.get_routes
    original_eval = ml.recommender.RouteScorer.evaluate_routes
    services.osrm.OSRMService.get_routes = mock_get_routes
    ml.recommender.RouteScorer.evaluate_routes = mock_evaluate_routes
    try:
        rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
            current_lat=current_lat,
            current_lon=current_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            original_remaining_duration_s=120,
        ))
        assert rec.is_reroute_recommended is False
        assert rec.alternative_routes == []
        assert "Continue on the current route" in rec.reason
    finally:
        services.osrm.OSRMService.get_routes = original_get
        ml.recommender.RouteScorer.evaluate_routes = original_eval


def test_avoid_zone_detects_segment_crossing_between_route_vertices():
    from services.reroute_engine import route_intersects_avoid_hotspots

    geometry = {
        "coordinates": [[77.5846, 13.0116], [77.6046, 13.0116]],
    }
    assert route_intersects_avoid_hotspots(
        geometry, [{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}]
    )


def test_native_avoidance_candidate_is_offered_even_when_slower(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    native_bypass = {
        "route_index": 0,
        "distance_meters": 12000.0,
        "duration_seconds": 1600.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [77.5946, 12.9716], [77.6021, 12.9791], [77.6096, 12.9866],
                [77.6096, 12.9941], [77.6096, 13.0016], [77.6096, 13.0091],
                [77.6096, 13.0166], [77.6096, 13.0241], [77.6096, 13.0316],
                [77.6096, 13.0391], [77.6021, 13.0466], [77.5946, 13.0516],
            ],
        },
        "steps": [{"name": "Native Bypass Road", "distance": 12000.0, "duration": 1600.0}],
    }
    waypoint_calls = []

    async def mock_get_routes(*args, **kwargs):
        return [native_bypass.copy()]

    async def unexpected_waypoint_request(*args, **kwargs):
        waypoint_calls.append(True)
        return []

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(unexpected_waypoint_request))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=1200.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    ))

    assert rec.is_reroute_recommended
    assert rec.is_congestion_avoidance
    assert rec.recommended_route is not None
    assert rec.time_saved_seconds < 0
    assert waypoint_calls == []


def test_emergency_reroute_does_not_apply_congestion_avoidance(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    direct_route = {
        "route_index": 0,
        "distance_meters": 9000.0,
        "duration_seconds": 700.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [[current_lon, current_lat + i * 0.01] for i in range(9)],
        },
        "steps": [{"name": "Direct Road", "distance": 9000.0, "duration": 700.0}],
    }

    async def mock_get_routes(*args, **kwargs):
        return [direct_route.copy()]

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=1500.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
        is_emergency_mode=True,
    ))

    assert rec.is_reroute_recommended
    assert not rec.is_congestion_avoidance
    assert rec.recommended_route is not None


def test_reroute_uses_waypoint_bypass_when_initial_routes_cross_avoid_zone(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer
    from services.reroute_engine import route_intersects_avoid_hotspots

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    initial_candidate = {
        "route_index": 0,
        "distance_meters": 9000.0,
        "duration_seconds": 700.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [[current_lon, current_lat + i * 0.01] for i in range(9)],
        },
        "steps": [{"name": "Direct Road", "distance": 9000.0, "duration": 700.0}],
    }
    bypass_coords = [
        [77.5946, 12.9716], [77.6096, 12.9816], [77.6096, 12.9916],
        [77.6096, 13.0016], [77.6096, 13.0116], [77.6096, 13.0216],
        [77.6096, 13.0316], [77.6096, 13.0416], [77.5946, 13.0516],
    ]
    bypass_candidate = {
        "route_index": 0,
        "distance_meters": 11000.0,
        "duration_seconds": 1300.0,
        "geometry": {"type": "LineString", "coordinates": bypass_coords},
        "steps": [{"name": "Bypass Road", "distance": 11000.0, "duration": 1300.0}],
    }
    bypass_request = {}

    async def mock_get_routes(*args, **kwargs):
        return [initial_candidate.copy()]

    async def mock_get_routes_via_waypoints(waypoints):
        bypass_request["waypoints"] = waypoints
        return [bypass_candidate.copy()]

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(mock_get_routes_via_waypoints))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=1200.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    ))

    assert len(bypass_request["waypoints"]) == 3
    assert rec.is_reroute_recommended
    assert rec.is_congestion_avoidance
    assert rec.recommended_route is not None
    assert rec.time_saved_seconds < 0  # The bypass is deliberately slower; avoidance still wins.
    assert not route_intersects_avoid_hotspots(
        rec.recommended_route.geometry,
        [{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    )
    assert "avoids the reported congestion areas" in rec.reason


def test_unavailable_bypass_is_explicit_and_does_not_claim_ai_optimal(monkeypatch):
    from services.osrm import OSRMService
    from ml.recommender import RouteScorer

    current_lat, current_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 13.0516, 77.5946
    candidate = {
        "route_index": 0,
        "distance_meters": 9000.0,
        "duration_seconds": 600.0,
        "geometry": {
            "type": "LineString",
            "coordinates": [[current_lon, current_lat + i * 0.01] for i in range(9)],
        },
        "steps": [{"name": "Direct Road", "distance": 9000.0, "duration": 600.0}],
    }

    async def mock_get_routes(*args, **kwargs):
        return [candidate.copy()]

    async def unavailable_bypass(*args, **kwargs):
        raise RuntimeError("no waypoint route")

    monkeypatch.setattr(OSRMService, "get_routes", staticmethod(mock_get_routes))
    monkeypatch.setattr(OSRMService, "get_routes_via_waypoints", staticmethod(unavailable_bypass))
    monkeypatch.setattr(RouteScorer, "evaluate_routes", staticmethod(lambda routes, *args, **kwargs: routes))

    rec = asyncio.run(DynamicRerouteEngine.evaluate_reroute(
        current_lat=current_lat,
        current_lon=current_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        original_remaining_duration_s=3000.0,
        avoid_hotspots=[{"lat": 13.0116, "lon": 77.5946, "radius_km": 0.6}],
    ))

    assert not rec.is_reroute_recommended
    assert not rec.is_congestion_avoidance
    assert rec.recommended_route is None
    assert rec.alternative_routes == []
    assert "No alternate route avoids this stretch" in rec.reason
```


## `frontend\next-env.d.ts`

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.
```


## `frontend\package-lock.json`

```json
{
  "name": "apexguardian-frontend",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "apexguardian-frontend",
      "version": "0.1.0",
      "dependencies": {
        "clsx": "^2.1.0",
        "framer-motion": "^11.0.8",
        "lucide-react": "^0.358.0",
        "maplibre-gl": "^4.1.1",
        "next": "^14.2.24",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "tailwind-merge": "^2.2.1"
      },
      "devDependencies": {
        "@types/node": "^20.11.28",
        "@types/react": "^18.2.66",
        "@types/react-dom": "^18.2.22",
        "autoprefixer": "^10.4.18",
        "postcss": "^8.4.35",
        "tailwindcss": "^3.4.1",
        "typescript": "^5.4.2"
      }
    },
    "node_modules/@alloc/quick-lru": {
      "version": "5.2.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@mapbox/geojson-rewind": {
      "version": "0.5.2",
      "license": "ISC",
      "dependencies": {
        "get-stream": "^6.0.1",
        "minimist": "^1.2.6"
      },
      "bin": {
        "geojson-rewind": "geojson-rewind"
      }
    },
    "node_modules/@mapbox/jsonlint-lines-primitives": {
      "version": "2.0.3",
      "license": "MIT",
      "engines": {
        "node": ">= 22"
      }
    },
    "node_modules/@mapbox/point-geometry": {
      "version": "0.1.0",
      "license": "ISC"
    },
    "node_modules/@mapbox/tiny-sdf": {
      "version": "2.2.0",
      "license": "BSD-2-Clause"
    },
    "node_modules/@mapbox/unitbezier": {
      "version": "0.0.1",
      "license": "BSD-2-Clause"
    },
    "node_modules/@mapbox/vector-tile": {
      "version": "1.3.1",
      "license": "BSD-3-Clause",
      "dependencies": {
        "@mapbox/point-geometry": "~0.1.0"
      }
    },
    "node_modules/@mapbox/whoots-js": {
      "version": "3.1.0",
      "license": "ISC",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@maplibre/maplibre-gl-style-spec": {
      "version": "20.4.0",
      "license": "ISC",
      "dependencies": {
        "@mapbox/jsonlint-lines-primitives": "~2.0.2",
        "@mapbox/unitbezier": "^0.0.1",
        "json-stringify-pretty-compact": "^4.0.0",
        "minimist": "^1.2.8",
        "quickselect": "^2.0.0",
        "rw": "^1.3.3",
        "tinyqueue": "^3.0.0"
      },
      "bin": {
        "gl-style-format": "dist/gl-style-format.mjs",
        "gl-style-migrate": "dist/gl-style-migrate.mjs",
        "gl-style-validate": "dist/gl-style-validate.mjs"
      }
    },
    "node_modules/@maplibre/maplibre-gl-style-spec/node_modules/quickselect": {
      "version": "2.0.0",
      "license": "ISC"
    },
    "node_modules/@next/env": {
      "version": "14.2.35",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-14.2.35.tgz",
      "integrity": "sha512-DuhvCtj4t9Gwrx80dmz2F4t/zKQ4ktN8WrMwOuVzkJfBilwAwGr6v16M5eI8yCuZ63H9TTuEU09Iu2HqkzFPVQ==",
      "license": "MIT"
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-14.2.33.tgz",
      "integrity": "sha512-HqYnb6pxlsshoSTubdXKu15g3iivcbsMXg4bYpjL2iS/V6aQot+iyF4BUc2qA/J/n55YtvE4PHMKWBKGCF/+wA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-14.2.33.tgz",
      "integrity": "sha512-8HGBeAE5rX3jzKvF593XTTFg3gxeU4f+UWnswa6JPhzaR6+zblO5+fjltJWIZc4aUalqTclvN2QtTC37LxvZAA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-14.2.33.tgz",
      "integrity": "sha512-JXMBka6lNNmqbkvcTtaX8Gu5by9547bukHQvPoLe9VRBx1gHwzf5tdt4AaezW85HAB3pikcvyqBToRTDA4DeLw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-14.2.33.tgz",
      "integrity": "sha512-Bm+QulsAItD/x6Ih8wGIMfRJy4G73tu1HJsrccPW6AfqdZd0Sfm5Imhgkgq2+kly065rYMnCOxTBvmvFY1BKfg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-14.2.33.tgz",
      "integrity": "sha512-FnFn+ZBgsVMbGDsTqo8zsnRzydvsGV8vfiWwUo1LD8FTmPTdV+otGSWKc4LJec0oSexFnCYVO4hX8P8qQKaSlg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-14.2.33.tgz",
      "integrity": "sha512-345tsIWMzoXaQndUTDv1qypDRiebFxGYx9pYkhwY4hBRaOLt8UGfiWKr9FSSHs25dFIf8ZqIFaPdy5MljdoawA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-14.2.33.tgz",
      "integrity": "sha512-nscpt0G6UCTkrT2ppnJnFsYbPDQwmum4GNXYTeoTIdsmMydSKFz9Iny2jpaRupTb+Wl298+Rh82WKzt9LCcqSQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-ia32-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-ia32-msvc/-/swc-win32-ia32-msvc-14.2.33.tgz",
      "integrity": "sha512-pc9LpGNKhJ0dXQhZ5QMmYxtARwwmWLpeocFmVG5Z0DzWq5Uf0izcI8tLc+qOpqxO1PWqZ5A7J1blrUIKrIFc7Q==",
      "cpu": [
        "ia32"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "14.2.33",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-14.2.33.tgz",
      "integrity": "sha512-nOjfZMy8B94MdisuzZo9/57xuFVLHJaDj5e/xrduJp9CV2/HrfxTRH2fbyLe+K9QT41WBLUd4iXX3R7jBp0EUg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@swc/counter": {
      "version": "0.1.3",
      "resolved": "https://registry.npmjs.org/@swc/counter/-/counter-0.1.3.tgz",
      "integrity": "sha512-e2BR4lsJkkRlKZ/qCHPw9ZaSxc0MVUd7gtbtaB7aMvHeJVYe8sOB8DBZkP2DtISHGSku9sCK6T6cnY0CtXrOCQ==",
      "license": "Apache-2.0"
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.5",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.5.tgz",
      "integrity": "sha512-KGYxvIOXcceOAbEk4bi/dVLEK9z8sZ0uBB3Il5b1rhfClSpcX0yfRO0KmTkqR2cnQDymwLB+25ZyMzICg/cm/A==",
      "license": "Apache-2.0",
      "dependencies": {
        "@swc/counter": "^0.1.3",
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@types/geojson": {
      "version": "7946.0.16",
      "license": "MIT"
    },
    "node_modules/@types/geojson-vt": {
      "version": "3.2.5",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*"
      }
    },
    "node_modules/@types/mapbox__point-geometry": {
      "version": "0.1.4",
      "license": "MIT"
    },
    "node_modules/@types/mapbox__vector-tile": {
      "version": "1.3.4",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*",
        "@types/mapbox__point-geometry": "*",
        "@types/pbf": "*"
      }
    },
    "node_modules/@types/node": {
      "version": "20.19.43",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/pbf": {
      "version": "3.0.5",
      "license": "MIT"
    },
    "node_modules/@types/prop-types": {
      "version": "15.7.15",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/react": {
      "version": "18.3.31",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "@types/prop-types": "*",
        "csstype": "^3.2.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "18.3.7",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^18.0.0"
      }
    },
    "node_modules/@types/supercluster": {
      "version": "7.1.3",
      "license": "MIT",
      "dependencies": {
        "@types/geojson": "*"
      }
    },
    "node_modules/any-promise": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/anymatch": {
      "version": "3.1.3",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "normalize-path": "^3.0.0",
        "picomatch": "^2.0.4"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/arg": {
      "version": "5.0.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/autoprefixer": {
      "version": "10.5.4",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/autoprefixer"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "browserslist": "^4.28.6",
        "caniuse-lite": "^1.0.30001806",
        "fraction.js": "^5.3.4",
        "picocolors": "^1.1.1",
        "postcss-value-parser": "^4.2.0"
      },
      "bin": {
        "autoprefixer": "bin/autoprefixer"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      },
      "peerDependencies": {
        "postcss": "^8.1.0"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.11.11",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/binary-extensions": {
      "version": "2.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/browserslist": {
      "version": "4.28.7",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "baseline-browser-mapping": "^2.10.44",
        "caniuse-lite": "^1.0.30001806",
        "electron-to-chromium": "^1.5.393",
        "node-releases": "^2.0.51",
        "update-browserslist-db": "^1.2.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/busboy": {
      "version": "1.6.0",
      "dependencies": {
        "streamsearch": "^1.1.0"
      },
      "engines": {
        "node": ">=10.16.0"
      }
    },
    "node_modules/camelcase-css": {
      "version": "2.0.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001806",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chokidar": {
      "version": "3.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "anymatch": "~3.1.2",
        "braces": "~3.0.2",
        "glob-parent": "~5.1.2",
        "is-binary-path": "~2.1.0",
        "is-glob": "~4.0.1",
        "normalize-path": "~3.0.0",
        "readdirp": "~3.6.0"
      },
      "engines": {
        "node": ">= 8.10.0"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/chokidar/node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/chokidar/node_modules/glob-parent": {
      "version": "5.1.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "license": "MIT"
    },
    "node_modules/clsx": {
      "version": "2.1.1",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/commander": {
      "version": "4.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/cssesc": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "bin": {
        "cssesc": "bin/cssesc"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/csstype": {
      "version": "3.2.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/didyoumean": {
      "version": "1.2.2",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/dlv": {
      "version": "1.1.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/earcut": {
      "version": "3.2.3",
      "license": "ISC"
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.399",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/fast-glob": {
      "version": "3.3.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.8"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fast-glob/node_modules/glob-parent": {
      "version": "5.1.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/fastq": {
      "version": "1.20.1",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/fraction.js": {
      "version": "5.3.4",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "*"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/rawify"
      }
    },
    "node_modules/framer-motion": {
      "version": "11.18.2",
      "license": "MIT",
      "dependencies": {
        "motion-dom": "^11.18.1",
        "motion-utils": "^11.18.1",
        "tslib": "^2.4.0"
      },
      "peerDependencies": {
        "@emotion/is-prop-valid": "*",
        "react": "^18.0.0 || ^19.0.0",
        "react-dom": "^18.0.0 || ^19.0.0"
      },
      "peerDependenciesMeta": {
        "@emotion/is-prop-valid": {
          "optional": true
        },
        "react": {
          "optional": true
        },
        "react-dom": {
          "optional": true
        }
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/geojson-vt": {
      "version": "4.0.3",
      "license": "ISC"
    },
    "node_modules/get-stream": {
      "version": "6.0.1",
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/gl-matrix": {
      "version": "3.4.4",
      "license": "MIT"
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/global-prefix": {
      "version": "4.0.0",
      "license": "MIT",
      "dependencies": {
        "ini": "^4.1.3",
        "kind-of": "^6.0.3",
        "which": "^4.0.0"
      },
      "engines": {
        "node": ">=16"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "license": "ISC"
    },
    "node_modules/hasown": {
      "version": "2.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/ieee754": {
      "version": "1.2.1",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/ini": {
      "version": "4.1.3",
      "license": "ISC",
      "engines": {
        "node": "^14.17.0 || ^16.13.0 || >=18.0.0"
      }
    },
    "node_modules/is-binary-path": {
      "version": "2.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "binary-extensions": "^2.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.16.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/isexe": {
      "version": "3.1.5",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/jiti": {
      "version": "1.21.7",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "bin": {
        "jiti": "bin/jiti.js"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "license": "MIT"
    },
    "node_modules/json-stringify-pretty-compact": {
      "version": "4.0.0",
      "license": "MIT"
    },
    "node_modules/kdbush": {
      "version": "4.1.0",
      "license": "ISC"
    },
    "node_modules/kind-of": {
      "version": "6.0.3",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/lilconfig": {
      "version": "3.1.3",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/antonk52"
      }
    },
    "node_modules/lines-and-columns": {
      "version": "1.2.4",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/loose-envify": {
      "version": "1.4.0",
      "license": "MIT",
      "dependencies": {
        "js-tokens": "^3.0.0 || ^4.0.0"
      },
      "bin": {
        "loose-envify": "cli.js"
      }
    },
    "node_modules/lucide-react": {
      "version": "0.358.0",
      "license": "ISC",
      "peerDependencies": {
        "react": "^16.5.1 || ^17.0.0 || ^18.0.0"
      }
    },
    "node_modules/maplibre-gl": {
      "version": "4.7.1",
      "license": "BSD-3-Clause",
      "dependencies": {
        "@mapbox/geojson-rewind": "^0.5.2",
        "@mapbox/jsonlint-lines-primitives": "^2.0.2",
        "@mapbox/point-geometry": "^0.1.0",
        "@mapbox/tiny-sdf": "^2.0.6",
        "@mapbox/unitbezier": "^0.0.1",
        "@mapbox/vector-tile": "^1.3.1",
        "@mapbox/whoots-js": "^3.1.0",
        "@maplibre/maplibre-gl-style-spec": "^20.3.1",
        "@types/geojson": "^7946.0.14",
        "@types/geojson-vt": "3.2.5",
        "@types/mapbox__point-geometry": "^0.1.4",
        "@types/mapbox__vector-tile": "^1.3.4",
        "@types/pbf": "^3.0.5",
        "@types/supercluster": "^7.1.3",
        "earcut": "^3.0.0",
        "geojson-vt": "^4.0.2",
        "gl-matrix": "^3.4.3",
        "global-prefix": "^4.0.0",
        "kdbush": "^4.0.2",
        "murmurhash-js": "^1.0.0",
        "pbf": "^3.3.0",
        "potpack": "^2.0.0",
        "quickselect": "^3.0.0",
        "supercluster": "^8.0.1",
        "tinyqueue": "^3.0.0",
        "vt-pbf": "^3.1.3"
      },
      "engines": {
        "node": ">=16.14.0",
        "npm": ">=8.1.0"
      },
      "funding": {
        "url": "https://github.com/maplibre/maplibre-gl-js?sponsor=1"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/motion-dom": {
      "version": "11.18.1",
      "license": "MIT",
      "dependencies": {
        "motion-utils": "^11.18.1"
      }
    },
    "node_modules/motion-utils": {
      "version": "11.18.1",
      "license": "MIT"
    },
    "node_modules/murmurhash-js": {
      "version": "1.0.0",
      "license": "MIT"
    },
    "node_modules/mz": {
      "version": "2.7.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0",
        "object-assign": "^4.0.1",
        "thenify-all": "^1.0.0"
      }
    },
    "node_modules/nanoid": {
      "version": "3.3.16",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/next": {
      "version": "14.2.35",
      "resolved": "https://registry.npmjs.org/next/-/next-14.2.35.tgz",
      "integrity": "sha512-KhYd2Hjt/O1/1aZVX3dCwGXM1QmOV4eNM2UTacK5gipDdPN/oHHK/4oVGy7X8GMfPMsUTUEmGlsy0EY1YGAkig==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "14.2.35",
        "@swc/helpers": "0.5.5",
        "busboy": "1.6.0",
        "caniuse-lite": "^1.0.30001579",
        "graceful-fs": "^4.2.11",
        "postcss": "8.4.31",
        "styled-jsx": "5.1.1"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": ">=18.17.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "14.2.33",
        "@next/swc-darwin-x64": "14.2.33",
        "@next/swc-linux-arm64-gnu": "14.2.33",
        "@next/swc-linux-arm64-musl": "14.2.33",
        "@next/swc-linux-x64-gnu": "14.2.33",
        "@next/swc-linux-x64-musl": "14.2.33",
        "@next/swc-win32-arm64-msvc": "14.2.33",
        "@next/swc-win32-ia32-msvc": "14.2.33",
        "@next/swc-win32-x64-msvc": "14.2.33"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.41.2",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/next/node_modules/postcss": {
      "version": "8.4.31",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.6",
        "picocolors": "^1.0.0",
        "source-map-js": "^1.0.2"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/node-releases": {
      "version": "2.0.51",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/normalize-path": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-hash": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/pbf": {
      "version": "3.3.0",
      "license": "BSD-3-Clause",
      "dependencies": {
        "ieee754": "^1.1.12",
        "resolve-protobuf-schema": "^2.1.0"
      },
      "bin": {
        "pbf": "bin/pbf"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "2.3.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pify": {
      "version": "2.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/pirates": {
      "version": "4.0.7",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.25",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "nanoid": "^3.3.16",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/postcss-import": {
      "version": "15.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "postcss-value-parser": "^4.0.0",
        "read-cache": "^1.0.0",
        "resolve": "^1.1.7"
      },
      "engines": {
        "node": ">=14.0.0"
      },
      "peerDependencies": {
        "postcss": "^8.0.0"
      }
    },
    "node_modules/postcss-js": {
      "version": "4.1.0",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "camelcase-css": "^2.0.1"
      },
      "engines": {
        "node": "^12 || ^14 || >= 16"
      },
      "peerDependencies": {
        "postcss": "^8.4.21"
      }
    },
    "node_modules/postcss-load-config": {
      "version": "6.0.1",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "lilconfig": "^3.1.1"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "jiti": ">=1.21.0",
        "postcss": ">=8.0.9",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        },
        "postcss": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/postcss-nested": {
      "version": "6.2.0",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "postcss-selector-parser": "^6.1.1"
      },
      "engines": {
        "node": ">=12.0"
      },
      "peerDependencies": {
        "postcss": "^8.2.14"
      }
    },
    "node_modules/postcss-selector-parser": {
      "version": "6.1.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cssesc": "^3.0.0",
        "util-deprecate": "^1.0.2"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/postcss-value-parser": {
      "version": "4.2.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/potpack": {
      "version": "2.1.0",
      "license": "ISC"
    },
    "node_modules/protocol-buffers-schema": {
      "version": "3.6.1",
      "license": "MIT"
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/quickselect": {
      "version": "3.0.0",
      "license": "ISC"
    },
    "node_modules/react": {
      "version": "18.3.1",
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "loose-envify": "^1.1.0"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "18.3.1",
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "loose-envify": "^1.1.0",
        "scheduler": "^0.23.2"
      },
      "peerDependencies": {
        "react": "^18.3.1"
      }
    },
    "node_modules/read-cache": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "pify": "^2.3.0"
      }
    },
    "node_modules/readdirp": {
      "version": "3.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "picomatch": "^2.2.1"
      },
      "engines": {
        "node": ">=8.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.12",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve-protobuf-schema": {
      "version": "2.1.0",
      "license": "MIT",
      "dependencies": {
        "protocol-buffers-schema": "^3.3.1"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/rw": {
      "version": "1.3.3",
      "license": "BSD-3-Clause"
    },
    "node_modules/scheduler": {
      "version": "0.23.2",
      "license": "MIT",
      "dependencies": {
        "loose-envify": "^1.1.0"
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/streamsearch": {
      "version": "1.1.0",
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.1",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/sucrase": {
      "version": "3.35.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.2",
        "commander": "^4.0.0",
        "lines-and-columns": "^1.1.6",
        "mz": "^2.7.0",
        "pirates": "^4.0.1",
        "tinyglobby": "^0.2.11",
        "ts-interface-checker": "^0.1.9"
      },
      "bin": {
        "sucrase": "bin/sucrase",
        "sucrase-node": "bin/sucrase-node"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/supercluster": {
      "version": "8.0.1",
      "license": "ISC",
      "dependencies": {
        "kdbush": "^4.0.2"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/tailwind-merge": {
      "version": "2.6.1",
      "license": "MIT",
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/dcastil"
      }
    },
    "node_modules/tailwindcss": {
      "version": "3.4.19",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@alloc/quick-lru": "^5.2.0",
        "arg": "^5.0.2",
        "chokidar": "^3.6.0",
        "didyoumean": "^1.2.2",
        "dlv": "^1.1.3",
        "fast-glob": "^3.3.2",
        "glob-parent": "^6.0.2",
        "is-glob": "^4.0.3",
        "jiti": "^1.21.7",
        "lilconfig": "^3.1.3",
        "micromatch": "^4.0.8",
        "normalize-path": "^3.0.0",
        "object-hash": "^3.0.0",
        "picocolors": "^1.1.1",
        "postcss": "^8.4.47",
        "postcss-import": "^15.1.0",
        "postcss-js": "^4.0.1",
        "postcss-load-config": "^4.0.2 || ^5.0 || ^6.0",
        "postcss-nested": "^6.2.0",
        "postcss-selector-parser": "^6.1.2",
        "resolve": "^1.22.8",
        "sucrase": "^3.35.0"
      },
      "bin": {
        "tailwind": "lib/cli.js",
        "tailwindcss": "lib/cli.js"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/thenify": {
      "version": "3.3.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "any-promise": "^1.0.0"
      }
    },
    "node_modules/thenify-all": {
      "version": "1.6.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "thenify": ">= 3.1.0 < 4"
      },
      "engines": {
        "node": ">=0.8"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyglobby/node_modules/fdir": {
      "version": "6.5.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/tinyglobby/node_modules/picomatch": {
      "version": "4.0.5",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/tinyqueue": {
      "version": "3.0.0",
      "license": "ISC"
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/ts-interface-checker": {
      "version": "0.1.13",
      "dev": true,
      "license": "Apache-2.0"
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "license": "0BSD"
    },
    "node_modules/typescript": {
      "version": "5.9.3",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/update-browserslist-db": {
      "version": "1.2.3",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/vt-pbf": {
      "version": "3.1.3",
      "license": "MIT",
      "dependencies": {
        "@mapbox/point-geometry": "0.1.0",
        "@mapbox/vector-tile": "^1.3.1",
        "pbf": "^3.2.1"
      }
    },
    "node_modules/which": {
      "version": "4.0.0",
      "license": "ISC",
      "dependencies": {
        "isexe": "^3.1.1"
      },
      "bin": {
        "node-which": "bin/which.js"
      },
      "engines": {
        "node": "^16.13.0 || >=18.0.0"
      }
    }
  }
}
```


## `frontend\package.json`

```json
{
  "name": "apexguardian-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "clsx": "^2.1.0",
    "framer-motion": "^11.0.8",
    "lucide-react": "^0.358.0",
    "maplibre-gl": "^4.1.1",
    "next": "^14.2.24",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/node": "^20.11.28",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2"
  }
}
```


## `frontend\postcss.config.js`

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```


## `frontend\src\app\globals.css`

```css
@import "maplibre-gl/dist/maplibre-gl.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #0f172a;
}

html,
body,
#root,
main {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
}

.glass-panel-dark {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

/* Custom scrollbars for drawers */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
}
```


## `frontend\src\app\layout.tsx`

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { NavigationProvider } from "@/context/NavigationContext";

export const metadata: Metadata = {
  title: "Apex Guardian - AI Navigation Engine",
  description: "AI-powered predictive navigation engine for Bengaluru",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body className="h-full w-full overflow-hidden bg-slate-900 text-slate-900 antialiased">
        <NavigationProvider>
          {children}
        </NavigationProvider>
      </body>
    </html>
  );
}
```


## `frontend\src\app\page.tsx`

```tsx
"use client";

import React from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { FloatingSearchPanel } from "@/components/ui/FloatingSearchPanel";
import { MapControls } from "@/components/ui/MapControls";
import { RouteCard } from "@/components/ui/RouteCard";
import { TurnByTurnDrawer } from "@/components/ui/TurnByTurnDrawer";
import { AdvanceAlertBanner } from "@/components/ui/AdvanceAlertBanner";
import { RerouteModal } from "@/components/ui/RerouteModal";
import { NavigationControlsHUD } from "@/components/ui/NavigationControlsHUD";
import { NoFasterRouteToast } from "@/components/ui/NoFasterRouteToast";
import { TrafficLegend } from "@/components/ui/TrafficLegend";
import { useNavigation } from "@/context/NavigationContext";
import { ShieldCheck, Wifi, WifiOff, Siren } from "lucide-react";
import { OVERLAY_Z } from "@/lib/layoutZones";

export default function Home() {
  const {
    backendOnline,
    isEmergencyMode,
    isNavigating,
    activeAlert,
    dismissAlert,
    activeRerouteRecommendation,
    dismissReroute,
    acceptReroute,
    triggerDynamicRerouteCheck,
    isApplyingReroute,
    noRouteReason,
    dismissNoRouteReason,
  } = useNavigation();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Full-bleed Map Canvas Base Layer */}
      <MapCanvas />

      {/* Feature 4: Advance Distance-Decrementing Proactive Alert Banner */}
      <AdvanceAlertBanner
        alert={activeAlert}
        onDismiss={dismissAlert}
        onCheckReroute={() => triggerDynamicRerouteCheck(true)}
        fasterRouteAvailable={!!activeRerouteRecommendation?.is_reroute_recommended}
      />

      {/* Feature 8 & 9: Fastest Alternative Route Modal */}
      <RerouteModal
        recommendation={activeRerouteRecommendation}
        onAccept={acceptReroute}
        onDismiss={dismissReroute}
        isApplying={isApplyingReroute}
      />

      {!activeRerouteRecommendation && (
        <NoFasterRouteToast reason={noRouteReason} onDismiss={dismissNoRouteReason} />
      )}

      {/* Active Driving Turn-by-Turn HUD & Simulation Controls */}
      <NavigationControlsHUD />

      {/* Left Sidebar UI Layout */}
      {!isNavigating && (
        <div className="fixed left-4 top-4 bottom-4 flex flex-col gap-4 w-[calc(100vw-32px)] sm:w-[420px] overflow-y-auto pointer-events-none" style={{ zIndex: OVERLAY_Z.sidebar }}>
          <FloatingSearchPanel />
          <RouteCard />
          <TurnByTurnDrawer />
          <TrafficLegend placement="sidebar" />
        </div>
      )}
      {isNavigating && <TrafficLegend placement="navigation" />}

      {/* Standard Map Controls (Zoom, Recenter, Layers) */}
      <MapControls />

      {/* Top-Right Backend Health & Mode Status Badges */}
      <div className="fixed top-4 right-4 flex items-center gap-2 pointer-events-auto" style={{ zIndex: OVERLAY_Z.statusBadge }}>
        {isEmergencyMode && (
          <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-black text-rose-600 border border-rose-500/50 bg-rose-50/95 animate-pulse">
            <Siren className="w-3.5 h-3.5 fill-current" />
            <span className="tracking-wide uppercase">Emergency Mode</span>
          </div>
        )}

        <div className="glass-panel px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg text-xs font-semibold">
          <div className="w-6 h-6 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span className="hidden sm:inline text-slate-700 font-bold">Apex Backend:</span>
          {backendOnline === null ? (
            <span className="text-slate-400">Connecting...</span>
          ) : backendOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-500 font-bold">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
```


## `frontend\src\components\map\MapCanvas.tsx`

```tsx
"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { TRAFFIC_COLORS } from "@/lib/trafficScenario";
import { useNavigation, BENGALURU_CENTER } from "@/context/NavigationContext";
import { reverseGeocode, CongestionHotspot } from "@/lib/api";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const mapRefContainer: { current: maplibregl.Map | null } = { current: null };

export const BENGALURU_MAX_BOUNDS: maplibregl.LngLatBoundsLike = [
  [77.4000, 12.8000], // South-West
  [77.8000, 13.1500], // North-East
];

export const MapCanvas: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const lastCameraFollowTimeRef = useRef<number>(0);

  const {
    selectedOrigin,
    setSelectedOrigin,
    setSourceQuery,
    selectedDestination,
    setSelectedDestination,
    setDestinationQuery,
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    recenterTrigger,
    setCurrentZoom,
    pinDropMode,
    setPinDropMode,
    calculateRoutes,
    activeLayerMode,
    isEmergencyMode,
    isNavigating,
    currentLocation,
    vehicleBearing,
    activeRerouteRecommendation,
    navigationHudHeight,
  } = useNavigation();

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-positron-hd": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "carto-positron-hd-layer",
            type: "raster",
            source: "carto-positron-hd",
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [BENGALURU_CENTER.lon, BENGALURU_CENTER.lat],
      zoom: 12.5,
      minZoom: 10,
      maxZoom: 19,
      maxBounds: BENGALURU_MAX_BOUNDS,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on("load", () => {
      map.resize();
    });

    map.on("zoom", () => setCurrentZoom(map.getZoom()));
    map.on("zoomend", () => setCurrentZoom(map.getZoom()));

    mapRef.current = map;
    mapRefContainer.current = map;

    const timer = setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      mapRefContainer.current = null;
    };
  }, [setCurrentZoom]);

  // Window Resize Listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapContainerRef.current) return;

    const handleResize = () => {
      if (mapRef.current) mapRef.current.resize();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mapContainerRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Update cursor based on pinDropMode
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = pinDropMode !== "none" ? "crosshair" : "";
    }
  }, [pinDropMode]);


  // Map Click Listener for Pin Drop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: maplibregl.MapMouseEvent) => {
      if (pinDropMode === "none") return;

      const { lng, lat } = e.lngLat;
      const roundedLat = parseFloat(lat.toFixed(5));
      const roundedLon = parseFloat(lng.toFixed(5));

      let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
      try {
        const rev = await reverseGeocode(roundedLat, roundedLon);
        if (rev && rev.display_name) resolvedName = rev.display_name;
      } catch (err) {
        console.error("Reverse geocode error:", err);
      }

      if (pinDropMode === "source") {
        const newOrigin = { lat: roundedLat, lon: roundedLon, name: resolvedName };
        setSelectedOrigin(newOrigin);
        setSourceQuery(resolvedName);
        setPinDropMode("none");
        if (selectedDestination) {
          await calculateRoutes(newOrigin, selectedDestination);
        }
      } else if (pinDropMode === "destination") {
        const newDest = { lat: roundedLat, lon: roundedLon, name: resolvedName };
        setSelectedDestination(newDest);
        setDestinationQuery(resolvedName);
        setPinDropMode("none");
        if (selectedOrigin) {
          await calculateRoutes(selectedOrigin, newDest);
        }
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [
    pinDropMode,
    selectedOrigin,
    selectedDestination,
    setSelectedOrigin,
    setSelectedDestination,
    setSourceQuery,
    setDestinationQuery,
    setPinDropMode,
    calculateRoutes,
  ]);

  // Origin Marker (Section 5: Matching Drop-Pin Style in Emerald Green)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedOrigin) {
      if (!originMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#10B981"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#047857"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedOrigin.lon, selectedOrigin.lat])
          .addTo(map);

        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));

          let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
          try {
            const rev = await reverseGeocode(roundedLat, roundedLon);
            if (rev && rev.display_name) resolvedName = rev.display_name;
          } catch (err) {
            console.error("Reverse geocode drag error:", err);
          }

          const newOrigin = { lat: roundedLat, lon: roundedLon, name: resolvedName };
          setSelectedOrigin(newOrigin);
          setSourceQuery(resolvedName);
          if (selectedDestination) {
            await calculateRoutes(newOrigin, selectedDestination);
          }
        });

        originMarkerRef.current = marker;
      } else {
        originMarkerRef.current.setLngLat([selectedOrigin.lon, selectedOrigin.lat]);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
  }, [selectedOrigin, selectedDestination, setSelectedOrigin, setSourceQuery, calculateRoutes]);

  // Destination Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedDestination) {
      if (!destMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "cursor-grab active:cursor-grabbing hover:scale-110 transition duration-300";
        el.innerHTML = `
          <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.163 24.837 0 16 0ZM16 22C12.686 22 10 19.314 10 16C10 12.686 12.686 10 16 10C19.314 10 22 12.686 22 16C22 19.314 19.314 22 16 22Z" fill="#EA4335"/>
            <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" fill="#7A0000"/>
          </svg>
        `;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: true })
          .setLngLat([selectedDestination.lon, selectedDestination.lat])
          .addTo(map);

        marker.on("dragend", async () => {
          const lngLat = marker.getLngLat();
          const roundedLat = parseFloat(lngLat.lat.toFixed(5));
          const roundedLon = parseFloat(lngLat.lng.toFixed(5));

          let resolvedName = `Location (${roundedLat}, ${roundedLon})`;
          try {
            const rev = await reverseGeocode(roundedLat, roundedLon);
            if (rev && rev.display_name) resolvedName = rev.display_name;
          } catch (err) {
            console.error("Reverse geocode drag error:", err);
          }

          const newDest = { lat: roundedLat, lon: roundedLon, name: resolvedName };
          setSelectedDestination(newDest);
          setDestinationQuery(resolvedName);
          if (selectedOrigin) {
            await calculateRoutes(selectedOrigin, newDest);
          }
        });

        destMarkerRef.current = marker;
      } else {
        destMarkerRef.current.setLngLat([selectedDestination.lon, selectedDestination.lat]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [selectedDestination, selectedOrigin, setSelectedDestination, setDestinationQuery, calculateRoutes]);

  // Smooth Vehicle Marker & Camera Follow (Section 4)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isNavigating && currentLocation) {
      if (!vehicleMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "relative flex items-center justify-center pointer-events-none";
        el.style.width = "42px";
        el.style.height = "42px";
        el.innerHTML = `
          <div class="absolute w-10 h-10 rounded-full bg-blue-500/25 animate-ping"></div>
          <div class="vehicle-inner relative w-9 h-9 rounded-full bg-slate-900 border-2 border-white shadow-2xl flex items-center justify-center transition-transform duration-75 ease-out">
            <svg class="w-5 h-5 text-blue-400 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </div>
        `;

        vehicleMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([currentLocation.lon, currentLocation.lat])
          .addTo(map);
      } else {
        // Smooth fractional position updates
        vehicleMarkerRef.current.setLngLat([currentLocation.lon, currentLocation.lat]);
        const innerIcon = vehicleMarkerRef.current.getElement().querySelector(".vehicle-inner") as HTMLElement;
        if (innerIcon) {
          innerIcon.style.transform = `rotate(${vehicleBearing}deg)`;
        }
      }

      // Smooth camera follow without competing with marker animation
      const now = performance.now();
      if (now - lastCameraFollowTimeRef.current > 200) {
        lastCameraFollowTimeRef.current = now;
        map.easeTo({
          center: [currentLocation.lon, currentLocation.lat],
          duration: 250,
          easing: (t) => t,
          zoom: Math.max(14.5, map.getZoom()),
          padding: {
            top: 0,
            bottom: isNavigating ? navigationHudHeight : 0,
            left: 0,
            right: 0,
          },
        });
      }
    } else if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }
  }, [isNavigating, currentLocation, vehicleBearing, navigationHudHeight]);

  // Render Multi-Color Congestion Segments & Congestion Drop Pins (Sections 3 & 6)
  const renderedLayersRef = useRef<string[]>([]);
  const renderedSourcesRef = useRef<string[]>([]);
  const renderedListenersRef = useRef<{ layerId: string; listener: any }[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cleanupOldRoutes = () => {
      renderedLayersRef.current.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });
      renderedLayersRef.current = [];

      renderedSourcesRef.current.forEach((sourceId) => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });
      renderedSourcesRef.current = [];

      renderedListenersRef.current.forEach(({ layerId, listener }) => {
        map.off("click", layerId, listener);
      });
      renderedListenersRef.current = [];

      // Clear all hotspot drop pin markers
      hotspotMarkersRef.current.forEach((m) => m.remove());
      hotspotMarkersRef.current = [];
    };

    const renderPolylines = () => {
      cleanupOldRoutes();
      if (!routes || routes.length === 0) return;

      // Draw non-active routes first, then active route on top
      const sortedIndices = routes.map((_, idx) => idx).sort((a, b) => {
        if (a === activeRouteIndex) return 1;
        if (b === activeRouteIndex) return -1;
        return 0;
      });

      sortedIndices.forEach((idx) => {
        const route = routes[idx];
        if (!route || !route.geometry) return;

        const isSelected = idx === activeRouteIndex;
        const isAI = Boolean(route.is_ai_recommended);

        // Layer Mode Filtering
        if (activeLayerMode === "AI_ONLY" && !isAI && routes.length > 1) return;
        if (activeLayerMode === "STANDARD_ONLY" && isAI && routes.length > 1) return;

        if (route.segments && route.segments.length > 0) {
          // Render Segmented Color-Coded Polyline for All Routes
          route.segments.forEach((seg, sIdx) => {
            const sourceId = `seg-source-${idx}-${sIdx}`;
            const casingLayerId = `seg-casing-${idx}-${sIdx}`;
            const lineLayerId = `seg-line-${idx}-${sIdx}`;

            const trafficColor = TRAFFIC_COLORS[seg.congestion_level] || seg.color;
            const segmentColor = isSelected ? trafficColor : "#94A3B8";

            map.addSource(sourceId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: { level: seg.congestion_level, color: segmentColor, routeIndex: idx },
                geometry: {
                  type: "LineString",
                  coordinates: seg.coordinates,
                },
              },
            });
            renderedSourcesRef.current.push(sourceId);

            // Casing Glow
            map.addLayer({
              id: casingLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": isSelected ? "#2563EB" : "#1E293B",
                "line-width": isSelected ? 12 : 8,
                "line-opacity": isSelected ? 0.9 : 0.2,
              },
            });
            renderedLayersRef.current.push(casingLayerId);

            // Segment Line
            map.addLayer({
              id: lineLayerId,
              type: "line",
              source: sourceId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": segmentColor,
                "line-width": isSelected ? 7 : 5,
                "line-opacity": isSelected ? 1.0 : 0.65,
              },
            });
            renderedLayersRef.current.push(lineLayerId);

            // Click-to-switch behavior
            if (!isSelected) {
              const clickListener = () => {
                if (!isNavigating) {
                  setActiveRouteIndex(idx);
                }
              };
              map.on("click", lineLayerId, clickListener);
              renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
            }
          });

          // Section 3: Render Distinct Congestion Drop Pins Anchored Directly at Hotspot GPS Points
          if (route.hotspots && route.hotspots.length > 0) {
            route.hotspots.forEach((hotspot) => {
              const el = document.createElement("div");
              const level = hotspot.congestion_level || "HEAVY";
              const isSevere = level === "SEVERE";
              const isModerate = level === "MODERATE";
              const levelColor = TRAFFIC_COLORS[level];
              const isHeavy = level === "HEAVY";
              const accessibleLabel = `${level[0]}${level.slice(1).toLowerCase()} traffic ahead at ${hotspot.location_name}`;

              let pinFill = "#DC2626"; // Red (Heavy)
              let pinStroke = "#F87171";
              let shadowColor = "rgba(220, 38, 38, 0.4)";
              let iconSvg = "";
              let titleColor = "text-rose-400";
              let badgeBg = "bg-rose-600 text-white";

              if (isModerate) {
                pinFill = "#D97706"; // Amber (Moderate)
                pinStroke = "#FBBF24";
                shadowColor = "rgba(217, 119, 6, 0.35)";
                titleColor = "text-amber-400";
                badgeBg = "bg-amber-600 text-white";
                // Shape: Single vehicle silhouette
                iconSvg = `
                  <path d="M22 13H14c-.5 0-.9.3-1.1.7L11.5 16v4.5c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7V16l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#D97706"/>
                `;
              } else if (isSevere) {
                pinFill = "#991B1B"; // Crimson Maroon (Severe)
                pinStroke = "#E11D48";
                shadowColor = "rgba(225, 29, 72, 0.6)";
                titleColor = "text-rose-400";
                badgeBg = "bg-rose-700 text-white ring-1 ring-rose-400";
                // Shape: Queued vehicles + warning badge (!)
                iconSvg = `
                  <path d="M19 10h-4c-.3 0-.5.2-.6.4L13.5 12h7l-.7-1.6c-.1-.2-.4-.4-.8-.4z" fill="#991B1B" opacity="0.6"/>
                  <path d="M22 13.5H14c-.5 0-.9.3-1.1.7L11.5 16.5V21c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-4.5l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#991B1B"/>
                  <circle cx="28" cy="8" r="5.5" fill="#FBBF24" stroke="#78350F" stroke-width="1"/>
                  <path d="M28 5v4M28 10v1" stroke="#991B1B" stroke-width="1.5" stroke-linecap="round"/>
                `;
              } else {
                // Shape: Group of 3 vehicles
                iconSvg = `
                  <path d="M15 13H11c-.3 0-.5.2-.6.4l-1.4 1.8V18c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-.5h6v.5c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-2.8l-1.4-1.8c-.1-.2-.3-.4-.6-.4zm-4.1.5h4.2l.4 1.2h-5l.4-1.2zm4.1 3c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm-4 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z" fill="#DC2626" opacity="0.5"/>
                  <path d="M26 13h-4c-.3 0-.5.2-.6.4L20 15.2V18c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-.5h6v.5c0 .3.2.5.5.5h.5c.3 0 .5-.2.5-.5v-2.8l-1.4-1.8c-.1-.2-.3-.4-.6-.4zm-4.1.5h4.2l.4 1.2h-5l.4-1.2zm4.1 3c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5zm-4 0c-.3 0-.5-.2-.5-.5s.2-.5.5-.5.5.2.5.5-.2.5-.5.5z" fill="#DC2626" opacity="0.5"/>
                  <path d="M22 17.5h-8c-.5 0-.9.3-1.1.7L11.5 20.5V25c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-.7h8.8v.7c0 .4.3.7.7.7h.7c.4 0 .7-.3.7-.7v-4.5l-1.4-2.3c-.2-.4-.6-.7-1.1-.7zm-7.7.7h7.4l.7 1.8h-8.8l.7-1.8zm7.7 5.3c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm-8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z" fill="#DC2626"/>
                `;
              }
              // Opacity for non-selected route pins
              if (!isSelected) {
                el.style.opacity = "0.5";
                el.style.pointerEvents = "none";
              } else {
                el.style.opacity = "1";
              }

              el.className = "relative cursor-pointer group";
              el.setAttribute("role", "img");
              el.setAttribute("aria-label", accessibleLabel);
              el.setAttribute("title", accessibleLabel);
              el.style.width = "44px";
              el.style.height = "44px";
              el.innerHTML = `
                <div class="relative flex items-center justify-center hover:scale-110 active:scale-95 transition duration-200" style="filter: drop-shadow(0 3px 8px ${levelColor}99);">
                  ${isSevere && isSelected ? `<span class="absolute w-10 h-10 rounded-full animate-ping pointer-events-none" style="background:${levelColor}55"></span>` : ""}
                  <svg width="44" height="44" viewBox="0 0 36 36" role="presentation" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="16" fill="${levelColor}" stroke="white" stroke-width="2"/>
                    <path d="M18 8.5 28 26H8L18 8.5Z" fill="white" stroke="#1F2937" stroke-width="1.2" stroke-linejoin="round"/>
                    <path d="M18 14v5" stroke="#111827" stroke-width="2.4" stroke-linecap="round"/>
                    <circle cx="18" cy="22.2" r="1.2" fill="#111827"/>
                  </svg>
                </div>
              `;

              // Interactive Popup on Click / Hover (only if selected)
              if (isSelected) {
                const popupContent = `
                  <div class="p-2.5 rounded-xl bg-slate-900/95 text-white text-xs space-y-1 shadow-2xl border border-slate-700 min-w-[170px] backdrop-blur-md">
                    <div class="font-extrabold text-xs flex items-center gap-1.5" style="color:${levelColor}">
                      <span>${accessibleLabel}</span>
                    </div>
                    <div class="flex items-center justify-between text-slate-300 text-[11px]">
                      <span>Average Speed:</span>
                      <span class="font-bold text-amber-300">${hotspot.average_speed_kmh} km/h</span>
                    </div>
                    <div class="text-[10px] text-slate-400 font-medium pt-0.5">
                      ${hotspot.description || hotspot.cause || "Traffic congestion bottleneck"}
                    </div>
                  </div>
                `;

                const popup = new maplibregl.Popup({
                  offset: [0, -46],
                  closeButton: false,
                  className: "custom-hotspot-popup",
                }).setHTML(popupContent);

                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .setPopup(popup)
                  .addTo(map);

                hotspotMarkersRef.current.push(marker);
              } else {
                const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                  .setLngLat([hotspot.lon, hotspot.lat])
                  .addTo(map);
                hotspotMarkersRef.current.push(marker);
              }
            });
          }
        } else {
          // Fallback if no segments data (should not happen, but safe)
          const sourceId = `route-source-${idx}`;
          const casingLayerId = `route-casing-${idx}`;
          const lineLayerId = `route-line-${idx}`;

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { routeIndex: idx },
              geometry: route.geometry as any,
            },
          });
          renderedSourcesRef.current.push(sourceId);

          map.addLayer({
            id: casingLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
                "line-color": isSelected ? "#2563EB" : "#1E293B",
                "line-width": isSelected ? 12 : 8,
                "line-opacity": isSelected ? 0.9 : 0.2,
            },
          });
          renderedLayersRef.current.push(casingLayerId);

          map.addLayer({
            id: lineLayerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": isSelected ? (isEmergencyMode ? "#EF4444" : "#3B82F6") : "#64748B",
              "line-width": isSelected ? 7 : 5,
              "line-opacity": isSelected ? 1.0 : 0.65,
            },
          });
          renderedLayersRef.current.push(lineLayerId);

          if (!isSelected) {
            const clickListener = () => {
              if (!isNavigating) {
                setActiveRouteIndex(idx);
              }
            };
            map.on("click", lineLayerId, clickListener);
            renderedListenersRef.current.push({ layerId: lineLayerId, listener: clickListener });
          }
        }
      });

      // Render Ghost Reroute Line if active (Features 8 & 9)
      if (activeRerouteRecommendation?.recommended_route?.geometry) {
        const rerouteSourceId = "ghost-reroute-source";
        const rerouteLineId = "ghost-reroute-line";

        map.addSource(rerouteSourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: activeRerouteRecommendation.recommended_route.geometry as any,
          },
        });
        renderedSourcesRef.current.push(rerouteSourceId);

        map.addLayer({
          id: rerouteLineId,
          type: "line",
          source: rerouteSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#10B981",
            "line-width": 6,
            "line-dasharray": [2, 2],
            "line-opacity": 0.9,
          },
        });
        renderedLayersRef.current.push(rerouteLineId);
      }

      // Auto-fit bounds when not actively driving
      if (!isNavigating) {
        const bounds = new maplibregl.LngLatBounds();
        let hasPoints = false;
        routes.forEach((r) => {
          if (r.geometry && r.geometry.coordinates) {
            r.geometry.coordinates.forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
              hasPoints = true;
            });
          }
        });

        if (hasPoints) {
          map.fitBounds(bounds, {
            padding: { top: 100, bottom: 180, left: 100, right: 100 },
            maxZoom: 15,
            duration: 800,
          });
        }
      }
    };

    if (map.isStyleLoaded()) {
      renderPolylines();
    } else {
      map.once("load", renderPolylines);
    }
  }, [
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    activeLayerMode,
    isEmergencyMode,
    isNavigating,
    activeRerouteRecommendation,
  ]);

  // Recenter trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterTrigger === 0) return;

    if (currentLocation) {
      map.flyTo({
        center: [currentLocation.lon, currentLocation.lat],
        zoom: 15,
        duration: 1200,
      });
    } else if (selectedDestination) {
      map.flyTo({
        center: [selectedDestination.lon, selectedDestination.lat],
        zoom: 14,
        duration: 1200,
      });
    } else {
      map.flyTo({
        center: [BENGALURU_CENTER.lon, BENGALURU_CENTER.lat],
        zoom: 12.5,
        duration: 1200,
      });
    }
  }, [recenterTrigger, selectedDestination, currentLocation]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <div
        ref={mapContainerRef}
        className="pointer-events-auto"
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      />
      {pinDropMode !== "none" && (
        <div className="absolute top-6 left-3 right-3 mx-auto w-fit max-w-[calc(100%-1.5rem)] bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl border border-blue-500/50 backdrop-blur-md animate-pulse" style={{ zIndex: OVERLAY_Z.mapPrompt }}>
          <p className="text-sm font-bold tracking-wide text-center">
            Tap the map to set your <span className="text-blue-400">{pinDropMode === "source" ? "starting" : "destination"}</span> point
          </p>
        </div>
      )}
    </div>
  );
};
```


## `frontend\src\components\ui\AdvanceAlertBanner.tsx`

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Volume2, ShieldAlert } from "lucide-react";
import { ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService } from "@/lib/ttsService";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface AdvanceAlertBannerProps {
  alert: ActiveCongestionAlert | null;
  onDismiss: () => void;
  onCheckReroute?: () => void;
  fasterRouteAvailable?: boolean;
}

export const AdvanceAlertBanner: React.FC<AdvanceAlertBannerProps> = ({
  alert,
  onDismiss,
  onCheckReroute,
  fasterRouteAvailable = false,
}) => {
  if (!alert) return null;

  const isSevere = alert.congestionLevel === "SEVERE";
  const isHeavy = alert.congestionLevel === "HEAVY";
  const severityText = isSevere ? "Severe" : isHeavy ? "Heavy" : "Moderate";
  const severityStyle = isSevere
    ? { border: "border-l-red-600", icon: "text-red-700" }
    : isHeavy
    ? { border: "border-l-orange-500", icon: "text-orange-700" }
    : { border: "border-l-yellow-500", icon: "text-yellow-700" };
  const delayMinutes = Math.max(1, Math.round((alert.estimatedDelaySeconds || 60) / 60));

  const handleSpeak = () => {
    TTSService.speakCongestionAlert(
      alert.locationName,
      alert.distanceText,
      alert.averageSpeedKmh,
      alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined,
      true,
      alert.congestionLevel
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="fixed left-3 right-3 mx-auto w-auto max-w-sm sm:max-w-md pointer-events-auto"
        style={{ zIndex: OVERLAY_Z.advanceAlertBanner, top: "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}
      >
        <div className={`glass-panel flex items-start gap-2 rounded-xl border-l-4 p-2.5 text-slate-800 ${severityStyle.border}`}>
          <span className={`mt-0.5 shrink-0 ${severityStyle.icon}`}>
            {isSevere ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-extrabold">{severityText} traffic ahead · {alert.distanceText}</p>
              <button onClick={onDismiss} aria-label="Dismiss traffic alert" className="-mr-1 -mt-1 rounded-full p-1 text-slate-500 hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="truncate text-xs text-slate-600">{alert.locationName} · Expect about {delayMinutes} min delay</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button onClick={handleSpeak} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                <Volume2 className="h-3.5 w-3.5" /> Read aloud
              </button>
              {onCheckReroute && !fasterRouteAvailable && (isHeavy || isSevere) && (
                <button onClick={onCheckReroute} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 shadow-sm hover:bg-emerald-50">
                  Find a route around it
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\FloatingSearchPanel.tsx`

```tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, ArrowUpDown, Loader2, MousePointerClick, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { searchPlaces, PlaceSearchResult } from "@/lib/api";

export const FloatingSearchPanel: React.FC = () => {
  const {
    sourceQuery,
    setSourceQuery,
    destinationQuery,
    setDestinationQuery,
    searchResults,
    setSearchResults,
    selectedOrigin,
    setSelectedOrigin,
    selectedDestination,
    setSelectedDestination,
    calculateRoutes,
    swapSourceAndDestination,
    pinDropMode,
    setPinDropMode,
    isEmergencyMode,
    toggleEmergencyMode,
  } = useNavigation();

  const [activeInput, setActiveInput] = useState<"source" | "destination" | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search trigger for active input field
  useEffect(() => {
    const currentQuery = activeInput === "source" ? sourceQuery : activeInput === "destination" ? destinationQuery : "";
    const trimmed = currentQuery.trim();

    if (trimmed.length < 3) {
      setSearchResults([]);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(trimmed);
        setSearchResults(results);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [sourceQuery, destinationQuery, activeInput, setSearchResults]);

  // Click outside hook
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveInput(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlace = async (place: PlaceSearchResult) => {
    const coord = {
      lat: place.lat,
      lon: place.lon,
      name: place.display_name.split(",")[0],
    };

    if (activeInput === "source") {
      setSelectedOrigin(coord);
      setSourceQuery(coord.name);
      if (selectedDestination) {
        await calculateRoutes(coord, selectedDestination);
      }
    } else if (activeInput === "destination") {
      setSelectedDestination(coord);
      setDestinationQuery(coord.name);
      if (selectedOrigin) {
        await calculateRoutes(selectedOrigin, coord);
      }
    }

    setSearchResults([]);
    setActiveInput(null);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetIdx = selectedIndex >= 0 ? selectedIndex : 0;
      if (searchResults[targetIdx]) {
        handleSelectPlace(searchResults[targetIdx]);
      }
    } else if (e.key === "Escape") {
      setActiveInput(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative pointer-events-auto shrink-0">
      <div
        className={`glass-panel rounded-2xl p-3 shadow-2xl transition-all duration-300 space-y-2 border ${
          isEmergencyMode
            ? "border-rose-500/90 shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50 bg-rose-950/10"
            : "border-slate-200/80"
        }`}
      >
        {/* Emergency Mode Toggle Banner */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isEmergencyMode ? "bg-rose-500 animate-ping" : "bg-slate-300"
              }`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isEmergencyMode ? "text-rose-700 dark:text-rose-400" : "text-slate-500"
              }`}
            >
              <Siren className={`w-3.5 h-3.5 ${isEmergencyMode ? "text-rose-600 animate-pulse" : "text-slate-400"}`} />
              Emergency / Ambulance Mode
            </span>
          </div>

          <button
            onClick={toggleEmergencyMode}
            type="button"
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isEmergencyMode ? "bg-rose-600 shadow-sm shadow-rose-500/50" : "bg-slate-300"
            }`}
            role="switch"
            aria-checked={isEmergencyMode}
            title="Toggle Emergency / Ambulance Priority Mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEmergencyMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Source Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm shrink-0 ml-1" />
          <input
            type="text"
            value={sourceQuery}
            onChange={(e) => setSourceQuery(e.target.value)}
            onFocus={() => setActiveInput("source")}
            onKeyDown={handleKeyDown}
            placeholder="Choose starting point or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "source" && isSearching && (
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
          )}
          {sourceQuery && (
            <button
              onClick={() => {
                setSourceQuery("");
                setSelectedOrigin(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Swap & Pin Drop Action Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-2">
            <button
              onClick={() => setPinDropMode(pinDropMode === "source" ? "none" : "source")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "source"
                  ? "bg-emerald-600 text-white shadow-sm animate-pulse"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "source" ? "Click Map to Set Start" : "Drop Start Pin"}</span>
            </button>

            <button
              onClick={() => setPinDropMode(pinDropMode === "destination" ? "none" : "destination")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                pinDropMode === "destination"
                  ? "bg-rose-600 text-white shadow-sm animate-pulse"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>{pinDropMode === "destination" ? "Click Map to Set Dest" : "Drop Dest Pin"}</span>
            </button>
          </div>

          <button
            onClick={swapSourceAndDestination}
            title="Swap Source and Destination"
            className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition shadow-sm"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Input */}
        <div
          className={`relative flex items-center gap-2.5 rounded-xl p-2 transition border ${
            isEmergencyMode
              ? "bg-white/90 border-rose-200"
              : "bg-white/70 hover:bg-white border-slate-200/60"
          }`}
        >
          <MapPin className="w-4 h-4 text-rose-600 shrink-0 ml-1" />
          <input
            type="text"
            value={destinationQuery}
            onChange={(e) => setDestinationQuery(e.target.value)}
            onFocus={() => setActiveInput("destination")}
            onKeyDown={handleKeyDown}
            placeholder="Choose destination or drop pin..."
            className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-semibold text-xs sm:text-sm"
          />
          {activeInput === "destination" && isSearching && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          )}
          {destinationQuery && (
            <button
              onClick={() => {
                setDestinationQuery("");
                setSelectedDestination(null);
              }}
              className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {activeInput && searchResults.length > 0 && (
        <div className="absolute top-full mt-2 w-full glass-panel rounded-2xl shadow-2xl overflow-hidden z-30 border border-slate-200/80 max-h-80 overflow-y-auto">
          {searchResults.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPlace(item)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-100 last:border-0 transition ${
                idx === selectedIndex ? "bg-blue-100/80 text-blue-900 font-semibold" : "hover:bg-blue-50/70"
              }`}
            >
              <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {item.display_name.split(",")[0]}
                </p>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {item.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```


## `frontend\src\components\ui\MapControls.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { Plus, Minus, Target, Layers, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { mapRefContainer } from "@/components/map/MapCanvas";
import { TrafficTestMode } from "@/lib/trafficScenario";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const MapControls: React.FC = () => {
  const {
    triggerRecenter,
    activeLayerMode,
    toggleLayerMode,
    currentZoom,
    isEmergencyMode,
    toggleEmergencyMode,
    trafficTestMode,
    runTrafficTest,
    isNavigating,
    navigationHudHeight,
  } = useNavigation();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleZoomIn = () => {
    if (mapRefContainer.current && currentZoom < 18) {
      mapRefContainer.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRefContainer.current && currentZoom > 10) {
      mapRefContainer.current.zoomOut();
    }
  };

  const handleLayerToggle = () => {
    toggleLayerMode();
    let msg = "Showing All Routes";
    if (activeLayerMode === "ALL") msg = "Showing Recommended Route Only";
    else if (activeLayerMode === "AI_ONLY") msg = "Showing Standard Route Only";

    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <>
      <div className="glass-panel fixed right-4 top-[calc(env(safe-area-inset-top,0px)+11rem)] w-44 rounded-xl p-2.5 pointer-events-auto" style={{ zIndex: OVERLAY_Z.mapControls }}>
        <label htmlFor="traffic-test-mode" className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
          Traffic Test
        </label>
        <select
          id="traffic-test-mode"
          value={trafficTestMode}
          onChange={(event) => void runTrafficTest(event.target.value as TrafficTestMode)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
          aria-label="Select real traffic data or a controlled traffic test"
        >
          <option value="real">Real Traffic Data</option>
          <option value="normal">Normal Traffic</option>
          <option value="moderate">Moderate Congestion</option>
          <option value="heavy">Heavy Congestion</option>
          <option value="severe">Severe Congestion</option>
          <option value="dynamic">Dynamic Congestion</option>
        </select>
        {trafficTestMode !== "real" && <p className="mt-1 text-[10px] leading-tight text-slate-500">Controlled MG Road → Koramangala test</p>}
      </div>
      {toastMessage && (
        <div className="fixed right-16 bottom-8 px-3.5 py-2 rounded-xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-slate-700/80 animate-fade-in backdrop-blur-md" style={{ zIndex: OVERLAY_Z.transientToast }}>
          {toastMessage}
        </div>
      )}

      <div
        className="fixed right-4 flex flex-col gap-2 transition-[bottom] duration-200"
        style={{
          zIndex: OVERLAY_Z.mapControls,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
        }}
      >
        <div className="glass-panel rounded-full p-1 flex flex-col gap-1 shadow-lg">
          <button
            onClick={handleZoomIn}
            disabled={currentZoom >= 18}
            title={currentZoom >= 18 ? "Maximum zoom reached (18)" : "Zoom In"}
            className="h-12 w-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-full h-px bg-slate-200" />
          <button
            onClick={handleZoomOut}
            disabled={currentZoom <= 10}
            title={currentZoom <= 10 ? "Minimum zoom reached (10)" : "Zoom Out"}
            className="h-12 w-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/90"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={triggerRecenter}
          title="Re-center Viewport"
          className="h-12 w-12 rounded-full glass-panel flex items-center justify-center text-slate-700 hover:text-blue-600 transition shadow-lg hover:scale-105 active:scale-95"
        >
          <Target className="w-5 h-5" />
        </button>

        <button
          onClick={handleLayerToggle}
          title={`Layer View: ${activeLayerMode}`}
          className={`h-12 w-12 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            activeLayerMode === "AI_ONLY"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20"
              : activeLayerMode === "STANDARD_ONLY"
              ? "bg-slate-700 text-white border-slate-600"
              : "text-slate-700 hover:text-emerald-600"
          }`}
        >
          <Layers className="w-5 h-5" />
        </button>

        <button
          onClick={toggleEmergencyMode}
          title={isEmergencyMode ? "Emergency Mode Active (Ambulance Priority)" : "Enable Emergency / Ambulance Mode"}
          className={`h-12 w-12 rounded-full glass-panel flex items-center justify-center transition shadow-lg hover:scale-105 active:scale-95 ${
            isEmergencyMode
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-500/30 animate-pulse"
              : "text-slate-700 hover:text-rose-600"
          }`}
        >
          <Siren className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};
```


## `frontend\src\components\ui\NavigationControlsHUD.tsx`

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUp,
  Bell,
  BellRing,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  CornerUpRight,
  FastForward,
  Pause,
  Play,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { TTSService } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";
import { OVERLAY_Z } from "@/lib/layoutZones";

export const NavigationControlsHUD: React.FC = () => {
  const {
    isNavigating,
    setIsNavigating,
    currentVehicleSpeed,
    simProgressPercent,
    simDistanceRemainingM,
    simEtaSeconds,
    isSimPlaying,
    setIsSimPlaying,
    simSpeedMultiplier,
    setSimSpeedMultiplier,
    nextManeuver,
    nextManeuverDistanceM,
    isEmergencyMode,
    navigationHudHeight,
    setNavigationHudHeight,
  } = useNavigation();

  const [isVoiceMuted, setIsVoiceMuted] = useState(TTSService.getMuted());
  const [isPushEnabled, setIsPushEnabled] = useState(PushNotificationService.isPermissionGranted());
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNavigating || !hudRef.current) {
      setNavigationHudHeight(0);
      return;
    }

    const measureHud = () => {
      if (!hudRef.current) return;
      const heightFromBottom = Math.ceil(window.innerHeight - hudRef.current.getBoundingClientRect().top + 12);
      setNavigationHudHeight((previous) => Math.abs(previous - heightFromBottom) > 1 ? heightFromBottom : previous);
    };

    measureHud();
    const resizeObserver = new ResizeObserver(measureHud);
    resizeObserver.observe(hudRef.current);
    window.addEventListener("resize", measureHud);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureHud);
    };
  }, [isNavigating, isDetailsExpanded, setNavigationHudHeight]);

  if (!isNavigating) return null;

  const handleToggleVoice = () => {
    const newMuted = TTSService.toggleMute();
    setIsVoiceMuted(newMuted);
    if (!newMuted) TTSService.announce("Voice guidance enabled", "normal", "voice_guidance_enabled", 2_000);
  };

  const handleTogglePush = async () => {
    const granted = await PushNotificationService.requestPermission();
    setIsPushEnabled(granted);
    if (granted) PushNotificationService.sendCongestionAlert("Navigation Demo", "500 m", 4, 15);
  };

  const getManeuverIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="h-5 w-5 text-white" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="h-5 w-5 text-white" />;
    return <ArrowUp className="h-5 w-5 text-white" />;
  };

  return (
    <motion.div
      ref={hudRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="fixed left-3 right-3 mx-auto w-auto max-w-2xl pointer-events-auto"
      style={{ zIndex: OVERLAY_Z.navigationHud, bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="glass-panel-dark flex flex-col gap-2 rounded-3xl p-3 text-white sm:gap-3 sm:p-4">
        <div className={`flex min-w-0 items-center justify-between gap-2 ${isDetailsExpanded ? "border-b border-slate-700 pb-3" : ""}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg ${isEmergencyMode ? "bg-rose-600" : "bg-blue-600"}`}>
              {getManeuverIcon(nextManeuver?.modifier)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-300">
                  {nextManeuverDistanceM >= 1000
                    ? `${(nextManeuverDistanceM / 1000).toFixed(1)} km`
                    : `${Math.round(nextManeuverDistanceM)} m`}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next step</span>
              </div>
              <p className="line-clamp-1 text-xs font-bold text-white sm:text-sm">
                {nextManeuver ? getManeuverInstruction(nextManeuver) : "Continue along active corridor"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex flex-col items-end rounded-xl border border-white/10 bg-black/30 px-2 py-1 sm:px-3">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-emerald-400 sm:text-2xl">{Math.round(currentVehicleSpeed)}</span>
                <span className="text-[9px] font-extrabold uppercase text-slate-400">km/h</span>
              </div>
              {isDetailsExpanded && <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Speed</span>}
            </div>
            <button
              type="button"
              onClick={() => setIsDetailsExpanded((expanded) => !expanded)}
              aria-label={isDetailsExpanded ? "Collapse navigation controls" : "Expand navigation controls"}
              aria-expanded={isDetailsExpanded}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-200 hover:bg-white/20"
            >
              {isDetailsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${isEmergencyMode ? "bg-rose-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, Math.max(0, simProgressPercent))}%` }}
          />
        </div>

        {isDetailsExpanded && (
          <>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span aria-label="Distance remaining">
                {simDistanceRemainingM >= 1000
                  ? `${(simDistanceRemainingM / 1000).toFixed(1)} km remaining`
                  : `${Math.round(simDistanceRemainingM)} m remaining`}
              </span>
              <span aria-label="Estimated time to destination">
                {simEtaSeconds > 0 ? `${Math.ceil(simEtaSeconds / 60)} min to destination` : "Arrived"}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
              <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button
                  onClick={() => setIsSimPlaying(!isSimPlaying)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  title={isSimPlaying ? "Pause Simulation" : "Play Simulation"}
                >
                  {isSimPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                </button>
                <button
                  onClick={() => setSimSpeedMultiplier(simSpeedMultiplier === 1 ? 2 : simSpeedMultiplier === 2 ? 5 : 1)}
                  className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-black text-amber-300 hover:bg-white/20"
                  title="Simulation Speed Multiplier"
                >
                  <FastForward className="h-3.5 w-3.5" /> <span>{simSpeedMultiplier}x</span>
                </button>
              </div>

              <button
                onClick={handleToggleVoice}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold ${!isVoiceMuted ? "border-blue-500/50 bg-blue-600/30 text-blue-200" : "border-white/10 bg-white/5 text-slate-300"}`}
                title="Voice Alerts / TTS"
              >
                {!isVoiceMuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span>{!isVoiceMuted ? "Voice ON" : "Voice Muted"}</span>
              </button>

              <button
                onClick={() => void handleTogglePush()}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold ${isPushEnabled ? "border-emerald-500/50 bg-emerald-600/30 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}
                title="Push Notifications"
              >
                {isPushEnabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                <span>{isPushEnabled ? "Push ON" : "Enable Push"}</span>
              </button>

              <button
                onClick={() => {
                  TTSService.reset();
                  setIsNavigating(false);
                }}
                className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-rose-900/60 hover:text-rose-100"
              >
                <XCircle className="h-4 w-4" /> <span>Exit</span>
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
```


## `frontend\src\components\ui\NoFasterRouteToast.tsx`

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, X } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface NoFasterRouteToastProps {
  reason: string | null;
  onDismiss: () => void;
}

export const NoFasterRouteToast: React.FC<NoFasterRouteToastProps> = ({ reason, onDismiss }) => {
  const { isNavigating, navigationHudHeight } = useNavigation();
  if (!reason) return null;
  const isAvoidanceFailure = /no alternate route avoids/i.test(reason);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed left-3 right-auto w-[min(28rem,calc(100vw-5rem))] pointer-events-auto"
        style={{
          zIndex: OVERLAY_Z.noFasterRouteToast,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
      >
        <div className="glass-panel-dark relative rounded-2xl p-3 sm:p-4 text-white flex items-center justify-between gap-3 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                {isAvoidanceFailure ? "No avoidance route found" : "No faster route found"}
              </span>
              <p className="text-xs font-semibold text-slate-200 line-clamp-2">
                {reason}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\RerouteModal.tsx`

```tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Check } from "lucide-react";
import { RerouteRecommendation } from "@/lib/api";
import { useNavigation } from "@/context/NavigationContext";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface RerouteModalProps {
  recommendation: RerouteRecommendation | null;
  onAccept: (recommendation: RerouteRecommendation) => void;
  onDismiss: () => void;
  isApplying?: boolean;
}

export const RerouteModal: React.FC<RerouteModalProps> = ({
  recommendation,
  onAccept,
  onDismiss,
  isApplying = false,
}) => {
  const { isNavigating, navigationHudHeight } = useNavigation();
  if (!recommendation || !recommendation.is_reroute_recommended || !recommendation.recommended_route) {
    return null;
  }

  const newRoute = recommendation.recommended_route;
  const originalMin = Math.round(recommendation.original_remaining_seconds / 60);
  const newMin = Math.round(recommendation.recommended_duration_seconds / 60);
  const isAvoidance = recommendation.is_congestion_avoidance;
  const savedMin = Math.max(1, Math.round(recommendation.time_saved_minutes));
  const newDistKm = (newRoute.distance_meters / 1000).toFixed(1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed left-3 right-auto w-[min(28rem,calc(100vw-5rem))] pointer-events-auto"
        style={{
          zIndex: OVERLAY_Z.rerouteModal,
          bottom: isNavigating
            ? `${navigationHudHeight + 12}px`
            : "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
      >
          <div className="glass-panel rounded-2xl border border-emerald-200/60 p-3 text-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Zap className="h-4 w-4 fill-current" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-tight">
                  {isAvoidance ? "Route around congestion" : "Faster route available"}
                </p>
                <p className="truncate text-xs text-slate-600">
                  {isAvoidance ? `Avoids flagged congestion · ${newDistKm} km` : `About ${savedMin} min faster · ${newDistKm} km`}
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              aria-label={isAvoidance ? "Dismiss congestion avoidance suggestion" : "Dismiss faster route suggestion"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {isAvoidance && recommendation.reason && (
            <p className="mt-2 text-[11px] leading-snug text-slate-600">{recommendation.reason}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
            <p className="min-w-0 truncate text-[11px] text-slate-500">
              {originalMin} min current → {newMin} min new
            </p>
            <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onDismiss}
              className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Keep route
            </button>
            <button
              disabled={isApplying}
              onClick={() => {
                if (isApplying) return;
                onAccept(recommendation);
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isApplying ? "Applying…" : isAvoidance ? "Take this route" : "Take faster route"}</span>
            </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\RouteCard.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Zap,
  Siren,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { TTSService } from "@/lib/ttsService";

export const RouteCard: React.FC = () => {
  const [showHotspotList, setShowHotspotList] = useState(false);
  const {
    routes,
    activeRouteIndex,
    setActiveRouteIndex,
    selectedDestination,
    isNavigating,
    setIsNavigating,
    isLoadingRoutes,
    isEmergencyMode,
  } = useNavigation();

  if (isLoadingRoutes) {
    return (
      <div
        className={`w-full relative pointer-events-auto shrink-0 glass-panel rounded-2xl p-6 flex items-center justify-center gap-3 shadow-2xl ${
          isEmergencyMode ? "border-rose-500/80 shadow-rose-500/20" : ""
        }`}
      >
        <Loader2 className={`w-6 h-6 animate-spin ${isEmergencyMode ? "text-rose-600" : "text-emerald-600"}`} />
        <span className="text-sm font-semibold text-slate-700">
          {isEmergencyMode
            ? "Evaluating Priority Corridors & transit speeds..."
            : "Evaluating real-time traffic factors & ML congestion..."}
        </span>
      </div>
    );
  }

  if (!selectedDestination || routes.length === 0) return null;

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute) return null;

  const durationMin = Math.round(
    (currentRoute.predicted_duration_seconds || currentRoute.duration_seconds) / 60
  );

  const distanceKm = (currentRoute.distance_meters / 1000).toFixed(1);
  const isAIRoute = Boolean(currentRoute.is_ai_recommended);

  // Format user-friendly route label
  let routeLabel = currentRoute.recommendation_label;
  if (!routeLabel) {
    if (isAIRoute) {
      routeLabel = isEmergencyMode ? "Emergency Priority Corridor" : "Recommended Route";
    } else {
      routeLabel = "Standard Route";
    }
  } else if (routeLabel === "OSRM Preferred Route") {
    routeLabel = "Standard Route";
  } else if (routeLabel === "AI Recommended") {
    routeLabel = "Recommended Route";
  }

  const clearKm = currentRoute.clear_distance_km || 0.0;
  const modKm = currentRoute.moderate_distance_km || 0.0;
  const heavyKm = currentRoute.heavy_distance_km || 0.0;
  const severeKm = currentRoute.severe_distance_km || 0.0;
  const totalDelayMin = Math.max(0, Math.round((currentRoute.total_delay_seconds || 0) / 60));
  const hotspots = currentRoute.hotspots || [];

  // Sort hotspots by delay descending to find the primary bottleneck causing the delay
  const sortedHotspots = [...hotspots].sort(
    (a, b) => (b.estimated_delay_seconds || 0) - (a.estimated_delay_seconds || 0)
  );
  const worstHotspot = sortedHotspots[0];
  const otherHotspotsCount = sortedHotspots.length - 1;
  const worstHotspotName = worstHotspot
    ? worstHotspot.location_name.replace(/^(Near\s+|Central\s+)/i, "").split(",")[0]
    : "";

  const getMainRoadName = (route: typeof currentRoute) => {
    if (route.steps && route.steps.length > 1) {
      const namedStep = route.steps.find((s) => s.name && s.name.trim() !== "");
      if (namedStep && namedStep.name) return `Via ${namedStep.name}`;
    }
    return "Via Optimal Corridor";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`w-full relative pointer-events-auto flex-1 min-h-0 glass-panel rounded-2xl p-5 shadow-2xl border overflow-y-auto transition-all duration-300 ${
          isEmergencyMode
            ? "border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
            : "border-slate-200/80"
        }`}
      >
        {/* Mode & Corridor Context Alert Header */}
        {isEmergencyMode ? (
          <div
            className={`mb-3 px-3.5 py-2 rounded-xl text-white flex items-center justify-between shadow-md ${
              isAIRoute
                ? "bg-gradient-to-r from-rose-600 to-red-600 ring-1 ring-rose-400/50"
                : "bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <Siren
                className={`w-4 h-4 fill-current ${isAIRoute ? "animate-bounce text-white" : "text-amber-400"}`}
              />
              <span className="text-xs font-black tracking-wider uppercase">
                {isAIRoute ? "Emergency Priority Corridor" : "Standard Alternate Path"}
              </span>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                isAIRoute ? "bg-white/20 text-white" : "bg-amber-400/20 text-amber-300"
              }`}
            >
              {isAIRoute ? "PRIORITY ACCESS" : "RESTRICTED ACCESS"}
            </span>
          </div>
        ) : null}

        {/* Destination Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-md font-bold text-xs flex items-center gap-1 ${
                  isEmergencyMode
                    ? isAIRoute
                      ? "bg-rose-500/15 text-rose-700 border border-rose-500/30 font-extrabold"
                      : "bg-slate-200 text-slate-700 font-semibold"
                    : isAIRoute
                    ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-extrabold"
                    : "bg-blue-500/15 text-blue-700 border border-blue-500/30 font-extrabold"
                }`}
              >
                {isEmergencyMode && isAIRoute ? (
                  <Siren className="w-3 h-3 text-rose-600 fill-current" />
                ) : isAIRoute ? (
                  <Zap className="w-3 h-3 text-emerald-600 fill-current" />
                ) : null}
                {routeLabel}
              </span>
              <span className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Guarded
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
              {selectedDestination.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium">{getMainRoadName(currentRoute)}</p>
          </div>
        </div>

        {/* Primary ETA Display with Location-Tied Delay Chip */}
        <div className="flex items-center gap-2.5 mb-3 flex-wrap">
          <span
            className={`text-3xl font-extrabold tracking-tight ${
              isEmergencyMode
                ? isAIRoute
                  ? "text-rose-600"
                  : "text-slate-700"
                : isAIRoute
                ? "text-emerald-600"
                : "text-blue-600"
            }`}
          >
            {durationMin} min
          </span>
          <span className="text-sm font-semibold text-slate-500">({distanceKm} km)</span>

          {/* Location-tied delay chip: only shown if there is a real hotspot causing delay */}
          {totalDelayMin > 0 && worstHotspot && (
            <button
              type="button"
              onClick={() => otherHotspotsCount > 0 && setShowHotspotList(!showHotspotList)}
              className={`text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/90 shadow-sm flex items-center gap-1 transition ${
                otherHotspotsCount > 0 ? "cursor-pointer active:scale-95" : "cursor-default"
              }`}
              title={otherHotspotsCount > 0 ? "Click to view all congestion spots" : undefined}
            >
              <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                +{totalDelayMin}m delay near {worstHotspotName}
                {otherHotspotsCount > 0 ? ` · +${otherHotspotsCount} more` : ""}
              </span>
              {otherHotspotsCount > 0 && (
                showHotspotList ? (
                  <ChevronUp className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
                )
              )}
            </button>
          )}
        </div>

        {/* Expanded Hotspots List (when chip is tapped) */}
        {showHotspotList && sortedHotspots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2.5 rounded-xl bg-rose-50/80 border border-rose-200/80 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs font-black text-rose-900 uppercase tracking-wider px-1">
              <span>Congestion Hotspots On Route</span>
              <span className="text-[11px] font-semibold text-rose-600">{sortedHotspots.length} spots</span>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {sortedHotspots.map((h, hIdx) => {
                const delayM = Math.max(1, Math.round((h.estimated_delay_seconds || 120) / 60));
                return (
                  <div
                    key={hIdx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/90 border border-rose-100 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800 line-clamp-1">{h.location_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {h.average_speed_kmh} km/h avg speed
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded shadow-xs shrink-0">
                      +{delayM}m
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Traffic Breakdown Bar */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-600" /> Traffic on This Route
            </span>
            <span>Live Flow</span>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200">
            {clearKm > 0 && (
              <div
                className={`${isAIRoute ? "bg-emerald-500" : "bg-blue-500"} h-full`}
                style={{ width: `${(clearKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Clear: ${clearKm} km`}
              />
            )}
            {modKm > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${(modKm / parseFloat(distanceKm)) * 100}%` }}
                title={`Moderate: ${modKm} km`}
              />
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <div
                className="bg-rose-600 h-full"
                style={{ width: `${((heavyKm + severeKm) / parseFloat(distanceKm)) * 100}%` }}
                title={`Heavy/Severe: ${heavyKm + severeKm} km`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500 flex-wrap gap-1">
            <span className={`${isAIRoute ? "text-emerald-700" : "text-blue-700"} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isAIRoute ? "bg-emerald-500" : "bg-blue-500"}`} /> {clearKm} km clear
            </span>
            {modKm > 0 && (
              <span className="text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {modKm} km slowed
              </span>
            )}
            {(heavyKm > 0 || severeKm > 0) && (
              <span className="text-rose-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" /> {heavyKm + severeKm} km heavy
              </span>
            )}
          </div>
        </div>

        {/* Candidate Routes Comparison */}
        {routes.length > 1 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Other Route Options
            </p>
            <div className="grid grid-cols-1 gap-2">
              {routes.map((r, idx) => {
                const dur = Math.round((r.predicted_duration_seconds || r.duration_seconds) / 60);
                const dist = (r.distance_meters / 1000).toFixed(1);
                const isSelected = idx === activeRouteIndex;
                const isAI = Boolean(r.is_ai_recommended);
                let labelText = r.recommendation_label;
                if (!labelText) {
                  if (isAI) {
                    labelText = isEmergencyMode ? "Emergency Priority" : "Recommended Route";
                  } else {
                    labelText = "Standard Route";
                  }
                } else if (labelText === "OSRM Preferred Route") {
                  labelText = "Standard Route";
                } else if (labelText === "AI Recommended") {
                  labelText = "Recommended Route";
                }
                const roadName = getMainRoadName(r);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isNavigating) {
                        setActiveRouteIndex(idx);
                        setShowHotspotList(false);
                      }
                    }}
                    disabled={isNavigating && !isSelected}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? isEmergencyMode
                          ? isAI
                            ? "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 shadow-md"
                            : "bg-slate-700 text-white border-slate-700 shadow-md"
                          : isAI
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                          : "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white/80 hover:bg-white text-slate-800 border-slate-200/80 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isSelected
                              ? "text-white"
                              : isEmergencyMode && isAI
                              ? "text-rose-600"
                              : isAI
                              ? "text-emerald-600"
                              : "text-slate-800"
                          }`}
                        >
                          {dur} min
                        </span>
                        <span className={`text-xs ${isSelected ? "text-slate-100" : "text-slate-500"}`}>
                          • {dist} km
                        </span>
                      </div>
                      <p
                        className={`text-xs font-medium line-clamp-1 ${
                          isSelected ? "text-slate-100" : "text-slate-500"
                        }`}
                      >
                        {roadName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : isEmergencyMode && isAI
                            ? "bg-rose-100 text-rose-800"
                            : isAI
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isEmergencyMode && isAI ? (
                          <Siren className="w-3 h-3 fill-current" />
                        ) : isAI ? (
                          <Zap className="w-3 h-3 fill-current" />
                        ) : null}
                        {labelText}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => {
            if (isNavigating) {
              TTSService.reset();
              setIsNavigating(false);
            } else {
              TTSService.warmUp();
              setIsNavigating(true);
            }
          }}
          className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
            isNavigating
              ? "bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/30"
              : isEmergencyMode
              ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-rose-600/30"
              : isAIRoute
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
          }`}
        >
          {isEmergencyMode ? <Siren className="w-4 h-4" /> : <Navigation className="w-4 h-4 fill-current" />}
          <span>
            {isNavigating
              ? "End Active Navigation"
              : isEmergencyMode
              ? "Start Priority Navigation"
              : "Start Smart Navigation"}
          </span>
          <ArrowRight className="w-4 h-4 ml-auto" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
```


## `frontend\src\components\ui\TrafficLegend.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { Activity } from "lucide-react";
import { OVERLAY_Z } from "@/lib/layoutZones";

interface TrafficLegendProps {
  placement?: "navigation" | "sidebar";
}

export const TrafficLegend: React.FC<TrafficLegendProps> = ({ placement = "navigation" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const placementClass = placement === "sidebar"
    ? "relative z-0 w-fit max-w-full self-start pointer-events-auto"
    : "fixed left-3 right-auto top-[calc(env(safe-area-inset-top,0px)+17rem)] w-[min(16rem,calc(100vw-5rem))] pointer-events-auto";

  return (
    <div className={placementClass} style={placement === "navigation" ? { zIndex: OVERLAY_Z.infoPanel } : undefined}>
      <div
        className={`glass-panel rounded-2xl shadow-xl border border-slate-200/80 transition-all duration-300 ${
          isExpanded ? "p-3.5 w-full" : "p-2"
        }`}
      >
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Open live traffic legend"
            className="flex w-full items-center gap-2 text-left text-xs font-bold text-slate-700 select-none"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Live Traffic</span>
            <span className="ml-1 flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          </button>
        ) : (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <div className="flex items-center gap-1.5 text-slate-800 font-extrabold text-xs uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Traffic on This Route</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                aria-label="Close traffic legend"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Clear Flow</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">≥ 80% freeflow</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Slowed Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">50 - 80% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  <span className="font-bold text-slate-700">Heavy Traffic</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">25 - 50% speed</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-900 shadow-sm" />
                  <span className="font-bold text-slate-700">Stopped / Barely Moving</span>
                </div>
                <span className="text-xs text-slate-500 font-medium">&lt; 25% speed</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 pt-1 border-t border-slate-100 italic">
              ML dynamically forecasts downstream delays before arrival.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
```


## `frontend\src\components\ui\TurnByTurnDrawer.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, CornerUpRight, CornerUpLeft, ArrowUp, Navigation, Siren } from "lucide-react";
import { useNavigation } from "@/context/NavigationContext";
import { getManeuverInstruction } from "@/lib/maneuverInstructions";

export const TurnByTurnDrawer: React.FC = () => {
  const { routes, activeRouteIndex, isNavigating, isEmergencyMode } = useNavigation();
  const [isOpen, setIsOpen] = useState(false);

  const currentRoute = routes[activeRouteIndex];
  if (!currentRoute || !currentRoute.steps || currentRoute.steps.length === 0) return null;

  const getStepIcon = (modifier?: string) => {
    if (modifier?.includes("right")) return <CornerUpRight className="w-4 h-4 text-blue-600" />;
    if (modifier?.includes("left")) return <CornerUpLeft className="w-4 h-4 text-blue-600" />;
    return <ArrowUp className={`w-4 h-4 ${isEmergencyMode ? "text-rose-600" : "text-emerald-600"}`} />;
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={`w-full relative pointer-events-auto shrink-0 glass-panel rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
        isEmergencyMode
          ? "border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/40"
          : isNavigating
          ? "border-2 border-blue-500/80"
          : ""
      }`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isEmergencyMode ? "bg-rose-600/15 text-rose-600" : "bg-blue-600/10 text-blue-600"
          }`}>
            {isEmergencyMode ? <Siren className="w-4 h-4 fill-current animate-pulse" /> : <Navigation className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>{isEmergencyMode ? "Emergency Transit" : "Directions"}</span>
              <span>({currentRoute.steps.length} steps)</span>
            </h4>
            <p className="text-sm text-slate-700 font-semibold line-clamp-1">
              {getManeuverInstruction(currentRoute.steps[0])}
            </p>
          </div>
        </div>
        <button className="w-7 h-7 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-600">
          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-slate-200/80 max-h-60 overflow-y-auto space-y-3">
          {currentRoute.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3 text-xs">
              <div className="mt-0.5 shrink-0">
                {getStepIcon(step.maneuver?.modifier)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">
                  {getManeuverInstruction(step)}
                </p>
                {step.distance && (
                  <p className="text-slate-500 text-xs">
                    {(step.distance / 1000).toFixed(2)} km
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
```


## `frontend\src\context\NavigationContext.tsx`

```tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  PlaceSearchResult,
  CandidateRoute,
  checkHealth,
  fetchRoutes,
  RerouteRecommendation,
} from "@/lib/api";
import { AlertManager, ActiveCongestionAlert } from "@/lib/alertManager";
import { TTSService, SpeechPriority } from "@/lib/ttsService";
import { PushNotificationService } from "@/lib/pushNotificationService";
import { RerouteEngine, routesHaveSameGeometry } from "@/lib/rerouteEngine";
import { getManeuverInstruction, getManeuverAnnouncement } from "@/lib/maneuverInstructions";
import { DEFAULT_TRAFFIC_MODE, dynamicTrafficPhase, TrafficTestMode } from "@/lib/trafficScenario";

export interface Coordinate {
  lat: number;
  lon: number;
  name?: string;
}

export type PinDropMode = "none" | "source" | "destination";
export type LayerMode = "ALL" | "AI_ONLY" | "STANDARD_ONLY";

export function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateBearingAngle(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function getUpcomingAvoidHotspots(route: CandidateRoute, distanceAlongRouteM: number) {
  return (route.hotspots || [])
    .filter((hotspot) =>
      (hotspot.congestion_level === "HEAVY" || hotspot.congestion_level === "SEVERE") &&
      hotspot.distance_from_origin_m >= distanceAlongRouteM - 100
    )
    .map((hotspot) => ({ lat: hotspot.lat, lon: hotspot.lon, radius_km: 0.6 }));
}

export function projectPointOntoRoute(point: Coordinate, route: CandidateRoute): { projectedPoint: Coordinate; distanceAlongRouteMeters: number; distanceToRouteMeters: number; segmentIndex: number } {
  let minDistance = Infinity;
  let bestProj: Coordinate = point;
  let bestDistAlong = 0;
  let bestSegmentIdx = 0;

  const coords = route.geometry.coordinates;
  if (!coords || coords.length < 2) return { projectedPoint: point, distanceAlongRouteMeters: 0, distanceToRouteMeters: 0, segmentIndex: 0 };

  let currentRouteDist = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const lon1 = coords[i][0];
    const lat1 = coords[i][1];
    const lon2 = coords[i + 1][0];
    const lat2 = coords[i + 1][1];

    const segLen = haversineMeters(lon1, lat1, lon2, lat2);

    // Project point onto segment (lat1,lon1)-(lat2,lon2) using flat approximation
    // dlat/dlon in degrees - scale lon by cos(lat) to make Euclidean distance proportional to meters
    const cosLat = Math.cos((lat1 * Math.PI) / 180);
    const dx = (lon2 - lon1) * cosLat;
    const dy = lat2 - lat1;
    const px = (point.lon - lon1) * cosLat;
    const py = point.lat - lat1;

    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq !== 0) {
      t = (px * dx + py * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projLon = lon1 + (lon2 - lon1) * t;
    const projLat = lat1 + (lat2 - lat1) * t;

    const distToProj = haversineMeters(point.lon, point.lat, projLon, projLat);

    if (distToProj < minDistance) {
      minDistance = distToProj;
      bestProj = { lon: projLon, lat: projLat };
      bestDistAlong = currentRouteDist + (segLen * t);
      bestSegmentIdx = i;
    }

    currentRouteDist += segLen;
  }

  return { projectedPoint: bestProj, distanceAlongRouteMeters: bestDistAlong, distanceToRouteMeters: minDistance, segmentIndex: bestSegmentIdx };
}

interface NavigationContextType {
  sourceQuery: string;
  setSourceQuery: (q: string) => void;
  destinationQuery: string;
  setDestinationQuery: (q: string) => void;
  searchResults: PlaceSearchResult[];
  setSearchResults: (results: PlaceSearchResult[]) => void;
  selectedOrigin: Coordinate | null;
  setSelectedOrigin: (coord: Coordinate | null) => void;
  selectedDestination: Coordinate | null;
  setSelectedDestination: (coord: Coordinate | null) => void;
  routes: CandidateRoute[];
  setRoutes: (routes: CandidateRoute[]) => void;
  activeRouteIndex: number;
  setActiveRouteIndex: (idx: number) => void;
  isNavigating: boolean;
  setIsNavigating: (nav: boolean) => void;
  backendOnline: boolean | null;
  activeLayerMode: LayerMode;
  setActiveLayerMode: (mode: LayerMode) => void;
  toggleLayerMode: () => void;
  recenterTrigger: number;
  triggerRecenter: () => void;
  isLoadingRoutes: boolean;
  setIsLoadingRoutes: (loading: boolean) => void;
  currentZoom: number;
  setCurrentZoom: (zoom: number) => void;
  pinDropMode: PinDropMode;
  setPinDropMode: (mode: PinDropMode) => void;
  isEmergencyMode: boolean;
  setIsEmergencyMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleEmergencyMode: () => void;
  swapSourceAndDestination: () => void;
  calculateRoutes: (origin?: Coordinate | null, dest?: Coordinate | null, emergencyOverride?: boolean) => Promise<boolean>;

  // Real-Time Navigation & Congestion States
  currentLocation: Coordinate | null;
  vehicleBearing: number;
  currentVehicleSpeed: number;
  simProgressPercent: number;
  simDistanceRemainingM: number;
  simEtaSeconds: number;
  isSimPlaying: boolean;
  setIsSimPlaying: (playing: boolean) => void;
  simSpeedMultiplier: number;
  setSimSpeedMultiplier: (mult: number) => void;
  activeAlert: ActiveCongestionAlert | null;
  dismissAlert: () => void;
  activeRerouteRecommendation: RerouteRecommendation | null;
  dismissReroute: () => void;
  acceptReroute: (recommendation: RerouteRecommendation) => void;
  triggerDynamicRerouteCheck: (force?: boolean) => Promise<void>;
  isApplyingReroute: boolean;
  noRouteReason: string | null;
  dismissNoRouteReason: () => void;
  navigationHudHeight: number;
  setNavigationHudHeight: React.Dispatch<React.SetStateAction<number>>;
  trafficTestMode: TrafficTestMode;
  runTrafficTest: (mode: TrafficTestMode) => Promise<void>;

  nextManeuver: any;
  nextManeuverDistanceM: number;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const BENGALURU_CENTER: Coordinate = {
  lat: 12.9716,
  lon: 77.5946,
  name: "Bengaluru Center",
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sourceQuery, setSourceQuery] = useState("MG Road, Bengaluru");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Coordinate | null>({
    lat: 12.9756,
    lon: 77.6066,
    name: "MG Road, Bengaluru",
  });
  const [selectedDestination, setSelectedDestination] = useState<Coordinate | null>(null);
  const [routes, setRoutes] = useState<CandidateRoute[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [activeLayerMode, setActiveLayerMode] = useState<LayerMode>("ALL");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(12.5);
  const [pinDropMode, setPinDropMode] = useState<PinDropMode>("none");
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [trafficTestMode, setTrafficTestMode] = useState<TrafficTestMode>(DEFAULT_TRAFFIC_MODE);
  const trafficTestModeRef = useRef<TrafficTestMode>(DEFAULT_TRAFFIC_MODE);
  const lastDynamicPhaseRef = useRef<string>("LOW");
  const dynamicProgressRef = useRef(0);

  // Real-Time Simulation & Navigation Telemetry
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const currentLocationRef = useRef<Coordinate | null>(null);
  const [vehicleBearing, setVehicleBearing] = useState<number>(0);
  const [currentVehicleSpeed, setCurrentVehicleSpeed] = useState<number>(45.0);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [simDistanceRemainingM, setSimDistanceRemainingM] = useState<number>(0);
  const [simEtaSeconds, setSimEtaSeconds] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplierState] = useState<number>(1);
  const simSpeedMultiplierRef = useRef(1);
  const setSimSpeedMultiplier = useCallback((multiplier: number) => {
    const normalizedMultiplier = Math.max(1, multiplier);
    simSpeedMultiplierRef.current = normalizedMultiplier;
    setSimSpeedMultiplierState(normalizedMultiplier);
  }, []);
  const [activeAlert, setActiveAlert] = useState<ActiveCongestionAlert | null>(null);
  const [activeRerouteRecommendation, setActiveRerouteRecommendation] = useState<RerouteRecommendation | null>(null);
  const [noRouteReason, setNoRouteReason] = useState<string | null>(null);
  const [navigationHudHeight, setNavigationHudHeight] = useState(0);

  const [nextManeuver, setNextManeuver] = useState<any>(null);
  const [nextManeuverDistanceM, setNextManeuverDistanceM] = useState<number>(500);

  // Continuous Interpolation Distance and Animation References
  const simDistanceTraversedRef = useRef<number>(0);
  const currentBearingRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastAlertCheckDistanceRef = useRef<number>(-999);
  const lastAutoRerouteCheckTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastRerouteInteractionTimeRef = useRef<number>(0);
  const isTransitioningRouteRef = useRef<boolean>(false);
  const rerouteRequestIdRef = useRef<number>(0);
  const [isApplyingReroute, setIsApplyingReroute] = useState(false);
  
  const activeRouteRef = useRef<CandidateRoute | null>(null);
  useEffect(() => {
    activeRouteRef.current = routes[activeRouteIndex] || null;
  }, [routes, activeRouteIndex]);

  // Subscribe to AlertManager and RerouteEngine
  useEffect(() => {
    const unsubAlert = AlertManager.subscribe((alert) => {
      setActiveAlert(alert);
      if (!alert) {
        PushNotificationService.clearCongestionAlert();
        if (RerouteEngine.getActiveRecommendation()) {
          RerouteEngine.dismissRecommendation();
          setActiveRerouteRecommendation(null);
        }
      }
    });
    const unsubReroute = RerouteEngine.subscribe((rec, reason) => {
      setNoRouteReason(reason);
      if (!rec || !rec.is_reroute_recommended || !rec.recommended_route) {
        setActiveRerouteRecommendation(null);
        PushNotificationService.clearRerouteAlert();
        return;
      }
      
      const now = Date.now();
      if (now - lastRerouteInteractionTimeRef.current < 30000) {
        // Cooldown active, ignore new recommendations
        RerouteEngine.dismissRecommendation();
        return;
      }

      // Compare against the remaining active geometry, not total route distance:
      // reroute geometry starts at the vehicle while the active route starts at origin.
      const currentRoute = activeRouteRef.current;
      if (currentRoute && routesHaveSameGeometry(rec.recommended_route, currentRoute)) {
          // Dismiss duplicates so periodic checks can recover, and avoid stale UI.
          RerouteEngine.dismissRecommendation();
          return;
      }

      setActiveRerouteRecommendation(rec);
    });
    return () => {
      unsubAlert();
      unsubReroute();
    };
  }, []);

  const toggleLayerMode = () => {
    setActiveLayerMode((prev) => {
      if (prev === "ALL") return "AI_ONLY";
      if (prev === "AI_ONLY") return "STANDARD_ONLY";
      return "ALL";
    });
  };

  const triggerRecenter = () => setRecenterTrigger((prev) => prev + 1);

  const calculateRoutes = async (
    origin?: Coordinate | null,
    dest?: Coordinate | null,
    emergencyOverride?: boolean,
    trafficMode: TrafficTestMode = trafficTestModeRef.current,
    trafficProgress: number = 0
  ): Promise<boolean> => {
    const originCoord = origin || selectedOrigin;
    const destCoord = dest || selectedDestination;
    if (!originCoord || !destCoord) return false;

    const emergency = emergencyOverride !== undefined ? emergencyOverride : isEmergencyMode;

    TTSService.reset();
    setIsLoadingRoutes(true);
    try {
      const response = await fetchRoutes(
        originCoord.lat,
        originCoord.lon,
        destCoord.lat,
        destCoord.lon,
        emergency,
        trafficMode,
        trafficProgress
      );
      if (response.success && response.candidates.length > 0) {
        setRoutes(response.candidates);
        setActiveRouteIndex(0);
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        AlertManager.reset();
        RerouteEngine.dismissRecommendation();
        setActiveRerouteRecommendation(null);
        lastDynamicPhaseRef.current = "LOW";
        return true;
      }
      return false;
    } catch (err) {
      console.error("[NavigationContext] Routing calculation error:", err);
      return false;
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  const runTrafficTest = async (mode: TrafficTestMode) => {
    TTSService.warmUp();
    trafficTestModeRef.current = mode;
    setTrafficTestMode(mode);
    setIsNavigating(false);
    setIsSimPlaying(true);
    setSimSpeedMultiplier(1);
    setIsEmergencyMode(false);
    setActiveLayerMode("ALL");
    setActiveRerouteRecommendation(null);
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    RerouteEngine.dismissNoRouteReason();
    lastDynamicPhaseRef.current = "LOW";
    dynamicProgressRef.current = 0;

    let origin = selectedOrigin;
    let destination = selectedDestination;
    if (mode !== "real") {
      origin = { lat: 12.9756, lon: 77.6066, name: "MG Road, Bengaluru" };
      destination = { lat: 12.9352, lon: 77.6245, name: "Koramangala, Bengaluru" };
      setSelectedOrigin(origin);
      setSelectedDestination(destination);
      setSourceQuery(origin.name || "MG Road, Bengaluru");
      setDestinationQuery(destination.name || "Koramangala, Bengaluru");
    }
    if (!origin || !destination) return;
    const loaded = await calculateRoutes(origin, destination, false, mode, 0);
    if (loaded) setIsNavigating(true);
  };

  const refreshTrafficScenario = useCallback(async (route: CandidateRoute, progress: number) => {
    const destination = selectedDestination;
    const start = route.geometry?.coordinates?.[0];
    if (!destination || !start || trafficTestModeRef.current === "real") return;

    try {
      const response = await fetchRoutes(
        start[1], start[0], destination.lat, destination.lon,
        isEmergencyMode, trafficTestModeRef.current, progress
      );
      const evaluatedRoute = response.candidates?.[0];
      if (!response.success || !evaluatedRoute) return;

      setRoutes((currentRoutes) => currentRoutes.map((currentRoute) =>
        currentRoute.route_id === route.route_id
          ? {
              ...currentRoute,
              segments: evaluatedRoute.segments,
              hotspots: evaluatedRoute.hotspots,
              clear_distance_km: evaluatedRoute.clear_distance_km,
              moderate_distance_km: evaluatedRoute.moderate_distance_km,
              heavy_distance_km: evaluatedRoute.heavy_distance_km,
              severe_distance_km: evaluatedRoute.severe_distance_km,
              total_delay_seconds: evaluatedRoute.total_delay_seconds,
              predicted_duration_seconds: evaluatedRoute.predicted_duration_seconds,
              predicted_duration_minutes: evaluatedRoute.predicted_duration_minutes,
            }
          : currentRoute
      ));
    } catch (error) {
      console.warn("[NavigationContext] Could not refresh test traffic conditions:", error);
    }
  }, [selectedDestination, isEmergencyMode]);

  const toggleEmergencyMode = () => {
    const newEmergency = !isEmergencyMode;
    setIsEmergencyMode(newEmergency);
    if (selectedOrigin && selectedDestination) {
      calculateRoutes(selectedOrigin, selectedDestination, newEmergency);
    }
  };

  const swapSourceAndDestination = async () => {
    const oldOrigin = selectedOrigin;
    const oldDest = selectedDestination;
    const oldSrcQuery = sourceQuery;
    const oldDestQuery = destinationQuery;

    setSelectedOrigin(oldDest);
    setSelectedDestination(oldOrigin);
    setSourceQuery(oldDestQuery);
    setDestinationQuery(oldSrcQuery);

    if (oldDest && oldOrigin) {
      await calculateRoutes(oldDest, oldOrigin);
    }
  };

  const dismissAlert = () => {
    AlertManager.dismissCurrentAlert();
  };

  const dismissReroute = () => {
    lastRerouteInteractionTimeRef.current = Date.now();
    setActiveRerouteRecommendation(null);
    RerouteEngine.dismissRecommendation();
    PushNotificationService.clearRerouteAlert();
  };

  const dismissNoRouteReason = () => RerouteEngine.dismissNoRouteReason();

  const activateRoute = (newRoute: CandidateRoute, preservePosition: boolean = false): boolean => {
    if (isTransitioningRouteRef.current) return false;
    if (!newRoute || !newRoute.geometry?.coordinates) return false;

    // REROUTE STATE VERSIONING: Generate an activation ID
    const activationId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    
    isTransitioningRouteRef.current = true;

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const firstCoord = newRoute.geometry.coordinates[0];
    const lastCoord = newRoute.geometry.coordinates[newRoute.geometry.coordinates.length - 1];
    const totalRouteDistance = newRoute.distance_meters || 0;
    const distToDest = selectedDestination && currentLocation ? haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat) : 0;
    
    let proj: ReturnType<typeof projectPointOntoRoute> | null = null;
    let fallbackToStart = false;

    if (preservePosition && currentLocation) {
      proj = projectPointOntoRoute(currentLocation, newRoute);
      
      // VERIFY activateRoute safety
      const isImplausiblyFar = proj.distanceToRouteMeters > 500; // 500m off-route is implausible
      const isProjectedNearEndWhileNotActuallyNearDest = 
        (totalRouteDistance - proj.distanceAlongRouteMeters < 50) && (distToDest > 100);

      // 7. HARD INVARIANT: candidate geometry must be consistent with reported distance
      let calculatedPolylineM = 0;
      for (let i = 1; i < newRoute.geometry.coordinates.length; i++) {
        calculatedPolylineM += haversineMeters(
          newRoute.geometry.coordinates[i-1][0], newRoute.geometry.coordinates[i-1][1],
          newRoute.geometry.coordinates[i][0], newRoute.geometry.coordinates[i][1]
        );
      }
      const isGeometryAbsurd = Math.abs(calculatedPolylineM - totalRouteDistance) > Math.max(500, totalRouteDistance * 0.2);

      if (isImplausiblyFar || isProjectedNearEndWhileNotActuallyNearDest || isGeometryAbsurd) {
        console.warn(`[NavigationContext] CATASTROPHIC ROUTE ERROR: Reroute projection rejected. distanceToRouteMeters: ${proj.distanceToRouteMeters}m, projectedDist: ${proj.distanceAlongRouteMeters}m, totalRouteDist: ${totalRouteDistance}m, distToDest: ${distToDest}m, calculatedPolyline: ${calculatedPolylineM}m`);
        // 1. NEVER call setCurrentLocation(firstCoord) for a rejected reroute.
        // A failed/invalid route must never change the physical vehicle position.
        return false; // ABORT ACTIVATION COMPLETELY
      } else {
        simDistanceTraversedRef.current = proj.distanceAlongRouteMeters;
        // IMPORTANT: Do not teleport the vehicle to the projected point (proj.projectedPoint).
        // Let the simulation loop smoothly interpolate from the physical currentLocation.
      }
    } else {
      fallbackToStart = true;
    }

    if (fallbackToStart) {
      simDistanceTraversedRef.current = 0;
      if (newRoute.geometry?.coordinates?.length > 0) {
        const startLocation = { lon: firstCoord[0], lat: firstCoord[1] };
        currentLocationRef.current = startLocation;
        setCurrentLocation(startLocation);
      }
    }

    // PART 1 & 2 - DETERMINISTIC DEBUG CHECK
    if (preservePosition && currentLocation && proj) {
      console.log(`[REROUTE ACTIVATION DEBUG]`, {
        routeId: newRoute.route_id,
        activationId,
        source: newRoute.source || "unknown",
        distance_meters: newRoute.distance_meters,
        duration_seconds: newRoute.duration_seconds,
        predicted_duration_seconds: newRoute.predicted_duration_seconds,
        geometryCoordinateCount: newRoute.geometry.coordinates.length,
        firstCoordinate: firstCoord,
        lastCoordinate: lastCoord,
        currentLocationBeforeActivation: { ...currentLocation },
        projectedPoint: proj.projectedPoint,
        projectedDistanceAlongRouteM: proj.distanceAlongRouteMeters,
        distanceToRouteMeters: proj.distanceToRouteMeters,
        currentLocationAfterActivation: fallbackToStart ? { lon: firstCoord[0], lat: firstCoord[1] } : { ...currentLocation },
        distanceCurrentToDestinationM: distToDest,
        totalRouteDistanceM: totalRouteDistance,
        simDistanceTraversedM: simDistanceTraversedRef.current
      });
    }

    lastFrameTimeRef.current = performance.now();
    lastAlertCheckDistanceRef.current = -999;
    lastAutoRerouteCheckTimeRef.current = Date.now();
    lastRerouteInteractionTimeRef.current = Date.now();
    
    AlertManager.reset();
    RerouteEngine.dismissRecommendation();
    TTSService.reset();

    // Make newRoute the active route at index 0
    setRoutes((prev) => [newRoute, ...prev.filter((r) => r.route_id !== newRoute.route_id)]);
    setActiveRouteIndex(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTransitioningRouteRef.current = false;
      });
    });
    return true;
  };

  const acceptReroute = (recommendation: RerouteRecommendation) => {
    if (!recommendation || !recommendation.recommended_route) return;
    
    // 2. Log and verify the exact recommended_route object entering acceptReroute
    const recRoute = recommendation.recommended_route;
    let calcGeomLength = 0;
    if (recRoute.geometry?.coordinates) {
      for (let i = 1; i < recRoute.geometry.coordinates.length; i++) {
        calcGeomLength += haversineMeters(
          recRoute.geometry.coordinates[i-1][0], recRoute.geometry.coordinates[i-1][1],
          recRoute.geometry.coordinates[i][0], recRoute.geometry.coordinates[i][1]
        );
      }
    }
    const distDest = (selectedDestination && recRoute.geometry?.coordinates?.length) ? haversineMeters(
      recRoute.geometry.coordinates[0][0], recRoute.geometry.coordinates[0][1],
      selectedDestination.lon, selectedDestination.lat
    ) : 0;

    console.log(`[ACCEPT REROUTE DIAGNOSTIC] Entering acceptReroute():`, {
      route_id: recRoute.route_id,
      source: recRoute.source,
      distance_meters: recRoute.distance_meters,
      geometry_coordinates_length: recRoute.geometry?.coordinates?.length,
      first_coordinate: recRoute.geometry?.coordinates?.[0],
      last_coordinate: recRoute.geometry?.coordinates?.[recRoute.geometry.coordinates.length - 1],
      destination_distance: distDest,
      calculated_geometry_length: calcGeomLength
    });

    setIsApplyingReroute(true);
    const switched = activateRoute(recommendation.recommended_route, true);
    setIsApplyingReroute(false);
    if (switched) {
      if (recommendation.is_congestion_avoidance) {
        const viaRoad = recommendation.recommended_route?.steps?.find(
          (step) => Boolean(step.name?.trim()) && step.maneuver?.type !== "depart",
        )?.name?.trim();
        TTSService.speakRerouteSuggestion(recommendation.time_saved_minutes, viaRoad, true);
      } else {
        TTSService.announce(
          `Route updated. The new route saves about ${Math.round(recommendation.time_saved_minutes)} minutes.`,
          SpeechPriority.NORMAL,
          `route_updated_${recommendation.recommended_route?.route_id || Date.now()}`,
        );
      }
    } else {
      setActiveRerouteRecommendation(null);
      RerouteEngine.dismissRecommendation();
      TTSService.announce(
        "Could not switch routes. Continue on the current route.",
        SpeechPriority.NORMAL,
        "reroute_switch_failed",
      );
    }
  };

  // Speech rate is evaluated at dequeue time from the same ref used by the turn thresholds.
  useEffect(() => {
    TTSService.setRateProvider(() =>
      Math.min(2.0, 1.05 * (1 + (simSpeedMultiplierRef.current - 1) * 0.25)),
    );
    return () => TTSService.reset();
  }, []);

  const triggerDynamicRerouteCheck = useCallback(
    async (force: boolean = false) => {
      const activeRoute = routes[activeRouteIndex];
      if (!activeRoute || !selectedDestination || !currentLocation || !isNavigating) return;

      const currentReqId = ++rerouteRequestIdRef.current;

      // Ensure we are physically on route before fetching a reroute
      const proj = projectPointOntoRoute(currentLocation, activeRoute);
      const distanceFromVehicleToRouteMeters = haversineMeters(currentLocation.lon, currentLocation.lat, proj.projectedPoint.lon, proj.projectedPoint.lat);
      if (distanceFromVehicleToRouteMeters > 500) {
        console.warn("[REROUTE BLOCKED] Current vehicle position is not on active route.");
        return;
      }

      // Check distance to destination
      const distToDest = haversineMeters(currentLocation.lon, currentLocation.lat, selectedDestination.lon, selectedDestination.lat);
      if (distToDest <= 500) return;
      
      const totalRouteDistance = activeRoute.distance_meters || 1;
      const traversedDist = simDistanceTraversedRef.current;
      const remainingDist = Math.max(0, totalRouteDistance - traversedDist);
      const progressRatio = Math.min(1.0, traversedDist / totalRouteDistance);
      
      // Calculate true remaining ETA instead of passing full route ETA
      const totalSeconds = activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 600;
      const remainingSec = Math.max(0, (1.0 - progressRatio) * totalSeconds);

      try {
        const rec = await RerouteEngine.checkAndReevaluate(
          currentLocation.lat,
          currentLocation.lon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          currentVehicleSpeed,
          isEmergencyMode,
          force,
          trafficTestModeRef.current,
          progressRatio,
          force ? getUpcomingAvoidHotspots(activeRoute, traversedDist) : []
        );
        
        // Ignore stale responses
        if (currentReqId !== rerouteRequestIdRef.current) return;
      } catch (e) {
        console.error("Reroute check error", e);
      }
    },
    [routes, activeRouteIndex, selectedDestination, currentLocation, currentVehicleSpeed, isEmergencyMode]
  );

  const hasInitializedJourneyRef = useRef(false);

  // Active navigation start / stop handling
  useEffect(() => {
    if (isNavigating) {
      if (hasInitializedJourneyRef.current) return; // Do not reset if journey is already running

      const activeRoute = routes[activeRouteIndex];
      if (activeRoute && activeRoute.geometry?.coordinates?.length > 0) {
        const firstCoord = activeRoute.geometry.coordinates[0];
        const startLocation = { lon: firstCoord[0], lat: firstCoord[1] };
        currentLocationRef.current = startLocation;
        setCurrentLocation(startLocation);
        simDistanceTraversedRef.current = 0;
        lastAlertCheckDistanceRef.current = -999;
        lastAutoRerouteCheckTimeRef.current = 0;
        TTSService.warmUp();
        setSimProgressPercent(0);
        setSimDistanceRemainingM(activeRoute.distance_meters || 0);
        setSimEtaSeconds(activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 0);
        setIsSimPlaying(true);
        lastFrameTimeRef.current = performance.now();

        TTSService.announce(
          isEmergencyMode
            ? "Starting Emergency Priority Navigation. Clear corridor mode active."
            : "Starting navigation. Drive safely.",
          SpeechPriority.NORMAL,
          `navigation_started_${activeRoute.route_id || activeRouteIndex}`,
        );
        hasInitializedJourneyRef.current = true;
      }
    } else {
      hasInitializedJourneyRef.current = false;
      TTSService.reset();
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      AlertManager.reset();
      RerouteEngine.dismissRecommendation();
      RerouteEngine.dismissNoRouteReason();
      currentLocationRef.current = null;
      setCurrentLocation(null);
      setActiveRerouteRecommendation(null);
    }
  }, [isNavigating, activeRouteIndex, routes, isEmergencyMode]);

  // High-Frequency Smooth Interpolated Driving Simulation Loop (Section 4 & 5)
  useEffect(() => {
    if (!isNavigating || !isSimPlaying) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    const activeRoute = routes[activeRouteIndex];
    if (!activeRoute || !activeRoute.geometry?.coordinates) return;

    const coords = activeRoute.geometry.coordinates as [number, number][];
    const totalPoints = coords.length;
    if (totalPoints < 2) return;

    // Precalculate segment lengths and cumulative distances
    const segmentDistances: number[] = [];
    const cumulativeDistances: number[] = [0];
    let totalRouteDistanceM = 0;

    for (let i = 1; i < totalPoints; i++) {
      const d = haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      segmentDistances.push(d);
      totalRouteDistanceM += d;
      cumulativeDistances.push(totalRouteDistanceM);
    }

    if (totalRouteDistanceM <= 0) return;

    // Initialize bearing from first segment
    if (currentBearingRef.current === 0 && totalPoints >= 2) {
      currentBearingRef.current = calculateBearingAngle(
        coords[0][0],
        coords[0][1],
        coords[1][0],
        coords[1][1]
      );
      setVehicleBearing(currentBearingRef.current);
    }

    lastFrameTimeRef.current = performance.now();

    const animateDrive = (now: number) => {
      if (isTransitioningRouteRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(animateDrive);
        return;
      }
      const liveLocation = currentLocationRef.current;
      if (!isNavigating || !isSimPlaying || !activeRoute || !liveLocation) return;
      // Measure distance to route polyline once per route activation
      if (!lastFrameTimeRef.current || (now - lastFrameTimeRef.current < 100 && simDistanceTraversedRef.current === 0)) {
        const { distanceToRouteMeters } = projectPointOntoRoute(liveLocation, activeRoute);
        console.log(`[NavigationContext] initial frame - distance from physical location to route polyline: ${distanceToRouteMeters.toFixed(2)}m`);
      }

      const dtSeconds = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      const currentDist = simDistanceTraversedRef.current;

      // Section 3: Arrival sanity check
      if (currentDist >= totalRouteDistanceM) {
        // Enforce strict arrival: must actually be near destination
        const distToDest = selectedDestination && liveLocation
          ? haversineMeters(liveLocation.lon, liveLocation.lat, selectedDestination.lon, selectedDestination.lat)
          : 0;

        const MIN_REASONABLE_ROUTE_DISTANCE = 50; // Guard against 9m phantom routes
        
        if (totalRouteDistanceM < MIN_REASONABLE_ROUTE_DISTANCE && distToDest > 50) {
          console.error(`[NavigationContext] CATASTROPHIC ROUTE ERROR: Route is only ${Math.round(totalRouteDistanceM)}m long, but destination is ${Math.round(distToDest)}m away. ABORTING ARRIVAL.`);
          // We do not arrive. The route is fundamentally broken.
          // Fallback logic could go here, but for now we halt simulation to prevent teleportation.
          setIsSimPlaying(false);
          return;
        }

        if (distToDest <= 50) {
          if (totalRouteDistanceM < 50) {
            console.log("[NavigationContext] Arrived on short route segment:", Math.round(totalRouteDistanceM), "m");
          } else {
            console.log("[NavigationContext] Arrived at destination.");
          }
          setSimProgressPercent(100);
          setSimDistanceRemainingM(0);
          setSimEtaSeconds(0);
          setIsSimPlaying(false);
          AlertManager.reset();
          RerouteEngine.dismissRecommendation();
          RerouteEngine.dismissNoRouteReason();
          setActiveRerouteRecommendation(null);
          PushNotificationService.clearCongestionAlert();
          PushNotificationService.clearRerouteAlert();
          const lastPt = coords[totalPoints - 1];
          setCurrentLocation({ lon: lastPt[0], lat: lastPt[1] });
          TTSService.announce(
            "You have arrived at your destination.",
            SpeechPriority.CRITICAL,
            `arrived_${activeRoute.route_id || activeRouteIndex}`,
          );
          return;
        } else {
          // False arrival due to malformed route, do not trigger arrival.
          console.warn(`[NavigationContext] Suppressing false arrival: route end reached but destination is ${Math.round(distToDest)}m away.`);
          // Pause simulation to prevent out-of-bounds error, but do not arrive.
          setIsSimPlaying(false);
          return;
        }
      }

      // Progress ratio (0.0 to 1.0)
      const progressRatio = Math.min(1.0, currentDist / totalRouteDistanceM);
      const scenarioProgress = trafficTestModeRef.current === "dynamic"
        ? Math.max(dynamicProgressRef.current, progressRatio)
        : progressRatio;
      if (trafficTestModeRef.current === "dynamic") dynamicProgressRef.current = scenarioProgress;

      // Determine current segment speed
      let speedKmh = 40.0;
      if (activeRoute.segments && activeRoute.segments.length > 0) {
        const segIdx = Math.min(
          activeRoute.segments.length - 1,
          Math.floor(progressRatio * activeRoute.segments.length)
        );
        const seg = activeRoute.segments[segIdx];
        if (seg && seg.current_speed_kmh) {
          speedKmh = seg.current_speed_kmh;
        }
      }

      // Simulation advancement: responsive pace scaling (~6x real-time at 1x)
      const simPaceMultiplier = 6.0;
      const speedMs = (speedKmh * 1000) / 3600;
      const deltaDistance = speedMs * simPaceMultiplier * simSpeedMultiplier * dtSeconds;
      const newDist = Math.min(totalRouteDistanceM, currentDist + deltaDistance);
      console.log("[REROUTE-DEBUG]", { event: "animateDrive_tick", dist: simDistanceTraversedRef.current, totalRouteDistanceM });
      simDistanceTraversedRef.current = newDist;

      // Find the segment containing newDist
      let segIndex = 0;
      for (let i = 0; i < segmentDistances.length; i++) {
        if (newDist >= cumulativeDistances[i] && newDist <= cumulativeDistances[i + 1]) {
          segIndex = i;
          break;
        }
        if (i === segmentDistances.length - 1) {
          segIndex = i;
        }
      }

      const p1 = coords[segIndex];
      const p2 = coords[Math.min(totalPoints - 1, segIndex + 1)];
      const segLen = Math.max(0.1, segmentDistances[segIndex] || 1);
      const segOffset = Math.max(0, newDist - cumulativeDistances[segIndex]);
      const t = Math.min(1.0, Math.max(0.0, segOffset / segLen));

      // Interpolate coordinates
      const interpLon = p1[0] + t * (p2[0] - p1[0]);
      const interpLat = p1[1] + t * (p2[1] - p1[1]);
      const newLocation = { lon: interpLon, lat: interpLat };

      // Interpolate Bearing smoothly with shortest angular distance
      const targetBearing = calculateBearingAngle(p1[0], p1[1], p2[0], p2[1]);
      const currBearing = currentBearingRef.current;
      const angleDiff = ((((targetBearing - currBearing) % 360) + 540) % 360) - 180;
      const smoothedBearing = (currBearing + angleDiff * Math.min(1.0, 8.0 * dtSeconds) + 360) % 360;
      currentBearingRef.current = smoothedBearing;

      // Update state
      currentLocationRef.current = newLocation;
      setCurrentLocation(newLocation);
      setVehicleBearing(smoothedBearing);
      setCurrentVehicleSpeed(Math.round(speedKmh));
      setSimProgressPercent(Math.min(100, Math.round(progressRatio * 100)));
      setSimDistanceRemainingM(Math.max(0, totalRouteDistanceM - newDist));
      setSimEtaSeconds(Math.max(0, Math.round(
        (activeRoute.predicted_duration_seconds || activeRoute.duration_seconds || 0) * (1 - progressRatio)
      )));

      // Speed-Aware Congestion Alert Evaluation (Throttled per ~80m of progress)
      if (Math.abs(newDist - lastAlertCheckDistanceRef.current) >= 80) {
        lastAlertCheckDistanceRef.current = newDist;
        const hotspots = activeRoute.hotspots || [];

        AlertManager.evaluatePosition(interpLat, interpLon, hotspots, speedKmh, (alert) => {
          TTSService.speakCongestionAlert(
            alert.locationName,
            alert.distanceText,
            alert.averageSpeedKmh,
            alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : undefined,
            true,
            alert.congestionLevel
          );

          PushNotificationService.sendCongestionAlert(
            alert.locationName,
            alert.distanceText,
            alert.estimatedDelaySeconds ? alert.estimatedDelaySeconds / 60 : 3,
            alert.averageSpeedKmh,
            alert.congestionLevel
          );

          // Proactively check for reroute when a new congestion alert stage triggers
          // Only check if no recommendation is already pending
          if ((alert.congestionLevel === "HEAVY" || alert.congestionLevel === "SEVERE") && selectedDestination && !RerouteEngine.getActiveRecommendation()) {
            const traversed = simDistanceTraversedRef.current;
            const activeRouteDist = activeRoute.distance_meters || 1;
            const activeRatio = Math.min(1.0, traversed / activeRouteDist);
            const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
            
            RerouteEngine.checkAndReevaluate(
              interpLat,
              interpLon,
              selectedDestination.lat,
              selectedDestination.lon,
              remainingSec,
              speedKmh,
              isEmergencyMode,
              true,
              trafficTestModeRef.current,
              Math.min(1, newDist / totalRouteDistanceM),
              getUpcomingAvoidHotspots(activeRoute, newDist)
            );
          }
        }, newDist);
      }

      // Step-by-step Turn Maneuver Guidance & Two-Tier Voice Announcements
      if (activeRoute.steps && activeRoute.steps.length > 0) {
        let cumulativeStepDist = 0;
        let currentStepIndex = 0;
        let estDistToTurn = 0;

        for (let i = 0; i < activeRoute.steps.length; i++) {
          const step = activeRoute.steps[i];
          cumulativeStepDist += (step.distance || 0);
          if (cumulativeStepDist > currentDist) {
            currentStepIndex = i;
            estDistToTurn = cumulativeStepDist - currentDist;
            break;
          }
        }

        if (cumulativeStepDist <= currentDist) {
          currentStepIndex = activeRoute.steps.length - 1;
          estDistToTurn = 0;
        }

        // OSRM's current step describes the maneuver that entered this road; the next
        // step is the maneuver still ahead of the vehicle. Clamp to the arrival step.
        const upcomingStepIndex = Math.min(currentStepIndex + 1, activeRoute.steps.length - 1);
        const upcomingStep = activeRoute.steps[upcomingStepIndex];

        if (upcomingStep) {
          setNextManeuver(upcomingStep);
          setNextManeuverDistanceM(Math.round(estDistToTurn));

          const speedMultiplier = simSpeedMultiplierRef.current;
          const advanceThreshold = 400 * speedMultiplier;
          const imminentThreshold = 150 * speedMultiplier;
          
          const routeId = activeRoute.route_id || `idx-${activeRouteIndex}`;

          // Tier 1: Advance Heads-up
          if (
            estDistToTurn <= advanceThreshold &&
            estDistToTurn > imminentThreshold
          ) {
            const announcement = getManeuverAnnouncement(upcomingStep, estDistToTurn);
            if (announcement) {
              TTSService.announce(
                announcement,
                SpeechPriority.CRITICAL,
                `${routeId}_${upcomingStepIndex}_advance`,
                30 * 60_000,
              );
            }
          }

          // Tier 2: Imminent
          if (estDistToTurn <= imminentThreshold) {
            const imminentText = getManeuverInstruction(upcomingStep);
            TTSService.announce(
              imminentText,
              SpeechPriority.CRITICAL,
              `${routeId}_${upcomingStepIndex}_imminent`,
              30 * 60_000,
            );
          }
        }
      }

      // Dynamic demo phases are tied to route progress, so the conditions change with the journey.
      if (trafficTestModeRef.current === "dynamic") {
        const phase = dynamicTrafficPhase(scenarioProgress);
        if (phase !== lastDynamicPhaseRef.current) {
          lastDynamicPhaseRef.current = phase;
          void refreshTrafficScenario(activeRoute, scenarioProgress);
          if (phase === "LOW") {
            AlertManager.reset();
            RerouteEngine.dismissRecommendation();
            setActiveRerouteRecommendation(null);
            TTSService.announce("Traffic has cleared. Continue on the current route.", SpeechPriority.NORMAL, "traffic_cleared");
          }
          if (phase === "HEAVY" && selectedDestination) {
            const remainingRatio = Math.max(0, 1 - scenarioProgress);
            const remainingSeconds = remainingRatio * (activeRoute.predicted_duration_seconds || activeRoute.duration_seconds);
            RerouteEngine.checkAndReevaluate(
              interpLat, interpLon, selectedDestination.lat, selectedDestination.lon,
              remainingSeconds, speedKmh, isEmergencyMode, true,
              trafficTestModeRef.current, scenarioProgress,
              getUpcomingAvoidHotspots(activeRoute, newDist)
            );
          }
        }
      }

      // Continuous Automatic Reroute Re-Evaluation (Gated when recommendation is already displayed)
      const nowMs = Date.now();
      if (
        selectedDestination &&
        !RerouteEngine.getActiveRecommendation() &&
        nowMs - lastAutoRerouteCheckTimeRef.current > 7000
      ) {
        lastAutoRerouteCheckTimeRef.current = nowMs;
        const traversed = simDistanceTraversedRef.current;
        const activeRouteDist = activeRoute.distance_meters || 1;
        const activeRatio = Math.min(1.0, traversed / activeRouteDist);
        const remainingSec = Math.max(0, (1.0 - activeRatio) * (activeRoute.predicted_duration_seconds || 600));
        
        RerouteEngine.checkAndReevaluate(
          interpLat,
          interpLon,
          selectedDestination.lat,
          selectedDestination.lon,
          remainingSec,
          speedKmh,
          isEmergencyMode,
          false,
          trafficTestModeRef.current,
          trafficTestModeRef.current === "dynamic" ? scenarioProgress : activeRatio,
          []
        );
      }

      animationFrameIdRef.current = requestAnimationFrame(animateDrive);
    };

    animationFrameIdRef.current = requestAnimationFrame(animateDrive);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [
    isNavigating,
    isSimPlaying,
    simSpeedMultiplier,
    routes,
    activeRouteIndex,
    selectedDestination,
    isEmergencyMode,
    refreshTrafficScenario,
  ]);

  // Backend Health Polling
  useEffect(() => {
    const pollHealth = async () => {
      try {
        await checkHealth();
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };
    pollHealth();
    const interval = setInterval(pollHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        sourceQuery,
        setSourceQuery,
        destinationQuery,
        setDestinationQuery,
        searchResults,
        setSearchResults,
        selectedOrigin,
        setSelectedOrigin,
        selectedDestination,
        setSelectedDestination,
        routes,
        setRoutes,
        activeRouteIndex,
        setActiveRouteIndex,
        isNavigating,
        setIsNavigating,
        backendOnline,

        activeLayerMode,
        setActiveLayerMode,
        toggleLayerMode,
        recenterTrigger,
        triggerRecenter,
        isLoadingRoutes,
        setIsLoadingRoutes,
        currentZoom,
        setCurrentZoom,
        pinDropMode,
        setPinDropMode,
        isEmergencyMode,
        trafficTestMode,
        runTrafficTest,
        setIsEmergencyMode,
        toggleEmergencyMode,
        swapSourceAndDestination,
        calculateRoutes,

        // Real-time navigation & congestion states
        currentLocation,
        vehicleBearing,
        isApplyingReroute,
        currentVehicleSpeed,
        simProgressPercent,
        simDistanceRemainingM,
        simEtaSeconds,
        isSimPlaying,
        setIsSimPlaying,
        simSpeedMultiplier,
        setSimSpeedMultiplier,
        activeAlert,
        dismissAlert,
        activeRerouteRecommendation,
        dismissReroute,
        acceptReroute,
        triggerDynamicRerouteCheck,
        noRouteReason,
        dismissNoRouteReason,
        navigationHudHeight,
        setNavigationHudHeight,

        nextManeuver,
        nextManeuverDistanceM,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
};
```


## `frontend\src\lib\alertManager.ts`

```typescript
import { CongestionHotspot, CongestionLevel } from "./api";

export interface ActiveCongestionAlert {
  hotspotId: string;
  locationName: string;
  distanceMeters: number;
  distanceText: string;
  stage: 1 | 2 | 3;
  congestionLevel: CongestionLevel;
  averageSpeedKmh: number;
  estimatedDelaySeconds: number;
  description: string;
  timestamp: number;
  spoken: boolean;
}

export type AlertListener = (alert: ActiveCongestionAlert | null) => void;

export class AlertManager {
  private static listeners: Set<AlertListener> = new Set();
  private static activeAlert: ActiveCongestionAlert | null = null;
  private static triggeredStages: Map<string, Set<number>> = new Map();

  // Distance Thresholds in meters for proactive alert triggers
  public static readonly STAGE_1_THRESHOLD_M = 1200; // 1.2 km heads-up
  public static readonly STAGE_2_THRESHOLD_M = 500;  // 500 m approaching warning
  public static readonly STAGE_3_THRESHOLD_M = 200;  // 200 m imminent bottleneck

  public static subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    listener(this.activeAlert);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeAlert);
      } catch (err) {
        console.error("AlertManager listener error:", err);
      }
    });
  }

  public static formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }

  public static haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Evaluates user's current GPS position against route congestion hotspots.
   * Dynamically decrements distance (e.g. 1.1 km -> 500 m -> 200 m) and emits proactive alerts.
   * Speed-aware: thresholds adapt based on vehicle speed for journey-aware alerts.
   */
  public static evaluatePosition(
    userLat: number,
    userLon: number,
    hotspots: CongestionHotspot[],
    currentSpeedKmh: number,
    onNewStageAlert?: (alert: ActiveCongestionAlert) => void,
    distanceAlongRouteMeters?: number
  ): ActiveCongestionAlert | null {
    if (!hotspots || hotspots.length === 0) {
      if (this.activeAlert !== null) {
        this.activeAlert = null;
        this.notifyListeners();
      }
      return null;
    }

    // Calculate speed-aware thresholds based on time-to-reach
    // Stage 1: ~90s lookahead, Stage 2: ~40s lookahead, Stage 3: ~15s lookahead
    // Convert time to distance: distance_m = speed_kmh * (time_s / 3600) * 1000
    const safeSpeed = Math.max(5, Math.min(120, currentSpeedKmh)); // clamp to sane range
    const stage1ThresholdM = Math.max(150, Math.min(2500, (safeSpeed * 90) / 3.6)); // floor 150m, ceiling 2.5km
    const stage2ThresholdM = Math.max(100, Math.min(1000, (safeSpeed * 40) / 3.6)); // floor 100m, ceiling 1km
    const stage3ThresholdM = Math.max(50, Math.min(500, (safeSpeed * 15) / 3.6));   // floor 50m, ceiling 500m

    // Find closest upcoming hotspot ahead of user
    let closestHotspot: CongestionHotspot | null = null;
    let minDistance = Infinity;

    for (const hotspot of hotspots) {
      const routeDistance = distanceAlongRouteMeters === undefined
        ? this.haversineMeters(userLat, userLon, hotspot.lat, hotspot.lon)
        : hotspot.distance_from_origin_m - distanceAlongRouteMeters;
      const dist = distanceAlongRouteMeters === undefined
        ? routeDistance
        : (routeDistance >= 0 ? routeDistance : Infinity);
      if (dist < minDistance && dist <= stage1ThresholdM + 300) {
        minDistance = dist;
        closestHotspot = hotspot;
      }
    }

    if (!closestHotspot || minDistance > stage1ThresholdM + 100) {
      // User passed the hotspot or no hotspot within range
      if (this.activeAlert !== null) {
        this.activeAlert = null;
        this.notifyListeners();
      }
      return null;
    }

    // Determine Alert Stage based on distance
    let stage: 1 | 2 | 3 = 1;
    if (minDistance <= stage3ThresholdM) {
      stage = 3;
    } else if (minDistance <= stage2ThresholdM) {
      stage = 2;
    } else {
      stage = 1;
    }

    const hotspotStages = this.triggeredStages.get(closestHotspot.hotspot_id) || new Set<number>();
    const isNewStage = !hotspotStages.has(stage);

    if (isNewStage) {
      hotspotStages.add(stage);
      this.triggeredStages.set(closestHotspot.hotspot_id, hotspotStages);
    }

    const alertData: ActiveCongestionAlert = {
      hotspotId: closestHotspot.hotspot_id,
      locationName: closestHotspot.location_name,
      distanceMeters: minDistance,
      distanceText: this.formatDistance(minDistance),
      stage,
      congestionLevel: closestHotspot.congestion_level,
      averageSpeedKmh: closestHotspot.average_speed_kmh,
      estimatedDelaySeconds: closestHotspot.estimated_delay_seconds,
      description: closestHotspot.description,
      timestamp: Date.now(),
      spoken: !isNewStage,
    };

    this.activeAlert = alertData;
    this.notifyListeners();

    if (isNewStage && onNewStageAlert) {
      onNewStageAlert(alertData);
    }

    return alertData;
  }

  public static dismissCurrentAlert() {
    this.activeAlert = null;
    this.notifyListeners();
  }

  public static reset() {
    this.activeAlert = null;
    this.triggeredStages.clear();
    this.notifyListeners();
  }
}
```


## `frontend\src\lib\api.ts`

```typescript
import { DEFAULT_TRAFFIC_MODE } from "./trafficScenario";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export interface HealthResponse {
  status: string;
  region: string;
  features: string[];
  timestamp: string;
}

export interface PlaceSearchResult {
  display_name: string;
  lat: number;
  lon: number;
  place_id: string;
  address_type: string;
}

export type CongestionLevel = "LOW" | "MODERATE" | "HEAVY" | "SEVERE";
export type TrafficTestMode = "real" | "normal" | "moderate" | "heavy" | "severe" | "dynamic";

export interface CongestionSegment {
  segment_index: number;
  coordinates: number[][];
  distance_meters: number;
  duration_seconds: number;
  freeflow_speed_kmh: number;
  current_speed_kmh: number;
  delay_seconds: number;
  congestion_level: CongestionLevel;
  color: string;
  congestion_factor: number;
  density_index: number;
  predicted_arrival_time_min: number;
  road_name?: string;
}

export interface CongestionHotspot {
  hotspot_id: string;
  location_name: string;
  lat: number;
  lon: number;
  distance_from_origin_m: number;
  congestion_level: CongestionLevel;
  average_speed_kmh: number;
  estimated_delay_seconds: number;
  description: string;
  cause: string;
}

export interface CandidateRoute {
  route_id: string;
  source: string;
  original_route_index: number;
  route_index: number;
  distance_meters: number;
  duration_seconds: number;
  geometry: {
    type: string;
    coordinates: number[][];
  };
  steps: Array<{
    maneuver?: {
      instruction?: string;
      type?: string;
      modifier?: string;
      location?: [number, number];
    };
    distance?: number;
    duration?: number;
    name?: string;
  }>;
  is_ai_recommended?: boolean;
  recommendation_label?: string;
  congestion_factor?: number;
  predicted_average_speed_kmh?: number;
  predicted_duration_seconds?: number;
  predicted_duration_minutes?: number;
  standard_duration_seconds?: number;
  standard_duration_minutes?: number;
  delay_savings_minutes?: number;
  confidence?: string;
  
  // Segmented Breakdown & Hotspots (Features 1 & 2)
  segments?: CongestionSegment[];
  hotspots?: CongestionHotspot[];
  clear_distance_km?: number;
  moderate_distance_km?: number;
  heavy_distance_km?: number;
  severe_distance_km?: number;
  total_delay_seconds?: number;
}

export interface RouteResponse {
  success: boolean;
  routes_count: number;
  candidates: CandidateRoute[];
}

export interface TrafficFactorData {
  location_name: string;
  current_speed_kmh: number;
  freeflow_speed_kmh: number;
  density_index: number;
  congestion_level: CongestionLevel;
  congestion_factor: number;
  incident_description?: string;
  historical_baseline_speed_kmh: number;
}

export interface RerouteRecommendation {
  is_reroute_recommended: boolean;
  is_congestion_avoidance: boolean;
  time_saved_seconds: number;
  time_saved_minutes: number;
  original_remaining_seconds: number;
  recommended_duration_seconds: number;
  recommended_route?: CandidateRoute;
  alternative_routes: CandidateRoute[];
  reason: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error("Backend service offline");
  return res.json();
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Failed to search places");
  return res.json();
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ display_name: string; lat: number; lon: number }> {
  const res = await fetch(`${API_BASE_URL}/reverse?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Reverse geocode failed");
  return res.json();
}

export async function fetchRoutes(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  isEmergencyMode: boolean = false,
  trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
  trafficProgress: number = 0
): Promise<RouteResponse> {
  const res = await fetch(`${API_BASE_URL}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_lat: originLat,
      origin_lon: originLon,
      dest_lat: destLat,
      dest_lon: destLon,
      is_emergency_mode: isEmergencyMode,
      traffic_test_mode: trafficTestMode,
      traffic_progress: trafficProgress,
    }),
  });
  if (!res.ok) throw new Error("Failed to calculate routes");
  return res.json();
}

export async function evaluateReroute(
  currentLat: number,
  currentLon: number,
  destLat: number,
  destLon: number,
  originalRemainingSeconds: number,
  avoidHotspots: Array<{ lat: number; lon: number; radius_km?: number }> = [],
  isEmergencyMode: boolean = false,
  trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
  trafficProgress: number = 0
): Promise<RerouteRecommendation> {
  const res = await fetch(`${API_BASE_URL}/reroute/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_lat: currentLat,
      current_lon: currentLon,
      dest_lat: destLat,
      dest_lon: destLon,
      original_remaining_duration_seconds: originalRemainingSeconds,
      avoid_hotspots: avoidHotspots,
      is_emergency_mode: isEmergencyMode,
      traffic_test_mode: trafficTestMode,
      traffic_progress: trafficProgress,
    }),
  });
  if (!res.ok) throw new Error("Failed to evaluate alternative reroutes");
  return res.json();
}

export async function fetchTrafficFactors(lat: number, lon: number): Promise<TrafficFactorData> {
  const res = await fetch(`${API_BASE_URL}/traffic/factors?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("Failed to fetch traffic factors");
  return res.json();
}

export async function fetchTrafficHotspots(): Promise<{ success: boolean; count: number; hotspots: any[] }> {
  const res = await fetch(`${API_BASE_URL}/traffic/hotspots`);
  if (!res.ok) throw new Error("Failed to fetch traffic hotspots");
  return res.json();
}



export async function dispatchPushNotification(payload: PushNotificationPayload): Promise<PushNotificationPayload> {
  const res = await fetch(`${API_BASE_URL}/notifications/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to dispatch push notification");
  return res.json();
}
```


## `frontend\src\lib\layoutZones.ts`

```typescript
export const OVERLAY_Z = {
  mapControls: 20,
  sidebar: 20,
  statusBadge: 20,
  infoPanel: 25,
  navigationHud: 30,
  transientToast: 40,
  noFasterRouteToast: 40,
  rerouteModal: 45,
  advanceAlertBanner: 50,
  mapPrompt: 50,
} as const;
```


## `frontend\src\lib\maneuverInstructions.ts`

```typescript
/**
 * Maneuver Instruction Builder
 *
 * Converts OSRM's raw maneuver objects (type, modifier, exit) into natural-language
 * turn-by-turn instructions, since OSRM API responses do not include pre-built instruction strings.
 */

export interface OSRMManeuver {
  type?: string;
  modifier?: string;
  exit?: number;
  bearing_after?: number;
  bearing_before?: number;
  location?: [number, number];
  instruction?: string;
}

export interface OSRMStep {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: OSRMManeuver;
  mode?: string;
  geometry?: any;
}

/**
 * Builds a natural-language instruction from an OSRM step's maneuver object and road name.
 */
export function getManeuverInstruction(step: OSRMStep): string {
  const maneuver = step.maneuver;
  const roadName = step.name?.trim() || "";

  if (!maneuver || !maneuver.type) {
    return roadName || "Continue straight ahead";
  }

  const type = maneuver.type.toLowerCase();
  let modifier = maneuver.modifier?.toLowerCase() || "";
  const exit = maneuver.exit;

  // Mathematically verify L/R directions
  if (maneuver.bearing_before !== undefined && maneuver.bearing_after !== undefined) {
    const bBefore = maneuver.bearing_before;
    const bAfter = maneuver.bearing_after;
    let diff = bAfter - bBefore;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    
    // diff < 0 is left, diff > 0 is right
    if (Math.abs(diff) > 10) { // Only override if it's a clear turn
      if (diff < -10 && modifier.includes("right")) {
        modifier = modifier.replace("right", "left");
      } else if (diff > 10 && modifier.includes("left")) {
        modifier = modifier.replace("left", "right");
      }
    }
  }

  // Helper to add road name
  const withRoad = (instruction: string): string => {
    if (roadName && roadName !== "") {
      return `${instruction} onto ${roadName}`;
    }
    return instruction;
  };

  // Departure
  if (type === "depart") {
    if (roadName) {
      return `Head out on ${roadName}`;
    }
    if (modifier.includes("left")) return "Head out turning left";
    if (modifier.includes("right")) return "Head out turning right";
    return "Head out";
  }

  // Arrival
  if (type === "arrive") {
    if (modifier === "left") return "Arrive at your destination on the left";
    if (modifier === "right") return "Arrive at your destination on the right";
    if (modifier === "straight") return "Arrive at your destination ahead";
    return "You have arrived at your destination";
  }

  // Turns
  if (type === "turn") {
    if (modifier === "left") return withRoad("Turn left");
    if (modifier === "right") return withRoad("Turn right");
    if (modifier === "slight left") return withRoad("Bear left");
    if (modifier === "slight right") return withRoad("Bear right");
    if (modifier === "sharp left") return withRoad("Make a sharp left");
    if (modifier === "sharp right") return withRoad("Make a sharp right");
    if (modifier === "uturn" || modifier === "u-turn") return withRoad("Make a U-turn");
    if (modifier === "straight") return withRoad("Continue straight");
    return roadName ? `Continue on ${roadName}` : "Continue straight ahead";
  }

  // Continue on new road name
  if (type === "new name" || type === "continue") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Merge
  if (type === "merge") {
    if (modifier === "left") return withRoad("Merge left");
    if (modifier === "right") return withRoad("Merge right");
    if (modifier === "slight left") return withRoad("Merge slightly left");
    if (modifier === "slight right") return withRoad("Merge slightly right");
    return withRoad("Merge");
  }

  // Fork
  if (type === "fork") {
    if (modifier === "left") return withRoad("Keep left at the fork");
    if (modifier === "right") return withRoad("Keep right at the fork");
    if (modifier === "slight left") return withRoad("Bear left at the fork");
    if (modifier === "slight right") return withRoad("Bear right at the fork");
    return withRoad("Continue at the fork");
  }

  // Roundabouts
  if (type === "roundabout" || type === "rotary") {
    if (exit !== undefined) {
      const exitOrdinal = getOrdinal(exit);
      return withRoad(`At the roundabout, take the ${exitOrdinal} exit`);
    }
    return withRoad("Enter the roundabout");
  }

  if (type === "roundabout turn") {
    if (modifier === "left") return withRoad("Turn left at the roundabout");
    if (modifier === "right") return withRoad("Turn right at the roundabout");
    return withRoad("Continue through the roundabout");
  }

  if (type === "exit roundabout" || type === "exit rotary") {
    if (exit !== undefined) {
      return withRoad(`Exit the roundabout at the ${getOrdinal(exit)} exit`);
    }
    return withRoad("Exit the roundabout");
  }

  // Ramps
  if (type === "on ramp" || type === "ramp") {
    if (modifier === "left") return withRoad("Take the ramp on the left");
    if (modifier === "right") return withRoad("Take the ramp on the right");
    if (modifier === "slight left") return withRoad("Take the slight left ramp");
    if (modifier === "slight right") return withRoad("Take the slight right ramp");
    return withRoad("Take the ramp");
  }

  if (type === "off ramp") {
    if (modifier === "left") return withRoad("Take the exit on the left");
    if (modifier === "right") return withRoad("Take the exit on the right");
    if (modifier === "slight left") return withRoad("Take the slight left exit");
    if (modifier === "slight right") return withRoad("Take the slight right exit");
    return withRoad("Take the exit");
  }

  // End of road
  if (type === "end of road") {
    if (modifier === "left") return withRoad("At the end of the road, turn left");
    if (modifier === "right") return withRoad("At the end of the road, turn right");
    return withRoad("Continue at the end of the road");
  }

  // Notification (road name change, no action required)
  if (type === "notification") {
    if (roadName) {
      return `Continue on ${roadName}`;
    }
    return "Continue ahead";
  }

  // Fallback for unknown types
  if (roadName) {
    return `Continue on ${roadName}`;
  }
  return "Continue straight ahead";
}

/**
 * Builds a distance-aware announcement for advance warnings.
 * Example: "In 300 meters, turn right onto 5th Cross Road"
 */
export function getManeuverAnnouncement(step: OSRMStep, distanceMeters: number): string {
  const instruction = getManeuverInstruction(step);
  const maneuver = step.maneuver;

  // Don't add distance prefix for arrivals or departures
  if (maneuver?.type === "arrive" || maneuver?.type === "depart") {
    return instruction;
  }

  // Format distance
  let distancePhrase = "";
  if (distanceMeters >= 1000) {
    const km = (distanceMeters / 1000).toFixed(1);
    distancePhrase = `In ${km} kilometers`;
  } else if (distanceMeters >= 100) {
    const roundedMeters = Math.round(distanceMeters / 50) * 50; // Round to nearest 50m
    distancePhrase = `In ${roundedMeters} meters`;
  } else {
    distancePhrase = "Now";
  }

  // For very short distances, just say the instruction without distance
  if (distanceMeters < 50) {
    return instruction;
  }

  // Combine distance + instruction
  // Lower-case first letter of instruction when prefixing with distance
  const instructionLower = instruction.charAt(0).toLowerCase() + instruction.slice(1);
  return `${distancePhrase}, ${instructionLower}`;
}

/**
 * Converts a number to its ordinal form (1 -> "1st", 2 -> "2nd", etc.)
 */
function getOrdinal(n: number): string {
  const ordinals = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
    "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth",
  ];
  if (!Number.isFinite(n) || n < 1) return "next";
  const ordinal = Math.floor(n);
  if (ordinals[ordinal]) return ordinals[ordinal];
  const mod100 = ordinal % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ordinal % 10 === 1 ? "st" : ordinal % 10 === 2 ? "nd" : ordinal % 10 === 3 ? "rd" : "th";
  return `${ordinal}${suffix}`;
}
```


## `frontend\src\lib\pushNotificationService.ts`

```typescript
import { dispatchPushNotification, PushNotificationPayload } from "./api";

export class PushNotificationService {
  private static permissionGranted: boolean = false;
  private static localNotifications: Map<string, Notification> = new Map();

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  public static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    if (Notification.permission === "granted") {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === "granted";
      return this.permissionGranted;
    }

    return false;
  }

  public static isPermissionGranted(): boolean {
    if (!this.isSupported()) return false;
    return Notification.permission === "granted";
  }

  private static async clearTaggedNotification(tag: string) {
    if (!this.isSupported() || Notification.permission !== "granted") return;
    try {
      this.localNotifications.get(tag)?.close();
      this.localNotifications.delete(tag);
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const notifications = await registration.getNotifications({ tag });
        notifications.forEach((notification) => notification.close());
      }
    } catch (err) {
      console.warn("Could not clear congestion notification:", err);
    }
  }

  public static async clearCongestionAlert() {
    await this.clearTaggedNotification("apex-congestion-alert");
  }

  public static async clearRerouteAlert() {
    await this.clearTaggedNotification("apex-reroute-alert");
  }

  /**
   * Dispatches push notification for upcoming route congestion (Feature 5a).
   */
  public static async sendCongestionAlert(
    locationName: string,
    distanceText: string,
    delayMinutes: number,
    speedKmh: number,
    severity: "LOW" | "MODERATE" | "HEAVY" | "SEVERE" = "HEAVY"
  ) {
    const title = `⚠️ ${severity[0]}${severity.slice(1).toLowerCase()} traffic ahead (${distanceText})`;
    const body = `Traffic is moving slowly near ${locationName}. Speed: ${Math.round(speedKmh)} km/h (+${Math.round(delayMinutes)}m delay).`;

    const payload: PushNotificationPayload = {
      title,
      body,
      tag: "apex-congestion-alert",
      data: {
        type: "CONGESTION",
        locationName,
        distanceText,
        delayMinutes,
      },
    };

    // 1. Dispatch locally via Browser Notification API (even in background)
    if (this.isSupported() && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-congestion-alert",
          });
        } else {
          this.localNotifications.get("apex-congestion-alert")?.close();
          this.localNotifications.set("apex-congestion-alert", new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-congestion-alert",
          }));
        }
      } catch (err) {
        console.warn("Local notification error:", err);
      }
    }

    // 2. Relay to backend notification logger
    try {
      await dispatchPushNotification(payload);
    } catch {
      // Offline fallback
    }
  }

  /**
   * Dispatches push notification for faster alternative route suggestion (Feature 5b).
   */
  public static async sendRerouteSuggestion(
    timeSavedMinutes: number,
    viaRoad: string,
    isCongestionAvoidance = false,
  ) {
    const title = isCongestionAvoidance
      ? "Route around congestion available"
      : `🚀 Faster Route Found (Save ${Math.round(timeSavedMinutes)} min)`;
    const body = isCongestionAvoidance
      ? `A route avoiding the flagged congestion${viaRoad ? ` via ${viaRoad}` : ""} is available. Review its ETA before switching.`
      : `Alternative route via ${viaRoad} available to bypass congestion.`;

    const payload: PushNotificationPayload = {
      title,
      body,
      tag: "apex-reroute-alert",
      data: {
        type: "REROUTE",
        timeSavedMinutes,
        viaRoad,
        isCongestionAvoidance,
      },
    };

    if (this.isSupported() && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-reroute-alert",
          });
        } else {
          this.localNotifications.get("apex-reroute-alert")?.close();
          this.localNotifications.set("apex-reroute-alert", new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-reroute-alert",
          }));
        }
      } catch (err) {
        console.warn("Local notification error:", err);
      }
    }

    try {
      await dispatchPushNotification(payload);
    } catch {
      // Offline fallback
    }
  }
}
```


## `frontend\src\lib\rerouteEngine.ts`

```typescript
import { evaluateReroute } from "./api";
import type { CandidateRoute, RerouteRecommendation, TrafficTestMode } from "./api";
import { DEFAULT_TRAFFIC_MODE } from "./trafficScenario";
import { TTSService } from "./ttsService";
import { PushNotificationService } from "./pushNotificationService";

export type RerouteListener = (
  recommendation: RerouteRecommendation | null,
  noRouteReason: string | null
) => void;

export function routesHaveSameGeometry(candidate: RerouteRecommendation["recommended_route"], active: CandidateRoute): boolean {
  const candidateCoords = candidate?.geometry?.coordinates;
  const activeCoords = active.geometry?.coordinates;
  if (!candidateCoords || candidateCoords.length < 2 || !activeCoords || activeCoords.length < 2) return false;

  const segmentDistance = (lon: number, lat: number, segmentIndex: number) => {
    const [x1, y1] = activeCoords[segmentIndex];
    const [x2, y2] = activeCoords[segmentIndex + 1];
    const meanLat = ((y1 + y2 + lat) / 3) * Math.PI / 180;
    const dx = (x2 - x1) * Math.cos(meanLat);
    const dy = y2 - y1;
    const px = (lon - x1) * Math.cos(meanLat);
    const py = lat - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
    const projectedLon = x1 + (x2 - x1) * t;
    const projectedLat = y1 + (y2 - y1) * t;
    const dLat = (lat - projectedLat) * 111_132;
    const dLon = (lon - projectedLon) * 111_320 * Math.cos(meanLat);
    return Math.hypot(dLat, dLon);
  };

  const [candidateStartLon, candidateStartLat] = candidateCoords[0];
  let activeStartIndex = 0;
  let startDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < activeCoords.length - 1; i += 1) {
    const distance = segmentDistance(candidateStartLon, candidateStartLat, i);
    if (distance < startDistance) {
      startDistance = distance;
      activeStartIndex = i;
    }
  }
  if (startDistance > 45) return false;

  const sampleCount = Math.min(16, candidateCoords.length);
  let searchFromIndex = activeStartIndex;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const index = Math.round((sample * (candidateCoords.length - 1)) / Math.max(1, sampleCount - 1));
    const [lon, lat] = candidateCoords[index];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
    let closestMeters = Number.POSITIVE_INFINITY;
    let closestIndex = searchFromIndex;
    for (let i = searchFromIndex; i < activeCoords.length - 1; i += 1) {
      const distance = segmentDistance(lon, lat, i);
      if (distance < closestMeters) {
        closestMeters = distance;
        closestIndex = i;
      }
    }
    if (closestMeters > 45) return false;
    searchFromIndex = closestIndex;
  }
  return true;
}

// Set to true only when diagnosing rerouting flow in development
const DEBUG = false;

export class RerouteEngine {
  private static activeRecommendation: RerouteRecommendation | null = null;
  private static lastNoRouteFoundReason: string | null = null;
  private static noRouteTimeout: NodeJS.Timeout | null = null;
  private static listeners: Set<RerouteListener> = new Set();
  private static isEvaluating: boolean = false;
  private static lastEvaluationTime: number = 0;
  private static lastEvaluatedSpeed: number = 40.0;
  private static evaluationGeneration: number = 0;

  public static subscribe(listener: RerouteListener): () => void {
    this.listeners.add(listener);
    listener(this.activeRecommendation, this.lastNoRouteFoundReason);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeRecommendation, this.lastNoRouteFoundReason);
      } catch (err) {
        console.error("[RerouteEngine] Listener notification error:", err);
      }
    });
  }

  /**
   * Asynchronously checks if real-time conditions warrant re-evaluating the ML model (Features 7 & 8).
   * Gated to prevent polling while a recommendation modal is already active.
   */
  public static async checkAndReevaluate(
    currentLat: number,
    currentLon: number,
    destLat: number,
    destLon: number,
    remainingSeconds: number,
    currentSpeedKmh: number,
    isEmergencyMode: boolean = false,
    forceReevaluate: boolean = false,
    trafficTestMode: TrafficTestMode = DEFAULT_TRAFFIC_MODE,
    trafficProgress: number = 0,
    avoidHotspots: Array<{ lat: number; lon: number; radius_km?: number }> = []
  ): Promise<RerouteRecommendation | null> {
    // 1. Skip automatic background checking if a recommendation is already displayed
    if (!forceReevaluate && this.activeRecommendation !== null) {
      if (DEBUG) console.log("[RerouteEngine] Skipped: recommendation already active in modal");
      return this.activeRecommendation;
    }

    const now = Date.now();
    const timeSinceLastEval = now - this.lastEvaluationTime;
    const speedDropRatio = (this.lastEvaluatedSpeed - currentSpeedKmh) / Math.max(1, this.lastEvaluatedSpeed);
    const hasSignificantSpeedDrop = speedDropRatio >= 0.15;
    const isPeriodicTimeElapsed = timeSinceLastEval > 8000;

    if (DEBUG) {
      console.log(
        `[RerouteEngine] Evaluation check: speed=${currentSpeedKmh.toFixed(1)} km/h, drop=${(speedDropRatio * 100).toFixed(
          1
        )}%, elapsed=${(timeSinceLastEval / 1000).toFixed(1)}s, force=${forceReevaluate}`
      );
    }

    if (!forceReevaluate && !hasSignificantSpeedDrop && !isPeriodicTimeElapsed) {
      return this.activeRecommendation;
    }

    if (this.isEvaluating) {
      if (DEBUG) console.log("[RerouteEngine] Skipped: re-evaluation already in flight");
      return this.activeRecommendation;
    }

    this.isEvaluating = true;
    const generation = this.evaluationGeneration;
    this.lastEvaluationTime = now;
    this.lastEvaluatedSpeed = currentSpeedKmh;

    try {
      // Dynamic Alternative Route Generation strictly from CURRENT position (Feature 8)
      const recommendation = await evaluateReroute(
        currentLat,
        currentLon,
        destLat,
        destLon,
        remainingSeconds,
        avoidHotspots,
        isEmergencyMode,
        trafficTestMode,
        trafficProgress
      );

      if (generation !== this.evaluationGeneration) return null;

      if (DEBUG) console.log("[RerouteEngine] Backend recommendation response:", recommendation);

      if (recommendation && recommendation.is_reroute_recommended && recommendation.recommended_route) {
        if (generation !== this.evaluationGeneration) return null;
        this.activeRecommendation = recommendation;
        this.lastNoRouteFoundReason = null;
        if (this.noRouteTimeout) {
          clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = null;
        }
        this.notifyListeners();
        // A listener can reject a duplicate path and dismiss it synchronously.
        // Do not announce or notify about a recommendation that is no longer active.
        if (this.activeRecommendation !== recommendation) return recommendation;

        const viaName = recommendation.recommended_route.steps?.find(
          (step) => Boolean(step.name?.trim()) && step.maneuver?.type !== "depart"
        )?.name?.trim() || "Alternative Bypass";

        // Voice Alert & Push Notification
        TTSService.speakRerouteSuggestion(
          recommendation.time_saved_minutes,
          viaName,
          recommendation.is_congestion_avoidance,
        );
        void PushNotificationService.sendRerouteSuggestion(
          recommendation.time_saved_minutes,
          viaName,
          recommendation.is_congestion_avoidance,
        );
      } else {
        this.activeRecommendation = null;
        if (this.noRouteTimeout) {
          clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = null;
        }
        // Handle no faster route available
        if (forceReevaluate) {
          const reason =
            recommendation?.reason || "Current route remains the fastest available path.";
          this.lastNoRouteFoundReason = reason;
          if (this.noRouteTimeout) clearTimeout(this.noRouteTimeout);
          this.noRouteTimeout = setTimeout(() => {
            this.lastNoRouteFoundReason = null;
            this.notifyListeners();
          }, 5000);
          this.notifyListeners();
        } else if (this.activeRecommendation !== null) {
          this.activeRecommendation = null;
          this.notifyListeners();
        }
      }

      return recommendation;
    } catch (err) {
      console.error("[RerouteEngine] Async reroute evaluation failed:", err);
      return null;
    } finally {
      this.isEvaluating = false;
    }
  }

  public static dismissRecommendation() {
    this.evaluationGeneration += 1;
    this.activeRecommendation = null;
    this.lastNoRouteFoundReason = null;
    if (this.noRouteTimeout) {
      clearTimeout(this.noRouteTimeout);
      this.noRouteTimeout = null;
    }
    this.notifyListeners();
  }

  public static dismissNoRouteReason() {
    this.evaluationGeneration += 1;
    this.lastNoRouteFoundReason = null;
    if (this.noRouteTimeout) {
      clearTimeout(this.noRouteTimeout);
      this.noRouteTimeout = null;
    }
    this.notifyListeners();
  }

  public static getActiveRecommendation(): RerouteRecommendation | null {
    return this.activeRecommendation;
  }

  public static getLastNoRouteReason(): string | null {
    return this.lastNoRouteFoundReason;
  }
}
```


## `frontend\src\lib\trafficScenario.ts`

```typescript
import type { CongestionLevel, TrafficTestMode } from "./api";

export type { TrafficTestMode } from "./api";

export const DEFAULT_TRAFFIC_MODE: TrafficTestMode = "real";

export const TRAFFIC_COLORS: Record<CongestionLevel, string> = {
  LOW: "#16A34A",
  MODERATE: "#EAB308",
  HEAVY: "#F97316",
  SEVERE: "#DC2626",
};

export function dynamicTrafficPhase(progress: number): CongestionLevel {
  if (progress < 0.22) return "LOW";
  if (progress < 0.43) return "MODERATE";
  if (progress < 0.76) return "HEAVY";
  return "LOW";
}

export function isTrafficTestMode(mode: TrafficTestMode): boolean {
  return mode !== "real";
}
```


## `frontend\src\lib\ttsService.ts`

```typescript
export type SpeechPriority = "normal" | "critical";

export const SpeechPriority = {
  NORMAL: "normal" as SpeechPriority,
  HIGH: "normal" as SpeechPriority,
  CRITICAL: "critical" as SpeechPriority,
};

interface QueuedUtterance {
  text: string;
  priority: SpeechPriority;
  dedupeKey: string;
  enqueuedAt: number;
}

const DEFAULT_DEBOUNCE_MS = 8_000;

export class TTSService {
  private static queue: QueuedUtterance[] = [];
  private static pendingDedupeKeys = new Set<string>();
  private static recentDedupeKeys = new Map<string, number>();
  private static isSpeaking = false;
  private static isMuted = false;
  private static activeUtteranceId = 0;
  private static cancelFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private static getRate: () => number = () => 1.05;
  private static volume = 1;
  private static pitch = 1;
  private static cachedVoices: SpeechSynthesisVoice[] = [];
  private static voiceRetryListener: (() => void) | null = null;
  private static voiceRetryCount = 0;

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Call directly from the user gesture that starts navigation. */
  public static warmUp(): void {
    if (!this.isSupported()) {
      console.warn("[TTS] Web Speech API is unavailable in this browser.");
      return;
    }

    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.cachedVoices = voices;
          this.voiceRetryCount = 0;
          if (this.voiceRetryListener) {
            window.speechSynthesis.removeEventListener("voiceschanged", this.voiceRetryListener);
            this.voiceRetryListener = null;
          }
          return;
        }

        // Some Chromium builds populate voices asynchronously. Retry a bounded
        // number of times after the browser announces that its voice list changed.
        if (!this.voiceRetryListener && this.voiceRetryCount < 4) {
          this.voiceRetryCount += 1;
          const retry = () => {
            this.voiceRetryListener = null;
            loadVoices();
          };
          this.voiceRetryListener = retry;
          window.speechSynthesis.addEventListener("voiceschanged", retry, { once: true });
        }
      } catch (error) {
        console.warn("[TTS] Could not load speech voices:", error);
      }
    };

    loadVoices();
  }

  public static setRateProvider(provider: () => number): void {
    this.getRate = provider;
  }

  public static setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public static setPitch(pitch: number): void {
    this.pitch = Math.max(0.5, Math.min(2, pitch));
  }

  public static getMuted(): boolean {
    return this.isMuted;
  }

  public static setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.queue = [];
      this.pendingDedupeKeys.clear();
      this.cancelActiveSpeech();
    }
  }

  /** Toggle the service itself; the returned value is the new muted state. */
  public static toggleMute(muted?: boolean): boolean {
    this.setMuted(muted ?? !this.isMuted);
    return this.isMuted;
  }

  /** Backward-compatible alias while callers migrate to toggleMute(). */
  public static toggleMuted(): boolean {
    return this.toggleMute();
  }

  public static announce(
    text: string,
    priority: SpeechPriority,
    dedupeKey: string,
    debounceMs: number = DEFAULT_DEBOUNCE_MS,
  ): void {
    const normalizedText = text.trim();
    const normalizedKey = dedupeKey.trim().toLowerCase() || normalizedText.toLowerCase();
    if (!normalizedText || this.isMuted) return;
    if (!this.isSupported()) {
      console.warn("[TTS] Announcement skipped because Web Speech API is unavailable.");
      return;
    }

    const now = Date.now();
    const lastSpokenAt = this.recentDedupeKeys.get(normalizedKey);
    if (
      (lastSpokenAt !== undefined && now - lastSpokenAt < debounceMs) ||
      this.pendingDedupeKeys.has(normalizedKey)
    ) {
      return;
    }

    if (priority === "critical") {
      const retained = this.queue.filter((item) => item.priority === "critical");
      this.queue = retained;
      this.pendingDedupeKeys = new Set(retained.map((item) => item.dedupeKey));
      if (this.isSpeaking) this.hardStop();
    }

    this.queue.push({ text: normalizedText, priority, dedupeKey: normalizedKey, enqueuedAt: now });
    this.pendingDedupeKeys.add(normalizedKey);
    this.processQueue();
  }

  /** Compatibility wrapper for older call sites; new code should use announce(). */
  public static speak(
    text: string,
    priority: SpeechPriority = "normal",
    debounceSeconds = 15,
    dedupeKey?: string,
  ): void {
    const key = dedupeKey || text.trim().toLowerCase();
    this.announce(text, priority, key, debounceSeconds * 1000);
  }

  /** Clear speech and debounce state when leaving or replacing a route. */
  public static reset(): void {
    this.queue = [];
    this.pendingDedupeKeys.clear();
    this.recentDedupeKeys.clear();
    this.cancelActiveSpeech();
  }

  public static clearQueue(): void {
    this.reset();
  }

  private static cancelActiveSpeech(): void {
    this.activeUtteranceId += 1;
    if (this.cancelFallbackTimer) {
      clearTimeout(this.cancelFallbackTimer);
      this.cancelFallbackTimer = null;
    }
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.error("[TTS] speechSynthesis.cancel() failed:", error);
      }
    }
    // Cancelled Chromium utterances may never raise onend/onerror.
    this.isSpeaking = false;
  }

  private static hardStop(): void {
    const stoppedUtteranceId = ++this.activeUtteranceId;
    if (this.cancelFallbackTimer) clearTimeout(this.cancelFallbackTimer);
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.error("[TTS] Could not interrupt the active utterance:", error);
    }

    // Keep the queue locked until cancel has propagated; the fallback handles
    // browsers that omit the cancelled utterance's completion event.
    this.cancelFallbackTimer = setTimeout(() => {
      this.cancelFallbackTimer = null;
      if (this.activeUtteranceId !== stoppedUtteranceId || this.isMuted) return;
      this.isSpeaking = false;
      this.processQueue();
    }, 60);
  }

  private static processQueue(): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[TTS] processQueue", {
        isSpeaking: this.isSpeaking,
        isMuted: this.isMuted,
        queued: this.queue.length,
      });
    }
    if (this.isSpeaking || this.queue.length === 0 || this.isMuted) return;
    if (!this.isSupported()) {
      console.warn("[TTS] Queue cannot play because Web Speech API is unavailable.");
      this.queue = [];
      this.pendingDedupeKeys.clear();
      return;
    }

    const next = this.queue.shift();
    if (!next) return;
    this.pendingDedupeKeys.delete(next.dedupeKey);
    const utteranceId = ++this.activeUtteranceId;
    this.isSpeaking = true;
    this.recentDedupeKeys.set(next.dedupeKey, Date.now());

    try {
      const utterance = new SpeechSynthesisUtterance(next.text);
      const requestedRate = Number(this.getRate());
      utterance.rate = Number.isFinite(requestedRate) ? Math.max(0.5, Math.min(2, requestedRate)) : 1.05;
      utterance.volume = this.volume;
      utterance.pitch = this.pitch;

      if (this.cachedVoices.length === 0) this.warmUp();
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) => voice.lang.startsWith("en-IN") && /natural|neural/i.test(voice.name),
      ) || voices.find((voice) => voice.lang.startsWith("en"));
      if (preferredVoice) utterance.voice = preferredVoice;

      const finish = (error?: SpeechSynthesisErrorEvent) => {
        if (utteranceId !== this.activeUtteranceId) return;
        if (error) console.warn("[TTS] Utterance failed:", error.error);
        this.isSpeaking = false;
        this.processQueue();
      };
      utterance.onend = () => finish();
      utterance.onerror = (event) => finish(event);

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      if (utteranceId === this.activeUtteranceId) this.isSpeaking = false;
      console.error("[TTS] Failed to speak queued announcement:", error);
      this.processQueue();
    }
  }

  public static speakCongestionAlert(
    locationName: string,
    distanceText: string,
    speedKmh: number,
    delayMinutes?: number,
    suggestRerouteOption = true,
    severity: "LOW" | "MODERATE" | "HEAVY" | "SEVERE" = "HEAVY",
  ): void {
    const severityText = severity === "SEVERE" ? "severe traffic" : severity === "HEAVY" ? "heavy traffic" : "moderate traffic";
    let message = `Traffic alert: ${severityText} ahead in ${distanceText} near ${locationName}.`;
    if (speedKmh > 0) message += ` Flow speed is ${Math.round(speedKmh)} kilometers per hour.`;
    if (delayMinutes && delayMinutes >= 2) message += ` Expected delay is ${Math.round(delayMinutes)} minutes.`;
    if (suggestRerouteOption && (severity === "HEAVY" || severity === "SEVERE")) {
      message += " A route around this congestion may be available.";
    }
    this.announce(message, "normal", `congestion_${severity}_${locationName}`, 20_000);
  }

  public static speakRerouteSuggestion(
    timeSavedMinutes: number,
    viaRoad?: string,
    isCongestionAvoidance = false,
  ): void {
    let message: string;
    if (isCongestionAvoidance) {
      message = "An alternate route avoids the flagged congestion";
      if (viaRoad) message += ` via ${viaRoad}`;
      message += ". Review the route on screen.";
    } else {
      message = `Faster route found. You can save approximately ${Math.round(timeSavedMinutes)} minutes`;
      message += viaRoad ? ` by taking ${viaRoad}.` : ". Review the route on screen.";
    }
    this.announce(message, "normal", `reroute_${isCongestionAvoidance ? "avoid" : "faster"}_${viaRoad || "route"}`, 30_000);
  }

  public static speakTurnManeuver(instruction: string, dedupeKey = instruction): void {
    this.announce(instruction, "critical", `maneuver_${dedupeKey}`, 30 * 60_000);
  }
}
```


## `frontend\tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
```


## `frontend\tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```


## `generate_codebase_md.py`

````python
import os
import datetime

# Configuration
EXCLUDE_DIRS = {
    'venv', 'node_modules', '.next', '__pycache__', '.git', 
    'dist', 'build', 'datasets', 'weights'
}
EXCLUDE_EXTS = {
    '.pkl', '.csv', '.jpg', '.png', '.svg', '.ico', '.env', '.lock'
}
MAX_FILE_SIZE = 500 * 1024  # 500KB

def generate_tree(startpath):
    tree_str = []
    for root, dirs, files in os.walk(startpath):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        level = root.replace(startpath, '').count(os.sep)
        indent = ' ' * 4 * (level)
        tree_str.append(f"{indent}{os.path.basename(root)}/")
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in EXCLUDE_EXTS:
                continue
            fpath = os.path.join(root, f)
            if os.path.getsize(fpath) > MAX_FILE_SIZE:
                continue
            tree_str.append(f"{subindent}{f}")
    return '\n'.join(tree_str)

def get_language(filename):
    ext = os.path.splitext(filename)[1].lower()
    mapping = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.json': 'json',
        '.html': 'html',
        '.css': 'css',
        '.md': 'markdown',
        '.sh': 'bash'
    }
    return mapping.get(ext, '')

def main():
    root_dir = os.getcwd()
    output_file = 'apex_codebase_audit.md'
    
    target_dirs = ['backend', 'frontend']
    processed_files = 0
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("# Apex Guardian Codebase Audit\n")
        out.write(f"**Generated:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        out.write("## Directory Tree\n```text\n")
        for d in target_dirs:
            if os.path.exists(d):
                out.write(generate_tree(d) + '\n')
        out.write("```\n\n")
        
        out.write("## File Contents\n\n")
        
        for d in target_dirs:
            if not os.path.exists(d):
                continue
            for root, dirs, files in os.walk(d):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in EXCLUDE_EXTS:
                        continue
                    
                    filepath = os.path.join(root, file)
                    try:
                        if os.path.getsize(filepath) > MAX_FILE_SIZE:
                            continue
                        
                        with open(filepath, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                        rel_path = os.path.relpath(filepath, root_dir)
                        # Replace backslashes with forward slashes for markdown consistency
                        rel_path_str = rel_path.replace('\\', '/')
                        
                        out.write(f"### {rel_path_str}\n")
                        lang = get_language(file)
                        out.write(f"```{lang}\n{content}\n```\n\n")
                        processed_files += 1
                        
                    except Exception as e:
                        print(f"Skipping {filepath}: {e}")

    final_size = os.path.getsize(output_file)
    print(f"Audit generation complete!")
    print(f"Processed files: {processed_files}")
    print(f"Output file: {output_file}")
    print(f"File size: {final_size / 1024:.2f} KB")

if __name__ == "__main__":
    main()
````
