import { useState } from 'react'
import * as Location from 'expo-location'
import type { Coordinates } from '@/types'
import { t } from '@/utils/i18n.utils'

// Toạ độ giữ 6 chữ số lẻ (khoảng 0,1 m), đủ cho một địa điểm farm
const COORDINATE_DECIMALS = 6

// Lấy toạ độ hiện tại khi chủ trại đứng tại nhà yến (FARM-FR-001): chỉ xin quyền vị trí lúc bấm nút
export function useCurrentLocation() {
  const [isLocating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = async (): Promise<Coordinates | null> => {
    setLocating(true)
    setError(null)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setError(t('Chưa cho phép truy cập vị trí. Bật lại trong Cài đặt của máy hoặc nhập tay'))
        return null
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      return {
        lat: Number(position.coords.latitude.toFixed(COORDINATE_DECIMALS)),
        lng: Number(position.coords.longitude.toFixed(COORDINATE_DECIMALS)),
      }
    } catch {
      setError(t('Không lấy được vị trí. Bật GPS rồi thử lại hoặc nhập tay'))
      return null
    } finally {
      setLocating(false)
    }
  }

  return { locate, isLocating, error }
}
