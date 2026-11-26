// Thẩm định cảnh báo suy luận
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { SectionCard } from '@/components/ui';
import StatusTabs from '@/components/common/StatusTabs';
import SelectMenu from '@/components/ui/SelectMenu';
import ClearFiltersButton from '@/components/ui/ClearFiltersButton';
import {
  TYPE_OPTS,
  INFERRED_SEVERITIES,
  TAB_ORDER,
  TAB_LABEL,
} from '@/components/features/domain-expert/alerts/alertFilters';
import { useAlert } from '@/hooks/shared/useAlerts';
import InferredAlertsTable from '@/components/features/domain-expert/alerts/InferredAlertsTable';
import ExpertVerdictDrawer from '@/components/features/domain-expert/alerts/ExpertVerdictDrawer';
import {
  useAlertsWithFilters,
  useExpertVerdictStats,
  buildVerdictStatsSummary,
  type AlertTabFilter,
} from '@/hooks/domain-expert/useExpertAlerts';
import type { InferredAlertItem, InferredAlertType } from '@/types/expert.types';
import type { AlertSeverity } from '@/types';
import { useZoneStore } from '@/stores/zoneStore';
import { useAllZones } from '@/hooks/shared/useFarms';
import { t } from '@/i18n';
import { SEVERITY_TO_LEVEL } from '@/constants/severity';
import { levelDict } from '@/constants/severity.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';

function Toast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 bg-[#27231F] text-[#ECFFA9]">
      <Check className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}

export default function DomainExpertAlertVerdictsPage() {
  const [searchParams] = useSearchParams();
  const { selectedFarmId } = useZoneStore();
  const farmId = selectedFarmId ?? undefined;

  // Mặc định cả trang trại, Zone là bộ lọc trong card: mọi zone của farm (không giới hạn 1 nhà)
  const [filterZoneId, setFilterZoneId] = useState<string | undefined>(undefined);
  const { data: allZones } = useAllZones();
  const zoneOptions = [
    { value: 'ALL', label: t('Tất cả Zone') },
    ...(allZones ?? []).filter(zone => zone.farmId === farmId).map(zone => ({ value: zone._id, label: zone.name })),
  ];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<InferredAlertItem | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });

  const {
    filters,
    setTab,
    setType,
    setSeverity,
    setPage,
    paginatedAlerts,
    filteredTotal,
    kpiCounts,
    isLoading,
    pageSize,
  } = useAlertsWithFilters(farmId, filterZoneId);
  // Ô lọc mức độ theo cấp chung (FE_Design 2.4)
  const { t: levelLabel } = useTranslation(levelDict);
  const severityOptions = [
    { value: 'ALL', label: t('Mức độ') },
    ...INFERRED_SEVERITIES.map(severity => ({ value: severity, label: levelLabel(SEVERITY_TO_LEVEL[severity]) })),
  ];

  const { data: verdictStats = [] } = useExpertVerdictStats(farmId, filterZoneId);
  const statsSummary = buildVerdictStatsSummary(verdictStats);

  const targetAlertId = searchParams.get('alertId');
  const initialTab = searchParams.get('tab');

  useEffect(() => {
    if (initialTab && ['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'].includes(initialTab.toUpperCase())) {
      setTab(initialTab.toUpperCase() as AlertTabFilter);
    }
  }, [initialTab, setTab]);

  // Link từ thông báo (?alertId=): cảnh báo có thể không nằm ở trang đang xem → đọc thẳng GET /alerts/:id
  const targetOnPage = paginatedAlerts.find(alert => alert._id === targetAlertId);
  const { data: targetFromApi } = useAlert(targetAlertId && !targetOnPage && !selectedAlert ? targetAlertId : null);

  useEffect(() => {
    if (!targetAlertId || selectedAlert) return;
    const match = targetOnPage ?? (targetFromApi as InferredAlertItem | undefined);
    if (match) {
      setSelectedAlert(match);
      setDrawerOpen(true);
    }
  }, [targetAlertId, targetOnPage, targetFromApi, selectedAlert]);

  // Bản mới nhất trong danh sách (sau khi nhắc hoặc kết luận), không có trên trang thì giữ bản đã mở
  const liveSelectedAlert = paginatedAlerts.find(alert => alert._id === selectedAlert?._id) ?? selectedAlert;

  const openDrawer = useCallback((alert: InferredAlertItem) => {
    setSelectedAlert(alert);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedAlert(null), 300);
  }, []);

  const handleVerdictSaved = useCallback((_id: string, result: 'CONFIRMED' | 'REJECTED') => {
    const messageText = result === 'CONFIRMED' ? t('Đã xác nhận sự cố thật') : t('Đã bác bỏ báo động giả');
    setToast({ show: true, message: messageText });
    setTimeout(() => setToast(currentToast => ({ ...currentToast, show: false })), 3000);
  }, []);

  // Ô lọc đang bật (không tính tab): để hiện nút Huỷ lọc
  const isFiltered = filters.type !== 'ALL' || filters.severity !== 'ALL' || filterZoneId !== undefined;

  return (
    <div className="relative flex w-full flex-1 flex-col gap-6">
      <SectionCard description={t('Hệ thống suy luận cảnh báo từ số liệu; chuyên gia kết luận là sự cố thật hay báo động giả')}>
        <StatusTabs
          variant="underline"
          ariaLabel={t('Lọc cảnh báo theo kết luận')}
          value={filters.tab}
          onChange={setTab}
          tabs={TAB_ORDER.map(id => ({ id, label: t(TAB_LABEL[id]), badge: id === 'PENDING' ? kpiCounts.pending : undefined }))}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          {zoneOptions.length > 1 && (
            <SelectMenu
              value={filterZoneId ?? 'ALL'}
              options={zoneOptions}
              onChange={(selectedZone: string) => {
                setFilterZoneId(selectedZone === 'ALL' ? undefined : selectedZone);
                setPage(1);
              }}
              ariaLabel={t('Lọc theo Zone')}
            />
          )}
          <SelectMenu
            value={filters.type}
            options={TYPE_OPTS}
            onChange={(selectedType: string) => setType(selectedType as InferredAlertType | 'ALL')}
            ariaLabel={t('Lọc theo loại cảnh báo')}
          />
          <SelectMenu
            value={filters.severity}
            options={severityOptions}
            onChange={(selectedSeverity: string) => setSeverity(selectedSeverity as AlertSeverity | 'ALL')}
            ariaLabel={t('Lọc theo mức độ cảnh báo')}
          />
          {isFiltered && (
            <ClearFiltersButton
              onClick={() => {
                setType('ALL');
                setSeverity('ALL');
                setFilterZoneId(undefined);
                setPage(1);
              }}
            />
          )}
          {/* Tỷ lệ chuyên gia xác nhận là sự cố thật theo loại, chỉ hiện khi đã có kết luận */}
          {statsSummary && (
            <p className="ml-auto min-w-0 truncate text-small text-warmGray" title={statsSummary}>
              <span className="font-semibold text-charcoal">{t('Tỷ lệ xác nhận sự cố thật:')}</span> {statsSummary}
            </p>
          )}
        </div>

        <InferredAlertsTable
          alerts={paginatedAlerts}
          isLoading={isLoading}
          onOpenDrawer={openDrawer}
          page={filters.page}
          pageSize={pageSize}
          filteredTotal={filteredTotal}
          onPageChange={setPage}
        />
      </SectionCard>

      <ExpertVerdictDrawer
        alert={liveSelectedAlert}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onVerdictSaved={handleVerdictSaved}
      />
      <Toast show={toast.show} message={toast.message} />
    </div>
  );
}
