// Module EXPERT (§5.12) — báo cáo sức khỏe Zone và kết luận của Domain Expert (EXPERT-FR-005/006)

export interface ZoneHealthReportMetrics {
  sample_count: number;
  temp_in_range_pct: number | null;
  humidity_in_range_pct: number | null;
  auto_mode_pct: number | null;
  misting_switches: number;
  ventilation_switches: number;
  alerts_by_type: Record<string, number>;
  avg_return_rate: number | null;
  nh3_avg: number | null;
  nh3_max: number | null;
  co2_avg: number | null;
  co2_max: number | null;
}

export interface ExpertConclusion {
  text: string;
  by?: { _id: string; full_name?: string };
  at: string;
}

export interface ZoneHealthReport {
  _id: string;
  farm_id: string;
  zone_id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  metrics: ZoneHealthReportMetrics;
  expert_conclusion: ExpertConclusion | null;
}
