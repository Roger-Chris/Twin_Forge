// src/components/FaultCascade.tsx
import { ShieldAlert, ArrowDown, Activity, Thermometer, Disc, Zap, AlertTriangle } from 'lucide-react';

interface Fault {
  id: string;
  name: string;
  severity: string;
  description: string;
  timestamp: string;
}

interface FaultCascadeProps {
  activeFaults: Fault[];
  cooling: number;
  temperature: number;
  bearingHealth: number;
  vibration: number;
  voltage: number;
  current: number;
  failureRisk: number;
  operatingState: string;
}

export default function FaultCascade({
  activeFaults,
  cooling,
  temperature,
  bearingHealth,
  vibration,
  voltage,
  current,
  failureRisk,
  operatingState
}: FaultCascadeProps) {
  // Determine which propagation chain to display
  const isCoolingFailure = activeFaults.some(f => f.id === 'cooling_failure');
  const isBearingWear = activeFaults.some(f => f.id === 'bearing_degradation' || f.id === 'shaft_imbalance' || f.id === 'excessive_vibration');
  const isVoltageDrop = activeFaults.some(f => f.id === 'voltage_drop' || f.id === 'power_instability');
  
  const hasActiveFault = activeFaults.length > 0 || operatingState === 'FAULTED';

  // Helper to get alert styles
  const getNodeState = (isActive: boolean, isCritical: boolean) => {
    if (!isActive) return 'border-industrial-800 bg-industrial-950/40 text-industrial-500';
    if (isCritical) return 'border-danger-500 bg-danger-950/20 text-danger-500 shadow-danger-glow animate-pulse';
    return 'border-warning-500 bg-warning-950/20 text-warning-500 shadow-warning-glow animate-pulse';
  };

  const getArrowState = (isActive: boolean) => {
    return isActive ? 'text-warning-500 stroke-dash' : 'text-industrial-700';
  };

  return (
    <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-mono font-bold tracking-widest text-industrial-300">CASCADING FAULT PROPAGATION</h3>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-industrial-400">
          <span className={`w-2 h-2 rounded-full ${hasActiveFault ? 'bg-warning-500 animate-ping' : 'bg-industrial-600'}`}></span>
          <span>{hasActiveFault ? 'PROPAGATION ACTIVE' : 'MONITORING STANDBY'}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between py-2 min-h-0 overflow-y-auto">
        {/* If no active faults, show general diagram */}
        {(!hasActiveFault && !isCoolingFailure && !isBearingWear && !isVoltageDrop) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <ShieldAlert className="w-8 h-8 text-industrial-600 mb-2" />
            <p className="text-[11px] font-mono text-industrial-400 max-w-[240px]">
              No active fault vectors. Injected faults in the **Fault Lab** will reveal their cascading propagation path here in real-time.
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-2">
            
            {/* CHAIN 1: COOLING FAILURE CASCADE */}
            {(isCoolingFailure || operatingState === 'FAULTED') && (
              <div className="flex flex-col items-center">
                {/* Node 1: Fan Failure */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(true, cooling < 40)}`}>
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">COOLING EFFICIENCY DROPPED</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Value: {cooling}%</span>
                      <span>Target: 20%</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(cooling < 80)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 2: Heat Build Up */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(cooling < 80, temperature > 80)}`}>
                  <Thermometer className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">THERMAL STRESS CASCADE</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Winding Temp: {temperature}°C</span>
                      <span>Diff: +{Math.round(temperature - 64.2)}°C</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(temperature > 72)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 3: Bearing degradation */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(temperature > 72, bearingHealth < 70)}`}>
                  <Disc className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">LUBRICATION FAILURE & WEAR</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Bearing Health: {bearingHealth}%</span>
                      <span>Friction: {bearingHealth < 85 ? 'HIGH' : 'NORMAL'}</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(bearingHealth < 85)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 4: Vibration */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(bearingHealth < 85, vibration > 4.5)}`}>
                  <Activity className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">MECHANICAL VIBRATION INDUCTION</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Vibration: {vibration} mm/s</span>
                      <span>Thresh: 3.0 mm/s</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(vibration > 3.0)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 5: Trip */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(vibration > 3.0, failureRisk > 80)}`}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-ping" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">{operatingState === 'FAULTED' ? 'SYSTEM TRIPPED' : 'CRITICAL TRIP RISK'}</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Risk Probability: {failureRisk}%</span>
                      <span>State: {operatingState}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAIN 2: MECHANICAL VIBRATION / BEARING DEGRADATION */}
            {isBearingWear && !isCoolingFailure && (
              <div className="flex flex-col items-center">
                {/* Node 1: Bearing Wear */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(true, bearingHealth < 60)}`}>
                  <Disc className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">BEARING DEGRADATION INJECTED</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Bearing Health: {bearingHealth}%</span>
                      <span>Lubrication: {bearingHealth < 80 ? 'CRITICAL' : 'OK'}</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(bearingHealth < 90)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 2: Vibration Spikes */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(bearingHealth < 90, vibration > 4.5)}`}>
                  <Activity className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">EXCESSIVE VIBRATION INDUCTION</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Vibration: {vibration} mm/s</span>
                      <span>Slip: High</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(vibration > 3.0)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 3: Friction Heating */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(vibration > 3.0, temperature > 80)}`}>
                  <Thermometer className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">FRICTIONAL THERMAL OVERLOAD</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Temperature: {temperature}°C</span>
                      <span>Losses: High</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(temperature > 72)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 4: Trip */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(temperature > 72, failureRisk > 80)}`}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">PREDICTIVE INTERRUPT</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Failure Risk: {failureRisk}%</span>
                      <span>Protection: Armed</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CHAIN 3: ELECTRICAL VOLTAGE DROP / CURRENT CASCADE */}
            {isVoltageDrop && !isCoolingFailure && !isBearingWear && (
              <div className="flex flex-col items-center">
                {/* Node 1: Voltage Drop */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(true, voltage < 195)}`}>
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">VOLTAGE INSTABILITY INJECTED</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Voltage: {voltage} V</span>
                      <span>Target: 180 V</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(voltage < 220)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 2: Current spike */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(voltage < 220, current > 6.0)}`}>
                  <Activity className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">COMPENSATORY CURRENT OVERLOAD</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Current: {current} A</span>
                      <span>Losses: I²R Copper Heat</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(current > 5.5)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 3: Winding thermal */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(current > 5.5, temperature > 80)}`}>
                  <Thermometer className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">ELECTRICAL THERMAL WINDING OVERLOAD</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Temperature: {temperature}°C</span>
                      <span>Efficiency: {92 - Math.round(temperature / 5)}%</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className={`my-1 text-center ${getArrowState(temperature > 75)}`}>
                  <ArrowDown className="w-4 h-4 mx-auto animate-bounce" />
                </div>

                {/* Node 4: Trip */}
                <div className={`w-full max-w-[280px] p-2 border rounded flex items-center gap-2.5 transition-all ${getNodeState(temperature > 75, failureRisk > 80)}`}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-mono text-[10px]">
                    <div className="font-bold">ELECTRICAL FAULT SHIELD</div>
                    <div className="flex justify-between text-[9px] opacity-80 mt-0.5">
                      <span>Failure Risk: {failureRisk}%</span>
                      <span>Protection: Auto-trip Enabled</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
