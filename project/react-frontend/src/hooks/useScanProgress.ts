import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ScanProgress {
  scan_id: string;
  status: string;
  total_stocks: number;
  processed_stocks: number;
  successful_stocks: number;
  failed_stocks: number;
  results_count: number;
  execution_time_ms: number;
}

interface WSMessage {
  type: string;
  payload: ScanProgress;
}

export function useScanProgress() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [liveProgress, setLiveProgress] = useState<Record<string, ScanProgress>>({});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : 'localhost:8080';
    const ws = new WebSocket(`${protocol}//${host}/ws/scans`);

    ws.onopen = () => {
      console.debug('[WS] Connected to scan progress');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        if (msg.type === 'scan_progress') {
          const progress = msg.payload;
          setLiveProgress(prev => ({ ...prev, [progress.scan_id]: progress }));

          if (progress.status === 'completed' || progress.status === 'failed') {
            queryClient.invalidateQueries({ queryKey: ['scans'] });
            queryClient.invalidateQueries({ queryKey: ['scan', progress.scan_id] });
            queryClient.invalidateQueries({ queryKey: ['scan-results', progress.scan_id] });

            setLiveProgress(prev => {
              const next = { ...prev };
              delete next[progress.scan_id];
              return next;
            });
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      console.debug('[WS] Disconnected, reconnecting in 3s...');
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { liveProgress };
}
