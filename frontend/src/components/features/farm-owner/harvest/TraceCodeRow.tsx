import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui";

/**
 * TraceCodeRow – mã QR truy xuất nguồn gốc (MARKET-FR-004), dùng để in lên bao
 * bì cho khách quét. Sinh QR hoàn toàn phía client (thư viện `qrcode`, không
 * gọi dịch vụ ngoài) — không hiện chuỗi UUID thô ra màn hình, tránh trông như
 * mã hệ thống/debug bị lộ.
 */
export default function TraceCodeRow({ traceCode }: { traceCode: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(traceCode, { width: 160, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [traceCode]);

  function download() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "ma-qr-truy-xuat-nguon-goc.png";
    a.click();
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-warmGray/5 px-4 py-3">
      <div className="flex items-center gap-3">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Mã QR truy xuất nguồn gốc"
            width={64}
            height={64}
            className="rounded-lg border border-warmGray/15 bg-white p-1"
          />
        ) : (
          <div className="h-16 w-16 animate-pulse rounded-lg bg-warmGray/15" />
        )}
        <div>
          <p className="label-caption">Mã QR truy xuất nguồn gốc</p>
          <p className="text-xs text-warmGray">In lên bao bì để khách quét tra cứu</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={download} disabled={!qrDataUrl}>
        Tải mã QR
      </Button>
    </div>
  );
}
