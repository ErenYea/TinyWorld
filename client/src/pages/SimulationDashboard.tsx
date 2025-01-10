import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { AgentDeployment } from "../components/AgentDeployment";
import { WorldContextConfig } from "../components/WorldContextConfig";
import { AgentManagement } from "../components/AgentManagement";
import { ControlPanel } from "../components/ControlPanel";
import { LogViewer } from "../components/LogViewer";
import { NodeGraph } from "../components/NodeGraph";
import { MatrixAnimation } from "../components/MatrixAnimation";
import { MetricsPanel } from "../components/MetricsPanel";
import { useSimulation } from "../hooks/useSimulation";
import { useUser } from "@/context/UserContext";
import { useLocation } from "wouter";
import { usePrivy } from "@privy-io/react-auth";

export default function SimulationDashboard() {
  const [, setLocation] = useLocation();
  const {
    agents,
    simulationStatus,
    logs,
    metrics,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    deployAgent,
    wsStatus,
    updateWorldContext,
    exportAgentData,
    terminateAgent
  } = useSimulation();
  const { user, login, getAccessToken } = usePrivy();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const loginUser = async () => {
    // const token = await getAccessToken();
    if (!user) {
      login();
    }
    // setAccessToken(token);
  }
  const getAccessTokens = async () => {
    const token = await getAccessToken();
    if (token) {
      setAccessToken(token);
    }
  }
  useEffect(() => {
    loginUser();
    getAccessTokens();
    // console.log(user);
    // const storedUser = localStorage.getItem('user');
    // if (!storedUser) {
    //   setLocation("/login");
    // }
  }, [user]);


  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-[1800px] mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-purple-400">
          AI Mission Control
        </h1>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Wider */}
          <div className="col-span-5 space-y-6">
            <Card className="p-6 bg-gray-900/50 border-purple-500/30">
              <WorldContextConfig onUpdate={updateWorldContext} />
            </Card>

            <Card className="p-6 bg-gray-900/50 border-purple-500/30">
              <AgentDeployment onDeploy={deployAgent} />
            </Card>

            <Card className="p-6 bg-gray-900/50 border-purple-500/30">
              <AgentManagement
                agents={agents || []}
                onExportData={exportAgentData}
                onTerminateAgent={terminateAgent}
              />
            </Card>
          </div>

          {/* Center Column - Main visualization */}
          <div className="col-span-7">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card className="p-6 bg-gray-900/50 border-purple-500/30">
                  <ControlPanel
                    status={simulationStatus}
                    wsStatus={wsStatus}
                    onStart={startSimulation}
                    onPause={pauseSimulation}
                    onReset={resetSimulation}
                  />
                </Card>
                <Card className="p-6 bg-gray-900/50 border-purple-500/30">
                  <MetricsPanel metrics={metrics} />
                </Card>
              </div>

              <Card className="p-6 h-[600px] bg-gray-900/50 border-purple-500/30 relative overflow-hidden">
                <NodeGraph agents={agents} />
                {simulationStatus === 'running' && (
                  <MatrixAnimation className="absolute inset-0 opacity-20 pointer-events-none" />
                )}
              </Card>
            </div>
          </div>

          {/* Bottom Section - Full Width Logs */}
          <div className="col-span-12">
            <Card className="p-6 h-[400px] bg-gray-900/50 border-purple-500/30">
              <LogViewer logs={logs} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
