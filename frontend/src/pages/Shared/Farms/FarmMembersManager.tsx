import { useState, FormEvent } from "react";
import { useAuthStore } from "@/store/authStore";
import { usePermission } from "@/hooks/usePermission";
import {
  useFarm,
  useInviteMember,
  useRemoveMember,
  useInviteSalesStaff,
  useSalesStaff,
} from "@/hooks/useFarms";
import { Button, Input, Modal, Badge } from "@/components/ui";
import ConfirmModal from "@/components/common/ConfirmModal";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import { useToastStore } from "@/store/toastStore";
import { getApiErrorMessage } from "@/utils/helpers";

/** Quản lý thành viên Farm Owner + Sales Staff của 1 Farm (AUTH-FR-005/005b/010) */
export default function FarmMembersManager({ farmId }: { farmId: string }) {
  const { data: farm, isLoading } = useFarm(farmId);
  const { data: salesStaff } = useSalesStaff(farmId);
  const currentUserId = useAuthStore((s) => s.user?._id);
  const isAdmin = usePermission("ADMIN");
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showInviteSales, setShowInviteSales] = useState(false);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const removeMember = useRemoveMember(farmId);
  const push = useToastStore((s) => s.push);

  if (isLoading) return <LoadingSkeleton count={2} className="h-16 w-full" />;
  if (!farm) return null;

  // Khớp backend farmAccess.util.ts#isPrimaryOwner: ADMIN hoặc đúng owner_id của farm
  // (không phải mọi FARM_OWNER — thành viên được mời không có quyền mời/gỡ thêm người khác).
  const isPrimaryOwner = isAdmin || farm.owner_id === currentUserId;

  function handleRemove() {
    if (!removeTargetId) return;
    removeMember.mutate(removeTargetId, {
      onSuccess: () => {
        push("Đã gỡ thành viên");
        setRemoveTargetId(null);
      },
      onError: (err) =>
        push(getApiErrorMessage(err, "Gỡ thành viên thất bại"), "error"),
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-warmGray">
            Thành viên Farm Owner
          </h3>
          {isPrimaryOwner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowInviteMember(true)}
            >
              + Mời thành viên
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <MemberRow
            name={farm.owner?.full_name}
            email={farm.owner?.email}
            badge="Chủ chính"
          />
          {farm.members
            .filter((m) => !m.is_primary)
            .map((m) => (
              <MemberRow
                key={m.user_id}
                name={m.full_name}
                email={m.email}
                badge="Thành viên"
                onRemove={
                  isPrimaryOwner
                    ? () => setRemoveTargetId(m.user_id)
                    : undefined
                }
              />
            ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-warmGray">
            Sales Staff
          </h3>
          {isPrimaryOwner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowInviteSales(true)}
            >
              + Mời Sales Staff
            </Button>
          )}
        </div>

        {salesStaff?.length ? (
          <div className="flex flex-col gap-2">
            {salesStaff.map((s) => (
              <MemberRow
                key={s._id}
                name={s.sales_staff_id.full_name}
                email={s.sales_staff_id.email}
                badge="Sales Staff"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-warmGray">
            Chưa có Sales Staff — Farm Owner tự động có toàn bộ quyền quản lý
            bán hàng.
          </p>
        )}
      </section>

      <InviteModal
        open={showInviteMember}
        onClose={() => setShowInviteMember(false)}
        title="Mời thành viên Farm Owner"
        farmId={farmId}
        kind="member"
      />
      <InviteModal
        open={showInviteSales}
        onClose={() => setShowInviteSales(false)}
        title="Mời Sales Staff"
        farmId={farmId}
        kind="sales"
      />
      <ConfirmModal
        open={!!removeTargetId}
        title="Gỡ thành viên?"
        danger
        description="Thành viên này sẽ mất toàn bộ quyền truy cập farm này."
        loading={removeMember.isPending}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTargetId(null)}
      />
    </div>
  );
}

function MemberRow({
  name,
  email,
  badge,
  onRemove,
}: {
  name?: string;
  email?: string;
  badge: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-warmGray/5 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-charcoal">
          {name ?? "—"}
        </p>
        <p className="truncate text-xs text-warmGray">{email ?? "—"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone="neutral">{badge}</Badge>
        {onRemove && (
          <Button variant="secondary" size="sm" onClick={onRemove}>
            Gỡ
          </Button>
        )}
      </div>
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  title,
  farmId,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  farmId: string;
  kind: "member" | "sales";
}) {
  const inviteMember = useInviteMember(farmId);
  const inviteSales = useInviteSalesStaff(farmId);
  const push = useToastStore((s) => s.push);
  const [email, setEmail] = useState("");
  const mutation = kind === "member" ? inviteMember : inviteSales;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(email, {
      onSuccess: () => {
        push("Đã gửi lời mời");
        setEmail("");
        onClose();
      },
      onError: (err) =>
        push(getApiErrorMessage(err, "Gửi lời mời thất bại"), "error"),
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nguoi-duoc-moi@email.com"
        />
        <p className="text-xs text-warmGray">
          Lời mời có hiệu lực 7 ngày. Nếu email chưa có tài khoản, người được
          mời đăng ký xong sẽ tự động được thêm vào farm.
        </p>
        <Button type="submit" loading={mutation.isPending} className="w-full">
          Gửi lời mời
        </Button>
      </form>
    </Modal>
  );
}
