import { useMemo, useState } from 'react'
import { Alert as NativeAlert, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, G, Polygon, Text as SvgText } from 'react-native-svg'
import { useEvent } from 'expo'
import { VideoView, type VideoPlayer } from 'expo-video'
import { PlusIcon, TrashIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useUpdateCountingRing } from '@/hooks/device/useUpdateCountingRing'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CameraNode, CountingRing } from '@/types'
import {
  areRingsComplete,
  createSquareRing,
  findNearestVertex,
  findRingAt,
  getCountingRingErrorMessage,
  getRingCenter,
  getVideoAspectRatio,
  isRingListChanged,
  moveRingVertex,
  pickFreeRingCenter,
  removeRingAt,
  RING_MAX_COUNT,
  ringsOfCamera,
  type RingVertexRef,
  toRingPoint,
  toSvgPoints,
} from '@/utils/countingRing.utils'
import { formatTimeAgo } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

// Góc kéo được: chấm to dễ bắt bằng ngón tay, vùng bắt rộng hơn chấm
const HANDLE_RADIUS = 10
const ACTIVE_HANDLE_RADIUS = 13
const TOUCH_RADIUS = 32
const ACTIVE_STROKE_WIDTH = 3
const OTHER_STROKE_WIDTH = 2
const LABEL_FONT_SIZE = 14
const DEFAULT_RING_DASH = '6 4'

interface CountingRingEditorProps {
  // Camera đang vẽ; null thì màn đóng. Mỗi lần mở, khung camera truyền key mới để bản nháp lấy lại vòng đang lưu
  camera: CameraNode | null
  // Cùng player với khung camera ở Màn B, để không phải kết nối lại
  player: VideoPlayer
  // Câu báo khi chưa có hình (camera mất kết nối, không mở được luồng…); vẫn chỉnh được vòng đang lưu
  videoMessage: string | null
  // Chủ trại trên farm có chuyên gia: dòng "chuyên gia sẽ xem lại" (BR-22 nhóm A); null thì không hiện
  reviewNote: string | null
  onClose: () => void
}

// Trình vẽ vòng đếm trên khung hình live (VISION-FR-018): mỗi vòng là một khung vuông có sẵn, kéo 4 góc cho ôm sát miệng lỗ ra
// vào. Tối đa 4 vòng, mỗi vòng có chiều riêng — vòng chim ra (chim bay vào vòng là ra khỏi nhà) nét lime, vòng chim về nét xanh —
// và kéo độc lập với nhau. Chạm vào một khung để chọn; vòng đang chọn có góc to hơn. Camera chưa có vòng riêng thì mở sẵn một
// khung vuông; vòng mặc định của camera đếm chim hiện nét đứt để tham khảo
export function CountingRingEditor({ camera, player, videoMessage, reviewNote, onClose }: CountingRingEditorProps) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const updateRing = useUpdateCountingRing()
  const { videoTrack } = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack })
  const frameWidth = windowWidth
  const aspectRatio = getVideoAspectRatio(videoTrack?.size)
  const frameHeight = frameWidth / aspectRatio
  const savedRings = useMemo(() => (camera ? ringsOfCamera(camera) : []), [camera])
  const defaultRings = camera?.default_rings ?? []
  // Chưa có vòng riêng thì mở sẵn một khung vuông, chiều theo vòng mặc định của camera (không có thì vòng chim ra)
  const [rings, setRings] = useState<CountingRing[]>(() =>
    savedRings.length > 0
      ? savedRings
      : [createSquareRing(pickFreeRingCenter([]), aspectRatio, defaultRings[0]?.into_ring_is_exit ?? true)],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  // Người dùng đã chạm vào bản nháp chưa: chỉ hỏi "bỏ thay đổi" khi đã chỉnh, không hỏi khi chỉ mở ra xem
  const [isTouched, setTouched] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  // Góc đang được kéo; null khi không kéo
  const [dragVertex, setDragVertex] = useState<RingVertexRef | null>(null)
  const isChanged = isRingListChanged(savedRings, rings)
  const canSave = isChanged && areRingsComplete(rings)
  const activeRing = rings[activeIndex] ?? null
  const ringColor = (ring: CountingRing) => (ring.into_ring_is_exit ? palette.primary : palette.statusNew)

  // Mọi thay đổi bản nháp đi qua đây: bỏ câu "đã lưu" cũ, ghi là đã chỉnh
  const editRings = (next: CountingRing[], nextActiveIndex = activeIndex) => {
    setSavedMessage(null)
    setTouched(true)
    setRings(next)
    setActiveIndex(nextActiveIndex)
  }

  // Kéo góc: bắt góc gần chỗ chạm nhất trong bán kính chạm; chạm giữa một khung thì chọn khung đó. Callback chạy trên luồng JS
  // (runOnJS) nên đọc thẳng bản nháp hiện tại. Lần cập nhật đầu có thể tới trước khi góc vừa bắt kịp vào state, nên tìm lại góc
  // ở điểm bắt đầu kéo
  const frame = { width: frameWidth, height: frameHeight }
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: event => {
      const vertex = findNearestVertex(rings, { x: event.x, y: event.y }, frame, TOUCH_RADIUS, activeIndex)
      if (vertex) {
        setDragVertex(vertex)
        setActiveIndex(vertex.ringIndex)
        return
      }
      const touched = findRingAt(rings, toRingPoint(event.x, event.y, frameWidth, frameHeight))
      if (touched !== -1) setActiveIndex(touched)
    },
    onUpdate: event => {
      const start = { x: event.x - event.translationX, y: event.y - event.translationY }
      const vertex = dragVertex ?? findNearestVertex(rings, start, frame, TOUCH_RADIUS, activeIndex)
      if (!vertex) return
      setSavedMessage(null)
      setTouched(true)
      setRings(previous => moveRingVertex(previous, vertex, toRingPoint(event.x, event.y, frameWidth, frameHeight)))
    },
    onFinalize: () => setDragVertex(null),
  })

  // Thêm một khung vuông ở chỗ còn trống, chiều do người dùng chọn
  const addRing = (intoRingIsExit: boolean) =>
    editRings([...rings, createSquareRing(pickFreeRingCenter(rings), aspectRatio, intoRingIsExit)], rings.length)

  const setActiveDirection = (intoRingIsExit: boolean) =>
    editRings(rings.map((ring, index) => (index === activeIndex ? { ...ring, into_ring_is_exit: intoRingIsExit } : ring)))

  const removeActiveRing = () => {
    const result = removeRingAt(rings, activeIndex)
    editRings(result.rings, result.activeIndex)
  }

  const save = () => {
    if (!camera || !canSave) return
    updateRing.mutate(
      { cameraId: camera._id, rings },
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

  // Xoá mọi vòng đã vẽ: camera đếm chim dùng lại vòng mặc định của nó
  const confirmUseDefault = () => {
    if (!camera) return
    NativeAlert.alert(
      t('Dùng lại vòng mặc định?'),
      t('Các vòng đã vẽ sẽ bị xoá, camera đếm chim đếm theo vòng mặc định của nó.'),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Dùng vòng mặc định'),
          style: 'destructive',
          onPress: () =>
            updateRing.mutate(
              { cameraId: camera._id, rings: [] },
              {
                onSuccess: () => {
                  setRings([])
                  setActiveIndex(0)
                  setTouched(false)
                  setSavedMessage(t('Đã xoá các vòng đã vẽ, camera đếm chim dùng lại vòng mặc định'))
                },
              },
            ),
        },
      ],
    )
  }

  // Đã chỉnh mà chưa lưu thì hỏi trước khi bỏ
  const requestClose = () => {
    if (!isTouched || !isChanged || savedMessage) {
      onClose()
      return
    }
    NativeAlert.alert(t('Bỏ vòng đang vẽ?'), t('Các thay đổi chưa được lưu.'), [
      { text: t('Vẽ tiếp'), style: 'cancel' },
      { text: t('Bỏ'), style: 'destructive', onPress: onClose },
    ])
  }

  // Một vòng trên khung: nét theo chiều, vòng đang chọn nét dày và góc to; số thứ tự ở giữa khung
  const renderRing = (ring: CountingRing, index: number) => {
    const isActive = index === activeIndex
    const color = ringColor(ring)
    const [centerX, centerY] = getRingCenter(ring.points)
    return (
      <G key={`ring-${index}`}>
        <Polygon
          points={toSvgPoints(ring.points, frameWidth, frameHeight)}
          fill="none"
          stroke={color}
          strokeWidth={isActive ? ACTIVE_STROKE_WIDTH : OTHER_STROKE_WIDTH}
        />
        {ring.points.map(([x, y], pointIndex) => (
          <Circle
            key={`${index}-${pointIndex}`}
            cx={x * frameWidth}
            cy={y * frameHeight}
            r={isActive ? ACTIVE_HANDLE_RADIUS : HANDLE_RADIUS}
            fill={color}
            stroke={palette.inverse}
            strokeWidth={2}
          />
        ))}
        <SvgText
          x={centerX * frameWidth}
          y={centerY * frameHeight}
          fill={color}
          fontSize={LABEL_FONT_SIZE}
          fontWeight="bold"
          textAnchor="middle"
        >
          {index + 1}
        </SvgText>
      </G>
    )
  }

  const updatedAt = camera?.counting_ring?.updated_at
  const getRingLabel = (ring: CountingRing, index: number) =>
    ring.into_ring_is_exit ? t('Vòng {n} · Chim ra', { n: index + 1 }) : t('Vòng {n} · Chim về', { n: index + 1 })

  return (
    <Modal visible={camera !== null} animationType="slide" statusBarTranslucent onRequestClose={requestClose}>
      {/* Modal là cây giao diện riêng: cử chỉ kéo góc chỉ chạy khi có GestureHandlerRootView trong đó */}
      <GestureHandlerRootView style={[styles.screen, { backgroundColor: palette.background }]}>
        <AppHeader title={t('Vẽ vòng đếm của camera')} onBack={requestClose} />
        {/* Khung hình nằm ngoài vùng cuộn: kéo góc không làm cuộn trang, cuộn xuống phần nút vẫn thấy khung */}
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
            {savedRings.length === 0 &&
              defaultRings.map((ring, index) => (
                <Polygon
                  key={`default-${index}`}
                  points={toSvgPoints(ring.points, frameWidth, frameHeight)}
                  fill="none"
                  stroke={palette.onInverseSecondary}
                  strokeWidth={OTHER_STROKE_WIDTH}
                  strokeDasharray={DEFAULT_RING_DASH}
                />
              ))}
            {rings.map(renderRing)}
          </Svg>
          <GestureDetector gesture={pan}>
            <View
              style={StyleSheet.absoluteFill}
              accessible
              accessibilityLabel={t('Khung hình camera: kéo các góc của khung để chỉnh vòng đếm')}
            />
          </GestureDetector>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text variant="small" color={palette.textSecondary}>
              {t('Kéo 4 góc của khung cho ôm sát miệng lỗ ra vào. Chạm vào một khung để chọn. Tối đa {max} vòng.', {
                max: RING_MAX_COUNT,
              })}
            </Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: palette.primary }]} />
                <Text variant="small" color={palette.textSecondary} style={styles.flex}>
                  {t('Vòng chim ra: chim bay vào vòng là ra khỏi nhà')}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: palette.statusNew }]} />
                <Text variant="small" color={palette.textSecondary} style={styles.flex}>
                  {t('Vòng chim về: chim bay vào vòng là về tổ')}
                </Text>
              </View>
              {savedRings.length === 0 && defaultRings.length > 0 && (
                <Text variant="small" color={palette.textSecondary}>
                  {t('Nét đứt là vòng mặc định camera đếm chim đang dùng, chỉ để tham khảo.')}
                </Text>
              )}
            </View>
            <View style={[styles.card, { backgroundColor: palette.surface }]}>
              {rings.length > 0 ? (
                <ChoiceChips
                  options={rings.map((ring, index) => ({ id: String(index), label: getRingLabel(ring, index) }))}
                  selectedId={String(activeIndex)}
                  onSelect={id => setActiveIndex(Number(id))}
                  placement="card"
                  accessibilityLabel={t('Chọn vòng để sửa')}
                />
              ) : (
                <Text variant="body" weight="semiBold">
                  {t('Chưa có vòng nào')}
                </Text>
              )}
              {activeRing && (
                <>
                  <Text variant="small" color={palette.textSecondary}>
                    {t('Vòng {n} đếm', { n: activeIndex + 1 })}
                  </Text>
                  <ChoiceChips
                    options={[
                      { id: 'exit', label: t('Chim ra') },
                      { id: 'entry', label: t('Chim về') },
                    ]}
                    selectedId={activeRing.into_ring_is_exit ? 'exit' : 'entry'}
                    onSelect={value => setActiveDirection(value === 'exit')}
                    placement="card"
                    accessibilityLabel={t('Chiều của vòng đang chọn')}
                  />
                  <Button
                    label={t('Bỏ vòng này')}
                    variant="link"
                    color={palette.alert}
                    trailingIcon={TrashIcon}
                    onPress={removeActiveRing}
                    style={styles.start}
                  />
                </>
              )}
              <View style={styles.addRow}>
                <Button
                  label={t('Vòng chim ra')}
                  variant="outline"
                  size="sm"
                  trailingIcon={PlusIcon}
                  disabled={rings.length >= RING_MAX_COUNT}
                  onPress={() => addRing(true)}
                  style={styles.flex}
                />
                <Button
                  label={t('Vòng chim về')}
                  variant="outline"
                  size="sm"
                  trailingIcon={PlusIcon}
                  disabled={rings.length >= RING_MAX_COUNT}
                  onPress={() => addRing(false)}
                  style={styles.flex}
                />
              </View>
            </View>
            <Text variant="small" color={palette.textSecondary}>
              {savedRings.length === 0
                ? t('Camera chưa có vòng riêng, máy đếm chim đang dùng vòng mặc định')
                : updatedAt
                  ? t('Camera đang dùng {count} vòng đã vẽ, cập nhật {time}', {
                      count: savedRings.length,
                      time: formatTimeAgo(updatedAt),
                    })
                  : t('Camera đang dùng {count} vòng đã vẽ', { count: savedRings.length })}
            </Text>
            <Text variant="small" color={palette.textSecondary}>
              {t('Đổi vòng thì số đếm trước và sau khi đổi không so sánh được với nhau.')}
            </Text>
            {reviewNote && (
              <Text variant="small" color={palette.textSecondary}>
                {reviewNote}
              </Text>
            )}
            <FormMessage message={updateRing.error ? getCountingRingErrorMessage(updateRing.error) : null} />
            <FormMessage tone="success" message={savedMessage} />
            <Button label={t('Lưu vòng đếm')} onPress={save} disabled={!canSave} loading={updateRing.isPending} />
            {savedRings.length > 0 && (
              <Button
                label={t('Dùng lại vòng mặc định')}
                variant="link"
                onPress={confirmUseDefault}
                disabled={updateRing.isPending}
                style={styles.centerButton}
              />
            )}
          </View>
        </ScrollView>
      </GestureHandlerRootView>
    </Modal>
  )
}

const SWATCH_SIZE = 12

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
  legend: { gap: Spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  swatch: { width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: Radius.full },
  addRow: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  start: { alignSelf: 'flex-start' },
  centerButton: { alignSelf: 'center' },
})
