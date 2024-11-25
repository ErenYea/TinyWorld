import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AgentDeployment } from "../components/AgentDeployment";
import { ControlPanel } from "../components/ControlPanel";
import { LogViewer } from "../components/LogViewer";
import { NodeGraph } from "../components/NodeGraph";
import { MatrixAnimation } from "../components/MatrixAnimation";
import { MetricsPanel } from "../components/MetricsPanel";
import { useSimulation } from "../hooks/useSimulation";

export default function SimulationDashboard() {
  const { 
    agents, 
    simulationStatus,
    logs,
    metrics,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    deployAgent,
    wsStatus
  } = useSimulation();

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-[1800px] mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-purple-400">
          AI Mission Control
        </h1>
        
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column */}
          <div className="col-span-3 space-y-4">
            <Card className="p-4 bg-gray-900/50 border-purple-500/30">
              <AgentDeployment onDeploy={deployAgent} />
            </Card>
            
            <Card className="p-4 bg-gray-900/50 border-purple-500/30">
              <ControlPanel 
                status={simulationStatus}
                wsStatus={wsStatus}
                onStart={startSimulation}
                onPause={pauseSimulation}
                onReset={resetSimulation}
              />
            </Card>

            <MetricsPanel metrics={metrics} />
          </div>

          {/* Center Column */}
          <div className="col-span-6">
            <Card className="p-4 h-[600px] bg-gray-900/50 border-purple-500/30 relative overflow-hidden">
              <NodeGraph agents={agents} />
              {simulationStatus === 'running' && (
                <MatrixAnimation className="absolute inset-0 opacity-20 pointer-events-none" />
              )}
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-3">
            <Card className="p-4 h-[600px] bg-gray-900/50 border-purple-500/30">
              <LogViewer logs={logs} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
