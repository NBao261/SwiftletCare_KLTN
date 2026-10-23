/**
 * LiveStreamModal — Modal xem video camera RTSP kèm Bounding Box phát hiện chim
 * SRS: VISION-FR-013, EXPERT-FR-003
 */

import { Video, X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function LiveStreamModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-[#27231F] shadow-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-bold text-white">LIVE — Camera Bounding Box</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>
        {/* Video feed container */}
        <div className="flex aspect-video w-full items-center justify-center bg-black">
          <div className="text-center text-neutral-400">
            <Video size={48} className="mx-auto mb-3 opacity-40 text-neutral-400" />
            <p className="text-sm">Đang kết nối camera RTSP...</p>
            <p className="mt-1 text-xs opacity-60">
              VISION-FR-013 • Module phát hiện & đếm chim
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
