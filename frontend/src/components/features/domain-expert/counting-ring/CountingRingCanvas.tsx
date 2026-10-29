/**
 * CountingRingCanvas — Trình vẽ vòng đếm chim trên khung hình live
 *
 * VISION-FR-018: Chuyên gia vẽ vùng đếm (polygon/ellipse) trực tiếp lên
 * khung hình camera để AI tính tỷ lệ chim ra/vào qua vùng đó.
 *
 * Tính năng:
 *   - Canvas overlay trên video/image
 *   - Click-drag vẽ polygon (nhiều điểm) hoặc ellipse
 *   - Hiển thị vòng hiện có (xanh chanh accent-600)
 *   - Nút lưu → gọi onSave(coordinates)
 *   - Quyền vẽ: EXPERT_ONLY — Farm Owner chỉ xem, không có nút vẽ/sửa
 *
 * Sử dụng:
 *   <CountingRingCanvas
 *     videoRef={videoRef}
 *     existingRing={ring}
 *     onSave={coords => saveMutation.mutate(coords)}
 *     readonly={!isDomainExpert}
 *   />
 *
 * Bucket: components/features/domain-expert/counting-ring/ — §12.1.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { CountingRingCoordinates } from '@/types/expert.types';

interface CountingRingCanvasProps {
  /** Container cùng kích thước với video/image bên dưới */
  width: number;
  height: number;
  /** Vòng đếm hiện có (đã lưu) */
  existingRing?: CountingRingCoordinates | null;
  /** Callback khi bấm Lưu */
  onSave?: (coordinates: CountingRingCoordinates) => void;
  /** true = chỉ xem, không vẽ (Farm Owner) */
  readonly?: boolean;
  isSaving?: boolean;
}

type DrawMode = 'idle' | 'drawing' | 'done';

export default function CountingRingCanvas({
  width,
  height,
  existingRing,
  onSave,
  readonly = false,
  isSaving = false,
}: CountingRingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<DrawMode>('idle');
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Vẽ lên canvas mỗi khi points hoặc existingRing thay đổi
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Vẽ vòng hiện có (màu xanh chanh accent-600 mờ)
    if (existingRing && existingRing.points.length > 2 && mode === 'idle') {
      ctx.beginPath();
      ctx.moveTo(existingRing.points[0].x * width, existingRing.points[0].y * height);
      for (let i = 1; i < existingRing.points.length; i++) {
        ctx.lineTo(existingRing.points[i].x * width, existingRing.points[i].y * height);
      }
      ctx.closePath();
      ctx.strokeStyle = '#B5D32C'; // accent-600
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(181, 211, 44, 0.15)';
      ctx.fill();
    }

    // Vẽ đường đang kéo (màu cam)
    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (mode === 'done') ctx.closePath();
      ctx.strokeStyle = '#ED8F50'; // orange-500
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (mode === 'done') {
        ctx.fillStyle = 'rgba(237, 143, 80, 0.15)';
        ctx.fill();
      }

      // Chấm tròn mỗi điểm
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ED8F50';
        ctx.fill();
      });
    }
  }, [points, existingRing, mode, width, height]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly || !isEditing) return;
    const point = getCanvasPoint(e);

    // Double-click → kết thúc vẽ
    if (e.detail === 2 && points.length >= 3) {
      setMode('done');
      return;
    }

    setPoints(prev => [...prev, point]);
    setMode('drawing');
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setPoints([]);
    setMode('idle');
  };

  const handleDiscard = () => {
    setIsEditing(false);
    setPoints([]);
    setMode('idle');
  };

  const handleSave = () => {
    if (!onSave || points.length < 3) return;
    // Chuẩn hoá tọa độ về [0..1] để độc lập với kích thước màn hình
    const normalizedPoints = points.map(p => ({
      x: p.x / width,
      y: p.y / height,
    }));
    onSave({ points: normalizedPoints });
    setIsEditing(false);
    setPoints([]);
    setMode('idle');
  };

  return (
    // border border-red-500 — DEBUG (xóa sau khi Tuấn xác nhận layout OK)
    <div className="relative border border-red-500" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 z-10"
        style={{ cursor: isEditing ? 'crosshair' : 'default' }}
        onClick={handleCanvasClick}
      />

      {/* Toolbar — chỉ Domain Expert thấy */}
      {!readonly && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
          {!isEditing ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 shadow-md"
            >
              <Pencil className="h-3.5 w-3.5" />
              {existingRing ? 'Vẽ lại vòng' : 'Vẽ vòng đếm'}
            </Button>
          ) : (
            <>
              <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[11px] text-white">
                Click thêm điểm · Double-click để hoàn thành
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDiscard}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              {points.length >= 3 && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Lưu vòng đếm
                </Button>
              )}
            </>
          )}

          {existingRing && !isEditing && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onSave?.({ points: [] })}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Nhãn "Vùng đếm" khi có vòng hiện có */}
      {existingRing && existingRing.points.length > 0 && !isEditing && (
        <div className="absolute left-3 top-3 z-20 rounded-md bg-accent-600/90 px-2 py-0.5 text-[11px] font-semibold text-charcoal">
          Vùng đếm chim
        </div>
      )}
    </div>
  );
}
