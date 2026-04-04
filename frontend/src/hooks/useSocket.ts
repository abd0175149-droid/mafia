'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

/**
 * Hook مخصص لإدارة اتصال Socket.IO
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Check current connection state
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  /**
   * إرسال حدث مع callback
   */
  const emit = useCallback((event: string, data: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        return reject(new Error('Socket not initialized'));
      }

      socketRef.current.emit(event, data, (response: any) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  }, []);

  /**
   * الاستماع لحدث
   */
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    on,
  };
}
