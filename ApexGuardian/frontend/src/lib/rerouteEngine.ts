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
