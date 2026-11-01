import { useEffect, useState } from 'react'

// Toast tự ẩn sau vài giây (MOBILE_GUIDE 3.6)
const TOAST_DURATION_MS = 3000

// Câu toast đang hiện của một màn: show(câu) để hiện, tự về null sau TOAST_DURATION_MS
export function useToastMessage() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [message])

  return { message, show: setMessage }
}
