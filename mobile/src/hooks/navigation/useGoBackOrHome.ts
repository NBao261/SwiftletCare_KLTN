import { useCallback } from 'react'
import { router } from 'expo-router'

// Nút ‹ của màn riêng ở stack gốc (chuông, chi tiết thông báo): quay về màn đã mở nó; mở thẳng không có màn trước (deep link)
// thì về Trang chủ
export function useGoBackOrHome(): () => void {
  return useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home')
  }, [])
}
