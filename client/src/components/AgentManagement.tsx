import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Check, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  status: string;
  currentTask?: string;
  description?: string;
  goals?: string;
}

interface AgentManagementProps {
  agents: Agent[];
  onExportData: (agentId: string) => void;
  onTerminateAgent: (agentId: string) => void;
}

export function AgentManagement({ agents, onExportData, onTerminateAgent }: AgentManagementProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-4 text-purple-400">Agent Management</h2>
      
      <ScrollArea className="flex-1 min-h-0 max-h-[calc(100vh-20rem)] pr-4">
        <div className="space-y-4">
          {agents?.map((agent) => (
            <Card 
              key={agent.id}
              className={cn(
                "p-4 bg-gray-900/50 border-purple-500/30 transition-all duration-200",
                "hover:bg-gray-800/50 cursor-pointer",
                "overflow-hidden",
                selectedAgent === agent.id ? 'ring-2 ring-purple-500' : ''
              )}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <h3 className="font-medium text-purple-400 truncate">{agent.name}</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    {agent.description}
                  </p>
                  {agent.currentTask && (
                    <p className="text-sm text-gray-500 truncate">
                      <span className="font-medium">Current:</span> {agent.currentTask}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-500/30 hover:bg-green-500/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportData(agent.id);
                    }}
                    title="Export agent data"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 hover:bg-red-500/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTerminateAgent(agent.id);
                    }}
                    title="Terminate agent"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs",
                  agent.status === 'running' ? 'bg-green-500/20 text-green-400' :
                  agent.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                )}>
                  {agent.status.toUpperCase()}
                </span>
                {agent.goals && (
                  <span className="text-xs text-gray-500 truncate max-w-full">
                    <span className="font-medium">Goals:</span> {agent.goals}
                  </span>
                )}
              </div>
            </Card>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No agents deployed yet. Use the deployment panel to add agents.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
