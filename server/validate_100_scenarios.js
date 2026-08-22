import fs from 'node:fs';
import { getInitialState, runWhatIf } from './simulation.js';

const fault = (id, name = id) => ({ id, name, severity: 'CRITICAL', description: `Validation scenario: ${name}` });
const final = result => result.timeline[result.timeline.length - 1];
const results = [];

function record(group, name, settings, result, checks) {
  const end = final(result);
  const failedChecks = checks.filter(check => !check.pass).map(check => check.name);
  results.push({
    group, name, settings, outcome: result.outcome, tripAtSeconds: result.tripAtSeconds,
    final: { rpm: end.rpm, temperature: end.temperature, vibration: end.vibration, current: end.current, health: end.health, risk: end.failureRisk },
    pass: failedChecks.length === 0, failedChecks,
  });
}

// Fifty combinations inside the declared continuous operating envelope.
for (let i = 0; i < 50; i++) {
  const settings = {
    loadSetting: 35 + (i * 7) % 46,
    voltageSetting: 218 + (i * 5) % 25,
    coolingSetting: 78 + (i * 3) % 23,
    tempStress: 18 + (i * 2) % 18,
  };
  const result = runWhatIf(getInitialState(), 30, settings, 'healthy', 1000 + i);
  const end = final(result);
  record('acceptable', `Acceptable envelope ${i + 1}`, settings, result, [
    { name: 'must remain running', pass: result.outcome !== 'tripped' },
    { name: 'risk below critical', pass: end.failureRisk < 80 },
    { name: 'temperature below trip region', pass: end.temperature < 90 },
    { name: 'speed remains useful', pass: end.rpm > 1350 && end.rpm < 1500 },
    { name: 'vibration below warning', pass: end.vibration < 3 },
    { name: 'health retained', pass: end.health >= 85 },
  ]);
}

const failureFamilies = [
  ['Cooling blockage', i => ({ coolingSetting: 35 - i * 3, loadSetting: 85 + i * 3, injectFault: fault('cooling_failure', 'Cooling blockage') })],
  ['External overheating', i => ({ tempStress: 40 + i * 2, loadSetting: 80 + i * 3, injectFault: fault('overheating', 'External overheating') })],
  ['Bearing degradation', i => ({ bearingHealth: 55 - i * 6, lubricationHealth: 55 - i * 7, injectFault: fault('bearing_degradation', 'Bearing degradation') })],
  ['Shaft imbalance', i => ({ loadSetting: 75 + i * 5, injectFault: fault('shaft_imbalance', 'Shaft imbalance') })],
  ['Excessive vibration', i => ({ loadSetting: 75 + i * 5, injectFault: fault('excessive_vibration', 'Excessive vibration') })],
  ['Voltage drop', i => ({ voltageSetting: 195 - i * 5, loadSetting: 75 + i * 5, injectFault: fault('voltage_drop', 'Voltage drop') })],
  ['Overcurrent', i => ({ loadSetting: 80 + i * 4, injectFault: fault('overcurrent', 'Overcurrent') })],
  ['Power unbalance', i => ({ loadSetting: 75 + i * 5, injectFault: fault('power_instability', 'Power unbalance') })],
  ['Excessive load', i => ({ loadSetting: 100 + i * 4, injectFault: fault('excessive_load', 'Excessive load') })],
  ['Combined thermal/mechanical', i => ({ coolingSetting: 45 - i * 4, loadSetting: 95 + i * 4, bearingHealth: 70 - i * 5, activeFaults: [fault('cooling_failure'), fault('shaft_imbalance')] })],
];

for (const [family, makeSettings] of failureFamilies) {
  for (let severity = 0; severity < 5; severity++) {
    const settings = makeSettings(severity);
    const result = runWhatIf(getInitialState(), 30, settings, 'healthy', 2000 + results.length);
    const end = final(result);
    record('failure', `${family} severity ${severity + 1}`, settings, result, [
      { name: 'fault must be observable', pass: result.outcome !== 'stable' || end.failureRisk >= 40 || end.vibration >= 3 || end.temperature >= 75 || end.rpm < 1400 },
      { name: 'risk bounded', pass: end.failureRisk >= 0 && end.failureRisk <= 100 },
      { name: 'finite telemetry', pass: [end.rpm, end.temperature, end.vibration, end.current, end.health].every(Number.isFinite) },
      { name: 'trip cuts electrical power', pass: result.outcome !== 'tripped' || (end.current === 0 && end.load === 0) },
    ]);
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  declaredMotor: '3.7 kW, 230 V, 50 Hz, four-pole TEFC squirrel-cage induction motor prototype',
  total: results.length,
  passed: results.filter(r => r.pass).length,
  failed: results.filter(r => !r.pass).length,
  acceptable: { total: 50, passed: results.filter(r => r.group === 'acceptable' && r.pass).length },
  failure: { total: 50, passed: results.filter(r => r.group === 'failure' && r.pass).length },
};

const report = { summary, failures: results.filter(r => !r.pass), results };
fs.mkdirSync(new URL('../validation/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../validation/scenario-report.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.failed) {
  console.log('\nFailed scenarios:');
  for (const item of report.failures) console.log(`- ${item.name}: ${item.failedChecks.join(', ')}`);
  process.exitCode = 1;
}
