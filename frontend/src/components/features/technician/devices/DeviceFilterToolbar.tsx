import { Input } from "@/components/ui"
import SelectMenu from "@/components/ui/SelectMenu"
import { Search, Filter } from "lucide-react"

const FILTER_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "ONLINE", label: "Đang Online" },
  { value: "OFFLINE", label: "Mất kết nối (Offline)" },
  { value: "PENDING", label: "Chờ kích hoạt" },
  { value: "WARNING", label: "Cần chú ý (Lỗi / Ghi đè)" },
];

interface DeviceFilterToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
}

export default function DeviceFilterToolbar({ searchQuery, setSearchQuery, statusFilter, setStatusFilter }: DeviceFilterToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-4">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-warmGray" />
        </div>
        <Input 
          className="pl-10 w-full"
          placeholder="Tìm kiếm theo Tên máy, MAC hoặc IP..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="relative min-w-[200px]">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <Filter size={16} className="text-warmGray" />
        </div>
        <SelectMenu 
          value={statusFilter}
          onChange={setStatusFilter}
          options={FILTER_OPTIONS}
          ariaLabel="Lọc theo trạng thái"
          field={true}
          className="w-full pl-9 h-[42px] rounded-xl border-warmGray/20 bg-white font-medium hover:border-warmGray/40 transition-colors"
        />
      </div>
    </div>
  )
}
