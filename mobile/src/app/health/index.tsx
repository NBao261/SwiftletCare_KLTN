import { useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { HealthDayRow } from '@/components/health/HealthDayRow'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useHealthDays } from '@/hooks/health/useHealthDays'
import { usePendingHealthDays } from '@/hooks/health/usePendingHealthDays'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { getVietnamDate } from '@/utils/date.utils'
import { getPendingRatingRange, shiftDate } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'

// Bộ lọc: các ngày còn chờ chấm, hoặc 7 / 14 / 30 ngày gần nhất (backend nhận tối đa 31 ngày)
type DayFilter = 'pending' | '7' | '14' | '30'
const SKELETON_ROWS = 4
const ROW_SKELETON_HEIGHT = 56

/** Trạng thái ngày của một nhà (ANALYTICS-FR-012, MF-06): các ngày, ngày chờ chấm che trạng thái tới khi chấm (BR-31) */
export default function HealthDaysScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ houseId?: string }>()
  const allHouses = useAllHouses()
  const pendingDays = usePendingHealthDays()
  const [pickedHouseId, setPickedHouseId] = useState<string | null>(null)
  const [isHouseSheetOpen, setHouseSheetOpen] = useState(false)
  const [filter, setFilter] = useState<DayFilter>('7')
  const [isRefreshing, setRefreshing] = useState(false)
  // Nhà: chọn trên màn → tham số route → nhà đầu tiên còn ngày chờ chấm → nhà đầu tiên
  const house =
    allHouses.houses.find(item => item._id === (pickedHouseId ?? params.houseId)) ??
    allHouses.houses.find(item => pendingDays.data.some(day => day.house_id === item._id)) ??
    allHouses.houses[0] ??
    null
  const today = getVietnamDate()
  const range = filter === 'pending' ? getPendingRatingRange() : { from: shiftDate(today, 1 - Number(filter)), to: today }
  const daysQuery = useHealthDays(house?._id ?? '', range.from, range.to, filter === 'pending' ? 'PENDING' : undefined)
  const days = daysQuery.data ?? []

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await daysQuery.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const renderList = () => {
    if (daysQuery.isLoading) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton
          key={index}
          width="100%"
          height={ROW_SKELETON_HEIGHT}
          radius={Radius.md}
          color={palette.surfaceStrong}
          delayMs={index * 75}
        />
      ))
    }
    if (daysQuery.isError) {
      return <EmptyState message={t('Không tải được')} actionLabel={t('Thử lại')} onAction={() => daysQuery.refetch()} />
    }
    if (days.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {filter === 'pending' ? t('Không có ngày nào chờ bạn đánh giá') : t('Chưa có trạng thái ngày trong khoảng này')}
        </Text>
      )
    }
    return days.map((day, index) => (
      <HealthDayRow
        key={day._id}
        day={day}
        hasDivider={index < days.length - 1}
        onPress={() => router.push({ pathname: '/health/[dayId]', params: { dayId: day._id } })}
      />
    ))
  }

  const renderBody = () => {
    if (allHouses.isLoading) return <Skeleton width="100%" height={ROW_SKELETON_HEIGHT * 3} />
    if (allHouses.isError) return <EmptyState message={t('Không tải được')} />
    if (!house) return <EmptyState message={t('Chưa có nhà yến')} />
    return (
      <>
        <ChoiceChips
          options={[
            { id: 'pending', label: t('Cần đánh giá') },
            { id: '7', label: t('7 ngày') },
            { id: '14', label: t('14 ngày') },
            { id: '30', label: t('30 ngày') },
          ]}
          selectedId={filter}
          onSelect={setFilter}
          accessibilityLabel={t('Lọc các ngày')}
        />
        <Card>{renderList()}</Card>
        <Text variant="small" color={palette.textSecondary}>
          {t(
            'Mỗi ngày hệ thống tính trạng thái của nhà từ môi trường, không khí, đàn chim và tiếng ồn. Bạn đánh giá trước rồi mới thấy trạng thái. Trạng thái là chỉ báo từ dữ liệu, không phải chẩn đoán.',
          )}
        </Text>
      </>
    )
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        onBack={() => router.back()}
        leading={
          <HeaderPicker
            title={house ? house.name : t('Trạng thái ngày')}
            onPress={allHouses.houses.length > 1 ? () => setHouseSheetOpen(true) : undefined}
            accessibilityLabel={t('Chọn nhà yến')}
          />
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.textSecondary}
            colors={[palette.text]}
          />
        }
      >
        {renderBody()}
      </ScrollView>
      <OptionSheet
        visible={isHouseSheetOpen}
        title={t('Chọn nhà yến')}
        options={allHouses.houses.map(item => ({ id: item._id, label: item.name }))}
        selectedId={house?._id}
        onSelect={id => {
          setPickedHouseId(id)
          setHouseSheetOpen(false)
        }}
        onClose={() => setHouseSheetOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
})
