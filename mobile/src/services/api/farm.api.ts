import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type {
  ApiResponse,
  Invitation,
  InviteMemberPayload,
  BirdCountTuning,
  CreateFarmPayload,
  CreateHousePayload,
  CreateZonePayload,
  DetectionTuning,
  Farm,
  FuzzyTuning,
  House,
  Thresholds,
  UpdateFarmPayload,
  Zone,
} from '@/types'

// API trang trại, House, Zone (FARM-FR-*)
export const farmApi = {
  list: () => apiClient.get<ApiResponse<Farm[]>>(ENDPOINTS.FARMS),

  getDetail: (farmId: string) => apiClient.get<ApiResponse<Farm>>(ENDPOINTS.FARM_DETAIL(farmId)),

  create: (payload: CreateFarmPayload) => apiClient.post<ApiResponse<Farm>>(ENDPOINTS.FARMS, payload),

  update: (farmId: string, payload: UpdateFarmPayload) =>
    apiClient.put<ApiResponse<Farm>>(ENDPOINTS.FARM_DETAIL(farmId), payload),

  // Xoá mềm, chỉ chủ chính (FARM-FR-001)
  remove: (farmId: string) => apiClient.delete(ENDPOINTS.FARM_DETAIL(farmId)),

  // Mời đồng sở hữu hoặc Domain Expert (AUTH-FR-005, EXPERT-FR-001) — chỉ Primary Owner; phản hồi có token lời mời,
  // nơi gọi không hiển thị, không lưu
  inviteMember: (farmId: string, payload: InviteMemberPayload) =>
    apiClient.post<ApiResponse<Invitation>>(ENDPOINTS.FARM_MEMBERS(farmId), payload),

  // Gỡ thành viên — chỉ Primary Owner, không gỡ được Primary Owner
  removeMember: (farmId: string, userId: string) =>
    apiClient.delete<ApiResponse<Farm>>(ENDPOINTS.FARM_MEMBER(farmId, userId)),

  listHouses: (farmId: string) => apiClient.get<ApiResponse<House[]>>(ENDPOINTS.FARM_HOUSES(farmId)),

  createHouse: (farmId: string, payload: CreateHousePayload) =>
    apiClient.post<ApiResponse<House>>(ENDPOINTS.FARM_HOUSES(farmId), payload),

  listZones: (houseId: string) => apiClient.get<ApiResponse<Zone[]>>(ENDPOINTS.HOUSE_ZONES(houseId)),

  createZone: (houseId: string, payload: CreateZonePayload) =>
    apiClient.post<ApiResponse<Zone>>(ENDPOINTS.HOUSE_ZONES(houseId), payload),

  // Ngưỡng của Zone (ENV-FR-006); backend kiểm min < max và khoảng đo, sai thì 400
  updateThresholds: (zoneId: string, payload: Partial<Thresholds>) =>
    apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_THRESHOLDS(zoneId), payload),

  // Ghi đè 7 ngưỡng bằng mặc định hệ thống (ENV-FR-020)
  resetThresholds: (zoneId: string) => apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_THRESHOLDS_RESET(zoneId)),

  // Hệ số bộ điều khiển mờ (ENV-FR-021)
  updateFuzzyTuning: (zoneId: string, payload: FuzzyTuning) =>
    apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_FUZZY_TUNING(zoneId), payload),

  // Áp gợi ý hệ số hiện tại (EXPERT-FR-011): server tự tính lại gợi ý và ghi nguồn SUGGESTION_APPROVED; chủ trại trên farm
  // có chuyên gia bị 403, không có gợi ý thì 409 kèm lý do
  applySuggestion: (zoneId: string) => apiClient.post<ApiResponse<Zone>>(ENDPOINTS.ZONE_APPLY_SUGGESTION(zoneId)),

  // Tham số phát hiện của Zone (EXPERT-FR-008), chỉ chuyên gia
  updateDetectionTuning: (zoneId: string, payload: DetectionTuning) =>
    apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_DETECTION_TUNING(zoneId), payload),

  // Mức giảm tỷ lệ về tổ của nhà (EXPERT-FR-008), chỉ chuyên gia
  updateBirdCountTuning: (houseId: string, payload: BirdCountTuning) =>
    apiClient.put<ApiResponse<House>>(ENDPOINTS.HOUSE_BIRD_COUNT_TUNING(houseId), payload),
}
