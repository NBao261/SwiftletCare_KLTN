import type { Dictionary } from '@/lib/i18n';
import type { ApiErrorGroup } from '@/lib/apiError';

// Câu chung của 4 nhóm lỗi API (FE_Design 13.16 b)
const vi: Record<ApiErrorGroup, string> = {
  permission: 'Bạn không có quyền thực hiện thao tác này hoặc phiên đăng nhập đã hết hạn.',
  notFound: 'Không tìm thấy dữ liệu hoặc dữ liệu đã bị xoá.',
  invalid: 'Thông tin chưa hợp lệ hoặc đã thay đổi. Vui lòng kiểm tra lại.',
  system: 'Không kết nối được hệ thống. Vui lòng thử lại sau.',
};

const en: Record<ApiErrorGroup, string> = {
  permission: "You don't have permission for this action or your session has expired.",
  notFound: 'The data was not found or has been removed.',
  invalid: 'The information is invalid or has changed. Please check and try again.',
  system: 'Could not reach the system. Please try again later.',
};

export const errorDict: Dictionary<ApiErrorGroup> = { vi, en };
