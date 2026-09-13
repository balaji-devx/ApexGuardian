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
