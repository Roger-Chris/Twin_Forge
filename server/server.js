// server/server.js

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getInitialState, step, runWhatIf } from './simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const app = express();
app.use(cors());
app.use(express.json());

// Setup storage path
const DB_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DB_DIR, 'twinforge_db.json');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Load state from DB or get initial state
let currentState = getInitialState();
let history = [];
let eventLog = [
  {
    timestamp: new Date().toISOString(),
    type: 'system',
    message: 'Digital Twin Simulation initialized. System in NORMAL state.',
    severity: 'info',
  }
];

function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(raw);
      
      if (data.currentState) {
        const baseline = getInitialState();
        // Schema validation & migration
        currentState = {
          ...baseline,
          ...data.currentState,
          riskContributors: {
            ...baseline.riskContributors,
            ...(data.currentState.riskContributors || {})
          }
        };

        // Schema validation to prevent NaN issues
        if (isNaN(currentState.temperature)) currentState.temperature = baseline.temperature;
        if (isNaN(currentState.vibration)) currentState.vibration = baseline.vibration;
        if (isNaN(currentState.bearingHealth)) currentState.bearingHealth = baseline.bearingHealth;
        if (isNaN(currentState.statorHealth)) currentState.statorHealth = baseline.statorHealth;

        // Auto-reset if startup is faulted or degraded to prevent sticky failures across demo reboots
        if (currentState.operatingState === 'FAULTED' || (currentState.activeFaults && currentState.activeFaults.length > 0)) {
          console.log('Persisted state contained active faults. Auto-resetting to clean baseline for new demo run.');
          currentState = getInitialState();
          history = [];
        }
      }
      if (data.history) history = data.history;
      if (data.eventLog) eventLog = data.eventLog;
      console.log('Successfully loaded persisted simulation state.');
    }
  } catch (err) {
    console.error('Error loading simulation database:', err);
  }
}

function saveData() {
  try {
    const data = JSON.stringify({ currentState, history, eventLog }, null, 2);
    fs.writeFileSync(DB_FILE, data, 'utf8');
  } catch (err) {
    console.error('Error saving simulation database:', err);
  }
}

// Load persisted data at startup
loadData();

// HTTP server and WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Handle upgrade from Express
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Broadcast helper
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Add event to log
function logEvent(type, message, severity = 'info') {
  const event = {
    timestamp: new Date().toISOString(),
    type,
    message,
    severity,
  };
  eventLog.push(event);
  if (eventLog.length > 200) {
    eventLog.shift();
  }
  broadcast({ type: 'EVENT_LOGGED', event });
  return event;
}

// Simulation loop
let lastTickTime = Date.now();
let simInterval = null;
let forecastTickCounter = 0;

function refreshLiveForecast() {
  if (currentState.operatingState === 'FAULTED') {
    currentState.predictedTripSeconds = 0;
    currentState.forecastOutcome = 'tripped';
    currentState.predictionHorizonSeconds = 3600;
    return;
  }
  const forecast = runWhatIf(currentState, 60, {}, 'current', 67890);
  currentState.predictedTripSeconds = forecast.tripAtSeconds;
  currentState.forecastOutcome = forecast.outcome;
  currentState.predictionHorizonSeconds = 3600;
}

function runSimulationTick() {
  const now = Date.now();
  const dt = (now - lastTickTime) / 1000.0;
  lastTickTime = now;

  // Step simulation
  const previousState = { ...currentState };
  currentState = step(currentState, dt);
  forecastTickCounter += 1;
  if (forecastTickCounter >= 5 || currentState.predictedTripSeconds === undefined) {
    refreshLiveForecast();
    forecastTickCounter = 0;
  }

  // Check state transitions to trigger log events
  if (previousState.operatingState !== currentState.operatingState) {
    logEvent(
      'state_change',
      `Machine operating state changed from ${previousState.operatingState} to ${currentState.operatingState}.`,
      currentState.operatingState === 'FAULTED' ? 'critical' : 'info'
    );
  }

  // Warning/Critical state threshold events
  const prevCategory = getSeverityCategory(previousState.health);
  const currentCategory = getSeverityCategory(currentState.health);
  if (prevCategory !== currentCategory) {
    let severity = 'info';
    if (currentCategory === 'warning') severity = 'warning';
    if (currentCategory === 'critical') severity = 'critical';
    
    logEvent(
      'health_change',
      `Motor Health Category changed to ${currentCategory.toUpperCase()} (Health: ${currentState.health}%, Risk: ${currentState.failureRisk}%).`,
      severity
    );
  }

  // Record history
  const historyPoint = {
    timestamp: new Date().toISOString(),
    simTime: currentState.simulationTime,
    temperature: currentState.temperature,
    vibration: currentState.vibration,
    rpm: currentState.rpm,
    voltage: currentState.voltage,
    current: currentState.current,
    load: currentState.load,
    health: currentState.health,
    overallHealth: currentState.overallHealth,
    statorHealth: currentState.statorHealth,
    bearingHealth: currentState.bearingHealth,
    coolingHealth: currentState.coolingHealth,
    lubricationHealth: currentState.lubricationHealth,
    failureRisk: currentState.failureRisk,
    synchronousRpm: currentState.synchronousRpm,
    slipPercent: currentState.slipPercent,
    phaseVoltages: currentState.phaseVoltages,
    phaseCurrents: currentState.phaseCurrents,
    protectionStatus: currentState.protectionStatus,
  };

  history.push(historyPoint);
  if (history.length > 1800) { // Keep last 30 mins
    history.shift();
  }

  // Broadcast state to all websockets
  broadcast({
    type: 'TELEMETRY_UPDATE',
    state: currentState,
    historyPoint,
  });
}

function getSeverityCategory(health) {
  if (health >= 85) return 'normal';
  if (health >= 50) return 'warning';
  return 'critical';
}

function startSimulationLoop() {
  if (simInterval) clearInterval(simInterval);
  lastTickTime = Date.now();
  simInterval = setInterval(runSimulationTick, 1000);
}

// Start simulation
startSimulationLoop();

// Auto-save DB every 30 seconds
setInterval(saveData, 30000);

// API Endpoints
app.get('/api/state', (req, res) => {
  res.json({
    state: currentState,
    eventLog,
  });
});

app.get('/api/history', (req, res) => {
  res.json({
    history,
  });
});

app.post('/api/client-error', (req, res) => {
  console.error('TwinForge browser error:', req.body?.message, req.body?.stack || req.body?.componentStack || '');
  res.status(204).end();
});

app.post('/api/control', (req, res) => {
  const { command, value } = req.body;
  let changed = false;

  if (command === 'START') {
    if (currentState.operatingState === 'FAULTED' || (currentState.maintenanceCase && !currentState.maintenanceCase.verified)) {
      return res.status(409).json({
        success: false,
        message: 'Restart inhibited: diagnose, repair, and verify the motor before energizing.',
        state: currentState,
      });
    }
    if (currentState.operatingState !== 'RUNNING') {
      currentState.operatingState = 'RUNNING';
      logEvent('control', 'Motor start command received.', 'info');
      changed = true;
    }
  } else if (command === 'PAUSE') {
    if (currentState.operatingState === 'RUNNING') {
      currentState.operatingState = 'STOPPED';
      logEvent('control', 'Motor stop command received.', 'info');
      changed = true;
    }
  } else if (command === 'RESET') {
    // Reset clears faults and restores clean canonical healthy state
    currentState = getInitialState();
    history = [];
    logEvent('control', 'Motor system reset command received. Canonical healthy state restored.', 'info');
    changed = true;
  } else if (command === 'NORMALIZE') {
    // Clear all active faults, but keep bearing wear
    currentState.activeFaults = [];
    currentState.loadSetting = 64;
    currentState.voltageSetting = 230;
    currentState.coolingSetting = 92;
    currentState.tempStress = 25;
    logEvent('control', 'Normalizing operation settings. Injected faults cleared.', 'info');
    changed = true;
  } else if (command === 'loadSetting') {
    currentState.loadSetting = parseFloat(value);
    changed = true;
  } else if (command === 'voltageSetting') {
    currentState.voltageSetting = parseFloat(value);
    changed = true;
  } else if (command === 'coolingSetting') {
    currentState.coolingSetting = parseFloat(value);
    changed = true;
  } else if (command === 'tempStress') {
    currentState.tempStress = parseFloat(value);
    changed = true;
  } else if (command === 'simulationSpeed') {
    currentState.simulationSpeed = parseInt(value, 10);
    logEvent('control', `Simulation speed set to ${value}x.`, 'info');
    changed = true;
  }

  if (changed) {
    lastTickTime = Date.now(); // update tick timer to avoid jumps
    broadcast({ type: 'STATE_CHANGED', state: currentState });
    saveData();
  }

  res.json({ success: true, state: currentState });
});

app.post('/api/faults/inject', (req, res) => {
  const { id, name, severity, description } = req.body;
  
  if (!currentState.activeFaults.some(f => f.id === id)) {
    const fault = {
      id,
      name,
      severity,
      description,
      timestamp: new Date().toISOString()
    };
    currentState.activeFaults.push(fault);
    logEvent('fault_inject', `FAULT INJECTED: ${name} (${severity}) - ${description}`, severity.toLowerCase() === 'critical' ? 'critical' : 'warning');
    
    broadcast({ type: 'STATE_CHANGED', state: currentState });
    saveData();
    res.json({ success: true, state: currentState });
  } else {
    res.json({ success: false, message: 'Fault already active', state: currentState });
  }
});

app.post('/api/faults/reset', (req, res) => {
  const { id } = req.body;
  const originalCount = currentState.activeFaults.length;
  
  if (id) {
    const fault = currentState.activeFaults.find(f => f.id === id);
    currentState.activeFaults = currentState.activeFaults.filter(f => f.id !== id);
    if (fault) {
      logEvent('fault_clear', `Fault cleared: ${fault.name}`, 'info');
    }
  } else {
    currentState.activeFaults = [];
    logEvent('fault_clear', 'All active faults cleared.', 'info');
  }

  if (currentState.activeFaults.length !== originalCount) {
    broadcast({ type: 'STATE_CHANGED', state: currentState });
    saveData();
  }

  res.json({ success: true, state: currentState });
});

// Apply a fault-specific maintenance intervention instead of only hiding the alert.
app.post('/api/maintenance/resolve', (req, res) => {
  const requestedId = req.body?.id;
  const action = req.body?.action || 'diagnose';
  const causalFaults = currentState.activeFaults.filter(f => f.id !== 'critical_trip');
  // Maintenance isolation is machine-wide: diagnosing one alarm must include every
  // active causal fault so a secondary fault cannot survive a verified restart.
  const targets = requestedId && requestedId !== 'critical_trip'
    ? [...causalFaults.filter(f => f.id === requestedId), ...causalFaults.filter(f => f.id !== requestedId)]
    : causalFaults;

  if (action === 'diagnose') {
    const inferred = targets.map(f => f.id);
    if (currentState.loadSetting > 85 && !inferred.includes('excessive_load')) inferred.push('excessive_load');
    if (Math.abs(currentState.voltageSetting - 230) > 20 && !inferred.includes('voltage_drop')) inferred.push('voltage_drop');
    if (currentState.coolingSetting < 75 && !inferred.includes('cooling_failure')) inferred.push('cooling_failure');
    if (currentState.tempStress > 40 && !inferred.includes('overheating')) inferred.push('overheating');
    if (inferred.length === 0 && currentState.operatingState !== 'FAULTED') {
      return res.status(400).json({ success: false, message: 'No active fault or unsafe condition was found.' });
    }
    currentState.operatingState = 'STOPPED';
    currentState.protectionStatus = 'TRIPPED';
    currentState.maintenanceCase = {
      stage: 'DIAGNOSED',
      faultIds: inferred,
      diagnosis: targets.length ? targets.map(f => f.name).join(', ') : 'Unsafe operating conditions',
      actions: ['Motor isolated. Repair is required before verification or restart.'],
      verified: false,
    };
    logEvent('maintenance', `Diagnosis complete: ${currentState.maintenanceCase.diagnosis}. Motor isolated.`, 'warning');
  } else if (action === 'repair') {
    if (!currentState.maintenanceCase || currentState.maintenanceCase.stage !== 'DIAGNOSED') {
      return res.status(409).json({ success: false, message: 'Diagnose and isolate the motor before repair.' });
    }
    const actions = [];
    for (const faultId of currentState.maintenanceCase.faultIds) {
      const fault = { id: faultId, name: faultId.replaceAll('_', ' ') };
    switch (fault.id) {
      case 'cooling_failure':
        currentState.coolingSetting = 92;
        currentState.coolingHealth = 100;
        currentState.cooling = 92;
        actions.push('Cleared the cooling inlet and restored fan output to 92%.');
        break;
      case 'overheating':
        currentState.loadSetting = Math.min(currentState.loadSetting, 64);
        currentState.coolingSetting = 100;
        actions.push('Removed the external heat source, reduced load, and enabled maximum cooldown.');
        break;
      case 'bearing_degradation':
        currentState.bearingHealth = 95;
        currentState.lubricationHealth = 94;
        currentState.vibration = Math.min(currentState.vibration, 2.1);
        actions.push('Replaced the drive-end bearing, renewed lubricant, and checked shaft alignment.');
        break;
      case 'shaft_imbalance':
        currentState.vibration = Math.min(currentState.vibration, 2.1);
        actions.push('Realigned the shaft and balanced the rotor/coupling assembly.');
        break;
      case 'excessive_vibration':
        currentState.vibration = Math.min(currentState.vibration, 2.1);
        currentState.loadSetting = Math.min(currentState.loadSetting, 64);
        actions.push('Secured the mounting and reduced load to remove excessive vibration.');
        break;
      case 'voltage_drop':
      case 'power_instability':
        currentState.voltageSetting = 230;
        currentState.voltage = 230;
        actions.push('Restored the regulated three-phase supply to 230 V.');
        break;
      case 'overcurrent':
        currentState.voltageSetting = 230;
        currentState.loadSetting = Math.min(currentState.loadSetting, 64);
        actions.push('Removed the overcurrent condition and returned the motor to rated load and voltage.');
        break;
      case 'excessive_load':
        currentState.loadSetting = 64;
        actions.push('Removed the excessive mechanical load and restored the 64% nominal operating point.');
        break;
      default:
        actions.push(`Cleared the ${fault.name} fault after inspection.`);
    }
    }
    currentState.activeFaults = currentState.activeFaults.filter(f => !currentState.maintenanceCase.faultIds.includes(f.id) && f.id !== 'critical_trip');
    currentState.tripDelayCounter = 0;
    currentState.maintenanceCase.actions.push(...actions);
    currentState.maintenanceCase.stage = 'REPAIRED';
    logEvent('maintenance', `Physical repair complete. ${actions.join(' ')}`, 'info');
  } else if (action === 'verify') {
    if (!currentState.maintenanceCase || currentState.maintenanceCase.stage !== 'REPAIRED') {
      return res.status(409).json({ success: false, message: 'Complete the physical repair before verification.' });
    }
    const checks = {
      voltage: Math.abs(currentState.voltageSetting - 230) <= 10,
      cooling: currentState.coolingSetting >= 75 && currentState.coolingHealth >= 80,
      vibration: currentState.vibration <= 3,
      temperature: currentState.temperature < 85,
      bearings: currentState.bearingHealth >= 70,
      load: currentState.loadSetting <= 85,
      current: currentState.current <= 7.5,
      phaseBalance: (currentState.voltageUnbalance || 0) <= 2,
      noActiveCausalFaults: currentState.activeFaults.filter(f => f.id !== 'critical_trip').length === 0,
    };
    const passed = Object.values(checks).every(Boolean);
    currentState.maintenanceCase.checks = checks;
    currentState.maintenanceCase.verified = passed;
    currentState.maintenanceCase.stage = passed ? 'VERIFIED' : 'REPAIRED';
    currentState.protectionStatus = passed ? 'VERIFYING' : 'TRIPPED';
    if (!passed) return res.status(409).json({ success: false, message: 'Verification failed. Allow cooldown or correct failed checks.', state: currentState, report: currentState.maintenanceCase });
    logEvent('maintenance', 'Verification passed: supply, cooling, vibration, temperature, and bearing checks are safe.', 'info');
  } else if (action === 'restart') {
    if (!currentState.maintenanceCase?.verified) {
      return res.status(409).json({ success: false, message: 'Restart inhibited until verification passes.' });
    }
    currentState.operatingState = 'RUNNING';
    currentState.protectionStatus = 'NORMAL';
    currentState.rpm = 0;
    currentState.current = 0;
    currentState.load = 0;
    currentState.loadSetting = Math.min(currentState.loadSetting, 30);
    currentState.failureRisk = 1;
    currentState.maintenanceCase.stage = 'MONITORED_RESTART';
    currentState.maintenanceCase.actions.push('Safety relay reset; unloaded monitored restart started at 30% load.');
    logEvent('maintenance', 'Verified unloaded restart initiated at 30% load.', 'info');
  } else {
    return res.status(400).json({ success: false, message: 'Unknown maintenance action.' });
  }

  broadcast({ type: 'STATE_CHANGED', state: currentState });
  saveData();
  res.json({ success: true, state: currentState, report: currentState.maintenanceCase });
});

// Optional local OpenAI-compatible LLM explanation layer (LM Studio, llama.cpp, etc.).
const LOCAL_LLM_BASE_URL = process.env.LOCAL_LLM_BASE_URL || 'http://192.168.56.1:1234';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'qwen/qwen3.5-9b';

async function queryLocalLLM(forecastResult) {
  if (process.env.LOCAL_LLM_ENABLED === 'false') return null;

  const systemPrompt = `You are an industrial maintenance AI. Rewrite the following structured digital twin motor simulation results into a clear, professional engineering explanation. 
RULES:
1. Preserve all numerical values (temperatures, vibrations, health scores, seconds) exactly. Do NOT alter them.
2. Rely only on the provided facts. Do not invent failure causes or maintenance recommendations.
3. Keep the output under 3 sentences.
4. If the motor tripped, identify the cause from peak pre-trip evidence. Never describe a final post-trip cooldown value as the failure peak.
5. Clearly prefix your response with "[AI-GENERATED EXPLANATION] ".`;

  const userPrompt = `Outcome: ${forecastResult.outcome}
Trip time: ${forecastResult.tripAtSeconds === -1 ? 'None' : forecastResult.tripAtSeconds + ' seconds'}
Dominant Risk Factors: ${forecastResult.dominantRiskFactors.join(', ')}
Peak pre-trip evidence: ${JSON.stringify(forecastResult.peakEvidence || {})}
Explanation: ${forecastResult.explanation}
Recommendations: ${forecastResult.recommendations.join(', ')}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${LOCAL_LLM_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        reasoning_effort: 'none',
        max_tokens: 300,
        stream: false,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const body = await response.json();
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.log('Local LLM request failed or timed out. Falling back to deterministic explanation.', err.message);
    return null;
  }
}

app.get('/api/ai/status', async (req, res) => {
  if (process.env.LOCAL_LLM_ENABLED === 'false') {
    return res.json({ enabled: false, connected: false, model: LOCAL_LLM_MODEL });
  }
  try {
    const response = await fetch(`${LOCAL_LLM_BASE_URL}/v1/models`, { signal: AbortSignal.timeout(3000) });
    const body = await response.json();
    const models = (body.data || []).map(item => item.id);
    res.json({ enabled: true, connected: response.ok, model: LOCAL_LLM_MODEL, available: models.includes(LOCAL_LLM_MODEL), models });
  } catch (err) {
    res.json({ enabled: true, connected: false, model: LOCAL_LLM_MODEL, available: false, error: err.message });
  }
});

app.post('/api/whatif', async (req, res) => {
  const { duration, modifications, mode, seed } = req.body;
  const result = runWhatIf(currentState, duration, modifications, mode || 'current', seed || 12345);
  
  const llmExplanation = await queryLocalLLM(result);
  if (llmExplanation) {
    result.explanation = llmExplanation;
  }

  res.json(result);
});

// Serve frontend assets in production
const clientBuildPath = path.join(__dirname, '../dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Start HTTP Server
server.listen(PORT, () => {
  console.log(`TwinForge backend listening on port ${PORT}`);
  console.log(`WebSocket server mounted on ws://localhost:${PORT}/ws`);
});
