import type { NestType } from '@/types';

// Loại tổ theo thứ tự hiển thị; nhãn VI/EN ở harvestDict (nestType.*)
export const NEST_TYPES: NestType[] = ['RAW', 'CLEANED', 'PREMIUM'];

// Sản lượng nhập theo gram (bước 0,1 g): gram hiện đúng số đã nhập (tối đa 1 chữ số lẻ, không làm tròn); đổi ra kg thì lấy cố định 2 chữ số sau dấu phẩy
export const GRAM_DIGITS = 1;
export const KILOGRAM_DIGITS = 2;

// Màu badge loại tổ trong bảng, cùng màu vòng/chú thích của khung phân bổ: yến trắng accent-600 (#B5D32C), yến hồng accent-700, yến huyết accent-900
export const NEST_TYPE_BADGE_CLASS: Record<NestType, string> = {
  RAW: 'bg-accent-600 text-charcoal',
  CLEANED: 'bg-accent-700 text-charcoal',
  PREMIUM: 'bg-accent-900 text-white',
};

// Màu nền 1 ô của thanh nhiều loại yến (cùng màu badge trên)
export const NEST_TYPE_FILL_CLASS: Record<NestType, string> = {
  RAW: 'bg-accent-600',
  CLEANED: 'bg-accent-700',
  PREMIUM: 'bg-accent-900',
};

// Nút "Chi tiết" trong bảng — hover dùng viền chìm thay vì đổi nền màu (dùng chung với bảng Dashboard, Thiết bị)
export const DETAIL_BUTTON_CLASS =
  'rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-charcoal transition-all duration-200 ease-in-out hover:bg-gray-50 hover:ring-1 hover:ring-inset hover:ring-charcoal';
