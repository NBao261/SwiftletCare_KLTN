import { useCallback, useEffect, useRef } from 'react'
import { BackHandler } from 'react-native'
import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { isRootStackReturnTo, isSafeReturnTo } from '@/utils/navigation.utils'

// Về màn returnTo: màn của stack gốc (vd. chi tiết cảnh báo → Đi tới khu vực → Màn B) thì gỡ các màn phía trên cho tới đúng màn
// cũ, để back tiếp về màn đã mở cảnh báo (phiếu công việc…); màn trong tab thì chuyển sang tab đó
function navigateToReturnTo(target: string & Parameters<typeof router.navigate>[0]) {
  if (isRootStackReturnTo(target)) router.dismissTo(target)
  else router.navigate(target)
}

// Nút ‹ cho màn mở từ lối tắt (MOBILE_GUIDE §2.3): màn nhận param returnTo thì trả về hàm quay lại màn đó, không có thì
// undefined (màn tự quyết nút ‹ mặc định hoặc không có). Nút back cứng của Android và vuốt quay lại của iOS cũng về returnTo.
// returnTo chỉ dùng một lần: quay lại xong, hoặc rời tab bằng thanh tab, thì xoá — lần sau bấm tab không còn nút ‹ thừa
export function useReturnBack(): (() => void) | undefined {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const navigation = useNavigation<NavigationProp<ParamListBase>>()
  const target = isSafeReturnTo(returnTo) ? returnTo : null
  // Đã quay về màn đích, còn chờ gỡ màn này khỏi stack của tab khi tab bị rời
  const isPopPending = useRef(false)
  // Màn này đang tự gỡ mình khỏi stack: sự kiện beforeRemove không xử lý lại
  const isSelfRemoving = useRef(false)

  const clearReturnTo = useCallback(() => navigation.setParams({ returnTo: undefined }), [navigation])

  const goBack = useCallback(() => {
    if (!target) return
    const state = navigation.getState()
    // Màn con trong stack của tab (vd. Màn B mở từ Trang chủ, dưới nó là danh sách nhà): đánh dấu để khi đã sang màn đích thì
    // gỡ màn này, lần sau bấm tab thấy màn gốc chứ không thấy lại màn cũ
    // Màn đích cùng tab thì không gỡ: màn trên cùng lúc rời tab chính là màn đích
    const tabState = navigation.getParent()?.getState()
    const tabName = tabState?.type === 'tab' ? tabState.routes[tabState.index]?.name : undefined
    const isSameTab = tabName !== undefined && target.startsWith(`/(tabs)/${tabName}`)
    isPopPending.current = state?.type === 'stack' && state.index > 0 && !isSameTab
    clearReturnTo()
    navigateToReturnTo(target)
  }, [target, navigation, clearReturnTo])

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

  // Vuốt quay lại của iOS gỡ màn này và lộ ra màn gốc của tab (vd. danh sách nhà, không có nút ‹ về Trang chủ): sau khi gỡ
  // thì đi tiếp về returnTo, để vuốt và bấm ‹ về cùng một chỗ
  useEffect(() => {
    if (!target) return
    return navigation.addListener('beforeRemove', event => {
      const actionType = event.data.action.type
      if (isSelfRemoving.current || (actionType !== 'POP' && actionType !== 'GO_BACK')) return
      navigateToReturnTo(target)
    })
  }, [target, navigation])

  // Rời cả tab (không phải mở màn con trong cùng stack) thì bỏ returnTo; nếu vừa bấm ‹ thì gỡ luôn màn con này khỏi stack của
  // tab (tab đã ẩn nên không thấy hiệu ứng). Màn trong stack nghe tab cha, màn gốc của tab nghe chính nó
  useEffect(() => {
    const tabNavigation = navigation.getState()?.type === 'tab' ? navigation : navigation.getParent()
    return tabNavigation?.addListener('blur', () => {
      if (isPopPending.current) {
        isPopPending.current = false
        isSelfRemoving.current = true
        navigation.dispatch(StackActions.pop())
        return
      }
      if (target) clearReturnTo()
    })
  }, [target, navigation, clearReturnTo])

  return target ? goBack : undefined
}
