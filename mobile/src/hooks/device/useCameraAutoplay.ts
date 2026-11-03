import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { NetworkStateType, useNetworkState } from 'expo-network'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'

interface CameraAutoplayInput {
  // Màn đang hiện, không có sheet che, camera online và khung camera không thu gọn
  canPlay: boolean
}

// Có phát live stream không: Wi-Fi/Ethernet thì tự phát; dữ liệu di động thì theo lựa chọn đã lưu, chưa chọn thì hỏi;
// app chạy nền thì dừng. Dừng là bỏ luồng, phát lại thì xin token mới
export function useCameraAutoplay({ canPlay }: CameraAutoplayInput) {
  const { userId, prefs } = useFarmPrefs()
  const setCellularAutoplay = useFarmPrefsStore(state => state.setCellularAutoplay)
  const networkState = useNetworkState()
  const [isAppActive, setAppActive] = useState(AppState.currentState === 'active')
  // Người dùng bấm phát một lần dù đã chọn không tự phát khi dùng dữ liệu di động
  const [isPlayRequested, setPlayRequested] = useState(false)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'))
    return () => subscription.remove()
  }, [])

  const isUnmeteredNetwork =
    networkState.type === NetworkStateType.WIFI || networkState.type === NetworkStateType.ETHERNET
  const isNetworkAllowed = isUnmeteredNetwork || prefs.cellularAutoplay === 'allow' || isPlayRequested

  return {
    shouldStream: canPlay && isAppActive && isNetworkAllowed,
    // Đang dùng dữ liệu di động và chưa chọn: hiện câu hỏi trong khung camera
    isAskingCellular: canPlay && !isUnmeteredNetwork && prefs.cellularAutoplay === undefined && !isPlayRequested,
    // Đã chọn không tự phát: hiện nút phát
    isWaitingForPlay: canPlay && !isNetworkAllowed && prefs.cellularAutoplay === 'deny',
    allowCellular: () => setCellularAutoplay(userId, 'allow'),
    declineCellular: () => setCellularAutoplay(userId, 'deny'),
    playOnce: () => setPlayRequested(true),
  }
}
