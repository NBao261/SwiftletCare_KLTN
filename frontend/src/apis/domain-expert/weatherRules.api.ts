import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type { WeatherRule, WeatherRulesProposal, WeatherRulesResponse } from '@/types/expert.types'

// ENV-FR-030 — Luật bù phun sương theo thời tiết của nhà
export const weatherRulesApi = {
  getByHouse: (houseId: string) =>
    api.get<ApiResponse<WeatherRulesResponse>>(`/farms/houses/${houseId}/weather-rules`),

  updateByHouse: (houseId: string, rules: WeatherRule[]) =>
    api.put<ApiResponse<WeatherRulesResponse>>(`/farms/houses/${houseId}/weather-rules`, { rules }),

  // BR-22, BR-38 — Farm Owner trên farm có chuyên gia gửi bộ luật; chuyên gia duyệt hoặc từ chối kèm lý do
  propose: (houseId: string, rules: WeatherRule[]) =>
    api.post<ApiResponse<WeatherRulesProposal>>(`/farms/houses/${houseId}/weather-rules/proposal`, { rules }),

  // `proposedAt` của bản đang hiển thị: đề xuất đổi trong lúc đó thì backend trả 409
  approveProposal: (houseId: string, proposedAt: string) =>
    api.post<ApiResponse<WeatherRulesResponse>>(`/farms/houses/${houseId}/weather-rules/proposal/approve`, { proposed_at: proposedAt }),

  rejectProposal: (houseId: string, note: string, proposedAt: string) =>
    api.post<ApiResponse<WeatherRulesResponse>>(`/farms/houses/${houseId}/weather-rules/proposal/reject`, { note, proposed_at: proposedAt }),
}
