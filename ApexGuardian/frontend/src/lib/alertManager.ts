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
