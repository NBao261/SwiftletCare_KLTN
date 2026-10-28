import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen'
import { findTabTitle } from '@/constants/roleTabs'

// Menu tạm — đổi tên và route ở src/constants/roleTabs.ts
export default function Menu2Screen() {
  return <PlaceholderScreen title={findTabTitle('menu-2') ?? 'Menu 2'} />
}
