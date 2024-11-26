import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Check, X, Download } from "lucide-react";

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
    <div>
      <h2 className="text-xl font-semibold mb-4 text-purple-400">Agent Management</h2>
      
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-3">
          {agents?.map((agent) => (
            <Card 
              key={agent.id}
              className={`p-4 bg-gray-900/50 border-purple-500/30 transition-all duration-200 hover:bg-gray-800/50 ${
                selectedAgent === agent.id ? 'ring-2 ring-purple-500' : ''
              }`}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-purple-400">{agent.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">{agent.description}</p>
                  {agent.currentTask && (
                    <p className="text-sm text-gray-500 mt-1">Current: {agent.currentTask}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-500/30 hover:bg-green-500/20"
                    onClick={() => onExportData(agent.id)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 hover:bg-red-500/20"
                    onClick={() => onTerminateAgent(agent.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  agent.status === 'running' ? 'bg-green-500/20 text-green-400' :
                  agent.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {agent.status.toUpperCase()}
                </span>
                {agent.goals && (
                  <span className="text-xs text-gray-500">Goals: {agent.goals}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
