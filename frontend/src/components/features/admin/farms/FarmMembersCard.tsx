import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PlusIcon } from "@phosphor-icons/react";
import { useFarm, useSalesStaff, usePendingSalesStaffRequests } from "@/hooks/shared/useFarms";
import { useUnassignSalesStaff } from "@/hooks/admin/useUsers";
import { Button, Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui/Badge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import CreateUserModal from "@/components/features/admin/users/CreateUserModal";
import { useToastStore } from "@/stores/toastStore";
import { formatDateOnly, getApiErrorMessage } from "@/lib/helpers";
import { t } from "@/i18n";

/**
 * Khối nhóm trên trang chi tiết Farm: tiêu đề nhỏ (+ đếm, + nút bên phải; bỏ cả hàng nếu không có tiêu đề) và nội dung
 * trong khung viền trắng chia dòng — cùng viền/bóng StatTile. Dùng cho Nhà yến (AdminFarmDetailPage) và Thành viên/Chuyên viên.
 */
export function PanelGroup({ title, count, action, children }: { title?: string; count?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      {title && (
        <div className="mb-2 flex min-h-9 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-h3 text-charcoal">{t(title)}</h2>
            {count && <span className="shrink-0 rounded-full bg-warmGray/10 px-2.5 py-0.5 text-xs font-semibold text-graphite">{count}</span>}
          </div>
          {action}
        </div>
      )}
      <div className="flex-1 divide-y divide-warmGray/15 rounded-2xl border border-warmGray/15 bg-white px-4 shadow-card">{children}</div>
    </section>
  );
}

/**
 * Tab "Thành viên" trang chi tiết Farm. Quyền người dùng của Admin theo FARM-FR-009(b) chỉ gồm tạo tài khoản
 * Technician/chuyên viên (AUTH-FR-005c) và khoá/mở khoá (AUTH-FR-011, ở trang Người dùng):
 * - Thành viên Farm Owner: CHỈ XEM — mời/gỡ là việc của Primary Owner (AUTH-FR-005), dù backend isPrimaryOwner() vẫn cho ADMIN.
 * - Chuyên viên (Sales Staff): tạo tài khoản gán thẳng farm này (POST /admin/sales-staff), gỡ thẳng (Flow 16 bước 1e).
 *   KHÔNG dùng POST /farms/:id/sales-staff — đó là luồng đề xuất của Farm Owner (AUTH-FR-005b).
 */
export default function FarmMembersCard({ farmId }: { farmId: string }) {
  const { data: farm, isLoading } = useFarm(farmId);
  const { data: salesStaff } = useSalesStaff(farmId);
  // Đề xuất do Farm Owner gửi, Admin duyệt ở trang Yêu cầu tài khoản (AUTH-FR-005d)
  const { data: pendingSales } = usePendingSalesStaffRequests(farmId);
  const unassign = useUnassignSalesStaff(farmId);
  const push = useToastStore((s) => s.push);
  const [showCreateSales, setShowCreateSales] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{ id: string; name: string } | null>(null);

  if (isLoading) return <LoadingSkeleton count={2} className="h-16 w-full" />;
  if (!farm) return null;

  const primary = farm.members.find((m) => m.is_primary);
  const otherMembers = farm.members.filter((m) => !m.is_primary);

  function handleUnassign() {
    if (!unassignTarget) return;
    unassign.mutate(unassignTarget.id, {
      onSuccess: () => {
        push(t("Đã gỡ {{name}} khỏi farm", { name: unassignTarget.name }));
        setUnassignTarget(null);
      },
      onError: (err) => push(getApiErrorMessage(err, "Gỡ chuyên viên thất bại"), "error"),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PanelGroup title="Thành viên Farm Owner" count={t("{{n}} người", { n: otherMembers.length + 1 })}>
        {/* Chủ chính nhãn xanh hệ thống (Badge positive) cho nổi giữa các thành viên xám */}
        <MemberRow name={farm.owner?.full_name} email={farm.owner?.email} badge="Chủ chính" badgeTone="positive" joinedAt={primary?.joined_at} />
        {otherMembers.map((m) => (
          <MemberRow key={m.user_id} name={m.full_name} email={m.email} badge="Thành viên" joinedAt={m.joined_at} />
        ))}
      </PanelGroup>

      <PanelGroup
        title="Chuyên viên"
        count={salesStaff?.length ? t("{{n}} người", { n: salesStaff.length }) : undefined}
        action={
          // Cùng kiểu nút tạo chính các trang Admin (Tạo ticket, Tạo tài khoản)
          <Button className="shrink-0" onClick={() => setShowCreateSales(true)}>
            <PlusIcon size={16} weight="bold" />Tạo chuyên viên
          </Button>
        }
      >
        {salesStaff?.length || pendingSales?.length ? (
          <>
            {salesStaff?.map((s) => (
              <MemberRow
                key={s._id}
                name={s.sales_staff_id.full_name}
                email={s.sales_staff_id.email}
                badge="Chuyên viên"
                onRemove={() => setUnassignTarget({ id: s.sales_staff_id._id, name: s.sales_staff_id.full_name })}
              />
            ))}
            {pendingSales?.map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-charcoal">{r.sales_staff_email}</p>
                  <p className="truncate text-xs text-warmGray">
                    {t("Farm Owner đề xuất {{date}}", { date: formatDateOnly(r.created_at) })} ·{" "}
                    <Link to="/account-requests" className="font-semibold text-charcoal hover:underline">
                      {t("Duyệt ở Yêu cầu tài khoản →")}
                    </Link>
                  </p>
                </div>
                <Badge tone="neutral" className="shrink-0">
                  {r.type === "REMOVE" ? "Chờ gỡ" : "Chờ duyệt"}
                </Badge>
              </div>
            ))}
          </>
        ) : (
          <p className="py-4 text-sm text-warmGray">{t("Chưa có chuyên viên — Farm Owner tự động có toàn bộ quyền quản lý bán hàng.")}</p>
        )}
      </PanelGroup>

      <CreateUserModal open={showCreateSales} onClose={() => setShowCreateSales(false)} presetFarmId={farmId} />
      <ConfirmModal
        open={!!unassignTarget}
        title="Gỡ chuyên viên khỏi farm?"
        danger
        description={t("{{name}} sẽ mất quyền quản lý bán hàng của farm này. Tài khoản vẫn giữ nguyên.", { name: unassignTarget?.name ?? t("Chuyên viên này") })}
        loading={unassign.isPending}
        onConfirm={handleUnassign}
        onCancel={() => setUnassignTarget(null)}
      />
    </div>
  );
}

/** 1 dòng thành viên: tên + email · ngày tham gia bên trái, nhãn vai trò (+ nút Gỡ) bên phải — không avatar */
function MemberRow({
  name,
  email,
  badge,
  badgeTone = "neutral",
  joinedAt,
  onRemove,
}: {
  name?: string;
  email?: string;
  badge: string;
  badgeTone?: BadgeTone;
  joinedAt?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-charcoal">{name ?? "—"}</p>
        <p className="truncate text-xs text-warmGray">
          {email ?? "—"}
          {joinedAt && ` · ${t("tham gia {{date}}", { date: formatDateOnly(joinedAt) })}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={badgeTone}>{badge}</Badge>
        {onRemove && (
          <Button variant="secondary" size="sm" onClick={onRemove}>
            Gỡ
          </Button>
        )}
      </div>
    </div>
  );
}
