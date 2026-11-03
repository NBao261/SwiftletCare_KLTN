// Dữ liệu giả màn Sức khỏe nhà yến (/health?preview) — chỉ để xem giao diện ngày và báo cáo; API thật: /health-reports/*
import { useAuthStore } from '@/stores/authStore';
import type {
  HealthLevels, HealthRatingValue, HealthReason, HealthReportKind, HealthSource, HealthStatus, HouseHealthDay,
  HouseHealthLevels, HouseHealthReport, HouseHealthReportSummary,
} from '@/types';

// Bật khi URL có ?preview (VD http://localhost:5173/health?preview)
export function isHealthPreview(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('preview');
}

interface PreviewHouse { _id: string; name: string; farm_id: string }

// Nhà thật của tài khoản (trang /health đưa vào) — không có thì dùng 2 nhà giả
const FALLBACK_HOUSES: PreviewHouse[] = [
  { _id: 'preview-house-a', name: 'Nhà yến A1', farm_id: 'preview-farm' },
  { _id: 'preview-house-b', name: 'Nhà yến B2', farm_id: 'preview-farm' },
];
let houses: PreviewHouse[] = FALLBACK_HOUSES;
export function setPreviewHouses(list: PreviewHouse[]): void {
  houses = list.length > 0 ? list : FALLBACK_HOUSES;
}

const EXPERT = { _id: 'preview-expert', full_name: 'Trần Văn Chuyên Gia' };
const CO_OWNER = { _id: 'preview-owner', full_name: 'Lê Thị Đồng Chủ' };
const ZONES = ['Tầng 1', 'Tầng 2', 'Tầng 3'];
const DAILY_CONCLUSIONS = [
  'Ồn do mưa lớn, không phải chim hoảng.',
  'Đã kiểm tra quạt hút tầng 1, NH3 về mức bình thường sau 2 giờ. Nên vệ sinh sàn tầng 1 trong tuần này để giảm NH3 kéo dài.',
];
const LONG_CONCLUSION = 'Độ ẩm tầng 2 thấp vào buổi trưa, nên tăng thời gian phun sương thêm 5 phút từ 11:00 tới 14:00.\nTỷ lệ chim về giảm đúng các ngày mưa, chưa cần xử lý thêm; tiếp tục theo dõi tiếng ồn tầng 3.';
const DEFAULT_LEVELS: HealthLevels = { in_range_slight_pct: 90, in_range_clear_pct: 75, air_slight_h: 1, air_clear_h: 4, noise_slight: 2, noise_clear: 5 };

const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const shift = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const daysAgo = (date: string): number => Math.round((Date.parse(`${vnToday()}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
const datesBetween = (from: string, to: string): string[] => {
  const dates: string[] = [];
  for (let date = from; date <= to; date = shift(date, 1)) dates.push(date);
  return dates;
};
const me = () => {
  const user = useAuthStore.getState().user;
  return { _id: user?._id ?? 'preview-me', full_name: user?.full_name ?? 'Bạn', role: user?.role === 'DOMAIN_EXPERT' ? 'DOMAIN_EXPERT' as const : 'FARM_OWNER' as const };
};

// Trạng thái xoay vòng theo ngày + nhà để bảng có đủ 4 trạng thái
const STATUS_CYCLE: HealthStatus[] = ['GOOD', 'GOOD', 'WATCH', 'GOOD', 'ACTION', 'GOOD', 'INSUFFICIENT_DATA', 'WATCH'];
const seedOf = (houseIndex: number, date: string): number => Number(date.slice(8, 10)) + Number(date.slice(5, 7)) * 3 + houseIndex * 5;

const REASONS: Record<HealthStatus, HealthReason[]> = {
  GOOD: [{ code: 'ALL_NORMAL', source: null, level: null, values: {} }],
  WATCH: [
    { code: 'ENV_IN_RANGE', source: 'environment', level: 'SLIGHT', values: { zone_name: 'Tầng 2', in_range_pct: 84.6 } },
    { code: 'NOISE_EPISODES', source: 'noise', level: 'SLIGHT', values: { episodes: 3 } },
  ],
  ACTION: [
    { code: 'FLOCK_DROP', source: 'flock', level: 'CLEAR', values: { return_rate: 68.2, drop_pct: 27.4, baseline_avg: 93.9, baseline_days: 7 } },
    { code: 'AIR_OVER_LIMIT', source: 'air', level: 'SLIGHT', values: { zone_name: 'Tầng 1', hours: 2 } },
    { code: 'RAIN_DOWNGRADE', source: null, level: null, values: { mm_per_hour: 6.5 } },
  ],
  INSUFFICIENT_DATA: [
    { code: 'MISSING_DATA', source: 'flock', level: null, values: { missing: 'EVENING' } },
    { code: 'NOT_ASSESSED', source: 'noise', level: null, values: {} },
  ],
};

function indicatorsOf(status: HealthStatus): HouseHealthDay['indicators'] {
  const level = (normal: boolean, clear = false) => (clear ? 'CLEAR' as const : normal ? 'NORMAL' as const : 'SLIGHT' as const);
  const values: Record<HealthStatus, Record<HealthSource, number | null>> = {
    GOOD: { environment: 97.2, air: 0, flock: 1.8, noise: 0 },
    WATCH: { environment: 84.6, air: 0, flock: 6.1, noise: 3 },
    ACTION: { environment: 91.3, air: 2, flock: 27.4, noise: 1 },
    INSUFFICIENT_DATA: { environment: 95.8, air: 0, flock: null, noise: null },
  };
  const row = values[status];
  return {
    environment: { value: row.environment, level: level(status !== 'WATCH') },
    air: { value: row.air, level: level(status !== 'ACTION') },
    flock: { value: row.flock, level: row.flock === null ? null : level(status !== 'ACTION', status === 'ACTION') },
    noise: { value: row.noise, level: row.noise === null ? null : level(status !== 'WATCH') },
  };
}

// Phần người dùng đã làm trên màn (đánh giá, bỏ qua, ghi chú) — mất khi tải lại trang
const myActions = new Map<string, { outcome: 'RATED' | 'SKIPPED'; rating: HealthRatingValue | null; note: string | null; at: string }>();
const levelsByHouse = new Map<string, HealthLevels>();
const customReports = new Map<string, HouseHealthReport>();

// Ngày đầy đủ (chưa che) của 1 nhà
function fullDay(house: PreviewHouse, date: string): HouseHealthDay {
  const houseIndex = Math.max(0, houses.indexOf(house));
  const seed = seedOf(houseIndex, date);
  const status = STATUS_CYCLE[seed % STATUS_CYCLE.length];
  const age = daysAgo(date);
  const dayId = `preview-day-${house._id}-${date}`;
  const rainy = seed % 3 === 0;

  // Đánh giá của tôi: 3 ngày gần nhất để trống (cần đánh giá), quá 7 ngày không làm thì hết hạn
  const action = myActions.get(dayId)
    ?? (age <= 3 ? undefined
      : age % 5 === 0 ? { outcome: 'SKIPPED' as const, rating: null, note: null, at: `${date}T14:00:00Z` }
        : age > 7 && age % 4 === 1 ? undefined
          : { outcome: 'RATED' as const, rating: (status === 'INSUFFICIENT_DATA' ? 'GOOD' : status) as HealthRatingValue, note: age % 3 === 0 ? 'Chim về hơi muộn, chiều có mưa nhẹ' : null, at: `${date}T13:30:00Z` });
  const myState = action ? action.outcome : age > 7 ? 'EXPIRED' as const : 'PENDING' as const;

  const self = me();
  const ratings: NonNullable<HouseHealthDay['ratings']> = [];
  if (action) {
    ratings.push({
      _id: `${dayId}-me`, by: { _id: self._id, full_name: self.full_name }, role: self.role, outcome: action.outcome, rating: action.rating,
      note: action.note, at: action.at, snapshot: { status: age % 6 === 4 ? 'GOOD' : status, reasons: REASONS[status] },
    });
  }
  if (seed % 2 === 0) {
    const other = self.role === 'DOMAIN_EXPERT' ? CO_OWNER : EXPERT;
    ratings.push({
      _id: `${dayId}-other`, by: other, role: other === EXPERT ? 'DOMAIN_EXPERT' : 'FARM_OWNER', outcome: 'RATED',
      rating: status === 'ACTION' ? 'WATCH' : 'GOOD', note: status === 'ACTION' ? 'Đã kiểm tra quạt hút tầng 1, NH3 giảm sau 2 giờ' : null,
      at: `${date}T15:10:00Z`, snapshot: { status, reasons: REASONS[status] },
    });
  }

  return {
    _id: dayId,
    house_id: house._id,
    house_name: house.name,
    farm_id: house.farm_id,
    date,
    weather: seed % 9 === 0 ? null : {
      temperature_min: 24 + (seed % 3), temperature_max: 32 + (seed % 4) + 0.5, humidity_avg: 76 + (seed % 10),
      precipitation_mm: rainy ? 4.5 + (seed % 7) : 0, hours: 24,
    },
    computed_at: `${date}T12:20:00Z`,
    my_rating_state: myState,
    rating_deadline: `${shift(date, 8)}T00:00:00+07:00`,
    indicators: indicatorsOf(status),
    completeness: { environment: true, air: true, flock: status !== 'INSUFFICIENT_DATA', noise: status !== 'INSUFFICIENT_DATA' },
    current_status: status,
    current_reasons: REASONS[status],
    evidence: { noise_alert_ids: [] },
    ratings,
  };
}

// BR-31: ngày tôi còn PENDING không có trạng thái, lý do, chỉ số, đánh giá của người khác
function maskDay(day: HouseHealthDay): HouseHealthDay {
  if (day.my_rating_state !== 'PENDING') return day;
  const { indicators: _indicators, completeness: _completeness, current_status: _status, current_reasons: _reasons, evidence: _evidence, ratings: _ratings, ...rest } = day;
  return rest;
}

function housesOf(scope: { houseId?: string; farmId?: string }): PreviewHouse[] {
  if (scope.houseId) return houses.filter(house => house._id === scope.houseId);
  if (scope.farmId) return houses.filter(house => house.farm_id === scope.farmId);
  return houses;
}

// Ngày đã tính trạng thái: tới hôm qua (đánh giá ngày chạy buổi tối)
export function previewListDays(scope: { houseId?: string; farmId?: string; from?: string; to?: string; myRatingState?: string }): HouseHealthDay[] {
  const yesterday = shift(vnToday(), -1);
  const to = scope.to && scope.to < yesterday ? scope.to : yesterday;
  const from = scope.from ?? shift(to, -6);
  return housesOf(scope)
    .flatMap(house => datesBetween(from, to).map(date => fullDay(house, date)))
    .filter(day => !scope.myRatingState || day.my_rating_state === scope.myRatingState)
    .map(maskDay);
}

function findDay(dayId: string): HouseHealthDay {
  const house = houses.find(item => dayId.startsWith(`preview-day-${item._id}-`)) ?? houses[0];
  return fullDay(house, dayId.slice(-10));
}

export const previewGetDay = (dayId: string): HouseHealthDay => maskDay(findDay(dayId));

export function previewRate(dayId: string, rating: HealthRatingValue, note?: string): HouseHealthDay {
  myActions.set(dayId, { outcome: 'RATED', rating, note: note || null, at: new Date().toISOString() });
  return findDay(dayId);
}

export function previewSkip(dayId: string): HouseHealthDay {
  myActions.set(dayId, { outcome: 'SKIPPED', rating: null, note: null, at: new Date().toISOString() });
  return findDay(dayId);
}

export function previewAddNote(dayId: string, note: string): HouseHealthDay {
  const day = findDay(dayId);
  const mine = day.ratings?.find(rating => rating._id.endsWith('-me'));
  if (mine) myActions.set(dayId, { outcome: mine.outcome, rating: mine.rating, note, at: mine.at });
  return findDay(dayId);
}

export function previewLevels(houseId: string): HouseHealthLevels {
  return { house_id: houseId, health_levels: levelsByHouse.get(houseId) ?? DEFAULT_LEVELS, defaults: DEFAULT_LEVELS };
}

export function previewUpdateLevels(houseId: string, levels: Partial<HealthLevels>): HouseHealthLevels {
  levelsByHouse.set(houseId, { ...(levelsByHouse.get(houseId) ?? DEFAULT_LEVELS), ...levels });
  return previewLevels(houseId);
}

export function previewCsv(scope: { houseId?: string; farmId?: string; from?: string; to?: string }): Blob {
  const rows = previewListDays(scope).map(day => [day.date, day.house_name, day.current_status ?? '', day.my_rating_state].join(','));
  return new Blob([`\ufeffNgày,Nhà yến,Trạng thái,Đánh giá của bạn\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
}

// ── Báo cáo theo nhà ──

function buildReport(house: PreviewHouse, kind: HealthReportKind, from: string, to: string, generatedAt: string): HouseHealthReport {
  const days = datesBetween(from, to).map(date => fullDay(house, date));
  const shown = days.map(maskDay);
  const status_counts: Record<HealthStatus, number> = { GOOD: 0, WATCH: 0, ACTION: 0, INSUFFICIENT_DATA: 0 };
  for (const day of shown) if (day.current_status) status_counts[day.current_status]++;
  const trend = days.map(day => ({
    date: day.date,
    return_rate: day.current_status === 'ACTION' ? 68.2 : 88 + (seedOf(0, day.date) % 9),
    complete: day.current_status !== 'INSUFFICIENT_DATA',
  }));
  const complete = trend.filter(day => day.complete);
  const weatherDays = days.flatMap(day => (day.weather ? [day.weather] : []));
  const isOld = daysAgo(to) > 6;
  const dayStatus = days[days.length - 1]?.current_status;
  const conclusion = kind === 'DAILY'
    ? (daysAgo(to) >= 2 && (dayStatus === 'ACTION' || dayStatus === 'WATCH') ? DAILY_CONCLUSIONS[seedOf(0, to) % DAILY_CONCLUSIONS.length] : null)
    : isOld ? LONG_CONCLUSION : null;
  return {
    _id: `preview-report-${house._id}-${kind}-${from}-${to}`,
    farm_id: house.farm_id,
    house_id: house._id,
    house_name: house.name,
    kind,
    period_start: from,
    period_end: to,
    generated_at: generatedAt,
    has_conclusion: Boolean(conclusion),
    house_metrics: {
      return_rate_trend: trend,
      avg_return_rate: complete.length ? Math.round((complete.reduce((sum, day) => sum + day.return_rate, 0) / complete.length) * 10) / 10 : null,
      weather: weatherDays.length === 0 ? null : {
        temperature_min: Math.min(...weatherDays.map(weather => weather.temperature_min ?? 99)),
        temperature_max: Math.max(...weatherDays.map(weather => weather.temperature_max ?? -99)),
        humidity_avg: Math.round(weatherDays.reduce((sum, weather) => sum + (weather.humidity_avg ?? 0), 0) / weatherDays.length * 10) / 10,
        precipitation_mm: Math.round(weatherDays.reduce((sum, weather) => sum + (weather.precipitation_mm ?? 0), 0) * 10) / 10,
        rain_days: weatherDays.filter(weather => (weather.precipitation_mm ?? 0) >= 1).length,
      },
    },
    zone_sections: ZONES.map((zone_name, index) => ({
      zone_id: `preview-zone-${index}`,
      zone_name,
      sample_count: 288 * days.length - index * 12,
      temp_in_range_pct: 96.4 - index * 3.1,
      humidity_in_range_pct: index === 1 ? 82.7 : 93.5,
      auto_mode_pct: index === 0 ? 97.8 : 100,
      misting_switches: 6 * days.length + index,
      ventilation_switches: 2 * days.length,
      alerts_by_type: (index === 1 ? { THRESHOLD_BREACH: 2, NOISE_ANOMALY: 1 } : index === 0 ? { THRESHOLD_BREACH: 1 } : {}) as Record<string, number>,
      inferred_alerts: { confirmed: index === 1 ? 1 : 0, dismissed: index === 0 ? 1 : 0, pending: index === 2 ? 1 : 0 },
      device_faults: (index === 2 ? { SENSOR_FAULT: 1, NODE_OFFLINE: 2 } : {}) as Record<string, number>,
      nh3_avg: 4.2 + index, nh3_max: 11.5 + index * 2,
      co2_avg: 620 + index * 40, co2_max: index === 0 ? 1850 : 1320,
    })),
    days: shown,
    status_counts,
    hidden_days: shown.filter(day => !day.current_status).length,
    expert_conclusion: conclusion ? {
      text: conclusion,
      by: EXPERT,
      at: `${shift(to, 2)}T02:15:00Z`,
      edited_at: daysAgo(to) > 20 ? `${shift(to, 3)}T08:40:00Z` : null,
    } : null,
  };
}

// BR-33: báo cáo ngày 19:25 cùng ngày, tuần/tháng 06:00 sáng hôm sau ngày cuối kỳ (giờ VN)
const scheduledAt = (kind: HealthReportKind, to: string): string => (kind === 'DAILY' ? `${to}T12:25:00Z` : `${to}T23:00:00Z`);

function scheduledReports(house: PreviewHouse): HouseHealthReport[] {
  const yesterday = shift(vnToday(), -1);
  const reports: HouseHealthReport[] = [];
  // 7 báo cáo ngày gần nhất
  for (let offset = 0; offset < 7; offset++) {
    const date = shift(yesterday, -offset);
    reports.push(buildReport(house, 'DAILY', date, date, scheduledAt('DAILY', date)));
  }
  // 4 tuần gần nhất (thứ Hai → Chủ nhật)
  const today = vnToday();
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thisMonday = shift(today, -weekday);
  for (let week = 1; week <= 4; week++) {
    const start = shift(thisMonday, -7 * week);
    reports.push(buildReport(house, 'WEEKLY', start, shift(start, 6), scheduledAt('WEEKLY', shift(start, 6))));
  }
  // 2 tháng trước
  for (let month = 1; month <= 2; month++) {
    const first = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    first.setUTCMonth(first.getUTCMonth() - month);
    const start = first.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    reports.push(buildReport(house, 'MONTHLY', start, end, scheduledAt('MONTHLY', end)));
  }
  return reports;
}

const summaryOf = (report: HouseHealthReport): HouseHealthReportSummary => ({
  _id: report._id, farm_id: report.farm_id, house_id: report.house_id, house_name: report.house_name, kind: report.kind,
  period_start: report.period_start, period_end: report.period_end, generated_at: report.generated_at, has_conclusion: report.has_conclusion,
  expert_conclusion: report.expert_conclusion,
});

export function previewListReports(scope: { houseId?: string; farmId?: string; kind?: HealthReportKind }): HouseHealthReportSummary[] {
  const scoped = housesOf(scope);
  const custom = [...customReports.values()].filter(report => scoped.some(house => house._id === report.house_id));
  return [...custom, ...scoped.flatMap(scheduledReports)]
    .filter(report => !scope.kind || report.kind === scope.kind)
    .sort((left, right) => right.period_end.localeCompare(left.period_end) || left.kind.localeCompare(right.kind))
    .map(summaryOf);
}

// Đọc lại mỗi lần để ngày vừa đánh giá hiện trạng thái
export function previewGetReport(reportId: string): HouseHealthReport {
  // id = preview-report-<houseId>-<kind>-<from>-<to>
  const to = reportId.slice(-10);
  const from = reportId.slice(-21, -11);
  const kind = reportId.slice(0, -22).split('-').pop() as HealthReportKind;
  const house = houses.find(item => reportId.startsWith(`preview-report-${item._id}-`)) ?? houses[0];
  const stored = customReports.get(reportId);
  return buildReport(house, kind, from, to, stored?.generated_at ?? scheduledAt(kind, to));
}

export function previewCreateReport(input: { houseId: string; from: string; to: string }): HouseHealthReport {
  const house = houses.find(item => item._id === input.houseId) ?? houses[0];
  const report = buildReport(house, 'CUSTOM', input.from, input.to, new Date().toISOString());
  customReports.set(report._id, report);
  return report;
}
