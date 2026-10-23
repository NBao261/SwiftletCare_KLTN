import { useEffect, useState } from 'react';

import { getSocket } from '@/lib/socket';

// Socket đang kết nối hay không — màn realtime dùng để hiện "Trực tiếp / Tự làm mới" và bật hỏi lại định kỳ khi mất socket (FE_Design 5.5)
export function useSocketConnected(): boolean {
  const [isConnected, setIsConnected] = useState(() => getSocket().connected);

  useEffect(() => {
    const socket = getSocket();
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    setIsConnected(socket.connected);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  return isConnected;
}
