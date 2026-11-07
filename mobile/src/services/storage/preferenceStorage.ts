import { File, Paths } from 'expo-file-system'
import type { StateStorage } from 'zustand/middleware'

// Lựa chọn trên máy (thứ tự nhà, nhà/zone xem gần nhất…) lưu thành file JSON trong thư mục tài liệu của app —
// chỉ dữ liệu không bí mật; token và mọi thứ bí mật chỉ nằm trong expo-secure-store (mobile/CLAUDE.md).
// Dùng expo-file-system chứ không dùng MMKV: MMKV cần module native Nitro, không có trong Expo Go
function getPreferenceFile(key: string): File {
  return new File(Paths.document, `preferences-${key}.json`)
}

// Bộ đọc/ghi cho Zustand persist: đọc đồng bộ để store có dữ liệu ngay khi mở app; đọc/ghi lỗi thì coi như chưa lưu
export const preferenceStateStorage: StateStorage = {
  getItem: key => {
    try {
      const file = getPreferenceFile(key)
      return file.exists ? file.textSync() : null
    } catch {
      return null
    }
  },
  setItem: async (key, value) => {
    try {
      const file = getPreferenceFile(key)
      if (!file.exists) file.create()
      await file.write(value)
    } catch {
      // Không ghi được thì lần mở sau dùng giá trị mặc định — không chặn thao tác của người dùng
    }
  },
  removeItem: key => {
    try {
      const file = getPreferenceFile(key)
      if (file.exists) file.delete()
    } catch {
      // File đã không còn
    }
  },
}
