"""SwiftletCare – tách frame từ clip theo 2 ô của camera.tiles và sinh nhãn nháp YOLO bằng background subtraction (plan §7.2).

  python tools/extract_frames.py D:/SwiftletCare/clips/20261022_morning_01.mp4 --out D:/SwiftletCare/dataset/raw --start 240 --seconds 1200
  Get-ChildItem D:\\SwiftletCare\\clips\\*.mp4 | ForEach-Object { python tools/extract_frames.py $_.FullName --out D:\\SwiftletCare\\dataset\\raw }

Che dòng ngày giờ (camera.mask) và cắt 2 ô (camera.tiles) bằng đúng src/frame_prep.py mà pipeline dùng lúc chạy:
model train trên ảnh nào thì chạy thật trên đúng ảnh đó. Mỗi frame ra `<clip>_<frame>_t0.jpg` và `_t1.jpg`.
Nhãn nháp khoanh mọi vật chuyển động, kể cả côn trùng dưới đèn IR — chỉ để sửa trên Roboflow, không train thẳng (§7.3).
"""
import argparse
import sys
from pathlib import Path
from typing import List

import cv2
import numpy as np
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from frame_prep import apply_mask, tile_rects  # noqa: E402

CONFIG = Path(__file__).resolve().parents[1] / "config" / "config.yaml"
KERNEL = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))


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


def main() -> None:
    for stream in (sys.stdout, sys.stderr):      # console Windows mặc định cp1252, không in được tiếng Việt
        stream.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("clip", help="tên file phải bắt đầu bằng YYYYMMDD (dùng để chia tập theo ngày, §7.4)")
    ap.add_argument("--out", required=True, help="thư mục ra, tạo images/ và labels/ bên trong")
    ap.add_argument("--start", type=float, default=0, help="bắt đầu từ giây thứ mấy của clip")
    ap.add_argument("--seconds", type=float, help="chỉ tách ngần này giây (bỏ trống = tới hết clip)")
    ap.add_argument("--every", type=int, default=5, help="lưu 1 frame mỗi N frame (25 fps: 5 = 5 ảnh/giây)")
    # 150: nhiễu cảm biến dưới IR ra đốm 49–108 px² sau dilate (đo trên clip 21/10); chim ≥ 15 px trong ảnh
    # đầu vào model ≈ 25×25 px trong ô cao 1080 px (tỉ lệ 640/1080), nên 150 không bỏ sót chim nào model cần thấy
    ap.add_argument("--min-area", type=int, default=150, help="bỏ đốm nhỏ hơn (px²) — nhiễu IR")
    # 60000 (~245×245 px): chim bay sát ống kính thành vệt ~180×180 px (clip 22/10), phải còn trong nhãn nháp
    ap.add_argument("--max-area", type=int, default=60000, help="bỏ đốm lớn hơn (px²) — đổi sáng, người")
    ap.add_argument("--keep-empty", type=int, default=20, help="giữ 1 trong N lần ô không có gì (ảnh âm)")
    args = ap.parse_args()

    clip = Path(args.clip)
    if not clip.name[:8].isdigit():
        ap.error(f"tên clip phải bắt đầu bằng YYYYMMDD: {clip.name}")
    cam = yaml.safe_load(CONFIG.read_text(encoding="utf-8-sig"))["camera"]
    img_dir, lbl_dir = Path(args.out) / "images", Path(args.out) / "labels"
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(clip))
    if not cap.isOpened():
        raise SystemExit(f"Không mở được {clip}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    first = int(args.start * fps)
    last = first + int(args.seconds * fps) if args.seconds else None
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    tiles = bgs = None
    i, saved, empty_seen = first, 0, 0
    while last is None or i < last:
        ok, frame = cap.read()
        if not ok:
            break
        if tiles is None:                         # mỗi ô một mô hình nền riêng
            tiles = tile_rects(cam["tiles"], frame.shape[1], frame.shape[0])
            bgs = [cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=25, detectShadows=False) for _ in tiles]
        frame = apply_mask(frame, cam["mask"])
        crops = [frame[y1:y2, x1:x2] for x1, y1, x2, y2 in tiles]
        masks = [bg.apply(c) for bg, c in zip(bgs, crops)]   # chạy trên MỌI frame để mô hình nền hội tụ
        i += 1
        if i - first < 100 or i % args.every:     # 100 frame đầu nền chưa ổn định
            continue
        for k, (crop, mask) in enumerate(zip(crops, masks)):
            lines = draft_labels(mask, args.min_area, args.max_area)
            if not lines:
                empty_seen += 1
                if empty_seen % args.keep_empty:
                    continue
            stem = f"{clip.stem}_{i - 1:06d}_t{k}"
            cv2.imwrite(str(img_dir / f"{stem}.jpg"), crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
            (lbl_dir / f"{stem}.txt").write_text("\n".join(lines))
            saved += 1
    cap.release()
    print(f"{clip.name}: đọc tới frame {i}, {len(tiles or [])} ô, lưu {saved} ảnh vào {args.out}")


if __name__ == "__main__":
    main()
