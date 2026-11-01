import { useState } from 'react'
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native'
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertDetailContent } from '@/components/alert/AlertDetailContent'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import type { Alert } from '@/types'
import { t } from '@/utils/i18n.utils'

// Kéo xuống quá khoảng này, hoặc vuốt nhanh, thì đóng sheet
const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 800
const HANDLE_WIDTH = 40
const HANDLE_HEIGHT = 4
const CLOCK_INTERVAL_MS = 60 * 1000
const SPRING_BACK = { duration: 200, reduceMotion: ReduceMotion.System }

interface AlertDetailSheetProps {
  // Hàng đang mở; null là sheet đóng
  alert: Alert | null
  onClose: () => void
}

// Chi tiết cảnh báo dạng sheet toàn màn (đặc tả §3): kéo thanh trên cùng xuống để đóng, đóng xong danh sách vẫn ở đúng
// chỗ đang xem vì sheet nằm trên danh sách. Bằng chứng chỉ tải sau khi sheet mở xong
export function AlertDetailSheet({ alert, onClose }: AlertDetailSheetProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const now = useNow(CLOCK_INTERVAL_MS)
  const toast = useToastMessage()
  const translateY = useSharedValue(0)
  const [isReady, setReady] = useState(false)

  const close = () => {
    setReady(false)
    onClose()
  }

  const pan = usePanGesture({
    onUpdate: event => {
      'worklet'
      // Chỉ kéo xuống, không kéo lên quá mép
      translateY.set(Math.max(0, event.translationY))
    },
    onDeactivate: event => {
      'worklet'
      if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) {
        translateY.set(withTiming(height, SPRING_BACK, () => scheduleOnRN(close)))
        return
      }
      translateY.set(withTiming(0, SPRING_BACK))
    },
  })

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }))

  return (
    <Modal
      visible={alert !== null}
      animationType="slide"
      transparent
      statusBarTranslucent
      onShow={() => {
        translateY.set(0)
        setReady(true)
      }}
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: palette.background, marginTop: insets.top + Spacing.sm, paddingBottom: insets.bottom },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.handleArea} accessibilityRole="button" accessibilityLabel={t('Kéo xuống để đóng')}>
              <View style={[styles.handle, { backgroundColor: palette.border }]} />
            </View>
          </GestureDetector>
          {alert && (
            <AlertDetailContent
              key={alert._id}
              alertId={alert._id}
              initialAlert={alert}
              isReady={isReady}
              now={now}
              onLeave={close}
              onMessage={toast.show}
            />
          )}
          {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.xxl * 2} />}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: { flex: 1, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, overflow: 'hidden' },
  handleArea: { alignItems: 'center', paddingVertical: Spacing.md },
  handle: { width: HANDLE_WIDTH, height: HANDLE_HEIGHT, borderRadius: Radius.full },
})
