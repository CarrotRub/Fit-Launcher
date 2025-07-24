export function formatPlayTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function formatDiskSize(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

export function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

export function formatSpeed(bytes?: string | number): string {
  const num = toNumber(bytes);
  if (!num || num === 0) return "-";
  if (num < 1024) return `${num} B/s`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB/s`;
  if (num < 1024 * 1024 * 1024)
    return `${(num / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "-";

  function format(num: number) {
    const str = num.toFixed(1);
    return str.endsWith(".0") ? str.slice(0, -2) : str;
  }

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${format(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${format(bytes / 1024 ** 2)} MB`;
  return `${format(bytes / 1024 ** 3)} GB`;
}

export function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
}

export function toTitleCaseExceptions(str: string): string {
  const forceUpper = new Set(["VO", "OST", "DLC", "MP4", "1080P", "4K", "SD"]);

  return str.replace(/\w\S*/g, (word) => {
    const upper = word.toUpperCase();

    if (forceUpper.has(upper)) {
      return upper;
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function toNumber(value: string | number | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value) || 0;
}

export function extractMainTitle(title: string): string {
  return title
    ?.replace(
      /(?: - |, | )?(Digital Deluxe|Ultimate Edition|Deluxe Edition)\s*[:\-]?.*|(?: - |, ).*/,
      ""
    )
    ?.replace(/\s*[:\-]\s*$/, "")
    ?.replace(/\(.*?\)/g, "")
    ?.replace(/\s*[:\u2013]\s*$/, "")
    ?.replace(/[\u2013].*$/, "");
}

export function cleanForFolder(title: string): string {
  // https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
  const forbidden = /[<>:"/\\|?*\x00-\x1F]/g;
  const reservedNames = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];

  let cleaned = title.replace(forbidden, " ");

  cleaned = cleaned.trim().replace(/[. ]+$/, "");

  if (reservedNames.includes(cleaned.toUpperCase())) {
    cleaned = `${cleaned}_`;
  }

  return cleaned;
}
