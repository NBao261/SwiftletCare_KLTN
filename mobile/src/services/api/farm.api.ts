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
  FarmOverview,
  FuzzyTuning,
  House,
  HouseStage,
  CountingSchedule,
  CountingScheduleView,
  HealthLevels,
  HouseHealthLevelsView,
  WeatherRule,
  WeatherRulesProposal,
  WeatherRulesView,
  Thresholds,
  UpdateFarmPayload,
  UpdateHousePayload,
  UpdateZonePayload,
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

  // Sửa, xoá mềm nhà và zone (FARM-FR-002): chỉ Farm Owner. Tên trùng 409 DUPLICATE_NAME, số tầng thấp hơn tầng của zone 400,
  // còn thiết bị đang dùng thì xoá bị 409 HAS_ACTIVE_DEVICES
  updateHouse: (houseId: string, payload: UpdateHousePayload) =>
    apiClient.put<ApiResponse<House>>(ENDPOINTS.HOUSE_DETAIL(houseId), payload),
  deleteHouse: (houseId: string) => apiClient.delete<ApiResponse<null>>(ENDPOINTS.HOUSE_DETAIL(houseId)),
  updateZone: (zoneId: string, payload: UpdateZonePayload) =>
    apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_DETAIL(zoneId), payload),
  deleteZone: (zoneId: string) => apiClient.delete<ApiResponse<null>>(ENDPOINTS.ZONE_DETAIL(zoneId)),

  // Ngưỡng của Zone (ENV-FR-006); backend kiểm min < max và khoảng đo, sai thì 400
  updateThresholds: (zoneId: string, payload: Partial<Thresholds>) =>
    apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_THRESHOLDS(zoneId), payload),

  // Ghi đè 7 ngưỡng bằng mặc định hệ thống (ENV-FR-020)
  resetThresholds: (zoneId: string) => apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_THRESHOLDS_RESET(zoneId)),

  // Hệ số bộ điều khiển fuzzy (ENV-FR-021)
  updateFuzzyTuning: (zoneId: string, payload: FuzzyTuning) =>
    apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_FUZZY_TUNING(zoneId), payload),

  // Áp gợi ý hệ số hiện tại (EXPERT-FR-011): server tự tính lại gợi ý và ghi nguồn SUGGESTION_APPROVED; chủ trại trên farm
  // có chuyên gia bị 403, không có gợi ý thì 409 kèm lý do
  applySuggestion: (zoneId: string) => apiClient.post<ApiResponse<Zone>>(ENDPOINTS.ZONE_APPLY_SUGGESTION(zoneId)),

  // Tham số phát hiện của Zone (EXPERT-FR-008): chuyên gia, chủ trại (farm có chuyên gia thì mở mục duyệt, BR-22)
  updateDetectionTuning: (zoneId: string, payload: DetectionTuning) =>
    apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_DETECTION_TUNING(zoneId), payload),

  // Mức giảm tỷ lệ về tổ của nhà (EXPERT-FR-008): chuyên gia, chủ trại (farm có chuyên gia thì mở mục duyệt, BR-22)
  updateBirdCountTuning: (houseId: string, payload: BirdCountTuning) =>
    apiClient.put<ApiResponse<House>>(ENDPOINTS.HOUSE_BIRD_COUNT_TUNING(houseId), payload),

  // Đưa về mặc định của backend (EXPERT-FR-008), không body: 5 tham số phát hiện của zone, mức giảm tỷ lệ về tổ 20 % của nhà
  resetDetectionTuning: (zoneId: string) => apiClient.put<ApiResponse<Zone>>(ENDPOINTS.ZONE_DETECTION_TUNING_RESET(zoneId)),
  resetBirdCountTuning: (houseId: string) => apiClient.put<ApiResponse<House>>(ENDPOINTS.HOUSE_BIRD_COUNT_TUNING_RESET(houseId)),

  // Giai đoạn nhà (FARM-FR-014): đổi được lưu lịch sử, đánh giá ngày tiếp theo theo giai đoạn mới (BR-46)
  setHouseStage: (houseId: string, stage: HouseStage) =>
    apiClient.put<ApiResponse<House>>(ENDPOINTS.HOUSE_STAGE(houseId), { stage }),

  // Tổng quan farm hôm nay (ANALYTICS-FR-015): giai đoạn, trạng thái ngày, cảnh báo và phiếu đang mở của từng nhà
  getOverview: (farmId: string) => apiClient.get<ApiResponse<FarmOverview>>(ENDPOINTS.FARM_OVERVIEW(farmId)),

  // Luật bù thời tiết của nhà (ENV-FR-030): đọc kèm lần bù gần nhất; lưu là thay cả danh sách (tối đa 10 luật)
  getWeatherRules: (houseId: string) => apiClient.get<ApiResponse<WeatherRulesView>>(ENDPOINTS.HOUSE_WEATHER_RULES(houseId)),
  updateWeatherRules: (houseId: string, rules: WeatherRule[]) =>
    // PUT chỉ trả house_id và rules (api-spec), không kèm last_compensation
    apiClient.put<ApiResponse<Omit<WeatherRulesView, 'last_compensation'>>>(ENDPOINTS.HOUSE_WEATHER_RULES(houseId), { rules }),
  // Farm Owner trên farm có chuyên gia gửi bộ luật để chuyên gia duyệt (BR-22, BR-38); luật đang chạy không đổi, gửi lại thì thay
  // đề xuất cũ. Farm chưa có chuyên gia thì 409
  proposeWeatherRules: (houseId: string, rules: WeatherRule[]) =>
    apiClient.post<ApiResponse<WeatherRulesProposal>>(ENDPOINTS.HOUSE_WEATHER_RULES_PROPOSAL(houseId), { rules }),

  // Lịch đếm chim của nhà (VISION-FR-019): lưu là thay cả lịch, áp từ ngày hôm sau (giờ VN)
  getCountingSchedule: (houseId: string) =>
    apiClient.get<ApiResponse<CountingScheduleView>>(ENDPOINTS.HOUSE_COUNTING_SCHEDULE(houseId)),
  updateCountingSchedule: (houseId: string, schedule: CountingSchedule) =>
    apiClient.put<ApiResponse<CountingScheduleView>>(ENDPOINTS.HOUSE_COUNTING_SCHEDULE(houseId), schedule),

  // Mức chỉ số sức khỏe của nhà (BR-28, EXPERT-FR-022)
  getHealthLevels: (houseId: string) =>
    apiClient.get<ApiResponse<HouseHealthLevelsView>>(ENDPOINTS.HOUSE_HEALTH_LEVELS(houseId)),
  updateHealthLevels: (houseId: string, levels: HealthLevels) =>
    apiClient.put<ApiResponse<HouseHealthLevelsView>>(ENDPOINTS.HOUSE_HEALTH_LEVELS(houseId), levels),
}
