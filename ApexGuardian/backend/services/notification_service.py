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
