import { useEffect, useState } from 'react';

import { getSocket } from '@/lib/socket';

// Mất socket thì màn realtime bật hỏi lại định kỳ
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
