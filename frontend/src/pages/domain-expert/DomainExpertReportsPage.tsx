// DomainExpertReportsPage — Báo cáo & Kết luận, Ngày đánh giá lệch & Mức chỉ số, Kết luận mùa vụ (EXPERT-FR-005/006, EXPERT-FR-020/022, BR-28)
import { useSearchParams } from 'react-router-dom';
import { useZoneStore } from '@/stores/zoneStore';
import { t as i18nT } from '@/i18n';
import DisagreementsSection from '@/components/common/DisagreementsSection';
import HealthReportSection from '@/components/common/HealthReportSection';
import HarvestCyclesSection from '@/components/features/domain-expert/harvest/HarvestCyclesSection';
import { shiftDate, vietnamDate } from '@/components/common/healthDay.utils';
import { useHealthDisagreements } from '@/hooks/domain-expert/useHealthDisagreements';
import { useHouses } from '@/hooks/shared/useFarms';
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights';

type ReportsPageTab = 'reports' | 'disagreements' | 'harvest-cycles';

export default function DomainExpertReportsPage() {
  const { selectedFarmId, selectedFarmName, selectedHouseId } = useZoneStore();
  const { data: farmHouses = [] } = useHouses(selectedFarmId ?? undefined);
  const house = farmHouses.find(item => item._id === selectedHouseId);
  const [searchParams, setSearchParams] = useSearchParams();
  // Ngày lệch (EXPERT-FR-022) là việc của chuyên gia, hoặc Farm Owner khi farm chưa có chuyên gia (BR-22):
  // Farm Owner của farm có chuyên gia không có tab này (backend trả 403), thay vì thấy lỗi
  const { canDecide: canReviewDisagreements } = useExpertDecisionRights();

  const rawTab = searchParams.get('tab');
  const activeTab: ReportsPageTab =
    rawTab === 'disagreements' && canReviewDisagreements ? 'disagreements'
    : rawTab === 'harvest-cycles' ? 'harvest-cycles'
    : 'reports';

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
  }, { enabled: canReviewDisagreements });

  // Báo cáo theo nhà đang chọn, không chọn nhà thì cả farm
  let reportScope: { houseId?: string; farmId?: string } | null = null;
  if (house) reportScope = { houseId: house._id };
  else if (selectedFarmId) reportScope = { farmId: selectedFarmId };

  return (
    <div className="relative z-10 w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto flex flex-col gap-5">
        {/* DE-08: Tabs kiểu SectionTabs + mô tả 1 dòng */}
        <div className="flex flex-wrap items-center gap-4">
          <nav aria-label={i18nT('Báo cáo và ngày đánh giá lệch')} className="inline-flex gap-1 rounded-full bg-warmGray/10 p-1">
            <button
              type="button"
              onClick={() => setTab('reports')}
              aria-current={activeTab === 'reports' ? 'page' : undefined}
              className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150 ${
                activeTab === 'reports'
                  ? 'bg-white text-charcoal shadow-card'
                  : 'text-warmGray hover:text-charcoal'
              }`}
            >
              {i18nT('Báo cáo & Kết luận')}
            </button>

            {canReviewDisagreements && (
            <button
              type="button"
              onClick={() => setTab('disagreements')}
              aria-current={activeTab === 'disagreements' ? 'page' : undefined}
              className={`flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150 ${
                activeTab === 'disagreements'
                  ? 'bg-white text-charcoal shadow-card'
                  : 'text-warmGray hover:text-charcoal'
              }`}
            >
              {i18nT('Ngày lệch & Mức chỉ số')}
              {disagreeingDaysCount > 0 && (
                <span className="rounded-full bg-orange-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                  {disagreeingDaysCount}
                </span>
              )}
            </button>
            )}

            <button
              type="button"
              onClick={() => setTab('harvest-cycles')}
              aria-current={activeTab === 'harvest-cycles' ? 'page' : undefined}
              className={`flex h-9 items-center whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150 ${
                activeTab === 'harvest-cycles'
                  ? 'bg-white text-charcoal shadow-card'
                  : 'text-warmGray hover:text-charcoal'
              }`}
            >
              {i18nT('Kết luận mùa vụ')}
            </button>
          </nav>
          <span className="text-xs text-warmGray">
            {activeTab === 'reports'
              ? i18nT('Viết kết luận gửi Chủ nhà yến')
              : activeTab === 'harvest-cycles'
              ? i18nT('Kết luận chu kỳ thu hoạch đã đóng')
              : i18nT('Đối chiếu đánh giá tại nhà yến với trạng thái hệ thống')}
          </span>
        </div>

        {activeTab === 'reports' ? (
          <HealthReportSection scope={reportScope} house={house ? { id: house._id, name: house.name } : null} />
        ) : activeTab === 'harvest-cycles' ? (
          <HarvestCyclesSection scope={reportScope} />
        ) : (
          <DisagreementsSection farmId={selectedFarmId ?? ''} farmName={selectedFarmName ?? ''} houseId={selectedHouseId ?? ''} />
        )}
      </div>
    </div>
  );
}
