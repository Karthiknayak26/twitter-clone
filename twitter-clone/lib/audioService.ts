export function getISTDate(): Date {
  const now = new Date();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m in milliseconds
  return new Date(now.getTime() + IST_OFFSET_MS);
}

export function isWithinTimeWindow(): boolean {
  const istNow = getISTDate();
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 14:00 = 840 minutes, 19:00 = 1140 minutes
  return totalMinutes >= 840 && totalMinutes < 1140;
}

export function getISTTimeString(): string {
  const istNow = getISTDate();
  const hours = istNow.getUTCHours().toString().padStart(2, "0");
  const minutes = istNow.getUTCMinutes().toString().padStart(2, "0");
  const seconds = istNow.getUTCSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds} IST`;
}

export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error("Failed to load audio metadata"));
    });
  });
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
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

export function getTimeWindowStatus(): { isOpen: boolean; text: string; countdownSeconds?: number } {
  const istNow = getISTDate();
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();
  const seconds = istNow.getUTCSeconds();
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  const OPEN_SECONDS = 14 * 3600; // 2:00 PM = 14:00
  const CLOSE_SECONDS = 19 * 3600; // 7:00 PM = 19:00

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

export async function validateAudioFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!file) {
    return { valid: false, error: "No file selected" };
  }
  // MIME type check
  if (!file.type.startsWith("audio/")) {
    return { valid: false, error: "Selected file must be an audio file (e.g. mp3, wav, m4a, webm)" };
  }
  // Size check
  if (file.size === 0) {
    return { valid: false, error: "Audio file is empty" };
  }
  const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: `File size exceeds 100 MB limit (Selected: ${(file.size / (1024 * 1024)).toFixed(1)} MB)` };
  }
  // Duration check
  try {
    const duration = await getAudioDuration(file);
    const MAX_DURATION = 5 * 60; // 5 minutes
    if (duration > MAX_DURATION) {
      return { valid: false, error: `Audio duration exceeds 5 minutes limit (Selected: ${formatDuration(duration)})` };
    }
  } catch (e) {
    return { valid: false, error: "Unable to verify audio duration. The file might be corrupted or in an unsupported format." };
  }
  return { valid: true };
}
