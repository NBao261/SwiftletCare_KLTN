// Khớp đường dẫn với mục menu: sidebar, dock, tên trang trên header và hàng tab (SectionTabs) dùng chung
export interface MatchableMenuItem {
  path: string
  tabs?: { path: string }[]
}

// Đường dẫn thuộc một trang (chính nó hoặc trang chi tiết bên dưới), không khớp tiền tố chữ ("/users" không khớp "/users-x")
export function isPathWithin(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

// Mục menu đang mở: trùng đường dẫn của mục hoặc của một tab
export function isMenuItemActive(item: MatchableMenuItem, pathname: string): boolean {
  return isPathWithin(pathname, item.path) || (item.tabs ?? []).some(tab => isPathWithin(pathname, tab.path))
}

// Tab đang mở: tab có đường dẫn dài nhất chứa trang hiện tại (/dashboard/scada thuộc tab "Điều khiển tay", không thuộc /dashboard)
export function activeTabPath(tabs: { path: string }[], pathname: string): string | undefined {
  return tabs
    .filter(tab => isPathWithin(pathname, tab.path))
    .reduce<string | undefined>((longest, tab) => (!longest || tab.path.length > longest.length ? tab.path : longest), undefined)
}
