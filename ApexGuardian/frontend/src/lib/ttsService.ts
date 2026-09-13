export enum SpeechPriority {
  NORMAL = 1,     // Congestion info, traffic telemetry
  HIGH = 2,       // Reroute recommendations
  CRITICAL = 3,   // Turn-by-turn maneuvers, immediate hazards
}

interface QueuedSpeech {
  id: string;
  text: string;
  priority: SpeechPriority;
  timestamp: number;
  dedupeKey?: string;
}

export class TTSService {
  private static isMuted: boolean = false;
  private static volume: number = 1.0;
  private static rate: number = 1.05; // Slightly brisk driving cadence
  private static pitch: number = 1.0;
  private static isSpeaking: boolean = false;
  private static speechQueue: QueuedSpeech[] = [];
  private static spokenHistory: Map<string, number> = new Map();
  private static cachedVoices: SpeechSynthesisVoice[] = [];
  private static isInitialized = false;

  public static isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private static initVoices() {
    if (this.isInitialized || !this.isSupported()) return;
    this.isInitialized = true;
    
    const loadVoices = () => {
      this.cachedVoices = window.speechSynthesis.getVoices();
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public static setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isSupported()) {
      window.speechSynthesis.cancel();
      this.speechQueue = [];
      this.isSpeaking = false;
    }
  }

  public static getMuted(): boolean {
    return this.isMuted;
  }

  public static toggleMuted(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public static clearQueue() {
    this.speechQueue = [];
    this.spokenHistory.clear();
    if (this.isSpeaking && this.isSupported()) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  public static setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public static setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  /**
   * Enqueues and speaks a message while ensuring no audio collisions
   * with turn-by-turn navigation instructions.
   */
  public static speak(text: string, priority: SpeechPriority = SpeechPriority.NORMAL, debounceSeconds: number = 15, dedupeKey?: string) {
    if (!this.isSupported()) return;
    this.initVoices();
    if (this.isMuted || !text.trim()) return;

    // Check debounce history to prevent repeating the same warning excessively
    const normalizedKey = dedupeKey ? dedupeKey.trim().toLowerCase() : text.trim().toLowerCase();
    const lastSpokenTime = this.spokenHistory.get(normalizedKey);
    const now = Date.now();

    if (lastSpokenTime && now - lastSpokenTime < debounceSeconds * 1000) {
      return;
    }

    const item: QueuedSpeech = {
      id: `${now}_${Math.random().toString(36).substring(2, 7)}`,
      text: text.trim(),
      priority,
      timestamp: now,
      dedupeKey,
    };

    // If critical maneuver, insert at front of queue or interrupt low priority
    if (priority === SpeechPriority.CRITICAL) {
      // Clear non-critical queue items
      this.speechQueue = this.speechQueue.filter((q) => q.priority === SpeechPriority.CRITICAL);
      this.speechQueue.unshift(item);
      if (this.isSpeaking) {
        window.speechSynthesis.cancel();
        this.isSpeaking = false;
      }
    } else {
      // Insert in priority order
      let inserted = false;
      for (let i = 0; i < this.speechQueue.length; i++) {
        if (priority > this.speechQueue[i].priority) {
          this.speechQueue.splice(i, 0, item);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.speechQueue.push(item);
      }
    }

    this.processQueue();
  }

  private static processQueue() {
    if (this.isSpeaking || this.speechQueue.length === 0 || !this.isSupported()) {
      return;
    }

    const item = this.speechQueue.shift();
    if (!item) return;

    this.isSpeaking = true;
    const cacheKey = item.dedupeKey ? item.dedupeKey.trim().toLowerCase() : item.text.trim().toLowerCase();
    this.spokenHistory.set(cacheKey, Date.now());

    try {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.volume = this.volume;
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;

      // Select an English voice if available
      const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => (v.lang.startsWith("en-IN") || v.lang.startsWith("en-US") || v.lang.startsWith("en-GB")) && v.name.includes("Natural")
      ) || voices.find((v) => v.lang.startsWith("en"));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        // Small pause between utterances for natural breathing
        setTimeout(() => this.processQueue(), 250);
      };

      utterance.onerror = (e) => {
        console.warn("TTS playback error:", e);
        this.isSpeaking = false;
        setTimeout(() => this.processQueue(), 250);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Failed to execute TTS utterance:", err);
      this.isSpeaking = false;
      setTimeout(() => this.processQueue(), 250);
    }
  }

  /**
   * Reads out proactive congestion alert.
   */
  public static speakCongestionAlert(
    locationName: string,
    distanceText: string,
    speedKmh: number,
    delayMinutes?: number,
    suggestRerouteOption: boolean = true
  ) {
    let msg = `Traffic alert: heavy congestion ahead in ${distanceText} near ${locationName}.`;
    if (speedKmh > 0) {
      msg += ` Flow speed is ${Math.round(speedKmh)} kilometers per hour.`;
    }
    if (delayMinutes && delayMinutes >= 2) {
      msg += ` Expected delay is ${Math.round(delayMinutes)} minutes.`;
    }
    if (suggestRerouteOption && delayMinutes && delayMinutes >= 2) {
      msg += ` Tap to check a faster route.`;
    }
    this.speak(msg, SpeechPriority.NORMAL, 20, `congestion_${locationName}`);
  }

  /**
   * Reads out reroute recommendation.
   */
  public static speakRerouteSuggestion(timeSavedMinutes: number, viaRoad?: string) {
    const minStr = Math.round(timeSavedMinutes);
    let msg = `Faster route found. You can save approximately ${minStr} minutes`;
    if (viaRoad) {
      msg += ` by taking ${viaRoad}.`;
    } else {
      msg += `. Tap accept on your screen to reroute.`;
    }
    this.speak(msg, SpeechPriority.HIGH, 30);
  }

  /**
   * Reads out turn-by-turn maneuver instruction (High Priority).
   */
  public static speakTurnManeuver(instruction: string) {
    this.speak(instruction, SpeechPriority.CRITICAL, 8);
  }
}
