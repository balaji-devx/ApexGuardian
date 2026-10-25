"""Small offline tests for the Coimbatore-only pipeline optimisation patch.

Copy into backend/tests after applying patches/dataset_optimized.patch.
Requires the project's installed dependencies, including openlocationcode.
"""
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from core.region import get_region
from ml.dataset import TrafficDataPipeline as P


CSV_COLUMNS = ["date", "time", "route_code", "duration", "distance", "temp", "realfeel", "humidity", "rsi_flag", "aqi"]
ROUTE_COORDS = {
    "O1+AA": (11.01, 76.95), "D1+AA": (11.02, 76.96),
    "O2+BB": (11.03, 76.97), "D2+BB": (11.04, 76.98),
    "O3+CC": (11.05, 76.99), "D3+CC": (11.06, 77.00),
}
ROUTES = [
    ("O1+AA|D1+AA", 5.0),
    ("O2+BB|D2+BB", 6.0),
    ("O3+CC|D3+CC", 7.0),
]


def _make_fixture(tmp_path):
    csv_path = tmp_path / "csv-traffic-coimbatore.csv"
    cache_path = tmp_path / "osrm_cache_coimbatore.json"
    cache = {}
    for route_code, osrm_min in ROUTES:
        ocode, dcode = route_code.split("|")
        olat, olon = ROUTE_COORDS[ocode]
        dlat, dlon = ROUTE_COORDS[dcode]
        cache[f"{olat},{olon},{dlat},{dlon}"] = {
            "osrm_dist": 5.0 + osrm_min,
            "osrm_dur_min": osrm_min,
            "steps_count": 8,
            "turns": 3,
            "roundabouts": 0,
            "avg_step_len": (5.0 + osrm_min) / 8,
        }
    cache_path.write_text(json.dumps(cache), encoding="utf-8")
    start = datetime(2025, 9, 25, 6, 0)
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(CSV_COLUMNS)
        for i in range(30):
            stamp = start + timedelta(minutes=30 * i)
            for route_i, (route_code, _) in enumerate(ROUTES):
                writer.writerow([
                    stamp.strftime("%Y-%m-%d"), stamp.strftime("%H:%M"), route_code,
                    10 + route_i * 2 + i % 5, f"{5.0 + route_i:.1f}", "", "", "", "", "",
                ])
    return csv_path, cache_path


@pytest.fixture
def patched_pipeline(monkeypatch, tmp_path):
    csv_path, cache_path = _make_fixture(tmp_path)
    monkeypatch.setattr(P, "TML_TRAFFIC_CSV", str(csv_path))
    monkeypatch.setattr(P, "CACHE_FILE", str(cache_path))
    monkeypatch.setattr(P, "REGION", get_region("coimbatore"))
    monkeypatch.setattr(P, "_osrm_cache", {})
    monkeypatch.setattr(P, "_decode_plus_code", classmethod(lambda cls, code: ROUTE_COORDS[code]))
    return csv_path, cache_path


def test_optimized_loader_maps_unique_routes_and_returns_finite_features(patched_pipeline):
    df = P.load_canonical_dataset()
    assert len(df) == 90
    assert df["route_code"].nunique() == 3
    assert df["osrm_dur_min"].nunique() == 3
    assert list(df.columns) == [
        "timestamp", "route_code", "origin_lat", "origin_lon", "destination_lat", "destination_lon",
        "observed_duration_min", "osrm_dist", "osrm_dur_min", "steps_count", "turns", "roundabouts",
        "avg_step_len", "congestion_factor", "hour", "day_of_week", "is_weekend", "month",
    ]
    assert df["congestion_factor"].gt(0).all()


def test_coimbatore_splits_do_not_share_timestamps(patched_pipeline):
    Xtr, ytr, Xv, yv, Xte, yte, features = P.get_train_val_test_splits()
    # 30 time groups x 3 route rows. Group-aware cuts nearest 75% and 85% produce 66/9/15.
    assert (len(Xtr), len(Xv), len(Xte)) == (66, 9, 15)
    assert Xtr.shape[1] == Xv.shape[1] == Xte.shape[1] == 10
    assert all(__import__("numpy").isfinite(a).all() for a in (Xtr, ytr, Xv, yv, Xte, yte))
    assert features == ["hour", "day_of_week", "is_weekend", "month", "osrm_dist", "osrm_dur_min", "steps_count", "turns", "roundabouts", "avg_step_len"]


def test_bengaluru_split_counts_remain_row_based(patched_pipeline, monkeypatch):
    monkeypatch.setattr(P, "REGION", get_region("bengaluru"))
    Xtr, ytr, Xv, yv, Xte, yte, features = P.get_train_val_test_splits()
    # Existing behaviour: int(.75*90), int(.85*90) => 67 / 9 / 14.
    assert (len(Xtr), len(Xv), len(Xte)) == (67, 9, 14)
