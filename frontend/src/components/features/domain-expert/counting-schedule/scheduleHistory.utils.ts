import type { CountingScheduleView } from '@/types/expert.types'

export type HistoryEntry = CountingScheduleView['history'][number]
// LATEST: lần sửa cuối · SUPERSEDED: bị lần sau cùng ngày thay trước khi áp · APPLIED: đã áp một thời gian rồi mới bị thay
export type HistoryState = 'LATEST' | 'SUPERSEDED' | 'APPLIED'
export interface HistoryRow { entry: HistoryEntry; state: HistoryState }

// Backend trả cũ trước; mỗi ngày chỉ dùng lần sửa cuối của ngày đó. Duyệt từ mới về cũ một lượt, nhớ các ngày áp đã gặp
export function historyRows(history: HistoryEntry[]): HistoryRow[] {
  const seenDates = new Set<string>()
  const rows: HistoryRow[] = []
  for (let index = history.length - 1; index >= 0; index--) {
    const entry = history[index]
    let state: HistoryState = 'APPLIED'
    if (index === history.length - 1) state = 'LATEST'
    else if (seenDates.has(entry.effective_from)) state = 'SUPERSEDED'
    seenDates.add(entry.effective_from)
    rows.push({ entry, state })
  }
  return rows
}
