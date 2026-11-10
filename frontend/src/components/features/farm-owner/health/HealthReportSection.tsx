import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PlusIcon } from '@phosphor-icons/react';
import TableEmptyState from '@/components/common/TableEmptyState';
import HealthReportCreateModal from '@/components/features/farm-owner/health/HealthReportCreateModal';
import { reportPeriod } from '@/components/features/farm-owner/health/healthReport.utils';
import { ActionsMenu, Badge, Button, EmptyState, FilterChip, SectionCard, type DataTableColumn } from '@/components/ui';
import FixedRowsTable from '@/components/ui/FixedRowsTable';
import { healthDict } from '@/constants/health.i18n';
import { keepPreview } from '@/data/healthPreview.data';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseHealthReports } from '@/hooks/shared/useHealthDays';
import { useHealthReportPdf } from '@/hooks/shared/useHealthReportPdf';
import type { HealthReportKind, HouseHealthReportSummary } from '@/types';

const KINDS: HealthReportKind[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];
// Cùng khung bảng ngày (tab bên cạnh)
const ROW_COUNT = 10;
const ROW_HEIGHT = 72;

interface HealthReportSectionProps {
  // houseId hoặc farmId đang lọc; null = xem nhiều farm (backend cần 1 trong 2)
  scope: { houseId?: string; farmId?: string } | null;
  // Nhà đang lọc — tạo báo cáo theo yêu cầu cần 1 nhà
  house: { id: string; name: string } | null;
}

// EXPERT-FR-005, 013 — danh sách báo cáo theo nhà, xem chi tiết, tải PDF, tạo báo cáo theo yêu cầu
export default function HealthReportSection({ scope, house }: HealthReportSectionProps): JSX.Element {
  const { t, date, dateTime, exact } = useTranslation(healthDict);
  const apiErrorMessage = useApiErrorMessage();
  const [kind, setKind] = useState<HealthReportKind | undefined>(undefined);
  // Chi tiết là trang riêng /health/reports/:id (ngăn bên hẹp, khó đọc bảng)
  const navigate = useNavigate();
  const openReport = useCallback((reportId: string) => navigate(keepPreview(`/health/reports/${reportId}`)), [navigate]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: reports = [], isLoading, isError, error, refetch } = useHouseHealthReports(scope, kind);
  const { download, downloadingId } = useHealthReportPdf();

  const format = useMemo(() => ({ t, date, dateTime, number: (value: number) => exact(value, 1) }), [t, date, dateTime, exact]);
  const orderById = useMemo(() => new Map(reports.map((report, index) => [report._id, index + 1])), [reports]);

  const columns = useMemo<DataTableColumn<HouseHealthReportSummary>[]>(() => [
    { key: 'index', header: t('col.index'), className: 'w-16', render: report => <span className="text-sm text-warmGray">{orderById.get(report._id)}</span> },
    { key: 'period', header: t('col.period'), className: 'w-[18%] whitespace-nowrap', render: report => <span className="text-sm font-semibold text-charcoal">{reportPeriod(report, format)}</span> },
    { key: 'house', header: t('col.house'), className: 'w-[18%]', render: report => <span title={report.house_name} className="block truncate text-sm font-semibold text-charcoal">{report.house_name}</span> },
    { key: 'kind', header: t('col.kind'), className: 'w-[14%] whitespace-nowrap', render: report => <span className="text-sm text-charcoal">{t(`kindLong.${report.kind}`)}</span> },
    { key: 'generatedAt', header: t('col.generatedAt'), className: 'w-[18%] whitespace-nowrap', render: report => <span className="text-sm text-charcoal">{dateTime(report.generated_at)}</span> },
    {
      key: 'conclusion',
      header: t('col.conclusion'),
      // Một dòng, chữ dài cắt "…" như cột Nhà yến; rê chuột xem đủ
      // Bảng table-fixed: mọi cột có độ rộng (cộng ~90 %, STT và Thao tác cố định) để khoảng trống chia đều; chữ nằm trong ô và chừa khoảng trống trước cột Thao tác
      className: 'w-[22%] pr-8',
      render: report => (report.expert_conclusion
        ? <p title={report.expert_conclusion.text} className="truncate text-sm text-charcoal">{report.expert_conclusion.text}</p>
        : report.has_conclusion
          ? <Badge tone="positive">{t('cell.hasConclusion')}</Badge>
          : <span className="text-sm italic text-warmGray">{t('cell.noConclusion')}</span>),
    },
    // Nhiều thao tác gom vào menu ⋯ như HarvestTable; chặn click lan lên dòng để mở menu không mở luôn chi tiết
    {
      key: 'actions',
      header: t('col.actions'),
      align: 'center',
      className: 'w-24 whitespace-nowrap',
      render: report => (
        <div onClick={event => event.stopPropagation()} className="flex items-center justify-center">
          <ActionsMenu
            items={[
              { label: t('action.view'), onClick: () => openReport(report._id) },
              {
                label: downloadingId === report._id ? t('action.pdfLoading') : t('action.pdf'),
                onClick: () => void download(report._id),
                disabled: downloadingId !== null,
              },
            ]}
          />
        </div>
      ),
    },
  ], [t, format, dateTime, orderById, download, downloadingId, openReport]);

  return (
    <SectionCard
      title={t('report.title')}
      description={t('report.subtitle')}
    >
      {/* Lọc loại bên trái, nút tạo bên phải (mô tả dài nên không đặt nút ở đầu thẻ — bị đẩy xuống dòng riêng) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={!kind} label={t('kind.all')} onClick={() => setKind(undefined)} />
          {KINDS.map(value => (
            <FilterChip key={value} active={kind === value} label={t(`kind.${value}`)} onClick={() => setKind(value)} />
          ))}
        </div>
        <Button
          size="sm"
          disabled={!house}
          title={house ? undefined : t('create.needHouse')}
          onClick={() => setIsCreateOpen(true)}
        >
          <PlusIcon size={14} weight="bold" aria-hidden />
          {t('report.create')}
        </Button>
      </div>

      {!scope ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-12">
          <TableEmptyState title={t('report.needFarm')} />
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-12 motion-safe:animate-pulse" role="status">
          <TableEmptyState title={t('report.loading')} />
        </div>
      ) : isError ? (
        <EmptyState
          title={t('report.errorTitle')}
          description={apiErrorMessage(error)}
          action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
        />
      ) : reports.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-12">
          <TableEmptyState title={t('report.emptyTitle')} description={t('report.emptyHint')} />
        </div>
      ) : (
        <FixedRowsTable
          columns={columns}
          rows={reports}
          getRowKey={report => report._id}
          onRowClick={report => openReport(report._id)}
          rowHeight={ROW_HEIGHT}
          pageSize={ROW_COUNT}
          emptyNotice={t('report.emptyTitle')}
        />
      )}

      {house && (
        <HealthReportCreateModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          house={house}
          onCreated={report => {
            setIsCreateOpen(false);
            openReport(report._id);
          }}
        />
      )}
    </SectionCard>
  );
}
