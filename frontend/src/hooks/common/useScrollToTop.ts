import { useLayoutEffect } from 'react'

/**
 * Đưa vùng nội dung của app (thẻ <main> trong AppShell — đây mới là phần tử cuộn, không phải window) về đầu trang
 * mỗi khi `key` đổi hoặc trang mới mount. Đổi route trong cùng AppShell không tự reset vị trí cuộn, nên bấm
 * "Chi tiết" khi đang cuộn xuống sẽ mở trang mới ở giữa chừng nếu không gọi hook này.
 */
export function useScrollToTop(key?: string) {
  useLayoutEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [key])
}
