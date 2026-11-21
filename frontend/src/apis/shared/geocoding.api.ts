import type { Coordinates } from '@/types'

// Nominatim (OpenStreetMap): tìm toạ độ của địa chỉ, gọi thẳng từ trình duyệt khi người dùng bấm tìm.
// Chính sách của Nominatim: tối đa 1 yêu cầu/giây, không gọi theo từng phím gõ
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export const geocodingApi = {
  // Kết quả gần đúng nhất, không thấy thì null
  search: async (address: string, language: string): Promise<Coordinates | null> => {
    const params = new URLSearchParams({ q: address, format: 'jsonv2', limit: '1', 'accept-language': language })
    const response = await fetch(`${NOMINATIM_URL}?${params}`)
    if (!response.ok) throw new Error(`Nominatim ${response.status}`)
    const [first] = (await response.json()) as { lat: string; lon: string }[]
    return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null
  },
}
