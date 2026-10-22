"""SwiftletCare – tách frame từ clip theo 2 ô của camera.tiles và sinh nhãn nháp YOLO cho Roboflow (plan §7.2).

  python tools/extract_frames.py D:/SwiftletCare/clips/20261022_morning_01.mp4 --out D:/SwiftletCare/dataset/raw --start 240 --seconds 1260
  Get-ChildItem D:\\SwiftletCare\\clips\\*.mp4 | ForEach-Object { python tools/extract_frames.py $_.FullName --out D:\\SwiftletCare\\dataset\\raw }

Che dòng ngày giờ (camera.mask) và cắt 2 ô (camera.tiles) bằng đúng src/frame_prep.py mà pipeline dùng lúc chạy:
model train trên ảnh nào thì chạy thật trên đúng ảnh đó. Mỗi frame ra `<clip>_<frame>_t0.jpg` và `_t1.jpg`.

Nhãn nháp (--draft):
- tracks (mặc định): vật chuyển động → ByteTrack như tools/track_clip.py --detector motion, chỉ giữ vết sống
  ≥ --min-track-frames frame và dời ≥ --min-track-move px. Lọc được nhiễu nhấp nháy; chạy 2 lượt qua clip.
- blobs: đốm chuyển động của từng frame, không qua tracker (cách cũ, nhiễu hơn).
Nhãn nháp vẫn sót chim đứng yên, gộp 2 con sát nhau, bắt cả côn trùng — phải sửa trên Roboflow, không train thẳng (§7.3).
"""
import argparse
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import cv2
import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from frame_prep import apply_mask, tile_rects  # noqa: E402

CONFIG = Path(__file__).resolve().parents[1] / "config" / "config.yaml"
# Roboflow đọc tên class của nhãn YOLO từ file này; thiếu thì class hiện là "0" (plan §7.3)
ROBOFLOW_YAML = "nc: 1\nnames: [swiftlet]\n"
KERNEL = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
Box = Tuple[float, float, float, float]


def draft_labels(mask: np.ndarray, min_area: int, max_area: int) -> List[str]:
    """Đốm chuyển động trong mask → dòng nhãn YOLO `0 cx cy w h` (tỉ lệ theo ảnh ô)."""
    mask = cv2.dilate(cv2.morphologyEx(mask, cv2.MORPH_OPEN, KERNEL), KERNEL, iterations=2)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = mask.shape[:2]
    lines = []
    for c in contours:
        bx, by, bw, bh = cv2.boundingRect(c)
        if min_area <= bw * bh <= max_area:
            lines.append(f"0 {(bx + bw / 2) / w:.6f} {(by + bh / 2) / h:.6f} {bw / w:.6f} {bh / h:.6f}")
    return lines


def tile_labels(boxes: Sequence[Box], tile: Tuple[int, int, int, int]) -> List[str]:
    """Ô của vết (pixel khung gốc) có tâm nằm trong ô ảnh → dòng nhãn YOLO theo ô, cắt phần lòi ra ngoài ô."""
    x1, y1, x2, y2 = tile
    w, h = x2 - x1, y2 - y1
    lines = []
    for bx1, by1, bx2, by2 in boxes:
        if not (x1 <= (bx1 + bx2) / 2 < x2 and y1 <= (by1 + by2) / 2 < y2):
            continue
        cx1, cy1 = max(bx1, x1) - x1, max(by1, y1) - y1
        cx2, cy2 = min(bx2, x2) - x1, min(by2, y2) - y1
        lines.append(f"0 {(cx1 + cx2) / 2 / w:.6f} {(cy1 + cy2) / 2 / h:.6f} {(cx2 - cx1) / w:.6f} {(cy2 - cy1) / h:.6f}")
    return lines


def keep_tracks(history: Dict[int, List[Tuple[float, float]]], min_frames: int, min_move: float) -> set:
    """id của các vết đủ dài và thật sự di chuyển (tâm đầu → tâm cuối)."""
    return {tid for tid, c in history.items()
            if len(c) >= min_frames and math.dist(c[0], c[-1]) >= min_move}


def track_boxes(clip: Path, first: int, last, cfg: dict, min_frames: int, min_move: float) -> Dict[int, List[Box]]:
    """Lượt 1: vật chuyển động → ByteTrack trên cả khung đã che; trả {frame: ô của các vết được giữ}."""
    import supervision as sv
    from pipeline import scale_boxes, to_sv
    from track_clip import MotionDetector

    t = cfg["tracking"]
    tracker = sv.ByteTrack(track_activation_threshold=cfg["model"]["confidence_threshold"],
                           lost_track_buffer=t["lost_track_buffer"],
                           minimum_matching_threshold=t["minimum_matching_threshold"],
                           frame_rate=cfg["camera"]["fps"])
    detector = MotionDetector()
    cap = cv2.VideoCapture(str(clip))
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    per_frame: Dict[int, List[Tuple[int, Box]]] = {}
    history: Dict[int, List[Tuple[float, float]]] = defaultdict(list)
    i = first
    while last is None or i < last:
        ok, frame = cap.read()
        if not ok:
            break
        dets, _ = detector.infer_tiles(apply_mask(frame, cfg["camera"]["mask"]), None, None)
        det = to_sv(dets)
        if len(det):
            det.xyxy = scale_boxes(det.xyxy, t["box_pad"])
        tracks = tracker.update_with_detections(det)
        if len(tracks) and tracks.tracker_id is not None:
            boxes = scale_boxes(tracks.xyxy, 1 / t["box_pad"])
            per_frame[i] = [(int(tid), tuple(map(float, b))) for tid, b in zip(tracks.tracker_id, boxes)]
            for tid, b in per_frame[i]:
                history[tid].append(((b[0] + b[2]) / 2, (b[1] + b[3]) / 2))
        i += 1
    cap.release()
    kept = keep_tracks(history, min_frames, min_move)
    print(f"Lượt 1: {i - first} frame, {len(history)} vết, giữ {len(kept)} vết")
    return {f: [b for tid, b in v if tid in kept] for f, v in per_frame.items()}


def main() -> None:
    for stream in (sys.stdout, sys.stderr):      # console Windows mặc định cp1252, không in được tiếng Việt
        stream.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("clip", help="tên file phải bắt đầu bằng YYYYMMDD (dùng để chia tập theo ngày, §7.4)")
    ap.add_argument("--out", required=True, help="thư mục ra, tạo images/ và labels/ bên trong")
    ap.add_argument("--start", type=float, default=0, help="bắt đầu từ giây thứ mấy của clip")
    ap.add_argument("--seconds", type=float, help="chỉ tách ngần này giây (bỏ trống = tới hết clip)")
    ap.add_argument("--every", type=int, default=5, help="lưu 1 frame mỗi N frame (25 fps: 5 = 5 ảnh/giây)")
    ap.add_argument("--draft", choices=["tracks", "blobs"], default="tracks", help="nguồn nhãn nháp, xem đầu file")
    # 3 frame: nhiễu IR nhấp nháy sống 1–2 frame; chim lượn ở trong khung nhiều giây (clip 22/10). Chọn tay.
    ap.add_argument("--min-track-frames", type=int, default=3, help="tracks: bỏ vết sống ít hơn ngần này frame")
    # 20 px: chim lượn dời 20–35 px mỗi frame, sống ≥ 3 frame thì đi ≥ 40 px; đốm đứng yên thì ~0. Chọn tay.
    ap.add_argument("--min-track-move", type=float, default=20, help="tracks: bỏ vết dời (đầu → cuối) ít hơn ngần này px")
    # 150: nhiễu cảm biến dưới IR ra đốm 49–108 px² sau dilate (đo trên clip 21/10); chim ≥ 15 px trong ảnh
    # đầu vào model ≈ 25×25 px trong ô cao 1080 px (tỉ lệ 640/1080), nên 150 không bỏ sót chim nào model cần thấy
    ap.add_argument("--min-area", type=int, default=150, help="blobs: bỏ đốm nhỏ hơn (px²) — nhiễu IR")
    # 60000 (~245×245 px): chim bay sát ống kính thành vệt ~180×180 px (clip 22/10), phải còn trong nhãn nháp
    ap.add_argument("--max-area", type=int, default=60000, help="blobs: bỏ đốm lớn hơn (px²) — đổi sáng, người")
    ap.add_argument("--keep-empty", type=int, default=20, help="giữ 1 trong N lần ô không có gì (ảnh âm)")
    args = ap.parse_args()

    clip = Path(args.clip)
    if not clip.name[:8].isdigit():
        ap.error(f"tên clip phải bắt đầu bằng YYYYMMDD: {clip.name}")
    cfg = yaml.safe_load(CONFIG.read_text(encoding="utf-8-sig"))
    cam = cfg["camera"]
    img_dir, lbl_dir = Path(args.out) / "images", Path(args.out) / "labels"
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(clip))
    if not cap.isOpened():
        raise SystemExit(f"Không mở được {clip}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    first = int(args.start * fps)
    last = first + int(args.seconds * fps) if args.seconds else None
    tracked = track_boxes(clip, first, last, cfg, args.min_track_frames, args.min_track_move) \
        if args.draft == "tracks" else None
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    tiles = bgs = None
    i, saved, empty_seen = first, 0, 0
    while last is None or i < last:
        ok, frame = cap.read()
        if not ok:
            break
        idx, i = i, i + 1
        if tiles is None:
            tiles = tile_rects(cam["tiles"], frame.shape[1], frame.shape[0])
            bgs = [cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=25, detectShadows=False) for _ in tiles]
        frame = apply_mask(frame, cam["mask"])
        crops = [frame[y1:y2, x1:x2] for x1, y1, x2, y2 in tiles]
        if tracked is None:                       # blobs: mỗi ô một mô hình nền, chạy trên MỌI frame để hội tụ
            masks = [bg.apply(c) for bg, c in zip(bgs, crops)]
        if idx - first < 100 or idx % args.every:  # 100 frame đầu nền / tracker chưa ổn định
            continue
        for k, crop in enumerate(crops):
            lines = (tile_labels(tracked.get(idx, []), tiles[k]) if tracked is not None
                     else draft_labels(masks[k], args.min_area, args.max_area))
            if not lines:
                empty_seen += 1
                if empty_seen % args.keep_empty:
                    continue
            stem = f"{clip.stem}_{idx:06d}_t{k}"
            cv2.imwrite(str(img_dir / f"{stem}.jpg"), crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
            (lbl_dir / f"{stem}.txt").write_text("\n".join(lines))
            saved += 1
    cap.release()
    (Path(args.out) / "data.yaml").write_text(ROBOFLOW_YAML)
    print(f"{clip.name}: đọc tới frame {i}, {len(tiles or [])} ô, nhãn nháp {args.draft}, lưu {saved} ảnh vào {args.out}")


if __name__ == "__main__":
    main()
