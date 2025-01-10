import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Check, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";

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
  const { loader } = useUser();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6 text-purple-400">Agent Management</h2>

      <ScrollArea className="h-[calc(100vh-24rem)] overflow-y-auto pr-4">
        <div className="space-y-6">
          {agents?.map((agent) => (
            <Card
              key={agent.id}
              className={cn(
                "p-6 bg-gray-900/50 border-purple-500/30 mb-4",
                "hover:bg-gray-800/50 cursor-pointer",
                "overflow-visible transition-all duration-200",
                selectedAgent === agent.id ? 'ring-2 ring-purple-500' : ''
              )}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                <div className="space-y-3 flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-purple-400">{agent.name}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {agent.description}
                  </p>
                  {agent.currentTask && (
                    <p className="text-sm text-gray-400">
                      <span className="font-medium text-purple-400">Current:</span> {agent.currentTask}
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
                  <span className="text-xs text-gray-500 truncate max-w-[200px]">
                    <span className="font-medium">Goals:</span> {agent.goals}
                  </span>
                )}
              </div>
            </Card>
          ))}

          {agents.length === 0 && !loader && (
            <div className="text-center py-8 text-gray-400">
              No agents deployed yet. Use the deployment panel to add agents.
            </div>
          )}
          {loader && (
            <div className="flex-col gap-4 w-full flex items-center justify-center">
              <div
                className="w-20 h-20 border-4 border-transparent text-blue-400 text-4xl animate-spin flex items-center justify-center border-t-blue-400 rounded-full"
              >
                <div
                  className="w-16 h-16 border-4 border-transparent text-red-400 text-2xl animate-spin flex items-center justify-center border-t-red-400 rounded-full"
                ></div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
