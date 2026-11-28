import type { Dictionary } from '@/lib/i18n';
import type { ApiErrorGroup } from '@/lib/apiError';

// Câu chung của từng nhóm lỗi API (FE_Design 13.16 b); {n} là số giây phải đợi
// rateLimitedNoWait: lỗi 429 mà backend không nói phải đợi bao lâu
export type ApiErrorSentenceKey = ApiErrorGroup | 'rateLimitedNoWait';

const vi: Record<ApiErrorSentenceKey, string> = {
  network: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  server: 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.',
  rateLimited: 'Bạn thao tác quá nhanh. Thử lại sau {n} giây.',
  rateLimitedNoWait: 'Bạn thao tác quá nhanh. Đợi một lát rồi thử lại.',
  session: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  notFound: 'Không tìm thấy dữ liệu hoặc dữ liệu đã bị xoá.',
  invalid: 'Thông tin chưa hợp lệ. Kiểm tra các ô đã báo lỗi rồi thử lại.',
  conflict: 'Dữ liệu vừa được thay đổi hoặc đã tồn tại. Tải lại rồi thử lại.',
  upload: 'File quá lớn hoặc không đúng định dạng.',
};

const en: Record<ApiErrorSentenceKey, string> = {
  network: 'Could not reach the server. Check your connection and try again.',
  server: 'The server is having a problem. Please try again in a few minutes.',
  rateLimited: 'You are going too fast. Try again in {n} seconds.',
  rateLimitedNoWait: 'You are going too fast. Wait a moment and try again.',
  session: 'Your session has expired. Sign in again to continue.',
  forbidden: "You don't have permission for this action.",
  notFound: 'The data was not found or has been removed.',
  invalid: 'The information is not valid. Check the fields marked with an error and try again.',
  conflict: 'The data has just changed or already exists. Reload and try again.',
  upload: 'The file is too large or in the wrong format.',
};

export const errorDict: Dictionary<ApiErrorSentenceKey> = { vi, en };

// Câu theo mã lỗi backend đã biết: màn cần nói đúng lý do. Câu do client viết, không lấy câu của backend
export type ApiErrorCode =
  | 'INVALID_CURRENT_PASSWORD'
  | 'PASSWORD_UNCHANGED'
  | 'INVALID_RESET_TOKEN'
  | 'ACCOUNT_DISABLED'
  | 'HAS_ACTIVE_DEVICES'
  | 'DUPLICATE_NAME'
  | 'RATING_CLOSED'
  | 'INVALID_UPLOAD'
  | 'SERVICE_UNAVAILABLE';

const viCodes: Record<ApiErrorCode, string> = {
  INVALID_CURRENT_PASSWORD: 'Mật khẩu hiện tại chưa đúng.',
  PASSWORD_UNCHANGED: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  INVALID_RESET_TOKEN: 'Mã đặt lại không đúng hoặc đã hết hạn. Gửi lại mã mới.',
  ACCOUNT_DISABLED: 'Tài khoản này đã bị khoá. Liên hệ quản trị viên để mở lại.',
  HAS_ACTIVE_DEVICES: 'Còn thiết bị đang dùng ở đây. Gỡ thiết bị trước rồi thử lại.',
  DUPLICATE_NAME: 'Đã có mục trùng tên. Đặt tên khác.',
  RATING_CLOSED: 'Đã hết hạn chấm ngày này.',
  INVALID_UPLOAD: 'File quá lớn, quá nhiều file hoặc không đúng định dạng.',
  SERVICE_UNAVAILABLE: 'Tính năng này tạm chưa dùng được. Thử lại sau ít phút.',
};

const enCodes: Record<ApiErrorCode, string> = {
  INVALID_CURRENT_PASSWORD: 'The current password is not correct.',
  PASSWORD_UNCHANGED: 'The new password must differ from the current one.',
  INVALID_RESET_TOKEN: 'The reset code is wrong or has expired. Request a new code.',
  ACCOUNT_DISABLED: 'This account is locked. Contact the administrator to reopen it.',
  HAS_ACTIVE_DEVICES: 'Devices are still in use here. Remove them first, then try again.',
  DUPLICATE_NAME: 'An item with this name already exists. Choose another name.',
  RATING_CLOSED: 'The rating period for this day has ended.',
  INVALID_UPLOAD: 'The file is too large, there are too many files, or the format is wrong.',
  SERVICE_UNAVAILABLE: 'This feature is not available right now. Try again in a few minutes.',
};

export const errorCodeDict: Dictionary<ApiErrorCode> = { vi: viCodes, en: enCodes };
