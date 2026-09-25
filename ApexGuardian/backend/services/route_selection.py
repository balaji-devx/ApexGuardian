from typing import List, TypeVar

T = TypeVar("T")


def rank_processed_routes(routes: List[T]) -> List[T]:
    """Order fully scored routes by final predicted travel time and label the winner."""
    routes.sort(key=lambda route: route.predicted_duration_seconds)
    for index, route in enumerate(routes):
        route.is_ai_recommended = index == 0
        route.recommendation_label = "Recommended Route" if index == 0 else "Standard Route"
    return routes
