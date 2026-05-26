export function getISTDate(): Date {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m in milliseconds
  return new Date(now.getTime() + IST_OFFSET_MS);
}

export function isWithinPaymentWindow(): boolean {
  const istNow = getISTDate();
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 10:00 AM = 600 minutes, 11:00 AM = 660 minutes
  return totalMinutes >= 600 && totalMinutes < 660;
}

export function getISTTimeString(): string {
  const istNow = getISTDate();
  const hours = istNow.getUTCHours().toString().padStart(2, "0");
  const minutes = istNow.getUTCMinutes().toString().padStart(2, "0");
  const seconds = istNow.getUTCSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds} IST`;
}

export function formatTimeRemaining(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function getPaymentWindowStatus(): { isOpen: boolean; text: string; countdownSeconds?: number } {
  const istNow = getISTDate();
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const seconds = istNow.getUTCSeconds();
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  const OPEN_SECONDS = 10 * 3600; // 10:00 AM = 10 * 3600
  const CLOSE_SECONDS = 11 * 3600; // 11:00 AM = 11 * 3600

  if (totalSeconds >= OPEN_SECONDS && totalSeconds < CLOSE_SECONDS) {
    const remaining = CLOSE_SECONDS - totalSeconds;
    return {
      isOpen: true,
      text: `closes in ${formatTimeRemaining(remaining)}`,
      countdownSeconds: remaining,
    };
  } else {
    let timeToOpen = 0;
    if (totalSeconds < OPEN_SECONDS) {
      timeToOpen = OPEN_SECONDS - totalSeconds;
    } else {
      timeToOpen = (24 * 3600 - totalSeconds) + OPEN_SECONDS;
    }
    return {
      isOpen: false,
      text: `opens in ${formatTimeRemaining(timeToOpen)}`,
      countdownSeconds: timeToOpen,
    };
  }
}
