import type { Coordinates } from '@/types';

// Photon gợi ý địa chỉ, gọi thẳng từ trình duyệt. Dùng fetch vì axios gắn base /api và token
const PHOTON_URL = 'https://photon.komoot.io/api/';
const SUGGESTION_LIMIT = 5;
// Ưu tiên kết quả gần Việt Nam (không loại kết quả nước khác)
const BIAS = { lat: '16', lon: '106' };

export interface AddressSuggestion {
  label: string;
  coordinates: Coordinates;
}

interface PhotonFeature {
  properties: Record<string, string | undefined>;
  geometry: { coordinates: [number, number] };
}

// "Tên, số nhà + đường, khu phố, quận, thành phố, tỉnh, nước": bỏ phần trống và phần trùng
export function suggestionLabel(properties: PhotonFeature['properties']): string {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
  const parts = [
    properties.name,
    street,
    properties.locality,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
    properties.country,
  ];
  return [...new Set(parts.filter((part): part is string => Boolean(part?.trim())))].join(', ');
}

export const geocodingApi = {
  // 'default' là tên địa phương, Photon không có tiếng Việt
  suggest: async (query: string, lang: 'vi' | 'en', signal?: AbortSignal): Promise<AddressSuggestion[]> => {
    const params = new URLSearchParams({
      q: query,
      limit: String(SUGGESTION_LIMIT),
      lang: lang === 'en' ? 'en' : 'default',
      ...BIAS,
    });
    const response = await fetch(`${PHOTON_URL}?${params}`, { signal });
    if (!response.ok) throw new Error(`Photon ${response.status}`);
    const { features } = (await response.json()) as { features: PhotonFeature[] };
    return features.map(feature => ({
      label: suggestionLabel(feature.properties),
      coordinates: { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] },
    }));
  },
};
