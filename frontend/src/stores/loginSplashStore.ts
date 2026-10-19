import { create } from 'zustand';

// Id của 2 ảnh logo trên khung đăng nhập — màn chuyển cảnh đọc vị trí để logo lướt từ đúng chỗ đó
export const AUTH_LOGO_ICON_ID = 'auth-logo-icon';
export const AUTH_LOGO_TEXT_ID = 'auth-logo-text';

// Vị trí và kích thước 1 ảnh trên màn hình
export interface LogoBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LogoOrigin {
  icon: LogoBox;
  text: LogoBox;
}

// Màn chuyển cảnh sau khi đăng nhập thành công: logo lướt ra giữa, chạy thanh tải, rồi nền trắng mờ dần
interface LoginSplashState {
  isPlaying: boolean;
  // Vị trí logo lúc bấm đăng nhập; không đọc được thì logo hiện thẳng ở giữa
  origin: LogoOrigin | null;
  start: () => void;
  finish: () => void;
}

// Đọc vị trí 1 ảnh theo id
function readBox(elementId: string): LogoBox | null {
  const element = document.getElementById(elementId);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export const useLoginSplashStore = create<LoginSplashState>(set => ({
  isPlaying: false,
  origin: null,
  start: () => {
    const icon = readBox(AUTH_LOGO_ICON_ID);
    const text = readBox(AUTH_LOGO_TEXT_ID);
    set({ isPlaying: true, origin: icon && text ? { icon, text } : null });
  },
  finish: () => set({ isPlaying: false, origin: null }),
}));
