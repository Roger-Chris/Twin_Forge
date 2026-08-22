import assert from 'node:assert/strict';
import { createSeededRandom, getInitialState, step } from './simulation.js';

const fields = [
  'simulationTime', 'temperature', 'vibration', 'rpm', 'current', 'load',
  'bearingHealth', 'lubricationHealth', 'statorHealth', 'overallHealth',
  'failureRisk', 'slipPercent', 'motorTorque', 'loadTorque',
];

function run(speed, realSeconds, configure = state => state) {
  let state = configure({ ...getInitialState(), simulationSpeed: speed });
  const random = createSeededRandom(44017);
  for (let second = 0; second < realSeconds; second += 1) {
    state = step(state, 1, random);
  }
  return state;
}

function compareEquivalent(label, configure = state => state) {
  const one = run(1, 600, configure);
  const five = run(5, 120, configure);
  const ten = run(10, 60, configure);
  for (const field of fields) {
    assert.equal(five[field], one[field], `${label}: 5x ${field} differs from 1x`);
    assert.equal(ten[field], one[field], `${label}: 10x ${field} differs from 1x`);
    assert.ok(Number.isFinite(one[field]), `${label}: ${field} is not finite`);
  }
  assert.equal(five.operatingState, one.operatingState, `${label}: 5x state differs`);
  assert.equal(ten.operatingState, one.operatingState, `${label}: 10x state differs`);
  return {
    label,
    state: one.operatingState,
    simulatedSeconds: one.simulationTime,
    rpm: one.rpm,
    temperature: one.temperature,
    vibration: one.vibration,
    current: one.current,
    health: one.overallHealth,
    risk: one.failureRisk,
  };
}

const results = [
  compareEquivalent('healthy baseline'),
  compareEquivalent('high sustained load', state => ({ ...state, loadSetting: 95 })),
  compareEquivalent('low voltage', state => ({ ...state, voltageSetting: 180 })),
  compareEquivalent('restricted cooling', state => ({ ...state, coolingSetting: 45 })),
  compareEquivalent('hot ambient', state => ({ ...state, tempStress: 50 })),
  compareEquivalent('bearing degradation', state => ({ ...state, bearingHealth: 45 })),
];

console.log(JSON.stringify({ passed: results.length, total: results.length, results }, null, 2));
