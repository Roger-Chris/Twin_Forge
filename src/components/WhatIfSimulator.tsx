// src/components/WhatIfSimulator.tsx
import { useState } from 'react';
import { HelpCircle, Play, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface WhatIfPoint {
  minutes: number;
  temperature: number;
  vibration: number;
  rpm: number;
  bearingHealth: number;
  health: number;
  failureRisk: number;
  cooling: number;
  operatingState: string;
}

interface WhatIfResponse {
  timeline: WhatIfPoint[];
  explanation: string;
  outcome: 'stable' | 'degraded' | 'tripped';
}

export default function WhatIfSimulator() {
  const [load, setLoad] = useState<number>(64);
  const [voltage, setVoltage] = useState<number>(230);
  const [cooling, setCooling] = useState<number>(92);
  const [tempStress, setTempStress] = useState<number>(25);
  const [bearingHealth, setBearingHealth] = useState<number>(95);
  const [vibration, setVibration] = useState<number>(2.1);
  const [duration, setDuration] = useState<number>(30);

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<WhatIfResponse | null>(null);

  // Scenario presets
  const applyScenario = (num: number) => {
    switch (num) {
      case 1:
        // Cooling drops to 40% (which means 92 - 40 = 52%, let's set it to 52%)
        setCooling(52);
        setLoad(64);
        setVoltage(230);
        setTempStress(25);
        setBearingHealth(95);
        setVibration(2.1);
        break;
      case 2:
        // Load increases to 95%
        setLoad(95);
        setCooling(92);
        setVoltage(230);
        setTempStress(25);
        setBearingHealth(95);
        setVibration(2.1);
        break;
      case 3:
        // Voltage drops to 180V
        setVoltage(180);
        setLoad(64);
        setCooling(92);
        setTempStress(25);
        setBearingHealth(95);
        setVibration(2.1);
        break;
      case 4:
        // Bearing falls below 50% (set to 45%)
        setBearingHealth(45);
        setVibration(4.2); // bad bearings trigger vibration
        setLoad(64);
        setVoltage(230);
        setCooling(92);
        setTempStress(25);
        break;
      case 5:
        // Temp remains above 85°C (Ambient stress set to 50°C and load high)
        setTempStress(48);
        setLoad(85);
        setCooling(50);
        setVoltage(230);
        setBearingHealth(95);
        setVibration(2.1);
        break;
    }
    // Clear old results
    setResults(null);
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration,
          modifications: {
            loadSetting: load,
            voltageSetting: voltage,
            coolingSetting: cooling,
            tempStress,
            bearingHealth,
            vibration,
            // Slider presets describe operating conditions. They must not silently
            // add a second discrete fault on top of the selected numeric value.
            injectFault: null,
          }
        })
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Error running what-if projection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLoad(64);
    setVoltage(230);
    setCooling(92);
    setTempStress(25);
    setBearingHealth(95);
    setVibration(2.1);
    setDuration(30);
    setResults(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-y-auto pr-1">
      {/* Parameters Panel */}
      <div className="lg:col-span-5 bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <HelpCircle className="w-4 h-4 text-info-500" />
            <h3 className="text-xs font-mono font-bold tracking-widest text-industrial-300">WHAT-IF CONFIGURATION</h3>
          </div>
          <p className="text-[10px] font-mono text-industrial-400 mb-4">
            Simulate a hypothetical future scenario by overriding primary operating constraints.
          </p>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5 mb-4">
            <span className="text-[9px] font-mono text-industrial-400 font-bold uppercase tracking-wider block">DEMO PRESETS:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button 
                onClick={() => applyScenario(1)}
                className="px-2 py-1 text-left bg-industrial-950 border border-industrial-800 hover:border-industrial-700 rounded text-[10px] font-mono text-industrial-300 truncate"
              >
                1. Cooling drops by 40%
              </button>
              <button 
                onClick={() => applyScenario(2)}
                className="px-2 py-1 text-left bg-industrial-950 border border-industrial-800 hover:border-industrial-700 rounded text-[10px] font-mono text-industrial-300 truncate"
              >
                2. Load rises to 95%
              </button>
              <button 
                onClick={() => applyScenario(3)}
                className="px-2 py-1 text-left bg-industrial-950 border border-industrial-800 hover:border-industrial-700 rounded text-[10px] font-mono text-industrial-300 truncate"
              >
                3. Voltage drops to 180V
              </button>
              <button 
                onClick={() => applyScenario(4)}
                className="px-2 py-1 text-left bg-industrial-950 border border-industrial-800 hover:border-industrial-700 rounded text-[10px] font-mono text-industrial-300 truncate"
              >
                4. Bearing wear below 50%
              </button>
            </div>
            <button 
              onClick={() => applyScenario(5)}
              className="w-full px-2 py-1 text-left bg-industrial-950 border border-industrial-800 hover:border-industrial-700 rounded text-[10px] font-mono text-industrial-300"
            >
              5. Ambient Temp remains above 85°C
            </button>
          </div>

          <hr className="border-industrial-800 my-4" />

          {/* Sliders */}
          <div className="space-y-3 font-mono text-[10px]">
            <div>
              <div className="flex justify-between text-industrial-400 mb-1">
                <span>HYPOTHETICAL MOTOR LOAD:</span>
                <span className="text-white font-bold">{load}%</span>
              </div>
              <input 
                type="range" min="0" max="120" value={load} 
                onChange={(e) => setLoad(Number(e.target.value))}
                className="w-full accent-info-500 bg-industrial-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-industrial-400 mb-1">
                <span>HYPOTHETICAL SUPPLY VOLTAGE:</span>
                <span className="text-white font-bold">{voltage} V</span>
              </div>
              <input 
                type="range" min="150" max="260" value={voltage} 
                onChange={(e) => setVoltage(Number(e.target.value))}
                className="w-full accent-info-500 bg-industrial-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-industrial-400 mb-1">
                <span>HYPOTHETICAL COOLING EFFICIENCY:</span>
                <span className="text-white font-bold">{cooling}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={cooling} 
                onChange={(e) => setCooling(Number(e.target.value))}
                className="w-full accent-info-500 bg-industrial-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-industrial-400 mb-1">
                <span>HYPOTHETICAL AMBIENT STRESS:</span>
                <span className="text-white font-bold">{tempStress}°C</span>
              </div>
              <input 
                type="range" min="15" max="55" value={tempStress} 
                onChange={(e) => setTempStress(Number(e.target.value))}
                className="w-full accent-info-500 bg-industrial-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-industrial-400 mb-1">
                  <span>BEARING HEALTH:</span>
                  <span className="text-white font-bold">{bearingHealth}%</span>
                </div>
                <input 
                  type="range" min="10" max="100" value={bearingHealth} 
                  onChange={(e) => setBearingHealth(Number(e.target.value))}
                  className="w-full accent-info-500 bg-industrial-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-industrial-400 mb-1">
                  <span>BASE VIBRATION:</span>
                  <span className="text-white font-bold">{vibration} mm/s</span>
                </div>
                <input 
                  type="range" min="0.5" max="9.0" step="0.1" value={vibration} 
                  onChange={(e) => setVibration(Number(e.target.value))}
                  className="w-full accent-info-500 bg-industrial-950 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <hr className="border-industrial-800 my-4" />

            {/* Time Duration */}
            <div>
              <span className="text-[9px] font-mono text-industrial-400 font-bold uppercase tracking-wider block mb-1.5">SIMULATION TIMELINE DURATION:</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[5, 10, 20, 30, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => setDuration(m)}
                    className={`py-1 rounded text-center border text-[10px] font-mono font-bold transition-all ${
                      duration === m 
                        ? 'bg-info-500/10 text-info-500 border-info-500 shadow-industrial-glow' 
                        : 'bg-industrial-950 border-industrial-800 text-industrial-400 hover:text-industrial-200'
                    }`}
                  >
                    +{m}M
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleReset}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-industrial-950 border border-industrial-800 hover:border-industrial-700 text-industrial-300 font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            RESET
          </button>
          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="flex-[2] px-3 py-2 bg-info-600 hover:bg-info-500 text-white font-mono text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow-industrial-glow transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                COMPUTING...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                RUN PROJECTION
              </>
            )}
          </button>
        </div>
      </div>

      {/* Projection Results */}
      <div className="lg:col-span-7 bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex flex-col justify-between h-full">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Play className="w-4 h-4 text-success-500 rotate-90" />
            <h3 className="text-xs font-mono font-bold tracking-widest text-industrial-300">FAILURE PROJECTION REPORT</h3>
          </div>
          
          {!results ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 bg-industrial-950 rounded-full border border-industrial-850 flex items-center justify-center mb-3">
                <Play className="w-5 h-5 text-industrial-600" />
              </div>
              <p className="text-[11px] font-mono text-industrial-500 max-w-[280px]">
                Configure constraints and click **RUN PROJECTION** to compute the mathematical degradation forecast.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-4 pr-1">
              {/* Intelligence Summary */}
              <div className={`p-3 border rounded-lg font-mono text-[10px] flex items-start gap-2.5 ${
                results.timeline[results.timeline.length - 1].failureRisk >= 80
                  ? 'bg-danger-950/20 border-danger-500/50 text-danger-400'
                  : results.timeline[results.timeline.length - 1].failureRisk >= 40
                    ? 'bg-warning-950/20 border-warning-500/50 text-warning-400'
                    : 'bg-success-950/20 border-success-500/50 text-success-400'
              }`}>
                {results.timeline[results.timeline.length - 1].failureRisk >= 80 ? (
                  <AlertTriangle className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold mb-0.5 uppercase tracking-wider">
                    {results.outcome === 'tripped'
                      ? 'CRITICAL DAMAGE PROJECTIONS'
                      : results.outcome === 'degraded'
                        ? 'DEGRADED OPERATION FORECAST'
                        : 'STABLE OPERATION FORECAST'}
                  </div>
                  <p className="opacity-90">{results.explanation}</p>
                </div>
              </div>

              {/* Step Cards / Timeline */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-industrial-400 font-bold uppercase tracking-wider block">PROJECTIONS TIMELINE</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {results.timeline.map((point) => (
                    <div 
                      key={point.minutes} 
                      className="bg-industrial-950 border border-industrial-850 p-2.5 rounded font-mono text-[10px] flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-center border-b border-industrial-850 pb-1 mb-1.5">
                        <span className="font-bold text-info-500">
                          {point.minutes === 0 ? 'NOW' : `+${point.minutes} MIN`}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          point.failureRisk >= 80 
                            ? 'bg-danger-950 text-danger-500' 
                            : point.failureRisk >= 40 
                              ? 'bg-warning-950 text-warning-500' 
                              : 'bg-success-950 text-success-500'
                        }`}>
                          Risk: {point.failureRisk}%
                        </span>
                      </div>
                      
                      {point.operatingState === 'FAULTED' && (
                        <div className="text-[8px] bg-danger-950 text-danger-500 font-bold px-1.5 py-0.5 rounded text-center mb-1.5 animate-pulse">
                          ⚠️ POST-TRIP COOLDOWN
                        </div>
                      )}
                      
                      <div className="space-y-1 text-industrial-300">
                        <div className="flex justify-between">
                          <span>Temperature:</span>
                          <span className={point.temperature > 80 ? 'text-danger-400' : 'text-white'}>
                            {point.temperature}°C
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vibration:</span>
                          <span className={point.vibration > 3.0 ? 'text-warning-400' : 'text-white'}>
                            {point.vibration} mm/s
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>RPM:</span>
                          <span className="text-white">{point.rpm} RPM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bearing Health:</span>
                          <span className={point.bearingHealth < 60 ? 'text-danger-400' : 'text-white'}>
                            {point.bearingHealth}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Overall Health:</span>
                          <span className="text-white font-bold">{point.health}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Safety Disclaimer */}
        <div className="mt-4 border-t border-industrial-800 pt-3 flex items-start gap-2 bg-industrial-950/40 p-2.5 rounded font-mono text-[9px] text-industrial-400 leading-normal">
          <AlertTriangle className="w-3.5 h-3.5 text-warning-500 flex-shrink-0 mt-0.5" />
          <p>
            <strong className="text-warning-500">SIMULATION FORECAST NOTE:</strong> Projections are based on deterministic mathematical models of the Induction Motor. Actual machine runtime wear may vary based on environmental perturbations and local factors.
          </p>
        </div>
      </div>
    </div>
  );
}
