import { useEffect, useState, type RefObject } from 'react';

import { cameraApi } from '@/apis/farm-owner/camera.api';

export type StreamStatus = 'idle' | 'connecting' | 'playing' | 'failed';

// Địa chỉ trang WHEP của MediaMTX; chưa khai báo thì dùng cổng 8889 cùng máy với web (docker-compose dev)
const STREAM_URL = import.meta.env.VITE_STREAM_URL ?? `${window.location.protocol}//${window.location.hostname}:8889`;
// Chờ gom ICE candidate tối đa 2 giây rồi mới gửi offer
const ICE_GATHERING_TIMEOUT_MS = 2000;

// Chờ trình duyệt gom xong ICE candidate (hoặc hết giờ)
function waitIceGathering(peer: RTCPeerConnection): Promise<void> {
  return new Promise(resolve => {
    if (peer.iceGatheringState === 'complete') return resolve();
    peer.addEventListener('icegatheringstatechange', () => {
      if (peer.iceGatheringState === 'complete') resolve();
    });
    setTimeout(resolve, ICE_GATHERING_TIMEOUT_MS);
  });
}

// VISION-FR-013 — xin token rồi mở WebRTC (WHEP) tới MediaMTX, gắn hình vào thẻ <video>; khung nhận diện đã vẽ sẵn trong hình
export function useWhepStream(videoRef: RefObject<HTMLVideoElement>, cameraNodeId: string | undefined) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  // Tăng lên để mở lại kết nối (nút Thử lại)
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!cameraNodeId) {
      setStatus('idle');
      return undefined;
    }
    let isCancelled = false;
    const peer = new RTCPeerConnection();
    const fail = () => {
      if (!isCancelled) setStatus('failed');
    };
    setStatus('connecting');
    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.ontrack = event => {
      if (videoRef.current) videoRef.current.srcObject = event.streams[0];
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected' && !isCancelled) setStatus('playing');
      // disconnected thường tự nối lại nên chỉ hiện đang kết nối; failed mới là lỗi cuối
      if (peer.connectionState === 'disconnected' && !isCancelled) setStatus('connecting');
      if (peer.connectionState === 'failed') fail();
    };

    void (async () => {
      const { path, token } = (await cameraApi.streamToken(cameraNodeId)).data.data;
      await peer.setLocalDescription(await peer.createOffer());
      await waitIceGathering(peer);
      if (isCancelled) return;
      const response = await fetch(`${STREAM_URL}/${path}/whep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${token}` },
        body: peer.localDescription?.sdp,
      });
      if (!response.ok) throw new Error('whep');
      const answer = await response.text();
      if (isCancelled) return;
      await peer.setRemoteDescription({ type: 'answer', sdp: answer });
    })().catch(fail);

    const video = videoRef.current;
    return () => {
      isCancelled = true;
      peer.close();
      if (video) video.srcObject = null;
    };
  }, [cameraNodeId, attempt, videoRef]);

  return { status, retry: () => setAttempt(current => current + 1) };
}
