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
