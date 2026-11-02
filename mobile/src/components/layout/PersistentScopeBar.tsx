import React, { useEffect, useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import {
  Buildings,
  CalendarBlank,
  CaretDown,
  Check,
  House,
  Stack,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useFarms } from '@/hooks/farm/useFarms'
import { useHouses } from '@/hooks/farm/useHouses'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore, type ExpertDateRange } from '@/stores/expertScopeStore'

const DATE_RANGE_LABELS: Record<ExpertDateRange, string> = {
  today: 'Hôm nay',
  '24h': '24 giờ qua',
  '7d': '7 ngày qua',
  '30d': '30 ngày qua',
}

interface PersistentScopeBarProps {
  showDateRange?: boolean
}

/**
 * Thanh chọn phạm vi dùng chung cho các màn hình của Chuyên gia và Chủ trại.
 * Nằm trong src/components/layout/ theo tiêu chí TC-07.
 * Thiết kế phẳng, tối ưu thao tác chọn Trang trại > Nhà yến > Tầng và Khoảng thời gian.
 * Lưu trữ trạng thái bền vững qua useExpertScopeStore (Zustand + MMKV).
 */
export function PersistentScopeBar({ showDateRange = true }: PersistentScopeBarProps) {
  const palette = usePalette()

  const {
    selectedFarmId,
    selectedHouseId,
    selectedZoneId,
    dateRange,
    setFarmId,
    setHouseId,
    setZoneId,
    setDateRange,
  } = useExpertScopeStore()

  // Dữ liệu trang trại & nhà yến
  const { data: farmsData } = useFarms()
  const farms = useMemo(() => farmsData?.data ?? [], [farmsData?.data])

  const currentFarmId = selectedFarmId ?? farms[0]?._id ?? ''
  const { data: housesData } = useHouses(currentFarmId)
  const houses = useMemo(() => housesData?.data ?? [], [housesData?.data])

  const currentHouseId = selectedHouseId ?? houses[0]?._id ?? ''
  const { zones } = useZonesOfHouses(currentHouseId ? [currentHouseId] : [])

  // Tự động gán mặc định Farm và House đầu tiên nếu chưa có
  useEffect(() => {
    if (!selectedFarmId && farms.length > 0) {
      setFarmId(farms[0]._id)
    }
  }, [farms, selectedFarmId, setFarmId])

  useEffect(() => {
    if (selectedFarmId && !selectedHouseId && houses.length > 0) {
      setHouseId(houses[0]._id)
    }
  }, [houses, selectedFarmId, selectedHouseId, setHouseId])

  // Trạng thái hiển thị BottomSheet
  const [houseSheetVisible, setHouseSheetVisible] = useState(false)
  const [zoneSheetVisible, setZoneSheetVisible] = useState(false)
  const [dateRangeSheetVisible, setDateRangeSheetVisible] = useState(false)

  // Tên hiển thị hiện tại
  const currentHouse = houses.find(h => h._id === currentHouseId)
  const currentZone = zones.find(z => z._id === selectedZoneId)

  const houseLabel = currentHouse ? currentHouse.name : 'Chọn nhà yến'
  const zoneLabel = currentZone ? currentZone.name : 'Tất cả các tầng'

  return (
    <View style={[styles.container, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Chip chọn Nhà yến */}
        <PressableScale
          onPress={() => setHouseSheetVisible(true)}
          style={[
            styles.chip,
            {
              backgroundColor: palette.surfaceStrong,
              borderColor: palette.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Chọn nhà yến, hiện tại là ${houseLabel}`}
        >
          <House size={14} color={palette.text} weight="bold" />
          <Text variant="small" weight="medium" numberOfLines={1}>
            {houseLabel}
          </Text>
          <CaretDown size={12} color={palette.secondary} weight="bold" />
        </PressableScale>

        {/* Chip chọn Tầng / Zone */}
        <PressableScale
          onPress={() => setZoneSheetVisible(true)}
          style={[
            styles.chip,
            {
              backgroundColor: selectedZoneId ? palette.surfaceStrong : palette.surface,
              borderColor: selectedZoneId ? palette.primary : palette.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Chọn tầng, hiện tại là ${zoneLabel}`}
        >
          <Stack size={14} color={palette.text} weight="bold" />
          <Text variant="small" weight="medium" numberOfLines={1}>
            {zoneLabel}
          </Text>
          <CaretDown size={12} color={palette.secondary} weight="bold" />
        </PressableScale>

        {/* Chip chọn khoảng thời gian */}
        {showDateRange && (
          <PressableScale
            onPress={() => setDateRangeSheetVisible(true)}
            style={[
              styles.chip,
              {
                backgroundColor: palette.surfaceStrong,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Chọn khoảng thời gian, hiện tại là ${DATE_RANGE_LABELS[dateRange]}`}
          >
            <CalendarBlank size={14} color={palette.text} weight="bold" />
            <Text variant="small" weight="medium" numberOfLines={1}>
              {DATE_RANGE_LABELS[dateRange]}
            </Text>
            <CaretDown size={12} color={palette.secondary} weight="bold" />
          </PressableScale>
        )}
      </ScrollView>

      {/* ── BottomSheet 1: Chọn Nhà yến (kèm chuyển Trang trại) ── */}
      <BottomSheet visible={houseSheetVisible} onClose={() => setHouseSheetVisible(false)}>
        <View style={styles.sheetHeader}>
          <Text variant="heading" weight="semiBold">Chọn Nhà Yến Giám Sát</Text>
          <Text variant="small" color={palette.textSecondary}>
            Phạm vi sẽ được áp dụng cho toàn bộ các tab nghiệp vụ
          </Text>
        </View>

        {/* Danh sách trang trại nếu có nhiều trang trại */}
        {farms.length > 1 && (
          <View style={styles.farmSelectorRow}>
            {farms.map(f => {
              const isSelected = f._id === currentFarmId
              return (
                <PressableScale
                  key={f._id}
                  onPress={() => setFarmId(f._id)}
                  style={[
                    styles.farmChip,
                    {
                      backgroundColor: isSelected ? palette.text : palette.surfaceStrong,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Buildings size={12} color={isSelected ? palette.surface : palette.text} weight="bold" />
                  <Text
                    variant="label"
                    weight="medium"
                    color={isSelected ? palette.surface : palette.text}
                  >
                    {f.name}
                  </Text>
                </PressableScale>
              )
            })}
          </View>
        )}

        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {houses.map(houseItem => {
            const isSelected = houseItem._id === currentHouseId
            return (
              <PressableScale
                key={houseItem._id}
                onPress={() => {
                  setHouseId(houseItem._id)
                  setHouseSheetVisible(false)
                }}
                style={[
                  styles.sheetItem,
                  {
                    backgroundColor: isSelected ? palette.surfaceStrong : palette.surface,
                    borderColor: isSelected ? palette.primary : palette.border,
                  },
                ]}
              >
                <View style={styles.sheetItemLeft}>
                  <House size={18} color={palette.text} weight={isSelected ? 'bold' : 'regular'} />
                  <View>
                    <Text variant="body" weight="medium">{houseItem.name}</Text>
                    {Boolean(houseItem.description) && (
                      <Text variant="small" color={palette.textSecondary}>
                        {houseItem.description}
                      </Text>
                    )}
                  </View>
                </View>
                {isSelected && <Check size={18} color={palette.text} weight="bold" />}
              </PressableScale>
            )
          })}
        </ScrollView>
      </BottomSheet>

      {/* ── BottomSheet 2: Chọn Tầng / Vùng ── */}
      <BottomSheet visible={zoneSheetVisible} onClose={() => setZoneSheetVisible(false)}>
        <View style={styles.sheetHeader}>
          <Text variant="heading" weight="semiBold">Chọn Tầng / Vùng Giám Sát</Text>
          <Text variant="small" color={palette.textSecondary}>
            {currentHouse?.name ? `Thuộc ${currentHouse.name}` : 'Chọn tầng để xem chi tiết'}
          </Text>
        </View>

        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {/* Tuỳ chọn "Tất cả các tầng" */}
          <PressableScale
            onPress={() => {
              setZoneId(null)
              setZoneSheetVisible(false)
            }}
            style={[
              styles.sheetItem,
              {
                backgroundColor: selectedZoneId === null ? palette.surfaceStrong : palette.surface,
                borderColor: selectedZoneId === null ? palette.primary : palette.border,
              },
            ]}
          >
            <View style={styles.sheetItemLeft}>
              <Stack size={18} color={palette.text} weight={selectedZoneId === null ? 'bold' : 'regular'} />
              <Text variant="body" weight="medium">Tất cả các tầng</Text>
            </View>
            {selectedZoneId === null && <Check size={18} color={palette.text} weight="bold" />}
          </PressableScale>

          {/* Các tầng cụ thể */}
          {zones.map(zoneItem => {
            const isSelected = zoneItem._id === selectedZoneId
            return (
              <PressableScale
                key={zoneItem._id}
                onPress={() => {
                  setZoneId(zoneItem._id)
                  setZoneSheetVisible(false)
                }}
                style={[
                  styles.sheetItem,
                  {
                    backgroundColor: isSelected ? palette.surfaceStrong : palette.surface,
                    borderColor: isSelected ? palette.primary : palette.border,
                  },
                ]}
              >
                <View style={styles.sheetItemLeft}>
                  <Stack size={18} color={palette.text} weight={isSelected ? 'bold' : 'regular'} />
                  <View>
                    <Text variant="body" weight="medium">{zoneItem.name}</Text>
                    <Text variant="small" color={palette.textSecondary}>
                      {`Tầng ${zoneItem.floor}`}
                    </Text>
                  </View>
                </View>
                {isSelected && <Check size={18} color={palette.text} weight="bold" />}
              </PressableScale>
            )
          })}
        </ScrollView>
      </BottomSheet>

      {/* ── BottomSheet 3: Chọn Khoảng thời gian ── */}
      <BottomSheet visible={dateRangeSheetVisible} onClose={() => setDateRangeSheetVisible(false)}>
        <View style={styles.sheetHeader}>
          <Text variant="heading" weight="semiBold">Khoảng Thời Gian Dữ Liệu</Text>
          <Text variant="small" color={palette.textSecondary}>
            Áp dụng cho các chỉ số và chuỗi viễn trắc môi trường
          </Text>
        </View>

        <View style={styles.sheetList}>
          {(['today', '24h', '7d', '30d'] as const).map(range => {
            const isSelected = range === dateRange
            return (
              <PressableScale
                key={range}
                onPress={() => {
                  setDateRange(range)
                  setDateRangeSheetVisible(false)
                }}
                style={[
                  styles.sheetItem,
                  {
                    backgroundColor: isSelected ? palette.surfaceStrong : palette.surface,
                    borderColor: isSelected ? palette.primary : palette.border,
                  },
                ]}
              >
                <View style={styles.sheetItemLeft}>
                  <CalendarBlank size={18} color={palette.text} weight={isSelected ? 'bold' : 'regular'} />
                  <Text variant="body" weight="medium">
                    {DATE_RANGE_LABELS[range]}
                  </Text>
                </View>
                {isSelected && <Check size={18} color={palette.text} weight="bold" />}
              </PressableScale>
            )
          })}
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: BorderWidth.regular,
    paddingVertical: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: BorderWidth.regular,
  },
  sheetHeader: {
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  farmSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  farmChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: BorderWidth.regular,
  },
  sheetList: {
    maxHeight: 320,
    gap: Spacing.xs,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.regular,
    marginBottom: Spacing.xs,
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
})
