import { useEffect } from 'react'
import { useLanguageStore } from '@/stores/languageStore'

const APP_NAME = 'SwiftletCare'

// Tiêu đề tab trình duyệt: "<trang> · SwiftletCare"; không có tên trang thì chỉ còn tên ứng dụng
export function useDocumentTitle(...parts: Array<string | undefined>): void {
  // Đổi ngôn ngữ thì trang vẽ lại và tiêu đề tab đổi theo
  useLanguageStore(state => state.lang)
  const title = [...parts.filter((part): part is string => Boolean(part)), APP_NAME].join(' · ')
  useEffect(() => {
    document.title = title
  }, [title])
}
