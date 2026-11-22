// DomainExpertReportsPage: Báo cáo & Kết luận, Ngày đánh giá lệch & Mức chỉ số, Kết luận mùa vụ
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
  // Farm Owner của farm có chuyên gia không có tab này (backend trả 403)
  const { canDecide: canReviewDisagreements } = useExpertDecisionRights();

  const rawTab = searchParams.get('tab');
  let activeTab: ReportsPageTab = 'reports';
  if (rawTab === 'disagreements' && canReviewDisagreements) {
    activeTab = 'disagreements';
  } else if (rawTab === 'harvest-cycles') {
    activeTab = 'harvest-cycles';
  }

  const setTab = (tab: ReportsPageTab) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (tab === 'reports') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true },
    );
  };

  // Đếm số ngày lệch trong 14 ngày gần nhất của trang trại để hiển thị badge trên Tab
  const to = vietnamDate();
  const from = shiftDate(to, -13);
  const { totalDays: disagreeingDaysCount } = useHealthDisagreements({
    farmId: selectedFarmId ?? undefined,
    from,
    to,
  }, { enabled: canReviewDisagreements });

  // Báo cáo theo nhà đang chọn, không chọn nhà thì cả farm
  let reportScope: { houseId?: string; farmId?: string } | null = null;
  if (house) {
    reportScope = { houseId: house._id };
  } else if (selectedFarmId) {
    reportScope = { farmId: selectedFarmId };
  }

  function getTabDescription(tab: ReportsPageTab): string {
    if (tab === 'reports') {
      return i18nT('Viết kết luận gửi Chủ nhà yến');
    }
    if (tab === 'harvest-cycles') {
      return i18nT('Kết luận chu kỳ thu hoạch đã đóng');
    }
    return i18nT('Đối chiếu đánh giá tại nhà yến với trạng thái hệ thống');
  }

  function renderTabContent() {
    if (activeTab === 'reports') {
      return (
        <HealthReportSection
          scope={reportScope}
          house={house ? { id: house._id, name: house.name } : null}
        />
      );
    }
    if (activeTab === 'harvest-cycles') {
      return <HarvestCyclesSection scope={reportScope} />;
    }
    return (
      <DisagreementsSection
        farmId={selectedFarmId ?? ''}
        farmName={selectedFarmName ?? ''}
        houseId={selectedHouseId ?? ''}
      />
    );
  }

  return (
    <div className="relative z-10 w-full flex-1 flex flex-col gap-5">
      <div className="w-full max-w-screen-xl mx-auto flex flex-col gap-5">
        {/* DE-08: Tabs kiểu SectionTabs + mô tả 1 dòng */}
        <div className="flex flex-wrap items-center gap-4">
          <nav aria-label={i18nT('Báo cáo và ngày đánh giá lệch')} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-warmGray/10 p-1 max-sm:flex-wrap max-sm:rounded-3xl">
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
              {i18nT('Ngày lệch')}
              {disagreeingDaysCount > 0 && (
                <span className="rounded-full bg-orange-600 px-2 py-0.5 text-small font-bold tabular-nums text-white">
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
            {getTabDescription(activeTab)}
          </span>
        </div>

        {renderTabContent()}
      </div>
    </div>
  );
}
