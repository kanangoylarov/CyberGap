import { useState, useEffect, useRef, useCallback } from 'react';
import type { LogEntry, WebSocketMessage } from '@/types';

const MAX_MESSAGES = 1000;
const INITIAL_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

interface UseWebSocketReturn {
  messages: LogEntry[];
  isConnected: boolean;
  error: string | null;
  clearMessages: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [messages, setMessages] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    function buildUrl(): string {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/api/admin/ws/live`;
    }

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(buildUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setError(null);
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);

          if (msg.type === 'logs' && msg.data) {
            setMessages((prev) => {
              const combined = [...msg.data!, ...prev];
              return combined.slice(0, MAX_MESSAGES);
            });
          } else if (msg.type === 'error' && msg.message) {
            setError(msg.message);
          }
        } catch {
          // Ignore unparseable messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setError('WebSocket connection error');
        setIsConnected(false);
        ws.close();
      };
    }

    function scheduleReconnect() {
      if (!mountedRef.current) return;

      const delay = reconnectDelayRef.current;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, delay);

      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
    }

    connect();

    return () => {
      mountedRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { messages, isConnected, error, clearMessages };
}
