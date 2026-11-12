import { useState } from 'react'
import {
  Alert as NativeAlert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Polygon, Polyline } from 'react-native-svg'
import { useEvent } from 'expo'
import { VideoView, type VideoPlayer } from 'expo-video'
import { ArrowUUpLeftIcon, EraserIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useUpdateCountingRing } from '@/hooks/device/useUpdateCountingRing'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CameraNode } from '@/types'
import {
  canAddRingPoint,
  getCountingRingErrorMessage,
  getVideoAspectRatio,
  isRingChanged,
  isRingComplete,
  RING_MAX_POINTS,
  RING_MIN_POINTS,
  type RingPoint,
  toRingPoint,
  toSvgPoints,
} from '@/utils/countingRing.utils'
import { formatTimeAgo } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

const POINT_RADIUS = 7
const RING_STROKE_WIDTH = 3

// Chim đi vào vòng là ra hay về (into_ring_is_exit); null khi camera chưa có vòng và người dùng chưa chọn
type RingDirection = 'exit' | 'entry'

interface CountingRingEditorProps {
  // Camera đang vẽ; null thì màn đóng. Mỗi lần mở, khung camera truyền key mới để bản nháp lấy lại vòng đang lưu
  camera: CameraNode | null
  // Cùng player với khung camera ở Màn B, để không phải kết nối lại
  player: VideoPlayer
  // Câu báo khi chưa có hình (camera mất kết nối, không mở được luồng…); vẫn chỉnh được vòng đang lưu
  videoMessage: string | null
  onClose: () => void
}

// Trình vẽ vòng đếm trên khung hình live (VISION-FR-018): chạm quanh miệng lỗ ra vào để đặt 3–12 đỉnh theo thứ tự quanh vòng,
// chọn chiều ra/vào, lưu. Toạ độ theo tỉ lệ khung hình 0–1; khung vẽ có đúng tỉ lệ của luồng nên video lấp kín khung, điểm chạm
// khớp với hình. Đổi vòng thì số đếm trước và sau không so được với nhau (api-spec), nên màn nói rõ điều đó
export function CountingRingEditor({ camera, player, videoMessage, onClose }: CountingRingEditorProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const updateRing = useUpdateCountingRing()
  const savedRing = camera?.counting_ring ?? null
  const [points, setPoints] = useState<RingPoint[]>(savedRing?.points ?? [])
  const [direction, setDirection] = useState<RingDirection | null>(
    savedRing ? (savedRing.into_ring_is_exit ? 'exit' : 'entry') : null,
  )
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const { videoTrack } = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack })
  const frameWidth = windowWidth
  const frameHeight = frameWidth / getVideoAspectRatio(videoTrack?.size)
  const intoRingIsExit = direction === null ? null : direction === 'exit'
  const isChanged = isRingChanged(savedRing, points, intoRingIsExit)
  const canSave = isRingComplete(points) && direction !== null && isChanged

  const addPoint = (event: GestureResponderEvent) => {
    if (!canAddRingPoint(points)) return
    const { locationX, locationY } = event.nativeEvent
    setSavedMessage(null)
    setPoints(current => [...current, toRingPoint(locationX, locationY, frameWidth, frameHeight)])
  }

  const removeLastPoint = () => {
    setSavedMessage(null)
    setPoints(current => current.slice(0, -1))
  }

  const clearPoints = () => {
    setSavedMessage(null)
    setPoints([])
  }

  const save = () => {
    if (!camera || direction === null || !canSave) return
    updateRing.mutate(
      { cameraId: camera._id, ring: { points, into_ring_is_exit: direction === 'exit' } },
      {
        onSuccess: result =>
          setSavedMessage(
            result.ring_delivered === false
              ? t('Đã lưu vòng đếm. Máy đếm chim sẽ nhận vòng khi kết nối lại')
              : t('Đã lưu vòng đếm, máy đếm chim đã nhận vòng mới'),
          ),
      },
    )
  }

  // Còn thay đổi chưa lưu thì hỏi trước khi bỏ
  const requestClose = () => {
    if (!isChanged || savedMessage) {
      onClose()
      return
    }
    NativeAlert.alert(t('Bỏ vòng đang vẽ?'), t('Các điểm vừa đặt chưa được lưu.'), [
      { text: t('Vẽ tiếp'), style: 'cancel' },
      { text: t('Bỏ'), style: 'destructive', onPress: onClose },
    ])
  }

  const svgPoints = toSvgPoints(points, frameWidth, frameHeight)
  const updatedAt = savedRing?.updated_at

  return (
    <Modal visible={camera !== null} animationType="slide" statusBarTranslucent onRequestClose={requestClose}>
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <AppHeader title={t('Vẽ vòng đếm')} onBack={requestClose} />
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: frameWidth, height: frameHeight, backgroundColor: palette.inverse }}>
            {videoMessage ? (
              <View style={styles.center} pointerEvents="none">
                <Text variant="small" color={palette.onInverse} center>
                  {videoMessage}
                </Text>
              </View>
            ) : (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="fill"
                nativeControls={false}
                pointerEvents="none"
              />
            )}
            <Svg width={frameWidth} height={frameHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
              {points.length >= RING_MIN_POINTS ? (
                <Polygon points={svgPoints} fill="none" stroke={palette.primary} strokeWidth={RING_STROKE_WIDTH} />
              ) : (
                <Polyline points={svgPoints} fill="none" stroke={palette.primary} strokeWidth={RING_STROKE_WIDTH} />
              )}
              {points.map(([x, y], index) => (
                <Circle
                  key={`${index}-${x}-${y}`}
                  cx={x * frameWidth}
                  cy={y * frameHeight}
                  r={POINT_RADIUS}
                  fill={palette.primary}
                  stroke={palette.inverse}
                  strokeWidth={2}
                />
              ))}
            </Svg>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={addPoint}
              accessibilityRole="button"
              accessibilityLabel={t('Khung hình camera: chạm để thêm một điểm của vòng')}
            />
          </View>

          <View style={styles.content}>
            <Text variant="small" color={palette.textSecondary}>
              {t('Chạm quanh miệng lỗ ra vào để đặt từ 3 đến 12 điểm, lần lượt theo vòng.')}
            </Text>
            <View style={[styles.card, { backgroundColor: palette.surface }]}>
              <View style={styles.row}>
                <Text variant="body" weight="semiBold" style={styles.flex}>
                  {t('{count}/{max} điểm', { count: points.length, max: RING_MAX_POINTS })}
                </Text>
                <Button
                  label={t('Bỏ điểm cuối')}
                  variant="link"
                  trailingIcon={ArrowUUpLeftIcon}
                  disabled={points.length === 0}
                  onPress={removeLastPoint}
                />
                <Button
                  label={t('Vẽ lại')}
                  variant="link"
                  trailingIcon={EraserIcon}
                  disabled={points.length === 0}
                  onPress={clearPoints}
                />
              </View>
              <Text variant="small" color={palette.textSecondary}>
                {t('Chim đi vào trong vòng là')}
              </Text>
              <ChoiceChips
                options={[
                  { id: 'exit', label: t('Bay ra ngoài') },
                  { id: 'entry', label: t('Bay về tổ') },
                ]}
                selectedId={direction}
                onSelect={value => {
                  setSavedMessage(null)
                  setDirection(value)
                }}
                placement="card"
                accessibilityLabel={t('Chiều của vòng đếm')}
              />
            </View>
            <Text variant="small" color={palette.textSecondary}>
              {updatedAt
                ? t('Vòng đang dùng cập nhật {time}', { time: formatTimeAgo(updatedAt) })
                : t('Camera chưa có vòng riêng, máy đếm chim đang dùng vòng mặc định')}
            </Text>
            <Text variant="small" color={palette.textSecondary}>
              {t('Đổi vòng thì số đếm trước và sau khi đổi không so sánh được với nhau.')}
            </Text>
            <FormMessage message={updateRing.error ? getCountingRingErrorMessage(updateRing.error) : null} />
            <FormMessage tone="success" message={savedMessage} />
            <Button label={t('Lưu vòng đếm')} onPress={save} disabled={!canSave} loading={updateRing.isPending} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  content: { padding: Spacing.lg, gap: Spacing.md },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
})
