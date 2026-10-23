"""SwiftletCare – chạy pipeline (2 ô → YOLO → ByteTrack → vòng đếm) trên một đoạn clip, ghi video có ô xanh (plan §6.8).

  python tools/track_clip.py D:/SwiftletCare/clips/20261022_morning_01.mp4 --start 420 --seconds 20
  python tools/track_clip.py <clip> --model D:/models/swiftlet_v1.onnx --out D:/SwiftletCare/clips/annotated

Xử lý từng frame giống hệt luồng camera (src/pipeline.py), nên số RA/VÀO in ra là số pipeline sẽ đếm.
Dùng để xem ô xanh có bám chim không và để đo sai số trên clip đã đếm tay (plan §7.7).
"""
import argparse
import sys
import time
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from inference import Detection  # noqa: E402
from pipeline import FramePipeline, draw, track_ids  # noqa: E402
from stream import load_config, make_counter, make_engine  # noqa: E402


class MotionDetector:
    """
    Chỉ để dev, khi chưa có model tự train: model COCO không nhận ra chim yến trong ảnh IR (22/10 thử tới
    conf 0,02 vẫn 0 lần ra class bird). Lấy vật chuyển động (MOG2, nửa độ phân giải) làm "phát hiện" để xem
    ByteTrack và bộ đếm chạy trên clip thật. Bắt cả côn trùng và nhiễu, nên số đếm chỉ để tham khảo.
    """

    # max_fg_fraction 0,02: frame thường có 0,05% điểm ảnh "chuyển động" (trung vị), chim sát ống kính
    # (~180×180 px) ~1,6%, còn lúc camera tự chỉnh phơi sáng vọt lên 14% (clip 22/10, 05:31:50). Chọn tay.
    def __init__(self, min_side_px: int = 8, max_side_px: int = 260, max_fg_fraction: float = 0.02):
        self.bg = cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=25, detectShadows=False)
        self.kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        self.min_side, self.max_side = min_side_px, max_side_px
        self.max_fg = max_fg_fraction

    def infer_tiles(self, frame, _tiles, _overlap):
        small = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), None, fx=0.5, fy=0.5)
        mask = cv2.morphologyEx(self.bg.apply(small), cv2.MORPH_OPEN, self.kernel)
        if (mask > 0).mean() > self.max_fg:      # cả khung đổi sáng: học lại nền ngay, bỏ frame này
            self.bg.apply(small, learningRate=1)
            return [], 0.0
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        dets = []
        for c in contours:
            x, y, w, h = (v * 2 for v in cv2.boundingRect(c))
            if self.min_side <= max(w, h) <= self.max_side:
                dets.append(Detection(14, "swiftlet", 0.9, (x, y, x + w, y + h)))
        return dets, 0.0


def main() -> None:
    for stream in (sys.stdout, sys.stderr):      # console Windows mặc định cp1252, không in được tiếng Việt
        stream.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("--start", type=float, default=0, help="bắt đầu từ giây thứ mấy của clip")
    ap.add_argument("--seconds", type=float, help="chỉ chạy ngần này giây (bỏ trống = tới hết clip)")
    ap.add_argument("--model", help="đường dẫn .onnx; bỏ trống = model.path trong config")
    ap.add_argument("--detector", choices=["model", "motion"], default="model",
                    help="motion = vật chuyển động thay cho model (chỉ để xem tracker/bộ đếm khi chưa có model tự train)")
    ap.add_argument("--out", default="D:/SwiftletCare/clips/annotated", help="thư mục ghi video có ô xanh")
    args = ap.parse_args()

    cfg = load_config()
    cap = cv2.VideoCapture(args.clip)
    if not cap.isOpened():
        raise SystemExit(f"Không mở được {args.clip}")
    fps = cap.get(cv2.CAP_PROP_FPS) or cfg["camera"]["fps"]
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    first = int(args.start * fps)
    total = int(args.seconds * fps) if args.seconds else None
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)

    counter = make_counter(cfg, w, h)
    engine = MotionDetector() if args.detector == "motion" else make_engine(cfg, args.model)
    pipe = FramePipeline(cfg, engine, w, h)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{Path(args.clip).stem}_{int(args.start)}s_{args.detector}.mp4"
    writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    n, max_tracks, t0 = 0, 0, time.perf_counter()
    while total is None or n < total:
        ok, frame = cap.read()
        if not ok:
            break
        tracks, _, _ = pipe.track(frame)
        counter.update(track_ids(tracks), tracks.xyxy)
        writer.write(draw(frame.copy(), tracks, counter, n / max(time.perf_counter() - t0, 1e-6)))
        max_tracks = max(max_tracks, len(tracks))
        n += 1
    cap.release()
    writer.release()
    elapsed = time.perf_counter() - t0
    print(f"{n} frame từ frame {first}: VÀO {counter.entry_count}, RA {counter.exit_count}, "
          f"không rõ {counter.ambiguous}, tối đa {max_tracks} vết cùng lúc, "
          f"{n / max(elapsed, 1e-6):.1f} FPS xử lý → {out_path}")


if __name__ == "__main__":
    main()
