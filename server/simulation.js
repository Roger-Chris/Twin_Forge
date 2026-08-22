// server/simulation.js

export function getInitialState() {
  return {
    operatingState: 'RUNNING', // RUNNING, STOPPED, FAULTED
    health: 96,                 // Retained for compatibility with existing UI
    overallHealth: 96,         // Asset overall health
    statorHealth: 100,         // Component: Stator/Insulation health (0-100)
    bearingHealth: 95,         // Component: Bearing condition (0-100)
    lubricationHealth: 94,     // Component: Lubrication condition (0-100)
    coolingHealth: 100,        // Component: Physical cooling condition (0-100)
    temperature: 64.2,
    vibration: 2.1,
    rpm: 1487,
    voltage: 229,
    current: 4.9,
    load: 64,
    cooling: 92,
    efficiency: 91,
    failureRisk: 3,
    operationalReadiness: 100,
    protectionStatus: 'NORMAL', // NORMAL, WARNING, TRIP_PENDING, TRIPPED, VERIFYING
    maintenanceCase: null,
    synchronousRpm: 1500,
    slipPercent: 0.87,
    motorTorque: 16,
    loadTorque: 15.6,
    phaseVoltages: [229, 230, 229],
    phaseCurrents: [4.9, 4.8, 4.9],
    voltageUnbalance: 0.3,
    currentUnbalance: 1.4,
    riskContributors: {
      tempRisk: 0,
      vibRisk: 0,
      bearingRisk: 0,
      statorRisk: 0,
      voltageRisk: 0,
      currentRisk: 0,
      loadRisk: 0,
      coolingRisk: 0,
      unbalanceRisk: 0
    },
    tripDelayCounter: 0,
    simulationTime: 0, // in seconds
    syncPercentage: 99.8,
    activeFaults: [],
    // Settings/Sliders
    loadSetting: 64,
    voltageSetting: 230,
    coolingSetting: 92,
    tempStress: 25,
    simulationSpeed: 1, // 1x, 5x, 10x
  };
}

export function createSeededRandom(seed) {
  let s = seed || 12345;
  return function() {
    // Simple LCG pseudo-random generator
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Advance accelerated operation using stable one-second numerical substeps.
// This preserves the same physics at 1x, 5x and 10x instead of clipping both
// accelerated modes to the former two-second cap.
export function step(state, dt, randomFn = Math.random) {
  const requestedSpeed = Math.max(0.1, Number(state.simulationSpeed) || 1);
  let remaining = Math.max(0, dt * requestedSpeed);
  let nextState = { ...state, simulationSpeed: 1 };

  if (remaining === 0) {
    return { ...stepSingle(nextState, 0, randomFn), simulationSpeed: requestedSpeed };
  }

  while (remaining > 1e-9) {
    const substep = Math.min(1, remaining);
    nextState = stepSingle(nextState, substep, randomFn);
    remaining -= substep;
  }

  return { ...nextState, simulationSpeed: requestedSpeed };
}

function stepSingle(state, dt, randomFn = Math.random) {
  const effectiveDt = Math.max(0, dt);

  let {
    operatingState,
    health,
    overallHealth,
    statorHealth,
    bearingHealth,
    lubricationHealth,
    coolingHealth,
    temperature,
    vibration,
    rpm,
    voltage,
    current,
    load,
    cooling,
    efficiency,
    failureRisk,
    riskContributors,
    tripDelayCounter,
    protectionStatus,
    simulationTime,
    syncPercentage,
    activeFaults,
    loadSetting,
    voltageSetting,
    coolingSetting,
    tempStress,
  } = state;

  // Initialize new fields if missing
  if (statorHealth === undefined) statorHealth = 100;
  if (bearingHealth === undefined) bearingHealth = 95;
  if (lubricationHealth === undefined) lubricationHealth = 94;
  if (coolingHealth === undefined) coolingHealth = 100;
  if (tripDelayCounter === undefined) tripDelayCounter = 0;
  if (riskContributors === undefined) {
    riskContributors = {
      tempRisk: 0,
      vibRisk: 0,
      bearingRisk: 0,
      statorRisk: 0,
      voltageRisk: 0,
      currentRisk: 0,
      loadRisk: 0,
      coolingRisk: 0,
      unbalanceRisk: 0
    };
  }

  const hasFault = (f) => activeFaults.some(item => item.id === f);
  const thermalTimeConstant = 300.0; // 5 minutes (300 seconds) thermal response

  // 1. FAULTED (Tripped) Cooldown & Decay Logic
  if (operatingState === 'FAULTED') {
    // With electrical torque removed, inertia, driven load and bearing friction
    // produce a physical coast-down rather than an arbitrary health collapse.
    const coastLoadTorque = 24.4 * (load / 100);
    const coastFrictionTorque = 0.8 + (100 - bearingHealth) * 0.025;
    const coastAlpha = -(coastLoadTorque + coastFrictionTorque) / 1.5;
    rpm = Math.max(0, rpm + coastAlpha * (60 / (2 * Math.PI)) * effectiveDt);
    current = Math.max(0, current - 4.0 * effectiveDt);
    load = Math.max(0, load - 40 * effectiveDt);
    vibration = Math.max(0.1, vibration - 1.5 * effectiveDt);
    
    // Cooldown using first order thermal response to ambient
    const dTemp = (tempStress - temperature) * (effectiveDt / thermalTimeConstant);
    temperature = temperature + dTemp;
    temperature = Math.max(tempStress, temperature);  
    
    // Safety trip holds failureRisk high, but calculate actual physical wear risk separately
    failureRisk = 100;
    efficiency = 0;
    simulationTime += effectiveDt;
    syncPercentage = parseFloat((99.5 + randomFn() * 0.4).toFixed(1));

    // A trip means unavailable, not physically destroyed.
    // Cooling health is current auxiliary-system availability, not instantaneous
    // irreversible motor damage. Physical asset health comes from wear components.
    overallHealth = Math.min(bearingHealth, lubricationHealth, statorHealth);
    overallHealth = Math.max(0, Math.min(100, overallHealth));
    health = Math.round(overallHealth);

    return {
      ...state,
      operatingState, 
      health, 
      overallHealth: parseFloat(overallHealth.toFixed(4)), 
      statorHealth: parseFloat(statorHealth.toFixed(4)), 
      bearingHealth: parseFloat(bearingHealth.toFixed(4)), 
      lubricationHealth: parseFloat(lubricationHealth.toFixed(4)), 
      coolingHealth: parseFloat(coolingHealth.toFixed(4)),
      temperature: parseFloat(temperature.toFixed(4)), 
      vibration: parseFloat(vibration.toFixed(4)),
      rpm: Math.round(rpm), 
      voltage: Math.round(voltage), 
      current: parseFloat(current.toFixed(4)), 
      load: Math.round(load),
      cooling: Math.round(coolingSetting * (coolingHealth / 100.0)), 
      efficiency, 
      failureRisk,
      simulationTime, 
      syncPercentage, 
      tripDelayCounter,
      operationalReadiness: 0,
      protectionStatus: 'TRIPPED',
      motorTorque: 0,
      loadTorque: coastLoadTorque,
      synchronousRpm: 1500,
      slipPercent: rpm > 0 ? parseFloat((((1500 - rpm) / 1500) * 100).toFixed(2)) : 100
    };
  }

  // 2. STOPPED State Cooldown & Decay Logic
  if (operatingState === 'STOPPED') {
    rpm = Math.max(0, rpm - 400 * effectiveDt);
    current = Math.max(0, current - 3.0 * effectiveDt);
    load = Math.max(0, load - 50 * effectiveDt);
    vibration = Math.max(0.1, vibration - 2.0 * effectiveDt);
    
    // Cooldown toward ambient
    const dTemp = (tempStress - temperature) * (effectiveDt / thermalTimeConstant);
    temperature = temperature + dTemp;
    temperature = Math.max(tempStress, temperature);
    
    failureRisk = 1;
    efficiency = 0;
    simulationTime += effectiveDt;

    overallHealth = Math.min(bearingHealth, lubricationHealth, statorHealth);
    overallHealth = Math.max(0, Math.min(100, overallHealth));
    health = Math.round(overallHealth);
    
    return {
      ...state,
      operatingState, 
      health, 
      overallHealth: parseFloat(overallHealth.toFixed(4)), 
      statorHealth: parseFloat(statorHealth.toFixed(4)), 
      bearingHealth: parseFloat(bearingHealth.toFixed(4)), 
      lubricationHealth: parseFloat(lubricationHealth.toFixed(4)), 
      coolingHealth: parseFloat(coolingHealth.toFixed(4)),
      temperature: parseFloat(temperature.toFixed(4)), 
      vibration: parseFloat(vibration.toFixed(4)),
      rpm: Math.round(rpm), 
      voltage: Math.round(voltage), 
      current: parseFloat(current.toFixed(4)), 
      load: Math.round(load),
      cooling: Math.round(coolingSetting * (coolingHealth / 100.0)), 
      efficiency, 
      failureRisk,
      simulationTime
      ,operationalReadiness: 0,
      protectionStatus: state.maintenanceCase ? 'VERIFYING' : 'NORMAL',
      motorTorque: 0,
      synchronousRpm: 1500,
      slipPercent: rpm > 0 ? parseFloat((((1500 - rpm) / 1500) * 100).toFixed(2)) : 100
    };
  }

  // 3. RUNNING State Model Update
  simulationTime += effectiveDt;

  // Supply voltage input tracking
  let targetVoltage = voltageSetting;
  if (hasFault('voltage_drop')) {
    targetVoltage = 180;
  }
  let voltageNoise = 0;
  if (hasFault('power_instability')) {
    voltageNoise = Math.sin(simulationTime * 2.0) * 12 + (randomFn() - 0.5) * 5;
  }
  voltage = voltage + (targetVoltage - voltage) * 0.2 * effectiveDt + voltageNoise * 0.1;
  voltage = Math.max(120, Math.min(270, voltage));

  // Three-phase measurements. Power instability represents supply unbalance;
  // aggregate voltage alone would hide this important induction-motor fault.
  const phaseSpread = hasFault('power_instability') ? 0.045 : 0.003;
  const phaseVoltages = [
    voltage * (1 + phaseSpread),
    voltage * (1 - phaseSpread),
    voltage
  ].map(v => parseFloat(v.toFixed(1)));
  const meanPhaseVoltage = phaseVoltages.reduce((a, b) => a + b, 0) / 3;
  const voltageUnbalance = parseFloat((Math.max(...phaseVoltages.map(v => Math.abs(v - meanPhaseVoltage))) / meanPhaseVoltage * 100).toFixed(2));

  // Load input tracking
  let targetLoad = loadSetting;
  if (hasFault('excessive_load')) {
    targetLoad = 115;
  }
  load = load + (targetLoad - load) * 0.15 * effectiveDt;
  load = Math.max(0, Math.min(130, load));

  // Cooling health component wear (cooling fan failure)
  let targetCoolingHealth = 100;
  if (hasFault('cooling_failure')) {
    targetCoolingHealth = 20; // Fan restricted
  }
  coolingHealth = coolingHealth + (targetCoolingHealth - coolingHealth) * 0.15 * effectiveDt;
  coolingHealth = Math.max(20, Math.min(100, coolingHealth));
  cooling = Math.round(coolingSetting * (coolingHealth / 100.0));

  // Lubrication degradation under heat and bearing friction
  if (temperature > 75) {
    const dryRate = (temperature - 75) * 0.015;
    lubricationHealth = Math.max(0, lubricationHealth - dryRate * effectiveDt);
  } else {
    // Lubricant condition does not self-heal while running. A negligible baseline
    // stabilization prevents numerical drift without simulating replenishment.
    lubricationHealth = Math.min(100, lubricationHealth + 0.0001 * effectiveDt);
  }
  if (bearingHealth < 85) {
    // Metal shavings and heat increase lubrication decay
    lubricationHealth = Math.max(0, lubricationHealth - (85 - bearingHealth) * 0.005 * effectiveDt);
  }

  // Bearing structural degradation
  let bearingWear = 0;
  if (hasFault('bearing_degradation')) {
    // Severe seeded defect: accelerated but gradual spalling/wear for demo time.
    bearingWear += 0.12;
  }
  if (temperature > 80) {
    bearingWear += (temperature - 80) * 0.012;
  }
  if (vibration > 3.0) {
    bearingWear += (vibration - 3.0) * 0.05;
  }
  if (lubricationHealth < 40) {
    bearingWear += (40 - lubricationHealth) * 0.015;
  }
  bearingHealth = Math.max(0, bearingHealth - bearingWear * effectiveDt);

  // Stator insulation degradation under heat and overcurrent stress
  let statorWear = 0;
  if (temperature > 85) {
    statorWear += (temperature - 85) * 0.01;
  }
  if (temperature > 100) {
    // Severe thermal runaway/meltdown speed
    statorWear += (temperature - 100) * 0.05;
  }
  if (hasFault('overcurrent')) {
    // Protection should react before an overcurrent instantly destroys insulation.
    statorWear += 0.02;
  }
  statorHealth = Math.max(0, statorHealth - statorWear * effectiveDt);

  // Current draw calculation (slip & voltage proportional)
  const vRatio = voltage / 230.0;
  let targetCurrent = (load / 100.0) * 5.2 + 1.2;
  targetCurrent = targetCurrent / Math.max(0.6, vRatio);
  if (hasFault('overcurrent')) {
    targetCurrent += 3.5;
  }
  current = current + (targetCurrent - current) * 0.25 * effectiveDt;
  current = Math.max(0, current);

  // Vibration calculation (imbalance & bearing wear driven)
  const baseVib = 0.8 + (load / 100.0) * 1.2 + (rpm / 1500.0) * 0.4;
  let faultVib = 0;
  if (hasFault('shaft_imbalance')) {
    faultVib += 4.5;
  }
  if (hasFault('excessive_vibration')) {
    faultVib += 3.5;
  }
  const bearingVib = bearingHealth < 85 ? (85 - bearingHealth) * 0.08 : 0;
  const targetVibration = baseVib + faultVib + bearingVib + (randomFn() - 0.5) * 0.15;
  vibration = vibration + (targetVibration - vibration) * 0.2 * effectiveDt;
  vibration = Math.max(0.1, vibration);

  // Torque/slip/inertia model for a 3.7 kW, four-pole, 50 Hz induction motor.
  const synchronousRpm = 1500;
  const slip = Math.max(0.001, Math.min(1, (synchronousRpm - rpm) / synchronousRpm));
  const ratedTorque = 24.4;
  const breakdownSlip = 0.18;
  const breakdownTorque = ratedTorque * 2.4;
  let motorTorque = (2 * breakdownTorque) / (slip / breakdownSlip + breakdownSlip / slip);
  motorTorque *= Math.pow(voltage / 230, 2);
  if (voltageUnbalance > 2) motorTorque *= Math.max(0.5, 1 - voltageUnbalance * 0.04);
  const loadTorque = ratedTorque * (load / 100);
  const frictionTorque = 0.8 + (100 - bearingHealth) * 0.025 + Math.max(0, vibration - 2.5) * 0.3;
  const angularAcceleration = (motorTorque - loadTorque - frictionTorque) / 1.5;
  const rpmDelta = angularAcceleration * (60 / (2 * Math.PI)) * effectiveDt;
  rpm += Math.max(-25 * effectiveDt, Math.min(25 * effectiveDt, rpmDelta));
  rpm = Math.max(0, Math.min(synchronousRpm * 0.999, rpm));
  const slipPercent = parseFloat((((synchronousRpm - rpm) / synchronousRpm) * 100).toFixed(2));

  const phaseCurrents = phaseVoltages.map(v => parseFloat((current * (meanPhaseVoltage / v)).toFixed(2)));
  if (hasFault('power_instability')) phaseCurrents[1] = parseFloat((phaseCurrents[1] * 1.18).toFixed(2));
  const meanPhaseCurrent = phaseCurrents.reduce((a, b) => a + b, 0) / 3;
  const currentUnbalance = parseFloat((Math.max(...phaseCurrents.map(v => Math.abs(v - meanPhaseCurrent))) / meanPhaseCurrent * 100).toFixed(2));

  // Motor Efficiency
  const thermalLoss = Math.max(0, temperature - 65) * 0.0012;
  const bearingLoss = (100 - bearingHealth) * 0.0015;
  const voltageLoss = Math.abs(voltage - 230) * 0.001;
  const loadLoss = load > 90 ? (load - 90) * 0.002 : (load < 30 ? (30 - load) * 0.002 : 0);
  efficiency = Math.round(92 * (1.0 - thermalLoss - bearingLoss - voltageLoss - loadLoss));
  efficiency = Math.max(10, Math.min(95, efficiency));

  // Stable First-Order Thermal Model
  const coolingFactor = Math.max(0.1, cooling / 92.0);
  const targetElecRise = (20.0 * Math.pow(current / 4.9, 2)) / coolingFactor;
  const targetMechRise = (2.4 * vibration + 0.3 * (100 - bearingHealth)) / coolingFactor;
  const targetThermalStress = hasFault('overheating') ? 35.0 : 0.0;
  const targetTemperature = tempStress + targetElecRise + targetMechRise + targetThermalStress;
  const dTemp = (targetTemperature - temperature) * (effectiveDt / thermalTimeConstant);
  temperature = temperature + dTemp;
  temperature = Math.max(tempStress, temperature);

  // Failure Risk Calculation (0-100 bounded)
  const tempRisk = Math.max(0, Math.min(100, Math.round(((temperature - 55) / 35.0) * 100)));
  const vibRisk = Math.max(0, Math.min(100, Math.round(((vibration - 2.5) / 4.5) * 100)));
  const bearingConditionRisk = Math.max(0, Math.min(100, Math.round(((90 - bearingHealth) / 75.0) * 100)));
  const activeBearingDefectRisk = hasFault('bearing_degradation')
    ? Math.min(80, Math.round(45 + Math.max(0, 95 - bearingHealth) * 0.8))
    : 0;
  const bearingRisk = Math.max(bearingConditionRisk, activeBearingDefectRisk);
  const statorRisk = Math.max(0, Math.min(100, Math.round(((95 - statorHealth) / 75.0) * 100)));
  const voltageRisk = Math.max(0, Math.min(100, Math.round(((Math.abs(voltage - 230) - 20) / 40.0) * 100)));
  const currentRisk = Math.max(0, Math.min(100, Math.round(((current - 6.0) / 4.0) * 100)));
  const loadRisk = Math.max(0, Math.min(100, Math.round(((load - 85) / 30.0) * 100)));
  // Cooling loss is an availability hazard and warning contributor. It is capped
  // below the independent trip threshold; the actual trip still requires thermal damage.
  const coolingRisk = hasFault('cooling_failure')
    ? Math.min(70, Math.max(20, Math.round(((100 - coolingHealth) / 80) * 70)))
    : 0;
  const unbalanceRisk = Math.max(0, Math.min(100, Math.round(Math.max(
    (voltageUnbalance - 2) / 4,
    (currentUnbalance - 10) / 20
  ) * 100)));

  riskContributors = {
    tempRisk,
    vibRisk,
    bearingRisk,
    statorRisk,
    voltageRisk,
    currentRisk,
    loadRisk,
    coolingRisk,
    unbalanceRisk
  };

  const maxRisk = Math.max(tempRisk, vibRisk, bearingRisk, statorRisk, voltageRisk, currentRisk, loadRisk, coolingRisk, unbalanceRisk);
  
  // Definite-time Safety Trip with hysteresis (sustained critical risk >= 95 for 5 seconds)
  if (maxRisk >= 95) {
    tripDelayCounter += effectiveDt;
    if (tripDelayCounter >= 5.0) {
      operatingState = 'FAULTED';
      failureRisk = 100;
      activeFaults.push({
        id: 'critical_trip',
        name: 'Safety Trip',
        severity: 'CRITICAL',
        timestamp: new Date().toISOString(),
        description: 'Safety Trip activated. Critical threshold exceeded for more than 5 seconds.'
      });
      protectionStatus = 'TRIPPED';
    } else {
      failureRisk = Math.max(1, maxRisk);
      protectionStatus = 'TRIP_PENDING';
    }
  } else {
    tripDelayCounter = Math.max(0, tripDelayCounter - effectiveDt * 2.0); // decay trip delay
    failureRisk = Math.max(1, maxRisk);
    protectionStatus = maxRisk >= 45 ? 'WARNING' : 'NORMAL';
  }

  // Overall physical asset health (weakest wear component). Cooling availability
  // affects thermal risk/readiness and only reduces motor health through real heat damage.
  overallHealth = Math.min(bearingHealth, lubricationHealth, statorHealth);
  overallHealth = Math.max(0, Math.min(100, overallHealth));
  health = Math.round(overallHealth);

  syncPercentage = parseFloat((99.6 + (randomFn() - 0.5) * 0.3).toFixed(1));

  return {
    ...state,
    operatingState,
    health,
    overallHealth: parseFloat(overallHealth.toFixed(4)),
    statorHealth: parseFloat(statorHealth.toFixed(4)),
    bearingHealth: parseFloat(bearingHealth.toFixed(4)),
    lubricationHealth: parseFloat(lubricationHealth.toFixed(4)),
    coolingHealth: parseFloat(coolingHealth.toFixed(4)),
    temperature: parseFloat(temperature.toFixed(4)),
    vibration: parseFloat(vibration.toFixed(4)),
    rpm: Math.round(rpm),
    voltage: Math.round(voltage),
    current: parseFloat(current.toFixed(4)),
    load: Math.round(load),
    cooling: Math.round(cooling),
    efficiency,
    failureRisk,
    riskContributors,
    tripDelayCounter,
    simulationTime,
    syncPercentage,
    activeFaults,
    operationalReadiness: operatingState === 'FAULTED'
      ? 0
      : Math.max(0, Math.round(Math.min(100 - failureRisk, coolingHealth))),
    protectionStatus,
    synchronousRpm,
    slipPercent,
    motorTorque: parseFloat(motorTorque.toFixed(2)),
    loadTorque: parseFloat(loadTorque.toFixed(2)),
    phaseVoltages,
    phaseCurrents,
    voltageUnbalance,
    currentUnbalance,
  };
}

export function createProjectionState(initialState, modifications = {}, mode = 'current') {
  let baseState;
  
  if (mode === 'healthy') {
    // Start from clean healthy baseline state
    baseState = getInitialState();
  } else {
    // Clone current live state and strip runtime safety trip artifacts
    baseState = { ...initialState };
    baseState.activeFaults = (initialState.activeFaults || []).filter(f => f.id !== 'critical_trip');
    baseState.tripDelayCounter = 0;
    
    // Restore normal running parameters if motor was tripped/stopped
    if (baseState.operatingState !== 'RUNNING') {
      baseState.operatingState = 'RUNNING';
      baseState.rpm = 1480;
      baseState.current = 4.9;
      baseState.vibration = 2.1;
      baseState.temperature = Math.max(64.2, baseState.temperature); // preserve thermal energy
      baseState.load = baseState.loadSetting || 64;
    }
  }

  // Deep merge modifications
  const mergedState = {
    ...baseState,
    ...modifications,
    activeFaults: [...(modifications.activeFaults || baseState.activeFaults)],
    simulationSpeed: 1, // evaluate projection metrics at 1x time constant speed
  };

  if (modifications.injectFault) {
    const fault = modifications.injectFault;
    if (!mergedState.activeFaults.some(f => f.id === fault.id)) {
      mergedState.activeFaults.push(fault);
    }
  }

  // Pre-evaluate state variables instantly using a 0.0s time step
  return step(mergedState, 0.0);
}

export function runWhatIf(initialState, durationMinutes, modifications = {}, mode = 'current', seed = 12345) {
  // Initialize seeded LCG generator for deterministic simulation outcomes
  const randomFn = createSeededRandom(seed);
  
  // Clone and configure snapshot model
  let testState = createProjectionState(initialState, modifications, mode);
  
  const stepsPerMinute = 60; // 1-second ticks
  const timeline = [];
  const snapshotMinutes = [0, 1, 2, 5, 10, 20, 30, 60];
  const maxDuration = Math.min(durationMinutes, 60);

  let failureAtSeconds = -1;
  let tripAtSeconds = -1;
  let currentSecond = 0;
  const peakEvidence = {
    temperature: testState.temperature,
    vibration: testState.vibration,
    current: testState.current,
    minVoltage: testState.voltage,
    minBearingHealth: testState.bearingHealth,
  };
  const maxContributors = { ...(testState.riskContributors || {}) };
  let maxObservedRisk = testState.failureRisk || 0;

  // Capture starting milestone
  const captureSnapshot = (min) => {
    timeline.push({
      minutes: min,
      temperature: Math.round(testState.temperature * 10) / 10, // display rounded
      vibration: Math.round(testState.vibration * 10) / 10,
      rpm: testState.rpm,
      voltage: testState.voltage,
      current: Math.round(testState.current * 10) / 10,
      load: testState.load,
      bearingHealth: Math.round(testState.bearingHealth),
      lubricationHealth: Math.round(testState.lubricationHealth),
      statorHealth: Math.round(testState.statorHealth),
      coolingHealth: Math.round(testState.coolingHealth),
      health: testState.health,
      overallHealth: testState.overallHealth,
      failureRisk: testState.failureRisk,
      operatingState: testState.operatingState,
      cooling: testState.cooling,
    });
  };

  captureSnapshot(0);

  for (let m = 1; m <= maxDuration; m++) {
    for (let s = 0; s < stepsPerMinute; s++) {
      currentSecond++;
      const previousState = testState.operatingState;
      testState = step(testState, 1.0, randomFn);
      peakEvidence.temperature = Math.max(peakEvidence.temperature, testState.temperature);
      peakEvidence.vibration = Math.max(peakEvidence.vibration, testState.vibration);
      peakEvidence.current = Math.max(peakEvidence.current, testState.current);
      peakEvidence.minVoltage = Math.min(peakEvidence.minVoltage, testState.voltage);
      peakEvidence.minBearingHealth = Math.min(peakEvidence.minBearingHealth, testState.bearingHealth);
      for (const [key, value] of Object.entries(testState.riskContributors || {})) {
        maxContributors[key] = Math.max(maxContributors[key] || 0, value);
      }
      maxObservedRisk = Math.max(maxObservedRisk, testState.failureRisk || 0);
      
      // Track threshold-crossing triggers
      if (tripAtSeconds === -1 && previousState === 'RUNNING' && testState.operatingState === 'FAULTED') {
        tripAtSeconds = currentSecond;
      }
      if (failureAtSeconds === -1 && (testState.statorHealth < 10 || testState.bearingHealth < 10)) {
        failureAtSeconds = currentSecond;
      }
    }

    if (snapshotMinutes.includes(m)) {
      captureSnapshot(m);
    }
  }

  // Ensure final duration has a snapshot card
  if (!snapshotMinutes.includes(maxDuration)) {
    captureSnapshot(maxDuration);
  }

  // Evaluate outcomes
  let outcome = 'stable';
  if (tripAtSeconds !== -1) {
    outcome = 'tripped';
  } else if (testState.overallHealth < 80 || maxObservedRisk >= 45) {
    outcome = 'degraded';
  }

  // Find dominant risk contributors (> 40%)
  const lastState = testState;
  // Use the worst evidence observed over the forecast, not the cooled-down final state.
  const contributors = maxContributors;
  const dominantRiskFactors = [];
  if (contributors.tempRisk > 40) dominantRiskFactors.push('High Temperature');
  if (contributors.vibRisk > 40) dominantRiskFactors.push('High Vibration');
  if (contributors.bearingRisk > 40) dominantRiskFactors.push('Bearing Wear');
  if (contributors.statorRisk > 40) dominantRiskFactors.push('Stator Insulation Wear');
  if (contributors.voltageRisk > 40) dominantRiskFactors.push('Voltage Mismatch');
  if (contributors.currentRisk > 40) dominantRiskFactors.push('Winding Overcurrent');
  if (contributors.loadRisk > 40) dominantRiskFactors.push('Motor Overload');
  if (contributors.coolingRisk > 40) dominantRiskFactors.push('Cooling System Unavailable');
  if (contributors.unbalanceRisk > 40) dominantRiskFactors.push('Three-Phase Supply Unbalance');

  if (dominantRiskFactors.length === 0) {
    dominantRiskFactors.push('None (Healthy Baseline)');
  }

  // Dynamic explanation compiler
  let explanation = '';
  if (outcome === 'tripped') {
    const tripMins = Math.floor(tripAtSeconds / 60);
    const tripSecs = tripAtSeconds % 60;
    explanation = `Critical trip triggered at ${tripMins}m ${tripSecs}s. `;
    if (modifications.injectFault?.id === 'cooling_failure' || lastState.coolingHealth < 50) {
      explanation += `Thermal overload occurred due to restricted cooling. Peak winding temperature reached ${Math.round(peakEvidence.temperature * 10)/10}°C before the safety trip; the later lower values are post-trip cooldown.`;
    } else if (modifications.injectFault?.id === 'bearing_degradation' || lastState.bearingHealth < 30) {
      explanation += `Mechanical trip triggered by bearing degradation. Peak vibration reached ${Math.round(peakEvidence.vibration * 10)/10} mm/s and minimum bearing health reached ${Math.round(peakEvidence.minBearingHealth)}%.`;
    } else if (modifications.injectFault?.id === 'voltage_drop' || lastState.voltage < 195) {
      explanation += `Electrical current peaked at ${Math.round(peakEvidence.current * 10)/10}A while minimum supply voltage was ${Math.round(peakEvidence.minVoltage)}V, accelerating stator winding heating before the trip.`;
    } else {
      explanation += `Safety threshold breached due to combined mechanical and thermal stress, activating emergency lockout.`;
    }
  } else if (outcome === 'degraded') {
    explanation = `Motor survived the forecast window, but is in a degraded condition. Overall asset health is ${Math.round(lastState.overallHealth)}%. `;
    if (lastState.bearingHealth < 75) {
      explanation += `Bearings show signs of physical wear (${Math.round(lastState.bearingHealth)}%). `;
    }
    if (lastState.temperature > 75) {
      explanation += `Temperature remains elevated at ${Math.round(lastState.temperature * 10)/10}°C, accelerating core damage. `;
    }
    if (contributors.voltageRisk > 40) explanation += `Supply voltage mismatch reached a material risk level and should be corrected before continued service. `;
    if (contributors.loadRisk > 40) explanation += `Sustained mechanical load exceeded the preferred operating range. `;
    if (contributors.vibRisk > 40 || contributors.bearingRisk > 40) explanation += `Mechanical inspection should cover bearings, lubrication, alignment, and rotor balance. `;
    if (contributors.tempRisk > 40 || contributors.coolingRisk > 40) explanation += `Cooling airflow and thermal loading require inspection. `;
  } else {
    explanation = `Nominal operation projected. Winding temperature stabilizes around ${Math.round(lastState.temperature * 10)/10}°C, mechanical vibration is low at ${Math.round(lastState.vibration * 10)/10} mm/s, and overall health remains excellent at ${Math.round(lastState.overallHealth)}%.`;
  }

  const recommendations = [];
  if (outcome === 'tripped') {
    recommendations.push('Perform complete motor reset.');
    if (dominantRiskFactors.includes('High Temperature')) recommendations.push('Inspect cooling fan inlet vents for restrictions.');
    if (dominantRiskFactors.includes('Bearing Wear')) recommendations.push('Replace motor bearings and align coupler joints.');
    if (dominantRiskFactors.includes('Winding Overcurrent')) recommendations.push('Adjust supply voltage and limit load multiplier.');
  } else if (outcome === 'degraded') {
    recommendations.push('Schedule inspection at next shift break.');
    if (lastState.lubricationHealth < 60) recommendations.push('Apply bearing lubrication grease.');
    if (lastState.load > 85) recommendations.push('Derate operational load capacity.');
    if (dominantRiskFactors.includes('Voltage Mismatch')) recommendations.push('Restore the regulated three-phase supply near 230 V before continued operation.');
    if (dominantRiskFactors.includes('Cooling System Unavailable') || dominantRiskFactors.includes('High Temperature')) recommendations.push('Inspect airflow, fan operation, and cooling inlet restrictions.');
    if (dominantRiskFactors.includes('High Vibration') || dominantRiskFactors.includes('Bearing Wear')) recommendations.push('Inspect bearing condition, lubrication, alignment, and rotor balance.');
  } else {
    recommendations.push('No action required. Maintain standard monitoring schedules.');
  }

  const assumptions = [
    "First-order thermal lag model (Time Constant = 300s)",
    "Definite-time overlimit safety trip delay = 5.0s",
    "Seeded LCG pseudo-random noise generator",
    "Minimum-link overall asset health metric"
  ];

  return {
    timeline,
    outcome,
    failureAtSeconds,
    tripAtSeconds,
    dominantRiskFactors,
    recommendations,
    explanation,
    peakEvidence: {
      temperature: Math.round(peakEvidence.temperature * 10) / 10,
      vibration: Math.round(peakEvidence.vibration * 10) / 10,
      current: Math.round(peakEvidence.current * 10) / 10,
      minVoltage: Math.round(peakEvidence.minVoltage),
      minBearingHealth: Math.round(peakEvidence.minBearingHealth),
    },
    assumptions,
    seed,
  };
}
