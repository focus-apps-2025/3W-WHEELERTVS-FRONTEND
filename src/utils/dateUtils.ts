export function formatTimestamp(timestamp: string | Date | number, type?: string): string {
  if (!timestamp) return "-";

  let date: Date | null = null;

  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === "number") {
    if (timestamp > 20000 && timestamp < 100000) {
      date = new Date(Math.round((timestamp - 25569) * 86400 * 1000));
    } else {
      date = new Date(timestamp);
    }
  } else if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();

    // Check if string starts with a 5-digit number or year > 20000 (like "46097-01-01" or "46034")
    const yearMatch = trimmed.match(/^(\d{4,6})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
    if (yearMatch) {
      const yearNum = parseInt(yearMatch[1], 10);
      if (yearNum > 20000 && yearNum < 100000) {
        // Correct the Excel serial date year back to real date
        const rawDate = new Date(Math.round((yearNum - 25569) * 86400 * 1000));
        if (!isNaN(rawDate.getTime())) {
          date = rawDate;
        }
      }
    }

    if (!date) {
      const isPureNumber = /^\d+(\.\d+)?$/.test(trimmed);
      if (isPureNumber) {
        const num = Number(trimmed);
        if (num > 20000 && num < 100000) {
          const rawDate = new Date(Math.round((num - 25569) * 86400 * 1000));
          if (!isNaN(rawDate.getTime())) {
            date = rawDate;
          }
        }
      }
    }

    if (!date) {
      // Handle DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
        let year = parseInt(ddmmyyyyMatch[3], 10);
        if (year < 100) year += year < 50 ? 2000 : 1900;
        date = new Date(Date.UTC(year, month, day, 12, 0, 0));
      } else {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
        }
      }
    }
  }

  if (!date || isNaN(date.getTime())) return "-";

  // Additional safety check: if year ended up > 20000 (e.g. 46097 or 46034)
  const yr = date.getFullYear();
  if (yr > 20000 && yr < 100000) {
    date = new Date(Math.round((yr - 25569) * 86400 * 1000));
  }

  if (type === "file") {
    return date.toISOString().replace(/[:.]/g, "-");
  }

  // Format nicely as DD/MM/YYYY hh:mm A
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  const formattedHours = String(hours).padStart(2, "0");

  return `${day}/${month}/${year} ${formattedHours}:${minutes} ${ampm}`;
}
