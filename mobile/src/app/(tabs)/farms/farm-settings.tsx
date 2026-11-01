import { useState } from 'react'
import { Alert as NativeAlert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { CreateItemSheet } from '@/components/farm/settings/CreateItemSheet'
import { FarmHousesSection } from '@/components/farm/settings/FarmHousesSection'
import { FarmInfoSection } from '@/components/farm/settings/FarmInfoSection'
import { FarmLocationSection } from '@/components/farm/settings/FarmLocationSection'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Toast } from '@/components/ui/toast'
import { Spacing } from '@/constants/theme'
import { useCreateHouse } from '@/hooks/farm/useCreateHouse'
import { useDeleteFarm } from '@/hooks/farm/useDeleteFarm'
import { useFarms } from '@/hooks/farm/useFarms'
import { useOrderedHouses } from '@/hooks/farm/useOrderedHouses'
import { useSingleSectionEdit } from '@/hooks/farm/useSingleSectionEdit'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_SKELETON_HEIGHT = 76
const SKELETON_COUNT = 3

/** Cài đặt một trang trại: thông tin, toạ độ, danh sách nhà yến và thêm nhà, xoá trang trại (FARM-FR-001, 002).
 * Mỗi mục sửa và lưu riêng, mỗi lúc một mục */
export default function FarmSettingsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { farmId } = useLocalSearchParams<{ farmId: string }>()
  const user = useAuthStore(state => state.user)
  const editor = useSingleSectionEdit()
  const toast = useToastMessage()
  const farmsQuery = useFarms()
  const farm = (farmsQuery.data?.data ?? []).find(item => item._id === farmId) ?? null
  const housesQuery = useOrderedHouses(farmId)
  const createHouse = useCreateHouse()
  const deleteFarm = useDeleteFarm()
  const [isHouseSheetOpen, setHouseSheetOpen] = useState(false)
  const [sheetKey, setSheetKey] = useState(0)

  const canEditFarm = canPerform(user, 'editFarm')
  const canCreateHouse = canPerform(user, 'createHouse')
  // Backend chỉ cho chủ chính xoá farm (FARM-FR-001)
  const canDeleteFarm = canPerform(user, 'deleteFarm') && farm?.owner_id === user?._id

  const openHouseSettings = (houseId: string) =>
    editor.confirmDiscard(() => {
      editor.finishEditing()
      router.push({ pathname: '/(tabs)/farms/[houseId]/settings', params: { houseId } })
    })

  const openHouseSheet = () => {
    setSheetKey(key => key + 1)
    setHouseSheetOpen(true)
  }

  const confirmDelete = () => {
    if (!farm) return
    NativeAlert.alert(
      t('Xoá trang trại?'),
      t('{farm} sẽ bị ẩn cùng các nhà yến; dữ liệu cũ vẫn được giữ. Cảnh báo đang mở của farm sẽ được đóng.', {
        farm: farm.name,
      }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Xoá'),
          style: 'destructive',
          onPress: () =>
            deleteFarm.mutate(farm._id, {
              onSuccess: () => router.dismissTo('/(tabs)/farms'),
              onError: error =>
                NativeAlert.alert(
                  t('Không xoá được'),
                  getSettingsErrorMessage(error, { 403: t('Chỉ chủ chính của trang trại mới xoá được') }),
                ),
            }),
        },
      ],
    )
  }

  const retry = () => queryClient.refetchQueries({ type: 'active' })

  const renderBody = () => {
    if (farmsQuery.isLoading) {
      return Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <Skeleton key={index} width="100%" height={SECTION_SKELETON_HEIGHT} delayMs={index * 75} />
      ))
    }
    if (!farm) {
      return (
        <EmptyState
          message={farmsQuery.isError ? t('Không tải được') : t('Không tìm thấy trang trại')}
          actionLabel={farmsQuery.isError ? t('Thử lại') : undefined}
          onAction={farmsQuery.isError ? retry : undefined}
        />
      )
    }
    return (
      <>
        <FarmInfoSection farm={farm} canEdit={canEditFarm} editor={editor} onSaved={toast.show} />
        <FarmLocationSection farm={farm} canEdit={canEditFarm} editor={editor} onSaved={toast.show} />
        {housesQuery.isError ? (
          <EmptyState message={t('Không tải được danh sách nhà')} actionLabel={t('Thử lại')} onAction={retry} />
        ) : housesQuery.isLoading ? (
          <Skeleton width="100%" height={SECTION_SKELETON_HEIGHT} />
        ) : (
          <FarmHousesSection
            houses={housesQuery.houses}
            editor={editor}
            onOpenHouse={openHouseSettings}
            onAdd={canCreateHouse ? openHouseSheet : undefined}
          />
        )}
        {canDeleteFarm && (
          <Button
            label={t('Xoá trang trại')}
            variant="link"
            color={palette.alert}
            onPress={confirmDelete}
            loading={deleteFarm.isPending}
            style={styles.center}
          />
        )}
      </>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        <AppHeader title={t('Cài đặt trang trại')} onBack={() => router.back()} />
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          >
            {renderBody()}
          </ScrollView>
        </KeyboardAvoidingView>
        {farm && (
          <CreateItemSheet
            key={sheetKey}
            visible={isHouseSheetOpen}
            title={t('Thêm nhà yến')}
            scopeLabel={farm.name}
            nameLabel={t('Tên nhà')}
            numberLabel={t('Số tầng')}
            submit={(name, floors) => createHouse.mutateAsync({ farmId: farm._id, payload: { name, floors } })}
            onCreated={() => {
              setHouseSheetOpen(false)
              toast.show(t('Đã thêm nhà yến'))
            }}
            onClose={() => setHouseSheetOpen(false)}
          />
        )}
      </View>
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.lg} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  center: { alignSelf: 'center' },
})
