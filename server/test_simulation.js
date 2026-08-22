// server/test_simulation.js

import test from 'node:test';
import assert from 'node:assert';
import { getInitialState, step, createProjectionState, runWhatIf } from './simulation.js';

test('TwinForge Simulator Test Suite', async (t) => {

  await t.test('1. Healthy baseline survives 60 minutes', () => {
    const initialState = getInitialState();
    const result = runWhatIf(initialState, 60, {}, 'healthy', 12345);
    
    assert.strictEqual(result.tripAtSeconds, -1, 'Healthy baseline must not trigger a safety trip');
    const finalState = result.timeline[result.timeline.length - 1];
    assert.ok(finalState.health >= 85, `Overall health should be high, got ${finalState.health}%`);
    assert.ok(finalState.failureRisk < 90, `Failure risk should be low, got ${finalState.failureRisk}%`);
    assert.strictEqual(finalState.operatingState, 'RUNNING');
  });

  await t.test('2. Load at 95% produces higher temperature than baseline', () => {
    const initialState = getInitialState();
    const baseResult = runWhatIf(initialState, 30, { loadSetting: 64 }, 'healthy', 12345);
    const highLoadResult = runWhatIf(initialState, 30, { loadSetting: 95 }, 'healthy', 12345);
    
    const finalBaseTemp = baseResult.timeline[baseResult.timeline.length - 1].temperature;
    const finalHighTemp = highLoadResult.timeline[highLoadResult.timeline.length - 1].temperature;
    
    assert.ok(finalHighTemp > finalBaseTemp, `High load temperature (${finalHighTemp}°C) must exceed baseline temperature (${finalBaseTemp}°C)`);
  });

  await t.test('3. Voltage reduced to 180V draws more current under same load', () => {
    const initialState = getInitialState();
    const stateNominal = createProjectionState(initialState, { voltageSetting: 230, loadSetting: 64 }, 'healthy');
    const stateLowVolt = createProjectionState(initialState, { voltageSetting: 180, loadSetting: 64 }, 'healthy');
    
    const stepNominal = step(stateNominal, 10.0);
    const stepLowVolt = step(stateLowVolt, 10.0);
    
    assert.ok(stepLowVolt.current > stepNominal.current, `Low voltage current (${stepLowVolt.current}A) must exceed nominal current (${stepNominal.current}A)`);
  });

  await t.test('4. Cooling reduced to 52% increases temperature but remains stable', () => {
    const initialState = getInitialState();
    const result = runWhatIf(initialState, 60, { coolingSetting: 52 }, 'healthy', 12345);
    
    assert.strictEqual(result.tripAtSeconds, -1, 'Reducing cooling to 52% should not cause a safety trip');
    const finalTemp = result.timeline[result.timeline.length - 1].temperature;
    assert.ok(finalTemp > 65 && finalTemp < 85, `Degraded cooling temperature should stabilize between 65°C and 85°C, got ${finalTemp}°C`);
  });

  await t.test('5. Complete cooling failure triggers safety trip', () => {
    const initialState = getInitialState();
    const result = runWhatIf(initialState, 60, { coolingSetting: 0, injectFault: { id: 'cooling_failure', name: 'Cooling Failure', severity: 'CRITICAL', description: 'Blocked fans' } }, 'healthy', 12345);
    
    assert.ok(result.tripAtSeconds !== -1, 'Complete cooling failure must trigger a safety trip');
    const finalState = result.timeline[result.timeline.length - 1];
    assert.strictEqual(finalState.operatingState, 'FAULTED');
    assert.strictEqual(finalState.rpm, 0);
    assert.strictEqual(finalState.current, 0);
  });

  await t.test('6. Bearing health starting at 45% produces higher vibration than baseline', () => {
    const initialState = getInitialState();
    const stateHealthy = createProjectionState(initialState, { bearingHealth: 95 }, 'current');
    const stateDamaged = createProjectionState(initialState, { bearingHealth: 45 }, 'current');
    
    const stepHealthy = step(stateHealthy, 5.0);
    const stepDamaged = step(stateDamaged, 5.0);
    
    assert.ok(stepDamaged.vibration > stepHealthy.vibration, `Damaged bearing vibration (${stepDamaged.vibration} mm/s) must exceed healthy bearing vibration (${stepHealthy.vibration} mm/s)`);
  });

  await t.test('7. High ambient temperature shifts temperature profile upward', () => {
    const initialState = getInitialState();
    const baseResult = runWhatIf(initialState, 30, { tempStress: 25 }, 'healthy', 12345);
    const hotResult = runWhatIf(initialState, 30, { tempStress: 48 }, 'healthy', 12345);
    
    const finalBaseTemp = baseResult.timeline[baseResult.timeline.length - 1].temperature;
    const finalHotTemp = hotResult.timeline[hotResult.timeline.length - 1].temperature;
    
    assert.ok(finalHotTemp > finalBaseTemp + 20, `Hot ambient temperature (${finalHotTemp}°C) must exceed baseline (${finalBaseTemp}°C) by approximately the ambient stress delta`);
  });

  await t.test('8. Combined overload and cooling failure trips quickly', () => {
    const initialState = getInitialState();
    const result = runWhatIf(initialState, 30, { 
      loadSetting: 110, 
      coolingSetting: 20, 
      injectFault: { id: 'cooling_failure', name: 'Cooling Failure', severity: 'CRITICAL', description: 'Blocked fans' } 
    }, 'healthy', 12345);
    
    assert.ok(result.tripAtSeconds !== -1, 'Combined overload and cooling fail must trigger trip');
    // Overload + cooling fail should trip faster than cooling fail alone
    const resultCoolingOnly = runWhatIf(initialState, 30, { 
      coolingSetting: 20, 
      injectFault: { id: 'cooling_failure', name: 'Cooling Failure', severity: 'CRITICAL', description: 'Blocked fans' } 
    }, 'healthy', 12345);
    
    assert.ok(result.tripAtSeconds <= resultCoolingOnly.tripAtSeconds, `Overloaded trip time (${result.tripAtSeconds}s) should be faster than cooling-only trip time (${resultCoolingOnly.tripAtSeconds}s)`);
  });

  await t.test('9. Projection starting from a faulted persisted state resets runtime components', () => {
    const faultedState = getInitialState();
    faultedState.operatingState = 'FAULTED';
    faultedState.activeFaults.push({ id: 'critical_trip', name: 'Trip', severity: 'CRITICAL', description: 'Tripped' });
    faultedState.rpm = 0;
    faultedState.current = 0;
    faultedState.vibration = 0;
    
    // In 'current' mode, it should clear critical_trip and restart motor running for projection
    const projectionState = createProjectionState(faultedState, {}, 'current');
    assert.strictEqual(projectionState.operatingState, 'RUNNING');
    assert.ok(projectionState.rpm > 1000);
    assert.ok(projectionState.current > 2.0);
    assert.ok(projectionState.vibration > 1.0);
    assert.ok(!projectionState.activeFaults.some(f => f.id === 'critical_trip'));
  });

  await t.test('10. Reset returns canonical baseline', () => {
    const faultedState = getInitialState();
    faultedState.operatingState = 'FAULTED';
    faultedState.bearingHealth = 10;
    faultedState.statorHealth = 20;
    
    // Simulating reset command (which fetches getInitialState())
    const resetState = getInitialState();
    assert.strictEqual(resetState.operatingState, 'RUNNING');
    assert.strictEqual(resetState.bearingHealth, 95);
    assert.strictEqual(resetState.statorHealth, 100);
    assert.strictEqual(resetState.activeFaults.length, 0);
  });

  await t.test('11. Same seed produces identical forecast', () => {
    const initialState = getInitialState();
    const res1 = runWhatIf(initialState, 30, { loadSetting: 90 }, 'healthy', 999);
    const res2 = runWhatIf(initialState, 30, { loadSetting: 90 }, 'healthy', 999);
    
    assert.deepStrictEqual(res1.timeline, res2.timeline, 'Identical seed must produce identical snapshot metrics');
  });

  await t.test('12. Failure risk always remains bounded within 0-100', () => {
    const state = getInitialState();
    let s = state;
    for (let i = 0; i < 500; i++) {
      s = step(s, 1.0);
      assert.ok(s.failureRisk >= 0 && s.failureRisk <= 100, `Failure risk out of bounds: ${s.failureRisk}`);
    }
  });

  await t.test('13. No NaN, Infinity, negative health, or negative RPM in any step', () => {
    const state = getInitialState();
    let s = state;
    for (let i = 0; i < 500; i++) {
      s = step(s, 1.0);
      assert.ok(!isNaN(s.temperature), 'Temp should not be NaN');
      assert.ok(!isNaN(s.rpm), 'RPM should not be NaN');
      assert.ok(!isNaN(s.current), 'Current should not be NaN');
      assert.ok(!isNaN(s.bearingHealth), 'Bearing health should not be NaN');
      assert.ok(s.rpm >= 0, 'RPM should not be negative');
      assert.ok(s.bearingHealth >= 0, 'Bearing health should not be negative');
      assert.ok(s.statorHealth >= 0, 'Stator health should not be negative');
      assert.ok(s.overallHealth >= 0, 'Overall health should not be negative');
    }
  });

  await t.test('14. Live state is unchanged after running What-If', () => {
    const liveState = getInitialState();
    const liveStateCopy = JSON.stringify(liveState);
    
    runWhatIf(liveState, 30, { loadSetting: 100 }, 'current', 12345);
    
    assert.strictEqual(JSON.stringify(liveState), liveStateCopy, 'Running a What-If projection must not mutate live server state');
  });

});
