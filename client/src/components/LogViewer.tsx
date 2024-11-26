import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';

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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={`transition-all duration-300 ${expanded ? 'fixed inset-4 z-50 bg-gray-900/95 p-6 rounded-lg border border-purple-500/30' : 'h-full'}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-purple-400">System Logs</h2>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-purple-500/20"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
      
      <ScrollArea className={`border border-purple-500/30 rounded-md bg-black/50 p-4 ${expanded ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100%-3rem)]'}`}>
        <div className="font-mono text-sm space-y-3" ref={scrollRef}>
          {logs.map((log) => (
            <div
              key={log.id}
              className={`
                py-1 px-2 rounded hover:bg-gray-800/50 transition-colors
                ${log.type === 'error' ? 'text-red-400 bg-red-500/10' :
                  log.type === 'warning' ? 'text-yellow-400 bg-yellow-500/10' :
                  log.type === 'interaction' ? 'text-blue-400 bg-blue-500/10' :
                  log.type === 'behavior' ? 'text-purple-400 bg-purple-500/10' :
                  'text-green-400 bg-green-500/10'}
              `}
            >
              <span className="text-gray-400 mr-2">[{log.timestamp}]</span>
              <span className="text-purple-400 font-medium mr-2">{log.type.toUpperCase()}</span>
              <span className="break-words">{log.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
