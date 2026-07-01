export function formatTimestamp(timestamp: string, type?: string): string {
  const date = new Date(timestamp);
  if (type === "file") {
    return date.toISOString().replace(/[:.]/g, "-");
  }
  return date.toLocaleString();
}
