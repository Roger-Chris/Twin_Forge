// src/components/TelemetryCharts.tsx
import { useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

interface HistoryPoint {
  timestamp: string;
  simTime: number;
  temperature: number;
  vibration: number;
  rpm: number;
  voltage: number;
  current: number;
  load: number;
  health: number;
  failureRisk: number;
  synchronousRpm?: number;
  slipPercent?: number;
  phaseVoltages?: number[];
  phaseCurrents?: number[];
}

interface TelemetryChartsProps {
  history: HistoryPoint[];
}

export default function TelemetryCharts({ history }: TelemetryChartsProps) {
  const [timeWindow, setTimeWindow] = useState<number>(60); // default 1 minute (60s)

  // Filter and downsample data to keep rendering performant
  const getChartData = () => {
    let sliced = history.slice(-timeWindow);
    
    // Downsampling logic if there are too many points
    if (timeWindow === 300 && sliced.length > 100) {
      // 5 min (300 points) -> sample every 3rd point
      sliced = sliced.filter((_, idx) => idx % 3 === 0);
    } else if (timeWindow === 900 && sliced.length > 150) {
      // 15 min -> sample every 6th point
      sliced = sliced.filter((_, idx) => idx % 6 === 0);
    } else if (timeWindow === 1800 && sliced.length > 200) {
      // 30 min -> sample every 10th point
      sliced = sliced.filter((_, idx) => idx % 10 === 0);
    }

    return sliced.map(p => ({
      ...p,
      phaseA: p.phaseVoltages?.[0] ?? p.voltage,
      phaseB: p.phaseVoltages?.[1] ?? p.voltage,
      phaseC: p.phaseVoltages?.[2] ?? p.voltage,
      currentA: p.phaseCurrents?.[0] ?? p.current,
      currentB: p.phaseCurrents?.[1] ?? p.current,
      currentC: p.phaseCurrents?.[2] ?? p.current,
      timeString: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }));
  };

  const chartData = getChartData();

  // Custom tooltips for dark industrial layout
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-industrial-900 border border-industrial-700 p-2 rounded shadow-lg text-[11px] font-mono">
          <p className="text-industrial-400 font-bold mb-1">{payload[0].payload.timeString}</p>
          {payload.map((p: any, idx: number) => (
            <p key={idx} style={{ color: p.color }}>
              {p.name}: {p.value.toFixed(1)} {p.unit}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex flex-col h-full">
      {/* Header controls */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-mono font-bold tracking-widest text-industrial-300">HISTORICAL TELEMETRY TRENDS</h3>
        <div className="flex gap-1 bg-industrial-950 p-0.5 rounded border border-industrial-800">
          {[
            { label: '1m', value: 60 },
            { label: '5m', value: 300 },
            { label: '15m', value: 900 },
            { label: '30m', value: 1800 }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeWindow(opt.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                timeWindow === opt.value
                  ? 'bg-industrial-700 text-white font-bold'
                  : 'text-industrial-400 hover:text-industrial-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs font-mono text-industrial-500">
          Waiting for telemetry connection...
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
          {/* Chart 1: Temperature */}
          <div className="bg-industrial-950 border border-industrial-800/60 p-2 rounded flex flex-col">
            <div className="text-[10px] font-mono text-industrial-400 mb-1 flex justify-between">
              <span>THERMAL GRADIENT</span>
              <span className="text-danger-500 font-bold">{chartData[chartData.length - 1]?.temperature}°C</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={180} minWidth={0}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1d24" />
                  <XAxis dataKey="timeString" tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <YAxis domain={[20, 110]} tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="temperature" 
                    name="Temperature" 
                    unit="°C" 
                    stroke="#ef4444" 
                    strokeWidth={1.5} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Vibration */}
          <div className="bg-industrial-950 border border-industrial-800/60 p-2 rounded flex flex-col">
            <div className="text-[10px] font-mono text-industrial-400 mb-1 flex justify-between">
              <span>MECHANICAL VIBRATION</span>
              <span className="text-warning-500 font-bold">{chartData[chartData.length - 1]?.vibration} mm/s</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={180} minWidth={0}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1d24" />
                  <XAxis dataKey="timeString" tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="vibration" 
                    name="Vibration" 
                    unit=" mm/s" 
                    stroke="#f59e0b" 
                    strokeWidth={1.5} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: RPM & Load */}
          <div className="bg-industrial-950 border border-industrial-800/60 p-2 rounded flex flex-col">
            <div className="text-[10px] font-mono text-industrial-400 mb-1 flex justify-between">
              <span>RPM & LOAD SHIFT</span>
              <span className="text-info-500 font-bold">{chartData[chartData.length - 1]?.rpm} RPM ({chartData[chartData.length - 1]?.load}%)</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={180} minWidth={0}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1d24" />
                  <XAxis dataKey="timeString" tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <YAxis yAxisId="rpm" domain={[0, 1800]} tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <YAxis yAxisId="load" orientation="right" domain={[0, 130]} tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    yAxisId="rpm"
                    type="monotone" 
                    dataKey="rpm" 
                    name="RPM" 
                    unit=" RPM" 
                    stroke="#3b82f6" 
                    strokeWidth={1.5} 
                    dot={false} 
                  />
                  <Line
                    yAxisId="rpm"
                    type="monotone"
                    dataKey="synchronousRpm"
                    name="Synchronous speed"
                    unit=" RPM"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line 
                    yAxisId="load"
                    type="monotone" 
                    dataKey="load" 
                    name="Load" 
                    unit="%" 
                    stroke="#10b981" 
                    strokeWidth={1.2} 
                    strokeDasharray="4 4"
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Electrical Voltage & Current */}
          <div className="bg-industrial-950 border border-industrial-800/60 p-2 rounded flex flex-col">
            <div className="text-[10px] font-mono text-industrial-400 mb-1 flex justify-between">
              <span>ELECTRICAL PATHWAY</span>
              <span className="text-success-500 font-bold">{chartData[chartData.length - 1]?.voltage}V / {chartData[chartData.length - 1]?.current}A</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={180} minWidth={0}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1d24" />
                  <XAxis dataKey="timeString" tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <YAxis yAxisId="voltage" domain={[140, 285]} tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <YAxis yAxisId="current" orientation="right" domain={[0, 15]} tick={{ fill: '#4e5b70', fontSize: 8 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="voltage" type="monotone" dataKey="phaseA" name="Voltage A" unit="V" stroke="#ef4444" dot={false} />
                  <Line yAxisId="voltage" type="monotone" dataKey="phaseB" name="Voltage B" unit="V" stroke="#f59e0b" dot={false} />
                  <Line yAxisId="voltage" type="monotone" dataKey="phaseC" name="Voltage C" unit="V" stroke="#3b82f6" dot={false} />
                  <Line yAxisId="current" type="monotone" dataKey="currentA" name="Current A" unit="A" stroke="#fca5a5" strokeDasharray="3 2" dot={false} />
                  <Line yAxisId="current" type="monotone" dataKey="currentB" name="Current B" unit="A" stroke="#fde68a" strokeDasharray="3 2" dot={false} />
                  <Line yAxisId="current" type="monotone" dataKey="currentC" name="Current C" unit="A" stroke="#93c5fd" strokeDasharray="3 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
