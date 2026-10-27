import os, subprocess, sys
import pytest
from core.region import REGIONS, get_region

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_default_region_is_bengaluru_and_paths_unchanged():
    r = get_region("bengaluru")
    assert r.plus_code_reference == (12.9716, 77.5946)
    assert r.traffic_csv.endswith(os.path.join("tml", "csv-traffic-bangalore.csv"))
    assert r.model_filename == "congestion_model_v3_fixed.pkl" and not r.data_is_synthetic
    assert len(r.coverage_anchors()) == 7


def test_coimbatore_region_is_isolated_from_bengaluru_artifacts():
    c, b = get_region("coimbatore"), get_region("bengaluru")
    assert c.traffic_csv != b.traffic_csv and c.osrm_cache != b.osrm_cache and c.model_filename != b.model_filename
    assert c.data_is_synthetic and c.is_within_bounds(11.0168, 76.9558) and not c.is_within_bounds(12.9716, 77.5946)
    assert b.is_within_bounds(12.9716, 77.5946) and not b.is_within_bounds(11.0168, 76.9558)


def test_unknown_region_rejected():
    with pytest.raises(ValueError):
        get_region("atlantis")


def _run(code, region):
    return subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=dict(os.environ, ACTIVE_REGION=region), capture_output=True, text=True)


def test_bottlenecks_follow_active_region():
    code = "from services.traffic_service import LiveTrafficService as L; print(len(L.KNOWN_BOTTLENECKS))"
    assert int(_run(code, "bengaluru").stdout.strip()) == 9          # unchanged for Bengaluru
    assert int(_run(code, "coimbatore").stdout.strip()) == 0         # never report Bengaluru hotspots in Coimbatore


def test_pipeline_decodes_with_region_reference():
    code = ("from ml.dataset import TrafficDataPipeline as P; print(P.REF_LAT, P.REF_LON, P._decode_plus_code('XJG4+7J'))")
    assert "12.9716" in _run(code, "bengaluru").stdout
    out = _run(code, "coimbatore").stdout
    assert "11.0168" in out and "12.9" not in out.split("(")[1]       # same short code now resolves near Coimbatore, not Bengaluru


def test_active_settings_region_is_coimbatore():
    from core.config import settings
    assert settings.ACTIVE_REGION == "coimbatore"
    r = get_region(settings.ACTIVE_REGION)
    assert r.key == "coimbatore"
    assert r.display_name == "Coimbatore"
    assert r.is_within_bounds(11.0168, 76.9558)


