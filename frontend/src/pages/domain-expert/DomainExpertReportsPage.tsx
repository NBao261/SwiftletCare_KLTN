/**
 * DomainExpertReportsPage — Báo cáo & Kết luận + Xem Ngày Đánh Giá Lệch (EXPERT-FR-005/006/007, EXPERT-FR-022, BR-28)
 *
 * Rename + re-bucket từ ExpertReportsPage:
 *   Cũ: pages/expert/ExpertReportsPage.tsx  →  /expert/reports
 *   Mới: pages/domain-expert/DomainExpertReportsPage.tsx  →  /domain-expert/reports
 *
 * Hỗ trợ 2 phân hệ qua URL query (?tab=disagreements):
 *   - Tab 1 (mặc định): Báo cáo & Kết luận định kỳ — báo cáo theo nhà (ngày/tuần/tháng/theo yêu cầu) của farm hoặc nhà
 *     đang chọn; mở 1 báo cáo để viết kết luận (EXPERT-FR-006)
 *   - Tab 2 (?tab=disagreements): Xem Ngày Đánh Giá Lệch & Chỉnh Mức Chỉ Số Nhà Yến (EXPERT-FR-022, BR-28)
 *
 * Bucket: pages/domain-expert/ — §12.4.
 */
import { useSearchParams } from 'react-router-dom';
import { FileText, Scale } from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import { t as i18nT } from '@/i18n';
import DisagreementsSection from '@/components/common/DisagreementsSection';
import HealthReportSection from '@/components/common/HealthReportSection';
import { shiftDate, vietnamDate } from '@/components/common/healthDay.utils';
import { useHealthDisagreements } from '@/hooks/domain-expert/useHealthDisagreements';
import { useHouses } from '@/hooks/shared/useFarms';

type ReportsPageTab = 'reports' | 'disagreements';

export default function DomainExpertReportsPage() {
  const { selectedFarmId, selectedFarmName, selectedHouseId } = useZoneStore();
  const { data: farmHouses = [] } = useHouses(selectedFarmId ?? undefined);
  const house = farmHouses.find(item => item._id === selectedHouseId);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: ReportsPageTab =
    searchParams.get('tab') === 'disagreements' ? 'disagreements' : 'reports';

  const setTab = (tab: ReportsPageTab) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (tab === 'reports') next.delete('tab');
        else next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };

  // Đếm số ngày lệch trong 14 ngày gần nhất của trang trại để hiển thị badge trên Tab (EXPERT-FR-022)
  const to = vietnamDate();
  const from = shiftDate(to, -13);
  const { totalDays: disagreeingDaysCount } = useHealthDisagreements({
    farmId: selectedFarmId ?? undefined,
    from,
    to,
  });

  // Báo cáo theo nhà đang chọn, không chọn nhà thì cả farm
  let reportScope: { houseId?: string; farmId?: string } | null = null;
  if (house) reportScope = { houseId: house._id };
  else if (selectedFarmId) reportScope = { farmId: selectedFarmId };

  return (
    <div className="relative z-10 w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto flex flex-col gap-5">
        {/* Thanh chuyển phân hệ: Báo cáo & Kết luận định kỳ vs. Ngày đánh giá lệch & Mức chỉ số */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warmGray/20 bg-white px-4 py-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={i18nT('Báo cáo và ngày đánh giá lệch')}>
            <button
              id="tab-periodic-reports"
              type="button"
              role="tab"
              aria-selected={activeTab === 'reports'}
              aria-controls="panel-periodic-reports"
              onClick={() => setTab('reports')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal ${
                activeTab === 'reports'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20 hover:text-charcoal'
              }`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{i18nT('Báo cáo & Kết luận định kỳ')}</span>
            </button>

            <button
              id="tab-disagreements"
              type="button"
              role="tab"
              aria-selected={activeTab === 'disagreements'}
              aria-controls="panel-disagreements"
              onClick={() => setTab('disagreements')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal ${
                activeTab === 'disagreements'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20 hover:text-charcoal'
              }`}
            >
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{i18nT('Ngày đánh giá lệch & Mức chỉ số')}</span>
              {disagreeingDaysCount > 0 && (
                <span className="rounded-full bg-amber-600 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white">
                  {disagreeingDaysCount}
                </span>
              )}
            </button>
          </div>

          <span className="text-xs text-warmGray">
            {activeTab === 'reports'
              ? i18nT('Mở một báo cáo để viết kết luận gửi Chủ nhà yến')
              : i18nT('Đối chiếu đánh giá tại nhà yến với trạng thái hệ thống và chỉnh mức chỉ số của nhà')}
          </span>
        </div>

        {activeTab === 'reports' ? (
          <div
            id="panel-periodic-reports"
            role="tabpanel"
            aria-labelledby="tab-periodic-reports"
          >
            <HealthReportSection scope={reportScope} house={house ? { id: house._id, name: house.name } : null} />
          </div>
        ) : (
          <div
            id="panel-disagreements"
            role="tabpanel"
            aria-labelledby="tab-disagreements"
            className="w-full"
          >
            <DisagreementsSection farmId={selectedFarmId ?? ''} farmName={selectedFarmName ?? ''} houseId={selectedHouseId ?? ''} />
          </div>
        )}
      </div>
    </div>
  );
}
