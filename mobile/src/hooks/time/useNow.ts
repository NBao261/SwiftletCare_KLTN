import { useEffect, useState } from 'react'

// Mốc thời gian hiện tại, tự cập nhật sau mỗi khoảng — dùng cho chữ đếm ngược ("còn 18 phút")
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
