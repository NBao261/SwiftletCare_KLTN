import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { AddDeviceSheet, type AddDeviceTarget } from '@/components/farm/settings/AddDeviceSheet'
import { BirdCountTuningSection } from '@/components/farm/settings/BirdCountTuningSection'
import { CreateItemSheet } from '@/components/farm/settings/CreateItemSheet'
import { DetectionTuningSection } from '@/components/farm/settings/DetectionTuningSection'
import { DeviceListSection } from '@/components/farm/settings/DeviceListSection'
import { FuzzyTuningSection } from '@/components/farm/settings/FuzzyTuningSection'
import { HouseInfoSection } from '@/components/farm/settings/HouseInfoSection'
import { ThresholdSection } from '@/components/farm/settings/ThresholdSection'
import { ZoneInfoSection } from '@/components/farm/settings/ZoneInfoSection'
import { ZoneSettingsTabs } from '@/components/farm/settings/ZoneSettingsTabs'
import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Spacing } from '@/constants/theme'
import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useCreateZone } from '@/hooks/farm/useCreateZone'
import { useHouseZones } from '@/hooks/farm/useHouseZones'
import { useSingleSectionEdit } from '@/hooks/farm/useSingleSectionEdit'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import {
  getSettingsSectionId,
  parseSettingsSectionKind,
  SETTINGS_SECTION_EDIT_ACTION,
} from '@/utils/settingsSection.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_SKELETON_HEIGHT = 76
const SKELETON_COUNT = 4

/** Cài đặt một nhà yến: thông tin nhà, camera AI, mức giảm tỷ lệ về tổ, rồi từng tầng (ngưỡng, hệ số mờ, tham số phát hiện,
 * controller). Mỗi mục sửa và lưu riêng, mỗi lúc một mục (FARM-FR-002/003/004, ENV-FR-006/020/021, EXPERT-FR-008) */
export default function HouseSettingsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{ houseId: string; section?: string; zoneId?: string; edit?: string }>()
  const houseId = params.houseId
  const user = useAuthStore(state => state.user)
  // Mở từ nút ⋮ "Chỉnh sửa" ở chi tiết nhà: mục đó sổ sẵn, có quyền thì mở sẵn chế độ sửa
  const targetKind = parseSettingsSectionKind(params.section)
  const targetSectionId = targetKind ? getSettingsSectionId(targetKind, params.zoneId) : null
  const editor = useSingleSectionEdit(
    targetKind && targetSectionId
      ? {
          sectionId: targetSectionId,
          isEditing: params.edit === '1' && canPerform(user, SETTINGS_SECTION_EDIT_ACTION[targetKind]),
        }
      : null,
  )
  const scrollRef = useRef<ScrollViewInstance>(null)
  // Vị trí của mục cần mở trong vùng cuộn: mục theo tầng nằm trong khối tầng nên cộng vị trí khối
  const focusLayout = useRef({ groupY: 0, sectionY: null as number | null, isUserScrolled: false })
  const toast = useToastMessage()
  const housesQuery = useAllHouses()
  const house = housesQuery.houses.find(item => item._id === houseId) ?? null
  const zonesQuery = useHouseZones(houseId)
  const zones = zonesQuery.data ?? []
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(params.zoneId ?? null)
  const zone = zones.find(item => item._id === selectedZoneId) ?? zones[0] ?? null
  const cameraNodesQuery = useCameraNodes()
  const sensorNodesQuery = useSensorNodes()
  const cameras = (cameraNodesQuery.data?.data ?? []).filter(camera => camera.house_id === houseId)
  const controllers = (sensorNodesQuery.data?.data ?? []).filter(node => node.zone_id === zone?._id)
  const createZone = useCreateZone()
  const [deviceTarget, setDeviceTarget] = useState<AddDeviceTarget | null>(null)
  // Mỗi lần mở sheet một key mới để sheet bắt đầu trống (không giữ mã kích hoạt của lần trước)
  const [sheetKey, setSheetKey] = useState(0)
  const [isZoneSheetOpen, setZoneSheetOpen] = useState(false)

  const canRegisterCamera = canPerform(user, 'registerCamera')
  const canRegisterController = canPerform(user, 'setupDevice')
  const canCreateZone = canPerform(user, 'createZone')

  // Đổi tầng khi đang sửa dở thì hỏi bỏ thay đổi trước
  const selectZone = (zoneId: string) =>
    editor.confirmDiscard(() => {
      editor.finishEditing()
      setSelectedZoneId(zoneId)
    })

  const openDeviceSheet = (target: AddDeviceTarget) => {
    setSheetKey(key => key + 1)
    setDeviceTarget(target)
  }

  const openZoneSheet = () => {
    setSheetKey(key => key + 1)
    setZoneSheetOpen(true)
  }

  const retry = () => queryClient.refetchQueries({ type: 'active' })

  // Cuộn tới mục được mở; các khối phía trên tải xong làm mục dời xuống thì cuộn lại, tới khi người dùng tự cuộn
  const scrollToTarget = () => {
    const layout = focusLayout.current
    if (layout.isUserScrolled || layout.sectionY === null) return
    const isZoneSection = targetKind !== 'bird-count'
    const y = (isZoneSection ? layout.groupY : 0) + layout.sectionY - Spacing.sm
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true })
  }

  // Khung của một mục báo vị trí; chỉ mục được mở mới dùng tới
  const handleSectionLayout = (sectionId: string, event: LayoutChangeEvent) => {
    if (sectionId !== targetSectionId) return
    focusLayout.current.sectionY = event.nativeEvent.layout.y
    scrollToTarget()
  }

  if (!house) {
    return (
      <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
        <AppHeader title={t('Cài đặt nhà')} onBack={() => router.back()} />
        <View style={styles.content}>
          {housesQuery.isLoading ? (
            Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <Skeleton key={index} width="100%" height={SECTION_SKELETON_HEIGHT} delayMs={index * 75} />
            ))
          ) : (
            <EmptyState
              message={housesQuery.isError ? t('Không tải được') : t('Không tìm thấy nhà yến')}
              actionLabel={housesQuery.isError ? t('Thử lại') : undefined}
              onAction={housesQuery.isError ? retry : undefined}
            />
          )}
        </View>
      </View>
    )
  }

  const renderZoneSections = () => {
    if (zonesQuery.isLoading) return <Skeleton width="100%" height={SECTION_SKELETON_HEIGHT} />
    if (zonesQuery.isError) {
      return <EmptyState message={t('Không tải được danh sách tầng')} actionLabel={t('Thử lại')} onAction={retry} />
    }
    if (!zone) {
      return (
        <EmptyState
          message={t('Nhà chưa có tầng')}
          actionLabel={canCreateZone ? t('Thêm tầng') : undefined}
          onAction={canCreateZone ? openZoneSheet : undefined}
        />
      )
    }
    return (
      // key = zone: đổi tầng thì các mục dựng lại, không mang bản nháp của tầng trước
      <View
        key={zone._id}
        style={styles.group}
        onLayout={event => {
          focusLayout.current.groupY = event.nativeEvent.layout.y
          scrollToTarget()
        }}
      >
        <ZoneInfoSection zone={zone} editor={editor} />
        <View onLayout={event => handleSectionLayout(getSettingsSectionId('thresholds', zone._id), event)}>
          <ThresholdSection zone={zone} editor={editor} onSaved={toast.show} />
        </View>
        <View onLayout={event => handleSectionLayout(getSettingsSectionId('fuzzy', zone._id), event)}>
          <FuzzyTuningSection zone={zone} editor={editor} onSaved={toast.show} />
        </View>
        <View onLayout={event => handleSectionLayout(getSettingsSectionId('detection', zone._id), event)}>
          <DetectionTuningSection zone={zone} editor={editor} onSaved={toast.show} />
        </View>
        <DeviceListSection
          id={`controllers:${zone._id}`}
          kind="controller"
          devices={controllers}
          scopeLabel={zone.name}
          editor={editor}
          onAdd={
            canRegisterController
              ? () => openDeviceSheet({ kind: 'controller', zoneId: zone._id, name: zone.name })
              : undefined
          }
        />
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        <AppHeader title={t('Cài đặt nhà')} onBack={() => router.back()} />
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => {
              focusLayout.current.isUserScrolled = true
            }}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          >
            <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.groupLabel}>
              {house.name}
            </Text>
            <HouseInfoSection house={house} zones={zones} editor={editor} />
            <DeviceListSection
              id="cameras"
              kind="camera"
              devices={cameras}
              scopeLabel={t('Nhà')}
              editor={editor}
              onAdd={
                canRegisterCamera
                  ? () => openDeviceSheet({ kind: 'camera', houseId: house._id, name: house.name })
                  : undefined
              }
            />
            <View onLayout={event => handleSectionLayout(getSettingsSectionId('bird-count'), event)}>
              <BirdCountTuningSection house={house} editor={editor} onSaved={toast.show} />
            </View>

            <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.groupLabel}>
              {t('Theo tầng')}
            </Text>
            {zones.length > 0 && (
              <ZoneSettingsTabs
                zones={zones}
                selectedZoneId={zone?._id ?? null}
                onSelect={selectZone}
                onAdd={canCreateZone ? openZoneSheet : undefined}
              />
            )}
            {renderZoneSections()}
          </ScrollView>
        </KeyboardAvoidingView>

        <AddDeviceSheet
          key={`device-${sheetKey}`}
          target={deviceTarget}
          onClose={() => setDeviceTarget(null)}
          onRegistered={message => {
            setDeviceTarget(null)
            toast.show(message)
          }}
        />
        <CreateItemSheet
          key={`zone-${sheetKey}`}
          visible={isZoneSheetOpen}
          title={t('Thêm tầng')}
          scopeLabel={house.name}
          nameLabel={t('Tên tầng')}
          numberLabel={t('Tầng số')}
          submit={async (name, floor) => {
            const created = await createZone.mutateAsync({ houseId: house._id, payload: { name, floor } })
            setSelectedZoneId(created._id)
          }}
          onCreated={() => {
            setZoneSheetOpen(false)
            toast.show(t('Đã thêm tầng'))
          }}
          onClose={() => setZoneSheetOpen(false)}
        />
      </View>
      {/* Toast nằm ngoài phần dựng lại theo ngôn ngữ để không mất khi đổi ngôn ngữ */}
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.lg} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  group: { gap: Spacing.md },
  // Nhãn nhóm viết hoa như "BILL TO" trong ảnh mẫu
  groupLabel: { textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.sm },
})
