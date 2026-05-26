/**
 * notificationService.ts
 * 
 * Isolated, SSR-safe service for the Browser Notification API feature.
 * Handles keyword detection, permission management, and user preference persistence.
 * All functions are SSR-safe (guarded with typeof window !== "undefined").
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** localStorage key for user notification preference */
const NOTIF_PREF_KEY = "twiller-notif-enabled";

/**
 * Keyword pattern: matches "cricket" or "science" as whole words,
 * case-insensitive. \b ensures partial words like "unscientific" don't match.
 */
const KEYWORD_PATTERN = /\b(cricket|science)\b/i;

/** Which keywords are tracked — exported so UI can display them */
export const TRACKED_KEYWORDS = ["cricket", "science"];

// ─── Browser Support ─────────────────────────────────────────────────────────

/**
 * Returns true if the browser supports the Notification API.
 * SSR-safe: returns false during server-side rendering.
 */
export function isNotificationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window;
}

// ─── Permission Management ───────────────────────────────────────────────────

/**
 * Returns the current browser notification permission state.
 * Returns "unsupported" if the Notification API is not available.
 */
export function getPermissionState(): "granted" | "denied" | "default" | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Requests browser notification permission from the user.
 * Returns the resulting permission state.
 * Only call this in response to a direct user gesture (button click).
 */
export async function requestPermission(): Promise<"granted" | "denied" | "default"> {
  if (!isNotificationSupported()) return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    // Safari uses callback-based API in older versions — fallback
    return new Promise((resolve) => {
      Notification.requestPermission((result) => resolve(result));
    });
  }
}

// ─── User Preference ─────────────────────────────────────────────────────────

/**
 * Gets the user's saved notification preference from localStorage.
 * Returns false by default (notifications off until user opts in).
 */
export function getUserNotifPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(NOTIF_PREF_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

/**
 * Saves the user's notification preference to localStorage.
 */
export function setUserNotifPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIF_PREF_KEY, String(enabled));
  } catch {
    // localStorage unavailable (private mode, storage full, etc.) — fail silently
  }
}

// ─── Keyword Detection ───────────────────────────────────────────────────────

/**
 * Returns true if the tweet content contains any tracked keyword.
 * Matching is case-insensitive and word-boundary aware.
 * 
 * Examples:
 *   "I love cricket!" → true
 *   "Science is fun" → true  
 *   "unscientific" → false (not a whole word match)
 *   "Hello world" → false
 */
export function containsKeywords(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  return KEYWORD_PATTERN.test(content);
}

/**
 * Returns all matched keywords found in the content (for use in notification body).
 */
export function getMatchedKeywords(content: string): string[] {
  if (!content || typeof content !== "string") return [];
  const matches: string[] = [];
  for (const keyword of TRACKED_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(content)) {
      matches.push(keyword);
    }
  }
  return matches;
}

// ─── Notification Firing ─────────────────────────────────────────────────────

/**
 * Sends a browser notification for a tweet.
 * This is a no-op if:
 *  - Notifications are not supported
 *  - Browser permission is not "granted"
 *  - User preference is disabled
 * 
 * @param tweet - The tweet object containing user and content
 * @returns true if notification was sent, false otherwise
 */
export function sendTweetNotification(tweet: {
  content: string;
  user: { displayName: string; username: string; avatar?: string };
}): boolean {
  // Guard: browser support
  if (!isNotificationSupported()) return false;

  // Guard: browser permission
  if (Notification.permission !== "granted") return false;

  // Guard: user preference
  if (!getUserNotifPref()) return false;

  try {
    const matchedKeywords = getMatchedKeywords(tweet.content);
    const keywordLabel = matchedKeywords.map((k) => `#${k}`).join(", ");

    const notification = new Notification(
      `🔔 Trending: ${keywordLabel} — @${tweet.user.username}`,
      {
        body: tweet.content,
        icon: tweet.user.avatar || "/favicon.ico",
        badge: "/favicon.ico",
        tag: `tweet-notif-${Date.now()}`, // unique tag prevents duplicate coalescing
        requireInteraction: false,
        silent: false,
      }
    );

    // Auto-close after 6 seconds
    setTimeout(() => notification.close(), 6000);

    // Click handler — bring tab into focus
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch {
    // Notification constructor can fail in some edge cases — fail silently
    return false;
  }
}

/**
 * Checks if notifications should currently be active:
 * - Supported by browser
 * - Permission granted
 * - User preference is enabled
 */
export function areNotificationsActive(): boolean {
  return (
    isNotificationSupported() &&
    Notification.permission === "granted" &&
    getUserNotifPref()
  );
}
