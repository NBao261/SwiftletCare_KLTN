// Alerts Page – ALERT-FR-001/002/006/007/008/009
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAlertsList, useAcknowledgeAlert } from "@/hooks/shared/useAlerts";
import { Card, Button } from "@/components/ui";
import AlertBadge from "@/components/features/technician/alerts/AlertBadge";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Pagination from "@/components/ui/Pagination";
import FilterChip from "@/components/ui/FilterChip";
import NoteActionModal from "@/components/ui/NoteActionModal";
import { IconAlert } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDate, getApiErrorMessage } from "@/lib/helpers";
import { useToastStore } from "@/stores/toastStore";
import type { AlertSeverity, AlertStatus } from "@/types";

const STATUS_FILTERS: Array<{ value: AlertStatus | undefined; label: string }> =
  [
    { value: undefined, label: "Tất cả" },
    { value: "ACTIVE", label: "Đang mở" },
    { value: "ACKNOWLEDGED", label: "Đã xác nhận" },
    { value: "RESOLVED", label: "Đã xử lý" },
  ];

const SEVERITY_FILTERS: Array<{
  value: AlertSeverity | undefined;
  label: string;
}> = [
  { value: undefined, label: "Mọi mức" },
  { value: "CRITICAL", label: "CRITICAL" },
  { value: "HIGH", label: "HIGH" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "LOW", label: "LOW" },
];

export default function TechnicianAlertsPage() {
  const [status, setStatus] = useState<AlertStatus | undefined>(undefined);
  const [severity, setSeverity] = useState<AlertSeverity | undefined>(
    undefined,
  );
  const [page, setPage] = useState(1);
  const [ackTargetId, setAckTargetId] = useState<string | null>(null);
  // Bấm 1 thông báo ở NotificationPopover (AppHeader) điều hướng sang đây kèm
  // ?highlight=<id> — cuộn tới & làm nổi đúng dòng đó nếu đang nằm trong trang/filter hiện tại.
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const { records, total, limit, isLoading } = useAlertsList({
    status,
    severity,
    page,
    limit: 10,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.label}
            active={status === f.value}
            label={f.label}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-warmGray/20" />
        {SEVERITY_FILTERS.map((f) => (
          <FilterChip
            key={f.label}
            active={severity === f.value}
            label={f.label}
            onClick={() => {
              setSeverity(f.value);
              setPage(1);
            }}
          />
        ))}
      </div>

      {isLoading && <LoadingSkeleton count={3} className="h-24 w-full" />}

      {!isLoading && records.length === 0 && (
        <EmptyState
          icon={<IconAlert width={28} height={28} />}
          title="Không có cảnh báo nào"
          description="Khi hệ thống phát hiện bất thường (môi trường vượt ngưỡng, thiết bị mất kết nối, thiên địch...), cảnh báo sẽ hiện ở đây."
        />
      )}

      <div className="flex flex-col gap-3">
        {records.map((alert) => (
          <Card
            key={alert._id}
            ref={(el) => {
              if (el && alert._id === highlightId) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className={cn(
              "flex flex-col gap-2",
              alert._id === highlightId && "ring-2 ring-alertRed/40",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertBadge severity={alert.severity} />
                <p className="font-bold text-charcoal">{alert.title}</p>
              </div>
              <span className="shrink-0 text-xs text-warmGray">
                {formatDate(alert.created_at)}
              </span>
            </div>
            <p className="text-sm text-warmGray">{alert.message}</p>
            <div className="flex items-center justify-between pt-1">
              <span
                className={cn(
                  "text-xs font-semibold",
                  alert.status === "ACTIVE" ? "text-alertRed" : "text-warmGray",
                )}
              >
                {alert.status === "ACTIVE"
                  ? "Chưa xác nhận"
                  : alert.status === "ACKNOWLEDGED"
                    ? "Đã xác nhận"
                    : "Đã xử lý"}
              </span>
              {alert.status === "ACTIVE" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAckTargetId(alert._id)}
                >
                  Xác nhận
                </Button>
              )}
            </div>
            {alert.acknowledgement_note && (
              <p className="rounded-xl bg-warmGray/5 px-3 py-2 text-xs text-warmGray">
                Ghi chú: {alert.acknowledgement_note}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />

      <AcknowledgeModal
        alertId={ackTargetId}
        onClose={() => setAckTargetId(null)}
      />
    </div>
  );
}

function AcknowledgeModal({
  alertId,
  onClose,
}: {
  alertId: string | null;
  onClose: () => void;
}) {
  const acknowledge = useAcknowledgeAlert();
  const push = useToastStore((s) => s.push);

  return (
    <NoteActionModal
      open={!!alertId}
      onClose={onClose}
      title="Xác nhận cảnh báo"
      label="Ghi chú (tùy chọn)"
      placeholder="VD: Báo động giả, đã kiểm tra tại chỗ..."
      submitLabel="Xác nhận"
      loading={acknowledge.isPending}
      onSubmit={(note) => {
        if (!alertId) return;
        acknowledge.mutate(
          { id: alertId, note: note.trim() || undefined },
          {
            onSuccess: () => {
              push("Đã xác nhận cảnh báo");
              onClose();
            },
            onError: (err) =>
              push(getApiErrorMessage(err, "Xác nhận thất bại"), "error"),
          },
        );
      }}
    />
  );
}
