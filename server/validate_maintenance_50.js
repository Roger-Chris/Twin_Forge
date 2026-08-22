import fs from 'node:fs';

const base = 'http://127.0.0.1:3001';
const faultFamilies = [
  ['cooling_failure', 'Cooling Loss'], ['overheating', 'Thermal Overload'],
  ['bearing_degradation', 'Bearing Damage'], ['shaft_imbalance', 'Shaft Imbalance'],
  ['excessive_vibration', 'Excessive Vibration'], ['voltage_drop', 'Voltage Drop'],
  ['overcurrent', 'Overcurrent'], ['power_instability', 'Three-Phase Unbalance'],
  ['excessive_load', 'Excessive Load'], ['cooling_failure', 'Combined Thermal Stress'],
];

async function post(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  return { status: response.status, data };
}

const results = [];
for (let i = 0; i < 50; i++) {
  const [id, name] = faultFamilies[i % faultFamilies.length];
  await post('/api/control', { command: 'RESET' });
  await post('/api/faults/inject', { id, name, severity: 'CRITICAL', description: `Maintenance validation ${i + 1}` });
  const diagnose = await post('/api/maintenance/resolve', { id, action: 'diagnose' });
  const bypass = await post('/api/control', { command: 'START' });
  const repair = await post('/api/maintenance/resolve', { action: 'repair' });
  const verify = await post('/api/maintenance/resolve', { action: 'verify' });
  const restart = await post('/api/maintenance/resolve', { action: 'restart' });
  const checks = {
    diagnosed: diagnose.data.report?.stage === 'DIAGNOSED',
    restartBlockedBeforeVerification: bypass.status === 409,
    repairActionsReported: repair.data.report?.stage === 'REPAIRED' && repair.data.report.actions?.length >= 2,
    verificationPassed: verify.data.report?.stage === 'VERIFIED' && verify.data.report.verified === true,
    monitoredRestart: restart.data.report?.stage === 'MONITORED_RESTART' && restart.data.state?.operatingState === 'RUNNING',
    safeRestartLoad: restart.data.state?.loadSetting <= 30,
    causalFaultCleared: !restart.data.state?.activeFaults?.some(f => f.id === id),
  };
  results.push({ case: i + 1, id, name, pass: Object.values(checks).every(Boolean), checks, actions: repair.data.report?.actions || [] });
}

const report = { generatedAt: new Date().toISOString(), total: 50, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
fs.mkdirSync(new URL('../validation/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../validation/maintenance-report.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed }, null, 2));
for (const item of results.filter(r => !r.pass)) console.log(item);
if (report.failed) process.exitCode = 1;
