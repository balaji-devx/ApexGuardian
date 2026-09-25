export type SpeechPriority = "normal" | "critical";

export const SpeechPriority = {
  NORMAL: "normal" as SpeechPriority,
  HIGH: "normal" as SpeechPriority,
  CRITICAL: "critical" as SpeechPriority,
};

interface QueuedUtterance {
  text: string;
  priority: SpeechPriority;
  dedupeKey: string;
  enqueuedAt: number;
}

const DEFAULT_DEBOUNCE_MS = 8_000;

export class TTSService {
  private static queue: QueuedUtterance[] = [];
  private static pendingDedupeKeys = new Set<string>();
  private static recentDedupeKeys = new Map<string, number>();
  private static isSpeaking = false;
  private static isMuted = false;
  private static activeUtteranceId = 0;
  private static cancelFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private static getRate: () => number = () => 1.05;
  private static volume = 1;
  private static pitch = 1;
  private static cachedVoices: SpeechSynthesisVoice[] = [];
  private static voiceRetryListener: (() => void) | null = null;
  private static voiceRetryCount = 0;

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Call directly from the user gesture that starts navigation. */
  public static warmUp(): void {
    if (!this.isSupported()) {
      console.warn("[TTS] Web Speech API is unavailable in this browser.");
      return;
    }

    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.cachedVoices = voices;
          this.voiceRetryCount = 0;
          if (this.voiceRetryListener) {
            window.speechSynthesis.removeEventListener("voiceschanged", this.voiceRetryListener);
            this.voiceRetryListener = null;
          }
          return;
        }

        // Some Chromium builds populate voices asynchronously. Retry a bounded
        // number of times after the browser announces that its voice list changed.
        if (!this.voiceRetryListener && this.voiceRetryCount < 4) {
          this.voiceRetryCount += 1;
          const retry = () => {
            this.voiceRetryListener = null;
            loadVoices();
          };
          this.voiceRetryListener = retry;
          window.speechSynthesis.addEventListener("voiceschanged", retry, { once: true });
        }
      } catch (error) {
        console.warn("[TTS] Could not load speech voices:", error);
      }
    };

    loadVoices();
  }

  public static setRateProvider(provider: () => number): void {
    this.getRate = provider;
  }

  public static setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public static setPitch(pitch: number): void {
    this.pitch = Math.max(0.5, Math.min(2, pitch));
  }

  public static getMuted(): boolean {
    return this.isMuted;
  }

  public static setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.queue = [];
      this.pendingDedupeKeys.clear();
      this.cancelActiveSpeech();
    }
  }

  /** Toggle the service itself; the returned value is the new muted state. */
  public static toggleMute(muted?: boolean): boolean {
    this.setMuted(muted ?? !this.isMuted);
    return this.isMuted;
  }

  /** Backward-compatible alias while callers migrate to toggleMute(). */
  public static toggleMuted(): boolean {
    return this.toggleMute();
  }

  public static announce(
    text: string,
    priority: SpeechPriority,
    dedupeKey: string,
    debounceMs: number = DEFAULT_DEBOUNCE_MS,
  ): void {
    const normalizedText = text.trim();
    const normalizedKey = dedupeKey.trim().toLowerCase() || normalizedText.toLowerCase();
    if (!normalizedText || this.isMuted) return;
    if (!this.isSupported()) {
      console.warn("[TTS] Announcement skipped because Web Speech API is unavailable.");
      return;
    }

    const now = Date.now();
    const lastSpokenAt = this.recentDedupeKeys.get(normalizedKey);
    if (
      (lastSpokenAt !== undefined && now - lastSpokenAt < debounceMs) ||
      this.pendingDedupeKeys.has(normalizedKey)
    ) {
      return;
    }

    if (priority === "critical") {
      const retained = this.queue.filter((item) => item.priority === "critical");
      this.queue = retained;
      this.pendingDedupeKeys = new Set(retained.map((item) => item.dedupeKey));
      if (this.isSpeaking) this.hardStop();
    }

    this.queue.push({ text: normalizedText, priority, dedupeKey: normalizedKey, enqueuedAt: now });
    this.pendingDedupeKeys.add(normalizedKey);
    this.processQueue();
  }

  /** Compatibility wrapper for older call sites; new code should use announce(). */
  public static speak(
    text: string,
    priority: SpeechPriority = "normal",
    debounceSeconds = 15,
    dedupeKey?: string,
  ): void {
    const key = dedupeKey || text.trim().toLowerCase();
    this.announce(text, priority, key, debounceSeconds * 1000);
  }

  /** Clear speech and debounce state when leaving or replacing a route. */
  public static reset(): void {
    this.queue = [];
    this.pendingDedupeKeys.clear();
    this.recentDedupeKeys.clear();
    this.cancelActiveSpeech();
  }

  public static clearQueue(): void {
    this.reset();
  }

  private static cancelActiveSpeech(): void {
    this.activeUtteranceId += 1;
    if (this.cancelFallbackTimer) {
      clearTimeout(this.cancelFallbackTimer);
      this.cancelFallbackTimer = null;
    }
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {
        console.error("[TTS] speechSynthesis.cancel() failed:", error);
      }
    }
    // Cancelled Chromium utterances may never raise onend/onerror.
    this.isSpeaking = false;
  }

  private static hardStop(): void {
    const stoppedUtteranceId = ++this.activeUtteranceId;
    if (this.cancelFallbackTimer) clearTimeout(this.cancelFallbackTimer);
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.error("[TTS] Could not interrupt the active utterance:", error);
    }

    // Keep the queue locked until cancel has propagated; the fallback handles
    // browsers that omit the cancelled utterance's completion event.
    this.cancelFallbackTimer = setTimeout(() => {
      this.cancelFallbackTimer = null;
      if (this.activeUtteranceId !== stoppedUtteranceId || this.isMuted) return;
      this.isSpeaking = false;
      this.processQueue();
    }, 60);
  }

  private static processQueue(): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[TTS] processQueue", {
        isSpeaking: this.isSpeaking,
        isMuted: this.isMuted,
        queued: this.queue.length,
      });
    }
    if (this.isSpeaking || this.queue.length === 0 || this.isMuted) return;
    if (!this.isSupported()) {
      console.warn("[TTS] Queue cannot play because Web Speech API is unavailable.");
      this.queue = [];
      this.pendingDedupeKeys.clear();
      return;
    }

    const next = this.queue.shift();
    if (!next) return;
    this.pendingDedupeKeys.delete(next.dedupeKey);
    const utteranceId = ++this.activeUtteranceId;
    this.isSpeaking = true;
    this.recentDedupeKeys.set(next.dedupeKey, Date.now());

    try {
      const utterance = new SpeechSynthesisUtterance(next.text);
      const requestedRate = Number(this.getRate());
      utterance.rate = Number.isFinite(requestedRate) ? Math.max(0.5, Math.min(2, requestedRate)) : 1.05;
      utterance.volume = this.volume;
      utterance.pitch = this.pitch;

      if (this.cachedVoices.length === 0) this.warmUp();
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (voice) => voice.lang.startsWith("en-IN") && /natural|neural/i.test(voice.name),
      ) || voices.find((voice) => voice.lang.startsWith("en"));
      if (preferredVoice) utterance.voice = preferredVoice;

      const finish = (error?: SpeechSynthesisErrorEvent) => {
        if (utteranceId !== this.activeUtteranceId) return;
        if (error) console.warn("[TTS] Utterance failed:", error.error);
        this.isSpeaking = false;
        this.processQueue();
      };
      utterance.onend = () => finish();
      utterance.onerror = (event) => finish(event);

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      if (utteranceId === this.activeUtteranceId) this.isSpeaking = false;
      console.error("[TTS] Failed to speak queued announcement:", error);
      this.processQueue();
    }
  }

  public static speakCongestionAlert(
    locationName: string,
    distanceText: string,
    speedKmh: number,
    delayMinutes?: number,
    suggestRerouteOption = true,
    severity: "LOW" | "MODERATE" | "HEAVY" | "SEVERE" = "HEAVY",
  ): void {
    const severityText = severity === "SEVERE" ? "severe traffic" : severity === "HEAVY" ? "heavy traffic" : "moderate traffic";
    let message = `Traffic alert: ${severityText} ahead in ${distanceText} near ${locationName}.`;
    if (speedKmh > 0) message += ` Flow speed is ${Math.round(speedKmh)} kilometers per hour.`;
    if (delayMinutes && delayMinutes >= 2) message += ` Expected delay is ${Math.round(delayMinutes)} minutes.`;
    if (suggestRerouteOption && (severity === "HEAVY" || severity === "SEVERE")) {
      message += " A route around this congestion may be available.";
    }
    this.announce(message, "normal", `congestion_${severity}_${locationName}`, 20_000);
  }

  public static speakRerouteSuggestion(
    timeSavedMinutes: number,
    viaRoad?: string,
    isCongestionAvoidance = false,
  ): void {
    let message: string;
    if (isCongestionAvoidance) {
      message = "An alternate route avoids the flagged congestion";
      if (viaRoad) message += ` via ${viaRoad}`;
      message += ". Review the route on screen.";
    } else {
      message = `Faster route found. You can save approximately ${Math.round(timeSavedMinutes)} minutes`;
      message += viaRoad ? ` by taking ${viaRoad}.` : ". Review the route on screen.";
    }
    this.announce(message, "normal", `reroute_${isCongestionAvoidance ? "avoid" : "faster"}_${viaRoad || "route"}`, 30_000);
  }

  public static speakTurnManeuver(instruction: string, dedupeKey = instruction): void {
    this.announce(instruction, "critical", `maneuver_${dedupeKey}`, 30 * 60_000);
  }
}
