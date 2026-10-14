import { useState } from 'react'

// Giá trị chọn riêng của từng khung, tự theo lại khi giá trị nguồn (ô chọn tổng) đổi
export function useSyncedState<T>(source: T) {
  const [value, setValue] = useState(source)
  const [lastSource, setLastSource] = useState(source)

  if (lastSource !== source) {
    setLastSource(source)
    setValue(source)
  }

  return [value, setValue] as const
}
