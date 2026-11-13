// A simple mechanism to show a welcome toast once per session, e.g. "Good morning, Alice!" when a staff member first logs in. It uses sessionStorage to track whether the welcome has been shown yet.

const WELCOME_KEY = "welcomePending";

export function markWelcomePending(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // Storage blocked — nobody is greeted.
  }
}

/** True once per pending welcome; clears the mark as it reads it. */
export function consumeWelcomePending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(WELCOME_KEY) !== "1") return false;
    window.sessionStorage.removeItem(WELCOME_KEY);
    return true;
  } catch {
    return false;
  }
}

export function timeOfDayGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}
