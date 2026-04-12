/* ─── Notification utilities ────────────────────────────────
 * Sound, browser notifications, unread badge tracking
 * All backed by localStorage — no server dependency
 * ─────────────────────────────────────────────────────────── */

const SOUND_KEY = "echotwin_sound_enabled";
const UNREAD_KEY = (id: string) => `echotwin_unread_${id}`;
const LASTMSG_KEY = (id: string) => `echotwin_lastmsg_${id}`;
const NOTIF_ASKED_KEY = "echotwin_notif_asked";

/* ─── Sound ─────────────────────────────────────────────── */

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SOUND_KEY);
  return v === null ? true : v === "true";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, String(enabled));
}

/**
 * Play a pleasant WhatsApp-style notification bell using Web Audio API.
 * type "incoming" = full notification (user not on page)
 * type "soft"     = subtle chime (user is on page, new message arrives)
 */
export function playNotificationSound(type: "incoming" | "soft" = "incoming") {
  if (!isSoundEnabled()) return;
  if (typeof window === "undefined") return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const play = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + start + dur
      );
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    if (type === "incoming") {
      // Two-note bell: high → mid
      play(1320, 0, 0.4, 0.22);
      play(880, 0.12, 0.35, 0.15);
    } else {
      // Single soft chime
      play(1100, 0, 0.28, 0.1);
    }
  } catch {
    // Silently ignore if AudioContext not available
  }
}

/* ─── Browser notifications ─────────────────────────────── */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window))
    return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  // Only ask once
  if (localStorage.getItem(NOTIF_ASKED_KEY) === "declined") return false;
  localStorage.setItem(NOTIF_ASKED_KEY, "asked");
  const result = await Notification.requestPermission();
  if (result === "denied") localStorage.setItem(NOTIF_ASKED_KEY, "declined");
  return result === "granted";
}

export function showBrowserNotification(
  title: string,
  body: string,
  iconUrl?: string
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: iconUrl ?? "/favicon.svg",
      silent: true, // We handle sound ourselves
    });
  } catch {
    // Some browsers block programmatic notifications
  }
}

/* ─── Unread counts ──────────────────────────────────────── */

export function getUnreadCount(personaId: string): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(UNREAD_KEY(personaId)) ?? "0", 10);
}

export function incrementUnread(personaId: string): number {
  const next = getUnreadCount(personaId) + 1;
  localStorage.setItem(UNREAD_KEY(personaId), String(next));
  return next;
}

export function clearUnread(personaId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(UNREAD_KEY(personaId), "0");
}

/* ─── Last message cache ─────────────────────────────────── */

export interface LastMessage {
  content: string;
  role: "user" | "assistant";
  created_at: string;
}

export function getLastMessage(personaId: string): LastMessage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LASTMSG_KEY(personaId));
    return raw ? (JSON.parse(raw) as LastMessage) : null;
  } catch {
    return null;
  }
}

export function setLastMessage(personaId: string, msg: LastMessage) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LASTMSG_KEY(personaId), JSON.stringify(msg));
}
