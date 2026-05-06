// Calculate elapsed business hours (Mon-Fri, all 24h) between two dates.
// Weekends (Sat/Sun) are skipped entirely.
export function businessHoursBetween(from: Date | string, to: Date | string = new Date()): number {
  const start = new Date(from);
  const end = new Date(to);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;

  let totalMs = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    // Move to end of current day or `end`, whichever comes first
    const endOfDay = new Date(cursor);
    endOfDay.setHours(23, 59, 59, 999);
    const segmentEnd = end < endOfDay ? end : endOfDay;
    const day = cursor.getDay(); // 0 Sun .. 6 Sat
    if (day !== 0 && day !== 6) {
      totalMs += segmentEnd.getTime() - cursor.getTime();
    }
    // Advance to start of next day
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return totalMs / (1000 * 60 * 60);
}
