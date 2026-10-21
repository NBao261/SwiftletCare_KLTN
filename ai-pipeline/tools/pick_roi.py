"""SwiftletCare – lấy ROI và vòng đếm cho config.yaml (plan §6.8).

Click lần lượt các góc viền ngoài của miệng lỗ / hộp gỗ trên một khung hình, theo một chiều.
Công cụ nới viền đó ra đều `--margin` px thành vòng đếm, lấy ROI = khung bao vòng nới thêm `--roi-pad` px,
rồi in khối YAML để chép vào config.yaml.

  python tools/pick_roi.py                       # lấy 1 khung từ CAMERA_RTSP_URL trong .env
  python tools/pick_roi.py D:/SwiftletCare/frames/frame.png --margin 60 --roi-pad 250 --save D:/SwiftletCare/frames/picked.png

Phím: z = bỏ điểm cuối, + / - = nới vòng thêm/bớt 10 px, Enter = in YAML (và lưu ảnh nếu có --save), Esc = thoát.
Cửa sổ thu phóng được (kéo to cửa sổ để click chính xác từng góc).
"""
import argparse
import os
from typing import List, Sequence, Tuple

import cv2
import numpy as np

Point = Tuple[float, float]


def offset_polygon(points: Sequence[Point], d: float) -> List[Point]:
    """Nới đa giác lồi ra ngoài đều d px: dời từng cạnh theo pháp tuyến rồi lấy giao của hai cạnh kề."""
    p = np.asarray(points, np.float64)
    center = p.mean(axis=0)
    lines = []
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        t = (b - a) / np.linalg.norm(b - a)
        n = np.array([-t[1], t[0]])
        if np.dot(n, a - center) < 0:
            n = -n
        lines.append((a + n * d, t))
    out = []
    for i in range(len(p)):
        (p1, t1), (p2, t2) = lines[i - 1], lines[i]
        s = np.linalg.solve(np.array([t1, -t2]).T, p2 - p1)[0]
        out.append(tuple(p1 + s * t1))
    return out


def roi_around(ring: Sequence[Point], pad: float, w: int, h: int) -> Tuple[int, int, int, int]:
    xs, ys = [x for x, _ in ring], [y for _, y in ring]
    return (int(max(0, min(xs) - pad)), int(max(0, min(ys) - pad)),
            int(min(w, max(xs) + pad)), int(min(h, max(ys) + pad)))


def grab_frame(src: str) -> np.ndarray:
    if src.lower().endswith((".png", ".jpg", ".jpeg")):
        frame = cv2.imread(src)
    else:
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
        cap = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
        frame = None
        for _ in range(30):                     # bỏ vài khung đầu, ảnh RTSP còn vỡ
            ok, f = cap.read()
            if ok:
                frame = f
        cap.release()
    if frame is None:
        raise SystemExit(f"Không đọc được khung hình từ {src}")
    return frame


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", nargs="?", help="ảnh, clip hoặc rtsp://; bỏ trống = CAMERA_RTSP_URL trong .env")
    ap.add_argument("--margin", type=float, default=60, help="px nới vòng đếm ra khỏi viền lỗ")
    ap.add_argument("--roi-pad", type=float, default=250, help="px nới ROI ra khỏi vòng đếm")
    ap.add_argument("--save", help="đường dẫn lưu ảnh đã vẽ")
    args = ap.parse_args()

    src = args.source
    if not src:
        from dotenv import load_dotenv
        load_dotenv()
        src = os.environ.get("CAMERA_RTSP_URL") or ap.error("không có source và .env thiếu CAMERA_RTSP_URL")
    frame = grab_frame(src)
    h, w = frame.shape[:2]
    pts: List[Point] = []
    margin = args.margin

    def on_click(event: int, x: int, y: int, *_: object) -> None:
        if event == cv2.EVENT_LBUTTONDOWN:
            pts.append((float(x), float(y)))

    cv2.namedWindow("pick_roi", cv2.WINDOW_NORMAL)
    cv2.setMouseCallback("pick_roi", on_click)
    while True:
        img = frame.copy()
        for x, y in pts:
            cv2.circle(img, (int(x), int(y)), 4, (0, 0, 255), -1)
        if len(pts) >= 2:
            cv2.polylines(img, [np.int32(pts)], len(pts) >= 3, (0, 0, 255), 1)
        ring = offset_polygon(pts, margin) if len(pts) >= 3 else []
        if ring:
            cv2.polylines(img, [np.int32(ring)], True, (0, 255, 255), 2)
            x1, y1, x2, y2 = roi_around(ring, args.roi_pad, w, h)
            cv2.rectangle(img, (x1, y1), (x2, y2), (255, 255, 255), 2)
            cv2.putText(img, f"margin {margin:.0f}px  ROI {x2 - x1}x{y2 - y1}px", (20, h - 20), 0, 1, (0, 255, 255), 2)
        cv2.imshow("pick_roi", img)
        k = cv2.waitKey(30) & 0xFF
        if k == 27:
            break
        if k == ord("z") and pts:
            pts.pop()
        elif k in (ord("+"), ord("=")):
            margin += 10
        elif k == ord("-"):
            margin = max(0, margin - 10)
        elif k == 13 and ring:
            print(f"# khung {w}x{h}, viền lỗ (px): {[(int(x), int(y)) for x, y in pts]}, margin {margin:.0f}px")
            print(f"  roi: [{x1 / w:.3f}, {y1 / h:.3f}, {x2 / w:.3f}, {y2 / h:.3f}]   # {x2 - x1}x{y2 - y1}px")
            print("  ring:")
            for x, y in ring:
                print(f"    - [{x / w:.3f}, {y / h:.3f}]")
            if args.save:
                cv2.imwrite(args.save, img)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
