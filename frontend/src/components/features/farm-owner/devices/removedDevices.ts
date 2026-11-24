const HOUR_MS = 3600_000

// Số giờ còn khôi phục được, làm tròn lên (còn 30 phút vẫn ghi "còn 1 giờ"); hết hạn thì 0
export function hoursLeftToRestore(restorableUntil: string, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(restorableUntil).getTime() - now) / HOUR_MS))
}
