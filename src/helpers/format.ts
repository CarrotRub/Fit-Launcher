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
