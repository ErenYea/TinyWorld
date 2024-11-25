import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayCircle, PauseCircle, RotateCcw } from "lucide-react";

interface ControlPanelProps {
  status: 'idle' | 'running' | 'paused';
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function ControlPanel({
  status,
  onStart,
  onPause,
  onReset
}: ControlPanelProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-purple-400">
        Simulation Controls
      </h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-gray-800 p-3 rounded-md">
          <span>Status:</span>
          <span className={`px-2 py-1 rounded-md ${
            status === 'running' ? 'bg-green-500/20 text-green-400' :
            status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {status === 'running' ? (
            <Button
              variant="outline"
              className="w-full border-yellow-500/30 hover:bg-yellow-500/20"
              onClick={onPause}
            >
              <PauseCircle className="mr-2 h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full border-green-500/30 hover:bg-green-500/20"
              onClick={onStart}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          
          <Button
            variant="outline"
            className="w-full border-red-500/30 hover:bg-red-500/20"
            onClick={onReset}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
