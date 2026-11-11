import { useCallback, useEffect } from 'react'
import { BackHandler } from 'react-native'
import type { NavigationProp, ParamListBase } from '@react-navigation/native'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { isSafeReturnTo } from '@/utils/navigation.utils'

// Nút ‹ cho màn mở từ lối tắt (MOBILE_GUIDE §2.3): màn nhận param returnTo thì trả về hàm quay lại màn đó, không có thì
// undefined (màn tự quyết nút ‹ mặc định hoặc không có). Nút back cứng của Android cũng quay về returnTo.
// returnTo chỉ dùng một lần: quay lại xong, hoặc rời tab bằng thanh tab, thì xoá — lần sau bấm tab không còn nút ‹ thừa
export function useReturnBack(): (() => void) | undefined {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const target = isSafeReturnTo(returnTo) ? returnTo : null

  const clearReturnTo = useCallback(() => navigation.setParams({ returnTo: undefined }), [navigation])

  const goBack = useCallback(() => {
    if (!target) return
    clearReturnTo()
    router.navigate(target)
  }, [target, clearReturnTo])

  // Back cứng của Android khi màn đang hiện
  useFocusEffect(
    useCallback(() => {
      if (!target) return
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack()
        return true
      })
      return () => subscription.remove()
    }, [target, goBack]),
  )

  // Rời cả tab (không phải mở màn con trong cùng stack) thì bỏ returnTo: màn trong stack nghe tab cha, màn gốc của tab nghe
  // chính nó
  useEffect(() => {
    if (!target) return
    const tabNavigation = navigation.getState()?.type === 'tab' ? navigation : navigation.getParent()
    return tabNavigation?.addListener('blur', clearReturnTo)
  }, [target, navigation, clearReturnTo])

  return target ? goBack : undefined
}
