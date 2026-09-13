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
