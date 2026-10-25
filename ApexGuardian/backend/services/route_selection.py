from typing import List, TypeVar

T = TypeVar("T")


def _value(route: T, name: str, default=None):
    if isinstance(route, dict):
        return route.get(name, default)
    return getattr(route, name, default)


def _set_value(route: T, name: str, value) -> None:
    if isinstance(route, dict):
        route[name] = value
    else:
        setattr(route, name, value)


def _same_corridor(left: T, right: T) -> bool:
    """Use the routing service's geometry check to avoid presenting one path twice."""
    if left is right:
        return True
    left_geometry = _value(left, "geometry", {})
    right_geometry = _value(right, "geometry", {})
    if not (
        isinstance(left_geometry, dict)
        and isinstance(right_geometry, dict)
        and len(left_geometry.get("coordinates", [])) >= 2
        and len(right_geometry.get("coordinates", [])) >= 2
    ):
        return False
    try:
        # Local import prevents loading the routing HTTP client unless geometry
        # identity actually needs to be checked.
        from services.osrm import routes_are_same_corridor
        return routes_are_same_corridor(
            {"geometry": left_geometry}, {"geometry": right_geometry}
        )
    except Exception:
        # If geometry comparison fails, do not invent a duplicate. The display
        # selector will still cap visible choices and the route validators remain strict.
        return False


def rank_processed_routes(routes: List[T]) -> List[T]:
    """Mark the ML-best path and the best distinct OSRM-time alternative.

    All valid candidates remain in the response because controlled traffic tests
    refresh the active route by matching its geometry. The frontend displays only
    the two marked choices, preventing duplicate OSRM cards without starving the
    heavy/severe/dynamic refresh pipeline of its other candidate geometries.
    """
    if not routes:
        return routes

    # Preserve the legacy helper contract for small unit-test doubles that only
    # expose predicted_duration_seconds and have no OSRM/geometry metadata.
    has_route_metrics = all(
        _value(route, "duration_seconds") is not None
        and _value(route, "predicted_duration_seconds") is not None
        for route in routes
    )
    if not has_route_metrics:
        routes.sort(key=lambda route: _value(route, "predicted_duration_seconds", float("inf")))
        for index, route in enumerate(routes):
            _set_value(route, "is_ai_recommended", index == 0)
            _set_value(route, "recommendation_label", "Recommended Route" if index == 0 else "Standard Route")
        return routes

    ai_route = min(routes, key=lambda route: float(_value(route, "predicted_duration_seconds", float("inf"))))
    distinct_osrm_candidates = [route for route in routes if not _same_corridor(route, ai_route)]

    if not distinct_osrm_candidates:
        # Never duplicate the same geometry just to manufacture a second card.
        _set_value(ai_route, "is_ai_recommended", True)
        _set_value(ai_route, "recommendation_label", "AI + OSRM Best Route")
        for route in routes:
            if route is not ai_route:
                _set_value(route, "is_ai_recommended", False)
                _set_value(route, "recommendation_label", "Duplicate Route")
        routes[:] = [ai_route] + [route for route in routes if route is not ai_route]
        return routes

    osrm_route = min(
        distinct_osrm_candidates,
        key=lambda route: (
            float(_value(route, "duration_seconds", float("inf"))),
            float(_value(route, "distance_meters", float("inf"))),
        ),
    )
    for route in routes:
        _set_value(route, "is_ai_recommended", route is ai_route)
        if route is ai_route:
            _set_value(route, "recommendation_label", "AI Recommended Route")
        elif route is osrm_route:
            _set_value(route, "recommendation_label", "OSRM Preferred Route")
        else:
            _set_value(route, "recommendation_label", "Additional Alternative")

    # Keep the two display choices at stable indices while retaining any additional
    # candidate after them for controlled-test geometry refreshes.
    ordered = [ai_route, osrm_route] + [route for route in routes if route is not ai_route and route is not osrm_route]
    routes[:] = ordered
    return routes
