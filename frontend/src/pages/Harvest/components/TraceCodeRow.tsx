import { Button } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";

export default function TraceCodeRow({ traceCode }: { traceCode: string }) {
  const push = useToastStore((s) => s.push);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-warmGray/5 px-4 py-2.5">
      <div className="min-w-0">
        <p className="label-caption">Mã truy xuất nguồn gốc</p>
        <p className="truncate font-mono text-sm text-charcoal">{traceCode}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(traceCode);
          push("Đã sao chép mã truy xuất");
        }}
      >
        Sao chép
      </Button>
    </div>
  );
}
