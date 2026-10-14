import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { useAllTickets } from "@/hooks/admin/useAdminTickets";
import { useFarmZones } from "@/hooks/shared/useFarms";
import { ClearFiltersButton, SectionCard, SelectMenu, SortChips } from "@/components/ui";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  buildTicketColumns, sortTickets, TICKET_SORT_FIELDS,
  DEFAULT_TICKET_SORT_BY, DEFAULT_TICKET_SORT_DIR, type TicketSortKey,
} from "@/components/features/admin/tickets/ticketColumns";
import ChangePriorityModal from "@/components/features/admin/tickets/ChangePriorityModal";
import ReassignTicketModal from "@/components/features/admin/tickets/ReassignTicketModal";
import RescheduleModal from "@/components/features/admin/tickets/RescheduleModal";
import { STATUS_LABEL } from "@/constants/tickets";
import { PRIORITY_LABEL } from "@/constants/sla";
import { t } from "@/i18n";
import type { Ticket, TicketPriority, TicketStatus, SortDirection } from "@/types";

const PAGE_SIZE = 6;
/** px — mọi dòng (kể cả dòng trống bù) cao bằng nhau, để khung 6 dòng cố định (như Nhật ký hoạt động ở Dashboard) */
const ROW_HEIGHT = 60;
const STATUS_ORDER = Object.keys(STATUS_LABEL) as TicketStatus[];
const NO_FARM_NAMES = new Map<string, string>();

/**
 * "Ticket gần nhất" cuối trang chi tiết Farm của Admin — FARM-FR-009 "ticket liên quan". Cùng khuôn bảng Nhật ký hoạt
 * động ở Dashboard (DataTable 6 dòng cố định + phân trang) và bộ lọc/sắp xếp của trang Ticket (trừ lọc trang trại —
 * đã cố định farm này, và không ô tìm kiếm). Như trang Ticket: lọc trạng thái/ưu tiên chạy trên backend, sắp + phân
 * trang ở client trên toàn bộ kết quả. Cột bảng Ticket (Trang trại thay bằng Phòng) + cột Thao tác với 3 modal can thiệp.
 */
export default function FarmRecentTickets({ farmId }: { farmId: string }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [sortBy, setSortBy] = useState<TicketSortKey>(DEFAULT_TICKET_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_TICKET_SORT_DIR);
  const [page, setPage] = useState(1);
  const [reassignTarget, setReassignTarget] = useState<Ticket | null>(null);
  const [priorityTarget, setPriorityTarget] = useState<Ticket | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Ticket | null>(null);

  const { data: allTickets, isLoading } = useAllTickets({
    farmId,
    status: status || undefined,
    priority: priority || undefined,
  });
  // Ticket chỉ có zone_id thô — tra tên "Nhà | Phòng" từ danh sách phòng phẳng đã cache (tab Nhà yến cũng dùng)
  const { data: farmZones } = useFarmZones(farmId);
  const roomLabel = (ticket: Ticket) => {
    if (!ticket.zone_id) return t("Toàn farm");
    const zone = farmZones?.find((z) => z._id === ticket.zone_id);
    return zone ? `${zone.houseName} | ${zone.name}` : "—";
  };

  // Không có ô tìm kiếm (tìm đủ ở trang Ticket qua "Xem tất cả") — chỉ sắp xếp; copy mảng vì sortTickets sắp tại chỗ
  const filtered = useMemo(
    () => sortTickets([...(allTickets ?? [])], sortBy, sortDir, NO_FARM_NAMES),
    [allTickets, sortBy, sortDir],
  );

  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isFiltered = status !== "" || priority !== "";
  const hasActiveFilters = isFiltered || sortBy !== DEFAULT_TICKET_SORT_BY || sortDir !== DEFAULT_TICKET_SORT_DIR;

  function handleSortChange(key: string) {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key as TicketSortKey);
      setSortDir("asc");
    }
    setPage(1);
  }

  function clearFilters() {
    setStatus("");
    setPriority("");
    setSortBy(DEFAULT_TICKET_SORT_BY);
    setSortDir(DEFAULT_TICKET_SORT_DIR);
    setPage(1);
  }

  // Phòng thay đúng chỗ + độ rộng cột Trang trại (13%) — mọi cột khác giữ width của bảng Ticket, tổng vẫn 100%
  const roomColumn: DataTableColumn<Ticket> = {
    key: "room", header: "Phòng", className: "w-[13%]",
    render: (ticket) => <span className="block truncate text-charcoal" title={roomLabel(ticket)}>{roomLabel(ticket)}</span>,
  };
  const columns = buildTicketColumns(
    {
      onView: (t) => navigate(`/system/tickets/${t._id}`),
      onReassign: setReassignTarget,
      onChangePriority: setPriorityTarget,
      onReschedule: setRescheduleTarget,
    },
    (page - 1) * PAGE_SIZE,
    NO_FARM_NAMES,
  ).map((col) => (col.key === "farm" ? roomColumn : col));

  return (
    <SectionCard
      title="Ticket gần nhất"
      description="Sự cố, lắp đặt và bảo trì của trang trại này"
      action={
        <Link to={`/system/tickets?farmId=${farmId}`} className="group inline-flex items-center gap-1 text-small font-semibold text-charcoal hover:underline">
          {t("Xem tất cả")}
          <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu
          ariaLabel="Lọc theo trạng thái"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "" as const, label: "Tất cả trạng thái" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
        />
        <SelectMenu
          ariaLabel="Lọc theo ưu tiên"
          value={priority}
          onChange={(v) => { setPriority(v); setPage(1); }}
          options={[{ value: "" as const, label: "Tất cả ưu tiên" }, ...(["P1", "P2", "P3"] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))]}
        />
        <SortChips fields={TICKET_SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSortChange} />
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </div>

      {isLoading ? (
        <LoadingSkeleton count={PAGE_SIZE} className="h-[60px] w-full" />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(ticket) => ticket._id}
          emptyMessage={isFiltered ? "Không có ticket nào khớp bộ lọc." : "Chưa có ticket nào."}
          onRowClick={(ticket) => navigate(`/system/tickets/${ticket._id}`)}
          // Trang cuối ít hơn 6 dòng vẫn giữ khung đủ 6 dòng — card không co lại khi chuyển trang/lọc
          rowHeight={ROW_HEIGHT}
          minRows={PAGE_SIZE}
        />
      )}
      {/* total = số ticket SAU khi lọc + tìm kiếm */}
      <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="full" />

      {/* Cùng 3 modal can thiệp của trang Ticket (TICKET-FR-005b) — chỉ mount khi đã chọn dòng */}
      {reassignTarget && <ReassignTicketModal open ticket={reassignTarget} onClose={() => setReassignTarget(null)} />}
      {priorityTarget && <ChangePriorityModal open ticket={priorityTarget} onClose={() => setPriorityTarget(null)} />}
      {rescheduleTarget && <RescheduleModal open ticket={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />}
    </SectionCard>
  );
}
