/** Backend chỉ kiểm name trim().notEmpty() (farms.route.ts) — giới hạn độ dài để tên không vỡ layout thẻ nhà/phòng */
export const HOUSE_NAME_MAX = 60

/** Nhà yến thực tế 1–10 tầng; chặn trên để gõ nhầm (VD 30 thay vì 3) không sinh ra 30 tầng rỗng ở trang Nhà */
export const HOUSE_FLOORS_MAX = 20

/**
 * Tên nhà/phòng: trả về thông báo lỗi, hoặc undefined nếu hợp lệ. Kiểm trùng tên
 * (không phân biệt hoa/thường) trong cùng cấp cha ở client — backend không chặn,
 * nhưng 2 mục cùng tên thì không phân biệt được trong danh sách và breadcrumb.
 */
function validateName(raw: string, existingNames: string[], kind: { noun: string; parent: string; example: string }) {
  const name = raw.trim()
  if (!name) return `Chưa nhập tên ${kind.noun} — VD: ${kind.example}.`
  if (name.length > HOUSE_NAME_MAX) return `Tên ${kind.noun} tối đa ${HOUSE_NAME_MAX} ký tự (đang có ${name.length}).`
  if (existingNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) {
    return `${kind.parent} đã có ${kind.noun} tên "${name}" — đặt tên khác để dễ phân biệt.`
  }
  return undefined
}

export function validateHouseName(raw: string, existingNames: string[]): string | undefined {
  return validateName(raw, existingNames, { noun: 'nhà', parent: 'Farm này', example: 'Nhà chính, Nhà phụ số 2' })
}

/** Phòng = Zone ở backend (đổi tên hiển thị cho Admin) */
export function validateRoomName(raw: string, existingNames: string[]): string | undefined {
  return validateName(raw, existingNames, { noun: 'phòng', parent: 'Nhà này', example: 'Phòng 1, Phòng nuôi A' })
}

export function validateHouseFloors(raw: string): string | undefined {
  if (!raw.trim()) return 'Chưa nhập số tầng — nhà 1 tầng thì nhập 1.'
  const floors = Number(raw)
  if (!Number.isInteger(floors) || floors < 1) return 'Số tầng phải là số nguyên từ 1 trở lên.'
  if (floors > HOUSE_FLOORS_MAX) return `Số tầng tối đa ${HOUSE_FLOORS_MAX}.`
  return undefined
}
