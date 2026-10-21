"""SwiftletCare – chia dataset theo NGÀY quay (8 chữ số đầu tên file) và ghi data.yaml (plan §7.4).

  python tools/split_by_day.py D:/SwiftletCare/dataset/roboflow D:/SwiftletCare/dataset/final --val 20261024 --test 20261025

Nhận mọi cấu trúc có cặp .../images/x.jpg và .../labels/x.txt (kể cả bản export của Roboflow).
Frame liên tiếp gần như giống hệt nhau: chia theo frame thì ảnh "sinh đôi" lọt vào cả train lẫn test.
"""
import argparse
import re
import shutil
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, Sequence

DATA_YAML = "path: /content/dataset\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n  0: swiftlet\n"


def day_of(name: str) -> str:
    """Roboflow giữ tên gốc rồi thêm đuôi `_jpg.rf.<hash>`, nên ngày vẫn là 8 chữ số đầu."""
    m = re.match(r"\d{8}", name)
    if not m:
        raise ValueError(f"Tên file không bắt đầu bằng YYYYMMDD: {name}")
    return m.group()


def split(src: Path, dst: Path, val: Sequence[str], test: Sequence[str]) -> Dict[str, int]:
    stats: Counter = Counter()
    for img in sorted(src.rglob("*.jpg")):
        day = day_of(img.name)
        part = "test" if day in test else "val" if day in val else "train"
        label = img.parent.parent / "labels" / f"{img.stem}.txt"
        (dst / "images" / part).mkdir(parents=True, exist_ok=True)
        (dst / "labels" / part).mkdir(parents=True, exist_ok=True)
        shutil.copy2(img, dst / "images" / part / img.name)
        if label.exists():
            shutil.copy2(label, dst / "labels" / part / label.name)
        else:                                       # ảnh âm: file nhãn rỗng
            (dst / "labels" / part / f"{img.stem}.txt").write_text("")
        stats[part] += 1
    (dst / "data.yaml").write_text(DATA_YAML)
    return dict(stats)


def main() -> None:
    for stream in (sys.stdout, sys.stderr):      # console Windows mặc định cp1252, không in được tiếng Việt
        stream.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--val", nargs="+", required=True, help="các ngày YYYYMMDD dùng để validate")
    ap.add_argument("--test", nargs="+", required=True, help="các ngày YYYYMMDD dùng để test")
    args = ap.parse_args()
    if set(args.val) & set(args.test):
        ap.error("một ngày không được vừa ở val vừa ở test")
    stats = split(Path(args.src), Path(args.dst), args.val, args.test)
    print(stats)
    if not all(stats.get(k) for k in ("train", "val", "test")):
        raise SystemExit("Thiếu một trong ba tập — kiểm tra --val/--test")


if __name__ == "__main__":
    main()
