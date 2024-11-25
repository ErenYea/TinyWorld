import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Log {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'interaction' | 'behavior';
  message: string;
}

interface LogViewerProps {
  logs: Log[];
}

export function LogViewer({ logs }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full">
      <h2 className="text-xl font-semibold mb-4 text-purple-400">System Logs</h2>
      
      <ScrollArea className="h-[calc(100%-2rem)] border border-purple-500/30 rounded-md bg-black/50 p-2">
        <div className="font-mono text-sm space-y-2" ref={scrollRef}>
          {logs.map((log) => (
            <div
              key={log.id}
              className={`
                ${log.type === 'error' ? 'text-red-400' :
                  log.type === 'warning' ? 'text-yellow-400' :
                  log.type === 'interaction' ? 'text-blue-400' :
                  log.type === 'behavior' ? 'text-purple-400' :
                  'text-green-400'}
              `}
            >
              <span className="text-gray-500">[{log.timestamp}]</span>{' '}
              <span className="text-purple-400">{log.type.toUpperCase()}</span>{' '}
              {log.message}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
