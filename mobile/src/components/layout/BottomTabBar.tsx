import { StyleSheet, useWindowDimensions, View } from 'react-native'
import type { BottomTabBarProps as NavigatorTabBarProps } from 'expo-router/tabs'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, FeGaussianBlur, FeOffset, Filter, Path } from 'react-native-svg'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import type { RoleTab } from '@/constants/roleTabs'
import { BorderWidth, Colors, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'

// ===================== BẢNG CHỈNH — chỉ sửa số ở khối này =====================

// Thanh tab
const BAR_HEIGHT = 52

// Chữ tiêu đề — dùng chung cho MỌI tab, kể cả chữ dưới nút nổi
const LABEL_FONT_SIZE = 12
const LABEL_LINE_HEIGHT = 14
const LABEL_BOTTOM = -5

// Icon thường — dùng chung cho mọi tab TRỪ nút nổi
const TAB_ICON_SIZE = 24
const ICON_LABEL_GAP = 4

// Nút tròn nổi
const FEATURED_SIZE = 49
const FEATURED_ICON_SIZE = 32
const FEATURED_CENTER_BELOW_EDGE = -12

// Bướu nhô quanh nút nổi
const HUMP_HEIGHT = 20
const HUMP_HALF_WIDTH = 60
const HUMP_PEAK_ROUNDNESS = 0.4

// Bóng đổ mép trên — phần bóng lộ ra cao khoảng |SHADOW_OFFSET_Y| + 2 × SHADOW_BLUR
const SHADOW_BLUR = 3
const SHADOW_OFFSET_Y = 0

// Đường viền mép thanh: 'background' (trắng, trùng nền thanh) · 'divider' (xám mảnh)
const BORDER_COLOR_TOKEN = 'background'

// ============== Tự tính từ bảng trên — không cần sửa ==============

// Phần nút nổi cao hơn mép thanh
const FEATURED_RISE = FEATURED_SIZE / 2 + FEATURED_CENTER_BELOW_EDGE
// Chỗ trống trên đỉnh bướu cho phần nhoè (~3 lần độ nhoè), thiếu thì bóng bị cắt thành đường ngang
const SHADOW_SPACE = SHADOW_BLUR * 3 + Math.abs(SHADOW_OFFSET_Y)
// Khoảng từ đỉnh vùng vẽ tới mép thanh: đủ chứa cả nút nổi lẫn bướu kèm bóng
const EDGE_TOP = Math.max(FEATURED_RISE, HUMP_HEIGHT + SHADOW_SPACE)
// Thanh đè lên đáy màn bằng khoảng này: màn tab có nội dung cuộn chừa thêm ở đáy
export const TAB_BAR_OVERLAP = EDGE_TOP
// Xanh loang của nút nổi, từ hai màu có sẵn trong theme
const FEATURED_GRADIENT = [Colors.raw.successLime, Colors.raw.brandPrimary] as const

interface BottomTabBarProps extends NavigatorTabBarProps {
  tabs: readonly RoleTab[]
  unreadCount: number
}

// Route "alerts/index" của expo-router ứng với tab name "alerts"
function findTab(tabs: readonly RoleTab[], routeName: string): RoleTab | undefined {
  const tabName = routeName.replace(/\/index$/, '')
  return tabs.find(tab => tab.name === tabName)
}

// Mép trên thanh: bo 2 góc, có bướu nhô quanh nút nổi
function buildEdgePath(width: number, featuredCenterX: number | null): string {
  const top = EDGE_TOP
  const corner = Radius.lg
  let hump = ''
  if (featuredCenterX !== null) {
    const left = featuredCenterX - HUMP_HALF_WIDTH
    const right = featuredCenterX + HUMP_HALF_WIDTH
    const peak = top - HUMP_HEIGHT
    hump =
      `L ${left} ${top} ` +
      `C ${featuredCenterX - HUMP_HALF_WIDTH * 0.45} ${top} ${featuredCenterX - HUMP_HALF_WIDTH * HUMP_PEAK_ROUNDNESS} ${peak} ${featuredCenterX} ${peak} ` +
      `C ${featuredCenterX + HUMP_HALF_WIDTH * HUMP_PEAK_ROUNDNESS} ${peak} ${featuredCenterX + HUMP_HALF_WIDTH * 0.45} ${top} ${right} ${top} `
  }
  return (
    `M 0 ${top + corner} A ${corner} ${corner} 0 0 1 ${corner} ${top} ` +
    hump +
    `L ${width - corner} ${top} A ${corner} ${corner} 0 0 1 ${width} ${top + corner}`
  )
}

function TabBadge({ count }: { count: number }) {
  const palette = usePalette()
  if (count <= 0) return null
  return (
    <View style={[styles.badge, { backgroundColor: palette.primary, borderColor: palette.background }]}>
      <Text variant="label" color={palette.onPrimary}>{count > 99 ? '99+' : count}</Text>
    </View>
  )
}

// Thanh tab dùng chung mọi role: tab dựng từ ROLE_TABS, tab isFeatured thành nút tròn nổi giữa
export function BottomTabBar({ state, emitter, navigateToTab, insets, tabs, unreadCount }: BottomTabBarProps) {
  const palette = usePalette()
  const { width } = useWindowDimensions()
  const height = EDGE_TOP + BAR_HEIGHT + insets.bottom
  const itemWidth = width / state.routes.length
  const featuredIndex = state.routes.findIndex(route => findTab(tabs, route.name)?.isFeatured)
  const edgePath = buildEdgePath(width, featuredIndex < 0 ? null : itemWidth * (featuredIndex + 0.5))
  const fillPath = `${edgePath} L ${width} ${height} L 0 ${height} Z`

  return (
    // Kéo lên phủ đáy màn để nút nổi đè lên nội dung; vùng trong suốt cho chạm xuyên qua
    <View pointerEvents="box-none" style={[styles.bar, { height, marginTop: -EDGE_TOP }]}>
      <Svg width={width} height={height} style={styles.background} pointerEvents="none">
        <Defs>
          {/* Vùng lọc phủ cả khung vẽ để phần nhoè chạy theo góc bo và bướu, không bị cắt */}
          <Filter id="tabBarShadow" filterUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
            <FeOffset in="SourceGraphic" dy={SHADOW_OFFSET_Y} result="offset" />
            <FeGaussianBlur in="offset" stdDeviation={SHADOW_BLUR} />
          </Filter>
        </Defs>
        {/* Bản sao hình thanh, làm nhoè, nằm dưới thanh thật: phần lộ ra ngoài mép là bóng */}
        <Path d={fillPath} fill={palette.divider} filter="url(#tabBarShadow)" />
        <Path d={fillPath} fill={palette.background} stroke={palette[BORDER_COLOR_TOKEN]} strokeWidth={BorderWidth.hairline} />
      </Svg>
      <View pointerEvents="box-none" style={[styles.row, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route, index) => {
          const tab = findTab(tabs, route.name)
          if (!tab) return null
          const TabIcon = tab.icon
          const isFocused = index === state.index
          const color = isFocused ? palette.tabIconSelected : palette.tabIconDefault
          const badgeCount = tab.showsAlertBadge ? unreadCount : 0
          const handlePress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!isFocused && !event.defaultPrevented) navigateToTab(route.key)
          }

          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: isFocused }}
              onPress={handlePress}
              style={tab.isFeatured ? styles.featuredItem : styles.item}
            >
              {tab.isFeatured ? (
                <LinearGradient colors={FEATURED_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featuredCircle}>
                  {/* Nút nổi luôn icon đặc, không đổi khi chọn — nền xanh loang đã đủ nổi bật */}
                  <TabIcon size={FEATURED_ICON_SIZE} color={Colors.raw.pureWhite} weight="fill" />
                  <TabBadge count={badgeCount} />
                </LinearGradient>
              ) : (
                <View>
                  <TabIcon size={TAB_ICON_SIZE} color={color} weight={isFocused ? 'fill' : 'regular'} />
                  <TabBadge count={badgeCount} />
                </View>
              )}
              <Text variant="label" color={color} numberOfLines={1} style={styles.label}>{tab.title}</Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { width: '100%' },
  background: { position: 'absolute', top: 0, left: 0 },
  row: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'flex-start' },
  item: {
    flex: 1,
    marginTop: EDGE_TOP,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: ICON_LABEL_GAP,
  },
  // marginBottom (không phải padding) để LABEL_BOTTOM nhận được số âm
  label: { fontSize: LABEL_FONT_SIZE, lineHeight: LABEL_LINE_HEIGHT, marginBottom: LABEL_BOTTOM },
  // Nút nổi chiếm từ đỉnh nút tới đáy hàng tab; cùng LABEL_BOTTOM nên chữ thẳng hàng các tab khác
  featuredItem: {
    flex: 1,
    marginTop: EDGE_TOP - FEATURED_RISE,
    height: FEATURED_RISE + BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredCircle: { width: FEATURED_SIZE, height: FEATURED_SIZE, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -Spacing.xs,
    right: -Spacing.md,
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: BorderWidth.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
