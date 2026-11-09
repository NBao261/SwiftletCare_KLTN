import React, { useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import {
  CalendarBlank,
  CaretDown,
  Check,
  Stack,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useFarms } from '@/hooks/farm/useFarms'
import { useHouses } from '@/hooks/farm/useHouses'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore, type ExpertDateRange } from '@/stores/expertScopeStore'
import { t } from '@/utils/i18n.utils'

const DATE_RANGE_LABELS: Record<ExpertDateRange, string> = {
  today: 'Hôm nay',
  '24h': '24 giờ',
  '7d': '7 ngày',
  '30d': '30 ngày',
}

interface PersistentScopeBarProps {
  showDateRange?: boolean
  requireZone?: boolean
}

/**
 * Nút chọn Nhà yến đặt trực tiếp trên AppHeader (prop `leading`),
 * đồng bộ 100% với HeaderPicker + OptionSheet của nhánh FARM_OWNER.
 */
export function ExpertHeaderPicker() {
  const palette = usePalette()
  const {
    selectedFarmId,
    selectedHouseId,
    setFarmId,
    setHouseId,
  } = useExpertScopeStore()

  const { data: farmsData } = useFarms()
  const farms = useMemo(() => farmsData?.data ?? [], [farmsData?.data])

  const currentFarmId = selectedFarmId ?? farms[0]?._id ?? ''
  const { data: housesData } = useHouses(currentFarmId)
  const houses = useMemo(() => housesData?.data ?? [], [housesData?.data])

  const currentHouseId = selectedHouseId ?? houses[0]?._id ?? ''

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

  const [sheetOpen, setSheetOpen] = useState(false)
  const currentHouse = houses.find(h => h._id === currentHouseId)
  const houseLabel = currentHouse ? currentHouse.name : t('Chọn nhà yến')

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Chọn nhà yến, hiện tại là {name}', { name: houseLabel })}
        hitSlop={Spacing.xs}
        onPress={() => setSheetOpen(true)}
        style={styles.headerTrigger}
      >
        <Text variant="heading" numberOfLines={1} style={styles.headerTitle}>
          {houseLabel}
        </Text>
        <CaretDown size={16} color={palette.text} weight="bold" />
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text variant="heading">{t('Chọn nhà yến')}</Text>

        {farms.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.farmChipsRow}
          >
            {farms.map(f => {
              const isSelected = f._id === currentFarmId
              return (
                <Pressable
                  key={f._id}
                  onPress={() => setFarmId(f._id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? palette.inverse : palette.surfaceStrong,
                    },
                  ]}
                >
                  <Text
                    variant="body"
                    weight="semiBold"
                    color={isSelected ? palette.onInverse : palette.text}
                  >
                    {f.name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {houses.map((houseItem, index) => {
            const isSelected = houseItem._id === currentHouseId
            return (
              <Pressable
                key={houseItem._id}
                onPress={() => {
                  setHouseId(houseItem._id)
                  setSheetOpen(false)
                }}
                style={[
                  styles.sheetRow,
                  index > 0 && {
                    borderTopWidth: BorderWidth.hairline,
                    borderTopColor: palette.divider,
                  },
                ]}
              >
                <View style={styles.sheetRowText}>
                  <Text variant="body" weight={isSelected ? 'semiBold' : 'regular'}>
                    {houseItem.name}
                  </Text>
                  {Boolean(houseItem.description) && (
                    <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                      {houseItem.description}
                    </Text>
                  )}
                </View>
                {isSelected && <Check size={20} color={palette.text} weight="bold" />}
              </Pressable>
            )
          })}
        </ScrollView>
      </BottomSheet>
    </>
  )
}

/**
 * Thanh chọn Tầng (Zone) & Khoảng thời gian dạng Chip bo tròn không viền trên nền Paper,
 * đồng bộ 100% với ChoiceChips / ZoneTabs / AlertFilterChips của nhánh FARM_OWNER.
 */
export function PersistentScopeBar({
  showDateRange = true,
  requireZone = false,
}: PersistentScopeBarProps) {
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

  const { data: farmsData } = useFarms()
  const farms = useMemo(() => farmsData?.data ?? [], [farmsData?.data])

  const currentFarmId = selectedFarmId ?? farms[0]?._id ?? ''
  const { data: housesData } = useHouses(currentFarmId)
  const houses = useMemo(() => housesData?.data ?? [], [housesData?.data])

  const currentHouseId = selectedHouseId ?? houses[0]?._id ?? ''
  const { zones } = useZonesOfHouses(currentHouseId ? [currentHouseId] : [])

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

  const [zoneSheetVisible, setZoneSheetVisible] = useState(false)
  const [dateRangeSheetVisible, setDateRangeSheetVisible] = useState(false)

  const currentHouse = houses.find(h => h._id === currentHouseId)

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hàng Chip chọn Tầng trực tiếp giống ZoneTabs / ChoiceChips của Farmer */}
        {!requireZone && (
          <Pressable
            hitSlop={8}
            onPress={() => setZoneId(null)}
            style={[
              styles.chip,
              {
                backgroundColor: selectedZoneId === null ? palette.inverse : palette.surface,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedZoneId === null }}
          >
            <Text
              variant="body"
              weight="semiBold"
              color={selectedZoneId === null ? palette.onInverse : palette.text}
            >
              {t('Tất cả tầng')}
            </Text>
          </Pressable>
        )}

        {zones.map(zoneItem => {
          const isSelected = zoneItem._id === selectedZoneId
          return (
            <Pressable
              key={zoneItem._id}
              hitSlop={8}
              onPress={() => setZoneId(zoneItem._id)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? palette.inverse : palette.surface,
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                variant="body"
                weight="semiBold"
                color={isSelected ? palette.onInverse : palette.text}
              >
                {zoneItem.name}
              </Text>
            </Pressable>
          )
        })}

        {/* Nếu chưa tải kịp danh sách tầng thì hiện chip mở sheet */}
        {zones.length === 0 && (
          <Pressable
            hitSlop={8}
            onPress={() => setZoneSheetVisible(true)}
            style={[styles.chip, { backgroundColor: palette.surface }]}
            accessibilityRole="button"
          >
            <Stack size={14} color={palette.text} weight="bold" />
            <Text variant="body" weight="semiBold" color={palette.text}>
              {t('Tất cả tầng')}
            </Text>
            <CaretDown size={14} color={palette.text} weight="bold" />
          </Pressable>
        )}

        {/* Chip chọn khoảng thời gian (đồng bộ kiểu AlertFilterChips của Farmer) */}
        {showDateRange && (
          <Pressable
            hitSlop={8}
            onPress={() => setDateRangeSheetVisible(true)}
            style={[
              styles.chip,
              {
                backgroundColor: dateRange !== '24h' ? palette.inverse : palette.surface,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('Chọn khoảng thời gian, hiện tại là {label}', {
              label: DATE_RANGE_LABELS[dateRange],
            })}
          >
            <CalendarBlank
              size={14}
              color={dateRange !== '24h' ? palette.onInverse : palette.text}
              weight="bold"
            />
            <Text
              variant="body"
              weight="semiBold"
              color={dateRange !== '24h' ? palette.onInverse : palette.text}
              numberOfLines={1}
            >
              {DATE_RANGE_LABELS[dateRange]}
            </Text>
            <CaretDown
              size={14}
              color={dateRange !== '24h' ? palette.onInverse : palette.text}
              weight="bold"
            />
          </Pressable>
        )}
      </ScrollView>

      {/* BottomSheet Chọn Tầng dự phòng */}
      <BottomSheet visible={zoneSheetVisible} onClose={() => setZoneSheetVisible(false)}>
        <View style={styles.sheetHeader}>
          <Text variant="heading">{t('Chọn tầng')}</Text>
          {Boolean(currentHouse?.name) && (
            <Text variant="small" color={palette.textSecondary}>
              {currentHouse?.name}
            </Text>
          )}
        </View>

        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {!requireZone && (
            <Pressable
              onPress={() => {
                setZoneId(null)
                setZoneSheetVisible(false)
              }}
              style={styles.sheetRow}
            >
              <Text variant="body" weight={selectedZoneId === null ? 'semiBold' : 'regular'}>
                {t('Tất cả tầng')}
              </Text>
              {selectedZoneId === null && <Check size={20} color={palette.text} weight="bold" />}
            </Pressable>
          )}

          {zones.map((zoneItem, idx) => {
            const isSelected = zoneItem._id === selectedZoneId
            return (
              <Pressable
                key={zoneItem._id}
                onPress={() => {
                  setZoneId(zoneItem._id)
                  setZoneSheetVisible(false)
                }}
                style={[
                  styles.sheetRow,
                  (!requireZone || idx > 0) && {
                    borderTopWidth: BorderWidth.hairline,
                    borderTopColor: palette.divider,
                  },
                ]}
              >
                <View style={styles.sheetRowText}>
                  <Text variant="body" weight={isSelected ? 'semiBold' : 'regular'}>
                    {zoneItem.name}
                  </Text>
                  <Text variant="small" color={palette.textSecondary}>
                    {`Tầng ${zoneItem.floor}`}
                  </Text>
                </View>
                {isSelected && <Check size={20} color={palette.text} weight="bold" />}
              </Pressable>
            )
          })}
        </ScrollView>
      </BottomSheet>

      {/* BottomSheet Chọn Khoảng thời gian (kiểu OptionSheet phẳng) */}
      <BottomSheet visible={dateRangeSheetVisible} onClose={() => setDateRangeSheetVisible(false)}>
        <Text variant="heading">{t('Khoảng thời gian')}</Text>

        <View style={styles.sheetList}>
          {(['today', '24h', '7d', '30d'] as const).map((range, index) => {
            const isSelected = range === dateRange
            return (
              <Pressable
                key={range}
                onPress={() => {
                  setDateRange(range)
                  setDateRangeSheetVisible(false)
                }}
                style={[
                  styles.sheetRow,
                  index > 0 && {
                    borderTopWidth: BorderWidth.hairline,
                    borderTopColor: palette.divider,
                  },
                ]}
              >
                <Text variant="body" weight={isSelected ? 'semiBold' : 'regular'}>
                  {DATE_RANGE_LABELS[range]}
                </Text>
                {isSelected && <Check size={20} color={palette.text} weight="bold" />}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  headerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  headerTitle: {
    flexShrink: 1,
  },
  container: {
    paddingVertical: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  farmChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sheetHeader: {
    gap: 2,
  },
  sheetList: {
    maxHeight: 320,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  sheetRowText: {
    flex: 1,
    gap: 2,
  },
})
