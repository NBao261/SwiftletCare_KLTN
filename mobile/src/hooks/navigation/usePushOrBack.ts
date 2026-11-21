import { useCallback } from 'react'
import { router, useNavigation, type Href } from 'expo-router'
import { isPreviousRoute } from '@/utils/navigation.utils'

type StackHref = Extract<Href, { pathname: string }>

// Mở một màn của stack gốc; màn đó đúng là màn ngay trước (vd. chi tiết phiếu → cảnh báo gốc → bấm lại phiếu đó) thì quay lại,
// không mở chồng thêm — tránh vòng phiếu ↔ cảnh báo làm stack dài mãi và nút ‹ phải lùi qua từng lớp
export function usePushOrBack(): (href: StackHref) => void {
  const navigation = useNavigation()
  return useCallback(
    (href: StackHref) => {
      const params = (href.params ?? {}) as Record<string, string>
      if (isPreviousRoute(navigation.getState(), href.pathname.slice(1), params)) router.back()
      else router.push(href)
    },
    [navigation],
  )
}
