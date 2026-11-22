import { useLayoutEffect } from 'react'

// <main> mới là phần tử cuộn; đổi route không tự reset vị trí cuộn
export function useScrollToTop(key?: string) {
  useLayoutEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [key])
}
