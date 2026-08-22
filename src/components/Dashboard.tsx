// src/components/Dashboard.tsx
import { useEffect, useState, useRef } from 'react';
import { 
  Settings, Play, Pause, RefreshCw, AlertTriangle, ShieldCheck, 
  ListFilter, Cpu, Hammer, Clock, Laptop, Eye, Volume2, VolumeX
} from 'lucide-react';
import MotorCanvas from './MotorCanvas.tsx';
import TelemetryCharts from './TelemetryCharts.tsx';
import FaultCascade from './FaultCascade.tsx';
import WhatIfSimulator from './WhatIfSimulator.tsx';

interface Fault {
  id: string;
  name: string;
  severity: string;
  description: string;
  timestamp: string;
}

interface MachineState {
  operatingState: string;
  health: number;
  overallHealth: number;
  statorHealth: number;
  coolingHealth: number;
  temperature: number;
  vibration: number;
  rpm: number;
  voltage: number;
  current: number;
  load: number;
  bearingHealth: number;
  cooling: number;
  lubricationHealth: number;
  efficiency: number;
  failureRisk: number;
  simulationTime: number;
  syncPercentage: number;
  activeFaults: Fault[];
  loadSetting: number;
  voltageSetting: number;
  coolingSetting: number;
  tempStress: number;
  simulationSpeed: number;
  operationalReadiness: number;
  protectionStatus: string;
  synchronousRpm: number;
  slipPercent: number;
  motorTorque: number;
  loadTorque: number;
  phaseVoltages: number[];
  phaseCurrents: number[];
  voltageUnbalance: number;
  currentUnbalance: number;
  maintenanceCase: any | null;
  predictedTripSeconds?: number;
  forecastOutcome?: 'stable' | 'degraded' | 'tripped';
  predictionHorizonSeconds?: number;
}

interface EventLogItem {
  timestamp: string;
  type: string;
  message: string;
  severity: string;
}

export default function Dashboard() {
  const [state, setState] = useState<MachineState | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [eventLog, setEventLog] = useState<EventLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'control' | 'whatif' | 'presentation'>('control');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [resolvingFault, setResolvingFault] = useState<string | null>(null);
  const [repairReport, setRepairReport] = useState<any | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const motorAudioRef = useRef<{
    context: AudioContext;
    master: GainNode;
    electricalHum: OscillatorNode;
    mechanicalHum: OscillatorNode;
  } | null>(null);

  const toggleMotorSound = async () => {
    if (soundEnabled) {
      const audio = motorAudioRef.current;
      if (audio) {
        audio.master.gain.cancelScheduledValues(audio.context.currentTime);
        audio.master.gain.setTargetAtTime(0.0001, audio.context.currentTime, 0.04);
      }
      setSoundEnabled(false);
      return;
    }

    let audio = motorAudioRef.current;
    if (!audio) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const context: AudioContext = new AudioContextClass();
      const master = context.createGain();
      const electricalHum = context.createOscillator();
      const mechanicalHum = context.createOscillator();
      const electricalGain = context.createGain();
      const mechanicalGain = context.createGain();

      electricalHum.type = 'sine';
      mechanicalHum.type = 'triangle';
      electricalGain.gain.value = 0.72;
      mechanicalGain.gain.value = 0.28;
      master.gain.value = 0.0001;

      electricalHum.connect(electricalGain).connect(master);
      mechanicalHum.connect(mechanicalGain).connect(master);
      master.connect(context.destination);
      electricalHum.start();
      mechanicalHum.start();
      audio = { context, master, electricalHum, mechanicalHum };
      motorAudioRef.current = audio;
    }

    await audio.context.resume();
    setSoundEnabled(true);
  };

  useEffect(() => {
    const audio = motorAudioRef.current;
    if (!audio || !state) return;
    const now = audio.context.currentTime;
    const rotorHz = Math.max(8, state.rpm / 60);
    const runningOrCoasting = state.rpm > 5;
    const vibrationLevel = Math.max(0, Math.min(1, state.vibration / 7));
    const targetVolume = soundEnabled && runningOrCoasting
      ? Math.min(0.055, 0.009 + vibrationLevel * 0.04)
      : 0.0001;

    // Induction motors produce a strong twice-line-frequency magnetic hum (100 Hz
    // at 50 Hz supply) plus a lower mechanical tone tied to shaft rotation.
    audio.electricalHum.frequency.setTargetAtTime(100, now, 0.08);
    audio.mechanicalHum.frequency.setTargetAtTime(rotorHz * 2, now, 0.08);
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(targetVolume, now, 0.08);
  }, [soundEnabled, state?.rpm, state?.vibration, state?.operatingState]);

  useEffect(() => () => {
    const audio = motorAudioRef.current;
    if (audio) void audio.context.close();
  }, []);

  // Initialize and WebSocket Connection
  useEffect(() => {
    fetchInitialState();
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchInitialState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setState(data.state);
      setEventLog(data.eventLog || []);
      
      const histRes = await fetch('/api/history');
      const histData = await histRes.json();
      setHistory(histData.history || []);
    } catch (err) {
      console.error('Error fetching initial dashboard state:', err);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use current host or default to localhost:3001 in development if running on vite's port 3000
    const host = window.location.port === '3000' ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`Connecting to WebSocket at ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connection established.');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'TELEMETRY_UPDATE') {
        setState(msg.state);
        // Append history point, maintaining a maximum size
        setHistory((prev) => {
          const next = [...prev, msg.historyPoint];
          if (next.length > 1800) next.shift();
          return next;
        });
      } else if (msg.type === 'STATE_CHANGED') {
        setState(msg.state);
      } else if (msg.type === 'EVENT_LOGGED') {
        setEventLog((prev) => [msg.event, ...prev].slice(0, 100));
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting in 3s...');
      setWsConnected(false);
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  };

  // Helper command triggers
  const triggerCommand = async (command: string, value?: any) => {
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, value }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      if (command === 'RESET') {
        setRepairReport(null);
        setResolvingFault(null);
      }
    } catch (err) {
      console.error(`Error triggering control command ${command}:`, err);
    }
  };

  const injectFault = async (fault: Omit<Fault, 'timestamp'>) => {
    try {
      const res = await fetch('/api/faults/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fault),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
    } catch (err) {
      console.error('Error injecting fault:', err);
    }
  };

  const clearFault = async (id?: string) => {
    try {
      const res = await fetch('/api/faults/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
    } catch (err) {
      console.error('Error clearing fault:', err);
    }
  };

  const resolveFault = async (id?: string, action = 'diagnose') => {
    setResolvingFault(action);
    try {
      const res = await fetch('/api/maintenance/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Maintenance action failed');
      setState(data.state);
      setRepairReport(data.report);
    } catch (err) {
      console.error('Error resolving fault:', err);
    } finally {
      setResolvingFault(null);
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-industrial-950 text-industrial-300 font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-info-500 border-t-transparent rounded-full animate-spin"></div>
          <div>ESTABLISHING INDUSTRIAL GATEWAY LINK...</div>
        </div>
      </div>
    );
  }

  // Format Elapsed Time (seconds to HH:MM:SS)
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // ----------------------------------------------------
  // PREDICTIVE INTELLIGENCE LOGIC (Calculated from current telemetry)
  // ----------------------------------------------------
  const calculateIntelligence = () => {
    const risk = state.failureRisk;
    let riskLabel = 'LOW';
    let riskColor = 'text-success-500';
    let predictedFailure = 'NONE DETECTED';
    let failWindow = 'STABLE';
    let confidence = 99;
    let recommendations: string[] = ['Continue normal operational cycles. Monitoring wear parameters.'];
    let explanation = 'All monitored parameters are well within engineering limits. Voltage supply is stable and bearing health is within nominal limits.';

    if (risk >= 80) {
      riskLabel = 'CRITICAL';
      riskColor = 'text-danger-500';
      confidence = 94;
      failWindow = '1–5 simulated minutes';
      
      if (state.activeFaults.some(f => f.id === 'cooling_failure')) {
        predictedFailure = 'THERMAL OVERLOAD & BEARING SEIZURE';
        recommendations = [
          'IMMEDIATE ACTION REQUIRED: Clear thermal cooling blockages.',
          'Inject emergency lubricant to bearings.',
          'Derate motor load to <20% or shut down to prevent stator winding melt.'
        ];
        explanation = `Cooling efficiency is critical at ${state.cooling}%. Heat buildup has dried bearing lubrication. Accelerated bearing wear has triggered vibration spikes (${state.vibration} mm/s). Immediate catastrophic stator/rotor insulation failure is projected.`;
      } else if (state.activeFaults.some(f => f.id === 'bearing_degradation')) {
        predictedFailure = 'MECHANICAL BEARING COUPLING FRACTURE';
        recommendations = [
          'Schedule immediate motor shutdown.',
          'Replace drive-end bearings and inspect rotor shaft alignment.',
          'Limit shaft rotation speeds.'
        ];
        explanation = `Bearing health is depleted at ${state.bearingHealth}%. High friction induces severe mechanical vibration (${state.vibration} mm/s) and heat. Total mechanical lockup and shaft shear are projected.`;
      } else if (state.activeFaults.some(f => f.id === 'voltage_drop')) {
        predictedFailure = 'ELECTRICAL WINDING STATOR OVERLOAD';
        recommendations = [
          'Inspect supply transformer and check contacts.',
          'Adjust load parameters to avoid compensatory overcurrent.',
          'Check voltage regulation switchgear.'
        ];
        explanation = `Severe voltage drop (${state.voltage}V) forces current draw to spike (${state.current}A) to sustain torque. Excessive resistive winding heating is degrading coil insulation rapidly. Winding failure is imminent.`;
      } else {
        predictedFailure = 'SAFETY SYSTEM EMERGENCY TRIP';
        recommendations = ['Perform manual inspection of mechanical couplers.', 'Reduce load setting.'];
        explanation = `Multiple combined threshold limits exceeded. safety system trip is projected to engage to avoid motor fire.`;
      }
    } else if (risk >= 45) {
      riskLabel = 'HIGH';
      riskColor = 'text-warning-500';
      confidence = 88;
      failWindow = '15–30 simulated minutes';
      
      if (state.cooling < 50) {
        predictedFailure = 'GRADUAL THERMAL DAMAGE';
        recommendations = [
          'Check cooling fan intake for obstructions.',
          'Reduce motor load parameters to mitigate thermal slope.',
          'Monitor bearing temperatures.'
        ];
        explanation = `Cooling capacity has degraded to ${state.cooling}%. Winding temperature is trending upward to ${state.temperature}°C, which will accelerate bearing degradation if sustained.`;
      } else if (state.bearingHealth < 60) {
        predictedFailure = 'BEARING DEGRADATION & ACCELERATED WEAR';
        recommendations = [
          'Add bearing grease at next scheduled break.',
          'Verify shaft vibration limits.',
          'Inspect drive shaft couplings.'
        ];
        explanation = `Bearing wear is elevated (${state.bearingHealth}%). Mechanical vibration has risen to ${state.vibration} mm/s, causing minor friction heating. Maintenance is recommended.`;
      } else {
        predictedFailure = 'THERMAL OVERLOAD RISK';
        recommendations = ['Reduce motor load.', 'Ensure adequate ventilation ambient air.'];
        explanation = `Elevated temperature of ${state.temperature}°C from excessive load or ambient stress. Operating margins are reduced.`;
      }
    } else if (risk >= 15) {
      riskLabel = 'MEDIUM';
      riskColor = 'text-warning-500';
      confidence = 79;
      failWindow = '60–120 simulated minutes';
      predictedFailure = 'MINOR THERMAL / BEARING STRESS';
      recommendations = [
        'Perform check on cooling systems.',
        'Validate load telemetry matches production limits.'
      ];
      explanation = `Slight upward trend in temperature (${state.temperature}°C) or vibration (${state.vibration} mm/s). Minor stress detected but motor is stable.`;
    }

    // Replace broad risk buckets with the actual deterministic fast-forward result.
    if (state.operatingState === 'FAULTED' || state.predictedTripSeconds === 0) {
      failWindow = 'TRIPPED — maintenance required';
    } else if (typeof state.predictedTripSeconds === 'number' && state.predictedTripSeconds > 0) {
      const mins = Math.floor(state.predictedTripSeconds / 60);
      const secs = state.predictedTripSeconds % 60;
      failWindow = `${mins}m ${secs.toString().padStart(2, '0')}s simulated`;
    } else if (state.forecastOutcome === 'degraded') {
      failWindow = 'No trip within 60 min — degraded';
    } else if (state.forecastOutcome === 'stable') {
      failWindow = 'No trip within 60 simulated minutes';
    }

    return { riskLabel, riskColor, predictedFailure, failWindow, confidence, recommendations, explanation };
  };

  const intel = calculateIntelligence();

  // ----------------------------------------------------
  // MAINTENANCE CENTER LOGIC
  // ----------------------------------------------------
  const getMaintenanceRecord = () => {
    if (state.operatingState === 'FAULTED') {
      return {
        issue: 'Critical System Trip (Safety Shutoff)',
        risk: 'CATASTROPHIC',
        priority: 'CRITICAL',
        action: 'System has auto-tripped. Perform complete motor reset and clear all injected faults in the Fault Lab.',
        status: 'EMERGENCY ACTION REQUIRED',
        color: 'text-danger-500 border-danger-500/30 bg-danger-950/10'
      };
    }
    if (state.failureRisk >= 80) {
      return {
        issue: state.activeFaults[0]?.name || 'Critical Telemetry Threshold Breach',
        risk: '90%+ Fail Probability',
        priority: 'IMMEDIATE',
        action: 'Inspect bearing lubrication, check cooling fan, and lower load setting immediately.',
        status: 'SHUTDOWN RECOMMENDED',
        color: 'text-danger-500 border-danger-500/30 bg-danger-950/10'
      };
    }
    if (state.failureRisk >= 45) {
      return {
        issue: 'Telemetry Trend Warning',
        risk: 'Moderate Risk',
        priority: 'HIGH',
        action: 'Schedule inspection. Clean cooling grill and apply shaft lubricant.',
        status: 'RECOMMENDED',
        color: 'text-warning-500 border-warning-500/30 bg-warning-950/10'
      };
    }
    return {
      issue: 'None Detected',
      risk: 'Nominal Operations',
      priority: 'LOW',
      action: 'No actions required. System operating within design margins.',
      status: 'MONITORING',
      color: 'text-success-500 border-success-500/30 bg-success-950/10'
    };
  };

  const maintenance = getMaintenanceRecord();

  // Circular gauge calculations
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (state.health / 100) * circumference;

  return (
    <div className="min-h-screen flex flex-col bg-industrial-950 text-industrial-100 font-sans grid-bg selection:bg-info-500/20 selection:text-white">
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="border-b border-industrial-800 bg-industrial-900/60 backdrop-blur sticky top-0 z-40 px-4 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Settings className={`w-6 h-6 text-info-500 ${state.operatingState === 'RUNNING' ? 'animate-spin-slow' : ''}`} />
            <div className="absolute inset-0 bg-info-500/10 rounded-full blur"></div>
          </div>
          <div>
            <h1 className="text-sm font-mono font-black tracking-widest text-white">TWINFORGE</h1>
            <p className="text-[10px] font-mono text-industrial-400">INDUSTRIAL DIGITAL TWIN & SIMULATION PLATFORM</p>
          </div>
        </div>

        {/* Global state ribbons */}
        <div className="flex flex-wrap justify-center items-center gap-2">
          {/* Simulation Link Status */}
          <div className="flex items-center gap-1.5 bg-industrial-950 px-2 py-1 rounded border border-industrial-800 text-[10px] font-mono">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-success-500 animate-pulse shadow-success-glow' : 'bg-danger-500'}`}></span>
            <span className="text-industrial-450">LINK:</span>
            <span className="font-bold text-industrial-200">{wsConnected ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>

          {/* Machine ID Tag */}
          <div className="bg-industrial-950 px-2 py-1 rounded border border-industrial-800 text-[10px] font-mono">
            <span className="text-industrial-450">MACHINE:</span>{' '}
            <span className="font-bold text-white">MTR-001</span>
          </div>

          {/* Running State */}
          <div className={`px-2 py-1 rounded border text-[10px] font-mono font-bold ${
            state.operatingState === 'RUNNING'
              ? 'bg-success-950/20 border-success-500/30 text-success-500 shadow-success-glow'
              : state.operatingState === 'FAULTED'
                ? 'bg-danger-950/20 border-danger-500/30 text-danger-500 shadow-danger-glow'
                : 'bg-industrial-950 border-industrial-800 text-industrial-400'
          }`}>
            {state.operatingState === 'RUNNING' && '🟢 SIMULATION RUNNING'}
            {state.operatingState === 'STOPPED' && '🟡 SIMULATION PAUSED'}
            {state.operatingState === 'FAULTED' && '🔴 HARDWARE TRIP FAULT'}
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-industrial-950 p-0.5 rounded border border-industrial-800 ml-2">
            <button
              onClick={() => setShowDetails(value => !value)}
              className="px-3 py-1 rounded text-[10px] font-mono font-bold text-info-500 hover:bg-industrial-800 transition-all"
            >
              {showDetails ? 'ESSENTIAL VIEW' : 'SHOW DETAILS'}
            </button>
            <button
              onClick={toggleMotorSound}
              aria-label={soundEnabled ? 'Disable motor sound' : 'Enable motor sound'}
              aria-pressed={soundEnabled}
              title="Motor hum follows live RPM and vibration"
              className={`px-3 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                soundEnabled
                  ? 'bg-info-500/20 text-info-500 shadow-info-glow'
                  : 'text-industrial-400 hover:text-industrial-200 hover:bg-industrial-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {soundEnabled ? 'HUM ON' : 'HUM OFF'}
            </button>
            <button
              onClick={() => setActiveTab('control')}
              className={`px-3 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                activeTab === 'control' 
                  ? 'bg-industrial-800 text-white shadow' 
                  : 'text-industrial-400 hover:text-industrial-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              CONTROL ROOM
            </button>
            <button
              onClick={() => setActiveTab('whatif')}
              className={`px-3 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                activeTab === 'whatif' 
                  ? 'bg-industrial-800 text-white shadow' 
                  : 'text-industrial-400 hover:text-industrial-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              WHAT-IF LAB
            </button>
            <button
              onClick={() => setActiveTab('presentation')}
              className={`px-3 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                activeTab === 'presentation' 
                  ? 'bg-industrial-800 text-white shadow' 
                  : 'text-industrial-400 hover:text-industrial-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              PRESENTATION MODE
            </button>
          </div>
        </div>
      </header>

      {/* 2. BODY CONTENT */}
      <main className="flex-1 p-4 overflow-hidden min-h-0">
        
        {/* TAB 1: TWIN CONTROL ROOM (MAIN DASHBOARD) */}
        {activeTab === 'control' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 h-full overflow-y-auto pr-1">
            
            {/* LEFT COLUMN: enlarged 3D view and primary machine state */}
            <div className="xl:col-span-5 flex flex-col gap-4">
              {/* 3D view */}
              <div className="h-[280px]" style={{ height: '400px', minHeight: '400px' }}>
                <MotorCanvas 
                  rpm={state.rpm}
                  vibration={state.vibration}
                  temperature={state.temperature}
                  bearingHealth={state.bearingHealth}
                  cooling={state.cooling}
                  state={state.operatingState}
                />
              </div>

              {/* Digital Twin Sync Metrics */}
              <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-lg grid grid-cols-3 gap-2 font-mono text-[10px]">
                <div className="bg-industrial-950 border border-industrial-850 p-2 rounded">
                  <div className="text-industrial-500 mb-0.5">ELAPSED TIME</div>
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-info-500" />
                    {formatTime(state.simulationTime)}
                  </div>
                </div>
                <div className="bg-industrial-950 border border-industrial-850 p-2 rounded">
                  <div className="text-industrial-500 mb-0.5">TWIN SYNC STATUS</div>
                  <div className="text-xs font-bold text-success-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {state.syncPercentage}%
                  </div>
                </div>
                <div className="bg-industrial-950 border border-industrial-850 p-2 rounded">
                  <div className="text-industrial-500 mb-0.5">ACTIVE VECTORS</div>
                  <div className={`text-xs font-bold flex items-center gap-1 ${state.activeFaults.length > 0 ? 'text-warning-500' : 'text-industrial-400'}`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {state.activeFaults.length} FAULTS
                  </div>
                </div>
              </div>

              {/* Digital Twin State Panel */}
              <div className={`${showDetails ? '' : 'hidden'} bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex-1`}>
                <h3 className="text-xs font-mono font-bold tracking-widest text-industrial-300 mb-3 uppercase">DIGITAL TWIN STATE</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[10px]">
                  {[
                    { label: 'Operating State', value: state.operatingState === 'FAULTED' && state.rpm > 0 ? 'TRIPPED — COASTING' : state.operatingState, color: state.operatingState === 'RUNNING' ? 'text-success-500' : state.operatingState === 'FAULTED' ? 'text-danger-500 font-black animate-pulse' : 'text-industrial-400' },
                    { label: 'Overall Health', value: `${state.health}%`, color: state.health > 80 ? 'text-success-500' : state.health > 50 ? 'text-warning-500' : 'text-danger-500' },
                    { label: 'Stator Insulation', value: `${state.statorHealth}%`, color: state.statorHealth > 80 ? 'text-success-500' : state.statorHealth > 50 ? 'text-warning-500' : 'text-danger-500' },
                    { label: 'Winding Temp', value: `${state.temperature}°C`, color: state.temperature > 82 ? 'text-danger-500' : state.temperature > 72 ? 'text-warning-500' : 'text-success-500' },
                    { label: 'Mechanical Vib', value: `${state.vibration} mm/s`, color: state.vibration > 4.5 ? 'text-danger-500' : state.vibration > 3.0 ? 'text-warning-500' : 'text-success-500' },
                    { label: 'Rotor speed', value: `${state.rpm} RPM` },
                    { label: 'Supply Voltage', value: `${state.voltage} V`, color: state.voltage < 200 ? 'text-warning-500' : '' },
                    { label: 'Current Draw', value: `${state.current} A`, color: state.current > 7.0 ? 'text-danger-500' : '' },
                    { label: 'Load Factor', value: `${state.load}%`, color: state.load > 95 ? 'text-danger-500' : '' },
                    { label: 'Bearing Life', value: `${state.bearingHealth}%`, color: state.bearingHealth < 50 ? 'text-danger-500' : state.bearingHealth < 80 ? 'text-warning-500' : 'text-success-500' },
                    { label: 'Cooling Eff', value: `${state.cooling}%`, color: state.cooling < 40 ? 'text-danger-500' : state.cooling < 75 ? 'text-warning-500' : 'text-success-500' },
                    { label: 'Lubrication Lvl', value: `${state.lubricationHealth}%`, color: state.lubricationHealth < 40 ? 'text-danger-500' : '' },
                    { label: 'Motor Efficiency', value: `${state.efficiency}%`, color: state.efficiency < 80 ? 'text-warning-500' : '' }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-industrial-950 border border-industrial-850 p-2 rounded">
                      <div className="text-industrial-500 text-[9px] mb-0.5 uppercase tracking-wider">{item.label}</div>
                      <div className={`text-xs font-bold ${item.color || 'text-white'}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MIDDLE COLUMN: Controls and Charts */}
            <div className="xl:col-span-4 flex flex-col gap-4">
              
              {/* Health Score circle & State summary */}
              <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex items-center justify-between gap-4">
                <div className="flex-1 font-mono">
                  <span className="text-[9px] text-industrial-500 uppercase tracking-widest block">ANALYSIS SUMMARY</span>
                  <div className="text-sm font-bold text-white mt-1 uppercase">MTR-001 MOTOR STATUS</div>
                  
                  {state.operatingState === 'FAULTED' ? (
                    <div className="text-[10px] text-danger-500 font-bold border border-danger-500/30 bg-danger-950/20 px-2 py-1 rounded inline-block mt-2">
                      ⚠️ HARDWARE CRITICAL TRIP
                    </div>
                  ) : state.health > 85 ? (
                    <div className="text-[10px] text-success-500 font-bold border border-success-500/30 bg-success-950/20 px-2 py-1 rounded inline-block mt-2">
                      ✔ STEADY-STATE NORMAL
                    </div>
                  ) : state.health > 50 ? (
                    <div className="text-[10px] text-warning-500 font-bold border border-warning-500/30 bg-warning-950/20 px-2 py-1 rounded inline-block mt-2">
                      ⚠ WARNING: TREND ABNORMAL
                    </div>
                  ) : (
                    <div className="text-[10px] text-danger-500 font-bold border border-danger-500/30 bg-danger-950/20 px-2 py-1 rounded inline-block mt-2">
                      ⚡ CRITICAL TEMPERATURE/WEAR
                    </div>
                  )}
                  <p className="text-[10px] text-industrial-400 mt-2 italic leading-relaxed">
                    Dynamic failure risk is evaluated at {state.failureRisk}% based on stator heat gradients.
                  </p>
                </div>
                
                {/* Circular Gauge */}
                <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="45"
                      stroke="#1a1d24"
                      strokeWidth="6"
                      fill="transparent"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="45"
                      stroke={state.health > 80 ? '#10b981' : state.health > 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="gauge-circle"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center font-mono">
                    <span className="text-xl font-black text-white">{state.health}</span>
                    <span className="text-[7px] text-industrial-400 uppercase font-bold tracking-wider">HEALTH</span>
                  </div>
                </div>
              </div>

              {/* Simulation Controls */}
              <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-mono font-bold tracking-widest text-industrial-300 uppercase">MACHINE CONTROLS</h3>
                  
                  {/* Speed Controls */}
                  <div className="flex bg-industrial-950 p-0.5 rounded border border-industrial-800 font-mono text-[9px]">
                    {[1, 5, 10].map(s => (
                      <button
                        key={s}
                        onClick={() => triggerCommand('simulationSpeed', s)}
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          state.simulationSpeed === s 
                            ? 'bg-info-500 text-white' 
                            : 'text-industrial-450 hover:text-industrial-200'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  <button
                    onClick={() => triggerCommand('START')}
                    disabled={state.operatingState === 'RUNNING' || state.operatingState === 'FAULTED' || Boolean(state.maintenanceCase && !state.maintenanceCase.verified)}
                    className={`py-1.5 rounded text-[10px] font-mono font-bold border flex items-center justify-center gap-1 transition-all ${
                      state.operatingState === 'RUNNING' || state.operatingState === 'FAULTED'
                        ? 'border-success-500/30 text-success-500/50 bg-success-950/5'
                        : 'border-success-500 text-success-500 hover:bg-success-500/10'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    {state.operatingState === 'FAULTED' ? 'START INHIBITED' : 'START'}
                  </button>
                  <button
                    onClick={() => triggerCommand('PAUSE')}
                    disabled={state.operatingState === 'STOPPED'}
                    className={`py-1.5 rounded text-[10px] font-mono font-bold border flex items-center justify-center gap-1 transition-all ${
                      state.operatingState === 'STOPPED'
                        ? 'border-industrial-800 text-industrial-500'
                        : 'border-warning-500 text-warning-500 hover:bg-warning-500/10'
                    }`}
                  >
                    <Pause className="w-3 h-3 fill-current" />
                    PAUSE
                  </button>
                  <button
                    onClick={() => triggerCommand('RESET')}
                    className="py-1.5 rounded text-[10px] font-mono font-bold border border-info-500 text-info-500 hover:bg-info-500/10 flex items-center justify-center gap-1 transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    RESET
                  </button>
                  <button
                    onClick={() => triggerCommand('NORMALIZE')}
                    className="py-1.5 rounded text-[10px] font-mono font-bold border border-industrial-700 text-industrial-300 hover:bg-industrial-800 flex items-center justify-center gap-1 transition-all"
                  >
                    NORMALIZE
                  </button>
                </div>

                {/* Sliders */}
                <div className="space-y-2.5 font-mono text-[9px]">
                  <div>
                    <div className="flex justify-between text-industrial-400 mb-0.5">
                      <span>LOAD MULTIPLIER:</span>
                      <span className="text-white font-bold">{state.loadSetting}%</span>
                    </div>
                    <input 
                      aria-label="Load multiplier"
                      type="range" min="0" max="120" value={state.loadSetting} 
                      onInput={(e) => triggerCommand('loadSetting', Number(e.currentTarget.value))}
                      className="w-full accent-info-500 bg-industrial-950 h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-industrial-400 mb-0.5">
                      <span>VOLTAGE REGULATOR:</span>
                      <span className="text-white font-bold">{state.voltageSetting} V</span>
                    </div>
                    <input 
                      aria-label="Voltage regulator"
                      type="range" min="150" max="260" value={state.voltageSetting} 
                      onInput={(e) => triggerCommand('voltageSetting', Number(e.currentTarget.value))}
                      className="w-full accent-info-500 bg-industrial-950 h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-industrial-400 mb-0.5">
                      <span>COOLING FAN VALVE:</span>
                      <span className="text-white font-bold">{state.coolingSetting}%</span>
                    </div>
                    <input 
                      aria-label="Cooling fan valve"
                      type="range" min="0" max="100" value={state.coolingSetting} 
                      onInput={(e) => triggerCommand('coolingSetting', Number(e.currentTarget.value))}
                      className="w-full accent-info-500 bg-industrial-950 h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-industrial-400 mb-0.5">
                      <span>AMBIENT HEAT STRESS:</span>
                      <span className="text-white font-bold">{state.tempStress}°C</span>
                    </div>
                    <input 
                      aria-label="Ambient heat stress"
                      type="range" min="15" max="55" value={state.tempStress} 
                      onInput={(e) => triggerCommand('tempStress', Number(e.currentTarget.value))}
                      className="w-full accent-info-500 bg-industrial-950 h-1 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Live charts */}
              <div className="flex-1 min-h-[300px]">
                <TelemetryCharts history={history} />
              </div>
            </div>

            {/* RIGHT COLUMN: Fault lab, Cascade, Alerts, Intelligence (3 cols) */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              
              {/* Predictive Intelligence Panel */}
              <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex flex-col justify-between font-mono text-[10px]">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Cpu className="w-4 h-4 text-info-500" />
                    <h3 className="text-xs font-bold tracking-widest text-industrial-300">TWIN INTELLIGENCE</h3>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">DYNAMIC RISK:</span>
                      <span className={`font-bold ${intel.riskColor}`}>{intel.riskLabel} ({state.failureRisk}%)</span>
                    </div>
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">FAIL TYPE:</span>
                      <span className="font-bold text-white text-right truncate max-w-[140px]">{intel.predictedFailure}</span>
                    </div>
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">EST. WINDOW:</span>
                      <span className="font-bold text-info-500">{intel.failWindow}</span>
                    </div>
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">CONFIDENCE:</span>
                      <span className="font-bold text-white">{intel.confidence}%</span>
                    </div>
                  </div>

                  {/* Why risk is increasing */}
                  <div className="bg-industrial-950 p-2 border border-industrial-850 rounded mb-3">
                    <div className="text-industrial-450 font-bold uppercase tracking-wider text-[8px] mb-1">PROBABILISTIC RATIONALE</div>
                    <p className="text-[9px] text-industrial-300 leading-relaxed italic">{intel.explanation}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] text-industrial-550 uppercase tracking-widest block mb-1">RECOMMENDATIONS:</span>
                  <div className="space-y-1 text-industrial-200 text-[9px] leading-relaxed">
                    {intel.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <span className="text-info-500 font-bold">•</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[7.5px] text-industrial-500 border-t border-industrial-850 mt-3 pt-1 text-center font-bold tracking-wider uppercase">
                  Simulation-Based Predictions
                </div>
              </div>

              {/* Fault Cascade diagram */}
              <div className={`${showDetails ? '' : 'hidden'} h-[280px]`}>
                <FaultCascade 
                  activeFaults={state.activeFaults}
                  cooling={state.cooling}
                  temperature={state.temperature}
                  bearingHealth={state.bearingHealth}
                  vibration={state.vibration}
                  voltage={state.voltage}
                  current={state.current}
                  failureRisk={state.failureRisk}
                  operatingState={state.operatingState}
                />
              </div>

              {/* Fault Injection Lab */}
              <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg">
                <h3 className="text-xs font-mono font-bold tracking-widest text-industrial-300 mb-3 uppercase">FAULT INJECTION LAB</h3>
                
                <div className="space-y-2 font-mono text-[9px]">
                  {/* Category: Thermal */}
                  <div>
                    <span className="text-[8px] text-industrial-500 font-bold tracking-wide uppercase">THERMAL OVERLOADS</span>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <button
                        onClick={() => injectFault({ id: 'overheating', name: 'Thermal Friction', severity: 'WARNING', description: 'Overheating from severe stator coil friction' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Overheating
                      </button>
                      <button
                        onClick={() => injectFault({ id: 'cooling_failure', name: 'Cooling Loss', severity: 'CRITICAL', description: 'Cooling fan failure or cooling inlet block' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Cooling Fail
                      </button>
                    </div>
                  </div>

                  {/* Category: Mechanical */}
                  <div>
                    <span className="text-[8px] text-industrial-500 font-bold tracking-wide uppercase">MECHANICAL FAULTS</span>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      <button
                        onClick={() => injectFault({ id: 'bearing_degradation', name: 'Bearing Damage', severity: 'CRITICAL', description: 'Severe bearing friction/wear' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Bearing Wear
                      </button>
                      <button
                        onClick={() => injectFault({ id: 'shaft_imbalance', name: 'Shaft Imbalance', severity: 'WARNING', description: 'Shaft coupling imbalance vibration' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Imbalance
                      </button>
                      <button
                        onClick={() => injectFault({ id: 'excessive_vibration', name: 'Extreme Vibration', severity: 'WARNING', description: 'Mechanical vibration threshold breach' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Vibration
                      </button>
                    </div>
                  </div>

                  {/* Category: Electrical */}
                  <div>
                    <span className="text-[8px] text-industrial-500 font-bold tracking-wide uppercase">ELECTRICAL MALFUNCTIONS</span>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      <button
                        onClick={() => injectFault({ id: 'voltage_drop', name: 'Voltage Drop', severity: 'WARNING', description: 'Severe voltage drop to 180V' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Volt Drop
                      </button>
                      <button
                        onClick={() => injectFault({ id: 'overcurrent', name: 'Overcurrent Winding', severity: 'CRITICAL', description: 'Current overload winding stress' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Overcurrent
                      </button>
                      <button
                        onClick={() => injectFault({ id: 'power_instability', name: 'Power Instability', severity: 'WARNING', description: 'Unstable voltage supply fluctuations' })}
                        className="py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 transition-all truncate"
                      >
                        Power Instab
                      </button>
                    </div>
                  </div>

                  {/* Load / Reset */}
                  <div className="flex gap-2 pt-1.5">
                    <button
                      onClick={() => injectFault({ id: 'excessive_load', name: 'Excessive Load', severity: 'WARNING', description: 'Extreme load factor >115%' })}
                      className="flex-1 py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-danger-500/50 text-industrial-300 hover:text-danger-400 font-bold transition-all"
                    >
                      Excessive Load
                    </button>
                    <button
                      onClick={() => resolveFault()}
                      disabled={state.activeFaults.length === 0}
                      className="flex-1 py-1 rounded bg-industrial-950 border border-industrial-800 text-info-500 font-bold hover:border-info-500/50 transition-all disabled:opacity-50"
                    >
                      Resolve All
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* LOWER BOTTOM SECTION: Alert Log & Maintenance center & Timeline (12 cols) */}
            <div className={`xl:col-span-12 grid grid-cols-1 ${showDetails ? 'md:grid-cols-3' : ''} gap-4 border-t border-industrial-800 pt-4`}>
              
              {/* Alert Center */}
              <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-lg flex flex-col h-[200px]">
                <h4 className="text-xs font-mono font-bold tracking-widest text-industrial-300 mb-2 uppercase">DIAGNOSIS & REPAIR</h4>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[9px]">
                  {repairReport && (
                    <div className="bg-success-950/20 border border-success-500/40 p-2 rounded text-industrial-200">
                      <div className="text-success-500 font-bold mb-1">MAINTENANCE: {repairReport.stage}</div>
                      <div><span className="text-industrial-500">Diagnosis:</span> {repairReport.diagnosis}</div>
                      {repairReport.actions.map((action: string, index: number) => (
                        <div key={index} className="mt-1">✓ {action}</div>
                      ))}
                      <div className="mt-2 flex gap-2">
                        {repairReport.stage === 'DIAGNOSED' && <button onClick={() => resolveFault(undefined, 'repair')} className="bg-info-600 text-white px-2 py-1 rounded">PERFORM REPAIR</button>}
                        {repairReport.stage === 'REPAIRED' && <button onClick={() => resolveFault(undefined, 'verify')} className="bg-warning-600 text-white px-2 py-1 rounded">RUN SAFETY CHECKS</button>}
                        {repairReport.stage === 'VERIFIED' && <button onClick={() => resolveFault(undefined, 'restart')} className="bg-success-600 text-white px-2 py-1 rounded">VERIFIED RESTART</button>}
                      </div>
                    </div>
                  )}
                  {state.activeFaults.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-industrial-500">
                      {repairReport ? 'Motor is recovering under live monitoring.' : 'No active problem detected.'}
                    </div>
                  ) : (
                    state.activeFaults.map((f, i) => (
                      <div key={i} className="bg-industrial-950 border border-industrial-850 p-2 rounded flex justify-between gap-3">
                        <div>
                          <div className="text-danger-500 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-ping"></span>
                            {f.name.toUpperCase()} [{f.severity}]
                          </div>
                          <p className="text-industrial-300 mt-0.5 leading-relaxed">{f.description}</p>
                        </div>
                        <button 
                          onClick={() => resolveFault(f.id, 'diagnose')}
                          disabled={resolvingFault !== null}
                          className="text-[8px] font-bold text-white bg-info-600 hover:bg-info-500 border border-info-500 px-2 py-1 rounded h-fit disabled:opacity-50"
                        >
                          {resolvingFault ? 'WORKING…' : 'DIAGNOSE'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Maintenance Center */}
              <div className={`${showDetails ? '' : 'hidden'} bg-industrial-900 border border-industrial-800 p-3 rounded-lg flex flex-col justify-between h-[200px] font-mono text-[9px]`}>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Hammer className="w-4 h-4 text-info-500" />
                    <h4 className="text-xs font-bold tracking-widest text-industrial-300 uppercase">MAINTENANCE CENTER</h4>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">DETECTED ISSUE:</span>
                      <span className="text-white font-bold truncate max-w-[160px]">{maintenance.issue}</span>
                    </div>
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">RISK CLASS:</span>
                      <span className="text-white font-bold">{maintenance.risk}</span>
                    </div>
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">PRIORITY:</span>
                      <span className={maintenance.priority === 'CRITICAL' || maintenance.priority === 'IMMEDIATE' ? 'text-danger-500 font-bold' : ''}>
                        {maintenance.priority}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-industrial-850 pb-1">
                      <span className="text-industrial-500">RECOMMENDED ACTION:</span>
                      <span className="text-white text-right truncate max-w-[150px]" title={maintenance.action}>
                        {maintenance.action}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`p-2 border rounded-lg flex items-center justify-between mt-2 font-bold ${maintenance.color}`}>
                  <span>MAINTENANCE STATUS:</span>
                  <span>{maintenance.status}</span>
                </div>
              </div>

              {/* Machine History Timeline */}
              <div className={`${showDetails ? '' : 'hidden'} bg-industrial-900 border border-industrial-800 p-3 rounded-lg flex flex-col h-[200px]`}>
                <h4 className="text-xs font-mono font-bold tracking-widest text-industrial-300 mb-2 uppercase">MACHINE HISTORY TIMELINE</h4>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[8px] leading-relaxed">
                  {eventLog.map((log, idx) => (
                    <div key={idx} className="flex gap-1.5 border-b border-industrial-850/40 pb-1">
                      <span className="text-industrial-500 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className={`font-bold flex-shrink-0 ${
                        log.severity === 'critical' 
                          ? 'text-danger-500' 
                          : log.severity === 'warning' 
                            ? 'text-warning-500' 
                            : 'text-info-500'
                      }`}>
                        [{log.type.toUpperCase()}]
                      </span>
                      <span className="text-industrial-300">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: WHAT-IF FORECAST LAB */}
        {activeTab === 'whatif' && (
          <WhatIfSimulator />
        )}

        {/* TAB 3: PRESENTATION MODE */}
        {activeTab === 'presentation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            {/* Left: Large 3D Motor (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-3 h-full">
              <div className="flex-1 relative">
                <MotorCanvas 
                  rpm={state.rpm}
                  vibration={state.vibration}
                  temperature={state.temperature}
                  bearingHealth={state.bearingHealth}
                  cooling={state.cooling}
                  state={state.operatingState}
                />
              </div>
              
              {/* Active Fault Status */}
              <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-lg flex items-center justify-between font-mono">
                <div className="text-xs">
                  <span className="text-industrial-550 block text-[9px] uppercase tracking-widest">ACTIVE FAULT STATUS</span>
                  <span className="text-white font-bold">
                    {state.activeFaults.length === 0 ? 'NOMINAL: NO ACTIVE SYSTEM ERRORS' : `ACTIVE INCIDENT: ${state.activeFaults[0].name.toUpperCase()}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => triggerCommand('RESET')}
                    className="px-3 py-1 bg-industrial-950 border border-industrial-800 hover:border-info-500/50 text-info-500 font-bold rounded text-[10px]"
                  >
                    RESET MOTOR
                  </button>
                  <button 
                    onClick={() => clearFault()}
                    disabled={state.activeFaults.length === 0}
                    className="px-3 py-1 bg-industrial-950 border border-industrial-800 text-industrial-450 hover:text-industrial-300 font-bold rounded text-[10px] disabled:opacity-50"
                  >
                    CLEAR FAULTS
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Key Stats / Rationale / Control overlays (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 justify-between h-full overflow-y-auto">
              
              {/* Giant Health score & Risk card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex flex-col items-center justify-center font-mono">
                  <span className="text-[10px] text-industrial-500 uppercase tracking-widest mb-2">MOTOR HEALTH</span>
                  <div className={`text-4xl font-black ${state.health > 80 ? 'text-success-500' : state.health > 50 ? 'text-warning-500' : 'text-danger-500 animate-pulse'}`}>
                    {state.health}%
                  </div>
                  <span className="text-[8px] text-industrial-450 mt-1 uppercase">Overall Condition</span>
                </div>
                
                <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg flex flex-col items-center justify-center font-mono">
                  <span className="text-[10px] text-industrial-500 uppercase tracking-widest mb-2">FAILURE RISK</span>
                  <div className={`text-4xl font-black ${state.failureRisk > 80 ? 'text-danger-500 animate-pulse' : state.failureRisk > 40 ? 'text-warning-500' : 'text-success-500'}`}>
                    {state.failureRisk}%
                  </div>
                  <span className="text-[8px] text-industrial-450 mt-1 uppercase">Simulation Risk Score</span>
                </div>
              </div>

              {/* Dynamic Stats Grid */}
              <div className="bg-industrial-900 border border-industrial-800 p-4 rounded-lg font-mono">
                <div className="text-xs text-industrial-300 font-bold tracking-widest uppercase mb-3 flex justify-between items-center">
                  <span>LIVE MOTOR TELEMETRY</span>
                  <span className="text-[10px] text-industrial-500 font-normal">SPEED: {state.simulationSpeed}x</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="bg-industrial-950 border border-industrial-850 p-2.5 rounded flex justify-between">
                    <span className="text-industrial-500">WINDING TEMP:</span>
                    <span className={`font-bold ${state.temperature > 80 ? 'text-danger-500' : 'text-white'}`}>{state.temperature}°C</span>
                  </div>
                  <div className="bg-industrial-950 border border-industrial-850 p-2.5 rounded flex justify-between">
                    <span className="text-industrial-500">VIBRATION:</span>
                    <span className={`font-bold ${state.vibration > 3.0 ? 'text-warning-500' : 'text-white'}`}>{state.vibration} mm/s</span>
                  </div>
                  <div className="bg-industrial-950 border border-industrial-850 p-2.5 rounded flex justify-between">
                    <span className="text-industrial-500">MOTOR SPEED:</span>
                    <span className="font-bold text-white">{state.rpm} RPM</span>
                  </div>
                  <div className="bg-industrial-950 border border-industrial-850 p-2.5 rounded flex justify-between">
                    <span className="text-industrial-500">COOLING LEVEL:</span>
                    <span className="font-bold text-white">{state.cooling}%</span>
                  </div>
                  <div className="bg-industrial-950 border border-industrial-850 p-2.5 rounded flex justify-between">
                    <span className="text-industrial-500">CURRENT DRAW:</span>
                    <span className="font-bold text-white">{state.current} A</span>
                  </div>
                  <div className="bg-industrial-950 border border-industrial-850 p-2.5 rounded flex justify-between">
                    <span className="text-industrial-500">MOTOR LOAD:</span>
                    <span className="font-bold text-white">{state.load}%</span>
                  </div>
                </div>
              </div>

              {/* Predictive Intelligence Overlay */}
              <div className={`p-4 border rounded-lg font-mono ${
                state.failureRisk >= 80 
                  ? 'bg-danger-950/20 border-danger-500/50 text-danger-400' 
                  : state.failureRisk >= 40 
                    ? 'bg-warning-950/20 border-warning-500/50 text-warning-400' 
                    : 'bg-success-950/20 border-success-500/50 text-success-400'
              }`}>
                <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider">
                  <Cpu className="w-4 h-4" />
                  <span>PREDICTIVE SHIELD STATUS</span>
                </div>
                <div className="text-[11px] font-bold border-b border-white/10 pb-1.5 mb-2">
                  EST. FAILURE WINDOW: {intel.failWindow} (CONFIDENCE: {intel.confidence}%)
                </div>
                <p className="text-[10px] leading-relaxed italic mb-3">
                  {intel.explanation}
                </p>
                <div className="text-[9px] uppercase font-bold tracking-widest opacity-80 mb-1">
                  TACTICAL DEVIATION ADVICE:
                </div>
                <div className="space-y-1 text-[9.5px]">
                  {intel.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span>•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Presentation Demo Steps Cheatsheet */}
              <div className="bg-industrial-900 border border-industrial-800 p-3 rounded-lg font-mono text-[9px] text-industrial-400 leading-normal">
                <div className="font-bold text-white text-[10px] uppercase mb-1 flex items-center gap-1.5">
                  <ListFilter className="w-3.5 h-3.5 text-info-500" />
                  <span>DEMO STEP SEQUENCE</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div>1. Start machine (Running)</div>
                  <div>2. Slide Load slider to 85%</div>
                  <div>3. Inject Cooling Failure fault</div>
                  <div>4. Review Cascade chain</div>
                  <div>5. Run What-If projection</div>
                  <div>6. Review recommended action</div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* 3. BOTTOM PANEL STATUS BAR */}
      <footer className="border-t border-industrial-800 bg-industrial-900/40 px-4 py-1.5 flex justify-between items-center text-[9px] font-mono text-industrial-500">
        <div>TwinForge v1.0.0 (Local Simulation Console)</div>
        <div>No Hardware Connected — Simulation Mode Active</div>
        <div>MTR-001 Twin Sync Frequency: 1.0Hz (WS Link)</div>
      </footer>
    </div>
  );
}
