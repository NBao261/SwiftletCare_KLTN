import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen'
import { findTabTitle } from '@/constants/roleTabs'

// Menu tạm — đổi tên và route ở src/constants/roleTabs.ts
export default function Menu1Screen() {
  return <PlaceholderScreen title={findTabTitle('menu-1') ?? 'Menu 1'} />
}
