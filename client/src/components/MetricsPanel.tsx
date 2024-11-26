import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface MetricsPanelProps {
  metrics: {
    totalInteractions: number;
    activeAgents: number;
    goalCompletionRate: number;
    averageProcessingTime: number;
  };
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  // Create time-series data for the charts
  interface TimeSeriesDataPoint {
    time: string;
    interactions: number;
    agents: number;
    processingTime: number;
    completion: number;
  }

  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  
  useEffect(() => {
    setTimeSeriesData(prev => {
      const newData = [...prev, {
        time: new Date().toLocaleTimeString(),
        interactions: metrics.totalInteractions,
        agents: metrics.activeAgents,
        processingTime: metrics.averageProcessingTime,
        completion: metrics.goalCompletionRate * 100
      }].slice(-20); // Keep last 20 data points
      return newData;
    });
  }, [metrics]);

  return (
    <Card className="p-6 bg-gray-900/50 border-purple-500/30">
      <h2 className="text-2xl font-semibold mb-6 text-purple-400">Performance Metrics</h2>
      
      <div className="space-y-8">
        {/* Active Agents Chart */}
        <div>
          <h3 className="text-base font-medium mb-4">Active Agents</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="agentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(17, 17, 17, 0.9)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '4px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="agents" 
                  stroke="#a855f7" 
                  fill="url(#agentGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Interactions Chart */}
        <div>
          <h3 className="text-sm font-medium mb-2">Total Interactions</h3>
          <div className="h-[100px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(17, 17, 17, 0.9)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '4px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="interactions" 
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: '#a855f7' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Indicators */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-800/50 p-4 rounded-lg border border-purple-500/30">
            <div className="text-sm text-gray-400">Processing Time</div>
            <div className="text-xl font-semibold text-purple-400">
              {metrics.averageProcessingTime.toFixed(2)}ms
            </div>
          </div>
          <div className="bg-gray-800/50 p-3 rounded-lg border border-purple-500/30">
            <div className="text-sm text-gray-400">Goal Completion</div>
            <div className="text-xl font-semibold text-purple-400">
              {(metrics.goalCompletionRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
