import { dispatchPushNotification, PushNotificationPayload } from "./api";

export class PushNotificationService {
  private static permissionGranted: boolean = false;

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

  /**
   * Dispatches push notification for upcoming route congestion (Feature 5a).
   */
  public static async sendCongestionAlert(
    locationName: string,
    distanceText: string,
    delayMinutes: number,
    speedKmh: number
  ) {
    const title = `⚠️ Congestion Ahead (${distanceText})`;
    const body = `Heavy traffic near ${locationName}. Speed: ${Math.round(speedKmh)} km/h (+${Math.round(delayMinutes)}m delay).`;

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
          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-congestion-alert",
          });
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
    viaRoad: string
  ) {
    const title = `🚀 Faster Route Found (Save ${Math.round(timeSavedMinutes)} min)`;
    const body = `Alternative route via ${viaRoad} available to bypass congestion.`;

    const payload: PushNotificationPayload = {
      title,
      body,
      tag: "apex-reroute-alert",
      data: {
        type: "REROUTE",
        timeSavedMinutes,
        viaRoad,
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
          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "apex-reroute-alert",
          });
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
