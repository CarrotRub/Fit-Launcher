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
