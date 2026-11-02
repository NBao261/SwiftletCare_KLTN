import { StyleSheet, View } from 'react-native'
import { PlayIcon, VideoCameraIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import type { CameraCardData } from '@/hooks/device/useCameraCards'
import { usePalette } from '@/hooks/theme/usePalette'
import { getCameraCountSummary, getCameraStatusBadge } from '@/utils/camera.utils'
import { truncateText } from '@/utils/name.utils'
import { t } from '@/utils/i18n.utils'

export const CAMERA_CARD_WIDTH = 280
const PREVIEW_ASPECT_RATIO = 16 / 9
const PLAY_BUTTON_SIZE = 40
const STATUS_DOT_SIZE = 6
// Tên nhà trên nhãn góc phải tối đa 10 ký tự, dài hơn thì cắt và thêm "…"
const HOUSE_NAME_MAX_LENGTH = 10

interface CameraCardProps {
  data: CameraCardData
  onOpen: (data: CameraCardData) => void
}

// Thẻ một camera AI: khung xem trước 16:9 (nhãn trạng thái, tên nhà) + tên camera, số đếm hôm nay, nút phát
export function CameraCard({ data, onOpen }: CameraCardProps) {
  const palette = usePalette()
  const { camera, houseName, today } = data
  const title = `Camera ${camera.device_id}`
  const summary = getCameraCountSummary(today)
  const statusBadge = getCameraStatusBadge(camera.status)
  // Chấm trạng thái theo màu thiết bị có sẵn: lime khi online, xám khi mất kết nối, cam nhạt khi chờ kết nối
  const statusDotColor = {
    ONLINE: palette.primary,
    OFFLINE: palette.deviceOffline,
    PENDING: palette.devicePending,
  }[camera.status]

  return (
    <Card
      style={styles.card}
      onPress={() => onOpen(data)}
      accessibilityLabel={t('{title}, {house}, {status}, {summary}. Bấm để xem trực tiếp', { title, house: houseName, status: statusBadge, summary })}
    >
      {/* Chưa có API ảnh chụp: khung tối giữ chỗ, video chỉ mở khi bấm */}
      <View style={[styles.preview, { backgroundColor: palette.inverse }]}>
        <VideoCameraIcon size={32} color={palette.onInverseSecondary} />
        <View style={[styles.badge, styles.statusBadge, { backgroundColor: palette.surface }]}>
          <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
          <Text variant="label" weight="bold">
            {statusBadge}
          </Text>
        </View>
        <View style={[styles.badge, styles.houseBadge, { backgroundColor: palette.surface }]}>
          <Text variant="label" weight="bold" numberOfLines={1}>
            {truncateText(houseName, HOUSE_NAME_MAX_LENGTH)}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.texts}>
          <Text variant="body" weight="semiBold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <View style={[styles.playButton, { backgroundColor: palette.primary }]}>
          <PlayIcon size={16} color={palette.onPrimary} weight="fill" />
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  // Không lề, không khoảng cách: khung xem trước 16:9 nằm sát mép trên của card
  card: { width: CAMERA_CARD_WIDTH, padding: 0, gap: 0, overflow: 'hidden' },
  preview: { aspectRatio: PREVIEW_ASPECT_RATIO, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  statusBadge: { left: Spacing.sm },
  houseBadge: { right: Spacing.sm },
  statusDot: { width: STATUS_DOT_SIZE, height: STATUS_DOT_SIZE, borderRadius: Radius.full },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  texts: { flex: 1, minWidth: 0, gap: Spacing.xs },
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
