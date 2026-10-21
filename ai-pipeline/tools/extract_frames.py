"""SwiftletCare – tách frame từ clip, crop theo ROI và sinh nhãn nháp YOLO bằng background subtraction (plan §7.2).

  python tools/extract_frames.py D:/SwiftletCare/clips/20261022_morning_01.mp4 --out D:/SwiftletCare/dataset/raw
  Get-ChildItem D:\\SwiftletCare\\clips\\*.mp4 | ForEach-Object { python tools/extract_frames.py $_.FullName --out D:\\SwiftletCare\\dataset\\raw }

ROI mặc định lấy từ camera.roi trong config/config.yaml: model train trên ảnh crop nào thì chạy thật trên đúng crop đó.
Nhãn nháp khoanh mọi vật chuyển động, kể cả côn trùng dưới đèn IR — chỉ để sửa trên Roboflow, không train thẳng (§7.3).
"""
import argparse
import sys
from pathlib import Path
from typing import List, Sequence

import cv2
import numpy as np
import yaml

CONFIG = Path(__file__).resolve().parents[1] / "config" / "config.yaml"
KERNEL = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))


def roi_pixels(roi: Sequence[float], width: int, height: int) -> tuple:
    return tuple(int(r * (width, height)[i % 2]) for i, r in enumerate(roi))


def draft_labels(mask: np.ndarray, min_area: int, max_area: int) -> List[str]:
    """Đốm chuyển động trong mask → dòng nhãn YOLO `0 cx cy w h` (tỉ lệ theo ảnh crop)."""
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
    ap.add_argument("--roi", nargs=4, type=float, help="x1 y1 x2 y2 theo tỉ lệ; bỏ trống = camera.roi trong config")
    ap.add_argument("--every", type=int, default=5, help="lưu 1 frame mỗi N frame (25 fps: 5 = 5 ảnh/giây)")
    # 150: nhiễu cảm biến dưới IR ra đốm 49–108 px² sau dilate (đo trên clip 21/10); chim ≥ 15 px trong ảnh
    # đầu vào model ≈ 22×22 px trong crop ROI 960 px, nên 150 không bỏ sót chim nào model cần thấy
    ap.add_argument("--min-area", type=int, default=150, help="bỏ đốm nhỏ hơn (px²) — nhiễu IR")
    ap.add_argument("--max-area", type=int, default=20000, help="bỏ đốm lớn hơn (px²) — đổi sáng, người")
    ap.add_argument("--keep-empty", type=int, default=20, help="giữ 1 trong N frame không có gì (ảnh âm)")
    args = ap.parse_args()

    clip = Path(args.clip)
    if not clip.name[:8].isdigit():
        ap.error(f"tên clip phải bắt đầu bằng YYYYMMDD: {clip.name}")
    roi = args.roi or yaml.safe_load(CONFIG.read_text(encoding="utf-8-sig"))["camera"]["roi"]
    img_dir, lbl_dir = Path(args.out) / "images", Path(args.out) / "labels"
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(clip))
    if not cap.isOpened():
        raise SystemExit(f"Không mở được {clip}")
    bg = cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=25, detectShadows=False)
    i = saved = empty_seen = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        x1, y1, x2, y2 = roi_pixels(roi, frame.shape[1], frame.shape[0])
        crop = frame[y1:y2, x1:x2]
        mask = bg.apply(crop)                     # chạy trên MỌI frame để mô hình nền hội tụ
        i += 1
        if i < 100 or i % args.every:             # 100 frame đầu nền chưa ổn định
            continue
        lines = draft_labels(mask, args.min_area, args.max_area)
        if not lines:
            empty_seen += 1
            if empty_seen % args.keep_empty:
                continue
        stem = f"{clip.stem}_{i:06d}"
        cv2.imwrite(str(img_dir / f"{stem}.jpg"), crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
        (lbl_dir / f"{stem}.txt").write_text("\n".join(lines))
        saved += 1
    cap.release()
    print(f"{clip.name}: đọc {i} frame, ROI {x2 - x1}x{y2 - y1}px, lưu {saved} ảnh vào {args.out}")


if __name__ == "__main__":
    main()
