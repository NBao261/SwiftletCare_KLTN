import { useRef, useState, type ComponentRef } from 'react'
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurTargetView } from 'expo-blur'
import { useQueryClient } from '@tanstack/react-query'
import { CameraCarousel } from '@/components/home/CameraCarousel'
import { FarmCarousel } from '@/components/home/FarmCarousel'
import { HomeHeader } from '@/components/home/HomeHeader'
import { HouseCarousel } from '@/components/home/HouseCarousel'
import { LiveCameraPlayer } from '@/components/home/LiveCameraPlayer'
import { NewReportCard } from '@/components/home/NewReportCard'
import { OverviewStats } from '@/components/home/OverviewStats'
import { PendingTasksCard } from '@/components/home/PendingTasksCard'
import { RelayOverrideStrip } from '@/components/home/RelayOverrideStrip'
import { UrgentAlertBanner } from '@/components/home/UrgentAlertBanner'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { StatusBarGlass } from '@/components/layout/StatusBarGlass'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { CameraCardData } from '@/hooks/device/useCameraCards'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { useZoneTelemetryStream } from '@/hooks/telemetry/useZoneTelemetryStream'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'
import { useLanguage } from '@/hooks/i18n/useLanguage'

// Vòng tải của Android cao khoảng 40 và nằm dưới vùng giờ/pin (progressViewOffset): chữ đặt ngay bên dưới
const ANDROID_REFRESH_LABEL_OFFSET = 56

/** Trang chủ – viết chung cho Farm Owner và Domain Expert (hiện chỉ tab của Farm Owner mở màn này); các khối xếp từ trên xuống */
export default function HomeScreen() {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()
  const user = useAuthStore(state => state.user)
  const canViewOwnerTasks = canPerform(user, 'viewOwnerTasks')
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { zoneById } = useZoneDirectory()
  // Số đo của mọi tầng cập nhật realtime qua socket (ENV-FR-005) cho các khối dùng số đo trên trang
  useZoneTelemetryStream([...zoneById.keys()])
  const [isRefreshing, setRefreshing] = useState(false)
  const [isScrolled, setScrolled] = useState(false)
  // Camera đang mở trong trình phát tại chỗ; null là đã đóng
  const [activeCamera, setActiveCamera] = useState<CameraCardData | null>(null)
  // Android chỉ làm nhoè được nội dung nằm trong BlurTargetView này
  const blurTargetRef = useRef<ComponentRef<typeof View>>(null)
  // Chỉ chừa phần thanh tab đè lên đáy màn (MOBILE_GUIDE 3.5); vùng an toàn dưới đã nằm trong thanh tab,
  // và khối nội dung đã có lề dưới Spacing.lg
  const bottomPadding = TAB_BAR_OVERLAP

  // Kéo đầu trang xuống: tải lại mọi query của các khối đang hiện trên màn (load lại cả trang)
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ type: 'active' })
    } finally {
      setRefreshing(false)
    }
  }

  // Rời đầu trang thì hiện đường kẻ dưới kính mờ vùng giờ/pin; React bỏ qua khi giá trị không đổi
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrolled(event.nativeEvent.contentOffset.y > 0)
  }

  return (
    <View key={language} style={styles.screen}>
      <BlurTargetView ref={blurTargetRef} style={[styles.screen, { backgroundColor: palette.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={palette.textSecondary}
              colors={[palette.text]}
              // iOS: chỉ khi đã kéo đủ và đang tải mới hiện chữ dưới vòng tải
              title={isRefreshing ? t('Đang tải lại') : undefined}
              titleColor={palette.textSecondary}
              // Android: vòng tải hiện ngay dưới vùng giờ/pin, không bị kính mờ che
              progressViewOffset={insets.top}
            />
          }
        >
          {/* Phần đầu trang (avatar, tên, icon) không ghim — cuộn đi cùng các khối bên dưới */}
          <HomeHeader />
          <View style={styles.content}>
            <FarmCarousel />
            <OverviewStats />
            <UrgentAlertBanner />
            {/* Việc chờ và báo cáo mới là của chủ trại; dải relay chuyên gia vẫn thấy nhưng không có nút */}
            {canViewOwnerTasks && <PendingTasksCard />}
            <RelayOverrideStrip />
            {canViewOwnerTasks && <NewReportCard />}
            <HouseCarousel />
            <CameraCarousel onOpen={setActiveCamera} />
            {/* Các khối tiếp theo thêm dần bên dưới, theo thứ tự từ trên xuống */}
          </View>
        </ScrollView>
      </BlurTargetView>
      <StatusBarGlass blurTarget={blurTargetRef} isScrolled={isScrolled} />
      {/* Android không có chữ dưới vòng tải: tự hiện "Đang tải lại" ngay dưới vòng tải khi đang tải */}
      {isRefreshing && Platform.OS === 'android' && (
        <View style={[styles.refreshLabel, { top: insets.top + ANDROID_REFRESH_LABEL_OFFSET }]} pointerEvents="none">
          <Text variant="small" color={palette.textSecondary}>
            {t('Đang tải lại')}
          </Text>
        </View>
      )}
      {/* Trình phát nằm ở gốc màn để cửa sổ nổi đè lên nội dung khi lướt; đổi camera thì dựng lại từ chế độ phóng to */}
      <LiveCameraPlayer
        key={activeCamera?.camera._id ?? 'closed'}
        card={activeCamera}
        onClose={() => setActiveCamera(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  refreshLabel: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
})
