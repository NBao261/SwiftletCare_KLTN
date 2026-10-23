// State gắn vào lượt chuyển trang từ trang con lên trang cha cùng mục menu (nút Quay lại, breadcrumb gốc, menu bên trái, đổi khung lọc)
export interface UpFromChildState {
  fromChildPage: true
}

export const UP_FROM_CHILD_STATE: UpFromChildState = { fromChildPage: true }

export function isUpFromChildState(state: unknown): state is UpFromChildState {
  return typeof state === 'object' && state !== null && (state as Partial<UpFromChildState>).fromChildPage === true
}

// State cho link menu: đang ở trang con của mục đó (đường dẫn bắt đầu bằng "<mục>/") thì bấm menu là đi lên
export function menuLinkState(menuPath: string, pathname: string): UpFromChildState | undefined {
  return pathname.startsWith(`${menuPath}/`) ? UP_FROM_CHILD_STATE : undefined
}
